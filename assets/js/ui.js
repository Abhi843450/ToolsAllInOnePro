/**
 * Freebuff — Shared UI Components
 * Toast notifications, copy-to-clipboard, loading states
 */

const UI = {
    /**
     * Show a toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const icons = {
            success: 'check_circle',
            error: 'error',
            info: 'info',
        };

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `
            <span class="material-icons-outlined" style="color: var(--${type === 'error' ? 'danger' : type})">${icons[type] || 'info'}</span>
            <span class="toast__text">${message}</span>
            <span class="material-icons-outlined toast__close" onclick="this.parentElement.remove()">close</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            toast.style.transition = '0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text, label = 'Copied!') {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast(label, 'success', 2000);
            return true;
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            this.showToast(label, 'success', 2000);
            return true;
        }
    },

    /**
     * Show loading spinner
     */
    showLoading() {
        const el = document.getElementById('loadingState');
        if (el) el.classList.remove('hidden');
    },

    /**
     * Hide loading spinner
     */
    hideLoading() {
        const el = document.getElementById('loadingState');
        if (el) el.classList.add('hidden');
    },

    /**
     * Show error
     */
    showError(message) {
        const el = document.getElementById('errorState');
        const text = document.getElementById('errorText');
        if (el) el.classList.remove('hidden');
        if (text) text.textContent = message;
    },

    /**
     * Hide error
     */
    hideError() {
        const el = document.getElementById('errorState');
        if (el) el.classList.add('hidden');
    },

    /**
     * Show results panel
     */
    showResults(html) {
        const panel = document.getElementById('resultsPanel');
        const body = document.getElementById('resultsBody');
        if (panel) panel.classList.remove('hidden');
        if (body) {
            body.innerHTML = html;
            // Add per-result copy buttons to each result-item
            body.querySelectorAll('.result-item').forEach(item => {
                // Skip items that already have a copy button or are header items
                if (item.querySelector('.result-copy-btn')) return;
                const valueEl = item.querySelector('.result-value, .result-hash, .result-json, .transcript-text, pre');
                if (!valueEl) return;
                const btn = document.createElement('button');
                btn.className = 'result-copy-btn';
                btn.innerHTML = '<span class="material-icons-outlined">content_copy</span> Copy';
                btn.addEventListener('click', () => {
                    const text = valueEl.textContent || valueEl.innerText || '';
                    UI.copyToClipboard(text, 'Copied to clipboard!');
                    btn.innerHTML = '<span class="material-icons-outlined">check</span> Copied';
                    setTimeout(() => { btn.innerHTML = '<span class="material-icons-outlined">content_copy</span> Copy'; }, 1500);
                });
                item.appendChild(btn);
            });
        }
        // Scroll to results
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    /**
     * Hide results
     */
    hideResults() {
        const el = document.getElementById('resultsPanel');
        if (el) el.classList.add('hidden');
    },

    /**
     * Force-download a file via server proxy (streams without loading into memory)
     * Shows spinner animation on the button until download starts.
     */
    forceDownload(url, filename, btnEl, referer) {
        // Animate button if provided
        var icon = btnEl ? btnEl.querySelector('.material-icons-outlined') : null;
        if (icon) {
            icon.textContent = 'sync';
            icon.style.animation = 'spin 0.6s linear infinite';
        }
        if (btnEl) {
            btnEl.style.opacity = '0.7';
            btnEl.style.pointerEvents = 'none';
        }

        var _showSuccess = function() {
            if (icon) { icon.style.animation = ''; icon.textContent = 'check_circle'; }
            if (btnEl) { btnEl.style.opacity = '1'; btnEl.style.background = '#2e7d32'; }
            UI.showToast('Download started!', 'success', 2000);
            setTimeout(function() {
                if (icon) icon.textContent = 'save_alt';
                if (btnEl) { btnEl.style.background = ''; btnEl.style.pointerEvents = ''; }
            }, 3000);
        };
        var _showError = function(msg) {
            if (icon) { icon.style.animation = ''; icon.textContent = 'error'; }
            if (btnEl) { btnEl.style.opacity = '1'; btnEl.style.pointerEvents = ''; }
            UI.showToast(msg || 'Download failed', 'error', 4000);
            setTimeout(function() {
                if (icon) icon.textContent = 'save_alt';
            }, 4000);
        };

        // Build the final download URL
        var dlHref;
        if (url.indexOf('/api/ytdl-download') === 0 || url.indexOf('/api/download') === 0) {
            // Already a server endpoint — use directly
            dlHref = url;
        } else {
            // Raw media URL — route through proxy
            dlHref = '/api/download?url=' + encodeURIComponent(url) + '&name=' + encodeURIComponent(filename || 'download') + (referer ? '&referer=' + encodeURIComponent(referer) : '');
        }
        // Trigger download via hidden anchor click — fastest, most reliable path
        var a = document.createElement('a');
        a.href = dlHref;
        a.download = filename || 'download';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { try { document.body.removeChild(a); } catch(e) {} }, 200);
        setTimeout(function() { _showSuccess(); }, 1000);
    },

    /**
     * Escape HTML
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    },
};
