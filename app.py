import os
import json
import glob
import re
import subprocess
import sys

from flask import Flask, render_template, request, jsonify, send_from_directory, Response, redirect, url_for

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


# Serve tool-specific handler.js (kept alongside each tool directory inside tools/)
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
# API — runs the Python tools natively
# ═══════════════════════════════════════════════════════════

@app.route('/api/download', methods=['GET'])
def api_download():
    """Stream a YouTube format directly to the user with a forced download.
    ?video_id=..&itag=..  (direct stream)  or  ?video_id=..&merge=1&height=..  (video+audio MP4)."""
    video_id = (request.args.get('video_id') or '').strip()
    itag = (request.args.get('itag') or '').strip()
    merge = request.args.get('merge') == '1'
    height = (request.args.get('height') or '').strip()
    title = sanitize_filename(request.args.get('title') or 'youtube_video')[:60]

    if not re.match(r'^[A-Za-z0-9_-]{11}$', video_id):
        return jsonify({'success': False, 'error': 'Invalid video ID'}), 400
    if merge:
        if not re.match(r'^\d{3,4}$', height):
            return jsonify({'success': False, 'error': 'Invalid height'}), 400
        return _download_merged(video_id, int(height), title)
    if not re.match(r'^\d{1,4}$', itag):
        return jsonify({'success': False, 'error': 'Invalid format id'}), 400
    return _download_stream(video_id, itag, title)


def sanitize_filename(name):
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', name).replace('\n', ' ').strip() or 'youtube_video'


def _yt_dlp_cmd():
    """Return a yt-dlp invocation with --impersonate chrome baked in."""
    try:
        result = subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            return ['yt-dlp', '--impersonate', 'chrome']
    except Exception:
        pass
    return [sys.executable, '-m', 'yt_dlp', '--impersonate', 'chrome']


def _download_stream(video_id, itag, title):
    video_url = f'https://www.youtube.com/watch?v={video_id}'
    base = _yt_dlp_cmd()
    cmd = base + [
        '--no-playlist', '--no-warnings', '--no-check-certificates',
        '--socket-timeout', '20', '--retries', '2',
        '--extractor-args', 'youtube:player_client=default,web_embedded,tv,mweb,android',
        '--get-url', '-f', itag, video_url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except Exception as e:
        return jsonify({'success': False, 'error': 'Failed to resolve stream: ' + str(e)}), 502
    if result.returncode != 0 or not result.stdout.strip():
        return jsonify({'success': False, 'error': 'Could not resolve a download link for this format. Try another quality.'}), 502

    stream_url = result.stdout.strip().split('\n')[0]
    return _stream_url(stream_url, f'{title}_{itag}.mp4', 'application/octet-stream')


def _stream_url(source_url, filename, content_type):
    """Proxy a remote URL to the client using curl_cffi for TLS impersonation."""
    def generate():
        try:
            from curl_cffi import requests as cffi_requests
            resp = cffi_requests.get(source_url, impersonate='chrome', timeout=60, stream=True)
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    yield chunk
        except ImportError:
            import urllib.request
            req = urllib.request.Request(source_url, headers={
                'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                               '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
            })
            with urllib.request.urlopen(req, timeout=60) as resp:
                while True:
                    chunk = resp.read(1024 * 1024)
                    if not chunk:
                        break
                    yield chunk
    return Response(generate(), mimetype=content_type, headers={
        'Content-Disposition': f'attachment; filename="{filename}"',
    })


def _download_merged(video_id, height, title):
    """Download video+audio of the requested height and merge to MP4 (needs ffmpeg on server)."""
    import tempfile
    import shutil

    if not shutil.which('ffmpeg'):
        return jsonify({'success': False, 'error': 'Merging is not available on this server.'}), 501

    video_url = f'https://www.youtube.com/watch?v={video_id}'
    tmpdir = tempfile.mkdtemp(prefix='ytmerge_')
    out_pattern = os.path.join(tmpdir, '%(id)s.%(ext)s')
    try:
        base = _yt_dlp_cmd()
        cmd = base + [
            '--no-playlist', '--no-warnings', '--no-check-certificates',
            '--socket-timeout', '20', '--retries', '2',
            '--extractor-args', 'youtube:player_client=default,web_embedded,tv,mweb,android',
            '--merge-output-format', 'mp4',
            '--format', f'bv*[height<={height}][ext=mp4]+ba[ext=m4a]/b[height<={height}][ext=mp4]',
            '--output', out_pattern,
            '--ffmpeg-location', shutil.which('ffmpeg'),
            video_url,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=240)
        merged = None
        for name in os.listdir(tmpdir):
            if name.endswith('.mp4'):
                merged = os.path.join(tmpdir, name)
                break
        if result.returncode != 0 or not merged or not os.path.isfile(merged):
            return jsonify({'success': False, 'error': 'Could not merge this quality (fall back to a lower one).'}), 502
        size = os.path.getsize(merged)
        filename = f'{title}_{height}p.mp4'
        def generate(path, file_size):
            with open(path, 'rb') as fh:
                while True:
                    chunk = fh.read(1024 * 1024)
                    if not chunk:
                        break
                    yield chunk
            shutil.rmtree(tmpdir, ignore_errors=True)
        return Response(generate(merged, size), mimetype='video/mp4', headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
        })
    except Exception as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        return jsonify({'success': False, 'error': 'Download failed: ' + str(e)}), 502


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

        video_id = extract_video_id(url) if url else data.get('video_id', '')

        if tool == 'youtube-downloader':
            return jsonify(run_youtube_downloader(url, video_id))

        elif tool == 'youtube-transcript':
            lang = data.get('lang', 'en')
            return jsonify(run_youtube_transcript(url, video_id, lang))

        elif tool == 'translate-transcript':
            target_lang = data.get('target_lang', 'es')
            return jsonify(run_translate_transcript(video_id, target_lang))

        return jsonify({'success': False, 'error': f'Unknown tool: {tool}'})
    except Exception as e:
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
    """Translate every line using deep_translator (primary) with MyMemory/gtx
    fallbacks. Returns (translated_list, used_fallback=True if any line stayed
    original)."""
    import time
    if not texts:
        return [], False
    if source_lang == target_lang:
        return list(texts), False

    # Map some common codes that deep_translator may not handle directly
    lang_map = {
        'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', 'zh': 'zh-CN',
        'he': 'iw', 'jv': 'jv', 'hmn': 'hmn',
        'ceb': 'ceb', 'haw': 'haw', 'fy': 'fy',
    }
    tl_lang = lang_map.get(target_lang, target_lang)
    tl_src = lang_map.get(source_lang, source_lang)

    result = [None] * len(texts)

    # ── Pass 1: deep_translator GoogleTranslator (most reliable) ──
    try:
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source=tl_src, target=tl_lang)
        # Send in batches of ~4500 chars to stay within limits
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

    # ── Pass 2: MyMemory for anything still untranslated (skip if source_lang is auto) ──
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

    # ── Pass 3: Google gtx for anything still untranslated ──
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

    # Whatever is left genuinely could not be translated — keep original
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


def extract_video_id(url):
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


def run_python_script(script_path, args):
    """Run a tool's extract.py and parse its JSON output."""
    if not os.path.isfile(script_path):
        return None
    try:
        result = subprocess.run(
            [sys.executable, script_path] + args,
            capture_output=True, text=True, timeout=90,
        )
        if result.returncode == 0 and result.stdout.strip():
            data = json.loads(result.stdout.strip())
            if isinstance(data, dict) and 'success' in data:
                return data
    except Exception:
        pass
    return None


def run_youtube_downloader(url, video_id):
    try:
        # 1) Try the dedicated extract.py subprocess
        script = os.path.join(TOOLS_DIR, 'youtube-downloader', 'extract.py')
        result = run_python_script(script, [url])
        if result and result.get('data', {}).get('formats'):
            return result

        # 2) Try yt-dlp Python API directly (in-process, avoids subprocess issues)
        try:
            result = _ytdlp_python_extract(url, video_id)
            if result and result.get('data', {}).get('formats'):
                return result
        except Exception:
            pass

        # 3) Final fallback: scrape YouTube HTML
        return php_extract_downloader(url, video_id)
    except Exception as e:
        # Never let extraction crash the request — return empty formats with error
        thumbnail = f'https://img.youtube.com/vi/{video_id}/hqdefault.jpg'
        oe = get_oembed_info(f'https://www.youtube.com/watch?v={video_id}')
        return {
            'success': True,
            'data': {
                'title': oe.get('title', '') or 'YouTube Video',
                'channel': oe.get('channel', ''),
                'video_id': video_id,
                'thumbnail': thumbnail,
                'duration': '',
                'formats': [],
                'url': f'https://www.youtube.com/watch?v={video_id}',
                'note': f'Extraction failed: {str(e)[:100]}',
            }
        }


def _ytdlp_python_extract(url, video_id):
    """Use yt-dlp as a Python library (no subprocess) to extract formats.
    Tries multiple client combinations for maximum compatibility."""
    try:
        import yt_dlp
    except ImportError:
        return None

    thumbnail = f'https://img.youtube.com/vi/{video_id}/hqdefault.jpg'
    title = ''
    channel = ''
    duration = ''
    formats = []

    # Try with impersonation first, then without (Render may lack curl-cffi)
    client_combos = [
        ['default', 'web_embedded', 'tv', 'mweb', 'android'],
        ['default', 'web', 'tv', 'mweb', 'android'],
        ['web_embedded'],
        ['mweb'],
        ['android'],
    ]

    import time as _time
    deadline = _time.time() + 60  # 60s total budget for all attempts
    info = None
    # Pass 1: with impersonation, then without
    for impersonate in (True, False):
        for clients in client_combos:
            if _time.time() > deadline:
                break
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'no_check_certificates': True,
                'skip_download': True,
                'socket_timeout': 15,
                'retries': 1,
                'extractor_retries': 2,
                'extractor_args': {'youtube': {'player_client': clients}},
                'http_headers': {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
            }
            if impersonate:
                ydl_opts['impersonate_target'] = 'chrome'
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                if info and info.get('formats'):
                    break
            except Exception:
                continue
        if info and info.get('formats'):
            break

    if not info:
        return None

    title = info.get('title', info.get('fulltitle', ''))
    channel = info.get('channel', info.get('uploader', ''))
    duration = info.get('duration_string', '')
    if info.get('thumbnail'):
        thumbnail = info['thumbnail']

    # Process formats the same way as extract.py
    try:
        sys.path.insert(0, os.path.join(TOOLS_DIR, 'youtube-downloader'))
        from extract import process_formats, has_ffmpeg
        formats = process_formats(info)
        ffmpeg_available = has_ffmpeg()
    except Exception:
        ffmpeg_available = False
        # Inline fallback processing
        for fmt in info.get('formats', []):
            fmt_url = fmt.get('url', '')
            if not fmt_url:
                continue
            height = fmt.get('height', 0) or 0
            ext = fmt.get('ext', 'mp4')
            vcodec = fmt.get('vcodec', 'none')
            acodec = fmt.get('acodec', 'none')
            filesize = fmt.get('filesize') or fmt.get('filesize_approx', 0) or 0
            abr = fmt.get('abr', 0) or 0
            itag = fmt.get('format_id', '')
            fps = fmt.get('fps', 0) or 0
            protocol = fmt.get('protocol', '')
            if protocol in ['m3u8_native', 'm3u8', 'mhtml']:
                continue
            if not str(itag).isdigit():
                continue
            if vcodec != 'none' and acodec != 'none':
                st = 'video'
            elif vcodec != 'none':
                st = 'video_only'
            elif acodec != 'none':
                st = 'audio'
            else:
                continue
            label = f'{height}p' if st != 'audio' else f'Audio {round(abr)}kbps'
            formats.append({
                'label': label, 'itag': str(itag), 'url': fmt_url, 'ext': ext,
                'height': height, 'fps': fps, 'filesize': filesize,
                'abr': round(abr, -1), 'stream_type': st,
                'has_audio': st != 'video_only', 'has_video': st != 'audio',
            })
        formats.sort(key=lambda f: ({'video': 0, 'video_only': 1, 'audio': 2}.get(f['stream_type'], 3), -f['height']))

    if not formats:
        return None

    return {
        'success': True,
        'data': {
            'title': title or 'YouTube Video',
            'channel': channel,
            'video_id': video_id,
            'thumbnail': thumbnail,
            'duration': duration,
            'formats': formats,
            'url': url,
            'ffmpeg': ffmpeg_available,
        }
    }


def run_youtube_transcript(url, video_id, lang='en'):
    script = os.path.join(TOOLS_DIR, 'youtube-transcript', 'extract.py')
    result = run_python_script(script, [url, lang])
    if result:
        return result
    return php_transcript_fallback(url, video_id)


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
            capture_output=True, text=True, timeout=90,
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
    # Try curl-cffi first (bypasses TLS fingerprint blocking)
    try:
        from curl_cffi import requests as cffi_requests
        resp = cffi_requests.get(url, impersonate='chrome', timeout=timeout)
        if resp.status_code == 200:
            return resp.text
    except ImportError:
        pass
    except Exception:
        pass
    # Fallback to urllib
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


def php_extract_downloader(url, video_id):
    thumbnail = f'https://img.youtube.com/vi/{video_id}/hqdefault.jpg'
    title = ''
    channel = ''
    duration = ''
    formats = []

    page_html = fetch_url(f'https://www.youtube.com/watch?v={video_id}')

    if page_html:
        m = re.search(r'var ytInitialPlayerResponse\s*=\s*(\{.*?\});\s*(?:var|<)', page_html, re.DOTALL)
        if m:
            try:
                pr = json.loads(m.group(1))
                vd = pr.get('videoDetails', {})
                title = vd.get('title', '')
                channel = vd.get('author', '')
                dur = vd.get('lengthSeconds', '')
                if dur and dur.isdigit():
                    secs = int(dur)
                    duration = f'{secs // 60}:{secs % 60:02d}'
                thumbs = vd.get('thumbnail', {}).get('thumbnails', [])
                if thumbs:
                    thumbnail = thumbs[-1].get('url', thumbnail)

                sd = pr.get('streamingData', {})
                all_fmts = (sd.get('formats', []) or []) + (sd.get('adaptiveFormats', []) or [])
                seen = set()
                for fmt in all_fmts:
                    fmt_url = fmt.get('url', '')
                    cipher = fmt.get('signatureCipher', '')
                    if not fmt_url and not cipher:
                        continue
                    h = fmt.get('height', 0) or 0
                    mt = fmt.get('mimeType', '')
                    fs = int(fmt.get('contentLength', 0) or 0)
                    is_a = 'audio' in mt
                    is_v = 'video' in mt
                    label = ''
                    if is_v and h > 0:
                        label = f'{h}p'
                    elif is_v:
                        label = 'Video'
                    elif is_a:
                        label = 'Audio'
                    if not label:
                        continue
                    ext = 'webm' if 'webm' in mt else 'mp4'
                    key = f'{h}_{ext}'
                    if key in seen:
                        continue
                    seen.add(key)
                    formats.append({
                        'label': f'{label} ({ext})',
                        'url': fmt_url,
                        'ext': ext,
                        'height': h,
                        'filesize': fs,
                        'hasCipher': bool(cipher and not fmt_url),
                    })
                formats.sort(key=lambda f: -f['height'])
            except Exception:
                pass

    if not title:
        oe = get_oembed_info(url)
        title = oe['title']
        channel = oe['channel']

    return {
        'success': True,
        'data': {
            'title': title or 'YouTube Video',
            'channel': channel,
            'video_id': video_id,
            'thumbnail': thumbnail,
            'duration': duration,
            'formats': formats,
            'url': url,
            'note': 'No direct download links. Install yt-dlp for full support.' if not formats else None,
        }
    }


def php_transcript_fallback(url, video_id):
    oe = get_oembed_info(url)
    transcript = php_extract_transcript(video_id)
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


def php_extract_transcript(video_id):
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


if __name__ == '__main__':
    app.run(debug=True, port=5000)
