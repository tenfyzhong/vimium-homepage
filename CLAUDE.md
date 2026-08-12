# CLAUDE.md

Repository conventions (all agents must follow):

- TDD: write the test first and confirm it fails (red), then implement until it passes (green).
- All commits must be signed-off: `git commit -s`.
- No trailing whitespace in any file.
- YAML / JSON use 2-space indentation.
- No build step: plain static files; the hosted page is a single self-contained file with zero external network requests.
- `docs/vimium-homepage-design.md` is maintained by the coordinator; implementers must not modify it.
