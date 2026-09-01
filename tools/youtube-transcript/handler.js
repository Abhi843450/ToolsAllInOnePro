/**
 * YouTube Transcript — handler.js
 * Fetches transcript properly formatted with timestamps.
 * Full language selector with translation to ANY language via MyMemory API.
 */
window.ToolHandlers = window.ToolHandlers || {};
window.ToolHandlers['youtube-transcript'] = function(TH) {
  var url = document.getElementById('toolUrlInput')?.value?.trim();
  if (!url) { TH.showError('Please enter a YouTube URL'); return; }
  if (!url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)/)) {
    TH.showError('Please enter a valid YouTube URL'); return;
  }

  var videoId = extractVideoId(url);
  if (!videoId) { TH.showError('Could not extract video ID'); return; }

  window._transcriptData = null;
  window._originalTranscript = null;

  // All world languages for translation
  var ALL_LANGUAGES = [
    {code:'af',name:'Afrikaans'},{code:'sq',name:'Albanian'},{code:'am',name:'Amharic'},
    {code:'ar',name:'Arabic'},{code:'hy',name:'Armenian'},{code:'az',name:'Azerbaijani'},
    {code:'eu',name:'Basque'},{code:'be',name:'Belarusian'},{code:'bn',name:'Bengali'},
    {code:'bs',name:'Bosnian'},{code:'bg',name:'Bulgarian'},{code:'ca',name:'Catalan'},
    {code:'ceb',name:'Cebuano'},{code:'zh-CN',name:'Chinese (Simplified)'},
    {code:'zh-TW',name:'Chinese (Traditional)'},{code:'co',name:'Corsican'},
    {code:'hr',name:'Croatian'},{code:'cs',name:'Czech'},{code:'da',name:'Danish'},
    {code:'nl',name:'Dutch'},{code:'en',name:'English'},{code:'eo',name:'Esperanto'},
    {code:'et',name:'Estonian'},{code:'fi',name:'Finnish'},{code:'fr',name:'French'},
    {code:'fy',name:'Frisian'},{code:'gl',name:'Galician'},{code:'ka',name:'Georgian'},
    {code:'de',name:'German'},{code:'el',name:'Greek'},{code:'gu',name:'Gujarati'},
    {code:'ht',name:'Haitian Creole'},{code:'ha',name:'Hausa'},{code:'haw',name:'Hawaiian'},
    {code:'he',name:'Hebrew'},{code:'hi',name:'Hindi'},{code:'hmn',name:'Hmong'},
    {code:'hu',name:'Hungarian'},{code:'is',name:'Icelandic'},{code:'ig',name:'Igbo'},
    {code:'id',name:'Indonesian'},{code:'ga',name:'Irish'},{code:'it',name:'Italian'},
    {code:'ja',name:'Japanese'},{code:'jv',name:'Javanese'},{code:'kn',name:'Kannada'},
    {code:'kk',name:'Kazakh'},{code:'km',name:'Khmer'},{code:'rw',name:'Kinyarwanda'},
    {code:'ko',name:'Korean'},{code:'ku',name:'Kurdish'},{code:'ky',name:'Kyrgyz'},
    {code:'lo',name:'Lao'},{code:'la',name:'Latin'},{code:'lv',name:'Latvian'},
    {code:'lt',name:'Lithuanian'},{code:'lb',name:'Luxembourgish'},{code:'mk',name:'Macedonian'},
    {code:'mg',name:'Malagasy'},{code:'ms',name:'Malay'},{code:'ml',name:'Malayalam'},
    {code:'mt',name:'Maltese'},{code:'mi',name:'Maori'},{code:'mr',name:'Marathi'},
    {code:'mn',name:'Mongolian'},{code:'my',name:'Myanmar (Burmese)'},{code:'ne',name:'Nepali'},
    {code:'no',name:'Norwegian'},{code:'ny',name:'Chichewa'},{code:'or',name:'Odia'},
    {code:'ps',name:'Pashto'},{code:'fa',name:'Persian'},{code:'pl',name:'Polish'},
    {code:'pt',name:'Portuguese'},{code:'pa',name:'Punjabi'},{code:'ro',name:'Romanian'},
    {code:'ru',name:'Russian'},{code:'sm',name:'Samoan'},{code:'gd',name:'Scots Gaelic'},
    {code:'sr',name:'Serbian'},{code:'st',name:'Sesotho'},{code:'sn',name:'Shona'},
    {code:'sd',name:'Sindhi'},{code:'si',name:'Sinhala'},{code:'sk',name:'Slovak'},
    {code:'sl',name:'Slovenian'},{code:'so',name:'Somali'},{code:'es',name:'Spanish'},
    {code:'su',name:'Sundanese'},{code:'sw',name:'Swahili'},{code:'sv',name:'Swedish'},
    {code:'tl',name:'Tagalog'},{code:'tg',name:'Tajik'},{code:'ta',name:'Tamil'},
    {code:'tt',name:'Tatar'},{code:'te',name:'Telugu'},{code:'th',name:'Thai'},
    {code:'tr',name:'Turkish'},{code:'tk',name:'Turkmen'},{code:'uk',name:'Ukrainian'},
    {code:'ur',name:'Urdu'},{code:'ug',name:'Uyghur'},{code:'uz',name:'Uzbek'},
    {code:'vi',name:'Vietnamese'},{code:'cy',name:'Welsh'},{code:'xh',name:'Xhosa'},
    {code:'yi',name:'Yiddish'},{code:'yo',name:'Yoruba'},{code:'zu',name:'Zulu'}
  ];

  // Fetch transcript from our backend first (full-length, reliable)
  fetch('/api/run-tool?tool=youtube-transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url, lang: 'en' })
  })
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      if (resp.success && resp.data && resp.data.transcript && resp.data.transcript.length) {
        window._transcriptData = resp.data;
        window._originalTranscript = resp.data.transcript.slice(); // save copy
        renderTranscript(resp.data);
      } else {
        fetchYtTranscriptAi();
      }
    })
    .catch(function() { fetchYtTranscriptAi(); });

  function fetchYtTranscriptAi() {
    var apiUrl = 'https://youtube-transcript.ai/transcript/' + videoId + '.txt?lang=en';
    fetch(apiUrl)
      .then(function(r) {
        if (!r.ok) throw new Error('No transcript available');
        return r.text();
      })
      .then(function(mdText) {
        var result = parseTranscriptMarkdown(mdText, videoId, url);
        window._transcriptData = result;
        window._originalTranscript = result.transcript.slice(); // save copy
        renderTranscript(result);
      })
      .catch(function(e) {
        // Try oEmbed for title at least
        fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json')
          .then(function(r) { return r.json(); })
          .then(function(oe) {
            renderTranscript({
              title: oe.title || 'YouTube Video', channel: oe.author_name || '',
              video_id: videoId, thumbnail: 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg',
              transcript: [], url: url, note: 'No transcript available for this video. It may not have captions enabled.'
            });
          })
          .catch(function() { TH.showError('Failed to fetch transcript.'); });
      });
  }

  function parseTranscriptMarkdown(md, videoId, originalUrl) {
    var lines = md.split('\n');
    var title = '';
    var transcript = [];

    for (var i = 0; i < Math.min(lines.length, 10); i++) {
      var line = lines[i].trim();
      if (line.indexOf('# Transcript:') === 0) title = line.replace('# Transcript:', '').trim();
    }

    for (var j = 0; j < lines.length; j++) {
      var tl = lines[j].trim();
      // Accept [mm:ss], mm:ss, [hh:mm:ss], hh:mm:ss — every caption keeps its timestamp.
      var tsMatch = tl.match(/^\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*(.+)$/);
      if (tsMatch) {
        var hours = tsMatch[3];
        var mins = parseInt(tsMatch[1]);
        var secs = parseInt(tsMatch[2]);
        if (hours) {
          mins = mins * 60 + secs;
          secs = parseInt(tsMatch[3]);
        }
        var text = tsMatch[4].trim();
        var start = mins * 60 + secs;
        // Clean duplicate phrases within a single line only (never drop whole segments)
        text = decodeHtmlEntities(deduplicateText(text));
        if (text) {
          transcript.push({ start: start, text: text });
        }
      }
    }

    return {
      title: title || 'YouTube Video', channel: '', video_id: videoId,
      thumbnail: 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg',
      transcript: transcript, url: originalUrl, source_lang: 'en', note: null
    };
  }

  // Remove repeated phrases — the API merges multiple subtitle tracks
  function deduplicateText(text) {
    if (!text) return '';
    text = text.replace(/\[Music\]/gi, '').replace(/\[Applause\]/gi, '').replace(/\[Noise\]/gi, '').replace(/\[CHEERING\]/gi, '').trim();
    if (!text) return '';

    var words = text.split(/\s+/);
    if (words.length <= 3) return text;

    // Build clean word list by detecting repeated N-grams
    // For each position, check if next 2-10 words repeat somewhere ahead
    var used = new Array(words.length).fill(false);

    for (var i = 0; i < words.length; i++) {
      if (used[i]) continue;
      // Try phrase lengths from longest to shortest
      for (var len = Math.min(10, Math.floor((words.length - i) / 2)); len >= 2; len--) {
        var phrase = words.slice(i, i + len).join(' ');
        // Check if this exact phrase appears later
        for (var j = i + len; j <= words.length - len; j++) {
          var candidate = words.slice(j, j + len).join(' ');
          if (candidate === phrase) {
            // Mark the duplicate for removal
            for (var k = j; k < j + len; k++) used[k] = true;
          }
        }
      }
    }

    return words.filter(function(_, idx) { return !used[idx]; }).join(' ').trim();
  }

  function renderTranscript(data) {
    var html = '';
    if (data.title) {
      html += '<div class="result-item"><div class="result-label">Title</div>';
      html += '<div class="result-value">' + TH.esc(data.title) + '</div></div>';
    }
    if (data.channel) {
      html += '<div class="result-item"><div class="result-label">Channel</div>';
      html += '<div class="result-value">' + TH.esc(data.channel) + '</div></div>';
    }

    if (data.transcript && data.transcript.length > 0) {
      var transcriptText = formatTranscript(data.transcript);
      html += '<div class="result-item"><div class="result-label">Transcript (' + data.transcript.length + ' segments)</div>';
      html += '<pre class="transcript-text">' + TH.esc(transcriptText) + '</pre></div>';

      // ═══ LANGUAGE SELECTOR ═══
      html += '<div class="result-item" style="border-color:var(--primary);background:#f8f9ff">';
      html += '<div class="result-label"><span class="material-icons-outlined" style="font-size:16px;vertical-align:middle">translate</span> Translate to Any Language</div>';
      html += '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">';
      html += '<select id="translateLangSelect" style="padding:8px 12px;border:2px solid var(--border);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);font-size:0.9rem;min-width:200px;cursor:pointer;flex:1">';
      html += '<option value="">Select language...</option>';
      html += '<optgroup label="Popular">';
      ['en','hi','es','fr','de','pt','ja','ko','zh-CN','ar','ru','it','nl','tr','pl','vi','th','uk','id','ms'].forEach(function(code) {
        var lang = ALL_LANGUAGES.find(function(l) { return l.code === code; });
        if (lang) html += '<option value="' + lang.code + '">' + lang.name + '</option>';
      });
      html += '</optgroup>';
      html += '<optgroup label="All Languages">';
      ALL_LANGUAGES.sort(function(a,b) { return a.name.localeCompare(b.name); });
      ALL_LANGUAGES.forEach(function(l) {
        html += '<option value="' + l.code + '">' + l.name + '</option>';
      });
      html += '</optgroup>';
      html += '</select>';
      html += '<button class="btn btn--primary" id="translateBtn" style="white-space:nowrap">';
      html += '<span class="material-icons-outlined" style="font-size:18px">translate</span> Translate</button>';
      html += '</div></div>';
    } else if (data.note) {
      html += '<div class="result-item" style="border-color:var(--info);background:#f0f7ff">';
      html += '<div style="display:flex;align-items:start;gap:8px">';
      html += '<span class="material-icons-outlined" style="color:var(--info);font-size:20px;flex-shrink:0">info</span>';
      html += '<div class="result-value" style="font-size:0.85rem">' + TH.esc(data.note) + '</div>';
      html += '</div></div>';
    }

    html += '<div class="result-item"><div class="result-label">Original URL</div>';
    html += '<div class="result-hash" style="font-size:0.85rem">' + TH.esc(data.url) + '</div></div>';
    TH.showResults(html);

    setTimeout(function() {
      // NOTE: every result card already gets a small "Copy" button from ui.js showResults.

      // Translate button
      var translateBtn = document.getElementById('translateBtn');
      var langSelect = document.getElementById('translateLangSelect');
      if (translateBtn && langSelect) {
        translateBtn.addEventListener('click', function() {
          var targetLang = langSelect.value;
          if (!targetLang) { alert('Please select a language first.'); return; }
          if (targetLang === 'en') {
            // Reset to original English
            renderTranscript(Object.assign({}, window._transcriptData, {
              transcript: window._originalTranscript, title: window._transcriptData.title
            }));
            return;
          }

          var btn = this;
          btn.disabled = true;
          btn.innerHTML = '<span class="material-icons-outlined" style="animation:spin 0.6s linear infinite;font-size:18px">sync</span> Translating...';

          translateTranscript(window._originalTranscript, targetLang)
            .then(function(translated) {
              var langName = ALL_LANGUAGES.find(function(l) { return l.code === targetLang; });
              var displayName = langName ? langName.name : targetLang;
              renderTranscript(Object.assign({}, window._transcriptData, {
                transcript: translated,
                title: window._transcriptData.title + ' [' + displayName + ']'
              }));
            })
            .catch(function(e) {
              btn.disabled = false;
              btn.innerHTML = '<span class="material-icons-outlined" style="font-size:18px">translate</span> Translate';
              alert('Translation failed: ' + e.message);
            });
        });
      }
    }, 100);
  }

  // Translate transcript — server first, direct Google from the browser as a reliable fallback
  function translateTranscript(segments, targetLang) {
    return serverTranslate(segments, targetLang)
      .catch(function(serverErr) {
        // Server could not translate (blocked/rate-limited) — try Google straight from the browser
        var errMsg = serverErr && serverErr.message ? serverErr.message : 'Server translation unavailable';
        return browserTranslate(segments, targetLang).catch(function(browserErr) {
          throw new Error((browserErr && browserErr.message) || errMsg);
        });
      });
  }

  function serverTranslate(segments, targetLang) {
    return fetch('/api/translate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: segments.map(function(s) { return s.text; }),
        target_lang: targetLang,
        source_lang: 'en'
      })
    })
    .then(function(r) {
      if (!r.ok) throw new Error('Translation API returned ' + r.status);
      return r.json();
    })
    .then(function(resp) {
      if (!resp.success) throw new Error(resp.error || 'Translation failed');
      if (resp.data && resp.data.used_fallback) {
        throw new Error('Server used its local fallback');
      }
      return mapTranslated(segments, resp.data.translated || []);
    });
  }

  function browserTranslate(segments, targetLang) {
    var SEP = ' ||| ';
    var BATCH = 30;
    var translated = [];

    function batchRequest(texts) {
      var joined = texts.join(SEP);
      var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' +
        encodeURIComponent(targetLang) + '&dt=t&q=' + encodeURIComponent(joined);
      return fetch(url)
        .then(function(r) {
          if (!r.ok) throw new Error('Google returned ' + r.status);
          return r.json();
        })
        .then(function(d) {
          if (!d || !d[0]) throw new Error('Unexpected translation response');
          return d[0].map(function(seg) { return seg[0] || ''; }).join('').split(SEP);
        });
    }

    var batches = [];
    for (var i = 0; i < segments.length; i += BATCH) {
      batches.push(segments.slice(i, i + BATCH));
    }
    var chain = Promise.resolve();
    batches.forEach(function(batch) {
      chain = chain.then(function() {
        return batchRequest(batch.map(function(s) { return s.text; }))
          .then(function(texts) {
            batch.forEach(function(seg, j) {
              translated.push({ start: seg.start, text: decodeHtmlEntities(texts[j] || seg.text) });
            });
          });
      });
    });
    return chain.then(function() { return translated; });
  }

  function mapTranslated(segments, texts) {
    var translated = texts.map(function(text, idx) {
      return { start: segments[idx] ? segments[idx].start : 0, text: decodeHtmlEntities(String(text)) };
    }).filter(function(s) { return s.text !== undefined && s.text !== null && s.text !== ''; });
    if (!translated.length) throw new Error('No translated segments returned.');
    return translated;
  }

  function decodeHtmlEntities(text) {
    var el = document.createElement('textarea');
    el.innerHTML = text;
    return el.value;
  }

  function formatTranscript(transcript) {
    var lines = transcript.map(function(t) {
      var total = Math.floor(t.start);
      var secs = total % 60;
      var mins = Math.floor(total / 60) % 60;
      var hrs = Math.floor(total / 3600);
      var ts = (hrs > 0 ? String(hrs).padStart(2, '0') + ':' : '') +
        String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
      return '[' + ts + '] ' + t.text;
    });
    // One blank line between each timestamped caption
    return lines.join('\n\n');
  }

  function extractVideoId(url) {
    var patterns = [
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = url.match(patterns[i]);
      if (m) return m[1];
    }
    return null;
  }
};
