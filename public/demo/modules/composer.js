// Bridge Workbench - Composer Pane
// Command Bar + Pipeline + Code Editor + Actions

import { renderPipeline, getGhostHeaders, detectFlowType } from './pipeline.js';
import { getFlowType } from './examples.js';

const container = document.getElementById('composer');
let currentUrl = '';
let currentMethod = 'GET';
let currentBody = '';
let activeTab = 'body';

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function renderCommandBar() {
  const bar = el('div', 'command-bar');

  const methodSelect = el('select', 'method-select');
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(m => {
    const opt = el('option', null, m);
    opt.value = m;
    if (m === currentMethod) opt.selected = true;
    methodSelect.appendChild(opt);
  });
  methodSelect.onchange = (e) => {
    currentMethod = e.target.value;
    updatePipeline();
  };
  bar.appendChild(methodSelect);

  const urlInput = el('input', 'url-input');
  urlInput.type = 'text';
  urlInput.placeholder = 'https://api.example.com/endpoint';
  urlInput.value = currentUrl;
  urlInput.id = 'urlInput';
  urlInput.oninput = (e) => {
    currentUrl = e.target.value;
    updatePipeline();
  };
  bar.appendChild(urlInput);

  const runBtn = el('button', 'btn btn-run', 'Run');
  runBtn.id = 'runBtn';
  runBtn.onclick = executeRequest;
  bar.appendChild(runBtn);

  return bar;
}

function renderEditorArea() {
  const area = el('div', 'editor-area');

  // Tabs
  const tabs = el('div', 'editor-tabs');
  ['body', 'headers'].forEach(tab => {
    const btn = el('button', 'editor-tab' + (activeTab === tab ? ' active' : ''), tab.charAt(0).toUpperCase() + tab.slice(1));
    btn.onclick = () => { activeTab = tab; render(); };
    tabs.appendChild(btn);
  });
  area.appendChild(tabs);

  // Content
  const content = el('div', 'editor-content');

  if (activeTab === 'body') {
    const textarea = el('textarea', 'body-editor');
    textarea.placeholder = '// Request body (JSON)';
    textarea.value = currentBody;
    textarea.oninput = (e) => { currentBody = e.target.value; };
    content.appendChild(textarea);
  } else if (activeTab === 'headers') {
    // Ghost headers
    const ghosts = getGhostHeaders(currentUrl);
    ghosts.forEach(gh => {
      const row = el('div', 'ghost-header');
      const lockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      lockSvg.setAttribute('class', 'lock-icon');
      lockSvg.setAttribute('viewBox', '0 0 24 24');
      lockSvg.setAttribute('fill', 'none');
      lockSvg.setAttribute('stroke', 'currentColor');
      lockSvg.setAttribute('stroke-width', '2');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '3'); rect.setAttribute('y', '11');
      rect.setAttribute('width', '18'); rect.setAttribute('height', '11'); rect.setAttribute('rx', '2');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M7 11V7a5 5 0 0 1 10 0v4');
      lockSvg.appendChild(rect);
      lockSvg.appendChild(path);
      row.appendChild(lockSvg);
      row.appendChild(el('span', 'header-name', gh.name + ':'));
      row.appendChild(el('span', 'header-value', gh.value));
      row.appendChild(el('span', 'badge', gh.isSet ? 'Auto-injected' : 'Missing'));
      if (!gh.isSet) {
        row.style.borderColor = 'var(--warning)';
        row.querySelector('.badge').style.background = '#fef7e0';
        row.querySelector('.badge').style.color = 'var(--warning)';
      }
      content.appendChild(row);
    });

    if (ghosts.length === 0) {
      content.appendChild(el('div', 'ghost-header', 'No headers will be injected for this URL'));
    }
  }

  area.appendChild(content);
  return area;
}

function renderActionBar() {
  const bar = el('div', 'action-bar');
  const copyBtn = el('button', 'btn', 'Copy cURL');
  copyBtn.onclick = copyCurl;
  bar.appendChild(copyBtn);

  const copyJsBtn = el('button', 'btn', 'Copy JS');
  copyJsBtn.onclick = copyJs;
  bar.appendChild(copyJsBtn);

  return bar;
}

let pipelineContainer = null;

function updatePipeline() {
  if (pipelineContainer) {
    const newPipeline = renderPipeline(currentUrl);
    pipelineContainer.replaceWith(newPipeline);
    pipelineContainer = newPipeline;
  }
}

async function executeRequest() {
  if (!currentUrl) return;

  const state = window.BridgeState.getState();
  const flow = detectFlowType(currentUrl);

  // Check if Google auth required
  if (flow.type === 'session' && !state.google.authenticated) {
    const runBtn = document.getElementById('runBtn');
    runBtn.classList.add('shake');
    setTimeout(() => runBtn.classList.remove('shake'), 500);
    return;
  }

  const startTime = Date.now();
  window.BridgeState.setState({ request: { loading: true, startTime } });
  document.querySelector('.command-bar')?.classList.add('loading');

  try {
    const init = { method: currentMethod, headers: {} };
    if (currentBody && currentMethod !== 'GET') {
      init.body = currentBody;
      init.headers['Content-Type'] = 'application/json';
    }

    let response;
    if (flow.type === 'session') {
      response = await window.franzai.google.fetch(currentUrl, init);
    } else {
      response = await fetch(currentUrl, init);
    }

    const duration = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('json') ? await response.json() : await response.text();

    window.BridgeState.setState({
      request: { loading: false },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body,
        duration,
        flow: flow.type
      }
    });
  } catch (err) {
    window.BridgeState.setState({
      request: { loading: false },
      response: { status: 0, statusText: 'Error', error: err.message, flow: flow.type }
    });
  }

  document.querySelector('.command-bar')?.classList.remove('loading');
}

function copyCurl() {
  let cmd = `curl -X ${currentMethod} "${currentUrl}"`;
  if (currentBody) cmd += ` -d '${currentBody}'`;
  navigator.clipboard.writeText(cmd);
}

function copyJs() {
  let code = `const response = await fetch("${currentUrl}", {\n  method: "${currentMethod}"`;
  if (currentBody) code += `,\n  body: '${currentBody}'`;
  code += '\n});';
  navigator.clipboard.writeText(code);
}

function render() {
  container.textContent = '';
  container.appendChild(renderCommandBar());
  pipelineContainer = renderPipeline(currentUrl);
  container.appendChild(pipelineContainer);
  container.appendChild(renderEditorArea());
  container.appendChild(renderActionBar());
}

// Listen for example selection
window.addEventListener('example-selected', async (e) => {
  const ex = e.detail;
  if (ex) {
    currentMethod = ex.method;
    currentBody = ex.body ? JSON.stringify(ex.body, null, 2) : '';

    // Handle {siteUrl} placeholder - show site picker
    if (ex.url.includes('{siteUrl}')) {
      const siteUrl = await showSitePicker();
      if (siteUrl) {
        currentUrl = ex.url.replace('{siteUrl}', encodeURIComponent(siteUrl));
      } else {
        currentUrl = ex.url; // Keep placeholder if cancelled
      }
    } else {
      currentUrl = ex.url;
    }
    render();
  }
});

function createSpinner() {
  const spinner = el('span', 'spinner');
  return spinner;
}

function createGlobeIcon() {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'site-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '10');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z');
  icon.appendChild(circle);
  icon.appendChild(path);
  return icon;
}

function showSitePicker() {
  return new Promise((resolve) => {
    const overlay = el('div', 'site-picker-overlay');
    const picker = el('div', 'site-picker');

    // Header
    const header = el('div', 'site-picker-header');
    const title = el('h3', null, 'Select Search Console Site');
    const closeBtn = el('button', 'site-picker-close', '×');
    closeBtn.onclick = () => { overlay.remove(); resolve(null); };
    header.appendChild(title);
    header.appendChild(closeBtn);
    picker.appendChild(header);

    // Body with loading state
    const body = el('div', 'site-picker-body');
    const loading = el('div', 'site-picker-loading');
    loading.appendChild(createSpinner());
    loading.appendChild(document.createTextNode('Loading sites...'));
    body.appendChild(loading);
    picker.appendChild(body);

    overlay.appendChild(picker);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) { overlay.remove(); resolve(null); }
    };

    // Escape to close
    const handleEscape = (e) => {
      if (e.key === 'Escape') { overlay.remove(); resolve(null); document.removeEventListener('keydown', handleEscape); }
    };
    document.addEventListener('keydown', handleEscape);

    // Fetch sites
    window.franzai.google.fetch('https://www.googleapis.com/webmasters/v3/sites')
      .then(r => r.json())
      .then(data => {
        const sites = data.siteEntry?.map(s => s.siteUrl) || [];
        body.textContent = '';

        if (sites.length === 0) {
          const errDiv = el('div', 'site-picker-error', 'No sites found in Search Console');
          body.appendChild(errDiv);
          return;
        }

        const list = el('ul', 'site-picker-list');
        sites.forEach(siteUrl => {
          const item = el('li', 'site-picker-item');
          item.appendChild(createGlobeIcon());
          item.appendChild(el('span', 'site-url', siteUrl));
          item.onclick = () => {
            document.removeEventListener('keydown', handleEscape);
            overlay.remove();
            resolve(siteUrl);
          };
          list.appendChild(item);
        });
        body.appendChild(list);
      })
      .catch(err => {
        body.textContent = '';
        const errDiv = el('div', 'site-picker-error', 'Failed to load sites: ' + err.message);
        body.appendChild(errDiv);
      });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  setTimeout(render, 0);
}

export { render, executeRequest };
