// FranzAI Bridge Demo - UI Components
// Handles collapsible sections and example cards

const DemoUI = (function() {
  let requestLog = [];
  let selectedRequest = null;
  let onRequestMade = null;

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text) e.textContent = text;
    return e;
  }

  function createSection(title, id, collapsed) {
    const section = el('div', 'example-section');
    section.dataset.sectionId = id;
    const header = el('div', 'section-header');
    const arrow = el('span', 'section-arrow', collapsed ? '\u25B6' : '\u25BC');
    header.appendChild(arrow);
    header.appendChild(document.createTextNode(' ' + title));
    header.onclick = function() { toggleSection(section); };
    const content = el('div', 'section-content');
    if (collapsed) content.style.display = 'none';
    section.appendChild(header);
    section.appendChild(content);
    return { section: section, content: content };
  }

  function toggleSection(section) {
    const content = section.querySelector('.section-content');
    const arrow = section.querySelector('.section-arrow');
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';
    arrow.textContent = isHidden ? '\u25BC' : '\u25B6';
  }

  function createExampleCard(example, runCallback) {
    const card = el('div', 'example-card');
    const header = el('div', 'example-header');
    const badge = el('span', 'method-badge ' + example.method.toLowerCase(), example.method);
    const info = el('div', 'example-info');
    info.appendChild(el('div', 'example-name', example.name));
    info.appendChild(el('div', 'example-desc', example.description));
    header.appendChild(badge);
    header.appendChild(info);
    card.appendChild(header);

    const actions = el('div', 'example-actions');
    const runBtn = el('button', 'btn btn-primary btn-sm', 'Run');
    runBtn.onclick = function() { runCallback(example); };
    const codeBtn = el('button', 'btn btn-sm', 'Code');
    codeBtn.onclick = function() { toggleCode(card, example); };
    actions.appendChild(runBtn);
    actions.appendChild(codeBtn);
    card.appendChild(actions);
    return card;
  }

  function toggleCode(card, example) {
    let codeBlock = card.querySelector('.code-block');
    if (codeBlock) { codeBlock.remove(); return; }
    codeBlock = el('div', 'code-block');
    const pre = el('pre');
    pre.textContent = DemoExamples.generateCode(example);
    const copyBtn = el('button', 'btn btn-sm copy-btn', 'Copy');
    copyBtn.onclick = function() {
      navigator.clipboard.writeText(pre.textContent);
      copyBtn.textContent = 'Copied!';
      setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
    };
    codeBlock.appendChild(copyBtn);
    codeBlock.appendChild(pre);
    card.appendChild(codeBlock);
  }

  async function runExample(example) {
    const startTime = Date.now();
    const entry = {
      id: Date.now(), time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      method: example.method, url: example.url, status: 'pending', duration: 0,
      request: { headers: example.headers, body: example.body }, response: null
    };
    requestLog.unshift(entry);
    renderRequestLog();
    try {
      const init = { method: example.method, headers: example.headers || {} };
      if (!example.noBody && example.body) init.body = JSON.stringify(example.body);
      const response = await fetch(example.url, init);
      entry.status = response.status;
      entry.duration = Date.now() - startTime;
      const ct = response.headers.get('content-type') || '';
      entry.response = {
        status: response.status, statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: ct.includes('json') ? await response.json() : await response.text()
      };
    } catch (err) {
      entry.status = 'ERR';
      entry.duration = Date.now() - startTime;
      entry.response = { error: err.message };
    }
    renderRequestLog();
    if (onRequestMade) onRequestMade(entry);
  }

  function createLogRow(entry) {
    const row = el('div', 'log-item' + (selectedRequest === entry.id ? ' selected' : ''));
    row.onclick = function() { selectRequest(entry); };
    const urlObj = new URL(entry.url);
    row.appendChild(el('div', null, entry.time.split(':').slice(1).join(':')));
    row.appendChild(el('div', 'method ' + entry.method.toLowerCase(), entry.method));
    row.appendChild(el('div', null, urlObj.hostname.replace('www.', '').substring(0, 18)));
    row.appendChild(el('div', null, urlObj.pathname.substring(0, 20)));
    const statusClass = (entry.status >= 200 && entry.status < 300) ? 'status-ok' : 'status-err';
    row.appendChild(el('div', statusClass, String(entry.status)));
    row.appendChild(el('div', null, String(entry.duration)));
    return row;
  }

  function renderRequestLog() {
    const list = document.getElementById('logList');
    if (!list) return;
    list.textContent = '';
    if (requestLog.length === 0) {
      list.appendChild(el('div', 'hint', 'Run an example to see requests here'));
      return;
    }
    requestLog.slice(0, 50).forEach(function(entry) {
      list.appendChild(createLogRow(entry));
    });
  }

  function selectRequest(entry) {
    selectedRequest = entry.id;
    renderRequestLog();
    const detail = document.getElementById('detailPanel');
    if (!detail) return;
    detail.textContent = '';
    const pre = el('pre');
    pre.textContent = JSON.stringify(entry.response, null, 2);
    detail.appendChild(pre);
  }

  function init(container) {
    const ai = createSection('AI PROVIDERS', 'ai-providers', false);
    DemoExamples.aiProviders.forEach(function(ex) {
      ai.content.appendChild(createExampleCard(ex, runExample));
    });
    container.appendChild(ai.section);

    const cors = createSection('CORS BYPASS', 'cors-bypass', false);
    DemoExamples.corsExamples.forEach(function(ex) {
      cors.content.appendChild(createExampleCard(ex, runExample));
    });
    container.appendChild(cors.section);

    const adv = createSection('ADVANCED', 'advanced', true);
    DemoExamples.advancedExamples.forEach(function(ex) {
      adv.content.appendChild(createExampleCard(ex, runExample));
    });
    container.appendChild(adv.section);
  }

  return { init: init, runExample: runExample };
})();

window.DemoUI = DemoUI;
