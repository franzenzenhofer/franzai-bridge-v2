# Google Auth API Design for FranzAI Bridge

**Date:** 2026-01-02
**Status:** Approved
**Author:** Franz + Claude

## Overview

FranzAI Bridge exposes `window.franzai.google.*` API letting developers authenticate with Google and access any Google API through a simple fetch interface. The extension handles OAuth, token storage, and refresh automatically.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Target audience | Developer tool | Devs use our API, zero config for them |
| OAuth credentials | Bundled in extension | Simple DX, we own verification |
| Auth pattern | Explicit auth call first | Clear contract, single consent screen |
| API style | Global state on window.franzai | Matches existing pattern |
| Token persistence | Forever (survives restarts) | Best DX, auto-refresh handled |
| Account model | Single account | Simple, logout to switch |
| API access | Raw fetch + future wrappers | Ship fast, iterate based on usage |
| Error handling | Throw exceptions | Matches existing franzai.fetch |
| Scope expansion | Incremental authorization | Add scopes later without re-auth |

## API Reference

### Authentication

```javascript
// Authenticate with scopes (shows consent if needed)
await franzai.google.auth(['webmasters.readonly', 'analytics.readonly']);

// Logout (clears tokens, next auth shows picker)
await franzai.google.logout();
```

### State Properties (sync)

```javascript
franzai.google.isAuthenticated;  // boolean
franzai.google.email;            // string | null
franzai.google.scopes;           // string[]
```

### Scope Checking (async, no prompt)

```javascript
// Check if specific scopes are already granted without triggering login
const hasAccess = await franzai.google.hasScopes(['webmasters.readonly']);
```

### API Access

```javascript
// Authenticated fetch to any Google API
const response = await franzai.google.fetch(url, init?);
const data = await response.json();
```

## Authentication Flow

### First-Time Auth
```
Developer calls:     franzai.google.auth(['webmasters.readonly'])
                           ↓
Extension checks:    No tokens in chrome.storage.local
                           ↓
Chrome Identity:     chrome.identity.getAuthToken({ scopes, interactive: true })
                           ↓
User sees:           Google account picker → Consent screen
                           ↓
Extension stores:    { email, accessToken, refreshToken, scopes, expiresAt }
                           ↓
Returns:             Promise resolves, state properties updated
```

### Returning User
```
Developer calls:     franzai.google.auth(['webmasters.readonly'])
                           ↓
Extension checks:    Tokens exist, scopes match, not expired
                           ↓
Returns:             Promise resolves immediately (no popup)
```

### Incremental Scopes
```
Developer calls:     franzai.google.auth(['webmasters.readonly', 'gmail.readonly'])
                           ↓
Extension checks:    Has webmasters, missing gmail
                           ↓
Chrome Identity:     Request only gmail.readonly (incremental)
                           ↓
User sees:           Consent for gmail only
                           ↓
Extension updates:   Merges new scope into stored tokens
```

### Token Refresh (automatic)
```
Developer calls:     franzai.google.fetch(...)
                           ↓
Extension checks:    Token expired
                           ↓
Background:          POST https://oauth2.googleapis.com/token
                     { refresh_token, client_id, client_secret, grant_type }
                           ↓
Google returns:      New accessToken (valid 1 hour)
                           ↓
Extension:           Updates storage, retries original request
                           ↓
Developer sees:      Just the response (never knew token refreshed)
```

## File Structure

```
src/
├── background.ts              # Add: Google auth message handlers
├── contentScript.ts           # Add: Relay Google messages
├── injected.ts                # Add: franzai.google.* API
├── shared/
│   ├── messages.ts            # Add: GOOGLE_* message types
│   ├── types.ts               # Add: GoogleAuthState type
│   ├── googleAuth.ts          # NEW: OAuth logic
│   │   ├── authenticate()
│   │   ├── refreshToken()
│   │   ├── logout()
│   │   └── getStoredAuth()
│   └── googleScopes.ts        # NEW: Scope validation
│       ├── SUPPORTED_SCOPES
│       ├── isValidScope()
│       └── getMissingScopes()
└── manifest.json              # Add: identity permission, oauth2 config
```

## Message Types

```typescript
export const GOOGLE_MSG = {
  AUTH_REQUEST: 'GOOGLE_AUTH_REQUEST',
  AUTH_RESPONSE: 'GOOGLE_AUTH_RESPONSE',
  LOGOUT_REQUEST: 'GOOGLE_LOGOUT_REQUEST',
  LOGOUT_RESPONSE: 'GOOGLE_LOGOUT_RESPONSE',
  FETCH_REQUEST: 'GOOGLE_FETCH_REQUEST',
  FETCH_RESPONSE: 'GOOGLE_FETCH_RESPONSE',
  STATE_REQUEST: 'GOOGLE_STATE_REQUEST',
  STATE_RESPONSE: 'GOOGLE_STATE_RESPONSE',
} as const;
```

## Storage Schema

```typescript
// chrome.storage.local
interface GoogleAuthStorage {
  google_auth: {
    email: string;
    accessToken: string;
    refreshToken: string;
    scopes: string[];
    expiresAt: number;  // Unix timestamp ms
  } | null;
}
```

## Manifest Changes

```json
{
  "permissions": [
    "storage",
    "identity"
  ],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": []
  },
  "key": "YOUR_EXTENSION_KEY"
}
```

## Error Codes

| Code | When |
|------|------|
| `USER_DENIED` | User cancelled consent |
| `POPUP_BLOCKED` | Browser blocked auth popup |
| `NETWORK_ERROR` | No internet connection |
| `INVALID_SCOPE` | Unknown scope requested |
| `SCOPE_NOT_SUPPORTED` | Scope not in allowed list |
| `NOT_AUTHENTICATED` | Called fetch before auth |
| `SCOPE_MISSING` | Token lacks required scope for API |
| `TOKEN_REVOKED` | User revoked access in Google settings |
| `TOKEN_REFRESH_FAILED` | Couldn't refresh expired token |

## v1 Supported Scopes

```typescript
const V1_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/analytics',
] as const;

// Shorthand aliases accepted
const SCOPE_ALIASES: Record<string, string> = {
  'webmasters.readonly': 'https://www.googleapis.com/auth/webmasters.readonly',
  'analytics.readonly': 'https://www.googleapis.com/auth/analytics.readonly',
  'analytics': 'https://www.googleapis.com/auth/analytics',
};
```

## Developer Usage Example

```javascript
async function getSearchConsoleSites() {
  // Check if already authenticated
  if (!franzai.google.isAuthenticated) {
    await franzai.google.auth(['webmasters.readonly']);
  }

  // Fetch from Google API
  const response = await franzai.google.fetch(
    'https://searchconsole.googleapis.com/webmasters/v3/sites'
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.siteEntry || [];
}

// Usage
try {
  const sites = await getSearchConsoleSites();
  console.log('Your sites:', sites);
} catch (e) {
  console.error('Failed:', e.message);
}
```

## Implementation Phases

### Phase 1: Foundation
- Add `identity` permission to manifest
- Create `googleScopes.ts` with scope validation
- Create `GoogleAuthStorage` types

### Phase 2: Background Auth
- Add message handlers in `background.ts`
- Implement `chrome.identity.getAuthToken()` flow
- Implement token storage/retrieval

### Phase 3: Token Refresh
- Implement refresh token logic
- Add proactive refresh (5 min before expiry)
- Handle refresh failures gracefully

### Phase 4: Injected API
- Add `franzai.google` object to `injected.ts`
- Wire up message passing through `contentScript.ts`
- Expose state properties

### Phase 5: Testing
- Unit tests for scope validation
- Integration tests for auth flow
- E2E test with real Google account

## Verification Path

| Phase | Scopes | User Limit | Effort |
|-------|--------|------------|--------|
| Dev/Test | Search Console, Analytics | 100 users | None |
| v1 Launch | Same | Unlimited | Basic verification |
| v2 Future | + Gmail, Drive, Sheets | Unlimited | Full verification |

## Google Cloud Setup

### Project Created
- **Project Name:** bridge2
- **Project ID:** bridge2-483104
- **Organization:** fullstackoptimization.com
- **Console URL:** https://console.cloud.google.com/apis/credentials?project=bridge2-483104

### Setup Steps (Manual - GCP Console Required)

#### Step 1: Configure OAuth Consent Screen
1. Go to https://console.cloud.google.com/apis/credentials/consent?project=bridge2-483104
2. Select **External** user type (or Internal for org-only)
3. Fill in app information:
   - App name: `FranzAI Bridge`
   - User support email: `team@fullstackoptimization.com`
   - Developer contact: `team@fullstackoptimization.com`
4. Add scopes:
   - `https://www.googleapis.com/auth/webmasters.readonly`
   - `https://www.googleapis.com/auth/analytics.readonly`
   - `https://www.googleapis.com/auth/analytics`
5. Save and continue

#### Step 2: Get Extension ID
1. Build the extension: `npm run build`
2. Go to `chrome://extensions`
3. Enable Developer Mode
4. Click "Load unpacked" and select the `dist/` folder
5. Copy the Extension ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

#### Step 3: Create OAuth Client
1. Go to https://console.cloud.google.com/apis/credentials?project=bridge2-483104
2. Click "Create Credentials" → "OAuth client ID"
3. Select **Chrome Extension** as application type
4. Name: `FranzAI Bridge Extension`
5. Enter the Extension ID from Step 2
6. Click Create
7. Copy the Client ID (format: `XXXXX.apps.googleusercontent.com`)

#### Step 4: Update manifest.json
Add to manifest.json:
```json
{
  "permissions": ["storage", "identity"],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": []
  }
}
```

### Extension Key (for stable ID)
To get a consistent extension ID across installs, generate a key:
```bash
# Generate key (one-time)
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A > key.txt
```
Then add to manifest.json:
```json
{
  "key": "YOUR_BASE64_KEY_HERE"
}
```
