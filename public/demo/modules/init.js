// Bridge Workbench - Bootstrap & Ghost Mode
// Extension detection and UI state management

const STATUS_CHECK_INTERVAL = 2000;
const MAX_RETRIES = 3;

async function init() {
  updateStatusUI('checking');

  let retries = 0;
  let connected = false;

  while (retries < MAX_RETRIES && !connected) {
    await delay(retries * 500);
    connected = await window.BridgeState?.checkExtension();
    retries++;
  }

  if (connected) {
    enableWorkbench();
  } else {
    enableGhostMode();
  }

  // Continue checking in background
  setInterval(checkConnection, STATUS_CHECK_INTERVAL);
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function checkConnection() {
  const wasReady = window.BridgeState?.getState()?.extension?.ready;
  const isReady = await window.BridgeState?.checkExtension();

  if (isReady && !wasReady) {
    enableWorkbench();
  } else if (!isReady && wasReady) {
    enableGhostMode();
  }
}

function enableWorkbench() {
  const ghost = document.getElementById('ghostOverlay');
  const status = window.BridgeState?.getState()?.extension;

  if (ghost) ghost.classList.remove('visible');
  updateStatusUI('ready', status?.version);
}

function enableGhostMode() {
  const ghost = document.getElementById('ghostOverlay');
  if (ghost) ghost.classList.add('visible');
  updateStatusUI('disconnected');
}

function updateStatusUI(mode, version) {
  const statusEl = document.getElementById('extensionStatus');
  if (!statusEl) return;

  const dot = statusEl.querySelector('.status-dot');
  const text = statusEl.querySelector('.status-text');

  if (mode === 'ready') {
    dot?.classList.add('ready');
    dot?.classList.remove('error');
    if (text) text.textContent = version ? `v${version}` : 'Ready';
  } else if (mode === 'disconnected') {
    dot?.classList.remove('ready');
    dot?.classList.add('error');
    if (text) text.textContent = 'Disconnected';
  } else {
    dot?.classList.remove('ready', 'error');
    if (text) text.textContent = 'Checking...';
  }
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 0);
}

window.BridgeInit = { checkConnection, enableWorkbench, enableGhostMode };
