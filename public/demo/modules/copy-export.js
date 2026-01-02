// Bridge Workbench - Copy & Export Utilities
// Generate cURL commands and JavaScript fetch code

export function generateCurl(options) {
  const { url, method = 'GET', headers = {}, body = '' } = options;
  let cmd = `curl -X ${method} "${url}"`;

  for (const [key, value] of Object.entries(headers)) {
    cmd += ` \\\n  -H "${key}: ${value}"`;
  }

  if (body && method !== 'GET') {
    const escaped = body.replace(/'/g, "'\\''");
    cmd += ` \\\n  -d '${escaped}'`;
  }

  return cmd;
}

export function generateFetchCode(options) {
  const { url, method = 'GET', headers = {}, body = '' } = options;
  let code = `const response = await fetch("${url}", {\n  method: "${method}"`;

  const headerEntries = Object.entries(headers);
  if (headerEntries.length > 0) {
    code += `,\n  headers: {\n`;
    code += headerEntries.map(([k, v]) => `    "${k}": "${v}"`).join(',\n');
    code += `\n  }`;
  }

  if (body && method !== 'GET') {
    code += `,\n  body: '${body.replace(/'/g, "\\'")}'`;
  }

  code += '\n});\nconst data = await response.json();';
  return code;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

export function showCopyFeedback(button, success = true) {
  const original = button.textContent;
  button.textContent = success ? 'Copied!' : 'Failed';
  button.disabled = true;
  setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1500);
}

window.BridgeExport = { generateCurl, generateFetchCode, copyToClipboard, showCopyFeedback };
