/**
 * Freebuff — Tool Page Logic (v2)
 * Dispatches to per-tool handler files registered on window.ToolHandlers.
 */
document.addEventListener('DOMContentLoaded', function() {
    var toolPage = document.querySelector('.tool-page');
    if (!toolPage) return;
    var tool = JSON.parse(toolPage.dataset.tool || '{}');

    // ═══ Tool Handler helper (TH) — passed to custom handler.js files ═══
    window.TH = {
        showError: function(msg) {
            UI.showError(msg);
            UI.hideLoading();
            // Reset action button from loading state
            if (actionBtn) {
                actionBtn.disabled = false;
                actionBtn.innerHTML = origBtnHTML;
                actionBtn.classList.remove('btn--loading');
            }
        },
        showResults: function(html) {
            UI.showResults(html);
            UI.hideLoading();
            // Reset action button from loading state
            if (actionBtn) {
                actionBtn.disabled = false;
                actionBtn.innerHTML = origBtnHTML;
                actionBtn.classList.remove('btn--loading');
            }
        },
        esc: function(str) { return UI.escapeHtml(str || ''); },
        _wireForceDownloads: function() {
            document.querySelectorAll('.yt-dl-btn').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    UI.forceDownload(this.getAttribute('data-url'), this.getAttribute('data-filename'), this);
                });
            });
        }
    };
    var actionBtn = document.getElementById('toolActionBtn');
    var clearBtn = document.getElementById('clearBtn');
    var resultText = '';

    if (actionBtn) actionBtn.addEventListener('click', function() { handleAction(actionBtn.dataset.action); });
    if (clearBtn) clearBtn.addEventListener('click', function() { var ta = document.getElementById('toolTextArea'); if (ta) ta.value = ''; UI.hideResults(); UI.hideError(); });

    // Input Mode Toggle
    var currentInputMode = 'text';
    var modeToggle = document.getElementById('inputModeToggle');
    if (modeToggle) {
        currentInputMode = modeToggle.querySelector('.input-mode-toggle__btn--active')?.dataset?.mode || 'text';
        modeToggle.querySelectorAll('.input-mode-toggle__btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                modeToggle.querySelectorAll('.input-mode-toggle__btn').forEach(function(b) { b.classList.remove('input-mode-toggle__btn--active'); });
                btn.classList.add('input-mode-toggle__btn--active');
                currentInputMode = btn.dataset.mode;
                document.querySelectorAll('.input-mode-panel').forEach(function(p) {
                    p.classList.toggle('input-mode-panel--hidden', p.dataset.panel !== currentInputMode);
                });
            });
        });
    }

    // File Upload Handler
    var fileInput = document.getElementById('toolFileInput');
    var fileHint = document.getElementById('fileHint');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            if (fileInput.files.length > 0) {
                if (fileHint) fileHint.textContent = fileInput.files[0].name;
                if (modeToggle) {
                    var fileBtn = modeToggle.querySelector('[data-mode="file"]');
                    if (fileBtn && !fileBtn.classList.contains('input-mode-toggle__btn--active')) fileBtn.click();
                }
                handleAction('file_process');
            }
        });
    }

    function readFileAsText(file) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function() { resolve(reader.result); };
            reader.onerror = function() { reject(new Error('Failed to read file')); };
            reader.readAsText(file);
        });
    }
    function readFileAsDataURL(file) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function() { resolve(reader.result); };
            reader.onerror = function() { reject(new Error('Failed to read file')); };
            reader.readAsDataURL(file);
        });
    }

    function getTA(id) { return document.getElementById(id || 'toolTextArea')?.value || ''; }
    function getInput() { return document.getElementById('toolTextInput')?.value || ''; }

    // Main Action Handler
    // Save original button content for restore
    var origBtnHTML = actionBtn ? actionBtn.innerHTML : '';

    function setBtnLoading(loading) {
        if (!actionBtn) return;
        if (loading) {
            actionBtn.disabled = true;
            actionBtn.setAttribute('data-orig-html', origBtnHTML);
            actionBtn.innerHTML = '<span class="material-icons-outlined" style="animation:spin 0.6s linear infinite">sync</span> Processing...';
            actionBtn.classList.add('btn--loading');
        } else {
            actionBtn.disabled = false;
            actionBtn.innerHTML = origBtnHTML;
            actionBtn.classList.remove('btn--loading');
            actionBtn.removeAttribute('data-orig-html');
        }
    }

    async function handleAction(action) {
        UI.hideError(); UI.hideResults();
        // Only show body loading overlay for sync tools — custom handlers use button spinner
        var isCustom = window.ToolHandlers && window.ToolHandlers[tool.slug];
        if (!isCustom) UI.showLoading();
        setBtnLoading(true);
        try {
            var slug = tool.slug;

            // File upload processing
            if (action === 'file_process') {
                var file = document.getElementById('toolFileInput')?.files?.[0];
                if (!file) { UI.showError('Please select a file'); return; }
                try {
                    var text = await readFileAsText(file);

                    // Dual textarea tools
                    if (['text-diff', 'code-diff'].includes(slug)) {
                        var taL = document.getElementById('toolTextAreaLeft');
                        if (taL) { taL.value = text; }
                        handleAction('compare'); return;
                    }
                    // Find-replace
                    if (slug === 'find-replace') {
                        var ta = document.getElementById('toolTextArea');
                        if (ta) ta.value = text;
                        UI.showToast('File loaded. Enter find & replace terms.', 'info', 3000); return;
                    }
                    // Standard text handlers
                    var textHandlers = ['json-formatter','json-validator','xml-formatter','xml-validator','xml-to-json','json-to-xml','html-formatter','html-minifier','css-formatter','css-minifier','js-formatter','js-minifier','sql-formatter','word-counter','char-counter','case-converter','remove-breaks','remove-extra-spaces','remove-duplicate-lines','sort-lines','shuffle-lines','text-reverser','text-to-uppercase','text-to-lowercase','capitalize-text','add-line-numbers','text-to-binary','binary-to-text','text-to-morse','morse-to-text','ascii-to-text','unicode-converter','escape-text','sentence-counter','paragraph-counter','reading-time','base64','url-encoder','html-encoder','jwt-decoder','hash-generator','md5-generator','sha256-generator','hash-checker','uuid-validator','text-summarizer','markdown-preview','json-to-csv','csv-to-json','keyword-density','readability-score','code-converter','code-beautifier','yaml-formatter','hmac-generator','hash-compare','text-translator','html-preview','code-to-image','svg-optimizer','doc-word-count','doc-compare','text-to-pdf','html-to-pdf','markdown-to-html','markdown-to-pdf','csv-editor','csv-column-select','csv-dedup'];
                    if (textHandlers.includes(slug)) {
                        var ta = document.getElementById('toolTextArea');
                        if (ta) ta.value = text;
                        var ti = document.getElementById('toolTextInput');
                        if (ti) ti.value = text;
                        handleAction('process'); return;
                    }
                    // Image to base64
                    if (slug === 'image-to-base64') {
                        var dataUrl = await readFileAsDataURL(file);
                        resultText = dataUrl;
                        UI.showResults('<div class="result-item"><div class="result-label">Base64 Output</div><pre class="result-hash" style="word-break:break-all;white-space:pre-wrap;font-size:0.7rem">' + UI.escapeHtml(dataUrl.substring(0, 500)) + '...</pre></div><div class="result-item"><div class="result-label">Length</div><div class="result-value">' + dataUrl.length + ' characters</div></div>');
                        return;
                    }
                    // File info fallback
                    resultText = 'File: ' + file.name + '\nSize: ' + file.size + ' bytes\nType: ' + file.type;
                    UI.showResults('<div class="result-item"><div class="result-label">File: ' + UI.escapeHtml(file.name) + '</div><div class="result-value">' + file.size + ' bytes — ' + file.type + '</div></div><div class="result-item"><div class="result-label">Content Preview</div><pre class="transcript-text">' + UI.escapeHtml(text.substring(0, 2000)) + '</pre></div>');
                } catch (e) { UI.showError('File error: ' + e.message); }
                return;
            }

            // URL-based tools (only tools without custom handlers go here)
            var urlTools = ['instagram-downloader','tiktok-downloader','twitter-downloader','pinterest-downloader','facebook-downloader','reddit-downloader','vimeo-downloader','dailymotion-downloader','soundcloud-downloader','twitch-downloader','linkedin-downloader','snapchat-downloader','telegram-downloader','tumblr-downloader','web-to-pdf','scribd-downloader','slideshare-downloader','academia-downloader','medium-extractor','substack-extractor','google-docs-export','notion-exporter','yt-thumbnail','ig-profile-pic','tiktok-profile-pic','twitter-profile-pic'];
            if (urlTools.includes(slug)) {
                var url = document.getElementById('toolUrlInput')?.value?.trim();
                if (!url) { UI.showError('Please enter a URL'); return; }
                var res = await API.post('/api/extract', { slug: slug, url: url });
                handleResult(res); return;
            }

            // ═══ Dispatch to registered handler ═══
            if (window.ToolHandlers && window.ToolHandlers[slug]) {
                window.ToolHandlers[slug](window.TH);
                // Capture result text for copy button
                var rb = document.getElementById('resultsBody');
                if (rb) resultText = rb.innerText;
                // Don't reset button here — custom handler is async,
                // TH.showResults/TH.showError will restore it when done
                return;
            }

            // Fallback: placeholder for tools without handlers
            UI.showError('This tool requires a backend API server. It will work when the API is connected.');

        } catch (err) {
            UI.showError(err.message || 'Something went wrong');
            // Restore button even for custom handlers if they throw synchronously
            setBtnLoading(false);
        }
        finally {
            // For sync tools: always reset loading + button
            // For async custom handlers: only hide the loading overlay, button is managed by TH.showResults/showError
            var isCustomHandler = window.ToolHandlers && window.ToolHandlers[tool.slug];
            if (!isCustomHandler) {
                UI.hideLoading();
                setBtnLoading(false);
            } else {
                UI.hideLoading();
            }
        }
    }

    function sanitizeFilename(name) {
        return (name || 'download').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').replace(/\s+/g, '_').substring(0, 100) || 'download';
    }
    function handleResult(res) {
        if (!res.success) { TH.showError(res.error || 'Failed'); return; }
        var d = res.data; var html = '';
        var isImage = d.media_type === 'image';
        if (d.media_url) {
            var ext = isImage ? '.jpg' : '.mp4';
            // Show media preview
            if (d.media_type === 'video') {
                html += '<div class="result-item"><video src="' + UI.escapeHtml(d.media_url) + '" controls style="max-width:100%;max-height:400px;border-radius:8px;display:block;background:#000"></video></div>';
            } else {
                var imgSrc = d.thumbnail || d.media_url;
                html += '<div class="result-item"><img src="' + UI.escapeHtml(imgSrc) + '" style="max-width:300px;border-radius:8px;display:block;margin-bottom:8px"></div>';
            }
        }
        if (d.title) html += '<div class="result-item"><div class="result-label">Title</div><div class="result-value">' + UI.escapeHtml(d.title) + '</div></div>';
        if (d.author) html += '<div class="result-item"><div class="result-label">Author</div><div class="result-value">' + UI.escapeHtml(d.author) + '</div></div>';
        if (d.resolution || d.duration) { var info = ''; if (d.resolution) info += UI.escapeHtml(d.resolution); if (d.resolution && d.duration) info += ' • '; if (d.duration) info += UI.escapeHtml(d.duration); html += '<div class="result-item"><div class="result-label">Details</div><div class="result-value">' + info + '</div></div>'; }
        if (d.text) html += '<div class="result-item"><div class="result-label">Text</div><div class="result-value">' + UI.escapeHtml(d.text) + '</div></div>';
        if (d.transcript && Array.isArray(d.transcript)) { resultText = d.transcript.map(function(t) { return t.text; }).join('\n'); html += '<div class="result-item"><div class="result-label">Transcript</div><pre class="transcript-text">' + UI.escapeHtml(resultText) + '</pre></div>'; }
        if (d.media_url) {
            var dlUrl, dlReferer = '';
            if (d.use_ytdlp) {
                dlUrl = '/api/ytdl-download?url=' + encodeURIComponent(d.url) + '&slug=' + encodeURIComponent(tool.slug) + '&name=' + encodeURIComponent(d.title || 'download') + '.mp4';
            } else {
                dlUrl = d.media_url;
                dlReferer = d.url || '';
            }
            var dlExt = isImage ? '.jpg' : '.mp4';
            var safeName = sanitizeFilename(d.title || 'download') + dlExt;
            html += '<div class="result-item"><button class="yt-dl-btn result-download-btn" data-url="' + UI.escapeHtml(dlUrl) + '" data-filename="' + UI.escapeHtml(safeName) + '" data-referer="' + UI.escapeHtml(dlReferer) + '"><span class="material-icons-outlined">save_alt</span> Download ' + (isImage ? 'Image' : 'Video') + '</button></div>';
        }
        if (d.file_path) html += '<div class="result-item"><button class="yt-dl-btn result-download-btn" data-url="' + UI.escapeHtml(d.file_path) + '" data-filename="' + UI.escapeHtml(sanitizeFilename(d.title || 'file')) + '"><span class="material-icons-outlined">save_alt</span> Download File</button></div>';
        if (d.note && !d.media_url) {
            html += '<div class="result-item" style="border-color:var(--info);background:#f0f7ff">';
            html += '<div style="display:flex;align-items:start;gap:8px">';
            html += '<span class="material-icons-outlined" style="color:var(--info);font-size:20px;flex-shrink:0">info</span>';
            html += '<div class="result-value" style="font-size:0.85rem">' + UI.escapeHtml(d.note) + '</div>';
            html += '</div></div>';
        }
        TH.showResults(html || '<div class="result-item"><div class="result-value" style="text-align:center;color:var(--text-muted)">No media could be extracted from this URL. Try a different URL or use a browser extension.</div></div>');
        // Wire up force downloads
        if (window.TH && window.TH._wireForceDownloads) setTimeout(function() { window.TH._wireForceDownloads(); }, 100);
    }

    // Gradient live preview
    var gradEls = ['gradType','gradAngle','gradColor1','gradColor2','gradientPreview'].map(function(id) { return document.getElementById(id); });
    if (gradEls.every(function(el) { return el; })) {
        var updateGrad = function() { var t=gradEls[0].value,a=gradEls[1].value,c1=gradEls[2].value,c2=gradEls[3].value; gradEls[4].style.background = t==='radial'?'radial-gradient(circle,'+c1+','+c2+')':'linear-gradient('+a+'deg,'+c1+','+c2+')'; };
        gradEls.slice(0,4).forEach(function(el) { el.addEventListener('input', updateGrad); });
        updateGrad();
    }

    // Cron live preview
    var cronFields = ['cronMin','cronHour','cronDay','cronMonth','cronWeekday'];
    var cronExpr = document.getElementById('cronExpression');
    if (cronFields.every(function(id) { return document.getElementById(id); }) && cronExpr) {
        var updateCron = function() { cronExpr.textContent = cronFields.map(function(id) { return document.getElementById(id).value || '*'; }).join(' '); };
        cronFields.forEach(function(id) { document.getElementById(id).addEventListener('input', updateCron); });
    }

    // HTML live preview
    var htmlTA = document.getElementById('toolTextArea');
    var htmlFrame = document.getElementById('htmlPreviewFrame');
    if (htmlTA && htmlFrame) { var d; htmlTA.addEventListener('input', function() { clearTimeout(d); d = setTimeout(function() { var doc = htmlFrame.contentDocument; doc.open(); doc.write(htmlTA.value); doc.close(); }, 400); }); }

    // Timestamp live
    var tsCurrent = document.getElementById('timestampCurrent');
    if (tsCurrent) { var ut = function() { var n=new Date(); tsCurrent.textContent='Current: '+Math.floor(n.getTime()/1000)+' — '+n.toLocaleString(); }; ut(); setInterval(ut, 1000); }
});
