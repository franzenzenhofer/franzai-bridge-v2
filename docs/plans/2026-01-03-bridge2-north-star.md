# Bridge2 North Star Plan (2026-01-03)

## North Star Goal
Ship a production-ready FranzAI Bridge + Editor experience where:
- Bridge fetch supports binary and streaming responses safely.
- Demo and Editor return real AI responses with stable UX (no scroll jumps).
- Sidepanel provides reliable inspection, export, and per-entry management.
- All unit + e2e tests pass, docs match behavior, and rollbacks are easy.

## Scope Notes
- Must follow project rule: light mode only, no theme toggles.
- Keep files modular (max ~150 lines per file). Refactor before adding features.
- Preserve backward compatibility where possible.

## Plan
1. Inventory open tickets + repo constraints; define feature map and risks.
2. Refactor oversized entrypoints into small modules to unlock safe changes.
3. Implement core bridge features: binary responses, streaming (offscreen + port), per-request timeout/retry/cache, message chunking, error messages.
4. Fix Editor + Demo flows: key naming alignment, AI response parsing/streaming, scroll stability; improve sidepanel UX with cURL/HAR export, collapsible sections, per-entry delete.
5. Add remaining tickets: request/response interceptors, WebSocket proxy, CSP notes, TS strictness, provider examples; update OPENTICKETS.
6. Run typecheck/unit/e2e tests, rebuild, commit per milestone, push backups.

## Success Criteria
- Editor can send a prompt and display real AI responses with streaming UX (when supported).
- Demo AI examples return actual responses with correct key injection.
- Sidepanel scroll and details panes behave predictably and exports work.
- All tests are green and docs match the implemented behavior.
