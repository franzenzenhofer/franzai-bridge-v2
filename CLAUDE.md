# CLAUDE.md - FranzAI Bridge V2

## Project Overview
Chrome MV3 extension for CORS bypass with API key injection and sidepanel inspector.

## Build Commands
```bash
npm run build      # Build extension to dist/
npm run typecheck  # TypeScript type checking
npm run dev        # Watch mode for development
```

## Architecture
- `src/background.ts` - Service worker for CORS bypass
- `src/contentScript.ts` - Content script for page communication
- `src/injected.ts` - Injected script for franzai.fetch API
- `src/sidepanel/` - Sidepanel UI (HTML, CSS, TypeScript)

## Design Rules

### LIGHT MODE ONLY
**This extension uses light mode exclusively. Never add dark mode or theme switching.**
- The UI follows Chrome DevTools light mode aesthetic
- All colors are defined in CSS `:root` variables for light theme only
- Do not add theme toggles, dark mode CSS, or theme persistence

### UI/UX Guidelines
- DevTools-inspired compact design
- Monospace fonts for technical data
- Clean, professional appearance
- Keyboard shortcuts for power users
