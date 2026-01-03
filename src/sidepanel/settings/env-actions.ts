import { showEnvAddModal } from "./env-add-modal";

export function initEnvActions(): void {
  const addBtn = document.getElementById("btnAddEnv") as HTMLButtonElement | null;
  if (!addBtn) return;
  addBtn.onclick = () => showEnvAddModal();
}
