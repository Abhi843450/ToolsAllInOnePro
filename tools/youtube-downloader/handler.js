/**
 * YouTube Video Downloader — handler.js (v2)
 * Two-step flow: Analyze → Select Format → Download Job → Poll → Download
 */
window.ToolHandlers = window.ToolHandlers || {};

window.ToolHandlers['youtube-downloader'] = function(TH) {
  var url = document.getElementById('toolUrlInput')?.value?.trim();
  if (!url) { TH.showError('Please enter a YouTube URL'); return; }

  // Validate URL format
  if (!url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtube\.com\/v\/)/)) {
    TH.showError('Please enter a valid YouTube URL');
    return;
  }

  // Step 1: Analyze
  showLoading('Analyzing video...');
  fetch('/api/youtube/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url })
  })
  .then(function(r) { return r.json(); })
  .then(function(resp) {
    hideLoading();
    if (!resp.success) {
      var msg = resp.error?.message || resp.error || 'Failed to analyze video';
      TH.showError(msg);
      return;
    }
    renderVideoInfo(resp, url);
  })
  .catch(function(e) {
    hideLoading();
    TH.showError('Network error: ' + e.message);
  });
};

function showLoading(text) {
  var el = document.getElementById('loadingState');
  if (el) {
    el.classList.remove('hidden');
    var txt = el.querySelector('.loading__text');
    if (txt) txt.textContent = text || 'Processing...';
  }
}

function hideLoading() {
  var el = document.getElementById('loadingState');
  if (el) el.classList.add('hidden');
}

function renderVideoInfo(resp, originalUrl) {
  var data = resp;
  var video = data.video || {};
  var videoFormats = data.video_formats || [];
  var audioFormats = data.audio_formats || [];

  var html = '';

  // Video info card
  html += '<div class="result-item">';
  html += '<div class="yt-info">';
  if (video.thumbnail) {
    html += '<img src="' + TH.esc(video.thumbnail) + '" class="yt-thumb" onerror="this.style.display=\'none\'">';
  }
  html += '<div class="yt-info-text">';
  html += '<div class="result-label">Video</div>';
  html += '<div class="result-value yt-title">' + TH.esc(video.title || 'YouTube Video') + '</div>';
  if (video.uploader) html += '<div class="yt-channel">' + TH.esc(video.uploader) + '</div>';
  if (video.duration_string) html += '<div class="yt-duration">Duration: ' + TH.esc(video.duration_string) + '</div>';
  html += '</div></div></div>';

  // Format selection
  var totalFormats = videoFormats.length + audioFormats.length;
  if (totalFormats === 0) {
    html += '<div class="result-item" style="border-color:var(--warning);background:#fff8f0">';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<span class="material-icons-outlined" style="color:var(--warning);font-size:20px;flex-shrink:0">cloud_off</span>';
    html += '<div class="result-value" style="font-size:0.85rem">No download formats available for this video.</div>';
    html += '</div></div>';
  } else {
    html += '<div class="result-item">';
    html += '<div class="result-label">Download Options (' + totalFormats + ')</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">';

    // Video formats
    if (videoFormats.length > 0) {
      html += sectionLabel('Video (MP4)');
      videoFormats.forEach(function(fmt) {
        var size = fmt.filesize ? ' (' + formatSize(fmt.filesize) + ')' : '';
        var codec = fmt.codec ? ' • ' + fmt.codec : '';
        var fpsLabel = fmt.fps_bucket > 30 ? ' ' + fmt.fps_bucket + 'fps' : '';
        var label = fmt.quality_label + fpsLabel + codec + size;
        var icon = fmt.has_audio ? 'play_circle' : 'high_quality';
        var color = fmt.has_audio ? 'var(--primary)' : 'var(--info)';
        var meta = fmt.has_audio ? 'MP4 with audio' : 'Video only — no audio';
        html += buildFormatRow(label, meta, originalUrl, fmt.format_id,
          'video', null, null, video.title, icon, color);
      });
    }

    // Audio formats
    if (audioFormats.length > 0) {
      html += sectionLabel('Audio Only');
      audioFormats.forEach(function(fmt) {
        var size = fmt.filesize ? ' (' + formatSize(fmt.filesize) + ')' : '';
        var label = fmt.quality_label + size;
        html += buildFormatRow(label, 'Audio stream', originalUrl, fmt.format_id,
          'audio', null, null, video.title, 'headphones', 'var(--success)');
      });
    }

    // MP3 conversion options
    html += sectionLabel('Audio Conversion (MP3)');
    ['320', '192', '128'].forEach(function(bitrate) {
      var label = 'MP3 ' + bitrate + ' kbps';
      var meta = 'Transcoded from best audio source';
      html += buildFormatRow(label, meta, originalUrl, 'bestaudio',
        'audio', 'mp3', bitrate, video.title, 'music_note', 'var(--warning)');
    });

    html += '</div></div>';
  }

  // Original URL
  html += '<div class="result-item"><div class="result-label">Original URL</div>';
  html += '<div class="result-hash" style="font-size:0.85rem">' + TH.esc(originalUrl) + '</div></div>';

  TH.showResults(html);
}

function sectionLabel(text) {
  return '<div style="margin:6px 0 2px;font-size:.72rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px">' + text + '</div>';
}

function buildFormatRow(label, meta, url, formatId, outputType, audioFormat, audioBitrate, videoTitle, icon, color) {
  var filename = sanitizeFilename(videoTitle) + '_' + label.replace(/[^a-zA-Z0-9]/g, '_');
  var btnId = 'dl_' + Math.random().toString(36).substr(2, 8);

  return '<div class="yt-download-row" style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-secondary);border:2px solid var(--border);border-radius:8px">'
    + '<span class="material-icons-outlined" style="color:' + color + ';font-size:26px;flex-shrink:0">' + icon + '</span>'
    + '<div style="flex:1;min-width:0">'
    + '<div style="font-weight:600">' + TH.esc(label) + '</div>'
    + '<div style="font-size:0.8rem;color:var(--text-secondary)">' + TH.esc(meta) + '</div>'
    + '</div>'
    + '<button id="' + btnId + '" class="dl-format-btn" '
    + 'data-url="' + TH.esc(url) + '" '
    + 'data-format-id="' + TH.esc(formatId) + '" '
    + 'data-output-type="' + TH.esc(outputType) + '" '
    + 'data-audio-format="' + TH.esc(audioFormat || '') + '" '
    + 'data-audio-bitrate="' + TH.esc(audioBitrate || '') + '" '
    + 'data-video-title="' + TH.esc(videoTitle || '') + '" '
    + 'style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:var(--primary);color:#fff;border-radius:8px;flex-shrink:0;border:none;cursor:pointer">'
    + '<span class="material-icons-outlined" style="font-size:20px">save_alt</span></button>'
    + '</div>';
}

// Wire up download buttons after render
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.dl-format-btn');
  if (!btn) return;
  e.preventDefault();
  startDownload(btn);
});

function startDownload(btn) {
  var url = btn.getAttribute('data-url');
  var formatId = btn.getAttribute('data-format-id');
  var outputType = btn.getAttribute('data-output-type');
  var audioFormat = btn.getAttribute('data-audio-format') || null;
  var audioBitrate = btn.getAttribute('data-audio-bitrate') || null;
  var videoTitle = btn.getAttribute('data-video-title') || '';

  // Show loading
  showLoading('Starting download...');
  btn.disabled = true;
  btn.style.opacity = '0.5';

  // Create download job
  fetch('/api/youtube/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: url,
      format_id: formatId,
      output_type: outputType,
      audio_format: audioFormat,
      audio_bitrate: audioBitrate,
      video_title: videoTitle,
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(resp) {
    if (!resp.success) {
      hideLoading();
      btn.disabled = false;
      btn.style.opacity = '1';
      var msg = resp.error?.message || 'Download failed';
      TH.showError(msg);
      return;
    }
    // Start polling job status
    pollJob(resp.job_id, btn, videoTitle);
  })
  .catch(function(e) {
    hideLoading();
    btn.disabled = false;
    btn.style.opacity = '1';
    TH.showError('Network error: ' + e.message);
  });
}

function pollJob(jobId, btn, videoTitle) {
  var pollInterval = 1500; // 1.5s
  var maxPolls = 120; // 3 minutes max
  var polls = 0;

  function check() {
    polls++;
    if (polls > maxPolls) {
      hideLoading();
      btn.disabled = false;
      btn.style.opacity = '1';
      TH.showError('Download timed out. Please try again.');
      return;
    }

    fetch('/api/youtube/jobs/' + jobId)
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (!resp.success || !resp.job) {
          hideLoading();
          btn.disabled = false;
          btn.style.opacity = '1';
          TH.showError('Job status check failed.');
          return;
        }

        var job = resp.job;

        if (job.status === 'ready') {
          // Download complete — trigger file download
          hideLoading();
          btn.disabled = false;
          btn.style.opacity = '1';
          var fileUrl = '/api/youtube/jobs/' + jobId + '/file';
          var a = document.createElement('a');
          a.href = fileUrl;
          a.download = job.filename || 'download';
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(function() { document.body.removeChild(a); }, 1000);
          return;
        }

        if (job.status === 'failed') {
          hideLoading();
          btn.disabled = false;
          btn.style.opacity = '1';
          var errMsg = job.error_message || 'Download failed';
          TH.showError(errMsg);
          return;
        }

        // Update loading text with progress
        var statusText = job.status.charAt(0).toUpperCase() + job.status.slice(1);
        if (job.progress > 0) {
          statusText += ' (' + Math.round(job.progress) + '%)';
        }
        showLoading(statusText + '...');

        // Continue polling
        setTimeout(check, pollInterval);
      })
      .catch(function() {
        // Network error — retry once
        setTimeout(check, pollInterval * 2);
      });
  }

  check();
}

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
