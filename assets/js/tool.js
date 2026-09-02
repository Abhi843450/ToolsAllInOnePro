/**
 * Freebuff — Tool Page Logic (v3)
 * Reads tool.json config, renders custom inputs, delegates to Processors
 */
document.addEventListener('DOMContentLoaded', function() {
  const toolPage = document.querySelector('.tool-page');
  if (!toolPage) return;
  const tool = JSON.parse(toolPage.dataset.tool || '{}');

  // ═══ Tool Handler helper (TH) ═══
  window.TH = {
    showError: function(msg) {
      UI.showError(msg);
      UI.hideLoading();
      resetButton();
    },
    showResults: function(html) {
      UI.showResults(html);
      UI.hideLoading();
      resetButton();
    },
    esc: function(str) { return UI.escapeHtml(str || ''); },
  };

  const actionBtn = document.getElementById('toolActionBtn');
  const origBtnHTML = actionBtn ? actionBtn.innerHTML : '';

  function resetButton() {
    if (actionBtn) {
      actionBtn.disabled = false;
      actionBtn.innerHTML = origBtnHTML;
      actionBtn.classList.remove('btn--loading');
    }
  }

  function setBtnLoading(loading) {
    if (!actionBtn) return;
    if (loading) {
      actionBtn.disabled = true;
      actionBtn.innerHTML = '<span class="material-icons-outlined" style="animation:spin 0.6s linear infinite">sync</span> Processing...';
      actionBtn.classList.add('btn--loading');
    } else {
      resetButton();
    }
  }

  // ═══ Check if tool has a custom handler ═══
  const hasCustomHandler = window.ToolHandlers && window.ToolHandlers[tool.slug];
  if (hasCustomHandler) {
    // Custom handler — just dispatch
    actionBtn.addEventListener('click', function() {
      window.ToolHandlers[tool.slug](window.TH);
    });
    return;
  }

  // ═══ Read tool.json config for custom inputs ═══
  const config = tool.config || {};
  const inputFields = config.inputs || [];
  const processorFn = config.processor;
  const resultMode = config.result_mode || 'text'; // 'text', 'html', 'single'

  // ═══ Render custom input fields ═══
  const inputArea = document.getElementById('toolInput');
  if (inputArea && inputFields.length > 0) {
    const panel = inputArea.querySelector('.input-mode-panel');
    if (panel) {
      let fieldsHTML = '<div class="tool-custom-inputs" style="display:flex;flex-direction:column;gap:10px;width:100%">';
      inputFields.forEach(function(field) {
        fieldsHTML += renderField(field);
      });
      fieldsHTML += '</div>';
      // Insert before the existing button
      const btnWrap = panel.querySelector('.input-group') || panel;
      const existingBtn = btnWrap.querySelector('#toolActionBtn');
      if (existingBtn) {
        existingBtn.insertAdjacentHTML('beforebegin', fieldsHTML);
      } else {
        btnWrap.insertAdjacentHTML('afterbegin', fieldsHTML);
      }
    }
  }

  function renderField(field) {
    const id = 'toolInput_' + field.name;
    const label = field.label ? '<label for="' + id + '" style="font-size:0.8rem;font-weight:600;color:var(--text-secondary);margin-bottom:4px;display:block">' + UI.escapeHtml(field.label) + '</label>' : '';
    const ph = field.placeholder || '';

    if (field.type === 'textarea') {
      return label + '<textarea id="' + id + '" class="input-field" style="width:100%;min-height:' + (field.height || '120') + 'px;font-family:monospace;font-size:0.85rem;padding:10px;border:2px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);resize:vertical" placeholder="' + UI.escapeHtml(ph) + '"></textarea>';
    }

    if (field.type === 'select') {
      let opts = (field.options || []).map(function(o) {
        const val = typeof o === 'object' ? o.value : o;
        const lbl = typeof o === 'object' ? o.label : o;
        return '<option value="' + UI.escapeHtml(val) + '">' + UI.escapeHtml(lbl) + '</option>';
      }).join('');
      return label + '<select id="' + id + '" class="input-field" style="width:100%;padding:10px;border:2px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-size:0.9rem">' + opts + '</select>';
    }

    if (field.type === 'number') {
      return label + '<input type="number" id="' + id + '" class="input-field" style="width:100%;padding:10px;border:2px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-size:0.9rem" placeholder="' + UI.escapeHtml(ph) + '" value="' + (field.default || '') + '">';
    }

    if (field.type === 'checkbox') {
      return '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.9rem"><input type="checkbox" id="' + id + '" ' + (field.default ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:var(--primary)"> ' + UI.escapeHtml(field.label || '') + '</label>';
    }

    if (field.type === 'color') {
      return label + '<div style="display:flex;align-items:center;gap:10px"><input type="color" id="' + id + '" value="' + (field.default || '#333333') + '" style="width:50px;height:40px;border:2px solid var(--border);border-radius:8px;cursor:pointer;background:transparent"><input type="text" id="' + id + '_text" class="input-field" style="flex:1;padding:10px;border:2px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-size:0.9rem" placeholder="' + UI.escapeHtml(ph) + '" value="' + (field.default || '#333333') + '"></div>';
    }

    // Default: text input
    return label + '<input type="text" id="' + id + '" class="input-field" style="width:100%;padding:10px;border:2px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-size:0.9rem" placeholder="' + UI.escapeHtml(ph) + '" value="' + (field.default || '') + '">';
  }

  // ═══ Collect input values ═══
  function collectInputs() {
    const values = {};
    // Get main textarea
    const mainTA = document.getElementById('toolTextArea');
    if (mainTA) values.text = mainTA.value;
    const mainInput = document.getElementById('toolUrlInput');
    if (mainInput) values.text = mainInput.value;

    // Get custom fields
    inputFields.forEach(function(field) {
      const id = 'toolInput_' + field.name;
      const el = document.getElementById(id);
      if (el) {
        if (field.type === 'checkbox') {
          values[field.name] = el.checked ? 'true' : 'false';
        } else if (field.type === 'color') {
          values[field.name] = el.value;
          const textEl = document.getElementById(id + '_text');
          if (textEl) values[field.name] = textEl.value || el.value;
        } else {
          values[field.name] = el.value;
        }
      }
    });
    return values;
  }

  // ═══ Action handler ═══
  if (actionBtn) {
    actionBtn.addEventListener('click', async function() {
      UI.hideError();
      UI.hideResults();
      setBtnLoading(true);

      try {
        const values = collectInputs();
        const text = values.text || '';

        if (!text.trim() && inputFields.length === 0) {
          TH.showError('Please enter some text');
          return;
        }

        // Check if there's a registered processor function
        const fnName = processorFn || toProcessorName(tool.slug);
        let processor = window.Processors && window.Processors[fnName];

        if (!processor) {
          // Try generic processor
          processor = window.Processors && window.Processors[fnName];
        }

        if (processor) {
          const result = await processor(text, values);
          renderResult(result, text);
        } else {
          TH.showError('This tool is not yet available. Try another tool.');
        }
      } catch (err) {
        TH.showError(err.message || 'Something went wrong');
      }
    });
  }

  // ═══ Render result ═══
  function renderResult(result, originalText) {
    if (!result || !result.success) {
      TH.showError(result ? result.error : 'Processing failed');
      return;
    }

    const data = result.data || {};
    let html = '';

    // If _html is provided, use it directly
    if (data._html) {
      html = '<div class="result-item">' + data._html + '</div>';
      if (data._info) {
        html += '<div class="result-item" style="border-color:var(--info);background:#f0f7ff"><div class="result-value" style="font-size:0.85rem">' + UI.escapeHtml(data._info) + '</div></div>';
      }
      TH.showResults(html);
      return;
    }

    // Single result mode
    if (resultMode === 'single') {
      const key = Object.keys(data)[0] || 'Result';
      const val = data[key];
      html = '<div class="result-item"><div class="result-label">' + UI.escapeHtml(key) + '</div><pre class="result-hash" style="white-space:pre-wrap;word-break:break-all;font-size:0.85rem;max-height:500px;overflow:auto;padding:12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border)">' + UI.escapeHtml(String(val)) + '</pre></div>';
      TH.showResults(html);
      return;
    }

    // Multiple results — show each as a labeled section
    const keys = Object.keys(data).filter(k => !k.startsWith('_'));
    if (keys.length === 0) {
      TH.showResults('<div class="result-item"><div class="result-value" style="text-align:center;color:var(--text-muted)">No results</div></div>');
      return;
    }

    keys.forEach(function(key) {
      const val = data[key];
      const isLong = String(val).length > 200;
      html += '<div class="result-item">';
      html += '<div class="result-label">' + UI.escapeHtml(key) + '</div>';
      if (isLong) {
        html += '<pre class="result-hash" style="white-space:pre-wrap;word-break:break-all;font-size:0.85rem;max-height:400px;overflow:auto;padding:10px;background:var(--bg-secondary);border-radius:6px;border:1px solid var(--border)">' + UI.escapeHtml(String(val)) + '</pre>';
      } else {
        html += '<div class="result-value" style="font-size:0.9rem;word-break:break-word">' + UI.escapeHtml(String(val)) + '</div>';
      }
      // Copy button for each result
      html += '<button onclick="navigator.clipboard.writeText(this.dataset.copy).then(()=>{this.innerHTML=\'<span class=material-icons-outlined style=font-size:14px>check</span> Copied\';setTimeout(()=>{this.innerHTML=\'<span class=material-icons-outlined style=font-size:14px>content_copy</span> Copy\'},1500)})" data-copy="' + UI.escapeHtml(String(val)) + '" style="margin-top:6px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-secondary);cursor:pointer;font-size:0.75rem;display:flex;align-items:center;gap:4px"><span class="material-icons-outlined" style="font-size:14px">content_copy</span> Copy</button>';
      html += '</div>';
    });

    TH.showResults(html);
  }

  // ═══ Convert slug to processor function name ═══
  function toProcessorName(slug) {
    return slug.replace(/-([a-z])/g, function(_, c) { return c.toUpperCase(); });
  }
});
