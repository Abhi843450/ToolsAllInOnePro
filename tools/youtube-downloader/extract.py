#!/usr/bin/env python3
"""
YouTube Video Downloader — extract.py (fast)
Speed: --no-check-certificates, --socket-timeout, --extractor-retries 1
Cache: results cached in temp dir for 1 hour
"""
import sys
import json
import re
import subprocess
import shutil
import os
import hashlib
import time

CACHE_DIR = os.path.join(os.environ.get('TEMP', '/tmp'), 'toolcache')
CACHE_TTL = 3600  # 1 hour


def get_cache(url):
    key = hashlib.md5(f'v3:{url}'.encode()).hexdigest()
    path = os.path.join(CACHE_DIR, f'yt_dl_{key}.json')
    if os.path.exists(path):
        age = time.time() - os.path.getmtime(path)
        if age < CACHE_TTL:
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
    return None


def set_cache(url, data):
    os.makedirs(CACHE_DIR, exist_ok=True)
    key = hashlib.md5(f'v3:{url}'.encode()).hexdigest()
    path = os.path.join(CACHE_DIR, f'yt_dl_{key}.json')
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
    except Exception:
        pass


def find_ytdlp():
    for path in ['yt-dlp', 'yt-dlp.exe']:
        if shutil.which(path):
            return path
    try:
        result = subprocess.run(
            [sys.executable, '-m', 'yt_dlp', '--version'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            return sys.executable + ' -m yt_dlp'
    except Exception:
        pass
    return None


def extract_video_id(url):
    patterns = [
        r'(?:youtube\.com/watch\?v=)([a-zA-Z0-9_-]{11})',
        r'(?:youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com/shorts/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def format_size(size_bytes):
    if not size_bytes:
        return ''
    if size_bytes < 1024:
        return f'{size_bytes} B'
    if size_bytes < 1048576:
        return f'{size_bytes/1024:.1f} KB'
    if size_bytes < 1073741824:
        return f'{size_bytes/1048576:.1f} MB'
    return f'{size_bytes/1073741824:.2f} GB'


def get_video_info(url, ytdlp_path):
    base_args = [
        '--dump-json',
        '--no-download',
        '--no-warnings',
        '--no-check-certificates',
        '--no-playlist',
        '--socket-timeout', '20',
        '--extractor-retries', '3',
        '--retries', '2',
        '--js-runtimes', 'node',
        '--extractor-args', 'youtube:player_client=default,web_embedded,tv,mweb,android',
    ]

    cmd_parts = ytdlp_path.split()
    attempts = [
        cmd_parts + base_args + ['--impersonate', 'chrome', url],
        cmd_parts + base_args + [url],
    ]
    for cmd in attempts:
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=75
            )
            if result.returncode == 0 and result.stdout.strip():
                try:
                    return json.loads(result.stdout)
                except Exception:
                    continue
        except (subprocess.TimeoutExpired, Exception):
            continue
    return None


def _codec_short(vcodec, acodec):
    """Return a short codec label like 'H.264', 'VP9', 'AV1' for display."""
    vc = (vcodec or '').lower()
    if 'avc' in vc:
        return 'H.264'
    if 'vp9' in vc or 'vp09' in vc:
        return 'VP9'
    if 'av01' in vc or 'av1' in vc:
        return 'AV1'
    if 'hev' in vc or 'h265' in vc or 'hev1' in vc:
        return 'H.265'
    ac = (acodec or '').lower()
    if 'mp4a' in ac:
        return 'AAC'
    if 'opus' in ac:
        return 'Opus'
    if 'mp3' in ac:
        return 'MP3'
    return ''


def process_formats(info):
    formats = []

    for fmt in info.get('formats', []):
        url = fmt.get('url', '')
        if not url:
            continue

        height = fmt.get('height', 0) or 0
        ext = fmt.get('ext', 'mp4')
        vcodec = fmt.get('vcodec', 'none')
        acodec = fmt.get('acodec', 'none')
        filesize = fmt.get('filesize') or fmt.get('filesize_approx', 0) or 0
        abr = fmt.get('abr', 0) or 0
        protocol = fmt.get('protocol', '')
        itag = fmt.get('format_id', '')
        fps = fmt.get('fps', 0) or 0

        if protocol in ['m3u8_native', 'm3u8', 'mhtml']:
            continue
        if ext in ['mhtml']:
            continue
        if filesize > 0 and filesize < 10000:
            continue
        if not str(itag).isdigit():
            continue

        if vcodec != 'none' and acodec != 'none':
            stream_type = 'video'          # combined: has audio
        elif vcodec != 'none':
            stream_type = 'video_only'     # high-res video, no audio
        elif acodec != 'none':
            stream_type = 'audio'
        else:
            continue

        # Round fps to nearest standard bucket to avoid near-duplicate entries
        if fps > 0:
            fps_bucket = 60 if fps >= 50 else 30 if fps >= 24 else round(fps)
        else:
            fps_bucket = 0

        codec = _codec_short(vcodec, acodec)

        if stream_type == 'video':
            fps_str = f' {fps_bucket}fps' if fps_bucket > 30 else ''
            label = f'{height}p{fps_str} ({codec})' if codec else f'{height}p{fps_str}'
        elif stream_type == 'video_only':
            fps_str = f' {fps_bucket}fps' if fps_bucket > 30 else ''
            label = f'{height}p{fps_str} ({codec})' if codec else f'{height}p{fps_str}'
        else:
            label = f'Audio {round(abr)}kbps ({codec or ext.upper()})'

        # Group by (stream_type, height, fps_bucket) — keeps 30fps and 60fps separate
        group = (stream_type, height if stream_type != 'audio' else round(abr, -1), fps_bucket if stream_type != 'audio' else 0)
        idx = next((i for i, f in enumerate(formats)
                    if (f['stream_type'],
                        f['height'] if f['stream_type'] != 'audio' else f['abr'],
                        f.get('fps_bucket', 0) if f['stream_type'] != 'audio' else 0) == group), None)
        if idx is not None:
            existing = formats[idx]
            # Prefer mp4 over webm for the same quality group; if both mp4, keep larger file
            if ext == 'mp4' and existing.get('ext') != 'mp4':
                formats[idx] = {
                    'label': label, 'itag': str(itag), 'url': url, 'ext': ext,
                    'height': height, 'fps': fps, 'fps_bucket': fps_bucket,
                    'filesize': filesize, 'abr': round(abr, -1),
                    'stream_type': stream_type, 'has_audio': stream_type != 'video_only',
                    'has_video': stream_type != 'audio', 'codec': codec,
                }
                continue
            if existing.get('ext') == 'mp4' and ext != 'mp4':
                continue
            # Same ext — keep the larger file (usually higher quality)
            if filesize > existing.get('filesize', 0):
                formats[idx] = {
                    'label': label, 'itag': str(itag), 'url': url, 'ext': ext,
                    'height': height, 'fps': fps, 'fps_bucket': fps_bucket,
                    'filesize': filesize, 'abr': round(abr, -1),
                    'stream_type': stream_type, 'has_audio': stream_type != 'video_only',
                    'has_video': stream_type != 'audio', 'codec': codec,
                }
            continue

        formats.append({
            'label': label,
            'itag': str(itag), 'url': url,
            'ext': ext,
            'height': height,
            'fps': fps,
            'fps_bucket': fps_bucket,
            'filesize': filesize,
            'abr': round(abr, -1),
            'stream_type': stream_type,
            'has_audio': stream_type != 'video_only',
            'has_video': stream_type != 'audio',
            'codec': codec,
        })

    # Order: combined video by height desc, then video_only by height desc, then audio by bitrate desc
    def sort_key(f):
        order = {'video': 0, 'video_only': 1, 'audio': 2}
        return (order.get(f['stream_type'], 3), -f['height'], -f.get('fps_bucket', 0), -f['abr'])
    formats.sort(key=sort_key)
    return formats


def has_ffmpeg():
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, timeout=5)
        return result.returncode == 0
    except Exception:
        return False


def get_oembed_info(url):
    import urllib.request
    import urllib.parse
    oembed_url = f'https://www.youtube.com/oembed?url={urllib.parse.quote(url)}&format=json'
    try:
        req = urllib.request.Request(oembed_url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
            return {
                'title': data.get('title', ''),
                'channel': data.get('author_name', ''),
            }
    except Exception:
        return {'title': '', 'channel': ''}


def get_external_formats(video_id):
    """No external services — just return empty. User should install yt-dlp."""
    return []


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No URL provided'}))
        sys.exit(1)

    url = sys.argv[1]
    video_id = extract_video_id(url)

    if not video_id:
        print(json.dumps({'success': False, 'error': 'Invalid YouTube URL'}))
        sys.exit(1)

    # Check cache first
    cached = get_cache(url)
    if cached:
        print(json.dumps(cached))
        sys.exit(0)

    thumbnail = f'https://img.youtube.com/vi/{video_id}/hqdefault.jpg'
    title = ''
    channel = ''
    duration = ''
    formats = []

    # Try yt-dlp
    ytdlp_path = find_ytdlp()
    if ytdlp_path:
        info = get_video_info(url, ytdlp_path)
        if info:
            title = info.get('title', info.get('fulltitle', ''))
            channel = info.get('channel', info.get('uploader', ''))
            duration = info.get('duration_string', '')
            if info.get('thumbnail'):
                thumbnail = info['thumbnail']
            formats = process_formats(info)

    # Fallback: oEmbed for title
    if not title:
        oembed = get_oembed_info(url)
        title = oembed.get('title', '')
        channel = oembed.get('channel', '')

    # Fallback: external download links
    if not formats:
        formats = get_external_formats(video_id)

    result = {
        'success': True,
        'data': {
            'title': title,
            'channel': channel,
            'video_id': video_id,
            'thumbnail': thumbnail,
            'duration': duration,
            'formats': formats,
            'url': url,
            'ffmpeg': has_ffmpeg(),
        }
    }

    # Cache result — only when formats actually loaded (never cache an empty/broken result)
    if formats:
        set_cache(url, result)

    print(json.dumps(result))


if __name__ == '__main__':
    main()
