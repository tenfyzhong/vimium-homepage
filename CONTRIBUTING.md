# Contributing

Thanks for your interest in contributing to Vimium Homepage.

## Repository conventions

See `AGENTS.md` for the full list; the essentials:

- TDD: write the test first and confirm it fails (red), then implement until it passes (green).
- All commits must be signed-off: `git commit -s`.
- No trailing whitespace in any file.
- YAML / JSON use 2-space indentation.
- No build step: plain static files; the hosted page (`site/index.html`) is a single self-contained file with zero external network requests.
- `docs/vimium-homepage-design.md` is maintained by the coordinator; implementers must not modify it.

## Getting started

1. Fork the repository and clone your fork.
2. Install test dependencies: `npm install`
3. Run the E2E suite: `npm test` (downloads stock vimium 2.4.2 from a pinned release into `tests/.cache/` on first run)

## Making changes

- Open an issue or discussion first for non-trivial changes; bug fixes and small improvements are welcome directly.
- Keep changes focused: one logical change per PR.
- Update the design document (`docs/vimium-homepage-design.md`) when behavior or shared contracts change — it is coordinator-owned, so coordinate with the maintainers first.
- Update `README.md` when user-facing behavior changes.

## Testing

- The E2E suite (`npm test`) asserts 12 observable contracts: extension loading, new-tab redirect, system-theme rendering (light and dark), native Vomnibar summon/focus/navigation/Esc, zero external requests, quick-link persistence, canonical-URL enforcement, unsafe-scheme rejection, and splash system-theme following.
- The suite launches Playwright's bundled Chromium with both extensions loaded; branded Chrome 137+ removed `--load-extension` and cannot be used for automation.
- Before submitting, run `npm test` locally and confirm all 12 pass.

## Commits and pull requests

- Sign off every commit: `git commit -s` (adds a `Signed-off-by` line).
- Push your branch and open a pull request; reference the related issue if any.
- Address review comments and keep the branch rebased on `main`.
