<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">
<xsl:output method="html" indent="yes" encoding="UTF-8"/>
<xsl:template match="/">
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sitemap — ToolsAllInOnePro</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
    <style>
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Poppins', -apple-system, sans-serif; background: #f8f8f8; color: #111; line-height: 1.6; }
        .wrap { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
        .head { background: #111; color: #fff; padding: 48px 0; margin-bottom: 32px; }
        .head .wrap { display: flex; align-items: center; gap: 16px; }
        .head h1 { font-size: 2rem; font-weight: 800; display: flex; align-items: center; gap: 12px; }
        .head h1 .material-icons-outlined { font-size: 32px; }
        .head p { color: #aaa; font-size: .95rem; margin-top: 8px; }
        .stats { display: flex; gap: 0; border: 2px solid #e0e0e0; background: #fff; margin-bottom: 32px; }
        .stat { flex: 1; text-align: center; padding: 20px 16px; border-right: 2px solid #e0e0e0; }
        .stat:last-child { border-right: none; }
        .stat strong { display: block; font-size: 2rem; font-weight: 800; color: #111; }
        .stat span { display: block; font-size: .7rem; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: .5px; margin-top: 4px; }
        .cat { margin-bottom: 24px; }
        .cat-head { display: flex; align-items: center; gap: 10px; padding: 14px 20px; background: #111; color: #fff; }
        .cat-head .material-icons-outlined { font-size: 20px; }
        .cat-head h2 { font-size: 1rem; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; flex: 1; }
        .cat-head small { font-size: .75rem; font-weight: 700; background: rgba(255,255,255,.15); padding: 3px 10px; border: 1px solid rgba(255,255,255,.2); }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); border: 2px solid #e0e0e0; border-top: none; background: #fff; }
        .item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-right: 1px solid #e0e0e0; border-bottom: 1px solid #e0e0e0; text-decoration: none; transition: background 80ms; }
        .item:hover { background: #f0f0f0; }
        .item:nth-child(3n) { border-right: none; }
        .item .material-icons-outlined { font-size: 18px; color: #999; flex-shrink: 0; }
        .item:hover .material-icons-outlined { color: #111; }
        .item strong { display: block; font-size: .85rem; font-weight: 600; color: #111; }
        .item small { display: block; font-size: .7rem; color: #999; margin-top: 1px; }
        .item em { font-style: normal; color: #ccc; font-size: 16px; margin-left: auto; flex-shrink: 0; transition: color 80ms; }
        .item:hover em { color: #111; }
        .xml-link { display: flex; align-items: center; gap: 10px; padding: 20px; background: #fff; border: 2px solid #e0e0e0; margin-top: 32px; font-size: .85rem; color: #555; }
        .xml-link a { color: #111; font-weight: 700; text-decoration: underline; }
        .back { display: inline-flex; align-items: center; gap: 6px; color: #999; font-size: .8rem; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 24px; padding: 6px 12px; border: 2px solid #e0e0e0; text-decoration: none; transition: all 100ms; }
        .back:hover { background: #111; color: #fff; border-color: #111; }
        .footer { background: #111; color: #fff; padding: 20px 0; margin-top: 48px; text-align: center; font-size: .8rem; color: #666; }
        @media (max-width: 1024px) { .grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .grid { grid-template-columns: 1fr; } .stats { flex-direction: column; } .stat { border-right: none; border-bottom: 1px solid #e0e0e0; } .stat:last-child { border-bottom: none; } .head h1 { font-size: 1.5rem; } }
    </style>
</head>
<body>
    <div class="head">
        <div class="wrap">
            <div>
                <h1><span class="material-icons-outlined">map</span> Sitemap</h1>
                <p>Complete list of all tools organized by category</p>
            </div>
        </div>
    </div>
    <div class="wrap">
        <a href="/" class="back"><span class="material-icons-outlined">arrow_back</span> Home</a>
        <div class="stats">
            <div class="stat"><strong><xsl:value-of select="count(//s:url[starts-with(s:loc, '/tool/')])"/></strong><span>Tools</span></div>
            <div class="stat"><strong><xsl:value-of select="count(//s:url[not(starts-with(s:loc, '/tool/')) and s:loc != ''])"/></strong><span>Pages</span></div>
            <div class="stat"><strong><xsl:value-of select="count(//s:url)"/></strong><span>Total URLs</span></div>
        </div>
        <div id="sitemap-content"></div>
        <div class="xml-link">
            <span class="material-icons-outlined">code</span>
            <a href="/sitemap.xml">View Raw XML Sitemap</a>
            <span style="color:#999;font-size:.8rem">— For search engines</span>
        </div>
    </div>
    <div class="footer">© 2026 ToolsAllInOnePro</div>
    <script>
    (function() {
        var urls = document.querySelectorAll('s\\:url, url');
        var cats = {};
        var catIcons = {
            'web': 'public', 'crypto': 'enhanced_encryption', 'text': 'text_fields',
            'calculators': 'calculate', 'statistics': 'analytics', 'developer': 'developer_mode',
            'converters': 'swap_horiz', 'design': 'palette', 'generators': 'auto_awesome',
            'encoding': 'lock', 'code': 'code'
        };
        var catNames = {
            'web': 'Web &amp; SEO', 'crypto': 'Cryptography', 'text': 'Text Tools',
            'calculators': 'Calculators', 'statistics': 'Statistics &amp; Analysis', 'developer': 'Developer Tools',
            'converters': 'Converters', 'design': 'Design &amp; Visual', 'generators': 'Generators',
            'encoding': 'Encoding &amp; Crypto', 'code': 'Code Tools'
        };
        urls.forEach(function(u) {
            var loc = u.querySelector('s\\:loc, loc');
            if (!loc) return;
            var href = loc.textContent;
            if (href.indexOf('/tool/') === -1) return;
            var slug = href.split('/tool/')[1];
            var parts = slug.split('-');
            var catKey = '';
            var name = parts.map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
            if (!cats[catKey]) cats[catKey] = [];
            cats[catKey].push({ name: name, slug: slug, href: href });
        });
        // Sort tools alphabetically within each category
        Object.keys(cats).forEach(function(k) {
            cats[k].sort(function(a, b) { return a.name.localeCompare(b.name); });
        });
        var html = '';
        var catOrder = ['web','crypto','text','calculators','statistics','developer','converters','design','generators','encoding','code'];
        catOrder.forEach(function(key) {
            var tools = cats[key];
            if (!tools || !tools.length) return;
            var icon = catIcons[key] || 'build';
            var catName = catNames[key] || key;
            html += '<div class="cat">';
            html += '<div class="cat-head"><span class="material-icons-outlined">' + icon + '</span><h2>' + catName + '</h2><small>' + tools.length + ' tools</small></div>';
            html += '<div class="grid">';
            tools.forEach(function(t) {
                html += '<a href="/tool/' + t.slug + '" class="item">';
                html += '<span class="material-icons-outlined">build</span>';
                html += '<div><strong>' + t.name + '</strong></div>';
                html += '<em class="material-icons-outlined">arrow_forward</em>';
                html += '</a>';
            });
            html += '</div></div>';
        });
        document.getElementById('sitemap-content').innerHTML = html;
    })();
    </script>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
