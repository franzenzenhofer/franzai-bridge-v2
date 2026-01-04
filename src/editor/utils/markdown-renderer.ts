/**
 * Bridge AI IDE - Markdown Renderer
 */

import { marked, type Tokens } from "marked";
import { el } from "./dom";

marked.setOptions({ breaks: true });

const renderer = new marked.Renderer();
renderer.link = (token: Tokens.Link) => {
  const safeHref = token.href ?? "";
  const text = token.text ?? safeHref;
  return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${text}</a>`;
};

export function renderMarkdown(content: string): HTMLElement {
  const container = el("div", "markdown");
  container.innerHTML = marked.parse(content, { renderer }) as string;

  const blocks = Array.from(container.querySelectorAll("pre"));
  for (const pre of blocks) {
    const wrapper = el("div", "code-block-wrapper");
    const copyBtn = el("button", "code-copy-btn", "Copy");

    copyBtn.onclick = () => {
      const text = pre.textContent ?? "";
      copyToClipboard(text, copyBtn);
    };

    const parent = pre.parentElement;
    if (parent) {
      parent.insertBefore(wrapper, pre);
      wrapper.appendChild(copyBtn);
      wrapper.appendChild(pre);
    }
  }

  return container;
}

function copyToClipboard(text: string, button: HTMLElement): void {
  if (!text.trim()) return;
  const restore = () => {
    button.textContent = "Copy";
    button.classList.remove("copied");
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      button.textContent = "Copied";
      button.classList.add("copied");
      window.setTimeout(restore, 1500);
    }).catch(restore);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    button.textContent = "Copied";
    button.classList.add("copied");
    window.setTimeout(restore, 1500);
  } finally {
    document.body.removeChild(textarea);
  }
}
