import os
import json
import glob
import re

from flask import Flask, render_template, request, jsonify, send_from_directory, Response, redirect, url_for

app = Flask(__name__, static_folder='assets', template_folder='templates')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.join(BASE_DIR, 'tools')

# Category metadata — includes SEO-friendly descriptions for each category
CATEGORY_META = {
    "Text Tools": {
        "key": "text", "icon": "text_fields", "order": 1,
        "slug_aliases": ["text-tools", "text-processing", "text-editors"],
        "description": "Free online text processing tools. Transform, analyze, format, count, clean, and manipulate text instantly in your browser.",
    },
    "Code Tools": {
        "key": "code", "icon": "code", "order": 2,
        "slug_aliases": ["code-tools", "code-formatters", "code-editors"],
        "description": "Free online code formatting, minifying, beautifying, and validation tools. Support for JavaScript, Python, HTML, CSS, and more.",
    },
    "Cryptography": {
        "key": "crypto", "icon": "enhanced_encryption", "order": 3,
        "slug_aliases": ["crypto-tools", "encryption", "cryptography-tools"],
        "description": "Free online cryptography tools. Encrypt, decrypt, hash, and encode data with MD5, SHA-256, AES, and more.",
    },
    "Calculators": {
        "key": "calculators", "icon": "calculate", "order": 4,
        "slug_aliases": ["calculator-tools", "math-calculators", "online-calculators"],
        "description": "Free online calculators for math, finance, health, and everyday use. Quick and accurate results.",
    },
    "Generators": {
        "key": "generators", "icon": "auto_awesome", "order": 5,
        "slug_aliases": ["generator-tools", "random-generators", "online-generators"],
        "description": "Free online generator tools. Generate passwords, UUIDs, hashes, random data, mock data, and more.",
    },
    "Converters": {
        "key": "converters", "icon": "swap_horiz", "order": 6,
        "slug_aliases": ["converter-tools", "unit-converters", "online-converters"],
        "description": "Free online converter tools. Convert between units, formats, encodings, and data types instantly.",
    },
    "Web & SEO": {
        "key": "web", "icon": "public", "order": 7,
        "slug_aliases": ["web-tools", "seo-tools", "seo-checkers"],
        "description": "Free online web and SEO tools. Check meta tags, generate sitemaps, analyze URLs, and optimize your site.",
    },
    "Design & Visual": {
        "key": "design", "icon": "palette", "order": 8,
        "slug_aliases": ["design-tools", "visual-tools", "graphic-tools"],
        "description": "Free online design and visual tools. Color pickers, gradient generators, font tools, and image utilities.",
    },
    "Developer Tools": {
        "key": "developer", "icon": "developer_mode", "order": 9,
        "slug_aliases": ["developer-tools", "dev-tools", "programming-tools"],
        "description": "Free online developer tools. JSON formatters, regex testers, API utilities, cheatsheets, and more.",
    },
    "Encoding & Crypto": {
        "key": "encoding", "icon": "lock", "order": 10,
        "slug_aliases": ["encoding-tools", "encoder-decoder", "data-encoding"],
        "description": "Free online encoding and decoding tools. Base64, URL encoding, HTML entities, Unicode, and more.",
    },
    "Statistics & Analysis": {
        "key": "statistics", "icon": "analytics", "order": 11,
        "slug_aliases": ["statistics-tools", "data-analysis", "statistical-tools"],
        "description": "Free online statistics and data analysis tools. Mean, median, standard deviation, regression, and more.",
    },
}

# Build reverse lookup: alias -> category key
CATEGORY_ALIAS_MAP = {}
for cat_name, meta in CATEGORY_META.items():
    CATEGORY_ALIAS_MAP[meta["key"]] = meta["key"]
    for alias in meta.get("slug_aliases", []):
        CATEGORY_ALIAS_MAP[alias] = meta["key"]


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


def resolve_category_key(key_or_alias):
    """Resolve a category key or alias to the canonical key."""
    return CATEGORY_ALIAS_MAP.get(key_or_alias)


def xml_escape(s):
    """Escape special characters for XML."""
    return (s.replace('&', '&amp;')
             .replace('<', '&lt;')
             .replace('>', '&gt;')
             .replace('"', '&quot;')
             .replace("'", '&apos;'))


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


@app.route('/search')
def search_redirect():
    """Search redirect: if query matches a tool name/slug, go to it. Otherwise homepage."""
    q = request.args.get('q', '').strip().lower()
    if not q:
        return redirect(url_for('index'))
    tools = load_tools()
    # Exact slug match
    for t in tools:
        if t.get('slug', '').replace('-', ' ') == q or t.get('slug', '') == q:
            return redirect(url_for('tool_page', slug=t['slug']))
    # Exact name match (case-insensitive)
    for t in tools:
        if (t.get('name', '').lower()) == q:
            return redirect(url_for('tool_page', slug=t['slug']))
    # Partial name match — best first
    best = None
    best_score = 0
    for t in tools:
        name = (t.get('name', '') or '').lower()
        desc = (t.get('description', '') or '').lower()
        slug = (t.get('slug', '') or '').replace('-', ' ')
        if q in name:
            score = 100 - name.index(q)
            if score > best_score:
                best_score = score
                best = t
        elif q in slug:
            score = 80 - slug.index(q)
            if score > best_score:
                best_score = score
                best = t
        elif q in desc:
            score = 50 - desc.index(q)
            if score > best_score:
                best_score = score
                best = t
    if best and best_score >= 50:
        return redirect(url_for('tool_page', slug=best['slug']))
    # No match — go to homepage with search
    return redirect(url_for('index'))


# ── Category Pages ──

@app.route('/category/<key>')
def category_page(key):
    """Dedicated category page showing all tools in a category."""
    canonical = resolve_category_key(key)
    if not canonical:
        return redirect(url_for('index'))
    # If alias, redirect to canonical
    if key != canonical:
        return redirect(url_for('category_page', key=canonical), 301)

    tools = load_tools()
    categories = group_tools_by_category(tools)
    cat_data = categories.get(canonical)
    if not cat_data:
        return redirect(url_for('index'))

    # Related categories (all except current)
    related_cats = []
    for ck, cd in categories.items():
        if ck != canonical:
            related_cats.append({
                'key': ck,
                'name': cd['name'],
                'icon': cd['icon'],
                'count': len(cd['tools']),
            })

    meta = CATEGORY_META.get(cat_data['name'], {})

    return render_template(
        'category.html',
        cat_data=cat_data,
        categories=categories,
        total_tools=len(tools),
        related_cats=related_cats,
        seo_title=f"{cat_data['name']} — {len(cat_data['tools'])}+ Free Online Tools | ToolsAllInOnePro",
        seo_desc=meta.get('description', f"{len(cat_data['tools'])} free online {cat_data['name']} tools."),
    )


# ── Tool Pages (multiple path aliases) ──

@app.route('/tool/<slug>')
def tool_page(slug):
    tool = load_tool(slug)
    if not tool:
        return redirect(url_for('index'))
    tools = load_tools()
    categories = group_tools_by_category(tools)
    return render_template('tool.html', tool=tool, slug=slug, all_tools=tools, categories=categories, total_tools=len(tools))


@app.route('/tools/<slug>')
def tool_page_alias(slug):
    """Alternate path: /tools/<slug>"""
    tool = load_tool(slug)
    if not tool:
        return redirect(url_for('index'))
    return redirect(url_for('tool_page', slug=slug), 301)


@app.route('/t/<slug>')
def tool_page_short(slug):
    """Short path: /t/<slug>"""
    tool = load_tool(slug)
    if not tool:
        return redirect(url_for('index'))
    return redirect(url_for('tool_page', slug=slug), 301)


@app.route('/tool/<slug>/handler.js')
def tool_handler_js(slug):
    tool_dir = os.path.join(TOOLS_DIR, slug)
    handler_path = os.path.join(tool_dir, 'handler.js')
    if os.path.isfile(handler_path):
        return send_from_directory(tool_dir, 'handler.js',
                                   mimetype='application/javascript')
    return '', 404


# ── Category path aliases ──

@app.route('/cat/<key>')
def category_alias_short(key):
    """Short path: /cat/<key>"""
    canonical = resolve_category_key(key)
    if not canonical:
        return redirect(url_for('index'))
    return redirect(url_for('category_page', key=canonical), 301)


@app.route('/categories')
def categories_list():
    """List all categories."""
    return redirect(url_for('sitemap_page'))


@app.route('/categories/<key>')
def category_alias_path(key):
    """Path: /categories/<key>"""
    canonical = resolve_category_key(key)
    if not canonical:
        return redirect(url_for('index'))
    return redirect(url_for('category_page', key=canonical), 301)


# ═══════════════════════════════════════════════════════════
# Sitemap Routes
# ═══════════════════════════════════════════════════════════

@app.route('/sitemap')
def sitemap_page():
    tools = load_tools()
    categories = group_tools_by_category(tools)
    return render_template('sitemap.html', tools=tools, categories=categories, total_tools=len(tools))


@app.route('/sitemap.xml')
def sitemap():
    """Generate a powerful XML sitemap with image extensions and diverse paths."""
    from datetime import datetime

    tools = load_tools()
    site_url = request.host_url.rstrip('/')
    today = datetime.utcnow().strftime('%Y-%m-%d')
    favicon_url = site_url + '/static/favicon.svg'

    # Build XML using string templates for full control
    lines = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append('<urlset')
    lines.append('  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    lines.append('  xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    lines.append('  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
    lines.append('>')

    def add_url(loc, lastmod, changefreq, priority):
        lines.append('  <url>')
        lines.append(f'    <loc>{xml_escape(loc)}</loc>')
        lines.append(f'    <lastmod>{lastmod}</lastmod>')
        lines.append(f'    <changefreq>{changefreq}</changefreq>')
        lines.append(f'    <priority>{priority}</priority>')
        lines.append(f'    <xhtml:link rel="alternate" hreflang="en" href="{xml_escape(loc)}"/>')
        lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{xml_escape(loc)}"/>')
        lines.append('  </url>')

    def add_url_with_image(loc, lastmod, changefreq, priority, img_loc, img_title):
        lines.append('  <url>')
        lines.append(f'    <loc>{xml_escape(loc)}</loc>')
        lines.append(f'    <lastmod>{lastmod}</lastmod>')
        lines.append(f'    <changefreq>{changefreq}</changefreq>')
        lines.append(f'    <priority>{priority}</priority>')
        lines.append('    <image:image>')
        lines.append(f'      <image:loc>{xml_escape(img_loc)}</image:loc>')
        lines.append(f'      <image:title>{xml_escape(img_title)}</image:title>')
        lines.append('    </image:image>')
        lines.append(f'    <xhtml:link rel="alternate" hreflang="en" href="{xml_escape(loc)}"/>')
        lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{xml_escape(loc)}"/>')
        lines.append('  </url>')

    # ── Homepage ──
    add_url(site_url + '/', today, 'daily', '1.0')

    # ── Sitemap page ──
    add_url(site_url + '/sitemap', today, 'weekly', '0.8')

    # ── Group tools by category ──
    categories_seen = {}
    for t in tools:
        cat = t.get('category', 'Other')
        if cat not in categories_seen:
            meta = CATEGORY_META.get(cat, {})
            categories_seen[cat] = {
                'key': meta.get('key', cat.lower().replace(' ', '-')),
                'tools': [],
            }
        categories_seen[cat]['tools'].append(t)

    # ── Category pages ──
    for cat, cat_data in categories_seen.items():
        cat_url = site_url + '/category/' + cat_data['key']
        add_url(cat_url, today, 'daily', '0.9')
        # Add first alias path for SEO coverage
        meta = CATEGORY_META.get(cat, {})
        for alias in meta.get('slug_aliases', [])[:1]:
            add_url(site_url + '/categories/' + alias, today, 'weekly', '0.7')

    # ── Tool pages (with image sitemap data) ──
    for t in tools:
        tool_url = site_url + '/tool/' + t['slug']
        tool_title = xml_escape(t.get('name', 'Tool') + ' — ToolsAllInOnePro')
        add_url_with_image(
            tool_url, today, 'weekly', '0.8',
            favicon_url, tool_title
        )
        # Add alternate paths
        add_url(site_url + '/tools/' + t['slug'], today, 'monthly', '0.3')
        add_url(site_url + '/t/' + t['slug'], today, 'monthly', '0.3')

    # ── Close XML ──
    lines.append('</urlset>')

    body = '\n'.join(lines) + '\n'

    resp = Response(body, mimetype='application/xml')
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['Cache-Control'] = 'public, max-age=3600'
    return resp


# ═══════════════════════════════════════════════════════════
# Robots.txt
# ═══════════════════════════════════════════════════════════

@app.route('/robots.txt')
def robots():
    site_url = request.host_url.rstrip('/')
    lines = [
        '# Robots.txt for ToolsAllInOnePro',
        '# https://www.toolsallonepro.com',
        '',
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /static/',
        'Disallow: /handler.js',
        'Disallow: /*?*utm_',
        'Disallow: /*?*ref=',
        '',
        'User-agent: Googlebot',
        'Allow: /',
        'Allow: /sitemap.xml',
        'Allow: /sitemap',
        'Allow: /category/',
        'Allow: /tool/',
        'Disallow: /api/',
        'Disallow: /static/',
        '',
        'User-agent: Bingbot',
        'Allow: /',
        'Allow: /sitemap.xml',
        'Allow: /sitemap',
        'Allow: /category/',
        'Allow: /tool/',
        'Disallow: /api/',
        'Disallow: /static/',
        '',
        'User-agent: Yandex',
        'Allow: /',
        'Allow: /sitemap.xml',
        'Allow: /category/',
        'Allow: /tool/',
        'Disallow: /api/',
        'Disallow: /static/',
        'Crawl-delay: 1',
        '',
        'User-agent: DuckDuckBot',
        'Allow: /',
        'Allow: /sitemap.xml',
        'Disallow: /api/',
        'Disallow: /static/',
        '',
        'User-agent: Baiduspider',
        'Allow: /',
        'Allow: /sitemap.xml',
        'Disallow: /api/',
        'Disallow: /static/',
        '',
        f'Sitemap: {site_url}/sitemap.xml',
    ]
    return Response('\n'.join(lines), mimetype='text/plain')


# ═══════════════════════════════════════════════════════════
# Error Handlers
# ═══════════════════════════════════════════════════════════

@app.route('/health')
def health():
    return jsonify({"status": "ok"})


@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({'success': False, 'error': 'Not found'}), 404
    # Try to suggest a redirect
    path = request.path.strip('/')
    # Check if it's a tool slug
    if load_tool(path):
        return redirect(url_for('tool_page', slug=path))
    # Check if it's a category alias
    canonical = resolve_category_key(path)
    if canonical:
        return redirect(url_for('category_page', key=canonical))
    return e


@app.errorhandler(500)
def server_error(e):
    if request.path.startswith('/api/'):
        return jsonify({'success': False, 'error': 'Internal server error'}), 500
    return e


if __name__ == '__main__':
    app.run(debug=True, port=5000)
