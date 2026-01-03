# Open Tickets

Tracked issues, improvements, and feature requests for FranzAI Bridge.

---

## GUIDING PRINCIPLES

### The "Don't Break Normal Fetch" Rule

Every change must preserve existing functionality. This is non-negotiable.

```
┌─────────────────────────────────────────────────────────────────┐
│  GRACEFUL DEGRADATION HIERARCHY                                 │
│                                                                 │
│  1. HANDLE PERFECTLY     → Do it right                          │
│  2. HANDLE IMPERFECTLY   → Data correct, UX degraded (OK)       │
│  3. CAN'T HANDLE         → Clear error message (OK)             │
│  4. CORRUPT/HANG/BREAK   → NEVER ACCEPTABLE                     │
└─────────────────────────────────────────────────────────────────┘
```

**Examples:**
| Scenario | Acceptable | NOT Acceptable |
|----------|------------|----------------|
| Binary response | Buffer as Uint8Array | Return as corrupted string |
| SSE streaming | Buffer complete response | Hang waiting forever |
| Body > 5MB | Error with clear message | Silent truncation |
| Unknown body type | Error with explanation | Silent data loss |
| Mode "always" fails | Throw with details | Silent native fallback |

**Before any change, ask:**
1. Does this break existing working requests? → NO
2. Does this corrupt any data? → NO
3. Does this hang or timeout unexpectedly? → NO
4. If we can't handle it, do we fail clearly? → YES

---

## High Priority

### [FEAT] Streaming Response Support

**Status:** Phase 1 buffering w/ SSE warning implemented; progressive streaming not implemented
**Files:** `src/background.ts`, `src/contentScript.ts`, `src/injected.ts`

All responses are fully buffered before returning. This affects:
- Server-Sent Events (SSE) for AI streaming (OpenAI, Anthropic, etc.)
- Large file downloads
- Real-time data feeds

---

#### THE CORE PROBLEM

`chrome.runtime.sendMessage` is request-response. You send a message, you get ONE response back. There's no way to send multiple chunks through it.

```
Page: "fetch this URL"
Background: [waits for entire response] → "here's everything"
```

This works for normal APIs but SSE streams tokens one by one.

---

#### THE "DON'T BREAK NORMAL FETCH" PRINCIPLE

**Critical rule:** We must NEVER break existing functionality when adding streaming support.

| Scenario | Current Behavior | Must Remain |
|----------|------------------|-------------|
| Normal JSON API | Works ✓ | Works ✓ |
| Binary response | Corrupted ✗ | Works ✓ (see binary ticket) |
| Streaming response | Buffers, returns complete | Data correct, UX delayed |

**Acceptable degradation:** Buffering a stream loses the progressive UX but data is 100% correct.
**Unacceptable:** Corrupting data, hanging, silent fallback in "always" mode.

---

#### PHASE 1: GRACEFUL BUFFERING (Quick Win)

Do nothing special for streaming. Just buffer the complete response.

```javascript
// background.ts - current behavior is actually fine!
const response = await fetch(url);
const bodyText = await response.text(); // waits for stream to complete
return { bodyText, ... };
```

**What happens with SSE:**
- OpenAI sends: `data: {"token":"Hello"}\n\ndata: {"token":" world"}\n\n...`
- We wait for stream to finish (or timeout)
- Return complete concatenated response
- Page gets all the data, just not progressively

**Add detection + warning:**
```javascript
const contentType = response.headers.get('content-type');
if (contentType?.includes('text/event-stream')) {
  console.warn('[FranzAI Bridge] SSE stream detected. Buffering complete response (no progressive streaming).');
}
```

**Why this is fine for now:**
- Data is correct
- API calls work
- User sees result (just delayed)
- No breaking change

---

#### PHASE 2: PORT-BASED STREAMING (Real Solution)

Chrome extensions have `chrome.runtime.connect()` which creates a persistent bi-directional channel:

```
Page ←──postMessage──→ Content Script ←──Port──→ Background
         (chunks)            ↕                      ↕
                        port.onMessage          port.postMessage
```

**Implementation sketch:**

```javascript
// background.ts
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'franzai-stream') return;

  port.onMessage.addListener(async (msg) => {
    const response = await fetch(msg.url, msg.init);
    const reader = response.body.getReader();

    // Send headers first
    port.postMessage({ type: 'headers', status: response.status, headers: [...] });

    // Stream chunks
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        port.postMessage({ type: 'done' });
        break;
      }
      port.postMessage({ type: 'chunk', data: value }); // Uint8Array
    }
  });
});

// injected.ts
function createStreamingFetch(url, init) {
  return new Response(
    new ReadableStream({
      start(controller) {
        // Listen for chunks from content script
        window.addEventListener('message', (e) => {
          if (e.data.type === 'chunk') controller.enqueue(e.data.data);
          if (e.data.type === 'done') controller.close();
        });
        // Initiate request
        window.postMessage({ type: 'stream-request', url, init });
      }
    }),
    { status, statusText, headers }
  );
}
```

**Complexity:** High. Need to manage:
- Port lifecycle (connect, disconnect, errors)
- Message ordering
- Backpressure (if page reads slower than network)
- Cleanup on abort

---

#### PHASE 3: HYBRID DETECTION (Best UX)

Automatically choose strategy based on request/response:

```javascript
// Detect if streaming is expected
function expectsStreaming(init) {
  const accept = init?.headers?.['Accept'] || init?.headers?.['accept'];
  return accept?.includes('text/event-stream');
}

// In hookedFetch:
if (expectsStreaming(init)) {
  return streamingBridgeFetch(url, init); // Port-based
} else {
  return bufferedBridgeFetch(url, init);  // Current approach
}
```

---

#### GRACEFUL DEGRADATION MATRIX

| Mode | Streaming Request | What Happens | Data OK? | UX |
|------|-------------------|--------------|----------|-----|
| auto | SSE | Buffer complete | ✓ | Delayed |
| always | SSE | Buffer complete | ✓ | Delayed |
| auto (Phase 2) | SSE | Port streaming | ✓ | Progressive ✓ |
| always (Phase 2) | SSE | Port streaming | ✓ | Progressive ✓ |

**Never do:**
- Silent fallback to native fetch (defeats CORS bypass in "always" mode)
- Return partial data
- Hang indefinitely (respect timeouts)
- Corrupt SSE format

---

#### TIMEOUT CONSIDERATIONS

SSE streams can be long-lived (minutes). Current `FETCH_TIMEOUT_MS` (25s) may kill valid streams.

**Options:**
1. Detect SSE and use longer/no timeout
2. Per-request timeout: `franzai: { timeout: 300000 }`
3. Timeout on inactivity (no data for N seconds) rather than total time

---

#### RECOMMENDATION

1. **Now:** Do nothing - current buffering behavior is correct, just not optimal UX
2. **Soon:** Add SSE detection + console warning so devs know what's happening
3. **Later:** Implement port-based streaming for proper SSE support
4. **Always:** Never break normal non-streaming requests

**Priority:** High for AI use cases, but Phase 1 (buffering) is acceptable MVP

---

### [BUG] Response Headers Case Sensitivity

**Status:** Needs verification
**Files:** `src/background.ts`

HTTP headers are case-insensitive but our `Dict<string>` may not preserve original casing correctly. Some APIs may expect specific casing.

**Action:** Verify header handling matches fetch spec behavior.

---

## Medium Priority

### [FEAT] WebSocket Support

**Status:** Not implemented
**Files:** New file needed

WebSocket connections cannot use the bridge. Would require:
- Hooking `window.WebSocket`
- Proxying through background script
- Managing bidirectional message flow

**Use case:** Real-time AI chat, live data feeds

---

### [FEAT] Request Retry with Backoff

**Status:** Not implemented
**Files:** `src/background.ts`

Failed requests (5xx, network errors) should optionally retry with exponential backoff.

**Config:**
```javascript
fetch(url, {
  franzai: {
    retry: { maxAttempts: 3, backoffMs: 1000 }
  }
});
```

---

### [FEAT] Request Caching

**Status:** Not implemented
**Files:** `src/background.ts`

Cache GET responses in extension storage with configurable TTL.

**Use case:** Reduce API calls for repeated requests (embeddings, static data)

---

### [IMPROVEMENT] Side Panel UX

**Status:** Basic implementation
**Files:** `src/sidepanel/`

Improvements needed:
- [ ] Search/filter requests
- [ ] Export logs as HAR
- [ ] Copy as cURL
- [ ] Syntax highlighting for JSON bodies
- [ ] Collapse/expand request details
- [ ] Clear individual entries
- [ ] Dark mode

---

### [IMPROVEMENT] Error Messages

**Status:** Partially done
**Files:** `src/injected.ts`, `src/background.ts`

Error messages should be more actionable:
- "Origin not allowed" → suggest adding to allowlist
- "Destination not allowed" → show which pattern to add
- "Timeout" → suggest increasing timeout or checking network

---

## Low Priority

### [FEAT] Firefox Support

**Status:** Not started
**Files:** `src/manifest.json`, build config

MV3 differences between Chrome and Firefox would need abstraction layer.

---

### [FEAT] Safari Support

**Status:** Not started

Safari's extension model differs significantly. Would need separate build target.

---

### [FEAT] Request Interception Hooks

**Status:** Not implemented
**Files:** `src/injected.ts`

Allow page to modify requests before they're sent:
```javascript
window.franzai.addInterceptor((req) => {
  req.headers['X-Custom'] = 'value';
  return req;
});
```

---

### [FEAT] Response Transformation

**Status:** Not implemented

Transform responses before returning to page:
```javascript
window.franzai.addResponseHandler((res) => {
  // Modify response
  return res;
});
```

---

### [IMPROVEMENT] TypeScript Strict Mode

**Status:** Partial
**Files:** `tsconfig.json`

Enable stricter TypeScript options:
- [ ] `noUncheckedIndexedAccess`
- [ ] `exactOptionalPropertyTypes`

---

### [DOCS] Provider-Specific Examples

**Status:** Not done
**Files:** `README.md` or separate docs

Add examples for:
- [ ] OpenAI (chat, embeddings, images)
- [ ] Anthropic Claude
- [ ] Google Gemini
- [ ] Mistral
- [ ] Replicate
- [ ] Hugging Face

---

### [TEST] E2E Browser Tests

**Status:** Not implemented
**Files:** New test files

Add Playwright/Puppeteer tests that:
- Load extension in browser
- Make bridged requests
- Verify responses

Current tests only cover utility functions.

---

### [SECURITY] CSP Compatibility

**Status:** Unknown
**Files:** `src/contentScript.ts`

Test and document behavior on pages with strict Content-Security-Policy. The injected script may be blocked by some CSPs.

---

### [PERF] Message Size Optimization

**Status:** Not implemented
**Files:** `src/shared/types.ts`

For large bodies, consider:
- Compression before messaging
- Chunked transfer
- Binary serialization (MessagePack vs JSON)

---

## Completed

### [FEAT] Binary Request Bodies ✓

**Completed:** 2024-12-30
**Files:** `src/injected.ts`

Added support for Blob, ArrayBuffer, TypedArray, FormData, ReadableStream bodies. Buffered to Uint8Array with 5MB limit.

---

### [FEAT] Binary Response Bodies ✓

**Completed:** 2026-01-03
**Files:** `src/background/fetchHandler.ts`, `src/injected/bridge-fetch.ts`, `src/injected/google/fetch.ts`, `src/shared/types.ts`, `src/shared/content-type.ts`, `src/shared/googleAuth.ts`

Added binary-safe response handling with Content-Type detection and byte forwarding. Logs now preview binary sizes without corruption.

---

### [FEAT] Per-Request Timeout Override ✓

**Completed:** 2026-01-03
**Files:** `src/shared/types.ts`, `src/injected/request.ts`, `src/injected/bridge-fetch.ts`, `src/content/handlers/fetch.ts`, `src/background/fetchHandler.ts`

Allows `franzai.timeout` to override the global fetch timeout end-to-end.

---

### [FIX] AbortSignal null handling ✓

**Completed:** 2024-12-30
**Files:** `src/injected.ts`

Fixed TypeScript error where `AbortSignal | null` wasn't assignable to `AbortSignal | undefined`.

---

### [FIX] TypeScript lib target ✓

**Completed:** 2024-12-30
**Files:** `tsconfig.json`

Updated from ES2020 to ES2022 for `String.replaceAll` and proper `Uint8Array` typing.

---

## How to Contribute

1. Pick a ticket
2. Create a branch: `git checkout -b feat/ticket-name`
3. Implement with tests
4. Run `npm run typecheck && npm test && npm run build`
5. Submit PR

For new features, open an issue first to discuss the approach.
