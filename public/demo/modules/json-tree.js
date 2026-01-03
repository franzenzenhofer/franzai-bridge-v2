// Bridge Workbench - JSON Tree Viewer
// Collapsible JSON display with syntax highlighting

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

export function renderJson(data, maxDepth = Infinity) {
  const container = el('div', 'json-tree');
  renderValue(data, container, 0, maxDepth);
  return container;
}

function renderValue(value, parent, depth, maxDepth) {
  if (value === null) {
    parent.appendChild(el('span', 'json-null', 'null'));
  } else if (typeof value === 'boolean') {
    parent.appendChild(el('span', 'json-boolean', String(value)));
  } else if (typeof value === 'number') {
    parent.appendChild(el('span', 'json-number', String(value)));
  } else if (typeof value === 'string') {
    const str = el('span', 'json-string', '"' + truncateString(value, 100) + '"');
    parent.appendChild(str);
  } else if (Array.isArray(value)) {
    renderArray(value, parent, depth, maxDepth);
  } else if (typeof value === 'object') {
    renderObject(value, parent, depth, maxDepth);
  }
}

function renderArray(arr, parent, depth, maxDepth) {
  if (arr.length === 0) {
    parent.appendChild(el('span', 'json-bracket', '[]'));
    return;
  }

  const collapsed = depth >= maxDepth;
  const wrapper = el('span', 'json-array');

  const toggle = el('span', 'json-toggle' + (collapsed ? ' collapsed' : ''), collapsed ? '\u25B6' : '\u25BC');
  wrapper.appendChild(toggle);
  wrapper.appendChild(el('span', 'json-bracket', '['));

  const preview = el('span', 'json-preview', ' ' + arr.length + ' items ');
  preview.style.display = collapsed ? 'inline' : 'none';
  wrapper.appendChild(preview);

  const content = el('div', 'json-content');
  content.style.display = collapsed ? 'none' : 'block';
  content.style.marginLeft = '16px';

  arr.forEach((item, i) => {
    const row = el('div', 'json-row');
    renderValue(item, row, depth + 1, maxDepth);
    if (i < arr.length - 1) row.appendChild(el('span', 'json-comma', ','));
    content.appendChild(row);
  });

  wrapper.appendChild(content);
  wrapper.appendChild(el('span', 'json-bracket json-close', ']'));
  wrapper.querySelector('.json-close').style.display = collapsed ? 'none' : 'inline';

  toggle.onclick = () => {
    const isCollapsed = toggle.classList.toggle('collapsed');
    toggle.textContent = isCollapsed ? '\u25B6' : '\u25BC';
    content.style.display = isCollapsed ? 'none' : 'block';
    preview.style.display = isCollapsed ? 'inline' : 'none';
    wrapper.querySelector('.json-close').style.display = isCollapsed ? 'none' : 'inline';
  };

  parent.appendChild(wrapper);
}

function renderObject(obj, parent, depth, maxDepth) {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    parent.appendChild(el('span', 'json-bracket', '{}'));
    return;
  }

  const collapsed = depth >= maxDepth;
  const wrapper = el('span', 'json-object');

  const toggle = el('span', 'json-toggle' + (collapsed ? ' collapsed' : ''), collapsed ? '\u25B6' : '\u25BC');
  wrapper.appendChild(toggle);
  wrapper.appendChild(el('span', 'json-bracket', '{'));

  const preview = el('span', 'json-preview', ' ' + keys.length + ' keys ');
  preview.style.display = collapsed ? 'inline' : 'none';
  wrapper.appendChild(preview);

  const content = el('div', 'json-content');
  content.style.display = collapsed ? 'none' : 'block';
  content.style.marginLeft = '16px';

  keys.forEach((key, i) => {
    const row = el('div', 'json-row');
    row.appendChild(el('span', 'json-key', '"' + key + '"'));
    row.appendChild(el('span', 'json-colon', ': '));
    renderValue(obj[key], row, depth + 1, maxDepth);
    if (i < keys.length - 1) row.appendChild(el('span', 'json-comma', ','));
    content.appendChild(row);
  });

  wrapper.appendChild(content);
  wrapper.appendChild(el('span', 'json-bracket json-close', '}'));
  wrapper.querySelector('.json-close').style.display = collapsed ? 'none' : 'inline';

  toggle.onclick = () => {
    const isCollapsed = toggle.classList.toggle('collapsed');
    toggle.textContent = isCollapsed ? '\u25B6' : '\u25BC';
    content.style.display = isCollapsed ? 'none' : 'block';
    preview.style.display = isCollapsed ? 'inline' : 'none';
    wrapper.querySelector('.json-close').style.display = isCollapsed ? 'none' : 'inline';
  };

  parent.appendChild(wrapper);
}

function truncateString(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

// Add styles
const style = document.createElement('style');
style.textContent = `
  .json-tree { font-family: var(--font-mono); font-size: 11px; line-height: 1.5; }
  .json-toggle { cursor: pointer; user-select: none; margin-right: 4px; font-size: 8px; color: var(--muted); }
  .json-key { color: #881391; }
  .json-string { color: #1a1aa6; }
  .json-number { color: #1a1aa6; }
  .json-boolean { color: #0d904f; }
  .json-null { color: var(--muted); }
  .json-bracket { color: var(--text); }
  .json-colon, .json-comma { color: var(--muted); }
  .json-preview { color: var(--muted); font-style: italic; }
  .json-row { }
`;
document.head.appendChild(style);

window.BridgeJsonTree = { renderJson };
