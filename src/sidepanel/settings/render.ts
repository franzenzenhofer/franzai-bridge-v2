import { renderEnvTable } from "./env-table";
import { renderDestinations } from "./destinations";
import { renderRules } from "./rules";

export function renderSettings(): void {
  renderEnvTable();
  renderDestinations();
  renderRules();
}
