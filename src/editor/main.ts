/**
 * Bridge AI IDE - Main Entry Point
 */

import { initStatusBar, checkExtension } from "./components/status-bar";
import { initEditorPane } from "./components/editor-pane";
import { initConsolePane } from "./components/console-pane";
import { initChatPane } from "./components/chat-pane";
import { initResizeHandle } from "./services/resize";

async function init(): Promise<void> {
  // Check extension first
  await checkExtension();

  // Initialize components
  initStatusBar();
  initEditorPane();
  initConsolePane();
  initChatPane();
  initResizeHandle();

  console.log("Bridge AI IDE initialized");
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
