# Vimium Homepage — Design Document

Task ID: `vimium-homepage` · Repository: `/Users/zhongtenghui/go/src/github.com/tenfyzhong/vimium-homepage` (greenfield, no commits) · Status: confirmed

## 1. Problem statement

The user's Chrome has vimium installed, but vimium does not work on `chrome://newtab` (Chrome internal pages forbid content-script injection). The user installed a third-party "vimium new page tab" extension that redirects new tabs to a remote blank page where vimium works, but the page is "too plain" and "loads very slowly".

Goal: deliver a Chrome extension that replaces the new tab with a **beautiful, instant** page; vimium works there; vimium's **Vomnibar is embedded in the page design** (appears inside a designed search slot instead of vimium's default floating popup); summoned with `o` (the slot shows a guidance hint on page load).

## 2. Confirmed decisions (decision gate, user-selected)

1. **Hosting**: GitHub Pages (this repo), page URL `https://tenfyzhong.github.io/vimium-homepage/`, published from `site/` by `.github/workflows/pages.yml`.
2. **Interaction**: press-`o` summon (honest approach; decision revised 2026-08-12). Official vimium **does not support** a custom auto-focus URL (`lib/settings.js:8` hardcoded constant, no storage override) — the original "auto-focus" decision was infeasible. Confirmed with the user: on page load the slot shows a guidance hint ("Press o to search"); pressing `o`/`O`/`b`/`B`/`t`/`T` brings the Vomnibar into the design slot, fully embedded in style and position.
3. **Visual**: dark terminal × typographic details (dark background, monospace accents, amber/emerald accents, noise texture; large clock + date + time-of-day greeting + editable quick links). English UI.

Implicit decisions: no build step (plain static files); the page is a single self-contained file with **zero external network requests** (inline CSS/JS, system font stack, no CDN/remote fonts/images); extension pages (redirect/options) use external JS files (MV3 default CSP forbids inline scripts); quick-links source = in-page editing + localStorage persistence (`chrome.topSites`/`chrome.bookmarks` are unavailable to the hosted page, see §9).

## 3. Feasibility constraints (research evidence, all verified)

- vimium 2.4.2 (MV3, min Chrome 117) content script matches only `["<all_urls>"]` (manifest.json:44-46); Chrome match patterns only permit http/https/file/ftp schemes, and `<all_urls>` cannot match `chrome-extension://` → **vimium can never inject into an extension's own newtab override page** (any extension's). Therefore the newtab override must `location.replace` to the hosted http(s) page.
- **vimium auto-focus is not configurable (verified empirically 2026-08-12)**: `Settings.vimiumNewTabPageUrl` is a module constant (`lib/settings.js:8`); the auto-open condition `document.location.href == Settings.vimiumNewTabPageUrl` (vimium_frontend.js:257) only ever matches vimium's official page; the options UI (options.html:70-88) only has `newTabDestination` (where the `t` key opens tabs) and an "open Vomnibar on vimium's official new tab page" toggle — no custom field; master is identical. → Delivery form = press-`o` summon, **zero vimium configuration dependency**. The canonical URL (`/index.html` → `./`; bare path without trailing slash → append `/`) is kept for URL hygiene (not a vimium dependency).
- Vomnibar DOM (inside the host page): `div.vimium-reset` (open shadow root, direct child of `<html>`) contains `iframe.vomnibar-frame`; the HUD lives in a separate `div.vimium-reset` containing `iframe.vimium-hud-frame`. Geometry lives in the shadow-root stylesheet (`position:fixed; width:calc(80%+20px); min-width:400px; height:calc(100%-70px); top:70px; left:50%; margin-left:-40%; z-index:2147483647`, vimium.css:204-220). Visibility is toggled by classes `vimium-ui-component-visible/hidden`. Components are created **lazily**: they only appear on first activation.
- Because the shadow root is open: host-page JS can inject a `<style>` into `shadowRoot` to override positioning and colors (page CSS cannot pierce the shadow DOM); CSS custom properties pierce the shadow boundary (define them on the host `:root`, reference with `var()` inside the shadow).
- vimium's web_accessible_resources declare no `extension_ids`, so other extensions cannot iframe/load vimium's pages (this capability is not needed).
- MV3 extension pages default CSP `script-src 'self'` forbids inline scripts → the JS for `redirect.html`/`options.html` must be external files.

## 4. Architecture and shared contracts

```
chrome://newtab
  → chrome_url_overrides.newtab = redirect.html (chrome-extension://, instant same-style splash)
  → location.replace(chrome.storage.sync targetUrl, default https://tenfyzhong.github.io/vimium-homepage/)
  → site/index.html (hosted page, single self-contained file)
    → vimium injects (<all_urls> matches http(s))
    → user presses o / b / t → vimium activates the Vomnibar (lazily created iframe)
    → page JS (MutationObserver) detects div.vimium-reset → injects <style> into the open shadowRoot
      → iframe.vomnibar-frame repositioned into the design slot (--vomnibar-top etc. CSS variables), colors inherit the dark theme
```

| Contract | Definition |
|---|---|
| `canonical-url` | Page JS enforces: `pathname.endsWith('/index.html')` → `./`; bare path without trailing slash or file extension → append `/` (URL hygiene, not a vimium dependency) |
| `storage-keys` | This extension `chrome.storage.sync.targetUrl` (default GH Pages URL); page `localStorage['vimium-homepage-links']` = `[{label,url}]`. **Never write vimium's storage** (writing triggers vimium's pre-2.0 migration JSON.parse crash; the E2E also does not write) |
| `vomnibar-selectors` | `div.vimium-reset` (with open shadowRoot) → `iframe.vomnibar-frame` / `iframe.vimium-hud-frame`; visibility classes `vimium-ui-component-visible/hidden`; selectors centralized in one place, asserting behavior rather than implementation details (vimium renamed CSS classes once in 2.3.0; tests lock behavior) |
| `embedding-technique` | MutationObserver(childList) on `document.documentElement` → find the shadowRoot containing `iframe.vomnibar-frame` → inject `<style>` (idempotent, boolean guard) → `top: var(--vomnibar-top)`, width/height matched to the content area, `background/color` via CSS variables, drop the default `margin-left:-40%` centering in favor of content-area alignment |
| `summon-contract` | Pressing `o`/`O`/`b`/`B`/`t`/`T` summons the Vomnibar (vimium default behavior, zero config); the embedding code works for every summon path |
| `gh-pages-url` | `https://tenfyzhong.github.io/vimium-homepage/` (trailing slash) |

## 5. Visual design specification (dark terminal × typographic details)

- **Palette** (CSS variables on `:root`): background `#0b0e14`; panel `#12161f`; primary text `#e6e6e6`; weak text `#8b93a7`; accent amber `#ffb000`; success/link green `#00e5a0`; divider `rgba(230,230,230,.08)`. Contrast meets WCAG AA (amber on dark ≥ 4.5:1 verified).
- **Typography**: system monospace stack `ui-monospace, 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace` (zero external requests; renders as SF Mono on macOS); clock numerals use `font-variant-numeric: tabular-nums` + 800 weight + very large size (≈15vw/120px cap); auxiliary text small monospace with wide tracking (`letter-spacing: .08em`).
- **Layout**: header at top (greeting line + date line, small monospace weak color); central Vomnibar slot (visually a "command input area": thin border, amber caret decoration, `--vomnibar-top` is this slot's top edge); quick-links grid below (editable cards); a tiny version/hint line at the bottom.
- **Background atmosphere**: inline base64 noise texture (1-2px PNG tiled at low opacity) + subtle top gradient glow; blinking colon animation on the clock; staggered reveal on page load (animation-delay); subtle breathing on the slot border. All static under `prefers-reduced-motion: reduce`.
- **Copy**: greetings `Good morning / Good afternoon / Good evening / Late night` (by hour); date `Aug 12, 2026 · Wed`; slot default hint `Press o to search` (fades out when the Vomnibar is visible).

## 6. Interaction design

- New tab loading: redirect.html shows the same-style dark splash (instant) → `location.replace` → hosted page (after caching, typically <300ms TTFB + a single request). No white screen, no visible jump.
- Vomnibar embedding: the user presses `o` (or b/t etc.) → vimium `Vomnibar.activate()` lazily creates the iframe → page JS (MutationObserver) immediately injects the style so it appears in the design slot (no longer a top floating layer). The slot hint fades out when the Vomnibar is visible.
- Focus: vimium handles it (after activation the focus enters the Vomnibar input); Esc closes it (vimium behavior, restores `vimium-ui-component-hidden`).
- HUD: kept (needed for link hints), restyled via injected style to a small bottom-right element that fits the theme.
- Quick links: click to navigate; hover reveals Edit/Delete; "＋ Add" at the bottom; persisted in localStorage; seeded with a set of common sites.
- Fallback: no vimium configuration needed; any vimium command that summons the Vomnibar (o/O/b/B/t/T) lands in the design slot. Without vimium installed the page still renders (clock, quick links) and the slot hint guides the install.
- Focus reality: when a new tab opens, focus is in the address bar (Chrome behavior; the page cannot steal it). The guidance hint states this truthfully: click the page or press Tab/Esc to leave the address bar, then press `o` (short copy, fades after first load).

## 7. File list

```
manifest.json                 MV3: chrome_url_overrides.newtab→redirect.html; options_ui; permissions:[storage]
redirect.html + redirect.js   instant dark splash + location.replace(targetUrl) (external JS, CSP-compliant)
options.html + options.js     configure custom targetUrl (English UI, chrome.storage.sync)
site/index.html               hosted design page (single self-contained file, inline CSS/JS, zero external requests)
tests/newtab.e2e.js           Playwright E2E (assertions in §8)
playwright.config.js          testDir=tests, testMatch covers newtab.e2e.js, reporter=list
package.json                  devDependencies: @playwright/test; scripts.test
.github/workflows/pages.yml   push main → configure-pages + upload-pages-artifact + deploy-pages (publishes site/)
README.md                     English install/setup/usage guide
.gitignore                    node_modules, tests/.cache, test-results, .DS_Store
CLAUDE.md                     repo conventions (TDD, signed-off, no trailing whitespace)
docs/vimium-homepage-design.md  this document (coordinator-maintained; implementers must not modify)
```

## 8. Test strategy (TDD)

Order: write the E2E test first and confirm it fails (repo empty; failures are missing-file errors) → implement → all green.

`npm test` (Playwright + Chromium (Chrome-for-Testing; branded Chrome 137+ removed `--load-extension`, verified unusable)):
- Loads two unpacked extensions: this repo + vimium (downloaded from philc/vimium tag v2.4.2 zip, extracted and cached in `tests/.cache/`, gitignored, one-time download).
- Local Node http server serving `site/` (random port).
- Storage seeding: this extension only — visit our options page and set `chrome.storage.sync.targetUrl = LOCAL_URL`. **vimium storage is never written and no patches are applied** (stock vimium 2.4.2, identical to production).
- Assertions (12 contracts):
  1. `extensions-loaded` both extensions load without manifest errors
  2. `newtab-redirects-to-designed-page` new tab URL is `http://localhost:*` (not chrome-extension://)
  3. `dark-terminal-aesthetic-renders` `#clock`/`#greeting`/`#quick-links` exist, background is dark
  4. `vomnibar-summoned` no iframe initially (lazy creation) → after pressing `o`, `iframe.vomnibar-frame.vimium-ui-component-visible` appears in the shadowRoot
  5. `vomnibar-in-embedding-slot` iframe bounding box y ≥ slot design value, horizontally centered in the content area (does not overlap the header)
  6. `vomnibar-input-focused` after pressing `o`, the active element is inside the Vomnibar iframe
  7. `type-and-navigate` after pressing `o`, type `localhost:<port>/nav-test` + Enter → the tab navigates to that URL (localhost target avoids external network)
  8. `esc-closes-vomnibar` Esc → iframe gets `vimium-ui-component-hidden`
  9. `zero-external-requests` no external requests during page load (local server only; favicon allowed)
  10. `quick-links-persist` edit a quick link → reload → change persists (localStorage)
  11. `canonical-url-enforcement` `/index.html` → redirects to `/`
  12. `unsafe-link-schemes-rejected` non-http(s) schemes such as `javascript:` are rejected on both the save and load paths (F1 regression)

Manual verification item (E2E cannot cover the address-bar focus path): in real Chrome, Ctrl+T to open a new tab → press Tab or click the page → press `o` → Vomnibar appears in the design slot.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| vimium updates change UI DOM/class names (renamed once in 2.3.0) | selectors centralized in one page script; E2E asserts behavior (bounding box/visibility) rather than class-name details |
| vimium auto-focus URL hardcoded (verified; no config option) | decided press-`o` summon; zero vimium configuration dependency |
| GitHub Pages first deploy fails | Actions-based zero-config deployment (permissions: pages/id-token), works on first push |
| E2E depends on downloading vimium | one-time download cached (tests/.cache, gitignored); the rest of the tests run offline |
| offline/no network → hosted page unreachable | browser shows a network error page; acceptable and documented (the extension shell always loads locally) |
| MV3 CSP forbids inline scripts | extension pages use external JS only; `site/index.html` is a normal hosted page, not subject to the extension CSP |
| hosted page cannot access chrome.topSites/bookmarks | quick links use in-page editing + localStorage; limitation documented in README |

## 10. Deploy and rollback

- Deploy: make the repository public → Settings → Pages → Source: GitHub Actions → push `main` → Actions publishes `site/`.
- Rollback: `git revert` triggers a redeploy; uninstalling the extension restores the default new tab.
- User enablement steps (README): (1) `chrome://extensions` → load unpacked → select this repo; (2) disable/remove the old "vimium new page tab" extension; (3) on a new tab, click the page (or Tab/Esc) then press `o` to use the Vomnibar — **no vimium settings changes required**.

## 11. Implementation DAG (single unit, sequential)

- step 0: this document (complete)
- step 1: `package.json` + `playwright.config.js` + `tests/newtab.e2e.js` → run fails (red, missing files)
- step 2: extension shell `manifest.json` / `redirect.html` / `redirect.js` / `options.html` / `options.js`
- step 3: `site/index.html` (design page + embedding logic)
- step 4: `.github/workflows/pages.yml` (YAML syntax check)
- step 5: E2E all green (`npm test`, stock vimium, no patches)
- step 6: `README.md` / `.gitignore` / `CLAUDE.md` → signed-off commit (`git commit -s`)

final checks: `npm test` all 12 pass; manifest loads without errors; `site/index.html` zero-external-request grep check; canonical URL logic present; MutationObserver present; workflow YAML valid; commits include Signed-off-by.
