# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]
### Added
- Port-based streaming pipeline with inactivity timeouts and SSE detection.
- WebSocket proxy bridge with page-level hooking.
- Request caching and retry with backoff.
- Editor context panel, prompt history, suggestion chips, and markdown rendering.
- Sidepanel HAR export, cURL copy, collapsible sections, and per-entry delete.
- Unit tests for editor store + prompt builder and editor E2E tests.

### Changed
- Editor preview controls (device toggles, format, pop-out, kill preview, error HUD).
- Stronger system prompt defaults for modern UI output.
- TypeScript strictness via `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

### Fixed
- Binary-safe response handling and abort cleanup.
- Better origin/destination error messages and timeout guidance.

### Tests
- Added Vitest coverage for editor state logic and prompt generation.
- Added Playwright editor flow tests with mocked AI responses.
