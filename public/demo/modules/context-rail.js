// Bridge Workbench - Context Rail
// The Vault (API Keys) + Identity Manager (Google OAuth)

import { EXAMPLES, getExampleById } from './examples.js';

const container = document.getElementById('contextRail');
let selectedId = null;

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function createSvg(paths, viewBox = '0 0 24 24') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  paths.forEach(d => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  });
  return svg;
}

function renderVault() {
  const state = window.BridgeState.getState();
  const vault = el('div', 'vault');

  const header = el('div', 'vault-header');
  const lockSvg = createSvg(['M7 11V7a5 5 0 0 1 10 0v4']);
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '3'); rect.setAttribute('y', '11');
  rect.setAttribute('width', '18'); rect.setAttribute('height', '11');
  rect.setAttribute('rx', '2');
  lockSvg.appendChild(rect);
  header.appendChild(lockSvg);
  header.appendChild(el('span', null, 'The Vault'));
  vault.appendChild(header);

  const list = el('div', 'vault-list');
  EXAMPLES.injector.forEach(ex => {
    const item = el('div', 'vault-item' + (selectedId === ex.id ? ' selected' : ''));
    const dot = el('span', 'key-dot' + (state.keys[ex.keyName] ? ' active' : ''));
    const name = el('span', 'key-name', ex.name);
    item.appendChild(dot);
    item.appendChild(name);
    item.onclick = () => selectExample(ex.id);
    list.appendChild(item);
  });
  vault.appendChild(list);
  return vault;
}

function renderCorsSection() {
  const cors = el('div', 'cors-section');

  const header = el('div', 'cors-header');
  const shieldSvg = createSvg(['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z']);
  header.appendChild(shieldSvg);
  header.appendChild(el('span', null, 'CORS Bypass'));
  cors.appendChild(header);

  const list = el('div', 'cors-list');
  EXAMPLES.cors.forEach(ex => {
    const item = el('div', 'cors-item' + (selectedId === ex.id ? ' selected' : ''));
    const method = el('span', 'method', ex.method);
    const name = el('span', 'cors-name', ex.name);
    item.appendChild(method);
    item.appendChild(name);
    item.onclick = () => selectExample(ex.id);
    list.appendChild(item);
  });
  cors.appendChild(list);
  return cors;
}

function renderIdentityManager() {
  const state = window.BridgeState.getState();
  const manager = el('div', 'identity-manager');

  const header = el('div', 'identity-header');
  const userSvg = createSvg([
    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'
  ]);
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12'); circle.setAttribute('cy', '7'); circle.setAttribute('r', '4');
  userSvg.appendChild(circle);
  header.appendChild(userSvg);
  header.appendChild(el('span', null, 'Identity'));
  manager.appendChild(header);

  const card = el('div', 'identity-card ' + (state.google.authenticated ? 'connected' : 'disconnected'));

  if (state.google.authenticated) {
    const avatar = el('div', 'identity-avatar');
    const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    checkSvg.setAttribute('width', '24'); checkSvg.setAttribute('height', '24');
    checkSvg.setAttribute('viewBox', '0 0 24 24'); checkSvg.setAttribute('fill', 'currentColor');
    const checkPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    checkPath.setAttribute('d', 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z');
    checkSvg.appendChild(checkPath);
    avatar.appendChild(checkSvg);
    card.appendChild(avatar);

    card.appendChild(el('div', 'identity-email', state.google.email || 'Connected'));

    const scopes = el('div', 'identity-scopes');
    (state.google.scopes || []).forEach(scope => {
      const name = scope.includes('webmasters') ? 'search-console' :
                   scope.includes('analytics') ? 'analytics' : scope.split('/').pop();
      scopes.appendChild(el('span', 'scope-badge granted', name));
    });
    card.appendChild(scopes);

    EXAMPLES.session.forEach(ex => {
      const item = el('div', 'cors-item' + (selectedId === ex.id ? ' selected' : ''));
      item.style.marginBottom = '4px';
      const method = el('span', 'method', ex.method);
      method.style.color = ex.method === 'POST' ? 'var(--method-post)' : 'var(--method-get)';
      const name = el('span', 'cors-name', ex.name);
      item.appendChild(method);
      item.appendChild(name);
      item.onclick = () => selectExample(ex.id);
      card.appendChild(item);
    });

    const disconnectBtn = el('button', 'disconnect-btn', 'Sign Out');
    disconnectBtn.onclick = async () => {
      await window.franzai?.google?.logout();
      await window.BridgeState.refreshGoogle();
      render();
    };
    card.appendChild(disconnectBtn);
  } else {
    const avatar = el('div', 'identity-avatar');
    const userIcon = createSvg(['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2']);
    userIcon.setAttribute('width', '24'); userIcon.setAttribute('height', '24');
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', '12'); c.setAttribute('cy', '7'); c.setAttribute('r', '4');
    userIcon.appendChild(c);
    avatar.appendChild(userIcon);
    card.appendChild(avatar);
    card.appendChild(el('div', 'identity-text', 'Not connected'));

    const connectBtn = el('button', 'connect-btn', 'Initialize Session');
    connectBtn.onclick = async () => {
      await window.franzai?.google?.auth(['webmasters.readonly']);
      await window.BridgeState.refreshGoogle();
      render();
    };
    card.appendChild(connectBtn);
  }

  manager.appendChild(card);
  return manager;
}

function selectExample(id) {
  selectedId = id;
  const example = getExampleById(id);
  window.BridgeState.setState({ selected: example });
  render();
  window.dispatchEvent(new CustomEvent('example-selected', { detail: example }));
}

function render() {
  container.textContent = '';
  container.appendChild(renderVault());
  container.appendChild(renderCorsSection());
  container.appendChild(renderIdentityManager());
}

window.BridgeState?.subscribe('context-rail', render);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  setTimeout(render, 0);
}

export { render, selectExample };
