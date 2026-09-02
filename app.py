import os
import json
import glob
import re
import subprocess
import sys
import shutil

from flask import Flask, render_template, request, jsonify, send_from_directory, Response, redirect, url_for, send_file

# Use the `assets` folder for static files (css/js/favicon), `templates` for Jinja2
app = Flask(__name__, static_folder='assets', template_folder='templates')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.join(BASE_DIR, 'tools')


def get_current_year():
    from datetime import datetime
    return datetime.now().year


app.jinja_env.globals['current_year'] = get_current_year


def load_tools():
    """Scan tool directories (inside tools/) for tool.json files."""
    tools = []
    for tool_dir in glob.glob(os.path.join(TOOLS_DIR, '*')):
        if not os.path.isdir(tool_dir):
            continue
        tool_json = os.path.join(tool_dir, 'tool.json')
        if os.path.isfile(tool_json):
            with open(tool_json, 'r', encoding='utf-8') as f:
                try:
                    tool = json.load(f)
                except Exception:
                    continue
            if tool and 'slug' in tool:
                tools.append(tool)
    tools.sort(key=lambda t: (t.get('name', '') or '').lower())
    return tools


def load_tool(slug):
    """Load a single tool's tool.json by slug (validated against directory name)."""
    tool_json = os.path.join(TOOLS_DIR, slug, 'tool.json')
    if not os.path.isfile(tool_json):
        return None
    with open(tool_json, 'r', encoding='utf-8') as f:
        tool = json.load(f)
    if tool:
        tool['slug'] = slug
    return tool


# ═══════════════════════════════════════════════════════════
# Page Routes
# ═══════════════════════════════════════════════════════════

@app.route('/')
def index():
    tools = load_tools()
    return render_template(
        'index.html',
        tools=tools,
        total_tools=len(tools),
        all_tools=tools,
    )


@app.route('/tool/<slug>')
def tool_page(slug):
    tool = load_tool(slug)
    if not tool:
        return redirect(url_for('index'))

    all_tools = load_tools()
    return render_template('tool.html', tool=tool, slug=slug, all_tools=all_tools)


@app.route('/tool/<slug>/handler.js')
def tool_handler_js(slug):
    tool_dir = os.path.join(TOOLS_DIR, slug)
    handler_path = os.path.join(tool_dir, 'handler.js')
    if os.path.isfile(handler_path):
        return send_from_directory(tool_dir, 'handler.js',
                                   mimetype='application/javascript')
    return '', 404


@app.route('/sitemap.xml')
def sitemap():
    tools = load_tools()
    site_url = request.host_url.rstrip('/')
    xml = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    xml.append(f'  <url><loc>{site_url}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>')
    for t in tools:
        xml.append(f'  <url><loc>{site_url}/tool/{t["slug"]}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>')
    xml.append('</urlset>')
    return Response('\n'.join(xml), mimetype='application/xml')


@app.route('/robots.txt')
def robots():
    site_url = request.host_url.rstrip('/')
    txt = f"User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: {site_url}/sitemap.xml\n"
    return Response(txt, mimetype='text/plain')


# ═══════════════════════════════════════════════════════════
# Health & Diagnostics
# ═══════════════════════════════════════════════════════════

@app.route('/health')
def health():
    return jsonify({"status": "ok"})


@app.route('/api/diagnostic')
def api_diagnostic():
    """Development diagnostic endpoint. Disable in production."""
    from services.youtube_service import _provider, _cookies_configured
    diag = {"yt_dlp": "unknown", "ffmpeg": False, "javascript_runtime": False,
            "po_token_provider": False, "cookies_configured": _cookies_configured}
    try:
        import yt_dlp
        diag["yt_dlp"] = yt_dlp.version.__version__
    except Exception:
        pass
    try:
        diag["ffmpeg"] = shutil.which("ffmpeg") is not None
    except Exception:
        pass
    try:
        r = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=5)
        diag["javascript_runtime"] = r.returncode == 0
    except Exception:
        pass
    diag["po_token_provider"] = _provider.get("ready", False)
    return jsonify(diag)


# ═══════════════════════════════════════════════════════════
# YouTube API — New Architecture
# ═══════════════════════════════════════════════════════════

def _get_client_ip():
    """Get client IP for rate limiting."""
    if request.headers.get("X-Forwarded-For"):
        return request.headers["X-Forwarded-For"].split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"


@app.route('/api/youtube/analyze', methods=['POST', 'OPTIONS'])
def api_youtube_analyze():
    """Analyze a YouTube video and return metadata + available formats."""
    if request.method == 'OPTIONS':
        return '', 200

    from services.youtube_service import (
        validate_youtube_url, extract_video_id, canonical_url,
        extract_video_info, build_analyze_response, build_error_response,
        check_rate_limit,
    )

    # Rate limiting
    ip = _get_client_ip()
    allowed, retry_after = check_rate_limit(ip, limit=10, window=60)
    if not allowed:
        return jsonify(build_error_response("SERVER_BUSY",
            "Too many requests. Please wait a moment and try again.")), 429

    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()

    if not url:
        return jsonify(build_error_response("INVALID_URL")), 400

    # Validate URL
    is_valid, video_id, err_msg = validate_youtube_url(url)
    if not is_valid:
        return jsonify(build_error_response("INVALID_URL", err_msg)), 400

    # Build canonical URL
    url = canonical_url(video_id)

    # Extract video info (bounded by yt-dlp timeout + retry logic)
    info = extract_video_info(url, video_id, max_attempts=3)
    if not info:
        return jsonify(build_error_response(
            "YOUTUBE_VERIFICATION_REQUIRED",
            "YouTube temporarily refused this server request. Please try again later.",
            retryable=True,
        )), 502

    return jsonify(build_analyze_response(info, video_id))


@app.route('/api/youtube/download', methods=['POST', 'OPTIONS'])
def api_youtube_download():
    """Create a download job for a YouTube video format."""
    if request.method == 'OPTIONS':
        return '', 200

    from services.youtube_service import (
        validate_youtube_url, extract_video_id, canonical_url,
        create_job, build_error_response, check_rate_limit,
    )

    # Rate limiting
    ip = _get_client_ip()
    allowed, retry_after = check_rate_limit(ip, limit=5, window=60)
    if not allowed:
        return jsonify(build_error_response("SERVER_BUSY",
            "Too many download requests. Please wait.")), 429

    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    format_id = (data.get("format_id") or "").strip()
    output_type = (data.get("output_type") or "video").strip()
    audio_format = (data.get("audio_format") or "").strip() or None
    audio_bitrate = (data.get("audio_bitrate") or "").strip() or None
    video_title = (data.get("video_title") or "").strip()

    if not url:
        return jsonify(build_error_response("INVALID_URL")), 400

    # Validate URL
    is_valid, video_id, err_msg = validate_youtube_url(url)
    if not is_valid:
        return jsonify(build_error_response("INVALID_URL", err_msg)), 400

    # Validate output_type
    if output_type not in ("video", "audio"):
        output_type = "video"

    # Validate format_id (alphanumeric, hyphens, underscores, plus signs only)
    if format_id and not re.match(r'^[a-zA-Z0-9_\-+]+$', format_id):
        return jsonify(build_error_response("INVALID_URL", "Invalid format selection.")), 400

    # Validate audio format
    if output_type == "audio" and audio_format:
        if audio_format not in ("mp3", "m4a", "opus", "webm"):
            return jsonify(build_error_response("INVALID_URL", "Invalid audio format.")), 400

    # Validate audio bitrate
    if audio_bitrate and audio_bitrate not in ("128", "192", "256", "320"):
        audio_bitrate = "192"

    url = canonical_url(video_id)

    # Create job
    job = create_job(
        url=url, video_id=video_id, format_id=format_id,
        output_type=output_type, audio_format=audio_format,
        audio_bitrate=audio_bitrate, video_title=video_title,
    )

    return jsonify({
        "success": True,
        "job_id": job.id,
        "status": job.status,
    })


@app.route('/api/youtube/jobs/<job_id>', methods=['GET'])
def api_youtube_job_status(job_id):
    """Get download job status."""
    from services.youtube_service import get_job, build_error_response
    import re as _re

    # Validate job_id format (hex only)
    if not _re.match(r'^[a-f0-9]{12}$', job_id):
        return jsonify(build_error_response("INVALID_URL", "Invalid job ID.")), 400

    job = get_job(job_id)
    if not job:
        return jsonify(build_error_response("VIDEO_UNAVAILABLE", "Job not found.")), 404

    return jsonify({
        "success": True,
        "job": job.to_dict(),
    })


@app.route('/api/youtube/jobs/<job_id>/file', methods=['GET'])
def api_youtube_job_file(job_id):
    """Serve the downloaded file for a completed job."""
    from services.youtube_service import get_job, build_error_response
    import re as _re

    if not _re.match(r'^[a-f0-9]{12}$', job_id):
        return jsonify(build_error_response("INVALID_URL", "Invalid job ID.")), 400

    job = get_job(job_id)
    if not job:
        return jsonify(build_error_response("VIDEO_UNAVAILABLE", "Job not found.")), 404

    if job.status != "ready":
        return jsonify(build_error_response("DOWNLOAD_FAILED",
            "File is not ready yet.")), 409

    if not job.output_path or not os.path.isfile(job.output_path):
        return jsonify(build_error_response("DOWNLOAD_FAILED",
            "File not found or has expired.")), 404

    # Determine MIME type
    ext = os.path.splitext(job.filename or "")[1].lower()
    mime_map = {
        ".mp4": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska",
        ".m4a": "audio/mp4", ".opus": "audio/opus", ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
    }
    mime_type = mime_map.get(ext, "application/octet-stream")

    return send_file(
        job.output_path,
        mimetype=mime_type,
        as_attachment=True,
        download_name=job.filename or f"download{ext}",
    )


# ═══════════════════════════════════════════════════════════
# Legacy YouTube API (backward compatible with old frontend)
# ═══════════════════════════════════════════════════════════

@app.route('/api/debug-extract', methods=['POST'])
def api_debug_extract():
    """Debug endpoint: shows what yt-dlp reports for a video on this server."""
    data = request.get_json(silent=True) or {}
    url = data.get('url', '')
    video_id = _extract_video_id_legacy(url)
    if not video_id:
        return jsonify({'error': 'invalid url'})

    output = []

    try:
        from curl_cffi import requests as cffi_requests
        output.append('curl_cffi: INSTALLED')
    except ImportError:
        output.append('curl_cffi: NOT INSTALLED')

    try:
        import yt_dlp
        output.append(f'yt_dlp: {yt_dlp.version.__version__}')
    except ImportError:
        output.append('yt_dlp: NOT INSTALLED')
        return jsonify({'output': output})

    # Use the new service for extraction
    from services.youtube_service import extract_video_info, canonical_url
    url = canonical_url(video_id)
    info = extract_video_info(url, video_id, max_attempts=2)
    if info:
        n = len(info.get('formats', [])) if info else 0
        output.append(f'yt-dlp: {n} formats')
    else:
        output.append('yt-dlp: extraction failed')

    return jsonify({'output': output, 'video_id': video_id})


@app.route('/api/download', methods=['GET'])
def api_download():
    """Legacy direct download endpoint — kept for backward compatibility.
    Redirects to the new job-based system."""
    video_id = (request.args.get('video_id') or '').strip()
    itag = (request.args.get('itag') or '').strip()
    merge = request.args.get('merge') == '1'
    height = (request.args.get('height') or '').strip()
    title = _sanitize_filename_legacy(request.args.get('title') or 'youtube_video')[:60]

    if not re.match(r'^[A-Za-z0-9_-]{11}$', video_id):
        return jsonify({'success': False, 'error': 'Invalid video ID'}), 400

    from services.youtube_service import create_job, canonical_url

    url = canonical_url(video_id)

    if merge and re.match(r'^\\d{3,4}$', height):
        job = create_job(
            url=url, video_id=video_id,
            format_id=f"bv*[height<={height}][ext=mp4]+ba[ext=m4a]/b[height<={height}][ext=mp4]",
            output_type="video", video_title=title,
        )
    elif itag and re.match(r'^[a-zA-Z0-9_\\-+]+$', itag):
        job = create_job(
            url=url, video_id=video_id,
            format_id=itag, output_type="video", video_title=title,
        )
    else:
        return jsonify({'success': False, 'error': 'Invalid parameters'}), 400

    # Return job info so frontend can poll
    return jsonify({
        'success': True,
        'job_id': job.id,
        'status': job.status,
        'message': 'Download started. Poll /api/youtube/jobs/<job_id> for status.',
    })


@app.route('/api/run-tool', methods=['POST', 'OPTIONS'])
def api_run_tool():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.get_json(silent=True) or {}
        url = data.get('url', '')
        tool = request.args.get('tool', data.get('tool', ''))

        if not url and tool != 'translate-transcript':
            return jsonify({'success': False, 'error': 'No URL provided'})

        video_id = _extract_video_id_legacy(url) if url else data.get('video_id', '')

        if tool == 'youtube-downloader':
            # Route to the new analyze endpoint
            from services.youtube_service import (
                validate_youtube_url, extract_video_id, canonical_url,
                extract_video_info, build_analyze_response, build_error_response,
            )

            is_valid, vid, err_msg = validate_youtube_url(url)
            if not is_valid:
                return jsonify(build_error_response("INVALID_URL", err_msg))

            url = canonical_url(vid)
            info = extract_video_info(url, vid, max_attempts=2)
            if not info:
                return jsonify(build_error_response(
                    "YOUTUBE_VERIFICATION_REQUIRED",
                    "YouTube temporarily refused this server request. Please try again later.",
                ))
            return jsonify(build_analyze_response(info, vid))

        elif tool == 'youtube-transcript':
            lang = data.get('lang', 'en')
            return jsonify(run_youtube_transcript(url, video_id, lang))

        elif tool == 'translate-transcript':
            target_lang = data.get('target_lang', 'es')
            return jsonify(run_translate_transcript(video_id, target_lang))

        return jsonify({'success': False, 'error': f'Unknown tool: {tool}'})
    except (SystemExit, Exception) as e:
        return jsonify({'success': False, 'error': 'Server error: ' + str(e)})


@app.route('/api/translate-text', methods=['POST', 'OPTIONS'])
def api_translate_text():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json(silent=True) or {}
        texts = data.get('texts') or []
        target_lang = (data.get('target_lang') or data.get('lang') or 'es').strip()
        source_lang = (data.get('source_lang') or 'auto').strip()

        if not isinstance(texts, list) or not texts:
            return jsonify({'success': False, 'error': 'No text to translate'})
        if not re.match(r'^[a-zA-Z-]{2,10}$', target_lang):
            return jsonify({'success': False, 'error': 'Invalid target language'})

        texts = [str(t)[:2000] for t in texts]
        translated, used_fallback = translate_texts(texts, target_lang, source_lang)
        return jsonify({'success': True,
                        'data': {'translated': translated, 'language': target_lang,
                                 'used_fallback': used_fallback}})
    except Exception as e:
        return jsonify({'success': False, 'error': 'Translation failed: ' + str(e)})


def translate_texts(texts, target_lang, source_lang='auto'):
    """Translate using deep_translator with MyMemory/gtx fallbacks."""
    import time
    if not texts:
        return [], False
    if source_lang == target_lang:
        return list(texts), False

    lang_map = {
        'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', 'zh': 'zh-CN',
        'he': 'iw', 'jv': 'jv', 'hmn': 'hmn',
        'ceb': 'ceb', 'haw': 'haw', 'fy': 'fy',
    }
    tl_lang = lang_map.get(target_lang, target_lang)
    tl_src = lang_map.get(source_lang, source_lang)

    result = [None] * len(texts)

    try:
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source=tl_src, target=tl_lang)
        batch, batch_idxs, total = [], [], 0
        for idx in range(len(texts)):
            add = len(texts[idx]) + 2
            if batch and total + add > 4500:
                try:
                    parts = translator.translate_batch(batch)
                    if isinstance(parts, str):
                        parts = [parts]
                    for bi, orig, part in zip(batch_idxs, batch, parts):
                        if _is_translation(part, orig):
                            result[bi] = part
                except Exception:
                    pass
                batch, batch_idxs, total = [], [], 0
                time.sleep(0.15)
            batch.append(texts[idx])
            batch_idxs.append(idx)
            total += add
        if batch:
            try:
                parts = translator.translate_batch(batch)
                if isinstance(parts, str):
                    parts = [parts]
                for bi, orig, part in zip(batch_idxs, batch, parts):
                    if _is_translation(part, orig):
                        result[bi] = part
            except Exception:
                pass
    except ImportError:
        pass
    except Exception:
        pass

    pending = [i for i in range(len(texts)) if result[i] is None]
    if pending and source_lang != 'auto':
        batch, batch_idxs, total = [], [], 0
        def flush_mymemory():
            nonlocal batch, batch_idxs, total
            if not batch:
                return
            try:
                parts = _mymemory_translate(batch, source_lang, target_lang)
            except Exception:
                parts = batch
            for bi, orig, part in zip(batch_idxs, batch, parts):
                if _is_translation(part, orig):
                    result[bi] = part
            batch, batch_idxs, total = [], [], 0

        for idx in pending:
            add = len(texts[idx])
            if batch and total + add > 450:
                flush_mymemory()
            batch.append(texts[idx])
            batch_idxs.append(idx)
            total += add
        flush_mymemory()

    pending = [i for i in range(len(texts)) if result[i] is None]
    if pending:
        batch, batch_idxs, total = [], [], 0
        def flush_gtx():
            nonlocal batch, batch_idxs, total
            if not batch:
                return
            try:
                parts = _gtx_translate(batch, source_lang, target_lang)
            except Exception:
                parts = None
            if parts:
                for bi, orig, part in zip(batch_idxs, batch, parts):
                    if _is_translation(part, orig):
                        result[bi] = part
            batch, batch_idxs, total = [], [], 0

        for idx in pending:
            add = len(texts[idx])
            if batch and total + add > 3800:
                flush_gtx()
                time.sleep(0.3)
            batch.append(texts[idx])
            batch_idxs.append(idx)
            total += add
        flush_gtx()

    used_fallback = False
    for idx in range(len(texts)):
        if result[idx] is None:
            result[idx] = texts[idx]
            used_fallback = True
    return result, used_fallback


def _is_translation(part, orig):
    s = (part or '').strip()
    o = (orig or '').strip()
    if not s:
        return False
    if len(o) < 2:
        return True
    if s.lower() == o.lower():
        return False
    return True


def _mymemory_translate(batch, source_lang, target_lang):
    import urllib.request
    import urllib.parse
    SEP = '<br>'
    joined = SEP.join(batch)
    url = ('https://api.mymemory.translated.net/get?q={}&langpair={}|{}'
           '&de=pdfdown.translator@gmail.com'
           .format(urllib.parse.quote(joined),
                   urllib.parse.quote(source_lang), urllib.parse.quote(target_lang)))
    req = urllib.request.Request(url, headers={
        'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                       '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
    })
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode('utf-8', errors='ignore'))
    if str(data.get('responseStatus')) not in ('200', '0'):
        raise RuntimeError('MyMemory status ' + str(data.get('responseStatus')))
    translated = ((data.get('responseData') or {}).get('translatedText', '') or '').strip()
    parts = [p.strip() for p in translated.split(SEP)]
    if len(parts) < len(batch):
        parts = parts + batch[len(parts):]
    return parts[:len(batch)]


def _gtx_translate(batch, source_lang, target_lang):
    import urllib.request
    import urllib.parse
    SEP = ' ||| '
    joined = SEP.join(batch)
    url = ('https://translate.googleapis.com/translate_a/single?client=gtx&sl={}&tl={}&dt=t&q={}'
           .format(urllib.parse.quote(source_lang), urllib.parse.quote(target_lang),
                   urllib.parse.quote(joined)))
    req = urllib.request.Request(url, headers={
        'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                       '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
    })
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode('utf-8', errors='ignore'))
    translated = ''.join(seg[0] for seg in (data or [[None]])[0] if seg and seg[0]).split(SEP)
    if len(translated) < len(batch):
        translated = translated + batch[len(translated):]
    return translated[:len(batch)]


# ═══════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════

def _extract_video_id_legacy(url):
    """Extract video ID from URL (legacy helper for backward compat)."""
    patterns = [
        r'(?:youtube\.com/watch\?v=)([a-zA-Z0-9_-]{11})',
        r'(?:youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com/shorts/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
    ]
    if not url:
        return None
    for pattern in patterns:
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return None


def _sanitize_filename_legacy(name):
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', name).replace('\n', ' ').strip() or 'youtube_video'


def run_youtube_transcript(url, video_id, lang='en'):
    script = os.path.join(TOOLS_DIR, 'youtube-transcript', 'extract.py')
    if not os.path.isfile(script):
        return _php_transcript_fallback(url, video_id)
    try:
        result = subprocess.run(
            [sys.executable, script, url, lang],
            capture_output=True, text=True, timeout=20,
        )
        if result.returncode == 0 and result.stdout.strip():
            data = json.loads(result.stdout.strip())
            if isinstance(data, dict) and 'success' in data:
                return data
    except subprocess.TimeoutExpired:
        print(f'[TIMEOUT] Script {script} timed out', file=sys.stderr)
    except Exception:
        pass
    return _php_transcript_fallback(url, video_id)


def run_translate_transcript(video_id, target_lang):
    video_id = re.sub(r'[^a-zA-Z0-9_-]', '', video_id)
    target_lang = re.sub(r'[^a-zA-Z-]', '', target_lang)
    script = (
        "import sys, json\n"
        "from youtube_transcript_api import YouTubeTranscriptApi\n"
        "try:\n"
        f"    ytt = YouTubeTranscriptApi()\n"
        f"    tl = ytt.list('{video_id}')\n"
        "    candidates = sorted(tl, key=lambda t: (0 if t.language_code.startswith('en') else 1, 0 if not t.is_generated else 1))\n"
        "    if not candidates:\n"
        "        candidates = list(tl)\n"
        "    last_err = None\n"
        "    segments = None\n"
        "    language = None\n"
        "    for t in candidates:\n"
        "        try:\n"
        f"            translated = t.translate('{target_lang}')\n"
        "            result = translated.fetch()\n"
        "            segments = [{'start': s.start, 'text': s.text.strip()} for s in result.snippets if s.text.strip() and len(s.text.strip()) > 1]\n"
        "            if segments:\n"
        "                language = result.language_code\n"
        "                break\n"
        "        except Exception as e:\n"
        "            last_err = e\n"
        "    if segments:\n"
        f"        print(json.dumps({{'success': True, 'data': {{'transcript': segments, 'language': language}}}}))\n"
        "    else:\n"
        "        print(json.dumps({'success': False, 'error': str(last_err)}))\n"
        "except Exception as e:\n"
        "    print(json.dumps({'success': False, 'error': str(e)}))\n"
    )
    try:
        result = subprocess.run(
            [sys.executable, '-c', script],
            capture_output=True, text=True, timeout=20,
        )
        if result.returncode == 0 and result.stdout.strip():
            data = json.loads(result.stdout.strip())
            return data
        return {'success': False, 'error': 'Translation failed.'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


# ═══════════════════════════════════════════════════════════
# Fallbacks (no external shell deps)
# ═══════════════════════════════════════════════════════════

def fetch_url(url, timeout=15):
    """Fetch a URL with browser impersonation when curl-cffi is available."""
    try:
        from curl_cffi import requests as cffi_requests
        resp = cffi_requests.get(url, impersonate='chrome', timeout=timeout)
        if resp.status_code == 200:
            return resp.text
    except ImportError:
        pass
    except Exception:
        pass
    import urllib.request
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode('utf-8', errors='ignore')
    except Exception:
        return ''


def get_oembed_info(url):
    import urllib.parse
    data = fetch_url(
        f'https://www.youtube.com/oembed?url={urllib.parse.quote(url)}&format=json', 5)
    if data:
        try:
            j = json.loads(data)
            return {'title': j.get('title', ''), 'channel': j.get('author_name', '')}
        except Exception:
            pass
    return {'title': '', 'channel': ''}


def _php_transcript_fallback(url, video_id):
    oe = get_oembed_info(url)
    transcript = _php_extract_transcript(video_id)
    return {
        'success': True,
        'data': {
            'title': oe['title'] or 'YouTube Video',
            'channel': oe['channel'],
            'video_id': video_id,
            'thumbnail': f'https://img.youtube.com/vi/{video_id}/hqdefault.jpg',
            'transcript': transcript,
            'url': url,
            'source_lang': '',
            'available_langs': [],
            'translation_langs': [],
            'note': 'No transcript available. Install youtube-transcript-api for full support.' if not transcript else None,
        }
    }


def _php_extract_transcript(video_id):
    page_html = fetch_url(f'https://www.youtube.com/watch?v={video_id}')
    if not page_html:
        return []
    m = re.search(r'var ytInitialPlayerResponse\s*=\s*(\{.*?\});\s*(?:var|<)', page_html, re.DOTALL)
    if not m:
        return []
    try:
        pr = json.loads(m.group(1))
        tracks = pr.get('captions', {}).get(
            'playerCaptionsTracklistRenderer', {}).get('captionTracks', [])
        if not tracks:
            return []
        best = None
        for t in tracks:
            lang = t.get('languageCode', '')
            if lang.startswith('en') and t.get('baseUrl'):
                best = t
                break
            if not best and t.get('baseUrl'):
                best = t
        if not best:
            return []
        cap_data = fetch_url(best['baseUrl'] + '&fmt=json3', 10)
        if not cap_data:
            return []
        jd = json.loads(cap_data)
        if jd and 'events' in jd:
            transcript = []
            for ev in jd['events']:
                segs = ev.get('segs', [])
                text = ''.join(s.get('utf8', '') for s in segs).strip()
                if text and text != '\n':
                    transcript.append({'start': ev.get('tStartMs', 0) / 1000, 'text': text})
            return transcript
    except Exception:
        pass
    return []


# ═══════════════════════════════════════════════════════════
# Error Handlers
# ═══════════════════════════════════════════════════════════

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({'success': False, 'error': 'Not found'}), 404
    return e


@app.errorhandler(500)
def server_error(e):
    if request.path.startswith('/api/'):
        return jsonify({'success': False, 'error': 'Internal server error'}), 500
    return e


# ═══════════════════════════════════════════════════════════
# YouTube Service Initialization
# ═══════════════════════════════════════════════════════════

try:
    from services.youtube_service import init_youtube_service
    init_youtube_service()
except Exception as e:
    print(f"[YT INIT] Failed to initialize YouTube service: {e}", file=sys.stderr)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
