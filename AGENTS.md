# Chrome Extension Engineering Principles

1. Solve one core user problem first; reject features that do not directly improve that primary job.
2. Define a strict scope in writing (must-have, nice-to-have, out-of-scope) and enforce it in every PR.
3. Keep architecture modular: isolate background, content scripts, UI, and shared domain logic with clean interfaces.
4. Prefer pure functions and immutable data in core logic to keep behavior deterministic and testable.
5. Minimize permissions (`manifest.json`) to the least required; every added permission must have explicit user value.
6. Optimize for speed and footprint: fast startup, low memory use, and minimal bundle size.
7. Make UX obvious in under 10 seconds: clear action labels, single primary CTA, and no clutter.
8. Design for trust: transparent data use, local-first storage when possible, and explicit consent for sensitive actions.
9. Build resilient flows: handle page changes, network failure, and API limits with graceful fallbacks.
10. Enforce quality gates: linting, type safety, unit tests for domain logic, and end-to-end tests for key user journeys.
11. Instrument only meaningful telemetry tied to user outcomes; review analytics regularly to remove dead features.
12. Continuously simplify: remove unused code, retire low-value UI, and keep the extension easy to understand and maintain.
