# Streaming Support Reality Check (MV3)

This note reviews whether streaming is realistic with the current page -> content script -> background architecture, and what needs to change to make it reliable.

## Reality check (what is accurate)
- `chrome.runtime.sendMessage` is request/response; it cannot stream multiple chunks back to the page.
- Port messaging (`chrome.runtime.connect`) allows multi-message transport, which can carry `Uint8Array` chunks.
- `window.postMessage` between page and content script is message-based; you must forward bytes as data.

## Review comments (corrections and clarifications)
- "5MB limit" is not a reliable number. Chrome documents a message size limit but it has changed historically and can vary by transport. Treat it as "there is a limit" and always chunk; validate with a real test.
- "Not true streaming" is only true if you do not implement flow control. Port messaging is discrete, but you can still provide streaming semantics with chunking and optional backpressure (ack/pause).
- WebSockets cannot be transferred across boundaries, but they can be proxied by relaying frames. That is possible, just more stateful. In some cases the page can open the WebSocket directly if the server allows the Origin.
- "Keep-alive pings guarantee 100%" is not accurate. Service workers can still be terminated under memory pressure, during updates, or by browser policy. Treat keep-alive as a best-effort mitigation, not a guarantee.

## Recommended architecture (realistic)
1. Page/injected creates a `ReadableStream`, posts `STREAM_START` to the content script.
2. Content script opens a long-lived Port and relays messages both directions.
3. Background does the fetch, posts `STREAM_HEADERS` immediately, then `STREAM_CHUNK` for each `Uint8Array`, then `STREAM_END` or `STREAM_ERROR`.
4. Page resolves the fetch once headers arrive and enqueues chunks into the stream.

## Implementation recommendations
- Chunking: use a fixed chunk size (e.g., 64KB or 256KB) to stay under message limits and reduce memory spikes.
- Backpressure: pause background reads when the page signals it is overwhelmed (e.g., `desiredSize <= 0`) and resume on ack.
- Abort path: wire `ReadableStream.cancel()` -> `STREAM_ABORT` -> `AbortController.abort()`.
- Errors: if headers are not sent, reject the fetch promise; otherwise error the stream controller.
- Concurrency: include `requestId` and map port state per request.
- Security: reuse the existing allowlist/validation logic and header injection rules.
- Binary transport: prefer `Uint8Array`/`ArrayBuffer` over base64 strings to avoid extra copies.

## Service worker lifecycle risks
- An active fetch + open Port typically keeps the MV3 service worker alive, but it is not guaranteed.
- If you see termination during long "thinking" delays, consider:
  - An offscreen document or extension page that owns the Port.
  - A best-effort keep-alive ping, with clear caveats about reliability.

## 30-minute stream requirement (extension-only)
- For 30-minute streams, do not run the fetch in the MV3 service worker. It will not be reliable enough.
- Use an offscreen document (preferred) or a visible extension page to own the long-lived Port and fetch.
- Relay chunks: Offscreen/page -> background (optional) -> content script -> page. Keep the stream owner stable.
- Treat keep-alive as supplemental; it reduces idle termination risk but does not guarantee uptime.
- Expect rare edge cases (browser updates, memory pressure, extension reloads). Extension-only solutions cannot promise 100% uptime.

## Detailed implementation plan (bridge2, extension-only, 30-minute target)
1. Create a dedicated branch first (required step, do this before any code change):
   - `git switch -c feature/streaming-offscreen`
2. Define the streaming protocol in shared types:
   - Update `src/shared/messages.ts` with `STREAM_START/HEADERS/CHUNK/END/ERROR/ABORT/PING/PAUSE/RESUME` and new `PAGE_MSG.STREAM_*` entries.
   - Update `src/shared/types.ts` with stream payload types (`StreamStart`, `StreamHeaders`, `StreamChunk`, `StreamError`).
   - Add `STREAM_PORT_NAME`, `STREAM_CHUNK_BYTES`, and `STREAM_HEADER_TIMEOUT_MS` in `src/shared/constants.ts`.
3. Add an offscreen document that owns the long-lived fetch:
   - Create `src/offscreen/index.html` and `src/offscreen/offscreen.ts`.
   - Maintain `Map<requestId, { controller, reader, bytes }>` in the offscreen runtime.
   - Use `response.body.getReader()` and send `Uint8Array` chunks.
4. Keep the service worker out of the streaming data path:
   - Add a `BG_MSG.STREAM_INIT` handler in `src/background.ts` to create the offscreen document if missing.
   - Use `chrome.offscreen.hasDocument()` + `chrome.offscreen.createDocument(...)` with a valid reason + justification.
   - Do not proxy stream chunks through the service worker.
5. Reuse existing policy logic for allowlist and header injection:
   - Extract `isDestinationAllowed` and `applyInjectionRules` from `src/background.ts` into a shared helper (e.g., `src/shared/policy.ts`).
   - Call the shared helper from the offscreen doc before starting the fetch.
6. Content script relay (streaming only):
   - In `src/contentScript.ts`, add a new `PAGE_MSG.STREAM_REQUEST` flow.
   - First send `BG_MSG.STREAM_INIT` to ensure offscreen is ready, then open `chrome.runtime.connect({ name: STREAM_PORT_NAME })`.
   - Relay `STREAM_HEADERS/CHUNK/END/ERROR` back to the page and ignore `STREAM_PING`.
7. Injected/page side:
   - In `src/injected.ts`, add `streamFetch(...)` and choose it when `init.franzai?.stream === true` or `accept: text/event-stream`.
   - Resolve the fetch promise on `STREAM_HEADERS`, then enqueue chunks into `ReadableStream`.
   - Use `STREAM_HEADER_TIMEOUT_MS` only for header arrival, not for the full stream duration.
8. Backpressure and abort:
   - If `controller.desiredSize <= 0`, send `STREAM_PAUSE`; resume on `STREAM_RESUME`.
   - Wire `ReadableStream.cancel()` to `STREAM_ABORT` and `AbortController.abort()`.
9. Build + manifest wiring:
   - Add an entry point for `offscreen/offscreen` in `esbuild.config.mjs`.
   - Ensure `src/offscreen` is copied to `dist/offscreen`.
   - Add `"offscreen"` permission in `src/manifest.json`.
10. Observability + validation:
   - Use `src/shared/logger.ts` in the offscreen doc for `start/headers/first-byte/end/error/abort`.
   - Run the streaming test matrix (idle-first-byte, 30-minute stream, large stream, abort, concurrency).

## Risk register (extension-only streaming)
| Risk | Impact | Mitigation / detection |
| --- | --- | --- |
| Offscreen doc fails to create or is denied by policy | Streaming unavailable | Check `chrome.offscreen.hasDocument()` and surface a clear error; fall back to buffered fetch. |
| Service worker restarts during setup | Stream never starts | Keep SW usage to `STREAM_INIT` only and fail fast if it cannot create the doc. |
| Offscreen doc unexpectedly terminates | Stream drops mid-way | Listen for `onDisconnect`/`unload` and send `STREAM_ERROR`; document that uptime is best-effort. |
| Message size limit exceeded | Chunk loss or disconnect | Enforce `STREAM_CHUNK_BYTES` and never send oversized messages. |
| Backpressure not honored | Memory growth, tab freeze | Stop reading when `desiredSize <= 0`, resume only on explicit ack. |
| Duplicate handlers (background + offscreen) | Double responses, corrupted stream | Use a unique `STREAM_PORT_NAME` and ensure only offscreen handles it. |
| Header mismatch or missing | Page never resolves `Response` | Send `STREAM_HEADERS` immediately after fetch; enforce header timeout error. |
| Abort not propagated | Hung connections | Ensure `STREAM_ABORT` closes reader + `AbortController` in offscreen. |
| Cross-origin or policy bypass | Security regression | Apply `allowedDestinations` + injection rules in shared policy helper. |
| Extension reload/update | Stream cut | Treat as non-recoverable; emit a clear `STREAM_ERROR` and require caller retry. |

## Testing checklist
- SSE endpoint with fast token streaming.
- SSE endpoint with a long initial delay before first byte.
- Large stream (>50MB) to validate chunking and memory.
- Abort from the page and verify immediate teardown.
- Multiple concurrent streams.

## Bottom line
Streaming via Port-based chunking is realistic and achievable for most cases, but it is not a drop-in replacement for sockets or a 100% lifetime guarantee. It needs explicit flow control, careful lifecycle management, and real-world testing to be production-ready.
