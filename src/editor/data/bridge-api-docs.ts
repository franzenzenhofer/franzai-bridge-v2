/**
 * Bridge AI IDE - Embedded Bridge API Documentation
 * This is included in every AI system prompt for full context
 */

export const BRIDGE_API_DOCS = `## Bridge API Reference

### window.franzai (always available when extension installed)
\`\`\`typescript
interface FranzAI {
  version: string;                          // Bridge version
  keys: string[];                           // Available key names: ["openai", "anthropic", ...]

  // CORS-bypassing fetch (auto-injects API keys)
  fetch(url: string, init?: RequestInit): Promise<Response>;

  // Check if specific API key is configured
  hasApiKey(keyName: string): Promise<boolean>;

  // Get extension status
  getStatus(): Promise<BridgeStatus>;

  // Ping extension
  ping(): Promise<{ ok: true; version: string }>;
}
\`\`\`

### window.franzai.google (Google OAuth)
\`\`\`typescript
interface GoogleAPI {
  // Authenticate (triggers OAuth popup if needed)
  auth(scopes?: string[]): Promise<GoogleAuthState>;

  // Authenticated fetch (auto-adds Bearer token)
  fetch(url: string, init?: RequestInit): Promise<Response>;

  // Sign out
  logout(): Promise<void>;

  // Sync getters
  isAuthenticated: boolean;
  email: string | null;
  scopes: string[];
}
\`\`\`

### Example: OpenAI API call
\`\`\`javascript
const response = await window.franzai.fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});
const data = await response.json();
\`\`\`

### Example: Anthropic Claude API call
\`\`\`javascript
const response = await window.franzai.fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});
const data = await response.json();
\`\`\`

### Example: Google Search Console
\`\`\`javascript
// First authenticate
await window.franzai.google.auth(['https://www.googleapis.com/auth/webmasters.readonly']);

// Then fetch
const response = await window.franzai.google.fetch(
  'https://www.googleapis.com/webmasters/v3/sites'
);
const sites = await response.json();
\`\`\``;
