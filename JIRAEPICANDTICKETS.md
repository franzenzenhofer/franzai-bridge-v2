# JIRA Epics and Tickets

## North Star Goal
Ship a production-ready FranzAI Bridge + Editor experience where:
- Bridge fetch supports binary and streaming responses safely.
- Demo and Editor return real AI responses with stable UX (no scroll jumps).
- Sidepanel provides reliable inspection, export, and per-entry management.
- All unit + e2e tests pass, docs match behavior, and rollbacks are easy.

Scope constraints:
- Light mode only (no theme toggles).
- Keep files modular (max ~150 lines/file). Refactor before adding features.
- Preserve backward compatibility wherever possible.

---

## Epic A: Core Bridge Reliability and Streaming
Goal: Preserve the “Don’t Break Normal Fetch” rule while adding streaming and reliability features.

Tickets (ordered):
1. A1 - Stream detection + timeout policy (SSE warning, longer/inactivity-based timeout) [status: done]
2. A2 - Port-based streaming fetch pipeline (page -> content -> background -> page) [status: done]
3. A3 - Streaming opt-in/auto switch based on headers or `franzai.stream` [status: done]
4. A4 - Binary-safe response handling for non-text payloads [status: done]
5. A5 - Response header normalization (case-insensitive safety check) [status: done]
6. A6 - Retry with backoff (`franzai.retry`) [status: done]
7. A7 - Request caching (`franzai.cache`) [status: done]
8. A8 - Error messages (origin/destination/timeout guidance) [status: done]
9. A9 - Request/response interceptors [status: done]
10. A10 - Response transformations [status: done]
11. A11 - WebSocket proxy bridge [status: done]

---

## Epic B: Editor Persistence and Project Lifecycle
Goal: Users never lose work and can share/fork sessions.

Tickets:
1. B1 - Local storage hydrate + debounce autosave [status: done]
2. B2 - Persist only safe fields (code, history, messages, projectName) [status: done]
3. B3 - URL prompt bootstrapping ("fork this") [status: done]
4. B4 - Dynamic document title from <title> in HTML [status: done]

---

## Epic C: Editor Chat and AI Flow
Goal: Make AI output feel live, readable, and controllable.

Tickets:
1. C1 - Streaming-aware UI (skeleton bubble, cursor pulse, auto-scroll) [status: done]
2. C2 - Abort/Stop button wired to AbortController [status: done]
3. C3 - Markdown rendering for assistant messages [status: done]
4. C4 - Code block copy buttons in chat [status: done]
5. C5 - Prompt history (Arrow Up/Down) [status: done]
6. C6 - Suggestion chips from templates on empty state [status: done]
7. C7 - Chat message animation (slide-in) [status: done]

---

## Epic D: Preview and Editor UX
Goal: Safer, clearer preview with device checks and quick actions.

Tickets:
1. D1 - Error HUD in preview iframe [status: done]
2. D2 - Kill preview / reset button [status: done]
3. D3 - Device toggles (desktop/tablet/mobile widths) [status: done]
4. D4 - Open links in preview in new tab [status: done]
5. D5 - Pop-out preview to new tab (Blob URL) [status: done]
6. D6 - Format code button (basic auto-indent) [status: done]
7. D7 - Undo/redo visual feedback (fade) [status: done]
8. D8 - Responsive stacking on narrow widths [status: done]
9. D9 - Preview update flash animation [status: done]

---

## Epic E: Context and Prompt Quality
Goal: Better default design output and richer context injection.

Tickets:
1. E1 - Strengthen system prompt with modern CSS defaults [status: done]
2. E2 - Context rail: add project context inputs [status: done]
3. E3 - Inject project context into system prompt [status: done]

---

## Epic F: Sidepanel Quality of Life
Goal: Faster triage and exports for inspection workflows.

Tickets:
1. F1 - Search/filter and sorting reliability pass [status: done]
2. F2 - Export logs as HAR [status: done]
3. F3 - Copy as cURL [status: done]
4. F4 - Collapsible detail sections [status: done]
5. F5 - Clear individual entries [status: done]

---

## Epic G: Testing and QA Automation
Goal: Confidence via unit + e2e coverage.

Tickets:
1. G1 - Unit tests for editor store history (push/undo/redo) [status: done]
2. G2 - Unit test for prompt builder snapshot [status: done]
3. G3 - E2E editor flow with mocked AI response [status: done]
4. G4 - E2E streaming behavior test [status: done]

---

## Epic H: Docs and Platform Readiness
Goal: Documentation matches behavior and future compatibility is tracked.

Tickets:
1. H1 - Provider-specific examples (OpenAI/Anthropic/Gemini/Mistral/etc) [status: done]
2. H2 - TS strictness: enable `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` [status: done]
3. H3 - Firefox support plan (doc-only for now) [status: done]
4. H4 - Safari support plan (doc-only for now) [status: done]

---

## Epic I: Git/GitHub Strategy
Goal: Safe, traceable release and rollback.

Tickets:
1. I1 - Branching strategy (trunk + short-lived feature branches + release tags) [status: done]
2. I2 - Commit convention + changelog notes [status: done]
3. I3 - CI gates for tests/typecheck/build [status: done]

