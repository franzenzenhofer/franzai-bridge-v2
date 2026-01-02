// Bridge Workbench - Keyboard Shortcuts
// Power-user keyboard navigation

const shortcuts = {
  'mod+Enter': executeRequest,
  'mod+l': focusUrlBar,
  'mod+k': focusUrlBar,
  'Escape': clearOrCancel
};

function isMod(e) {
  return navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
}

function executeRequest() {
  const runBtn = document.getElementById('runBtn');
  if (runBtn && !runBtn.disabled) {
    runBtn.click();
  }
}

function focusUrlBar() {
  const urlInput = document.getElementById('urlInput');
  if (urlInput) {
    urlInput.focus();
    urlInput.select();
  }
}

function clearOrCancel() {
  const urlInput = document.getElementById('urlInput');
  if (urlInput && document.activeElement === urlInput) {
    urlInput.blur();
  } else {
    window.BridgeState?.setState({ response: null });
  }
}

function handleKeydown(e) {
  // Don't intercept when typing in inputs (except for shortcuts)
  const isInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName);

  if (e.key === 'Escape') {
    clearOrCancel();
    return;
  }

  if (isMod(e)) {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeRequest();
    } else if (e.key === 'l' || e.key === 'k') {
      e.preventDefault();
      focusUrlBar();
    }
  }
}

function init() {
  document.addEventListener('keydown', handleKeydown);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.BridgeKeyboard = { executeRequest, focusUrlBar, clearOrCancel };
