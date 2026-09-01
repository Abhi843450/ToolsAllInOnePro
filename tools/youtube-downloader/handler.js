/**
 * YouTube Video Downloader — handler.js
 * Server first (yt-dlp when available), PHP fallback with helpful UX.
 */
window.ToolHandlers = window.ToolHandlers || {};

// Wire the optional cookies upload box as soon as the page loads.
(function initCookiesBox() {
  var cookiesBox = document.getElementById('ytCookiesBox');
  if (!cookiesBox) return;

  function setCookiesStatus(text, ok) {
    var el = document.getElementById('ytCookiesStatus');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'cookies-status ' + (ok ? 'ok' : text ? 'err' : '');
  }

  function refreshCookiesStatus() {
    fetch('/api/yt-cookies/status')
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res && res.active) {
          setCookiesStatus('Cookies active' + (res.modified ? ' (since ' + res.modified + ')' : '') + ' — downloads unlocked', true);
          document.getElementById('ytCookiesRemove')?.classList?.remove('hidden');
          document.getElementById('ytCookiesToggleText').textContent = 'YouTube cookies are active — all resolutions unlocked';
        } else {
          setCookiesStatus('No cookies set — some videos may be blocked from server IPs.', false);
          document.getElementById('ytCookiesRemove')?.classList?.add('hidden');
          document.getElementById('ytCookiesToggleText').textContent = 'YouTube is blocking the server? Add your browser cookies (optional)';
        }
      })
      .catch(function() { setCookiesStatus('', false); });
  }

  var toggle = document.getElementById('ytCookiesToggle');
  var body = document.getElementById('ytCookiesBody');
  if (toggle && body) {
    toggle.addEventListener('click', function() {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      body.classList.toggle('hidden', open);
    });
  }

  var fileInput = document.getElementById('ytCookiesFile');
  var uploadBtn = document.getElementById('ytCookiesUpload');
  var removeBtn = document.getElementById('ytCookiesRemove');

  if (uploadBtn) {
    uploadBtn.addEventListener('click', function() {
      var f = fileInput && fileInput.files && fileInput.files[0];
      if (!f) { setCookiesStatus('Choose a cookies.txt file first.', false); return; }
      var fd = new FormData();
      fd.append('file', f);
      setCookiesStatus('Uploading...', false);
      fetch('/api/yt-cookies', { method: 'POST', body: fd })
        .then(function(r) { return r.json(); })
        .then(function(res) {
          if (res && res.success) {
            setCookiesStatus('Cookies saved — the next search will unlock all formats.', true);
            document.getElementById('ytCookiesRemove')?.classList?.remove('hidden');
            var t = document.getElementById('ytCookiesToggleText');
            if (t) t.textContent = 'YouTube cookies are active — all resolutions unlocked';
          } else {
            setCookiesStatus((res && res.error) || 'Upload failed.', false);
          }
        })
        .catch(function() { setCookiesStatus('Upload failed — try again.', false); });
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', function() {
      fetch('/api/yt-cookies', { method: 'DELETE' })
        .then(function() { refreshCookiesStatus(); })
        .catch(function() { refreshCookiesStatus(); });
    });
  }

  refreshCookiesStatus();
})();

window.ToolHandlers['youtube-downloader'] = function(TH) {
  var url = document.getElementById('toolUrlInput')?.value?.trim();
  if (!url) { TH.showError('Please enter a YouTube URL'); return; }

  if (!url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)/)) {
    TH.showError('Please enter a valid YouTube URL');
    return;
  }

  fetch('/api/run-tool?tool=youtube-downloader', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url })
  })
  .then(function(r) {
    if (!r.ok) throw new Error('Server returned HTTP ' + r.status);
    var ct = r.headers.get('content-type') || '';
    if (ct.indexOf('application/json') === -1) {
      throw new Error('Server returned an invalid response. Please try again in a moment.');
    }
    return r.json();
  })
  .then(function(resp) {
    if (!resp.success) { TH.showError(resp.error || 'Failed to fetch video info'); return; }

    var data = resp.data;
    var html = '';

    // Video info card
    html += '<div class="result-item">';
    html += '<div class="yt-info">';
    if (data.thumbnail) {
      html += '<img src="' + TH.esc(data.thumbnail) + '" class="yt-thumb" onerror="this.style.display=\'none\'">';
    }
    html += '<div class="yt-info-text">';
    html += '<div class="result-label">Video</div>';
    html += '<div class="result-value yt-title">' + TH.esc(data.title || 'YouTube Video') + '</div>';
    if (data.channel) html += '<div class="yt-channel">' + TH.esc(data.channel) + '</div>';
    if (data.duration) html += '<div class="yt-duration">Duration: ' + TH.esc(data.duration) + '</div>';
    html += '</div></div></div>';

    // Download formats — every quality streams through /api/download (forced download)
    if (data.formats && data.formats.length > 0) {
      var combined = data.formats.filter(function(f) { return f.stream_type === 'video'; });
      var vonly = data.formats.filter(function(f) { return f.stream_type === 'video_only'; });
      var audios = data.formats.filter(function(f) { return f.stream_type === 'audio'; });
      var mergeHeights = [];
      if (data.ffmpeg && vonly.length) {
        mergeHeights = vonly.map(function(f) { return f.height; })
          .filter(function(h, i, a) { return h && a.indexOf(h) === i; })
          .sort(function(a, b) { return b - a; });
      }

      html += '<div class="result-item">';
      html += '<div class="result-label">Download Options (' + data.formats.length + ')</div>';
      html += '<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">';

      function sectionLabel(text) {
        return '<div style="margin:6px 0 2px;font-size:.72rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px">' + TH.esc(text) + '</div>';
      }
      function buildRow(label, meta, apiPath, icon, color) {
        var filename = sanitizeFilename(data.title) + '_' + label.replace(/[^a-zA-Z0-9]/g, '_') + '.mp4';
        var href = apiPath + '&title=' + encodeURIComponent(data.title);
        return '<div class="yt-download-row" style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-secondary);border:2px solid var(--border);border-radius:8px">'
          + '<span class="material-icons-outlined" style="color:' + color + ';font-size:26px;flex-shrink:0">' + icon + '</span>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-weight:600">' + TH.esc(label) + '</div>'
          + '<div style="font-size:0.8rem;color:var(--text-secondary)">' + TH.esc(meta) + '</div>'
          + '</div>'
          + '<a href="' + TH.esc(href) + '" download="' + TH.esc(filename) + '" aria-label="Download ' + TH.esc(label) + '" '
          + 'style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:var(--primary);color:#fff;border-radius:8px;flex-shrink:0;text-decoration:none">'
          + '<span class="material-icons-outlined" style="font-size:20px">save_alt</span></a>'
          + '</div>';
      }

      if (combined.length) {
        html += sectionLabel('Video + Audio (MP4) — download right away');
        combined.forEach(function(fmt) {
          var size = fmt.filesize ? ' (' + formatSize(fmt.filesize) + ')' : '';
          html += buildRow(fmt.label + size, 'MP4 with sound — downloads as file',
            '/api/download?video_id=' + data.video_id + '&itag=' + fmt.itag, 'play_circle', 'var(--primary)');
        });
      }

      if (mergeHeights.length) {
        html += sectionLabel('High Quality (Video + Audio merged MP4)');
        mergeHeights.forEach(function(h) {
          html += buildRow(h + 'p Best Quality (Video + Audio)', 'Merged on server — H.264 + AAC MP4',
            '/api/download?video_id=' + data.video_id + '&merge=1&height=' + h, 'merge', 'var(--warning)');
        });
      }

      if (vonly.length) {
        html += sectionLabel('Video Only (very high quality, no sound)');
        vonly.forEach(function(fmt) {
          var size = fmt.filesize ? ' (' + formatSize(fmt.filesize) + ')' : '';
          html += buildRow(fmt.label + size, 'No audio — pair with an MP3 below',
            '/api/download?video_id=' + data.video_id + '&itag=' + fmt.itag, 'high_quality', 'var(--info)');
        });
      }

      if (audios.length) {
        html += sectionLabel('Audio Only');
        audios.forEach(function(fmt) {
          var size = fmt.filesize ? ' (' + formatSize(fmt.filesize) + ')' : '';
          html += buildRow(fmt.label + size, 'Music / MP3 style download',
            '/api/download?video_id=' + data.video_id + '&itag=' + fmt.itag, 'headphones', 'var(--success)');
        });
      }

      html += '</div></div>';

      if (!data.ffmpeg && vonly.length) {
        html += '<div class="result-item" style="border-color:var(--warning);background:#fff8f0">';
        html += '<div style="display:flex;align-items:start;gap:8px">';
        html += '<span class="material-icons-outlined" style="color:var(--warning);font-size:20px;flex-shrink:0">warning</span>';
        html += '<div class="result-value" style="font-size:0.85rem">1080p and higher need server-side merging (ffmpeg) to include audio. Install ffmpeg on your server to enable one-click high-quality downloads.</div>';
        html += '</div></div>';
      }
    } else {
      // No formats — show retry option
      html += '<div class="result-item" style="border-color:var(--warning);background:#fff8f0">';
      html += '<div style="display:flex;flex-direction:column;gap:10px">';
      html += '<div style="display:flex;align-items:center;gap:8px">';
      html += '<span class="material-icons-outlined" style="color:var(--warning);font-size:20px;flex-shrink:0">cloud_off</span>';
      html += '<div class="result-value" style="font-size:0.85rem;font-weight:600">Download options could not be loaded for this video.</div>';
      html += '</div>';
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      html += '<button class="btn btn--primary" id="retryBtn" style="display:flex;align-items:center;gap:6px;align-self:flex-start">';
      html += '<span class="material-icons-outlined" style="font-size:18px">refresh</span> Try Again</button>';
      html += '<a href="https://www.youtube.com/watch?v=' + TH.esc(data.video_id) + '" target="_blank" rel="noopener" style="font-size:0.85rem;color:var(--primary);text-decoration:underline;cursor:pointer">Open on YouTube instead</a>';
      html += '</div></div></div>';
    }

    // Original URL
    html += '<div class="result-item"><div class="result-label">Original URL</div>';
    html += '<div class="result-hash" style="font-size:0.85rem">' + TH.esc(data.url) + '</div></div>';

    if (data.note && data.formats && data.formats.length > 0) {
      html += '<div class="result-item" style="border-color:var(--info);background:#f0f7ff">';
      html += '<div style="display:flex;align-items:start;gap:8px">';
      html += '<span class="material-icons-outlined" style="color:var(--info);font-size:20px;flex-shrink:0">info</span>';
      html += '<div class="result-value" style="font-size:0.85rem">' + TH.esc(data.note) + '</div>';
      html += '</div></div>';
    }

    TH.showResults(html);

    setTimeout(function() {
      var retryBtn = document.getElementById('retryBtn');
      if (retryBtn) {
        retryBtn.addEventListener('click', function() {
          var url = document.getElementById('toolUrlInput')?.value?.trim();
          if (url) window.ToolHandlers['youtube-downloader'](TH);
        });
      }
    }, 100);
  })
  .catch(function(e) { TH.showError('Error: ' + e.message); });

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }

  function sanitizeFilename(name) {
    return (name || 'youtube_video').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, '_').substring(0, 80) || 'youtube_video';
  }
};
