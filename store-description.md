# Chrome Web Store Listing

## Extension Name
FranzAI Bridge

## Short Description (132 characters max)
CORS bypass + API key injection for browser AI apps. Call OpenAI, Claude, Gemini, Mistral from any webpage securely.

## Detailed Description

**Make AI API calls from any webpage. Your API keys stay secure.**

FranzAI Bridge is a developer tool that solves two problems:
1. CORS restrictions that block cross-origin API calls from browsers
2. API key security - exposing keys in client-side code

### How It Works
The extension intercepts fetch() calls and routes them through its background script, which has no CORS restrictions. API keys are stored securely in extension storage and auto-injected into requests.

### Features
- **CORS Bypass**: Make cross-origin requests from any webpage
- **Secure API Keys**: Keys stored in extension storage, never exposed to page JS
- **Request Inspector**: DevTools-style panel shows all requests/responses
- **Multi-Provider**: Built-in support for OpenAI, Anthropic, Google Gemini, Mistral
- **Custom Rules**: Add injection rules for any API
- **Allowlists**: Control which pages and APIs can use the bridge

### Supported AI Providers
- OpenAI (GPT-4, ChatGPT)
- Anthropic (Claude)
- Google Gemini
- Mistral AI
- Any custom API with configurable injection rules

### Use Cases
- Build AI-powered static websites without a backend
- Test AI APIs directly from HTML pages
- Rapid prototyping of AI applications
- Browser-based AI tools and demos

### Privacy
All data (API keys, settings) is stored locally on your device. No data is sent to external servers except your API requests to the providers you specify.

### Open Source
FranzAI Bridge is open source and available on GitHub.

## Category
Developer Tools

## Language
English

## Website
https://bridge.franzai.com

## Support URL
https://github.com/franzenzenhofer/franzai-bridge-v2/issues

## Privacy Policy URL
https://bridge.franzai.com/privacy.html
