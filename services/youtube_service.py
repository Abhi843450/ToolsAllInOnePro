"""
YouTube Service — yt-dlp Python API integration with PO Token provider support.

Architecture:
  - Uses yt-dlp Python API (not subprocess) for metadata extraction
  - bgutil-ytdlp-pot-provider HTTP server for dynamic PO token generation
  - Optional YOUTUBE_COOKIES_B64 for authentication fallback
  - In-memory bounded job queue with max 2 concurrent workers
  - Structured error codes and sanitized logging
  - Temporary file cleanup with periodic scheduler

DO NOT expose: cookies, PO tokens, secrets, raw stack traces.
"""

import os
import re
import sys
import time
import uuid
import base64
import shutil
import logging
import hashlib
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# Module-level state
# ─────────────────────────────────────────────────────────────

_provider = {"process": None, "port": 4416, "ready": False}
_cookies_configured = False
_job_store = {}
_lock = threading.Lock()
_executor = ThreadPoolExecutor(max_workers=2)

DOWNLOADS_DIR = "/tmp/toolsallinone/downloads"
COOKIES_B64 = os.environ.get("YOUTUBE_COOKIES_B64", "")
COOKIES_FILE_PATH = "/tmp/youtube_cookies.txt"
BGUTIL_ENABLED = os.environ.get("BGUTIL_ENABLED", "1") == "1"


# ─────────────────────────────────────────────────────────────
# PO Token Provider (bgutil-ytdlp-pot-provider HTTP server)
# ─────────────────────────────────────────────────────────────

def start_pot_provider():
    """Start the bgutil-ytdlp-pot-provider HTTP server in background."""
    global _provider

    server_path = "/opt/bgutil-ytdlp-pot-provider/server/build/main.js"
    if not os.path.isfile(server_path):
        logger.warning("[YT INIT] bgutil server not found at %s", server_path)
        return

    try:
        proc = subprocess.Popen(
            ["node", server_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid if hasattr(os, "setsid") else None,
        )
        _provider["process"] = proc
        logger.info("[YT INIT] bgutil server started (pid=%s, port=%s)", proc.pid, _provider["port"])
    except OSError as e:
        logger.warning("[YT INIT] failed to start bgutil server: %s", e)
        return

    # Wait up to 15s for server to become ready
    for _ in range(15):
        time.sleep(1)
        try:
            import urllib.request
            req = urllib.request.Request(
                f"http://127.0.0.1:{_provider['port']}/",
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status < 500:
                    _provider["ready"] = True
                    logger.info("[YT INIT] bgutil server ready")
                    return
        except (ConnectionRefusedError, OSError):
            continue
        except Exception:
            break
    logger.warning("[YT INIT] bgutil server did not become ready within 15s")


def _restart_pot_provider():
    """Kill and restart the bgutil server."""
    global _provider
    old = _provider.get("process")
    if old and old.poll() is None:
        try:
            os.killpg(os.getpgid(old.pid), 15)
        except Exception:
            pass
        old.wait(timeout=5)
    _provider["process"] = None
    _provider["ready"] = False
    start_pot_provider()


# ─────────────────────────────────────────────────────────────
# Cookie Configuration
# ─────────────────────────────────────────────────────────────

def load_cookie_configuration():
    """
    Read YOUTUBE_COOKIES_B64 env var and write decoded Netscape cookies.txt
    to /tmp/youtube_cookies.txt. Returns True if cookies are configured.
    Never logs or exposes cookie contents.
    """
    global _cookies_configured
    raw = COOKIES_B64
    if not raw:
        _cookies_configured = False
        return False
    try:
        try:
            content = base64.b64decode(raw, validate=True).decode("utf-8")
        except Exception:
            content = raw
        os.makedirs(os.path.dirname(COOKIES_FILE_PATH), exist_ok=True)
        with open(COOKIES_FILE_PATH, "w", encoding="utf-8") as f:
            f.write(content)
        try:
            os.chmod(COOKIES_FILE_PATH, 0o600)
        except OSError:
            pass
        _cookies_configured = True
        logger.info("[YT INIT] cookies configured from environment variable")
        return True
    except Exception:
        logger.warning("[YT INIT] failed to decode cookies from YOUTUBE_COOKIES_B64")
        _cookies_configured = False
        return False


# ─────────────────────────────────────────────────────────────
# URL Validation (SSRF protection)
# ─────────────────────────────────────────────────────────────

_YOUTUBE_HOST_RE = re.compile(
    r"^(www\.|m\.|music\.)?youtube\.com$",
    re.IGNORECASE,
)
_YOUTUBE_BE_HOST_RE = re.compile(r"^youtu\.be$", re.IGNORECASE)


def validate_youtube_url(url):
    """
    Validate URL is a legitimate YouTube URL.
    Rejects localhost, private IPs, file://, ftp://, etc.
    Returns (is_valid, video_id_or_None, error_message_or_None).
    """
    if not url or not isinstance(url, str):
        return False, None, "No URL provided"
    if len(url) > 500:
        return False, None, "URL too long"
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url)
    except Exception:
        return False, None, "Malformed URL"

    if parsed.scheme not in ("http", "https"):
        return False, None, "Invalid URL scheme"
    hostname = (parsed.hostname or "").lower()

    # Block non-YouTube hosts
    if not _YOUTUBE_HOST_RE.match(hostname) and not _YOUTUBE_BE_HOST_RE.match(hostname):
        return False, None, "Not a YouTube URL"

    # Block private/loopback IPs (SSRF protection)
    if hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
        return False, None, "Invalid host"

    # Block private network IPs
    try:
        import ipaddress
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            return False, None, "Invalid host"
    except (ValueError, TypeError):
        pass  # hostname is a domain name, not an IP — fine

    vid = extract_video_id(url)
    if not vid:
        return False, None, "Could not extract video ID from URL"
    return True, vid, None


def extract_video_id(url):
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r"(?:youtube\.com/watch\?v=)([a-zA-Z0-9_-]{11})",
        r"(?:youtu\.be/)([a-zA-Z0-9_-]{11})",
        r"(?:youtube\.com/shorts/)([a-zA-Z0-9_-]{11})",
        r"(?:youtube\.com/embed/)([a-zA-Z0-9_-]{11})",
        r"(?:youtube\.com/v/)([a-zA-Z0-9_-]{11})",
    ]
    if not url:
        return None
    for pattern in patterns:
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return None


def canonical_url(video_id):
    """Return canonical YouTube watch URL."""
    return f"https://www.youtube.com/watch?v={video_id}"


def sanitize_filename(name):
    """Sanitize a filename by removing invalid characters."""
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", name).replace("\n", " ").strip() or "download"


# ─────────────────────────────────────────────────────────────
# yt-dlp Options Builder
# ─────────────────────────────────────────────────────────────

def _build_ydl_opts(with_cookies=False):
    """Build yt-dlp Python API options dict."""
    opts = {
        "quiet": True,
        "no_warnings": True,
        "no_check_certificates": True,
        "skip_download": True,
        "socket_timeout": 15,
        "retries": 2,
        "extractor_retries": 2,
    }
    if with_cookies and _cookies_configured and os.path.isfile(COOKIES_FILE_PATH):
        opts["cookiefile"] = COOKIES_FILE_PATH
    return opts


# ─────────────────────────────────────────────────────────────
# Metadata Extraction (yt-dlp Python API — no subprocess)
# ─────────────────────────────────────────────────────────────

def extract_video_info(url, video_id=None, max_attempts=3):
    """
    Extract YouTube video metadata using yt-dlp Python API.
    Attempts up to `max_attempts` with increasing fallbacks.
    Returns info dict or None.
    """
    try:
        import yt_dlp
    except ImportError:
        logger.error("[YT EXTRACT] yt-dlp is not installed")
        return None

    if not video_id:
        video_id = extract_video_id(url)
    if not url:
        url = canonical_url(video_id) if video_id else None
    if not url:
        return None

    for attempt in range(1, max_attempts + 1):
        use_cookies = attempt >= 2 and _cookies_configured
        opts = _build_ydl_opts(with_cookies=use_cookies)

        t0 = time.time()
        try:
            logger.info("[YT EXTRACT] video_id=%s attempt=%d", video_id, attempt)
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
            elapsed = time.time() - t0
            n_fmt = len(info.get("formats", [])) if info else 0
            logger.info("[YT EXTRACT] video_id=%s elapsed=%.2fs formats=%d", video_id, elapsed, n_fmt)
            if info:
                return info
        except yt_dlp.utils.DownloadError as e:
            err_msg = str(e).lower()
            elapsed = time.time() - t0
            logger.warning(
                "[YT EXTRACT] video_id=%s attempt=%d elapsed=%.2fs error=%s",
                video_id, attempt, elapsed, str(e)[:120],
            )
            # If cookies might help on next attempt, continue; otherwise break
            if _cookies_configured and attempt < max_attempts:
                continue
            return None
        except Exception as e:
            elapsed = time.time() - t0
            logger.warning(
                "[YT EXTRACT] video_id=%s attempt=%d elapsed=%.2fs error=%s",
                video_id, attempt, elapsed, str(e)[:120],
            )
            if attempt < max_attempts:
                continue
            return None

    return None


# ─────────────────────────────────────────────────────────────
# Format Normalization
# ─────────────────────────────────────────────────────────────

def _quality_to_height(quality_label):
    """Convert quality label like 'high' or 'medium' to numeric height."""
    return {"ultralow": 144, "low": 240, "medium": 360, "high": 480,
            "hd720": 720, "hd1080": 1080, "hd1440": 1440,
            "hd2160": 2160, "highres": 4320}.get(str(quality_label).lower(), 0)


def normalize_formats(info):
    """
    Normalize yt-dlp format list into deduplicated video + audio selections.
    Returns (video_formats_list, audio_formats_list).
    Only includes genuinely available formats with valid URLs.
    """
    if not info or not info.get("formats"):
        return [], []

    video_groups = {}   # (height, fps_bucket) -> best format
    audio_groups = {}   # abr_bucket -> best format

    for fmt in info.get("formats", []):
        url = fmt.get("url", "")
        if not url:
            continue

        height = fmt.get("height", 0) or 0
        height_from_quality = _quality_to_height(fmt.get("quality", ""))
        if height == 0 and height_from_quality > 0:
            height = height_from_quality
        ext = fmt.get("ext", "mp4")
        vcodec = fmt.get("vcodec", "none")
        acodec = fmt.get("acodec", "none")
        filesize = fmt.get("filesize") or fmt.get("filesize_approx", 0) or 0
        abr = fmt.get("abr", 0) or 0
        fps = fmt.get("fps", 0) or 0
        protocol = fmt.get("protocol", "")
        format_id = fmt.get("format_id", "")

        # Skip non-DASH/HLS protocols (incomplete or un-downloadable)
        if protocol in ("m3u8_native", "m3u8", "mhtml", "http_dash_segments"):
            continue
        if ext in ("mhtml",):
            continue
        # Skip tiny fragments
        if filesize > 0 and filesize < 10000:
            continue
        if not format_id:
            continue

        # Determine stream category
        has_video = vcodec != "none"
        has_audio = acodec != "none"

        if has_video and has_audio:
            stream_type = "video"  # combined
        elif has_video:
            stream_type = "video_only"
        elif has_audio:
            stream_type = "audio"
        else:
            continue

        # FPS bucketing: group 24-30fps, 50-60fps
        if fps > 0:
            fps_bucket = 60 if fps >= 50 else 30 if fps >= 24 else round(fps)
        else:
            fps_bucket = 0

        # Codec label
        vc = (vcodec or "").lower()
        if "avc" in vc or "h264" in vc:
            codec = "H.264"
        elif "vp9" in vc or "vp09" in vc:
            codec = "VP9"
        elif "av01" in vc or "av1" in vc:
            codec = "AV1"
        elif "hev" in vc or "h265" in vc:
            codec = "H.265"
        else:
            ac = (acodec or "").lower()
            if "mp4a" in ac:
                codec = "AAC"
            elif "opus" in ac:
                codec = "Opus"
            elif "mp3" in ac:
                codec = "MP3"
            else:
                codec = ""

        if stream_type in ("video", "video_only"):
            key = (stream_type, height, fps_bucket)
            existing = video_groups.get(key)
            if existing is None:
                video_groups[key] = {
                    "format_id": format_id,
                    "height": height,
                    "width": fmt.get("width", 0) or 0,
                    "fps": fps,
                    "fps_bucket": fps_bucket,
                    "ext": ext,
                    "vcodec": vcodec,
                    "acodec": acodec,
                    "has_audio": has_audio,
                    "filesize": filesize,
                    "filesize_approx": filesize,
                    "quality_label": f"{height}p",
                    "stream_type": stream_type,
                    "codec": codec,
                }
            else:
                # Prefer mp4 over webm; prefer larger file
                if ext == "mp4" and existing["ext"] != "mp4":
                    video_groups[key] = video_groups[key].copy()
                    video_groups[key].update({
                        "format_id": format_id, "ext": ext,
                        "vcodec": vcodec, "acodec": acodec,
                        "has_audio": has_audio, "filesize": filesize,
                    })
                elif existing["ext"] == ext and filesize > existing["filesize"]:
                    video_groups[key] = video_groups[key].copy()
                    video_groups[key].update({
                        "format_id": format_id, "filesize": filesize,
                        "vcodec": vcodec, "acodec": acodec,
                    })
        else:
            # Audio: group by abr bucket (nearest 10)
            abr_bucket = round(abr, -1) if abr > 0 else 0
            key = ("audio", abr_bucket, ext)
            existing = audio_groups.get(key)
            if existing is None:
                audio_groups[key] = {
                    "format_id": format_id,
                    "ext": ext,
                    "abr": abr,
                    "acodec": acodec,
                    "filesize": filesize,
                    "filesize_approx": filesize,
                    "quality_label": f"Audio {round(abr)}kbps" if abr else f"Audio ({ext})",
                    "stream_type": "audio",
                    "codec": codec or ext.upper(),
                }
            else:
                if filesize > existing["filesize"]:
                    audio_groups[key] = audio_groups[key].copy()
                    audio_groups[key].update({
                        "format_id": format_id, "filesize": filesize,
                        "acodec": acodec,
                    })

    video_list = sorted(
        video_groups.values(),
        key=lambda f: (-f["height"], -f["fps_bucket"], 0 if f["ext"] == "mp4" else 1),
    )
    audio_list = sorted(
        audio_groups.values(),
        key=lambda f: (-f["abr"], 0 if f["ext"] == "m4a" else 1),
    )

    return video_list, audio_list


# ─────────────────────────────────────────────────────────────
# Error Classification
# ─────────────────────────────────────────────────────────────

def classify_ytdlp_error(error_msg):
    """Classify a yt-dlp error into a structured error code."""
    if not error_msg:
        return "EXTRACTION_FAILED"
    msg = str(error_msg).lower()
    if "sign in to confirm" in msg or "bot" in msg or "verification" in msg:
        return "YOUTUBE_VERIFICATION_REQUIRED"
    if "video is private" in msg or "video unavailable" in msg:
        if "private" in msg:
            return "PRIVATE_VIDEO"
        return "VIDEO_UNAVAILABLE"
    if "video unavailable" in msg or "not available" in msg:
        return "VIDEO_UNAVAILABLE"
    if "age" in msg and ("restrict" in msg or "confirm" in msg):
        return "AGE_RESTRICTED"
    if "geo" in msg and "restrict" in msg:
        return "GEO_RESTRICTED"
    if "login" in msg or "sign in" in msg:
        return "LOGIN_REQUIRED"
    if "network" in msg or "connection" in msg or "timed out" in msg or "timeout" in msg:
        return "NETWORK_TIMEOUT"
    if "unsupported" in msg or "no supported" in msg:
        return "UNSUPPORTED_SITE"
    return "EXTRACTION_FAILED"


# ─────────────────────────────────────────────────────────────
# Download Job System
# ─────────────────────────────────────────────────────────────

class DownloadJob:
    """Represents a background download job with status tracking."""

    STATUSES = ("queued", "extracting", "downloading", "processing", "ready", "failed", "expired")

    def __init__(self, url, video_id, format_id, output_type,
                 audio_format=None, audio_bitrate=None, video_title=None):
        self.id = uuid.uuid4().hex[:12]
        self.url = url
        self.video_id = video_id
        self.format_id = format_id
        self.output_type = output_type          # "video" or "audio"
        self.audio_format = audio_format        # "mp3", "m4a", "opus"
        self.audio_bitrate = audio_bitrate      # "320", "192", "128"
        self.video_title = video_title or "youtube_video"
        self.status = "queued"
        self.progress = 0.0
        self.output_path = None
        self.filename = None
        self.error_code = None
        self.error_message = None
        self.created_at = time.time()
        self.completed_at = None

    def update(self, **kwargs):
        for k, v in kwargs.items():
            if hasattr(self, k):
                setattr(self, k, v)
        if self.status in ("ready", "failed", "expired") and not self.completed_at:
            self.completed_at = time.time()

    def to_dict(self):
        return {
            "id": self.id,
            "status": self.status,
            "progress": round(self.progress, 1),
            "filename": self.filename,
            "error_code": self.error_code,
            "error_message": self.error_message,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
        }


def create_job(url, video_id, format_id, output_type,
               audio_format=None, audio_bitrate=None, video_title=None):
    """Create and queue a new download job. Returns the job."""
    job = DownloadJob(
        url=url, video_id=video_id, format_id=format_id,
        output_type=output_type, audio_format=audio_format,
        audio_bitrate=audio_bitrate, video_title=video_title,
    )
    with _lock:
        _job_store[job.id] = job
    _executor.submit(_execute_job, job)
    return job


def get_job(job_id):
    """Get a job by ID, or None."""
    with _lock:
        return _job_store.get(job_id)


def _execute_job(job):
    """Run the actual download in the background executor."""
    try:
        _do_download(job)
    except Exception as e:
        logger.error("[YT DOWNLOAD] job=%s fatal: %s", job.id, str(e)[:120])
        job.update(
            status="failed",
            error_code="EXTRACTION_FAILED",
            error_message="An unexpected error occurred during download.",
        )


def _do_download(job):
    """Download media using yt-dlp Python API + ffmpeg merge if needed."""
    try:
        import yt_dlp
    except ImportError:
        job.update(status="failed", error_code="EXTRACTION_FAILED",
                   error_message="yt-dlp is not installed.")
        return

    try:
        import shutil
        ffmpeg_path = shutil.which("ffmpeg")
    except Exception:
        ffmpeg_path = None

    video_id = job.video_id or extract_video_id(job.url)
    job.update(status="extracting")

    # Create working directory
    work_dir = os.path.join(DOWNLOADS_DIR, job.id)
    os.makedirs(work_dir, exist_ok=True)

    title_safe = sanitize_filename(job.video_title)[:60]
    ext = "mp4" if job.output_type == "video" else (job.audio_format or "m4a")

    output_template = os.path.join(work_dir, "%(id)s.%(ext)s")

    # Build format selector
    if job.output_type == "audio":
        if job.audio_format == "mp3":
            # yt-dlp will extract best audio, then postprocessor converts to mp3
            fmt_selector = "bestaudio/best"
        else:
            fmt_selector = "bestaudio/best"
    elif job.format_id:
        # Specific format requested — merge with best audio if needed
        fmt_selector = f"{job.format_id}+bestaudio/best"
    else:
        fmt_selector = "bestaudio/best/bestvideo+bestaudio"

    # Build yt-dlp options
    opts = {
        "quiet": True,
        "no_warnings": True,
        "no_check_certificates": True,
        "format": fmt_selector,
        "outtmpl": output_template,
        "noplaylist": True,
        "socket_timeout": 30,
        "retries": 3,
        "extractor_retries": 3,
        "merge_output_format": "mp4" if job.output_type == "video" else None,
        "progress_hooks": [_make_progress_hook(job)],
    }

    # Audio conversion postprocessors
    if job.output_type == "audio" and job.audio_format == "mp3":
        bitrate = job.audio_bitrate or "192"
        opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": str(bitrate),
        }]
        ext = "mp3"
    elif job.output_type == "audio":
        opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": job.audio_format or "m4a",
            "preferredquality": "0",
        }]
        ext = job.audio_format or "m4a"

    # Remove None values
    opts = {k: v for k, v in opts.items() if v is not None}

    # Cookie support
    if _cookies_configured and os.path.isfile(COOKIES_FILE_PATH):
        opts["cookiefile"] = COOKIES_FILE_PATH

    # ffmpeg location
    if ffmpeg_path:
        opts["ffmpeg_location"] = os.path.dirname(ffmpeg_path)

    # Temp directory for intermediate files
    opts["tempfiledirectory"] = os.path.join(work_dir, "_tmp")

    job.update(status="downloading")

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([job.url])
    except Exception as e:
        logger.warning("[YT DOWNLOAD] job=%s ytdlp error: %s", job.id, str(e)[:120])
        job.update(status="failed",
                   error_code=classify_ytdlp_error(str(e)),
                   error_message=_friendly_error(str(e)))
        shutil.rmtree(work_dir, ignore_errors=True)
        return

    # Find the output file
    output_file = _find_output_file(work_dir, ext)
    if not output_file:
        # Try to find any file in the working directory
        output_file = _find_any_file(work_dir)
    if not output_file:
        job.update(status="failed", error_code="DOWNLOAD_FAILED",
                   error_message="Downloaded file not found.")
        shutil.rmtree(work_dir, ignore_errors=True)
        return

    # Determine final filename
    final_ext = os.path.splitext(output_file)[1] or f".{ext}"
    job.filename = f"{title_safe}{final_ext}"
    job.output_path = output_file
    job.update(status="ready", progress=100.0)

    logger.info("[YT DOWNLOAD] job=%s ready file=%s", job.id, job.filename)


def _make_progress_hook(job):
    """Create a yt-dlp progress hook that updates job progress."""
    def hook(d):
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate", 0)
            downloaded = d.get("downloaded_bytes", 0)
            if total and total > 0:
                job.progress = min(99.0, (downloaded / total) * 100)
                job.update(status="downloading")
        elif d.get("status") == "finished":
            job.update(status="processing", progress=99.0)
    return hook


def _find_output_file(work_dir, ext):
    """Find the downloaded file with the expected extension."""
    for root, dirs, files in os.walk(work_dir):
        # Skip temp directories
        dirs[:] = [d for d in dirs if not d.startswith("_tmp")]
        for name in files:
            if name.startswith("."):
                continue
            path = os.path.join(root, name)
            file_ext = os.path.splitext(name)[1].lower().lstrip(".")
            if file_ext == ext.lower().lstrip(".") or file_ext in ("mp4", "m4a", "webm", "opus", "mp3", "mkv"):
                return path
    return None


def _find_any_file(work_dir):
    """Find any non-temp file in the working directory."""
    for root, dirs, files in os.walk(work_dir):
        dirs[:] = [d for d in dirs if not d.startswith("_tmp")]
        for name in files:
            if name.startswith(".") or name.endswith((".part", ".ytdl")):
                continue
            path = os.path.join(root, name)
            if os.path.isfile(path) and os.path.getsize(path) > 0:
                return path
    return None


def _friendly_error(error_msg):
    """Return a user-friendly error message for known error types."""
    code = classify_ytdlp_error(error_msg)
    messages = {
        "YOUTUBE_VERIFICATION_REQUIRED": "YouTube temporarily refused this server request. Please try again later.",
        "PRIVATE_VIDEO": "This video is private.",
        "VIDEO_UNAVAILABLE": "This video is unavailable.",
        "AGE_RESTRICTED": "This video requires authentication.",
        "GEO_RESTRICTED": "This video is not available in your region.",
        "LOGIN_REQUIRED": "This video requires you to be signed in.",
        "NETWORK_TIMEOUT": "YouTube took too long to respond. Please try again.",
        "UNSUPPORTED_SITE": "This URL is not supported.",
        "EXTRACTION_FAILED": "Could not process this video. Please try another.",
    }
    return messages.get(code, "An error occurred. Please try again.")


# ─────────────────────────────────────────────────────────────
# Response Builders
# ─────────────────────────────────────────────────────────────

def build_analyze_response(info, video_id):
    """Build the /api/youtube/analyze response from yt-dlp info dict."""
    if not info:
        return {
            "success": False,
            "error": {
                "code": "EXTRACTION_FAILED",
                "message": "Could not retrieve video information.",
                "retryable": True,
            },
        }

    video_formats, audio_formats = normalize_formats(info)

    return {
        "success": True,
        "video": {
            "id": video_id,
            "title": info.get("title", info.get("fulltitle", "YouTube Video")),
            "thumbnail": info.get("thumbnail", f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"),
            "duration": info.get("duration", 0),
            "duration_string": info.get("duration_string", ""),
            "uploader": info.get("channel", info.get("uploader", "")),
            "description": (info.get("description", "") or "")[:300],
            "view_count": info.get("view_count"),
        },
        "video_formats": video_formats,
        "audio_formats": audio_formats,
    }


def build_error_response(code, message=None, retryable=True):
    """Build a structured JSON error response."""
    default_messages = {
        "INVALID_URL": "Invalid YouTube URL.",
        "UNSUPPORTED_SITE": "This URL is not supported.",
        "VIDEO_UNAVAILABLE": "This video is unavailable.",
        "PRIVATE_VIDEO": "This video is private.",
        "LOGIN_REQUIRED": "This video requires authentication.",
        "AGE_RESTRICTED": "This video requires authentication.",
        "GEO_RESTRICTED": "This video is not available in your region.",
        "YOUTUBE_VERIFICATION_REQUIRED": "YouTube temporarily refused this server request. Please try again later.",
        "EXTRACTION_FAILED": "Could not process this video. Please try another.",
        "DOWNLOAD_FAILED": "Download failed. Please try again.",
        "NETWORK_TIMEOUT": "YouTube took too long to respond. Please try again.",
        "SERVER_BUSY": "Server is busy. Please try again in a moment.",
    }
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message or default_messages.get(code, "An error occurred."),
            "retryable": retryable,
        },
    }


# ─────────────────────────────────────────────────────────────
# Rate Limiting (in-memory per-IP sliding window)
# ─────────────────────────────────────────────────────────────

_rate_limits = {}  # ip -> [(timestamp, ...)]
_rate_lock = threading.Lock()


def check_rate_limit(ip, limit=5, window=60):
    """
    Check if an IP has exceeded the rate limit.
    Returns (allowed: bool, retry_after: int or None).
    """
    now = time.time()
    with _rate_lock:
        timestamps = _rate_limits.get(ip, [])
        # Remove expired entries
        timestamps = [t for t in timestamps if now - t < window]
        _rate_limits[ip] = timestamps
        if len(timestamps) >= limit:
            retry_after = int(window - (now - timestamps[0]))
            return False, max(retry_after, 1)
        timestamps.append(now)
        return True, None


# ─────────────────────────────────────────────────────────────
# Cleanup Scheduler
# ─────────────────────────────────────────────────────────────

def _cleanup_temp_files(max_age_seconds=3600):
    """Remove files older than max_age_seconds from the downloads directory."""
    try:
        now = time.time()
        if not os.path.isdir(DOWNLOADS_DIR):
            return
        for name in os.listdir(DOWNLOADS_DIR):
            path = os.path.join(DOWNLOADS_DIR, name)
            if not os.path.isdir(path):
                continue
            try:
                dir_age = now - os.path.getmtime(path)
                if dir_age > max_age_seconds:
                    shutil.rmtree(path, ignore_errors=True)
                    logger.info("[YT CLEANUP] removed stale job dir: %s", name)
            except OSError:
                continue
    except Exception as e:
        logger.warning("[YT CLEANUP] error: %s", str(e)[:80])


def _provider_health_check():
    """Check if bgutil server is alive; restart if not."""
    if not BGUTIL_ENABLED:
        return
    proc = _provider.get("process")
    if proc and proc.poll() is not None:
        logger.warning("[YT INIT] bgutil server died (exit=%s), restarting", proc.returncode)
        _restart_pot_provider()


def _cleanup_scheduler():
    """Background daemon thread that runs periodic cleanup."""
    while True:
        time.sleep(600)  # Every 10 minutes
        try:
            _cleanup_temp_files(max_age_seconds=3600)
            _provider_health_check()
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────
# Initialization (called once at app startup)
# ─────────────────────────────────────────────────────────────

def init_youtube_service():
    """
    Initialize the YouTube service at application startup.
    Prints capability banner to stdout for Render logs.
    """
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)

    # Cookie configuration
    load_cookie_configuration()

    # Start bgutil PO token provider
    if BGUTIL_ENABLED:
        start_pot_provider()

    # Gather capability info
    yt_dlp_version = "NOT INSTALLED"
    try:
        import yt_dlp
        yt_dlp_version = yt_dlp.version.__version__
    except Exception:
        pass

    ffmpeg_available = False
    try:
        ffmpeg_available = shutil.which("ffmpeg") is not None
    except Exception:
        pass

    js_available = False
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=5)
        js_available = result.returncode == 0
    except Exception:
        pass

    provider_available = _provider.get("ready", False)

    print("=" * 48)
    print("ToolsAllInOnePro Media Backend")
    print(f"yt-dlp: {yt_dlp_version}")
    print(f"FFmpeg: {'available' if ffmpeg_available else 'NOT AVAILABLE'}")
    print(f"JS runtime: {'available' if js_available else 'NOT AVAILABLE'}")
    print(f"PO provider: {'available' if provider_available else 'not available'}")
    print(f"Cookies: {'configured' if _cookies_configured else 'not configured'}")
    print("=" * 48)

    # Start background cleanup scheduler
    t = threading.Thread(target=_cleanup_scheduler, daemon=True)
    t.start()
