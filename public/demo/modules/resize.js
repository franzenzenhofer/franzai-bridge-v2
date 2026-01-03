// Bridge Workbench - Resizable Panes
// Drag handles for adjusting pane widths

const MIN_RAIL_WIDTH = 120;
const MAX_RAIL_WIDTH = 400;
const MIN_PANE_WIDTH = 150;

let isResizing = false;
let currentHandle = null;
let startX = 0;
let startWidths = {};

function init() {
  const contextRail = document.querySelector('.context-rail');
  const composer = document.querySelector('.composer');
  const telemetry = document.querySelector('.telemetry');

  if (!contextRail || !composer || !telemetry) return;

  // Create and insert resize handles
  const handle1 = document.createElement('div');
  handle1.className = 'resize-handle';
  handle1.id = 'resize-handle-1';
  contextRail.after(handle1);

  const handle2 = document.createElement('div');
  handle2.className = 'resize-handle';
  handle2.id = 'resize-handle-2';
  composer.after(handle2);

  // Load saved widths
  loadWidths();

  // Event listeners - use both mouse and pointer events for compatibility
  handle1.addEventListener('mousedown', onMouseDown);
  handle2.addEventListener('mousedown', onMouseDown);
  handle1.addEventListener('pointerdown', onMouseDown);
  handle2.addEventListener('pointerdown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointermove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerup', onMouseUp);

  // Double-click to reset
  handle1.addEventListener('dblclick', resetWidths);
  handle2.addEventListener('dblclick', resetWidths);

  // Prevent text selection during drag
  handle1.style.touchAction = 'none';
  handle2.style.touchAction = 'none';
}

function onMouseDown(e) {
  isResizing = true;
  currentHandle = e.target;
  startX = e.clientX;

  const contextRail = document.querySelector('.context-rail');
  const composer = document.querySelector('.composer');
  const telemetry = document.querySelector('.telemetry');

  startWidths = {
    rail: contextRail.offsetWidth,
    composer: composer.offsetWidth,
    telemetry: telemetry.offsetWidth
  };

  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  currentHandle.classList.add('active');
  e.preventDefault();
}

function onMouseMove(e) {
  if (!isResizing || !currentHandle) return;

  const delta = e.clientX - startX;
  const contextRail = document.querySelector('.context-rail');
  const composer = document.querySelector('.composer');
  const telemetry = document.querySelector('.telemetry');

  if (currentHandle.id === 'resize-handle-1') {
    // Resizing context rail
    let newWidth = startWidths.rail + delta;
    newWidth = Math.max(MIN_RAIL_WIDTH, Math.min(MAX_RAIL_WIDTH, newWidth));
    contextRail.style.width = newWidth + 'px';

  } else if (currentHandle.id === 'resize-handle-2') {
    // Resizing between composer and telemetry
    let newComposerWidth = startWidths.composer + delta;
    let newTelemetryWidth = startWidths.telemetry - delta;

    if (newComposerWidth >= MIN_PANE_WIDTH && newTelemetryWidth >= MIN_PANE_WIDTH) {
      composer.style.flex = 'none';
      telemetry.style.flex = 'none';
      composer.style.width = newComposerWidth + 'px';
      telemetry.style.width = newTelemetryWidth + 'px';
    }
  }
}

function onMouseUp() {
  if (!isResizing) return;

  isResizing = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';

  if (currentHandle) {
    currentHandle.classList.remove('active');
    currentHandle = null;
  }

  saveWidths();
}

function saveWidths() {
  const contextRail = document.querySelector('.context-rail');
  const composer = document.querySelector('.composer');
  const telemetry = document.querySelector('.telemetry');

  try {
    localStorage.setItem('bridge-workbench-widths', JSON.stringify({
      rail: contextRail.offsetWidth,
      composer: composer.offsetWidth,
      telemetry: telemetry.offsetWidth
    }));
  } catch (e) { /* ignore */ }
}

function loadWidths() {
  try {
    const saved = localStorage.getItem('bridge-workbench-widths');
    if (saved) {
      const widths = JSON.parse(saved);
      const contextRail = document.querySelector('.context-rail');
      const composer = document.querySelector('.composer');
      const telemetry = document.querySelector('.telemetry');

      if (widths.rail) {
        contextRail.style.width = widths.rail + 'px';
      }
      if (widths.composer && widths.telemetry) {
        composer.style.flex = 'none';
        composer.style.width = widths.composer + 'px';
        telemetry.style.flex = 'none';
        telemetry.style.width = widths.telemetry + 'px';
      }
    }
  } catch (e) { /* ignore */ }
}

function resetWidths() {
  const contextRail = document.querySelector('.context-rail');
  const composer = document.querySelector('.composer');
  const telemetry = document.querySelector('.telemetry');

  contextRail.style.width = '';
  composer.style.flex = '';
  composer.style.width = '';
  telemetry.style.flex = '';
  telemetry.style.width = '';

  try {
    localStorage.removeItem('bridge-workbench-widths');
  } catch (e) { /* ignore */ }
}

// Wait for other modules to render content, then initialize
function waitForPanes() {
  const contextRail = document.querySelector('.context-rail');
  const composer = document.querySelector('.composer');
  const telemetry = document.querySelector('.telemetry');

  // Check if panes exist and have content
  if (contextRail && composer && telemetry &&
      !document.querySelector('.resize-handle')) {
    init();
  } else {
    setTimeout(waitForPanes, 100);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(waitForPanes, 100));
} else {
  setTimeout(waitForPanes, 100);
}

window.BridgeResize = { init, saveWidths, loadWidths, resetWidths };
