export function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function highlightJson(json: string): string {
  const escaped = escapeHtml(json);
  return escaped
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) =>
      `<span class="json-string">"${content}"</span>`)
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="json-number">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="json-bool">$1</span>');
}
