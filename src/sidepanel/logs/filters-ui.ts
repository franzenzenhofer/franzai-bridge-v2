import { clearFilterState, hasActiveFilters } from "./filters";

export function resetFilterInputs(): void {
  const searchInput = document.getElementById("filterSearch") as HTMLInputElement | null;
  const methodSelect = document.getElementById("filterMethod") as HTMLSelectElement | null;
  const statusSelect = document.getElementById("filterStatus") as HTMLSelectElement | null;
  if (searchInput) searchInput.value = "";
  if (methodSelect) methodSelect.value = "";
  if (statusSelect) statusSelect.value = "";
}

export function clearFilters(onChange: () => void): void {
  clearFilterState();
  resetFilterInputs();
  onChange();
}

export function updateFilterUI(filtered: number, total: number): void {
  const countEl = document.getElementById("requestCount");
  if (countEl) {
    countEl.textContent = filtered === total ? String(total) : `${filtered}/${total}`;
    countEl.classList.toggle("filtered", filtered !== total);
  }

  const clearBtn = document.getElementById("btnClearFilters");
  if (clearBtn) {
    clearBtn.style.display = hasActiveFilters() ? "inline-flex" : "none";
  }
}
