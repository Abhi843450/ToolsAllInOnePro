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

@app.route('/api/run-tool', methods=['POST', 'OPTIONS'])
def api_run_tool():
    if request.method == 'OPTIONS':
        return '', 200

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
    script = os.path.join(TOOLS_DIR, 'youtube-downloader', 'extract.py')
    result = run_python_script(script, [url])
    if result:
        return result
    return php_extract_downloader(url, video_id)


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
        "    transcript = None\n"
        "    for t in tl:\n"
        "        if t.language_code.startswith('en'):\n"
        "            transcript = t\n"
        "            break\n"
        "    if not transcript:\n"
        "        transcript = tl.find_transcript([t.language_code for t in tl])\n"
        f"    translated = transcript.translate('{target_lang}')\n"
        "    result = translated.fetch()\n"
        f"    segments = [{{'start': s.start, 'text': s.text.strip()}} for s in result.snippets if s.text.strip() and len(s.text.strip()) > 1]\n"
        f"    print(json.dumps({{'success': True, 'data': {{'transcript': segments, 'language': '{target_lang}'}}}}))\n"
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
