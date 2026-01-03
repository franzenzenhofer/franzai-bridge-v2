// Bridge Workbench - Telemetry Deck
// Response Inspector with Status, Metrics, and JSON Viewer

import { renderJson } from './json-tree.js';

const container = document.getElementById('telemetry');
let lastResponseRef = null;

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function renderEmpty() {
  const empty = el('div', 'telemetry-empty');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z');
  svg.appendChild(path);
  empty.appendChild(svg);
  empty.appendChild(el('h3', null, 'No Response Yet'));
  empty.appendChild(el('p', null, 'Run a request to see telemetry data'));
  return empty;
}

function renderResponse(response) {
  const wrapper = el('div', 'telemetry-wrapper');

  // Header with status
  const header = el('div', 'telemetry-header');

  const statusRow = el('div', 'status-row');
  const statusClass = response.status >= 200 && response.status < 300 ? 'success' :
                      response.status === 0 ? 'warning' : 'error';
  statusRow.appendChild(el('span', 'status-code ' + statusClass, String(response.status)));
  statusRow.appendChild(el('span', 'status-text', response.statusText || (response.error ? 'Error' : '')));
  statusRow.appendChild(el('span', 'status-duration', response.duration ? response.duration + 'ms' : ''));
  header.appendChild(statusRow);

  // Metrics
  const metricsRow = el('div', 'metrics-row');
  if (response.duration) {
    const bridgeTime = Math.round(response.duration * 0.1); // Estimate ~10% overhead
    const networkTime = response.duration - bridgeTime;

    const bridgeMetric = el('div', 'metric');
    bridgeMetric.appendChild(el('span', null, 'Bridge:'));
    bridgeMetric.appendChild(el('span', 'metric-value', bridgeTime + 'ms'));
    metricsRow.appendChild(bridgeMetric);

    const networkMetric = el('div', 'metric');
    networkMetric.appendChild(el('span', null, 'Network:'));
    networkMetric.appendChild(el('span', 'metric-value', networkTime + 'ms'));
    metricsRow.appendChild(networkMetric);
  }

  if (response.flow === 'cors') {
    const badge = el('span', 'cors-bypassed-badge', '\uD83C\uDF0D CORS Bypassed');
    metricsRow.appendChild(badge);
  }

  header.appendChild(metricsRow);
  wrapper.appendChild(header);

  // Injected headers section
  if (response.flow === 'injector' || response.flow === 'session') {
    const injected = el('div', 'injected-section');
    const title = el('div', 'injected-header-title');
    title.appendChild(el('span', null, '\u2713'));
    title.appendChild(el('span', null, 'INJECTED BY BRIDGE'));
    injected.appendChild(title);

    const headerName = response.flow === 'session' ? 'Authorization' : 'Authorization';
    const headerValue = response.flow === 'session' ? 'Bearer [OAuth Token]' : 'Bearer sk-***...';
    const row = el('div', 'injected-row');
    row.appendChild(el('span', 'header-name', headerName + ': '));
    row.appendChild(el('span', null, headerValue));
    injected.appendChild(row);

    wrapper.appendChild(injected);
  }

  // Response content
  const content = el('div', 'response-content');

  // Headers section
  if (response.headers && Object.keys(response.headers).length > 0) {
    const headersSection = el('div', 'response-section');
    const headersTitle = el('div', 'response-section-title');
    headersTitle.appendChild(el('span', 'arrow', '\u25BC'));
    headersTitle.appendChild(el('span', null, ' Response Headers'));
    headersSection.appendChild(headersTitle);

    const headersBody = el('div', 'response-body');
    Object.entries(response.headers).forEach(([key, value]) => {
      const row = el('div');
      row.appendChild(el('span', 'json-key', key));
      row.appendChild(el('span', null, ': '));
      row.appendChild(el('span', 'json-string', value));
      headersBody.appendChild(row);
    });
    headersSection.appendChild(headersBody);
    content.appendChild(headersSection);
  }

  // Body section
  const bodySection = el('div', 'response-section');
  const bodyTitle = el('div', 'response-section-title');
  bodyTitle.appendChild(el('span', 'arrow', '\u25BC'));
  bodyTitle.appendChild(el('span', null, ' Response Body'));
  bodySection.appendChild(bodyTitle);

  const bodyContent = el('div', 'response-body' + (response.error ? ' error-content' : ''));

  if (response.error) {
    bodyContent.textContent = response.error;
  } else if (typeof response.body === 'object') {
    bodyContent.appendChild(renderJson(response.body, 3));
  } else {
    bodyContent.textContent = String(response.body || '');
  }

  bodySection.appendChild(bodyContent);
  content.appendChild(bodySection);

  wrapper.appendChild(content);
  return wrapper;
}

function render() {
  const state = window.BridgeState?.getState();
  const prevScrollTop = container.scrollTop;
  const responseRef = state?.response || null;
  const preserveScroll = responseRef && responseRef === lastResponseRef;
  container.textContent = '';

  if (state?.response) {
    container.appendChild(renderResponse(state.response));
  } else {
    container.appendChild(renderEmpty());
  }

  if (preserveScroll) {
    container.scrollTop = prevScrollTop;
  }

  lastResponseRef = responseRef;
}

// Subscribe to state changes
window.BridgeState?.subscribe('telemetry', render);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  setTimeout(render, 0);
}

export { render };
