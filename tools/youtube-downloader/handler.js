/**
 * YouTube Video Downloader — handler.js
 * Server first (yt-dlp when available), PHP fallback with helpful UX.
 */
window.ToolHandlers = window.ToolHandlers || {};
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

    // Download formats
    if (data.formats && data.formats.length > 0) {
      var directFormats = data.formats.filter(function(f) { return f.url && !f.hasCipher; });
      var cipherFormats = data.formats.filter(function(f) { return !f.url || f.hasCipher; });

      html += '<div class="result-item">';
      html += '<div class="result-label">Download Options (' + data.formats.length + ')</div>';
      html += '<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">';

      data.formats.forEach(function(fmt) {
        var isAudio = fmt.height === 0;
        var isExternal = !!fmt.hasCipher;
        var icon = isExternal ? 'open_in_new' : (isAudio ? 'headphones' : 'play_circle');
        var color = isExternal ? 'var(--info)' : (isAudio ? 'var(--warning)' : 'var(--primary)');
        var size = fmt.filesize ? ' (' + formatSize(fmt.filesize) + ')' : '';
        var ext = (fmt.ext || 'mp4').toUpperCase();
        var filename = sanitizeFilename(data.title) + '_' + fmt.label.replace(/[^a-zA-Z0-9]/g, '_') + '.' + (fmt.ext || 'mp4');

        html += '<div class="yt-download-row" style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--bg-secondary);border:2px solid var(--border);border-radius:8px;transition:all 0.15s">';
        html += '<span class="material-icons-outlined" style="color:' + color + ';font-size:28px;flex-shrink:0">' + icon + '</span>';
        html += '<div style="flex:1;min-width:0">';
        html += '<div style="font-weight:600">' + TH.esc(fmt.label) + size + '</div>';
        html += '<div style="font-size:0.8rem;color:var(--text-secondary)">' + ext + (isExternal ? ' — protected' : '') + '</div>';
        html += '</div>';

        if (fmt.url && !fmt.hasCipher) {
          html += '<a href="' + TH.esc(fmt.url) + '" download="' + TH.esc(filename) + '" target="_blank" rel="noopener" ';
          html += 'style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:var(--primary);color:var(--text-inverse);border:none;cursor:pointer;text-decoration:none;border-radius:8px;flex-shrink:0">';
          html += '<span class="material-icons-outlined" style="font-size:20px">save_alt</span></a>';
        } else {
          html += '<a href="https://www.youtube.com/watch?v=' + TH.esc(data.video_id) + '" target="_blank" rel="noopener" ';
          html += 'style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:var(--info);color:white;border:none;cursor:pointer;text-decoration:none;border-radius:8px;flex-shrink:0" title="Open in YouTube">';
          html += '<span class="material-icons-outlined" style="font-size:20px">open_in_new</span></a>';
        }
        html += '</div>';
      });
      html += '</div></div>';

      if (cipherFormats.length > 0 && directFormats.length === 0) {
        html += '<div class="result-item" style="border-color:var(--warning);background:#fff8f0">';
        html += '<div style="display:flex;align-items:start;gap:8px">';
        html += '<span class="material-icons-outlined" style="color:var(--warning);font-size:20px;flex-shrink:0">warning</span>';
        html += '<div class="result-value" style="font-size:0.85rem">This video uses protected streams. Click <strong>open_in_new</strong> to view/download on YouTube directly.</div>';
        html += '</div></div>';
      }
    } else {
      // No formats — production server without yt-dlp
      html += '<div class="result-item">';
      html += '<div class="result-label">Quick Actions</div>';
      html += '<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">';

      // Open in YouTube button
      html += '<a href="https://www.youtube.com/watch?v=' + TH.esc(data.video_id) + '" target="_blank" rel="noopener" ';
      html += 'style="display:flex;align-items:center;gap:10px;padding:14px 18px;background:#ff0000;color:white;text-decoration:none;border-radius:8px;font-weight:600">';
      html += '<span class="material-icons-outlined" style="font-size:24px">play_circle</span>';
      html += 'Watch on YouTube</a>';

      // Try cobalt.tools (free download service)
      html += '<a href="https://cobalt.tools/?url=' + encodeURIComponent(data.url) + '" target="_blank" rel="noopener" ';
      html += 'style="display:flex;align-items:center;gap:10px;padding:14px 18px;background:var(--primary);color:var(--text-inverse);text-decoration:none;border-radius:8px;font-weight:600">';
      html += '<span class="material-icons-outlined" style="font-size:24px">download</span>';
      html += 'Download via Cobalt (Free)</a>';

      html += '</div></div>';

      html += '<div class="result-item" style="border-color:var(--info);background:#f0f7ff">';
      html += '<div style="display:flex;align-items:start;gap:8px">';
      html += '<span class="material-icons-outlined" style="color:var(--info);font-size:20px;flex-shrink:0">info</span>';
      html += '<div class="result-value" style="font-size:0.85rem">Direct download links require yt-dlp on the server. Use the buttons above to watch or download via third-party services.</div>';
      html += '</div></div>';
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
