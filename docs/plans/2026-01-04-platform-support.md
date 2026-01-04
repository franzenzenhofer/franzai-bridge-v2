# Platform Support Plan (Firefox + Safari)

## Goals
- Define a clear path to ship Firefox and Safari builds without breaking Chrome MV3 behavior.
- Keep the core Bridge API stable across browsers.
- Document known gaps and acceptable fallbacks.

## Firefox Support Plan
### Scope
- Support MV3 in Firefox (minimum Firefox 109+).
- Preserve `window.franzai` API surface and sidepanel UX where available.

### Technical Work
1. Manifest adjustments
   - Add `browser_specific_settings.gecko.id`.
   - Validate permissions and host permissions for MV3.
   - Confirm `web_accessible_resources` syntax compatibility.

2. API compatibility
   - Introduce a small `browser`/`chrome` wrapper (use `webextension-polyfill` or local shim).
   - Audit `chrome.scripting.executeScript` and `world: "MAIN"` support.
   - Validate `sidePanel` availability; if missing, fall back to a popup or dedicated page.

3. Background/service worker
   - Verify long-lived Port streaming and WebSocket proxy reliability.
   - Ensure fetch and stream timeouts behave under Firefox MV3 service worker lifecycle.

4. Testing
   - Add a Firefox target in Playwright for smoke tests (extension load + fetch + sidepanel).
   - Manual verification in `about:debugging` for injection, streaming, and WebSocket.

### Deliverables
- `manifest.firefox.json` or build-time transform.
- Compatibility wrapper module (`src/shared/browser.ts`).
- Firefox smoke tests and release notes.

## Safari Support Plan
### Scope
- Ship as a Safari Web Extension with a reduced feature set if needed.
- Keep bridge fetch working; sidepanel may require alternative UI.

### Technical Work
1. Project conversion
   - Use `xcrun safari-web-extension-converter` on the Chrome build output.
   - Create Xcode project for signing and distribution.

2. API compatibility
   - Replace `chrome` usage with `browser` polyfill or `safari` fallbacks.
   - Validate content script injection; `world: "MAIN"` may require fallback injection.
   - Confirm `service_worker` behavior; Safari may require background pages.

3. UI considerations
   - Safari lacks Chrome sidePanel; provide a popup or new tab inspector.
   - Ensure editor and sidepanel assets load via `web_accessible_resources` rules.

4. Testing
   - Manual testing in Safari Technology Preview.
   - Verify streaming, caching, and WebSocket proxy behavior.

### Deliverables
- Safari Xcode project with build instructions.
- `manifest.safari.json` notes or conversion script.
- Feature parity matrix + known limitations list.

## Milestones
1. Research + compatibility matrix (1-2 days)
2. Firefox build + smoke tests (2-4 days)
3. Safari conversion + manual QA (4-7 days)
4. Documentation + release notes
