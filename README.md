# FranzAI Bridge V2

**CORS bypass + API key injection for browser AI apps**

Make API calls from any webpage. Your API keys stay secure in the extension.

[![Chrome Web Store](https://img.shields.io/badge/Chrome_111+-Install-blue?logo=googlechrome)](https://chrome.google.com/webstore/detail/franzai-bridge)
[![GitHub](https://img.shields.io/badge/GitHub-Source-black?logo=github)](https://github.com/franzenzenhofer/franzai-bridge-v2)
[![Documentation](https://img.shields.io/badge/Docs-bridge.franzai.com-green)](https://bridge.franzai.com/docs/)

---

## Quick Start

### 1. Install Extension
Requires **Chrome 111+**. Load from Chrome Web Store or build from source.

### 2. Add Your API Keys
Open the side panel → Settings → Click **"+ Add ENV Variable"**:

| Field | Description |
|-------|-------------|
| **Name** | Variable name (e.g., `MY_API_KEY`) |
| **Target Domain** | Where the key is sent (e.g., `api.example.com`) |
| **Value** | Your actual API key |

**Built-in keys** (auto-configured targets):
- `OPENAI_API_KEY` → `api.openai.com`
- `ANTHROPIC_API_KEY` → `api.anthropic.com`
- `GOOGLE_API_KEY` → `generativelanguage.googleapis.com`
- `MISTRAL_API_KEY` → `api.mistral.ai`
Legacy alias: `GEMINI_API_KEY` still works but maps to `GOOGLE_API_KEY`.

### 3. Enable Bridge for Your Page
Add this meta tag to your HTML `<head>`:
```html
<meta name="franzai-bridge" content="enabled">
```
Or use the toggle in the sidepanel header.

### 4. Make API Calls
```javascript
// Just use fetch() - the extension handles CORS and injects your API key
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "gpt-5-mini",
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
| **Per-Domain Control** | Enable/disable bridge per domain with toggle in header |
| **Meta Tag Opt-in** | Pages can request bridge via `<meta name="franzai-bridge">` |
| **Custom Rules** | Add your own injection rules for any API |
| **Allowlists** | Control which pages and APIs can use the bridge |
| **Race-Condition Free** | Guaranteed to hook fetch before any page script runs |

---

## Supported AI Providers (Verified January 2026)

| Provider | Models | ENV Variable |
|----------|--------|--------------|
| **OpenAI** | `gpt-5.2`, `gpt-5-mini`, `gpt-5-nano` | `OPENAI_API_KEY` |
| **Anthropic** | `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-haiku-4-5` | `ANTHROPIC_API_KEY` |
| **Google** | `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3-pro-preview` | `GOOGLE_API_KEY` |
| **Mistral** | `mistral-large-latest`, `mistral-small-latest`, `codestral-latest` | `MISTRAL_API_KEY` |

---

## Architecture

FranzAI Bridge uses Chrome's `world: "MAIN"` content script injection to **guarantee** the fetch hook is installed before any page script can run.

```
┌─────────────────────────────────────────────────────────────────────┐
│  CHROME INJECTS (before any page scripts)                           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  injected.js (MAIN WORLD)                                      │ │
│  │  - Hooks window.fetch + window.Request                         │ │
│  │  - Protected with Object.defineProperty (cannot be unhooked)   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │ postMessage                           │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  contentScript.js (ISOLATED WORLD)                             │ │
│  │  - Relays messages between page and background                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │ chrome.runtime                        │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  background.js (SERVICE WORKER)                                │ │
│  │  - Makes actual fetch() calls (no CORS restrictions)           │ │
│  │  - Injects API keys based on destination                       │ │
│  │  - Validates against allowlists                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Why Chrome 111+?** The `world: "MAIN"` feature requires Chrome 111 or later. This ensures synchronous script injection into the page context, eliminating race conditions.

---

## Usage Examples

### OpenAI
```javascript
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "gpt-5-mini",
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
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello Claude!" }]
  })
});
```

### Google Gemini
```javascript
const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
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
    model: "mistral-small-latest",
    messages: [{ role: "user", content: "Hello Mistral!" }]
  })
});
```

### Replicate
```javascript
const response = await fetch("https://api.replicate.com/v1/predictions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Token YOUR_REPLICATE_API_TOKEN"
  },
  body: JSON.stringify({
    version: "model-version-id",
    input: { prompt: "Generate a scenic photo of mountains" }
  })
});
```

### Hugging Face Inference
```javascript
const response = await fetch("https://api-inference.huggingface.co/models/gpt2", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_HF_API_TOKEN"
  },
  body: JSON.stringify({ inputs: "Once upon a time" })
});
```

---

## Configuration

### Environment Variables (API Keys)
Each ENV variable has three properties:

| Property | Description |
|----------|-------------|
| **Name** | Variable name (e.g., `MY_API_KEY`) |
| **Target** | Domain where the key is sent (security boundary) |
| **Value** | Your actual API key (stored securely, never exposed to pages) |

**Security:** Keys are target-restricted. A key configured for `api.openai.com` will ONLY be sent to `api.openai.com` - never to other domains.

### Allowed Page Origins
Pages that can use the bridge. Default: `*` (all pages).

Examples: `https://mysite.com/*`, `http://localhost:*`, `file://*`

### Allowed Destinations
APIs the bridge can call. Default: `*` (all URLs).

Examples: `api.openai.com`, `*.anthropic.com`, `https://api.mistral.ai/*`

---

## Per-Domain Control

The bridge is **disabled by default** on all domains for security. Enable it per-domain:

### Header Toggle
The sidepanel header shows the current domain with an ON/OFF switch. Toggle to enable/disable.

### Meta Tag Opt-in
Pages can request bridge activation with a meta tag:

```html
<meta name="franzai-bridge" content="enabled">
```

The meta tag enables the bridge automatically, but **user settings always override** the meta tag.

### Priority
1. **User setting** (explicit toggle) - highest priority
2. **Meta tag** - page-requested enable
3. **Default** - OFF (bridge inactive)

### Domains View
Click "Domains" in the sidepanel to see all domains with preferences and manage them.

### Debug Status
```javascript
// Get detailed status for debugging
const status = await window.franzai.getStatus();
console.log(status);
// {
//   installed: true,
//   version: "2.0.53",
//   domainEnabled: true,
//   domainSource: "meta",  // or "user" or "default"
//   originAllowed: true,
//   hasApiKeys: true,
//   ready: true,
//   reason: "Bridge is ready"
// }
```

---

## Bridge Modes

| Mode | Behavior |
|------|----------|
| `always` (default) | Route ALL requests through bridge (enables inspector) |
| `auto` | Bridge cross-origin requests only |
| `off` | Disable bridge, use native fetch |

```javascript
// Set mode globally
window.franzai.setMode("auto");

// Per-request override
fetch(url, { franzai: { mode: "always" } });

// Configure before page loads
window.__franzaiBridgeConfig = { mode: "auto", lockHooks: true };
```

---

## Direct API

```javascript
// Check if bridge is available
const { ok, version } = await window.franzai.ping();

// Explicit bridge call
await window.franzai.fetch(url, options);

// Get/set mode
window.franzai.getMode();
window.franzai.setMode("always");

// Check if an API key is configured (never returns the actual key!)
const hasOpenAI = await window.franzai.isKeySet("OPENAI_API_KEY");
const hasOpenAI2 = await window.franzai.hasApiKey("OPENAI_API_KEY");

// Get configured key names (values are never exposed)
const keys = window.franzai.keys; // e.g., ["OPENAI_API_KEY", "MISTRAL_API_KEY"]

// Get detailed bridge status (great for debugging)
const status = await window.franzai.getStatus();
// Returns: { installed, version, domainEnabled, domainSource, originAllowed, hasApiKeys, ready, reason }
```

---

## Security

| Protection | Description |
|------------|-------------|
| **Keys never exposed** | Stored in extension storage, injected at network layer |
| **Target-restricted** | Each key only sent to its configured domain |
| **Hook protection** | `window.fetch` cannot be overwritten by page scripts |
| **Origin allowlists** | Control which pages can use the bridge |
| **Destination allowlists** | Control which APIs can be called |
| **No ambient authority** | Bridge only forwards fetch, no access to cookies/storage |

```
┌─────────────────────────────────────────────────────────────────┐
│  OPENAI_API_KEY → api.openai.com ONLY                           │
│  ANTHROPIC_API_KEY → api.anthropic.com ONLY                     │
│  MY_CUSTOM_KEY → api.example.com ONLY (you configure this)      │
└─────────────────────────────────────────────────────────────────┘
```

A malicious page can USE the bridge to make API calls, but cannot STEAL your keys - they're never returned to page JavaScript.

---

## Request Inspector

The side panel shows all bridged requests with:
- Time, Method, Host, Path, Status, Timing
- Request/response headers and body preview
- API keys automatically masked

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `↓` | Next request |
| `k` / `↑` | Previous request |
| `c` | Copy selected request |
| `/` | Focus search filter |
| `r` | Refresh |
| `Esc` | Clear filters |

---

## Limitations

- **No streaming** - Bodies fully buffered (5 MB limit)
- **No WebSocket** - HTTP fetch only
- **Chrome 111+** - Uses `world: "MAIN"` for guaranteed hook installation
- **Latency** - Extension messaging adds ~5-50ms

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
npm test           # Run tests (238 tests)
npm run build      # Production build
```

---

## Project Structure

```
src/
├── background.ts      # Service worker - makes fetch calls
├── contentScript.ts   # Message relay (ISOLATED world)
├── injected.ts        # Hooks fetch/Request (MAIN world)
├── manifest.json      # Chrome MV3 manifest
├── shared/            # Shared types, constants, utilities
└── sidepanel/         # Request inspector UI
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Extension not detected | Reload page, check extension enabled in chrome://extensions |
| API key not injected | Check ENV var name matches exactly (e.g., `OPENAI_API_KEY`) |
| "Page origin not allowed" | Add your page URL to Allowed Origins in Settings |
| "Destination not allowed" | Add the API domain to Allowed Destinations in Settings |
| 401 Unauthorized | API key is invalid or expired |

---

## License

MIT

---

## Links

- **Documentation:** [bridge.franzai.com/docs/](https://bridge.franzai.com/docs/)
- **Website:** [bridge.franzai.com](https://bridge.franzai.com)
- **GitHub:** [github.com/franzenzenhofer/franzai-bridge-v2](https://github.com/franzenzenhofer/franzai-bridge-v2)
