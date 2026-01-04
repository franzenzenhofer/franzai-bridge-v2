# Branching and Release Strategy

## Branch Model
- `main` is trunk and always releasable.
- Feature branches are short-lived:
  - `feat/<ticket>-<slug>` for new work
  - `fix/<ticket>-<slug>` for bug fixes
  - `chore/<slug>` for tooling/docs
- Release branches:
  - `release/x.y.z` cut from `main` for stabilization only.
- Hotfix branches:
  - `hotfix/x.y.z` cut from release tag for urgent production fixes.

## Pull Request Flow
- Keep PRs under 400 lines when possible.
- Prefer squash merges to keep history clean.
- Required checks before merge:
  - `npm run typecheck`
  - `npm test`
  - `npm run build:nobump`
  - `npm run build:editor`

## Commit Convention
Use Conventional Commits:
- `feat(scope): summary`
- `fix(scope): summary`
- `refactor(scope): summary`
- `docs(scope): summary`
- `test(scope): summary`
- `chore(scope): summary`
- `perf(scope): summary`
- `ci(scope): summary`

Guidelines:
- Imperative mood, max 72 characters in subject.
- Add context in the body if behavior changes or migrations are needed.

## Changelog Policy
- Maintain `CHANGELOG.md` using Keep a Changelog format.
- Every user-visible change updates the Unreleased section.
- On release, move Unreleased to `x.y.z` and tag `vX.Y.Z`.

## Versioning
- SemVer across `package.json` and `public/downloads/version.json`.
- Use `npm run build` for release builds (version bump included).
- Use `npm run build:nobump` for local/CI builds.
