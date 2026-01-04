/**
 * Bridge AI IDE - JSON Tree Viewer
 * Collapsible JSON display with syntax highlighting
 */

import { el } from "./dom";

export function renderJson(data: unknown, maxDepth = 2): HTMLElement {
  const container = el("div", "json-tree");
  renderValue(data, container, 0, maxDepth);
  return container;
}

function renderValue(value: unknown, parent: HTMLElement, depth: number, maxDepth: number): void {
  if (value === null) {
    parent.appendChild(el("span", "json-null", "null"));
  } else if (typeof value === "boolean") {
    parent.appendChild(el("span", "json-boolean", String(value)));
  } else if (typeof value === "number") {
    parent.appendChild(el("span", "json-number", String(value)));
  } else if (typeof value === "string") {
    parent.appendChild(el("span", "json-string", `"${truncateString(value, 100)}"`));
  } else if (Array.isArray(value)) {
    renderArray(value, parent, depth, maxDepth);
  } else if (typeof value === "object") {
    renderObject(value as Record<string, unknown>, parent, depth, maxDepth);
  }
}

function renderArray(arr: unknown[], parent: HTMLElement, depth: number, maxDepth: number): void {
  if (arr.length === 0) {
    parent.appendChild(el("span", "json-bracket", "[]"));
    return;
  }

  const collapsed = depth >= maxDepth;
  const wrapper = el("span", "json-array");

  const toggle = el("span", `json-toggle${collapsed ? " collapsed" : ""}`, collapsed ? "\u25B6" : "\u25BC");
  wrapper.appendChild(toggle);
  wrapper.appendChild(el("span", "json-bracket", "["));

  const preview = el("span", "json-preview", ` ${arr.length} items `);
  preview.style.display = collapsed ? "inline" : "none";
  wrapper.appendChild(preview);

  const content = el("div", "json-content");
  content.style.display = collapsed ? "none" : "block";
  content.style.marginLeft = "16px";

  arr.forEach((item, i) => {
    const row = el("div", "json-row");
    renderValue(item, row, depth + 1, maxDepth);
    if (i < arr.length - 1) row.appendChild(el("span", "json-comma", ","));
    content.appendChild(row);
  });

  wrapper.appendChild(content);
  const closeEl = el("span", "json-bracket json-close", "]");
  closeEl.style.display = collapsed ? "none" : "inline";
  wrapper.appendChild(closeEl);

  toggle.onclick = () => toggleCollapse(toggle, content, preview, closeEl);
  parent.appendChild(wrapper);
}

function renderObject(obj: Record<string, unknown>, parent: HTMLElement, depth: number, maxDepth: number): void {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    parent.appendChild(el("span", "json-bracket", "{}"));
    return;
  }

  const collapsed = depth >= maxDepth;
  const wrapper = el("span", "json-object");

  const toggle = el("span", `json-toggle${collapsed ? " collapsed" : ""}`, collapsed ? "\u25B6" : "\u25BC");
  wrapper.appendChild(toggle);
  wrapper.appendChild(el("span", "json-bracket", "{"));

  const preview = el("span", "json-preview", ` ${keys.length} keys `);
  preview.style.display = collapsed ? "inline" : "none";
  wrapper.appendChild(preview);

  const content = el("div", "json-content");
  content.style.display = collapsed ? "none" : "block";
  content.style.marginLeft = "16px";

  keys.forEach((key, i) => {
    const row = el("div", "json-row");
    row.appendChild(el("span", "json-key", `"${key}"`));
    row.appendChild(el("span", "json-colon", ": "));
    renderValue(obj[key], row, depth + 1, maxDepth);
    if (i < keys.length - 1) row.appendChild(el("span", "json-comma", ","));
    content.appendChild(row);
  });

  wrapper.appendChild(content);
  const closeEl = el("span", "json-bracket json-close", "}");
  closeEl.style.display = collapsed ? "none" : "inline";
  wrapper.appendChild(closeEl);

  toggle.onclick = () => toggleCollapse(toggle, content, preview, closeEl);
  parent.appendChild(wrapper);
}

function toggleCollapse(toggle: HTMLElement, content: HTMLElement, preview: HTMLElement, closeEl: HTMLElement): void {
  const isCollapsed = toggle.classList.toggle("collapsed");
  toggle.textContent = isCollapsed ? "\u25B6" : "\u25BC";
  content.style.display = isCollapsed ? "none" : "block";
  preview.style.display = isCollapsed ? "inline" : "none";
  closeEl.style.display = isCollapsed ? "none" : "inline";
}

function truncateString(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}
