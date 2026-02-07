# Golden Goal Plan (AGENTS.md)

## Goal
Ship a Chrome extension that strictly follows the 12 principles in `AGENTS.md`: focused scope, modular architecture, pure core logic, high UX clarity, strong quality, and zero feature bloat.

## Agile GitHub Strategy TODO

### 1. Align Scope and Backlog
- [ ] Create one GitHub Epic: `Golden Goal - AGENTS.md Compliance`.
- [ ] Convert each principle in `AGENTS.md` into one measurable issue with acceptance criteria.
- [ ] Label all issues with `must-have`, `nice-to-have`, or `out-of-scope`.
- [ ] Reject or close issues that do not improve the core user job.

### 2. Branch and PR Workflow
- [ ] Keep `main` protected and always releasable.
- [ ] Use short-lived branches: `feat/*`, `fix/*`, `chore/*`.
- [ ] Enforce one issue per branch and one focused goal per PR.
- [ ] Require PR template sections: scope, UX impact, permissions impact, tests, rollback plan.

### 3. Architecture and Code Quality
- [ ] Split code into modules: background, content scripts, UI, shared domain layer.
- [ ] Keep business logic pure-functional where possible; isolate side effects.
- [ ] Add/verify type checks, linting, formatting, and duplicate-code checks in CI.
- [ ] Block merge if complexity, duplication, or coupling increases above agreed thresholds.

### 4. UX Quality and Trust
- [ ] Define one primary user flow and optimize for completion under 10 seconds.
- [ ] Validate every UI change with a simple usability checklist before merge.
- [ ] Audit permissions and data handling for least privilege and explicit consent.
- [ ] Remove low-value UI elements quickly instead of adding alternatives.

### 5. Testing and Release Discipline
- [ ] Require unit tests for domain logic and E2E tests for critical journeys.
- [ ] Run CI on every PR: build, lint, types, tests, bundle size, permission diff.
- [ ] Use staged releases and monitor telemetry tied to real user outcomes.
- [ ] Run a weekly cleanup task: remove dead code, stale flags, and unused UI.

### 6. Definition of Done
- [ ] Feature solves the core problem and matches one existing issue.
- [ ] No new permission without explicit user value and review note.
- [ ] Tests pass and no quality gate regresses.
- [ ] UX is simpler or clearer than before.
- [ ] No feature bloat introduced.

## Current Execution Branch
- `chore/agents-golden-goal-strategy`
