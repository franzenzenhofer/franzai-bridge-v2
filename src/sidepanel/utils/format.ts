export function fmtTs(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString();
}

export function fmtShortTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
