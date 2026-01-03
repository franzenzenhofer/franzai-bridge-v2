/**
 * Bridge AI IDE - Resize Handle Service
 */

export function initResizeHandle(): void {
  const handle = document.getElementById("resize-handle");
  const editorPane = document.querySelector(".editor-pane") as HTMLElement;
  const chatPane = document.querySelector(".chat-pane") as HTMLElement;

  if (!handle || !editorPane || !chatPane) return;

  let isResizing = false;
  let startX = 0;
  let startChatWidth = 0;

  handle.addEventListener("mousedown", (e) => {
    isResizing = true;
    startX = e.clientX;
    startChatWidth = chatPane.offsetWidth;
    handle.classList.add("active");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    // Chat is on the left, so dragging right increases width
    const delta = e.clientX - startX;
    const newWidth = Math.max(280, Math.min(600, startChatWidth + delta));

    chatPane.style.width = `${newWidth}px`;
  });

  document.addEventListener("mouseup", () => {
    if (!isResizing) return;
    isResizing = false;
    handle.classList.remove("active");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
}
