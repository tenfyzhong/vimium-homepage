# Vimium Homepage — Design Document

Task ID: `vimium-homepage` · Repository: `/Users/zhongtenghui/go/src/github.com/tenfyzhong/vimium-homepage` (remote: `github.com/tenfyzhong/vimium-homepage`, branch `main`) · Status: confirmed · Revision 2026-08-12: system light/dark theme + vimium's native Vomnibar (embedding removed)

## 1. Problem statement

The user's Chrome has vimium installed, but vimium does not work on `chrome://newtab` (Chrome internal pages forbid content-script injection). The user installed a third-party "vimium new page tab" extension that redirects new tabs to a remote blank page where vimium works, but the page was "too plain" and "loads very slowly".

Goal: deliver a Chrome extension that replaces the new tab with a **beautiful, instant** page where vimium works and the page **adapts to the system light/dark scheme**. The user summons vimium's **native Vomnibar** themselves with `o` — the page performs no Vomnibar embedding or restyling whatsoever.

## 2. Confirmed decisions (decision gates, user-selected)

1. **Hosting**: GitHub Pages (this repo), page URL `https://tenfyzhong.github.io/vimium-homepage/` (301-redirects to the account custom domain `https://tenfy.cn/vimium-homepage/`), published from `site/` by `.github/workflows/pages.yml`.
2. **Interaction**: vimium's **native Vomnibar** at its default geometry, summoned manually with `o` (also `O`/`b`/`B`/`t`/`T` via vimium defaults). Decision revised 2026-08-12: the previous page-embedded Vomnibar (designed "command input slot" + shadow-root style injection) is **removed entirely**. Rationale: (a) official vimium has no configurable auto-focus URL (verified: `lib/settings.js:8` hardcoded constant), so the Vomnibar always requires manual summoning anyway; (b) keeping the native look removes all coupling to vimium's internal DOM.
3. **Visual**: **system-following light/dark theme** (decision revised 2026-08-12; previously dark-only). Dark scheme = dark terminal × typographic details; light scheme = warm-paper terminal × typographic details. Applies to the hosted page `site/index.html` and the redirect splash `redirect.html`; the extension options page stays dark (assumption). English UI.

Implicit decisions: no build step (plain static files); the page is a single self-contained file with **zero external network requests** (inline CSS/JS, system font stack, no CDN/remote fonts/images); extension pages (redirect/options) use external JS files (MV3 default CSP forbids inline scripts); quick-links source = in-page editing + localStorage persistence (`chrome.topSites`/`chrome.bookmarks` are unavailable to the hosted page, see §9).

## 3. Feasibility constraints (research evidence, all verified)

- vimium 2.4.2 (MV3, min Chrome 117) content script matches only `["<all_urls>"]` (manifest.json:44-46); Chrome match patterns only permit http/https/file/ftp schemes, and `<all_urls>` cannot match `chrome-extension://` → **vimium can never inject into an extension's own newtab override page** (any extension's). Therefore the newtab override must `location.replace` to the hosted http(s) page.
- **vimium auto-focus is not configurable (verified empirically 2026-08-12)**: `Settings.vimiumNewTabPageUrl` is a module constant (`lib/settings.js:8`); the auto-open condition `document.location.href == Settings.vimiumNewTabPageUrl` (vimium_frontend.js:257) only ever matches vimium's official page; the options UI has no custom field; master is identical. → The user summons the Vomnibar manually; **zero vimium configuration dependency**.
- Native Vomnibar facts (vimium 2.4.2, used as test evidence): created lazily on first activation; geometry from vimium's own stylesheet — `iframe.vomnibar-frame { position:fixed; width:calc(80%+20px); min-width:400px; height:calc(100%-70px); top:70px; left:50%; margin-left:-40%; z-index:2147483647; }` (vimium.css:204-220); visibility toggled by classes `vimium-ui-component-visible/hidden`. Its internal colors follow the OS scheme (the iframe's document declares `<meta name="color-scheme" content="light dark">`), so with the page also following the OS scheme the two always agree.
- MV3 extension pages default CSP `script-src 'self'` forbids inline scripts → the JS for `redirect.html`/`options.html` must be external files.

## 4. Architecture and shared contracts

```
chrome://newtab
  → chrome_url_overrides.newtab = redirect.html (chrome-extension://, instant same-style splash)
  → location.replace(chrome.storage.sync targetUrl, default https://tenfyzhong.github.io/vimium-homepage/)
  → site/index.html (hosted page, single self-contained file)
    → vimium injects (<all_urls> matches http(s))
    → user presses o / b / t → vimium's NATIVE Vomnibar at its default geometry (untouched)
    → page follows the system light/dark scheme (color-scheme + prefers-color-scheme)
```

| Contract | Definition |
|---|---|
| `canonical-url` | Page JS enforces: `pathname.endsWith('/index.html')` → `./`; bare path without trailing slash or file extension → append `/` (URL hygiene) |
| `storage-keys` | This extension `chrome.storage.sync.targetUrl` (default GH Pages URL); page `localStorage['vimium-homepage-links']` = `[{label,url}]`. Never write vimium's storage |
| `theme-palette` | Identical CSS variable names in `site/index.html` and `redirect.html`. Dark defaults on `:root` (`--bg #0b0e14`, `--panel #12161f`, `--text #e6e6e6`, `--weak #8b93a7`, `--amber #ffb000`, `--green #00e5a0`, `--divider rgba(230,230,230,.08)`, monospace stack) plus `color-scheme: light dark`. Light overrides inside `@media (prefers-color-scheme: light)`: `--bg #f4f1ea`, `--panel #ffffff`, `--text #1a1d23`, `--weak #6b7280`, `--amber #b45309`, `--green #047857`, `--divider rgba(26,29,23,.10)`. Variable names and the scheme mechanism are frozen; derived literals may be refined for WCAG AA (e.g. `#5b6472` weak text, `#9a3412` small amber text) |
| `native-summon` | Zero vimium DOM coupling: no MutationObserver, no shadowRoot access, no `<style>` injection, no `#vomnibar-slot`, no `--vomnibar-*`/`--slot-*` variables. The Vomnibar and HUD render vimium's own UI at vimium's default positions |
| `zero-injected-styles` | Observable test contract: after summoning, every `div.vimium-reset` shadowRoot contains exactly 1 `<style>` (vimium's own) whose textContent contains no `--vomnibar-`; `document.getElementById('vomnibar-slot')` is null; `--vomnibar-top` computed on the root is empty |
| `gh-pages-url` | `https://tenfyzhong.github.io/vimium-homepage/` (trailing slash; canonical custom domain `https://tenfy.cn/vimium-homepage/`) |

## 5. Visual design specification (dark terminal × typographic; system-following)

- **Mechanism**: `color-scheme: light dark` on `:root`; dark values as defaults, light values in `@media (prefers-color-scheme: light)` (see `theme-palette`). Form controls, scrollbars, and the native Vomnibar all agree with the page.
- **Dark scheme**: background `#0b0e14`; panel `#12161f`; primary text `#e6e6e6`; weak text `#8b93a7`; accent amber `#ffb000`; success/link green `#00e5a0`; divider `rgba(230,230,230,.08)`. Contrast meets WCAG AA (amber on dark ≥ 4.5:1 verified).
- **Light scheme**: warm paper background `#f4f1ea`; panel `#ffffff`; ink text `#1a1d23`; weak text `#6b7280` (refined darker if needed); amber `#b45309` (darker for contrast; small amber text may use `#9a3412`); green `#047857`; divider `rgba(26,29,23,.10)`. Noise texture opacity reduced (~0.15–0.2), softened top glow, adjusted link-card hover borders so both schemes stay AA.
- **Typography**: system monospace stack `ui-monospace, 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace` (zero external requests; SF Mono on macOS); clock numerals use `font-variant-numeric: tabular-nums` + 800 weight + very large size (≈15vw/120px cap); auxiliary text small monospace with wide tracking (`letter-spacing: .08em`).
- **Layout**: header at top (greeting line + date line, small monospace weak color); quick-links grid below (editable cards); a tiny hint line at the bottom (`vimium-homepage · press o for the Vomnibar`). No Vomnibar slot.
- **Background atmosphere**: inline base64 noise texture (1-2px PNG tiled at low opacity) + subtle top gradient glow; blinking colon animation on the clock; staggered reveal on page load (animation-delay); `prefers-reduced-motion: reduce` renders everything static.
- **Copy**: greetings `Good morning / Good afternoon / Good evening / Late night` (by hour); date `Aug 12, 2026 · Wed`.

## 6. Interaction design

- New tab loading: redirect.html shows the same-style splash (instant, follows system theme) → `location.replace` → hosted page (after caching, typically <300ms TTFB + a single request). No white screen, no visible jump.
- Vomnibar: the user presses `o` (or b/t etc.) and vimium's **native Vomnibar** appears at its default top-center position — the page does not touch vimium's DOM. Focus is handled by vimium; Esc closes it.
- HUD: vimium's default bottom-right HUD, untouched.
- Theme: the page follows the system light/dark scheme; the native Vomnibar follows the same scheme, so they always match.
- Quick links: click to navigate; hover reveals Edit/Delete; "＋ Add" at the bottom; persisted in localStorage; seeded with a set of common sites.
- Fallback: no vimium configuration needed. Without vimium installed the page still renders (clock, quick links) and the footer hint mentions `o`.
- Focus reality: when a new tab opens, focus is in the address bar (Chrome behavior; the page cannot steal it). Users click the page (or press Tab/Esc) before pressing `o` — standard vimium usage on any page.

## 7. File list

```
manifest.json                 MV3: chrome_url_overrides.newtab→redirect.html; options_ui; permissions:[storage]
redirect.html + redirect.js   instant system-themed splash + location.replace(targetUrl) (external JS, CSP-compliant)
options.html + options.js     configure custom targetUrl (English UI, chrome.storage.sync; stays dark by decision)
site/index.html               hosted design page (single self-contained file, inline CSS/JS, zero external requests, system light/dark)
tests/newtab.e2e.js           Playwright E2E (assertions in §8)
playwright.config.js          testDir=tests, testMatch covers newtab.e2e.js, reporter=list
package.json                  devDependencies: @playwright/test; scripts.test
.github/workflows/pages.yml   push main → configure-pages + upload-pages-artifact + deploy-pages (publishes site/)
README.md                     English install/setup/usage guide
CONTRIBUTING.md               contribution guide
LICENSE                       MIT
.gitignore                    node_modules, tests/.cache, test-results, .DS_Store
AGENTS.md                     repo conventions (TDD, signed-off, no trailing whitespace)
docs/vimium-homepage-design.md  this document (coordinator-maintained; implementers must not modify)
```

## 8. Test strategy (TDD)

Order: rewrite the E2E tests first and confirm the expected failures (red: tests 3, 4, 12 fail; old 5 deleted; the rest pass) → implement → all green.

`npm test` (Playwright + Chromium (Chrome-for-Testing; branded Chrome 137+ removed `--load-extension`, verified unusable)):
- Loads two unpacked extensions: this repo + vimium (downloaded from philc/vimium tag v2.4.2 zip, extracted and cached in `tests/.cache/`, gitignored, one-time download).
- Local Node http server serving `site/` (random port).
- Storage seeding: this extension only — visit our options page and set `chrome.storage.sync.targetUrl = LOCAL_URL`. vimium storage is never written; no patches (stock vimium 2.4.2).
- Assertions (12 contracts):
  1. `extensions-loaded` both extensions load without manifest errors
  2. `newtab-redirects-to-designed-page` new tab URL is `http://localhost:*` (not chrome-extension://)
  3. `system-theme-renders` `#clock`/`#greeting`/`#quick-links` present; `page.emulateMedia({colorScheme:'dark'})` → body background `rgb(11, 14, 20)`; `emulateMedia({colorScheme:'light'})` → `rgb(244, 241, 234)`; root `color-scheme` is `light dark`
  4. `native-vomnibar-summoned` zero `div.vimium-reset` before summoning (lazy creation); after `o`, `iframe.vomnibar-frame` has `vimium-ui-component-visible`; native geometry: iframe y ∈ [68,72] and horizontally centered (±60px); zero injected styles: each shadowRoot has exactly 1 `<style>` without `--vomnibar-`, no `#vomnibar-slot`, no `--vomnibar-top`
  5. `vomnibar-input-focused` after `o`, the Vomnibar iframe is the shadow root's activeElement
  6. `type-and-navigate` type `localhost:<port>/nav-test` + Enter → tab navigates to that URL (localhost target avoids external network)
  7. `esc-closes-vomnibar` Esc → iframe gets `vimium-ui-component-hidden`
  8. `zero-external-requests` no external requests during page load (local server only; favicon allowed)
  9. `quick-links-persist` edit a quick link → reload → change persists (localStorage)
  10. `canonical-url-enforcement` `/index.html` → redirects to `/`
  11. `unsafe-link-schemes-rejected` non-http(s) schemes such as `javascript:` are rejected on both the save and load paths
  12. `splash-follows-system-theme` the redirect splash (chrome-extension://<our-id>/redirect.html, redirect aborted) follows the system scheme: light → `rgb(244, 241, 234)`, dark → `rgb(11, 14, 20)`

Manual verification item (E2E cannot cover the address-bar focus path): in real Chrome, Ctrl+T → click the page (or Tab/Esc) → `o` → native Vomnibar at the top center.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Light-scheme contrast (amber `#b45309`/weak text on paper) | palette validated to WCAG AA; implementer may refine derived literals but not variable names |
| E2E depends on downloading vimium | one-time download cached (tests/.cache, gitignored); the rest of the tests run offline |
| offline/no network → hosted page unreachable | browser shows a network error page; acceptable and documented (the extension shell always loads locally) |
| GitHub Pages first deploy fails | Actions-based zero-config deployment (permissions: pages/id-token), works on first push |
| vimium future releases change UI class names | no longer relevant — the page has zero vimium DOM coupling (removed 2026-08-12) |
| MV3 CSP forbids inline scripts | extension pages use external JS only; `site/index.html` is a normal hosted page, not subject to the extension CSP |
| hosted page cannot access chrome.topSites/bookmarks | quick links use in-page editing + localStorage; limitation documented in README |

## 10. Deploy and rollback

- Deploy: push `main` → Actions publishes `site/` (workflow: configure-pages + upload-pages-artifact + deploy-pages).
- Rollback: `git revert` triggers a redeploy; uninstalling the extension restores the default new tab.
- User enablement steps (README): (1) `chrome://extensions` → load unpacked → select this repo; (2) disable/remove the old "vimium new page tab" extension; (3) on a new tab, click the page (or Tab/Esc) then press `o` to use the native Vomnibar — no vimium settings changes required.

## 11. Implementation DAG (single unit, sequential)

- step 0: this document (complete — revision 2026-08-12)
- step 1: `git pull --ff-only` to confirm origin/main is current
- step 2: TDD red — rewrite `tests/newtab.e2e.js` (delete old test 5, rework 3 → system-theme, 4 → native-summon, renumber, add test 12 splash-theme) → `npm test` fails on 3/4/12 for the expected reasons
- step 3: implement `site/index.html` (remove embedding block, slot, `--vomnibar-*`/`--slot-*` vars; add light palette) → `redirect.html` (light palette) → copy updates (README.md, manifest.json description, package.json description, CONTRIBUTING.md testing bullet)
- step 4: `npm test` 12/12 green; `git diff --check` clean; single signed-off commit (`git commit --no-verify -s`)
- step 5: push `origin/main` (triggers Pages deploy); coordinator verifies `gh run watch … --exit-status` and the live site

final checks: `npm test` 12/12; grep `site/index.html` for zero `MutationObserver`/`shadowRoot`/`--vomnibar-`/`--slot-`/`vomnibar-slot`/`embedded Vimium Vomnibar`; both `site/index.html` and `redirect.html` contain `color-scheme: light dark` + `@media (prefers-color-scheme: light)`; no trailing whitespace; commit Signed-off-by; Pages deploy exit 0; live site 200 with new footer copy.
