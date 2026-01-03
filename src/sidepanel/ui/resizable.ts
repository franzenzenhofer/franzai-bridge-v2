import { getColWidths, setColWidth, saveUIPrefs } from "./prefs";

export function applyColumnWidths(): void {
  const template = getColWidths().map((w) => (w === -1 ? "1fr" : `${w}px`)).join(" ");
  const header = document.querySelector(".table-header") as HTMLElement | null;
  if (header) header.style.gridTemplateColumns = template;

  document.querySelectorAll(".item").forEach((item) => {
    (item as HTMLElement).style.gridTemplateColumns = template;
  });
}

function updateColumnWidth(index: number, width: number): void {
  setColWidth(index, width);
  applyColumnWidths();
  saveUIPrefs();
}

export function initResizableColumns(): void {
  const header = document.querySelector(".table-header") as HTMLElement | null;
  if (!header) return;

  const cols = header.querySelectorAll("div");
  cols.forEach((col, index) => {
    if (index === cols.length - 1) return;
    const resizer = document.createElement("div");
    resizer.className = "col-resizer";
    col.style.position = "relative";
    col.appendChild(resizer);

    let startX = 0;
    let startWidth = 0;

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(30, startWidth + delta);
      updateColumnWidth(index, newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startWidth = col.offsetWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  });

  applyColumnWidths();
}

export function initResizableSplit(): void {
  const layout = document.querySelector(".requests-layout") as HTMLElement | null;
  const listPane = document.querySelector(".listPane") as HTMLElement | null;
  const detailPane = document.querySelector(".detailPane") as HTMLElement | null;
  if (!layout || !listPane || !detailPane) return;

  const resizer = document.createElement("div");
  resizer.className = "split-resizer";
  layout.insertBefore(resizer, detailPane);

  let startY = 0;
  let startHeight = 0;

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientY - startY;
    const newHeight = Math.max(50, Math.min(startHeight + delta, layout.clientHeight - 100));
    listPane.style.height = `${newHeight}px`;
    listPane.style.maxHeight = "none";
    listPane.style.flex = "none";
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startY = e.clientY;
    startHeight = listPane.offsetHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}
