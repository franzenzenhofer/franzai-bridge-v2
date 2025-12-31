# FranzAI Bridge

A Chrome MV3 extension that **bypasses CORS** by routing `fetch()` calls through the extension's background script. Call any API from any webpage without a proxy server.

## Why?

Browsers block cross-origin requests for security. But sometimes you need to:
- Call AI APIs (OpenAI, Anthropic, etc.) from static HTML pages
- Test APIs without spinning up a backend
- Build browser-based tools that talk to external services

This extension solves that by intercepting `fetch()` and routing it through the extension (which has no CORS restrictions).

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR PAGE (subject to CORS)                                │
│                                                             │
│  fetch("https://api.openai.com/...")                        │
│       │                                                     │
│       ▼                                                     │
│  [HOOKED window.fetch] ──► postMessage                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  CONTENT SCRIPT                                              │
│  Forwards via chrome.runtime.sendMessage                     │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKGROUND SCRIPT (NO CORS!)                                │
│                                                              │
│  Extensions are exempt from CORS.                            │
│  Makes the real fetch() → returns response                   │
└──────────────────────────────────────────────────────────────┘
```

**Both `window.fetch` and `window.Request` are hooked** - your existing code works unchanged.

## Installation

### Build from source

```bash
npm install
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Enable Side Panel

Click the extension icon or use Chrome's Side Panel button to open the configuration panel.

## Configuration

In the side panel, configure:

| Setting | Description |
|---------|-------------|
| **Allowed Page Origins** | Pages that can use the bridge (e.g., `file://*`, `https://mysite.com/*`) |
| **Allowed Destinations** | APIs the bridge can call (e.g., `https://api.openai.com/*`) |
| **Environment Variables** | Key-value pairs injected into request headers |
| **Injection Rules** | Auto-inject headers/query params per destination host |

### API Key Injection

Add an injection rule to auto-add your API key:

```
Host Pattern: api.openai.com
Inject Headers: Authorization = Bearer $OPENAI_KEY
```

Then set `OPENAI_KEY` in Environment Variables. The key stays in extension storage - never exposed to page JS.

## Usage

### Basic (automatic for cross-origin)

```javascript
// Just use fetch normally - cross-origin requests go through the bridge
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello!" }]
  })
});

console.log(await response.json());
```

### Force Bridge Mode

```javascript
// Global: route ALL requests through bridge (even same-origin)
window.franzai.setMode("always");

// Per-request
fetch("https://api.example.com", {
  franzai: { mode: "always" }
});

// With Request object
const req = new Request("https://api.example.com", {
  franzai: { mode: "always" }
});
fetch(req);

// Before any page code runs
<script>
  window.__franzaiBridgeConfig = { mode: "always" };
</script>
```

### Modes

| Mode | Behavior |
|------|----------|
| `auto` (default) | Bridge for cross-origin only, native for same-origin |
| `always` | All requests through bridge, no fallback on failure |
| `off` | Disable bridge, use native fetch |

### Direct API

```javascript
// Explicit bridge call
const response = await window.franzai.fetch("https://api.example.com");

// Check bridge status
const { ok, version } = await window.franzai.ping();

// Get/set mode
window.franzai.getMode();  // "auto" | "always" | "off"
window.franzai.setMode("always");
```

## Supported Body Types

The bridge buffers these body types into the message payload:

| Type | Handling |
|------|----------|
| `string` | Passed as-is |
| `URLSearchParams` | Converted to string, sets Content-Type |
| `FormData` | Buffered to Uint8Array via Response |
| `Blob` | Text if textual Content-Type, else Uint8Array |
| `ArrayBuffer` | Converted to Uint8Array |
| `TypedArray` | Converted to Uint8Array |
| `ReadableStream` | Fully buffered to Uint8Array |

**Size limit:** 5 MB (configurable in `src/shared/constants.ts`)

**Note:** This is NOT streaming. Bodies are fully buffered before sending.

## Request Logging

The side panel shows all bridged requests with:
- Request URL, method, headers
- Request body preview
- Response status, headers
- Response body preview
- Timing (elapsed ms)
- Errors

## File URLs

To use on `file:///` pages:
1. Go to `chrome://extensions`
2. Click **Details** on FranzAI Bridge
3. Enable **Allow access to file URLs**

## Development

```bash
# Install dependencies
npm install

# Build once
npm run build

# Watch mode
npm run dev

# Type check
npm run typecheck

# Run tests
npm test

# Clean build
npm run clean
```

### Project Structure

```
src/
├── background.ts      # Service worker - makes actual fetch calls
├── contentScript.ts   # Bridge between page and background
├── injected.ts        # Injected into page - hooks fetch/Request
├── manifest.json      # MV3 manifest
├── shared/
│   ├── constants.ts   # Timeouts, limits
│   ├── types.ts       # TypeScript interfaces
│   ├── messages.ts    # Message type constants
│   ├── providers.ts   # AI provider detection
│   ├── normalize.ts   # URL/header normalization
│   └── ...
└── sidepanel/
    ├── index.html     # Side panel UI
    └── sidepanel.ts   # Side panel logic
```

## Security Notes

- API keys in extension storage are **not accessible to page JavaScript**
- Origin allowlists prevent unauthorized pages from using the bridge
- Destination allowlists prevent pages from calling unauthorized APIs
- The bridge only forwards fetch - it cannot access cookies, localStorage, etc.

## Limitations

- **No streaming:** Bodies and responses are fully buffered
- **5 MB body limit:** Configurable but extension messaging has limits
- **No WebSocket:** Only HTTP fetch is bridged
- **Timing:** Extension message passing adds latency (~5-50ms)

## License

MIT
