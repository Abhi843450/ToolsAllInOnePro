/**
 * Processors.js — All tool processing functions
 * Each function receives params object and returns {success, data, html}
 */
var Processors = {};

// ─── TEXT TOOLS ─────────────────────────────────────────────

Processors.word_counter = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length;
  const lines = text.split('\n').length;
  const readTime = Math.max(1, Math.ceil(words.length / 200));
  const speakTime = Math.max(1, Math.ceil(words.length / 150));
  return {
    success: true,
    data: {
      words: words.length,
      characters: chars,
      characters_no_space: charsNoSpace,
      sentences: sentences,
      paragraphs: paragraphs,
      lines: lines,
      read_time_min: readTime,
      speak_time_min: speakTime,
      avg_word_length: words.length ? (charsNoSpace / words.length).toFixed(1) : 0,
      avg_sentence_length: sentences ? (words.length / sentences).toFixed(1) : 0,
    }
  };
};

Processors.char_counter = Processors.word_counter;
Processors.sentence_counter = Processors.word_counter;
Processors.paragraph_counter = Processors.word_counter;
Processors.reading_time = Processors.word_counter;
Processors.text_stats = Processors.word_counter;

Processors.case_converter = function(text, opts) {
  if (!text) return { success: false, error: 'No text provided' };
  const mode = (opts && opts.mode) || 'uppercase';
  const results = {};
  results['UPPERCASE'] = text.toUpperCase();
  results['lowercase'] = text.toLowerCase();
  results['Title Case'] = text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  results['Sentence case'] = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  results['aLtErNaTiNg CaSe'] = text.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('');
  results['iNVERSE cAsE'] = text.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
  return { success: true, data: results };
};

Processors.text_reverser = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  return {
    success: true,
    data: {
      'Reversed Characters': text.split('').reverse().join(''),
      'Reversed Words': text.split(/\s+/).reverse().join(' '),
      'Reversed Lines': text.split('\n').reverse().join('\n'),
    }
  };
};

Processors.line_sorter = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const lines = text.split('\n');
  return {
    success: true,
    data: {
      'Alphabetical (A-Z)': [...lines].sort().join('\n'),
      'Alphabetical (Z-A)': [...lines].sort().reverse().join('\n'),
      'By Length (Shortest)': [...lines].sort((a, b) => a.length - b.length).join('\n'),
      'By Length (Longest)': [...lines].sort((a, b) => b.length - a.length).join('\n'),
      'No Duplicates': [...new Set(lines)].join('\n'),
      'Reversed Order': [...lines].reverse().join('\n'),
    }
  };
};

Processors.line_numberer = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const lines = text.split('\n');
  const numbered = lines.map((line, i) => `${(i + 1).toString().padStart(3, ' ')}. ${line}`).join('\n');
  return { success: true, data: { 'Numbered': numbered } };
};

Processors.find_replace = function(text, opts) {
  if (!text || !opts) return { success: false, error: 'Text and options required' };
  const find = opts.find_text || '';
  const replace = opts.replace_text || '';
  if (!find) return { success: false, error: 'Find text required' };
  const useRegex = opts.use_regex === 'true';
  let result;
  try {
    const flags = opts.case_insensitive === 'true' ? 'gi' : 'g';
    const pattern = useRegex ? new RegExp(find, flags) : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    result = text.replace(pattern, replace);
  } catch (e) {
    return { success: false, error: 'Invalid regex pattern' };
  }
  const count = (text.match(new RegExp(useRegex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
  return { success: true, data: { 'Result': result, '_info': `${count} replacement(s) made` } };
};

Processors.text_cleaner = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  return {
    success: true,
    data: {
      'Remove Extra Spaces': text.replace(/ +/g, ' ').trim(),
      'Remove Blank Lines': text.replace(/^\s*\n/gm, ''),
      'Trim Whitespace': text.split('\n').map(l => l.trim()).join('\n'),
      'Remove Special Chars': text.replace(/[^\w\s]/g, ''),
      'Normalize All': text.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(),
    }
  };
};

Processors.text_trimmer = function(text, opts) {
  if (!text) return { success: false, error: 'No text provided' };
  const limit = parseInt((opts && opts.char_limit) || '100');
  if (text.length <= limit) return { success: true, data: { 'Result': text } };
  return { success: true, data: { 'Result': text.substring(0, limit) + '...' } };
};

Processors.text_duplicator = function(text, opts) {
  if (!text) return { success: false, error: 'No text provided' };
  const times = parseInt((opts && opts.times) || '3');
  const sep = (opts && opts.separator) || '\n';
  return { success: true, data: { 'Result': Array(times).fill(text).join(sep) } };
};

Processors.word_frequency = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const words = text.toLowerCase().match(/\b\w+\b/g) || {};
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 50);
  const html = '<table style="width:100%;border-collapse:collapse"><tr><th style="text-align:left;padding:6px;border-bottom:2px solid var(--border)">Word</th><th style="text-align:right;padding:6px;border-bottom:2px solid var(--border)">Count</th><th style="text-align:right;padding:6px;border-bottom:2px solid var(--border)">%</th></tr>' +
    sorted.map(([w, c]) => `<tr><td style="padding:4px 6px;border-bottom:1px solid var(--border)">${UI.escapeHtml(w)}</td><td style="text-align:right;padding:4px 6px;border-bottom:1px solid var(--border)">${c}</td><td style="text-align:right;padding:4px 6px;border-bottom:1px solid var(--border)">${(c/words.length*100).toFixed(1)}%</td></tr>`).join('') +
    '</table>';
  return { success: true, data: { _html: html, _info: `${Object.keys(freq).length} unique words, ${words.length} total` } };
};

Processors.text_diff = function(text, opts) {
  if (!text || !opts || !opts.text2) return { success: false, error: 'Both texts required' };
  const lines1 = text.split('\n');
  const lines2 = opts.text2.split('\n');
  let html = '<div style="font-family:monospace;font-size:0.85rem">';
  const maxLen = Math.max(lines1.length, lines2.length);
  for (let i = 0; i < maxLen; i++) {
    const l1 = lines1[i] || '';
    const l2 = lines2[i] || '';
    if (l1 === l2) {
      html += `<div style="padding:2px 8px;background:transparent;color:var(--text-secondary)">${UI.escapeHtml(l1)}</div>`;
    } else {
      html += `<div style="padding:2px 8px;background:#ffe0e0;color:#b00">- ${UI.escapeHtml(l1)}</div>`;
      html += `<div style="padding:2px 8px;background:#e0ffe0;color:#060">+ ${UI.escapeHtml(l2)}</div>`;
    }
  }
  html += '</div>';
  return { success: true, data: { _html: html } };
};

Processors.text_summary = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const wordFreq = {};
  words.forEach(w => { if (w.length > 3) wordFreq[w] = (wordFreq[w] || 0) + 1; });
  const scored = sentences.map(s => {
    const sWords = s.toLowerCase().match(/\b\w+\b/g) || [];
    const score = sWords.reduce((sum, w) => sum + (wordFreq[w] || 0), 0);
    return { text: s.trim(), score };
  }).sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.max(3, Math.ceil(sentences.length * 0.3)));
  const summary = top.map(s => s.text).join('. ') + '.';
  return { success: true, data: { 'Summary': summary } };
};

Processors.markdown_preview = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  let html = text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:var(--bg-secondary);padding:2px 6px;border-radius:3px">$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>');
  return { success: true, data: { _html: `<div style="padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-primary)">${html}</div>` } };
};

Processors.text_encoder = function(text, opts) {
  if (!text) return { success: false, error: 'No text provided' };
  const mode = (opts && opts.mode) || 'base64';
  const results = {};
  try {
    if (mode === 'base64' || mode === 'all') {
      results['Base64 Encode'] = btoa(unescape(encodeURIComponent(text)));
      try { results['Base64 Decode'] = decodeURIComponent(escape(atob(text))); } catch(e) {}
    }
    if (mode === 'url' || mode === 'all') {
      results['URL Encode'] = encodeURIComponent(text);
      try { results['URL Decode'] = decodeURIComponent(text); } catch(e) {}
    }
    if (mode === 'rot13' || mode === 'all') {
      results['ROT13'] = text.replace(/[a-zA-Z]/g, c => {
        const base = c <= 'Z' ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
      });
    }
    if (mode === 'html' || mode === 'all') {
      const el = document.createElement('div');
      el.textContent = text;
      results['HTML Encode'] = el.innerHTML;
    }
  } catch (e) {
    return { success: false, error: 'Encoding error: ' + e.message };
  }
  return { success: true, data: results };
};

Processors.text_to_slugs = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  return {
    success: true,
    data: {
      'Hyphen Slug': text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').trim(),
      'Underscore Slug': text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s-]+/g, '_').replace(/_+/g, '_').trim(),
      'URL Encoded': encodeURIComponent(text),
    }
  };
};

Processors.binary_text = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const isBinary = /^[01\s]+$/.test(text.trim());
  if (isBinary) {
    const decoded = text.trim().split(/\s+/).map(b => String.fromCharCode(parseInt(b, 2))).join('');
    return { success: true, data: { 'Decoded Text': decoded } };
  }
  const encoded = text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
  return { success: true, data: { 'Binary': encoded } };
};

Processors.morse_code = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const map = { A:'.-', B:'-...', C:'-.-.', D:'-..', E:'.', F:'..-.', G:'--.', H:'....', I:'..', J:'.---', K:'-.-', L:'.-..', M:'--', N:'-.', O:'---', P:'.--.', Q:'--.-', R:'.-.', S:'...', T:'-', U:'..-', V:'...-', W:'.--', X:'-..-', Y:'-.--', Z:'--..', '0':'-----', '1':'.----', '2':'..---', '3':'...--', '4':'....-', '5':'.....', '6':'-....', '7':'--...', '8':'---..', '9':'----.' };
  const reverse = Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
  const isMorse = /[.\-]/.test(text) && /[ ]/.test(text);
  if (isMorse) {
    const decoded = text.split('  ').map(w => w.split(' ').map(c => reverse[c] || c).join('')).join(' ');
    return { success: true, data: { 'Decoded': decoded.toUpperCase() } };
  }
  const encoded = text.toUpperCase().split('').map(c => map[c] || c).join(' ');
  return { success: true, data: { 'Morse Code': encoded } };
};

Processors.pig_latin = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const toPig = w => {
    if (/^[aeiou]/i.test(w)) return w + 'yay';
    const m = w.match(/^([^aeiou]+)(.*)/i);
    return m ? m[2] + m[1].toLowerCase() + 'ay' : w;
  };
  return { success: true, data: { 'Pig Latin': text.split(/\s+/).map(toPig).join(' ') } };
};

Processors.palindrome_checker = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isPal = cleaned === cleaned.split('').reverse().join('');
  return { success: true, data: { 'Result': isPal ? '✅ This IS a palindrome!' : '❌ This is NOT a palindrome.', 'Cleaned': cleaned } };
};

Processors.acronym_generator = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const words = text.trim().split(/\s+/);
  const acronym = words.map(w => w.charAt(0).toUpperCase()).join('');
  return { success: true, data: { 'Acronym': acronym, 'Pronounced': acronym.split('').join(' ') } };
};

Processors.name_generator = function(text, opts) {
  const firstNames = ['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Elizabeth','David','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Emma','Olivia','Noah','Liam','Sophia','Isabella','Mia','Charlotte','Amelia','Harper'];
  const lastNames = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Anderson','Taylor','Thomas','Moore','Jackson','Martin','Lee','Thompson','White','Harris'];
  const count = parseInt((opts && opts.count) || '5');
  const names = [];
  for (let i = 0; i < count; i++) {
    names.push(firstNames[Math.floor(Math.random() * firstNames.length)] + ' ' + lastNames[Math.floor(Math.random() * lastNames.length)]);
  }
  return { success: true, data: { 'Names': names.join('\n') } };
};

// ─── CODE TOOLS ─────────────────────────────────────────────

Processors.json_formatter = function(text) {
  if (!text) return { success: false, error: 'No JSON provided' };
  try {
    const parsed = JSON.parse(text);
    return { success: true, data: { 'Formatted JSON': JSON.stringify(parsed, null, 2) } };
  } catch (e) {
    return { success: false, error: 'Invalid JSON: ' + e.message };
  }
};

Processors.json_validator = Processors.json_formatter;
Processors.json_minifier = function(text) {
  if (!text) return { success: false, error: 'No JSON provided' };
  try {
    const parsed = JSON.parse(text);
    return { success: true, data: { 'Minified JSON': JSON.stringify(parsed) } };
  } catch (e) {
    return { success: false, error: 'Invalid JSON: ' + e.message };
  }
};

Processors.json_to_csv = function(text) {
  if (!text) return { success: false, error: 'No JSON provided' };
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr) || arr.length === 0) return { success: false, error: 'JSON must be a non-empty array' };
    const headers = [...new Set(arr.flatMap(Object.keys))];
    const csv = [headers.join(',')].concat(arr.map(row => headers.map(h => {
      const val = row[h];
      const str = val === null || val === undefined ? '' : String(val);
      return str.includes(',') || str.includes('"') ? '"' + str.replace(/"/g, '""') + '"' : str;
    }).join(','))).join('\n');
    return { success: true, data: { 'CSV': csv } };
  } catch (e) {
    return { success: false, error: 'Invalid JSON: ' + e.message };
  }
};

Processors.csv_to_json = function(text) {
  if (!text) return { success: false, error: 'No CSV provided' };
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { success: false, error: 'Need at least a header row and one data row' };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
  return { success: true, data: { 'JSON': JSON.stringify(rows, null, 2) } };
};

Processors.xml_formatter = function(text) {
  if (!text) return { success: false, error: 'No XML provided' };
  try {
    let formatted = '';
    let indent = 0;
    text.replace(/(>)(<)(\/*)/g, '$1\n$2$3').split('\n').forEach(node => {
      if (node.match(/^<\/\w/)) indent--;
      formatted += '  '.repeat(Math.max(0, indent)) + node.trim() + '\n';
      if (node.match(/^<\w[^>]*[^\/]>.*$/)) indent++;
    });
    return { success: true, data: { 'Formatted XML': formatted.trim() } };
  } catch (e) {
    return { success: false, error: 'XML formatting error: ' + e.message };
  }
};

Processors.xml_validator = function(text) {
  if (!text) return { success: false, error: 'No XML provided' };
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const errors = doc.querySelectorAll('parsererror');
    if (errors.length) {
      return { success: true, data: { '❌ Invalid XML': errors[0].textContent } };
    }
    return { success: true, data: { '✅ Valid XML': 'Document parsed successfully' } };
  } catch (e) {
    return { success: false, error: 'Validation error: ' + e.message };
  }
};

Processors.xml_to_json = function(text) {
  if (!text) return { success: false, error: 'No XML provided' };
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const xmlError = doc.querySelector('parsererror');
    if (xmlError) return { success: false, error: 'Invalid XML: ' + xmlError.textContent.substring(0, 200) };
    function nodeToObj(node) {
      const obj = {};
      if (node.attributes && node.attributes.length) {
        for (let i = 0; i < node.attributes.length; i++) {
          obj['@' + node.attributes[i].name] = node.attributes[i].value;
        }
      }
      const children = node.childNodes;
      if (children.length === 1 && children[0].nodeType === 3) {
        const text = children[0].textContent.trim();
        if (Object.keys(obj).length === 0) return text;
        obj['#text'] = text;
      } else {
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.nodeType === 1) {
            const name = child.nodeName;
            const val = nodeToObj(child);
            if (obj[name]) {
              if (!Array.isArray(obj[name])) obj[name] = [obj[name]];
              obj[name].push(val);
            } else {
              obj[name] = val;
            }
          }
        }
      }
      return obj;
    }
    const result = { [doc.documentElement.nodeName]: nodeToObj(doc.documentElement) };
    return { success: true, data: { 'JSON': JSON.stringify(result, null, 2) } };
  } catch (e) {
    return { success: false, error: 'Conversion error: ' + e.message };
  }
};

Processors.json_to_xml = function(text) {
  if (!text) return { success: false, error: 'No JSON provided' };
  try {
    const obj = JSON.parse(text);
    function toXml(o, name, indent) {
      if (typeof o !== 'object' || o === null) return indent + '<' + name + '>' + String(o).replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</' + name + '>\n';
      let xml = indent + '<' + name + '>\n';
      for (const [k, v] of Object.entries(o)) {
        if (Array.isArray(v)) v.forEach(item => { xml += toXml(item, k, indent + '  '); });
        else xml += toXml(v, k, indent + '  ');
      }
      return xml + indent + '</' + name + '>\n';
    }
    const root = Object.keys(obj)[0] || 'root';
    return { success: true, data: { 'XML': '<?xml version="1.0" encoding="UTF-8"?>\n' + toXml(obj[root] || obj, root, '') } };
  } catch (e) {
    return { success: false, error: 'Invalid JSON: ' + e.message };
  }
};

Processors.yaml_formatter = function(text) {
  if (!text) return { success: false, error: 'No YAML provided' };
  return { success: true, data: { 'YAML (formatted)': text.split('\n').map(l => l.trimEnd()).join('\n') } };
};

Processors.html_formatter = function(text) {
  if (!text) return { success: false, error: 'No HTML provided' };
  let formatted = '';
  let indent = 0;
  text.replace(/>\s*</g, '>\n<').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.match(/^<\/\w/)) indent--;
    formatted += '  '.repeat(Math.max(0, indent)) + trimmed + '\n';
    if (trimmed.match(/^<\w[^>]*[^\/]>$/)) indent++;
  });
  return { success: true, data: { 'Formatted HTML': formatted.trim() } };
};

Processors.html_minifier = function(text) {
  if (!text) return { success: false, error: 'No HTML provided' };
  return { success: true, data: { 'Minified HTML': text.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim() } };
};

Processors.css_formatter = Processors.html_formatter;
Processors.css_minifier = function(text) {
  if (!text) return { success: false, error: 'No CSS provided' };
  return { success: true, data: { 'Minified CSS': text.replace(/\s+/g, ' ').replace(/\s*([{}:;,])\s*/g, '$1').replace(/;}/g, '}').trim() } };
};

Processors.js_formatter = Processors.html_formatter;
Processors.js_minifier = function(text) {
  if (!text) return { success: false, error: 'No JavaScript provided' };
  return { success: true, data: { 'Minified JS': text.replace(/\s+/g, ' ').replace(/\s*([{}();,=])\s*/g, '$1').trim() } };
};

Processors.js_beautifier = Processors.js_formatter;

Processors.sql_formatter = function(text) {
  if (!text) return { success: false, error: 'No SQL provided' };
  const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'LIMIT', 'OFFSET', 'UNION', 'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'NOT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'];
  let result = text;
  keywords.forEach(kw => {
    result = result.replace(new RegExp('\\b' + kw + '\\b', 'gi'), '\n' + kw);
  });
  return { success: true, data: { 'Formatted SQL': result.trim() } };
};

Processors.sort_lines = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const lines = text.split('\n');
  return {
    success: true,
    data: {
      'Alphabetical': [...lines].sort().join('\n'),
      'Reverse': [...lines].sort().reverse().join('\n'),
      'By Length': [...lines].sort((a, b) => a.length - b.length).join('\n'),
    }
  };
};

Processors.deduplicate_lines = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const lines = text.split('\n');
  const unique = [...new Set(lines)];
  return { success: true, data: { 'Unique Lines': unique.join('\n'), '_info': `${lines.length} → ${unique.length} lines (${lines.length - unique.length} duplicates removed)` } };
};

// ─── CODEC/ENCODER TOOLS ────────────────────────────────────

Processors.base64_encode = Processors.text_encoder;
Processors.url_encode = Processors.text_encoder;
Processors.html_entity_encode = Processors.text_encoder;

Processors.jwt_decoder = function(text) {
  if (!text) return { success: false, error: 'No JWT token provided' };
  try {
    const parts = text.trim().split('.');
    if (parts.length < 2) return { success: false, error: 'Invalid JWT format' };
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp) payload.exp_readable = new Date(payload.exp * 1000).toISOString();
    if (payload.iat) payload.iat_readable = new Date(payload.iat * 1000).toISOString();
    return {
      success: true,
      data: {
        'Header': JSON.stringify(header, null, 2),
        'Payload': JSON.stringify(payload, null, 2),
        'Signature': parts[2] || 'N/A',
      }
    };
  } catch (e) {
    return { success: false, error: 'Invalid JWT: ' + e.message };
  }
};

// ─── COLOR TOOLS ────────────────────────────────────────────

Processors.color_converter = function(text) {
  if (!text) return { success: false, error: 'No color value provided' };
  const results = {};
  try {
    // Try HEX
    const hexMatch = text.trim().match(/^#?([0-9a-fA-F]{3,8})$/);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      results['HEX'] = '#' + hex.slice(0, 6).toUpperCase();
      results['RGB'] = `rgb(${r}, ${g}, ${b})`;
      // HSL
      const rn = r/255, gn = g/255, bn = b/255;
      const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
      let h, s, l = (max+min)/2;
      if (max === min) { h = s = 0; } else {
        const d = max - min;
        s = l > 0.5 ? d/(2-max-min) : d/(max+min);
        if (max === rn) h = ((gn-bn)/d + (gn<bn?6:0))/6;
        else if (max === gn) h = ((bn-rn)/d + 2)/6;
        else h = ((rn-gn)/d + 4)/6;
      }
      results['HSL'] = `hsl(${Math.round(h*360)}, ${Math.round(s*100)}%, ${Math.round(l*100)}%)`;
    }
  } catch (e) {}
  if (Object.keys(results).length === 0) return { success: false, error: 'Could not parse color. Use HEX (#FF0000), RGB (rgb(255,0,0)), or HSL (hsl(0,100%,50%))' };
  return { success: true, data: results };
};

// ─── GENERATOR TOOLS ────────────────────────────────────────

Processors.password_generator = function(text, opts) {
  const length = parseInt((opts && opts.length) || '16');
  const useUpper = !opts || opts.uppercase !== 'false';
  const useLower = !opts || opts.lowercase !== 'false';
  const useNumbers = !opts || opts.numbers !== 'false';
  const useSymbols = !opts && opts.symbols !== 'false';
  let chars = '';
  if (useUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (useLower) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (useNumbers) chars += '0123456789';
  if (useSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';
  const passwords = [];
  for (let p = 0; p < 5; p++) {
    let pw = '';
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    for (let i = 0; i < length; i++) pw += chars[arr[i] % chars.length];
    passwords.push(pw);
  }
  return { success: true, data: { 'Generated Passwords': passwords.join('\n') } };
};

Processors.uuid_generator = function(text, opts) {
  const count = parseInt((opts && opts.count) || '5');
  const uuids = [];
  for (let i = 0; i < count; i++) {
    uuids.push(crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }));
  }
  return { success: true, data: { 'UUIDs': uuids.join('\n') } };
};

Processors.random_password = Processors.password_generator;
Processors.uuid_v4 = Processors.uuid_generator;

Processors.random_number = function(text, opts) {
  const min = parseInt((opts && opts.min) || '1');
  const max = parseInt((opts && opts.max) || '100');
  const count = parseInt((opts && opts.count) || '10');
  const numbers = [];
  for (let i = 0; i < count; i++) numbers.push(Math.floor(Math.random() * (max - min + 1)) + min);
  return { success: true, data: { 'Random Numbers': numbers.join(', ') } };
};

Processors.random_string = function(text, opts) {
  const length = parseInt((opts && opts.length) || '16');
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const strings = [];
  for (let s = 0; s < 5; s++) {
    let str = '';
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    for (let i = 0; i < length; i++) str += chars[arr[i] % chars.length];
    strings.push(str);
  }
  return { success: true, data: { 'Random Strings': strings.join('\n') } };
};

Processors.random_color = function() {
  const hex = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  const html = `<div style="display:flex;gap:16px;align-items:center"><div style="width:80px;height:80px;border-radius:12px;background:${hex};border:2px solid var(--border)"></div><div><strong>${hex.toUpperCase()}</strong><br>rgb(${r}, ${g}, ${b})</div></div>`;
  return { success: true, data: { _html: html, HEX: hex.toUpperCase(), RGB: `rgb(${r}, ${g}, ${b})` } };
};

Processors.random_email = function() {
  const domains = ['example.com', 'test.org', 'mail.dev', 'demo.io', 'sample.net'];
  const names = ['alex','jordan','taylor','casey','morgan','riley','quinn','avery','drew','sage'];
  const emails = [];
  for (let i = 0; i < 5; i++) {
    emails.push(names[Math.floor(Math.random()*names.length)] + Math.floor(Math.random()*999) + '@' + domains[Math.floor(Math.random()*domains.length)]);
  }
  return { success: true, data: { 'Emails': emails.join('\n') } };
};

Processors.random_address = function() {
  const streets = ['123 Main St', '456 Oak Ave', '789 Pine Rd', '321 Elm Blvd', '654 Maple Dr'];
  const cities = ['Springfield', 'Franklin', 'Georgetown', 'Salem', 'Bristol'];
  const states = ['CA', 'NY', 'TX', 'FL', 'IL'];
  const zip = () => Math.floor(10000 + Math.random() * 90000);
  const addrs = streets.map((s, i) => `${s}, ${cities[i]}, ${states[i]} ${zip()}`);
  return { success: true, data: { 'Addresses': addrs.join('\n') } };
};

Processors.random_phone = function() {
  const phone = () => `(${Math.floor(200+Math.random()*800)}) ${Math.floor(200+Math.random()*800)}-${Math.floor(1000+Math.random()*9000)}`;
  return { success: true, data: { 'Phone Numbers': Array(5).fill(0).map(phone).join('\n') } };
};

Processors.random_name = Processors.name_generator;
Processors.random_boolean = function() {
  const bools = Array(10).fill(0).map(() => Math.random() > 0.5);
  return { success: true, data: { 'Random Booleans': bools.map(b => b ? 'true' : 'false').join(', ') } };
};

Processors.random_date = function() {
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return { success: true, data: { 'Random Dates': dates.join('\n') } };
};

Processors.lorem_ipsum = function(text, opts) {
  const count = parseInt((opts && opts.count) || '3');
  const type = (opts && opts.type) || 'paragraphs';
  const loremWords = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum'.split(' ');
  const genSentence = () => {
    const len = 8 + Math.floor(Math.random() * 12);
    const words = Array(len).fill(0).map(() => loremWords[Math.floor(Math.random() * loremWords.length)]);
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    return words.join(' ') + '.';
  };
  const genParagraph = () => Array(4 + Math.floor(Math.random() * 4)).fill(0).map(genSentence).join(' ');
  let result;
  if (type === 'words') result = Array(count).fill(0).map(() => loremWords[Math.floor(Math.random() * loremWords.length)]).join(' ');
  else if (type === 'sentences') result = Array(count).fill(0).map(genSentence).join(' ');
  else result = Array(count).fill(0).map(genParagraph).join('\n\n');
  return { success: true, data: { 'Lorem Ipsum': result } };
};

Processors.lorem_paragraphs = Processors.lorem_ipsum;
Processors.lorem_words = Processors.lorem_ipsum;
Processors.lorem_sentences = Processors.lorem_ipsum;

Processors.qr_code = function(text) {
  if (!text) return { success: false, error: 'No content provided' };
  const html = `<div style="text-align:center;padding:20px"><img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}" alt="QR Code" style="border-radius:8px;border:2px solid var(--border)"><p style="margin-top:8px;font-size:0.85rem;color:var(--text-secondary)">Scan this QR code</p></div>`;
  return { success: true, data: { _html: html } };
};

Processors.barcode = function(text) {
  if (!text) return { success: false, error: 'No data provided' };
  const html = `<div style="text-align:center;padding:20px"><img src="https://barcodeapi.org/api/128/${encodeURIComponent(text)}" alt="Barcode" style="border-radius:4px"><p style="margin-top:8px;font-size:0.85rem;color:var(--text-secondary)">${UI.escapeHtml(text)}</p></div>`;
  return { success: true, data: { _html: html } };
};

Processors.placeholder_image = function(text) {
  const size = (text || '300x200').match(/(\d+)\s*x\s*(\d+)/);
  const w = size ? parseInt(size[1]) : 300;
  const h = size ? parseInt(size[2]) : 200;
  const html = `<div style="text-align:center;padding:16px"><img src="https://placehold.co/${w}xh/333/fff?text=${w}x${h}" alt="Placeholder" style="border-radius:8px;max-width:100%"></div>`;
  return { success: true, data: { _html: html } };
};

Processors.random_unit = function() {
  const units = ['kg','lbs','miles','km','°C','°F','liters','gallons','feet','meters'];
  const results = [];
  for (let i = 0; i < 5; i++) {
    const unit = units[Math.floor(Math.random()*units.length)];
    const val = (Math.random() * 1000).toFixed(2);
    results.push(`${val} ${unit}`);
  }
  return { success: true, data: { 'Random Measurements': results.join('\n') } };
};

Processors.font_generator = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const styles = {
    'Bold': c => c >= 0x41 && c <= 0x5A ? String.fromCodePoint(c + 0x1D400 - 0x41) : c >= 0x61 && c <= 0x7A ? String.fromCodePoint(c + 0x1D41A - 0x61) : String.fromCodePoint(c),
    'Italic': c => c >= 0x41 && c <= 0x5A ? String.fromCodePoint(c + 0x1D434 - 0x41) : c >= 0x61 && c <= 0x7A ? String.fromCodePoint(c + 0x1D44E - 0x61) : String.fromCodePoint(c),
    'Script': c => c >= 0x41 && c <= 0x5A ? String.fromCodePoint(c + 0x1D49C - 0x41) : c >= 0x61 && c <= 0x7A ? String.fromCodePoint(c + 0x1D4B6 - 0x61) : String.fromCodePoint(c),
    'Double-Struck': c => c >= 0x41 && c <= 0x5A ? String.fromCodePoint(c + 0x1D538 - 0x41) : c >= 0x61 && c <= 0x7A ? String.fromCodePoint(c + 0x1D552 - 0x61) : String.fromCodePoint(c),
    'Fraktur': c => c >= 0x41 && c <= 0x5A ? String.fromCodePoint(c + 0x1D504 - 0x41) : c >= 0x61 && c <= 0x7A ? String.fromCodePoint(c + 0x1D51E - 0x61) : String.fromCodePoint(c),
    'Monospace': c => c >= 0x41 && c <= 0x5A ? String.fromCodePoint(c + 0x1D670 - 0x41) : c >= 0x61 && c <= 0x7A ? String.fromCodePoint(c + 0x1D68A - 0x61) : String.fromCodePoint(c),
  };
  const results = {};
  for (const [name, fn] of Object.entries(styles)) {
    results[name] = text.split('').map(c => fn(c.charCodeAt(0))).join('');
  }
  return { success: true, data: results };
};

// ─── CALCULATOR TOOLS ───────────────────────────────────────

Processors.scientific_calculator = function(text) {
  if (!text) return { success: false, error: 'No expression provided' };
  try {
    const expr = text
      .replace(/\bsin\b/g, 'Math.sin')
      .replace(/\bcos\b/g, 'Math.cos')
      .replace(/\btan\b/g, 'Math.tan')
      .replace(/\basin\b/g, 'Math.asin')
      .replace(/\bacos\b/g, 'Math.acos')
      .replace(/\batan\b/g, 'Math.atan')
      .replace(/\bsinh\b/g, 'Math.sinh')
      .replace(/\bcosh\b/g, 'Math.cosh')
      .replace(/\btanh\b/g, 'Math.tanh')
      .replace(/\blog\b/g, 'Math.log10')
      .replace(/\bln\b/g, 'Math.log')
      .replace(/\bsqrt\b/g, 'Math.sqrt')
      .replace(/\bcbrt\b/g, 'Math.cbrt')
      .replace(/\babs\b/g, 'Math.abs')
      .replace(/\bceil\b/g, 'Math.ceil')
      .replace(/\bfloor\b/g, 'Math.floor')
      .replace(/\bround\b/g, 'Math.round')
      .replace(/\bpi\b/g, 'Math.PI')
      .replace(/\be\b/g, 'Math.E')
      .replace(/\^/g, '**');
    const result = new Function('return ' + expr)();
    return { success: true, data: { 'Result': String(result), 'Expression': text } };
  } catch (e) {
    return { success: false, error: 'Invalid expression: ' + e.message };
  }
};

Processors.percentage_calculator = function(text) {
  if (!text) return { success: false, error: 'No input provided' };
  const results = {};
  // Pattern: "25% of 200"
  const m1 = text.match(/([\d.]+)%\s*of\s*([\d.]+)/i);
  if (m1) results['Result'] = (parseFloat(m1[1]) / 100 * parseFloat(m1[2])).toString();
  // Pattern: "increase from 100 to 150"
  const m2 = text.match(/from\s+([\d.]+)\s+to\s+([\d.]+)/i);
  if (m2) results['Percent Change'] = ((parseFloat(m2[2]) - parseFloat(m2[1])) / parseFloat(m2[1]) * 100).toFixed(2) + '%';
  if (Object.keys(results).length === 0) {
    // Try simple percentage calculation
    const nums = text.match(/[\d.]+/g);
    if (nums && nums.length >= 2) {
      results['X% of Y'] = (parseFloat(nums[0]) / 100 * parseFloat(nums[1])).toString();
      results['Y is what % of X'] = (parseFloat(nums[1]) / parseFloat(nums[0]) * 100).toFixed(2) + '%';
    }
  }
  if (Object.keys(results).length === 0) return { success: false, error: 'Could not parse. Try: "25% of 200" or "from 100 to 150"' };
  return { success: true, data: results };
};

Processors.tip_calculator = function(text) {
  if (!text) return { success: false, error: 'No bill amount provided' };
  const amount = parseFloat(text.replace(/[^0-9.]/g, ''));
  if (isNaN(amount)) return { success: false, error: 'Invalid amount' };
  const tips = [15, 18, 20, 25];
  const results = {};
  tips.forEach(pct => {
    results[`${pct}% Tip`] = `$${(amount * pct / 100).toFixed(2)} (Total: $${(amount + amount * pct / 100).toFixed(2)})`;
  });
  return { success: true, data: results };
};

Processors.unit_converter = function(text) {
  if (!text) return { success: false, error: 'No value provided' };
  const conversions = {
    'kg_to_lb': v => v * 2.20462, 'lb_to_kg': v => v / 2.20462,
    'km_to_mi': v => v * 0.621371, 'mi_to_km': v => v / 0.621371,
    'm_to_ft': v => v * 3.28084, 'ft_to_m': v => v / 3.28084,
    'cm_to_in': v => v * 0.393701, 'in_to_cm': v => v / 0.393701,
    'l_to_gal': v => v * 0.264172, 'gal_to_l': v => v / 0.264172,
    'c_to_f': v => v * 9/5 + 32, 'f_to_c': v => (v - 32) * 5/9,
    'mb_to_gb': v => v / 1024, 'gb_to_mb': v => v * 1024,
    'kb_to_mb': v => v / 1024, 'mb_to_kb': v => v * 1024,
  };
  const match = text.match(/([\d.]+)\s*(\w+)\s*(?:to|in)\s*(\w+)/i);
  if (!match) return { success: false, error: 'Format: "100 kg to lb" or "100 C to F"' };
  const val = parseFloat(match[1]);
  const from = match[2].toLowerCase();
  const to = match[3].toLowerCase();
  const key = from + '_to_' + to;
  if (conversions[key]) {
    return { success: true, data: { 'Result': `${val} ${match[2]} = ${conversions[key](val).toFixed(4)} ${match[3]}` } };
  }
  return { success: false, error: `Conversion ${from} to ${to} not supported. Try: kg/lb, km/mi, m/ft, cm/in, l/gal, C/F, MB/GB` };
};

Processors.temperature_converter = Processors.unit_converter;
Processors.speed_converter = Processors.unit_converter;
Processors.data_converter = Processors.unit_converter;
Processors.time_converter = Processors.unit_converter;

Processors.number_base = function(text) {
  if (!text) return { success: false, error: 'No number provided' };
  const match = text.match(/^([0-9a-fA-F]+)\s*(?:from|in)\s*(binary|octal|decimal|hex)/i);
  let num, fromBase;
  if (match) {
    num = match[1];
    fromBase = { binary: 2, octal: 8, decimal: 10, hex: 16 }[match[2].toLowerCase()];
  } else {
    num = text.trim();
    if (/^[01]+$/.test(num)) fromBase = 2;
    else if (/^0x[0-9a-fA-F]+$/i.test(num)) { num = num.slice(2); fromBase = 16; }
    else if (/^[0-9]+$/.test(num)) fromBase = 10;
    else if (/^[0-7]+$/.test(num)) fromBase = 8;
    else return { success: false, error: 'Could not determine number base' };
  }
  const dec = parseInt(num, fromBase);
  if (isNaN(dec)) return { success: false, error: 'Invalid number for base ' + fromBase };
  return {
    success: true,
    data: {
      'Binary (Base 2)': dec.toString(2),
      'Octal (Base 8)': dec.toString(8),
      'Decimal (Base 10)': dec.toString(10),
      'Hexadecimal (Base 16)': dec.toString(16).toUpperCase(),
    }
  };
};

Processors.scientific_notation = function(text) {
  if (!text) return { success: false, error: 'No number provided' };
  const num = parseFloat(text);
  if (isNaN(num)) return { success: false, error: 'Invalid number' };
  return { success: true, data: { 'Scientific Notation': num.toExponential(), 'Standard': num.toLocaleString(), 'Engineering': num.toExponential().replace(/e\+?/, e => 'e' + e) } };
};

Processors.roman_numeral = function(text) {
  if (!text) return { success: false, error: 'No value provided' };
  const romanMap = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
  const toRoman = n => { let r=''; for(const [k,v] of Object.entries(romanMap)){while(n>=v){r+=k;n-=v;}} return r; };
  const toArabic = s => { let r=0; const u=s.toUpperCase(); for(let i=0;i<u.length;i++){for(const [k,v] of Object.entries(romanMap)){if(u.substr(i,k.length)===k){r+=v;i+=k.length-1;break;}}} return r; };
  const num = parseInt(text);
  if (!isNaN(num) && num > 0 && num < 4000) return { success: true, data: { 'Roman Numeral': toRoman(num) } };
  if (/^[IVXLCDM]+$/i.test(text.trim())) return { success: true, data: { 'Arabic Number': toArabic(text) } };
  return { success: false, error: 'Enter a number (1-3999) or Roman numeral' };
};

Processors.quadratic_solver = function(text) {
  if (!text) return { success: false, error: 'Enter coefficients a, b, c' };
  const nums = text.match(/-?[\d.]+/g);
  if (!nums || nums.length < 3) return { success: false, error: 'Need 3 numbers: a, b, c for ax² + bx + c = 0' };
  const [a, b, c] = nums.map(Number);
  if (a === 0) return { success: false, error: 'a cannot be 0 (not quadratic)' };
  const disc = b*b - 4*a*c;
  const results = { 'Discriminant': String(disc) };
  if (disc > 0) {
    results['x₁'] = ((-b + Math.sqrt(disc)) / (2*a)).toString();
    results['x₂'] = ((-b - Math.sqrt(disc)) / (2*a)).toString();
  } else if (disc === 0) {
    results['x'] = (-b / (2*a)).toString() + ' (double root)';
  } else {
    results['x₁'] = `${(-b/(2*a)).toFixed(4)} + ${Math.sqrt(-disc)/(2*a).toFixed(4)}i`;
    results['x₂'] = `${(-b/(2*a)).toFixed(4)} - ${Math.sqrt(-disc)/(2*a).toFixed(4)}i`;
  }
  return { success: true, data: results };
};

Processors.age_calculator = function(text) {
  if (!text) return { success: false, error: 'Enter birth date (YYYY-MM-DD)' };
  const match = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return { success: false, error: 'Format: YYYY-MM-DD' };
  const birth = new Date(parseInt(match[1]), parseInt(match[2])-1, parseInt(match[3]));
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();
  if (days < 0) { months--; days += 30; }
  if (months < 0) { years--; months += 12; }
  const totalDays = Math.floor((now - birth) / (1000*60*60*24));
  const totalHours = totalDays * 24;
  return {
    success: true,
    data: {
      'Age': `${years} years, ${months} months, ${days} days`,
      'Total Days': String(totalDays),
      'Total Hours': String(totalHours),
      'Total Minutes': String(totalHours * 60),
    }
  };
};

Processors.bmi_calculator = function(text) {
  if (!text) return { success: false, error: 'Enter weight (kg) and height (cm)' };
  const nums = text.match(/[\d.]+/g);
  if (!nums || nums.length < 2) return { success: false, error: 'Need weight (kg) and height (cm)' };
  const weight = parseFloat(nums[0]);
  const height = parseFloat(nums[1]) / 100;
  const bmi = weight / (height * height);
  let category;
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi < 25) category = 'Normal weight';
  else if (bmi < 30) category = 'Overweight';
  else category = 'Obese';
  return { success: true, data: { 'BMI': bmi.toFixed(1), 'Category': category } };
};

Processors.calorie_calculator = function(text) {
  if (!text) return { success: false, error: 'Enter weight (kg), height (cm), age' };
  const nums = text.match(/[\d.]+/g);
  if (!nums || nums.length < 3) return { success: false, error: 'Need weight(kg), height(cm), age' };
  const [weight, height, age] = nums.map(Number);
  const bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  return {
    success: true,
    data: {
      'BMR (Basal Metabolic Rate)': `${Math.round(bmr)} calories/day`,
      'Sedentary': `${Math.round(bmr * 1.2)} calories/day`,
      'Light Exercise': `${Math.round(bmr * 1.375)} calories/day`,
      'Moderate Exercise': `${Math.round(bmr * 1.55)} calories/day`,
      'Active': `${Math.round(bmr * 1.725)} calories/day`,
    }
  };
};

Processors.date_calculator = function(text) {
  if (!text) return { success: false, error: 'Enter date and days to add/subtract' };
  const match = text.match(/(\d{4}-\d{1,2}-\d{1,2})\s*([+-])\s*(\d+)/i);
  if (!match) return { success: false, error: 'Format: YYYY-MM-DD +30 or YYYY-MM-DD -7' };
  const date = new Date(match[1]);
  const days = parseInt(match[3]) * (match[2] === '-' ? -1 : 1);
  date.setDate(date.getDate() + days);
  return { success: true, data: { 'Result Date': date.toISOString().slice(0, 10) } };
};

Processors.days_between = function(text) {
  if (!text) return { success: false, error: 'Enter two dates' };
  const dates = text.match(/\d{4}-\d{1,2}-\d{1,2}/g);
  if (!dates || dates.length < 2) return { success: false, error: 'Need two dates (YYYY-MM-DD)' };
  const d1 = new Date(dates[0]), d2 = new Date(dates[1]);
  const diff = Math.abs(d2 - d1);
  const days = Math.ceil(diff / (1000*60*60*24));
  return { success: true, data: { 'Days Between': String(days), 'Weeks': (days/7).toFixed(1), 'Months': (days/30.44).toFixed(1) } };
};

Processors.timestamp_converter = function(text) {
  if (!text) return { success: false, error: 'Enter timestamp or date' };
  const num = parseInt(text);
  if (!isNaN(num) && num > 999999999) {
    const d = new Date(num > 9999999999 ? num : num * 1000);
    return { success: true, data: { 'ISO': d.toISOString(), 'Local': d.toLocaleString(), 'UTC': d.toUTCString(), 'Unix (seconds)': String(Math.floor(d.getTime()/1000)) } };
  }
  const d = new Date(text);
  if (isNaN(d.getTime())) return { success: false, error: 'Could not parse date/timestamp' };
  return { success: true, data: { 'Unix (seconds)': String(Math.floor(d.getTime()/1000)), 'Unix (milliseconds)': String(d.getTime()), 'ISO': d.toISOString() } };
};

// ─── CRYPTO TOOLS ───────────────────────────────────────────

Processors.hash_generator = async function(text, opts) {
  if (!text) return { success: false, error: 'No text provided' };
  const algo = (opts && opts.algorithm) || 'SHA-256';
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const results = {};
  try {
    const algos = algo === 'all' ? ['SHA-1','SHA-256','SHA-512'] : [algo];
    for (const a of algos) {
      const hashBuffer = await crypto.subtle.digest(a, data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      results[a] = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch(e) {
    return { success: false, error: 'Hashing error: ' + e.message };
  }
  // CRC32
  if (algo === 'all' || algo === 'CRC32') {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < text.length; i++) {
      crc ^= text.charCodeAt(i);
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
    results['CRC32'] = ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
  }
  return { success: true, data: results };
};

Processors.md5_generator = async function(text) { return Processors.hash_generator(text, {algorithm:'SHA-256'}); };
Processors.sha1_generator = async function(text) { return Processors.hash_generator(text, {algorithm:'SHA-1'}); };
Processors.sha256_generator = async function(text) { return Processors.hash_generator(text, {algorithm:'SHA-256'}); };
Processors.sha512_generator = async function(text) { return Processors.hash_generator(text, {algorithm:'SHA-512'}); };
Processors.hmac_generator = Processors.hash_generator;

Processors.caesar_cipher = function(text, opts) {
  if (!text) return { success: false, error: 'No text provided' };
  const shift = parseInt((opts && opts.shift) || '3');
  const encode = text.split('').map(c => {
    if (/[a-zA-Z]/.test(c)) {
      const base = c <= 'Z' ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26 + 26) % 26 + base);
    }
    return c;
  }).join('');
  const decode = text.split('').map(c => {
    if (/[a-zA-Z]/.test(c)) {
      const base = c <= 'Z' ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - base - shift) % 26 + 26) % 26 + base);
    }
    return c;
  }).join('');
  return { success: true, data: { ['Encoded (shift ' + shift + ')']: encode, ['Decoded (shift ' + shift + ')']: decode } };
};

Processors.rot13 = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const result = text.replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
  return { success: true, data: { 'ROT13': result } };
};

Processors.password_strength = function(text) {
  if (!text) return { success: false, error: 'No password provided' };
  let score = 0;
  if (text.length >= 8) score++;
  if (text.length >= 12) score++;
  if (text.length >= 16) score++;
  if (/[a-z]/.test(text)) score++;
  if (/[A-Z]/.test(text)) score++;
  if (/[0-9]/.test(text)) score++;
  if (/[^a-zA-Z0-9]/.test(text)) score++;
  const uniqueChars = new Set(text).size;
  if (uniqueChars >= 8) score++;
  const labels = ['Very Weak','Weak','Fair','Good','Strong','Very Strong','Excellent','Outstanding','Maximum'];
  const entropy = Math.log2(Math.pow(uniqueChars, text.length));
  const crackTime = Math.pow(uniqueChars, text.length) / (1e10);
  return {
    success: true,
    data: {
      'Strength': labels[Math.min(score, labels.length-1)],
      'Score': `${score}/8`,
      'Length': `${text.length} characters`,
      'Unique Characters': String(uniqueChars),
      'Entropy': `${Math.round(entropy)} bits`,
    }
  };
};

Processors.binary_encoder = Processors.binary_text;
Processors.hex_encoder = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const isHex = /^[0-9a-fA-F\s]+$/.test(text.trim());
  if (isHex) {
    const decoded = text.trim().replace(/\s/g, '').match(/.{1,2}/g).map(h => String.fromCharCode(parseInt(h, 16))).join('');
    return { success: true, data: { 'Decoded': decoded } };
  }
  return { success: true, data: { 'Hex': text.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ') } };
};

Processors.unicode_converter = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const codes = text.split('').map(c => 'U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
  return { success: true, data: { 'Code Points': codes.join(' '), 'Text': text } };
};

Processors.token_generator = function(text, opts) {
  const length = parseInt((opts && opts.length) || '32');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const tokens = [];
  for (let t = 0; t < 5; t++) {
    let token = '';
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    for (let i = 0; i < length; i++) token += chars[arr[i] % chars.length];
    tokens.push(token);
  }
  return { success: true, data: { 'Tokens': tokens.join('\n') } };
};

// ─── WEB TOOLS ──────────────────────────────────────────────

Processors.url_parser = function(text) {
  if (!text) return { success: false, error: 'No URL provided' };
  try {
    const url = new URL(text.startsWith('http') ? text : 'https://' + text);
    return {
      success: true,
      data: {
        'Protocol': url.protocol,
        'Hostname': url.hostname,
        'Port': url.port || '(default)',
        'Path': url.pathname,
        'Search Params': url.search || '(none)',
        'Hash': url.hash || '(none)',
        'Origin': url.origin,
      }
    };
  } catch (e) {
    return { success: false, error: 'Invalid URL' };
  }
};

Processors.user_agent_parser = function(text) {
  if (!text) return { success: false, error: 'No user agent string provided' };
  const results = {};
  if (/chrome/i.test(text)) results['Browser'] = 'Chrome';
  else if (/firefox/i.test(text)) results['Browser'] = 'Firefox';
  else if (/safari/i.test(text)) results['Browser'] = 'Safari';
  else if (/edge/i.test(text)) results['Browser'] = 'Edge';
  else results['Browser'] = 'Unknown';
  const chromeMatch = text.match(/Chrome\/([\d.]+)/);
  if (chromeMatch) results['Version'] = chromeMatch[1];
  if (/windows/i.test(text)) results['OS'] = 'Windows';
  else if (/macintosh|mac os/i.test(text)) results['OS'] = 'macOS';
  else if (/linux/i.test(text)) results['OS'] = 'Linux';
  else if (/android/i.test(text)) results['OS'] = 'Android';
  else if (/iphone|ipad/i.test(text)) results['OS'] = 'iOS';
  if (/mobile/i.test(text)) results['Device'] = 'Mobile';
  else if (/tablet|ipad/i.test(text)) results['Device'] = 'Tablet';
  else results['Device'] = 'Desktop';
  return { success: true, data: results };
};

Processors.readability_score = function(text) {
  if (!text) return { success: false, error: 'No text provided' };
  const words = text.trim().split(/\s+/).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length || 1;
  const syllables = text.toLowerCase().split(/\s+/).reduce((sum, w) => {
    const m = w.match(/[aeiouy]+/g);
    return sum + (m ? m.length : 1);
  }, 0);
  const asl = words / sentences;
  const asw = syllables / words;
  const flesch = 206.835 - 1.015 * asl - 84.6 * asw;
  const coleman = 4.71 * (text.length / words) + 0.5 * asl - 21.43;
  const fog = 0.4 * (asl + 100 * (words > 0 ? (words - text.split(/\s+/).filter(w => w.match(/^[aeiouy]+/i) && w.length > 3).length / words) : 0));
  return {
    success: true,
    data: {
      'Flesch Reading Ease': flesch.toFixed(1) + (flesch > 80 ? ' (Easy)' : flesch > 60 ? ' (Standard)' : flesch > 40 ? ' (Difficult)' : ' (Very Difficult)'),
      'Coleman-Liau Index': coleman.toFixed(1) + ' grade level',
      'Gunning Fog Index': fog.toFixed(1) + ' grade level',
      'Words': String(words),
      'Sentences': String(sentences),
    }
  };
};

// ─── STATISTICS TOOLS ───────────────────────────────────────

Processors.mean_median_mode = function(text) {
  if (!text) return { success: false, error: 'No data provided' };
  const nums = text.match(/-?[\d.]+/g);
  if (!nums) return { success: false, error: 'No numbers found' };
  const arr = nums.map(Number).sort((a,b) => a - b);
  const mean = arr.reduce((s,v) => s+v, 0) / arr.length;
  const median = arr.length % 2 === 0 ? (arr[arr.length/2-1] + arr[arr.length/2]) / 2 : arr[Math.floor(arr.length/2)];
  const freq = {};
  arr.forEach(n => freq[n] = (freq[n]||0)+1);
  const maxFreq = Math.max(...Object.values(freq));
  const mode = Object.entries(freq).filter(([,v]) => v === maxFreq).map(([k]) => parseFloat(k));
  const range = arr[arr.length-1] - arr[0];
  const variance = arr.reduce((s,v) => s + Math.pow(v - mean, 2), 0) / arr.length;
  return {
    success: true,
    data: {
      'Mean': mean.toFixed(4),
      'Median': median.toFixed(4),
      'Mode': mode.join(', ') || 'No mode',
      'Range': range.toFixed(4),
      'Count': String(arr.length),
      'Sum': arr.reduce((s,v) => s+v, 0).toFixed(4),
      'Min': String(arr[0]),
      'Max': String(arr[arr.length-1]),
      'Variance': variance.toFixed(4),
      'Std Dev': Math.sqrt(variance).toFixed(4),
    }
  };
};

Processors.standard_deviation = Processors.mean_median_mode;
Processors.average_calculator = Processors.mean_median_mode;
Processors.percentile = Processors.mean_median_mode;
Processors.data_sorter = Processors.mean_median_mode;

Processors.probability = function(text, opts) {
  if (!text) return { success: false, error: 'Enter n and r' };
  const nums = text.match(/[\d]+/g);
  if (!nums || nums.length < 2) return { success: false, error: 'Enter n and r values' };
  const n = parseInt(nums[0]), r = parseInt(nums[1]);
  const factorial = k => k <= 1 ? 1 : k * factorial(k-1);
  const perm = factorial(n) / factorial(n-r);
  const comb = perm / factorial(r);
  return { success: true, data: { 'nPr (Permutations)': String(perm), 'nCr (Combinations)': String(comb), 'Factorial n!': String(factorial(n)) } };
};

Processors.combinatorics = Processors.probability;
Processors.gcd_lcm = function(text) {
  if (!text) return { success: false, error: 'Enter two numbers' };
  const nums = text.match(/[\d]+/g);
  if (!nums || nums.length < 2) return { success: false, error: 'Need two numbers' };
  const [a, b] = nums.map(Number);
  const gcd = (x, y) => y === 0 ? x : gcd(y, x % y);
  const g = gcd(a, b);
  return { success: true, data: { 'GCD': String(g), 'LCM': String(a * b / g) } };
};

Processors.prime_checker = function(text) {
  if (!text) return { success: false, error: 'Enter a number' };
  const n = parseInt(text);
  if (isNaN(n) || n < 2) return { success: false, error: 'Enter a number >= 2' };
  const isPrime = k => { if (k < 2) return false; for (let i = 2; i*i <= k; i++) { if (k % i === 0) return false; } return true; };
  const prime = isPrime(n);
  const factors = [];
  for (let i = 2; i*i <= n; i++) { while (n % i === 0) { factors.push(i); } }
  return { success: true, data: { 'Is Prime': prime ? '✅ Yes' : '❌ No', 'Prime Factors': factors.length ? factors.join(' × ') : 'N/A (it is prime)' } };
};

Processors.z_score = function(text) {
  if (!text) return { success: false, error: 'Enter value, mean, and standard deviation' };
  const nums = text.match(/-?[\d.]+/g);
  if (!nums || nums.length < 3) return { success: false, error: 'Need value, mean, std dev' };
  const [x, mu, sigma] = nums.map(Number);
  const z = (x - mu) / sigma;
  return { success: true, data: { 'Z-Score': z.toFixed(4), 'Percentile': (0.5 * (1 + erf(z/Math.sqrt(2))) * 100).toFixed(2) + '%' } };
};

function erf(x) {
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911;
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  return sign * (1 - ((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x));
}

Processors.data_visualization = function(text) {
  if (!text) return { success: false, error: 'No data provided' };
  const nums = text.match(/-?[\d.]+/g);
  if (!nums) return { success: false, error: 'No numbers found' };
  const arr = nums.map(Number);
  const max = Math.max(...arr);
  const barWidth = 40;
  const bars = arr.map((v, i) => {
    const len = Math.round((Math.abs(v) / max) * barWidth);
    const bar = '█'.repeat(len) + '░'.repeat(barWidth - len);
    return `${String(i+1).padStart(3)}: ${bar} ${v}`;
  });
  return { success: true, data: { 'ASCII Bar Chart': bars.join('\n') } };
};

// ─── PLACEHOLDER TOOLS ──────────────────────────────────────
// For tools that need specific implementation, provide sensible defaults

const placeholderTools = [
  'json_to_yaml','yaml_to_json','json_to_toml','toml_to_json','json_to_typescript',
  'json_to_python','json_to_go_struct','json_to_sql','csv_to_sql','xml_to_yaml',
  'yaml_to_xml','regex_to_nfa','cron_parser','timezone_converter','emoji_to_text',
  'number_to_words','words_to_number','roman_to_arabic','arabic_to_roman',
  'color_to_css','css_to_text','image_to_base64','text_to_image','font_converter',
  'svg_to_css','json_to_env','env_to_json','sql_to_json','graphql_to_rest',
  'meta_tag_generator','open_graph_generator','twitter_card_generator',
  'robots_txt_generator','sitemap_generator','structured_data','html_encoder',
  'css_selector','htaccess_generator','ssl_checker','dns_checker','whois_lookup',
  'ip_lookup','viewport_resizer','cookie_parser','http_header_viewer',
  'json_ld_viewer','redirect_checker','page_size_checker','word_count_seo',
  'json_sitemap','base64_url_embed','csp_generator','cors_generator',
  'markdown_link','html_link_embed','url_encoder_tool','query_string',
  'url_builder','color_picker','color_mixer','color_palette_gen','gradient_maker',
  'box_shadow_maker','text_shadow_maker','border_radius','transform_generator',
  'transition_generator','flexbox_playground','grid_generator','clip_path_generator',
  'animation_generator','font_pairing','aspect_ratio','image_dimensions',
  'safe_colors','material_colors','contrast_checker','icon_search','svg_path_editor',
  'png_compressor','svg_optimizer','css_cleaner','image_filter','image_to_ascii',
  'ascii_art','text_art','color_blindness','image_metadata','favicon_generator',
  'json_schema_gen','mock_data_gen','api_mock_gen','diff_viewer','cron_builder',
  'jwt_builder','color_to_tailwind','html_to_jsx','jsx_to_html','css_to_js',
  'js_to_css','html_entity_list','ascii_table_full','unicode_table',
  'regex_cheatsheet','linux_cheatsheet','git_cheatsheet','docker_cheatsheet',
  'sql_cheatsheet','python_cheatsheet','javascript_cheatsheet','react_cheatsheet',
  'css_flexbox_cheat','css_grid_cheat','http_status','error_code_ref',
  'date_format_ref','timezone_list','emoji_list','markdown_cheatsheet','w3c_validator',
  'base64_tool','url_encode_tool','html_entity_tool','hex_encode_tool',
  'binary_encode_tool','octal_encode_tool','unicode_encode','punycode_tool',
  'morse_encoder','morse_decoder','pig_latin_tool','reverse_text_tool',
  'bubble_text','fancy_text','cipher_wheel','substitution_cipher',
  'transposition_cipher','brute_force_decoder','hash_lookup','password_checker',
  'passphrase_gen','random_bytes','encoding_detector','utf8_validator',
  'idn_converter','slash_escape','character_map','base_n_converter','encoding_chains',
  'linear_regression','confidence_interval','sample_size','margin_of_error',
  'chi_square','t_test','anova','frequency_table','histogram_data',
  'outlier_detector','weighted_average','geometric_mean','harmonic_mean',
  'moving_average','word_cloud_data','css_to_scss','sql_validator',
  'python_formatter','regex_tester','regex_generator','code_obfuscator',
  'code_documenter','line_sorter','text_cleaner','text_trimmer','word_frequency',
  'acronym_generator','random_fortune','dice_roller','coin_flip',
  'password_memorable','micro_uuid','cuid_generator','nanoid_generator',
  'sequential_id','fake_user','fake_product','fake_company',
  'text_to_html','html_to_text','text_to_css','text_to_svg',
  'csv_to_markdown','markdown_to_csv','lec','sqrt','cbrt',
];

// Generic fallback for tools that don't have specific implementations
placeholderTools.forEach(slug => {
  if (!Processors[slug]) {
    Processors[slug] = function(text) {
      return { success: false, error: 'This tool is being prepared. Please try another tool.' };
    };
  }
});
