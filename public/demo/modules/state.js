// Bridge Workbench - State Management
// Pub/Sub pattern for reactive updates

const state = {
  extension: { ready: false, version: null },
  keys: {},  // { openai: true, anthropic: false, ... }
  google: { authenticated: false, email: null, scopes: [] },
  selected: null,  // Currently selected example
  request: { loading: false, startTime: null },
  response: null,  // Last response { status, headers, body, timing }
  history: []  // Request history
};

const subscribers = new Map();

export function getState() {
  return { ...state };
}

export function setState(updates) {
  Object.assign(state, updates);
  notify();
}

export function updateNested(path, value) {
  const keys = path.split('.');
  let obj = state;
  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
  notify();
}

export function subscribe(key, callback) {
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set());
  }
  subscribers.get(key).add(callback);
  return () => subscribers.get(key).delete(callback);
}

function notify() {
  for (const callbacks of subscribers.values()) {
    for (const cb of callbacks) {
      try { cb(state); } catch (e) { console.error('State subscriber error:', e); }
    }
  }
}

// Extension API helpers
export async function checkExtension() {
  try {
    if (window.franzai?.ping) {
      const result = await window.franzai.ping();
      if (result?.ok) {
        setState({ extension: { ready: true, version: result.version } });
        await refreshKeys();
        await refreshGoogle();
        return true;
      }
    }
  } catch (e) { /* ignore */ }
  setState({ extension: { ready: false, version: null } });
  return false;
}

export async function refreshKeys() {
  if (!window.franzai) return;
  const keyMap = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
    mistral: 'MISTRAL_API_KEY'
  };
  const keys = {};
  for (const [name, keyName] of Object.entries(keyMap)) {
    try {
      keys[name] = await window.franzai.hasApiKey(keyName);
    } catch { keys[name] = false; }
  }
  setState({ keys });
}

export async function refreshGoogle() {
  if (!window.franzai?.google) return;
  try {
    const result = await window.franzai.google.getState();
    setState({
      google: {
        authenticated: result.authenticated,
        email: result.email,
        scopes: result.scopes || []
      }
    });
  } catch { /* ignore */ }
}

// Initialize
window.BridgeState = { getState, setState, subscribe, checkExtension, refreshKeys, refreshGoogle };
