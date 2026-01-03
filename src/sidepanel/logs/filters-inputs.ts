import { debounce } from "../utils/debounce";
import { setFilterMethod, setFilterSearch, setFilterStatus } from "./filters";
import { clearFilters } from "./filters-ui";

export function initFilterInputs(onChange: () => void): void {
  const searchInput = document.getElementById("filterSearch") as HTMLInputElement | null;
  const methodSelect = document.getElementById("filterMethod") as HTMLSelectElement | null;
  const statusSelect = document.getElementById("filterStatus") as HTMLSelectElement | null;

  const debouncedChange = debounce(onChange, 150);

  if (searchInput) {
    searchInput.oninput = (e) => {
      setFilterSearch((e.target as HTMLInputElement).value);
      debouncedChange();
    };
  }

  if (methodSelect) {
    methodSelect.onchange = (e) => {
      setFilterMethod((e.target as HTMLSelectElement).value);
      onChange();
    };
  }

  if (statusSelect) {
    statusSelect.onchange = (e) => {
      setFilterStatus((e.target as HTMLSelectElement).value);
      onChange();
    };
  }

  const clearBtn = document.getElementById("btnClearFilters");
  if (clearBtn) {
    clearBtn.onclick = () => clearFilters(onChange);
  }
}
