# Vimium Homepage

A system-themed terminal-style Chrome extension for the new tab page: instant loading, zero
external requests, using Vimium's native Vomnibar (press `o` to summon).

## Features

- The new tab immediately redirects to the hosted design page (GitHub Pages): no white flash, no visible jump
- Large clock + date + time-of-day greeting, terminal × typographic details following the system light/dark scheme (noise texture, amber/emerald accents)
- Vimium's native Vomnibar at its default top-center position: press `o` to summon it, exactly as on any other page
- Editable quick links (Edit/Delete on hover, persisted in localStorage)
- Single self-contained page file, zero external network requests (inline CSS/JS, system monospace fonts, inline noise texture)

## Install

1. Open `chrome://extensions` and enable "Developer mode" (top right)
2. Click "Load unpacked" and select this repository directory
3. **Disable/remove the old "vimium new page tab" extension** in the extension list (avoids new-tab conflicts)

No vimium settings changes are required.

## Usage

- After a new tab opens, **click the page (or press Tab / Esc to leave the address bar), then press `o`** to summon the Vomnibar
- The Vomnibar opens at the top center of the page (vimium's default position); type a URL or search term and press Enter to navigate
- Press Esc to close; any vimium command that summons the Vomnibar (`o`/`O`/`b`/`B`/`t`/`T`) works as usual
- Without vimium installed, the page still renders (clock, quick links); the footer hint tells you to press `o`

## Quick links

- Hover a card to reveal "Edit / Delete" buttons (top right)
- Click "＋ Add" at the bottom to add a link (name + URL)
- Data is stored in the page's localStorage (key `vimium-homepage-links`) and survives reloads

## Changing the hosted address

- Right-click the extension → "Options" and edit the "Target URL" (default `https://tenfyzhong.github.io/vimium-homepage/`)
- After saving, new tabs redirect to the new address (the extension shell always loads locally; the redirect is instant)

## Deploy

Make the repository public → Settings → Pages → Source: "GitHub Actions" → push `main`;
`site/` is published automatically (see `.github/workflows/pages.yml`).

## Limitations

- Offline: the hosted page is unreachable and the browser shows a network error page (the extension shell itself always loads locally)
- The hosted page cannot access `chrome.topSites` / `chrome.bookmarks`; quick links use in-page editing + localStorage
- The whole page follows the system light/dark scheme; vimium's own UI (Vomnibar, HUD) is rendered by vimium and is never restyled by the page
