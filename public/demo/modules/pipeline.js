// Bridge Workbench - Pipeline Visualizer
// Shows the request flow: Browser -> [Middleware] -> Network

// Provider detection rules (matches src/shared/providers.ts)
const PROVIDER_RULES = [
  { host: 'api.openai.com', type: 'injector', name: 'OPENAI_API_KEY' },
  { host: 'api.anthropic.com', type: 'injector', name: 'ANTHROPIC_API_KEY' },
  { host: 'generativelanguage.googleapis.com', type: 'injector', name: 'GEMINI_API_KEY' },
  { host: 'api.mistral.ai', type: 'injector', name: 'MISTRAL_API_KEY' },
  { host: 'googleapis.com', type: 'session', name: 'Google OAuth' }
];

export function detectFlowType(url) {
  if (!url) return { type: 'direct', nodes: [] };

  try {
    const hostname = new URL(url).hostname;

    for (const rule of PROVIDER_RULES) {
      if (hostname === rule.host || hostname.endsWith('.' + rule.host)) {
        return { type: rule.type, name: rule.name, hostname };
      }
    }

    // Check if cross-origin (CORS bypass needed)
    const currentOrigin = window.location.origin;
    const targetOrigin = new URL(url).origin;
    if (currentOrigin !== targetOrigin) {
      return { type: 'cors', hostname };
    }

    return { type: 'direct', hostname };
  } catch {
    return { type: 'direct', nodes: [] };
  }
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

export function renderPipeline(url) {
  const container = el('div', 'pipeline');
  const flow = detectFlowType(url);

  // Browser node
  const browserNode = el('div', 'pipeline-node', 'Browser');
  container.appendChild(browserNode);

  // Arrow
  container.appendChild(el('span', 'pipeline-arrow', '\u2192'));

  // Middleware node (if any)
  if (flow.type === 'injector') {
    const node = el('div', 'pipeline-node injector');
    node.textContent = '\uD83D\uDD12 ' + flow.name;
    container.appendChild(node);
    container.appendChild(el('span', 'pipeline-arrow', '\u2192'));
  } else if (flow.type === 'session') {
    const state = window.BridgeState?.getState();
    const node = el('div', 'pipeline-node session');
    if (state?.google?.authenticated) {
      node.textContent = '\uD83D\uDC64 ' + (state.google.email || 'OAuth');
    } else {
      node.textContent = '\uD83D\uDC64 OAuth Required';
      node.style.borderColor = 'var(--warning)';
      node.style.color = 'var(--warning)';
      node.style.background = '#fef7e0';
    }
    container.appendChild(node);
    container.appendChild(el('span', 'pipeline-arrow', '\u2192'));
  } else if (flow.type === 'cors') {
    const node = el('div', 'pipeline-node cors');
    node.textContent = '\uD83C\uDF0D CORS Bypass';
    container.appendChild(node);
    container.appendChild(el('span', 'pipeline-arrow', '\u2192'));
  }

  // Network node
  const networkNode = el('div', 'pipeline-node active', 'Network');
  container.appendChild(networkNode);

  return container;
}

export function getGhostHeaders(url) {
  const flow = detectFlowType(url);
  const ghosts = [];

  if (flow.type === 'injector') {
    const headerMap = {
      'OPENAI_API_KEY': { name: 'Authorization', value: 'Bearer [OPENAI_API_KEY]' },
      'ANTHROPIC_API_KEY': { name: 'x-api-key', value: '[ANTHROPIC_API_KEY]' },
      'GEMINI_API_KEY': { name: 'x-goog-api-key', value: '[GEMINI_API_KEY]' },
      'MISTRAL_API_KEY': { name: 'Authorization', value: 'Bearer [MISTRAL_API_KEY]' }
    };
    const header = headerMap[flow.name];
    if (header) {
      const state = window.BridgeState?.getState();
      const keyName = flow.name.replace('_API_KEY', '').toLowerCase();
      ghosts.push({
        ...header,
        isSet: state?.keys?.[keyName] || false
      });
    }
  } else if (flow.type === 'session') {
    const state = window.BridgeState?.getState();
    ghosts.push({
      name: 'Authorization',
      value: 'Bearer [Google OAuth Token]',
      isSet: state?.google?.authenticated || false
    });
  }

  return ghosts;
}

window.BridgePipeline = { detectFlowType, renderPipeline, getGhostHeaders };
