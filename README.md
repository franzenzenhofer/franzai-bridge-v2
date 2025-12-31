# FranzAI Bridge V2

**CORS bypass + API key injection for browser AI apps**

Make API calls from any webpage. Your API keys stay secure in the extension.

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Install-blue?logo=googlechrome)](https://chrome.google.com/webstore/detail/franzai-bridge)
[![GitHub](https://img.shields.io/badge/GitHub-Source-black?logo=github)](https://github.com/franzenzenhofer/franzai-bridge-v2)

---

## Quick Start

### 1. Install Extension
Load from Chrome Web Store or build from source (see below).

### 2. Add Your API Keys
Open the side panel and add your keys:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `MISTRAL_API_KEY`

### 3. Make API Calls
```javascript
// Just use fetch() - the extension handles CORS and injects your API key
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello!" }]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

That's it. No backend needed.

---

## Features

| Feature | Description |
|---------|-------------|
| **CORS Bypass** | Make cross-origin requests from any webpage |
| **API Key Injection** | Keys auto-injected per provider, never exposed to page JS |
| **Request Inspector** | DevTools-style panel shows all requests/responses |
| **Multi-Provider** | Built-in support for OpenAI, Anthropic, Google, Mistral |
| **Custom Rules** | Add your own injection rules for any API |
| **Allowlists** | Control which pages and APIs can use the bridge |

---

## Supported AI Providers

| Provider | Header Injected | ENV Variable |
|----------|-----------------|--------------|
| OpenAI | `Authorization: Bearer $KEY` | `OPENAI_API_KEY` |
| Anthropic | `x-api-key: $KEY` | `ANTHROPIC_API_KEY` |
| Google Gemini | `x-goog-api-key: $KEY` | `GOOGLE_API_KEY` |
| Mistral | `Authorization: Bearer $KEY` | `MISTRAL_API_KEY` |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR PAGE                                                  │
│                                                             │
│  fetch("https://api.openai.com/...")                        │
│       │                                                     │
│       ▼                                                     │
│  [Hooked fetch] ──► postMessage to content script           │
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
│  1. Validates request against allowlists                     │
│  2. Injects API keys from ENV vars                           │
│  3. Makes real fetch() call                                  │
│  4. Returns response to page                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Allowed Page Origins
Pages that can use the bridge. Default: `*` (all pages).

Examples:
- `https://mysite.com/*`
- `http://localhost:*`
- `file://*`

### Allowed Destinations
APIs the bridge can call. Default: `*` (all URLs).

Examples:
- `api.openai.com`
- `*.anthropic.com`
- `https://api.mistral.ai/*`

### Environment Variables
Key-value pairs stored securely in the extension. Used for API key injection.

### Custom Injection Rules
Add rules to inject headers/query params for any API:

```
Host: api.custom.com
Headers: { "X-API-Key": "${MY_CUSTOM_KEY}" }
```

---

## Usage Examples

### OpenAI Chat
```javascript
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "gpt-4",
    messages: [{ role: "user", content: "Explain CORS in one sentence." }]
  })
});
```

### Anthropic Claude
```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01"
  },
  body: JSON.stringify({
    model: "claude-3-haiku-20240307",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello Claude!" }]
  })
});
```

### Google Gemini
```javascript
const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Hello Gemini!" }] }]
    })
  }
);
```

### Mistral
```javascript
const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "mistral-tiny",
    messages: [{ role: "user", content: "Hello Mistral!" }]
  })
});
```

---

## Bridge Modes

| Mode | Behavior |
|------|----------|
| `auto` (default) | Bridge cross-origin requests only |
| `always` | Route ALL requests through bridge |
| `off` | Disable bridge, use native fetch |

### Set Mode
```javascript
// Global mode
window.franzai.setMode("always");

// Per-request
fetch(url, { franzai: { mode: "always" } });

// Before page loads
<script>window.__franzaiBridgeConfig = { mode: "always" };</script>
```

---

## Direct API

```javascript
// Explicit bridge call
await window.franzai.fetch(url, options);

// Check if bridge is available
const { ok, version } = await window.franzai.ping();

// Get/set mode
window.franzai.getMode();
window.franzai.setMode("always");
```

---

## Request Inspector

The side panel shows all bridged requests:

- **Time** - When request was made
- **Method** - GET, POST, PUT, DELETE, PATCH
- **Host** - API hostname
- **Path** - Request path
- **Status** - HTTP status code
- **Timing** - Elapsed milliseconds

Click any request to see:
- Full URL
- Request headers (with injected keys masked)
- Request body preview
- Response headers
- Response body preview

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `↓` | Next request |
| `k` / `↑` | Previous request |
| `c` | Copy selected request |
| `/` | Focus search filter |
| `r` | Refresh |
| `Esc` | Clear filters / Close detail |

---

## Security

- **API keys never exposed to page JavaScript** - stored in extension storage
- **Origin allowlists** - control which pages can use the bridge
- **Destination allowlists** - control which APIs can be called
- **No ambient authority** - bridge only forwards fetch, no access to cookies/storage

---

## Limitations

- **No streaming** - Bodies fully buffered (5 MB limit)
- **No WebSocket** - HTTP fetch only
- **Latency** - Extension messaging adds ~5-50ms
- **Chrome only** - MV3 Chrome extension

---

## Installation (Build from Source)

```bash
# Clone
git clone https://github.com/franzenzenhofer/franzai-bridge-v2.git
cd franzai-bridge-v2

# Install
npm install

# Build
npm run build

# Load in Chrome
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the dist/ folder
```

### Development

```bash
npm run dev        # Watch mode
npm run typecheck  # Type check
npm test           # Run tests
npm run build      # Production build
```

---

## Project Structure

```
src/
├── background.ts      # Service worker - makes fetch calls
├── contentScript.ts   # Bridge between page and extension
├── injected.ts        # Hooks window.fetch and Request
├── manifest.json      # Chrome MV3 manifest
├── shared/            # Shared types, constants, utilities
└── sidepanel/         # Request inspector UI
    ├── index.html
    ├── sidepanel.ts
    └── style.css
```

---

## Troubleshooting

### "Page origin not allowed"
Add your page URL to **Allowed Page Origins** in the side panel.

### "Destination not allowed"
Add the API host to **Allowed Destinations** in the side panel.

### API key not being injected
1. Check the ENV var name matches (e.g., `OPENAI_API_KEY`)
2. Check the injection rule exists for that host
3. Verify the key is saved (not just entered)

### Extension not detected
1. Reload the page
2. Check extension is enabled in `chrome://extensions`
3. Try `await window.franzai.ping()` in console

---

## License

MIT

---

## Links

- **Website:** [bridge.franzai.com](https://bridge.franzai.com)
- **GitHub:** [github.com/franzenzenhofer/franzai-bridge-v2](https://github.com/franzenzenhofer/franzai-bridge-v2)
- **Chrome Web Store:** Coming soon
