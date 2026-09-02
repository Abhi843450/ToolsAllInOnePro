import os
import json
import glob
import re

from flask import Flask, render_template, request, jsonify, send_from_directory, Response, redirect, url_for

app = Flask(__name__, static_folder='assets', template_folder='templates')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.join(BASE_DIR, 'tools')

# Category metadata
CATEGORY_META = {
    "Text Tools": {"key": "text", "icon": "text_fields", "order": 1},
    "Code Tools": {"key": "code", "icon": "code", "order": 2},
    "Cryptography": {"key": "crypto", "icon": "enhanced_encryption", "order": 3},
    "Calculators": {"key": "calculators", "icon": "calculate", "order": 4},
    "Generators": {"key": "generators", "icon": "auto_awesome", "order": 5},
    "Converters": {"key": "converters", "icon": "swap_horiz", "order": 6},
    "Web & SEO": {"key": "web", "icon": "public", "order": 7},
    "Design & Visual": {"key": "design", "icon": "palette", "order": 8},
    "Developer Tools": {"key": "developer", "icon": "developer_mode", "order": 9},
    "Encoding & Crypto": {"key": "encoding", "icon": "lock", "order": 10},
    "Statistics & Analysis": {"key": "statistics", "icon": "analytics", "order": 11},
}


def get_current_year():
    from datetime import datetime
    return datetime.now().year


app.jinja_env.globals['current_year'] = get_current_year


def load_tools():
    """Scan tool directories and return sorted list with category_slug added."""
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
                # Add category_slug for filtering
                cat = tool.get('category', '')
                meta = CATEGORY_META.get(cat, {})
                tool['category_slug'] = meta.get('key', '')
                tools.append(tool)
    tools.sort(key=lambda t: (t.get('name', '') or '').lower())
    return tools


def load_tool(slug):
    """Load a single tool's tool.json by slug."""
    tool_json = os.path.join(TOOLS_DIR, slug, 'tool.json')
    if not os.path.isfile(tool_json):
        return None
    with open(tool_json, 'r', encoding='utf-8') as f:
        tool = json.load(f)
    if tool:
        tool['slug'] = slug
    return tool


def group_tools_by_category(tools):
    """Group tools into ordered dict by category."""
    from collections import OrderedDict
    groups = OrderedDict()
    for tool in tools:
        cat = tool.get('category', 'Other')
        if cat not in groups:
            meta = CATEGORY_META.get(cat, {})
            groups[cat] = {
                'name': cat,
                'key': meta.get('key', cat.lower().replace(' ', '-')),
                'icon': meta.get('icon', 'build'),
                'tools': [],
            }
        groups[cat]['tools'].append(tool)
    # Sort by CATEGORY_META order
    sorted_groups = OrderedDict()
    for cat, data in sorted(groups.items(), key=lambda x: CATEGORY_META.get(x[0], {}).get('order', 99)):
        sorted_groups[data['key']] = data
    return sorted_groups


# ═══════════════════════════════════════════════════════════
# Page Routes
# ═══════════════════════════════════════════════════════════

@app.route('/')
def index():
    tools = load_tools()
    categories = group_tools_by_category(tools)
    return render_template(
        'index.html',
        tools=tools,
        categories=categories,
        total_tools=len(tools),
        all_tools=tools,
    )


@app.route('/tool/<slug>')
def tool_page(slug):
    tool = load_tool(slug)
    if not tool:
        return redirect(url_for('index'))
    tools = load_tools()
    categories = group_tools_by_category(tools)
    return render_template('tool.html', tool=tool, slug=slug, all_tools=tools, categories=categories, total_tools=len(tools))


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


@app.route('/health')
def health():
    return jsonify({"status": "ok"})


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


if __name__ == '__main__':
    app.run(debug=True, port=5000)
