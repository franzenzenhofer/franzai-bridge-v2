import { ICON_EDIT, ICON_TRASH } from "./icons";

export type ListTableConfig = {
  tableId: string;
  items: string[];
  emptyText: string;
  onDelete: (value: string) => Promise<void>;
  onEdit?: (oldValue: string, newValue: string) => Promise<void>;
};

export function renderListTable(config: ListTableConfig): void {
  const table = document.getElementById(config.tableId);
  if (!table) return;
  table.innerHTML = "";

  if (!config.items.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = config.emptyText;
    table.appendChild(hint);
    return;
  }

  for (const value of config.items) {
    const row = document.createElement("div");
    row.className = "tr";

    const tdValue = document.createElement("div");
    tdValue.className = "td";
    tdValue.textContent = value;

    const tdActions = document.createElement("div");
    tdActions.className = "td actions";

    if (config.onEdit) {
      const editBtn = document.createElement("button");
      editBtn.className = "icon-btn";
      editBtn.innerHTML = ICON_EDIT;
      editBtn.title = "Edit";
      editBtn.onclick = () => startInlineEdit(row, tdValue, value, config.onEdit!);
      tdActions.appendChild(editBtn);
    }

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.innerHTML = ICON_TRASH;
    delBtn.title = "Delete";
    delBtn.onclick = () => config.onDelete(value);
    tdActions.appendChild(delBtn);

    row.appendChild(tdValue);
    row.appendChild(tdActions);
    table.appendChild(row);
  }
}

function startInlineEdit(
  row: HTMLElement,
  cell: HTMLElement,
  currentValue: string,
  onSave: (oldValue: string, newValue: string) => Promise<void>
): void {
  const input = document.createElement("input");
  input.type = "text";
  input.value = currentValue;
  input.className = "inline-edit";

  const originalContent = cell.textContent;
  cell.textContent = "";
  cell.appendChild(input);
  input.focus();
  input.select();

  const save = async () => {
    const nextValue = input.value.trim();
    if (nextValue && nextValue !== currentValue) {
      await onSave(currentValue, nextValue);
    } else if (originalContent !== null) {
      cell.textContent = originalContent;
    }
  };

  input.onblur = save;
  input.onkeydown = (e) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape" && originalContent !== null) {
      cell.textContent = originalContent;
    }
  };

  row.classList.add("editing");
}
