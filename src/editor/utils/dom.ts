/**
 * Bridge AI IDE - DOM Utilities
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

export function $(selector: string): HTMLElement | null {
  return document.querySelector(selector);
}

export function $$(selector: string): NodeListOf<HTMLElement> {
  return document.querySelectorAll(selector);
}

export function on<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | null,
  event: K,
  handler: (ev: HTMLElementEventMap[K]) => void
): void {
  element?.addEventListener(event, handler);
}

export function off<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | null,
  event: K,
  handler: (ev: HTMLElementEventMap[K]) => void
): void {
  element?.removeEventListener(event, handler);
}
