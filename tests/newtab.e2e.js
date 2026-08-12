'use strict';

const { test, expect, chromium } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SITE_DIR = path.join(REPO_ROOT, 'site');
const CACHE_DIR = path.join(__dirname, '.cache');
const VIMIUM_DIR = path.join(CACHE_DIR, 'vimium-2.4.2');
const VIMIUM_ZIP = path.join(CACHE_DIR, 'vimium-2.4.2.zip');
const VIMIUM_URL = 'https://codeload.github.com/philc/vimium/zip/refs/tags/v2.4.2';
const SLOT_TOP_MIN = 200;

let server;
let port;
let LOCAL_URL;
let context;
let ourId;
let vimiumId;

function isLocalRoot(u) {
  return u.hostname === 'localhost' && u.port === String(port) && u.pathname === '/';
}

async function ensureVimiumSource() {
  if (!fs.existsSync(path.join(VIMIUM_DIR, 'manifest.json'))) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    if (!fs.existsSync(VIMIUM_ZIP)) {
      console.log('[setup] downloading vimium 2.4.2 source (one-time, cached in tests/.cache) ...');
      const res = await fetch(VIMIUM_URL);
      if (!res.ok) {
        throw new Error(`failed to download vimium source: HTTP ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(VIMIUM_ZIP, buf);
    }
    execSync(`unzip -q -o "${VIMIUM_ZIP}" -d "${CACHE_DIR}"`, { stdio: 'inherit' });
    if (!fs.existsSync(path.join(VIMIUM_DIR, 'manifest.json'))) {
      throw new Error('vimium source missing after extraction: ' + VIMIUM_DIR);
    }
  }
}

async function startLocalServer() {
  const srv = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
      pathname = '/';
    }
    if (pathname === '/' || pathname === '/index.html') {
      let html;
      try {
        html = fs.readFileSync(path.join(SITE_DIR, 'index.html'));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('site/index.html missing');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else if (pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found: ' + pathname);
    }
  });
  await new Promise((resolve) => srv.listen(0, resolve));
  return srv;
}

async function launchContext() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vimium-homepage-e2e-'));
  const extPaths = `${REPO_ROOT},${VIMIUM_DIR}`;
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    // Branded Google Chrome removed the --load-extension / --disable-extensions-except
    // command-line flags (Chrome 137/139; see the chromium-extensions PSA). Chromium and
    // Chrome for Testing keep both flags and are the officially recommended browsers for
    // extension testing (https://playwright.dev/docs/chrome-extensions).
    channel: 'chromium',
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${extPaths}`,
      `--load-extension=${extPaths}`
    ]
  });
  return { ctx, userDataDir };
}

async function discoverExtensionIds(ctx, userDataDir) {
  const prefsPath = path.join(userDataDir, 'Default', 'Preferences');
  const deadline = Date.now() + 20000;
  let foundOur = null;
  let foundVimium = null;
  while (Date.now() < deadline) {
    try {
      const raw = fs.readFileSync(prefsPath, 'utf8');
      const prefs = JSON.parse(raw);
      const settings = (prefs.extensions && prefs.extensions.settings) || {};
      for (const [id, info] of Object.entries(settings)) {
        if (!info || typeof info.path !== 'string') {
          continue;
        }
        const p = path.resolve(info.path);
        if (p === REPO_ROOT) {
          foundOur = id;
        }
        if (p === VIMIUM_DIR) {
          foundVimium = id;
        }
      }
    } catch (e) {
      // Preferences not written yet; keep polling.
    }
    if (foundOur && foundVimium) {
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  // Fallback for vimium: service worker URL.
  if (!foundVimium) {
    for (const sw of ctx.serviceWorkers()) {
      const m = sw.url().match(/^chrome-extension:\/\/([^/]+)\//);
      if (m) {
        foundVimium = m[1];
      }
    }
  }
  // Fallback for ours: the newtab redirect URL (committed before location.replace).
  if (!foundOur) {
    const p = await ctx.newPage();
    try {
      await p.goto('chrome://newtab', { waitUntil: 'commit', timeout: 5000 });
    } catch (e) {
      // ignore; the replace may have already fired
    }
    const m = p.url().match(/^chrome-extension:\/\/([^/]+)\//);
    if (m) {
      foundOur = m[1];
    }
    await p.close().catch(() => {});
  }
  return { ourId: foundOur, vimiumId: foundVimium };
}

async function seedStorages(ctx, ourId_) {
  // Only our extension is seeded. vimium's storage is intentionally left untouched
  // (stock vimium 2.4.2, exactly like production; writing to it would also trigger
  // vimium's pre-2.0 migration JSON.parse crash on a fresh profile).
  const op = await ctx.newPage();
  await op.goto(`chrome-extension://${ourId_}/options.html`, { timeout: 15000 });
  await op.waitForLoadState('domcontentloaded');
  const ourSeeded = await op.evaluate(([u]) => new Promise((resolve) => {
    try {
      chrome.storage.sync.set({ targetUrl: u }, () => resolve(true));
    } catch (e) {
      resolve(false);
    }
  }), [LOCAL_URL]);
  expect(ourSeeded).toBe(true);
  await op.close().catch(() => {});
}

async function openNewTab() {
  const p = await context.newPage();
  await p.goto('chrome://newtab', { waitUntil: 'commit', timeout: 8000 }).catch(() => {});
  try {
    await p.waitForURL(isLocalRoot, { timeout: 25000 });
    return p;
  } catch (e) {
    await p.close().catch(() => {});
    const p2 = await context.newPage();
    await p2.waitForURL(isLocalRoot, { timeout: 25000 });
    return p2;
  }
}

function vimiumUiState() {
  return () => {
    const out = { divs: 0, shadowRoots: 0, iframes: [] };
    for (const div of document.querySelectorAll('div.vimium-reset')) {
      out.divs += 1;
      const sr = div.shadowRoot;
      if (sr) {
        out.shadowRoots += 1;
        for (const f of sr.querySelectorAll('iframe')) {
          out.iframes.push({ cls: f.className, src: f.getAttribute('src') });
        }
      }
    }
    return out;
  };
}

async function waitForVomnibarVisible(p, timeout) {
  try {
    await p.waitForFunction(() => {
      const divs = document.querySelectorAll('div.vimium-reset');
      for (const div of divs) {
        const sr = div.shadowRoot;
        if (!sr) {
          continue;
        }
        const f = sr.querySelector('iframe.vomnibar-frame');
        if (f && f.classList.contains('vimium-ui-component-visible')) {
          return true;
        }
      }
      return false;
    }, null, { timeout: timeout || 20000 });
  } catch (e) {
    const state = await p.evaluate(vimiumUiState()).catch(() => null);
    console.log('[debug] vimium UI state:', JSON.stringify(state));
    throw e;
  }
}
async function waitForVomnibarFocused(p, timeout) {
  try {
    await p.waitForFunction(() => {
      const divs = document.querySelectorAll('div.vimium-reset');
      for (const div of divs) {
        const sr = div.shadowRoot;
        if (!sr) {
          continue;
        }
        const f = sr.querySelector('iframe.vomnibar-frame');
        // document.activeElement does not pierce shadow DOM (it returns the host
        // div.vimium-reset), so check the shadow root's own activeElement.
        if (f && sr.activeElement === f) {
          return true;
        }
      }
      return false;
    }, null, { timeout: timeout || 15000 });
  } catch (e) {
    const state = await p.evaluate(vimiumUiState()).catch(() => null);
    console.log('[debug] focus wait failed, vimium UI state:', JSON.stringify(state));
    throw e;
  }
}

// Summon the Vomnibar with "o". Retries because (a) vimium's content script may not
// have finished installing its modes when the key arrives, and (b) vimium hides the
// component if the page window receives a focus event right after summoning.
async function summonVomnibar(p, opts) {
  const { focused = false } = opts || {};
  for (let attempt = 0; attempt < 4; attempt++) {
    await p.waitForTimeout(250);
    await p.keyboard.press('o');
    try {
      await waitForVomnibarVisible(p, 8000);
      if (focused) {
        await waitForVomnibarFocused(p, 8000);
      }
      return;
    } catch (e) {
      // retry
    }
  }
  await p.keyboard.press('o');
  await waitForVomnibarVisible(p, 25000);
  if (focused) {
    await waitForVomnibarFocused(p, 15000);
  }
}

test.beforeAll(async () => {
  await ensureVimiumSource();
  server = await startLocalServer();
  port = server.address().port;
  LOCAL_URL = `http://localhost:${port}/`;
  const { ctx, userDataDir } = await launchContext();
  context = ctx;
  ({ ourId, vimiumId } = await discoverExtensionIds(ctx, userDataDir));
  console.log(`[setup] ourId=${ourId} vimiumId=${vimiumId} LOCAL_URL=${LOCAL_URL}`);
  await seedStorages(ctx, ourId);
});

test.afterAll(async () => {
  if (context) {
    await context.close().catch(() => {});
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve)).catch(() => {});
  }
});

test.describe('vimium-homepage newtab e2e', () => {
  test('1. extensions-loaded: both extensions load without manifest errors', async () => {
    expect(ourId, 'our extension id discovered (manifest.json must be valid)').toBeTruthy();
    expect(vimiumId, 'vimium extension id discovered').toBeTruthy();
    const ourPage = await context.newPage();
    await ourPage.goto(`chrome-extension://${ourId}/options.html`, { timeout: 15000 });
    expect(ourPage.url()).toMatch(new RegExp(`^chrome-extension://${ourId}/`));
    await ourPage.close();
    const vimiumPage = await context.newPage();
    await vimiumPage.goto(`chrome-extension://${vimiumId}/pages/options.html`, { timeout: 15000 });
    expect(vimiumPage.url()).toMatch(new RegExp(`^chrome-extension://${vimiumId}/`));
    await vimiumPage.close();
  });

  test('2. newtab-redirects-to-designed-page', async () => {
    const p = await openNewTab();
    expect(p.url()).toMatch(/^http:\/\/localhost:\d+\/$/);
    expect(p.url()).not.toMatch(/^chrome-extension:\/\//);
    await p.close();
  });

  test('3. dark-terminal-aesthetic-renders', async () => {
    const p = await openNewTab();
    for (const sel of ['#clock', '#greeting', '#quick-links']) {
      await expect(p.locator(sel)).toHaveCount(1);
    }
    const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(11, 14, 20)');
    await p.close();
  });

  test('4. vomnibar-summoned: lazy creation, then "o" summons it into the page', async () => {
    const p = await openNewTab();
    // Lazy creation: no vimium UI exists until the user summons it.
    const initial = await p.evaluate(() => {
      let iframeCount = 0;
      for (const div of document.querySelectorAll('div.vimium-reset')) {
        const sr = div.shadowRoot;
        if (sr && sr.querySelector('iframe.vomnibar-frame')) {
          iframeCount += 1;
        }
      }
      return { divs: document.querySelectorAll('div.vimium-reset').length, iframeCount };
    });
    expect(initial.divs).toBe(0);
    expect(initial.iframeCount).toBe(0);
    // Stock vimium: press "o" to summon the Vomnibar.
    await summonVomnibar(p);
    const info = await p.evaluate(() => {
      const divs = document.querySelectorAll('div.vimium-reset');
      for (const div of divs) {
        const sr = div.shadowRoot;
        if (!sr) {
          continue;
        }
        const f = sr.querySelector('iframe.vomnibar-frame');
        if (f) {
          return {
            hasShadowRoot: true,
            iframeSrc: f.getAttribute('src'),
            classes: f.className
          };
        }
      }
      return null;
    });
    expect(info).not.toBeNull();
    expect(info.hasShadowRoot).toBe(true);
    expect(info.classes).toContain('vimium-ui-component-visible');
    await p.close();
  });

  test('5. vomnibar-in-embedding-slot', async () => {
    const p = await openNewTab();
    await summonVomnibar(p);
    const box = await p.locator('div.vimium-reset iframe.vomnibar-frame').boundingBox();
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThanOrEqual(SLOT_TOP_MIN);
    const viewport = p.viewportSize();
    const center = box.x + box.width / 2;
    expect(Math.abs(center - viewport.width / 2)).toBeLessThan(60);
    await p.close();
  });

  test('6. vomnibar-input-focused', async () => {
    const p = await openNewTab();
    await summonVomnibar(p, { focused: true });
    await p.close();
  });

  test('7. type-and-navigate', async () => {
    const p = await openNewTab();
    await summonVomnibar(p, { focused: true });
    const target = `${LOCAL_URL}nav-test`;
    await p.keyboard.type(target);
    await p.keyboard.press('Enter');
    await p.waitForURL(
      (u) => u.hostname === 'localhost' && u.port === String(port) && u.pathname === '/nav-test',
      { timeout: 15000 }
    );
    expect(p.url()).toBe(target);
    await p.close();
  });

  test('8. esc-closes-vomnibar', async () => {
    const p = await openNewTab();
    await summonVomnibar(p);
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => {
      const divs = document.querySelectorAll('div.vimium-reset');
      for (const div of divs) {
        const sr = div.shadowRoot;
        if (!sr) {
          continue;
        }
        const f = sr.querySelector('iframe.vomnibar-frame');
        if (f && f.classList.contains('vimium-ui-component-hidden')) {
          return true;
        }
      }
      return false;
    }, null, { timeout: 10000 });
    await p.close();
  });

  test('9. zero-external-requests', async () => {
    const p = await context.newPage();
    const external = [];
    const onRequest = (req) => {
      const u = req.url();
      if (/^https?:/i.test(u)) {
        const host = new URL(u).hostname;
        if (host !== 'localhost') {
          external.push(u);
        }
      }
    };
    p.on('request', onRequest);
    await p.goto('chrome://newtab', { waitUntil: 'commit', timeout: 8000 }).catch(() => {});
    await p.waitForURL(isLocalRoot, { timeout: 25000 });
    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(400);
    p.off('request', onRequest);
    expect(external).toEqual([]);
    await p.close();
  });

  test('10. quick-links-persist', async () => {
    const p = await openNewTab();
    await p.evaluate(() => localStorage.clear());
    await p.click('#add-link-button');
    await p.fill('#link-label-input', 'Test Link');
    await p.fill('#link-url-input', 'https://example.com/');
    await p.click('#link-save-button');
    await expect(p.locator('.link-card', { hasText: 'Test Link' }).first()).toBeVisible();
    await p.reload();
    await expect(p.locator('.link-card', { hasText: 'Test Link' }).first()).toBeVisible();
    const card = p.locator('.link-card', { hasText: 'Test Link' }).first();
    await card.hover();
    await card.locator('.link-edit').click();
    await p.fill('#link-label-input', 'Test Link 2');
    await p.click('#link-save-button');
    await expect(p.locator('.link-card', { hasText: 'Test Link 2' }).first()).toBeVisible();
    await p.reload();
    await expect(p.locator('.link-card', { hasText: 'Test Link 2' }).first()).toBeVisible();
    await p.close();
  });

  test('11. canonical-url-enforcement', async () => {
    const p = await openNewTab();
    await p.goto(`${LOCAL_URL}index.html`, { waitUntil: 'commit', timeout: 10000 }).catch(() => {});
    await p.waitForURL(isLocalRoot, { timeout: 15000 });
    expect(p.url()).toBe(LOCAL_URL);
    await p.close();
  });
  test('12. unsafe-link-schemes-rejected', async () => {
    const p = await openNewTab();
    await p.evaluate(() => localStorage.clear());
    // write-path: javascript: URLs are rejected by the save handler
    await p.click('#add-link-button');
    await p.fill('#link-label-input', 'Bad Link');
    await p.fill('#link-url-input', 'javascript:alert(1)');
    await p.click('#link-save-button');
    await expect(p.locator('.link-card', { hasText: 'Bad Link' })).toHaveCount(0);
    // read-path: poisoned localStorage entries are filtered out on load
    await p.evaluate(() => {
      localStorage.setItem(
        'vimium-homepage-links',
        JSON.stringify([
          { label: 'Poisoned', url: 'javascript:alert(1)' },
          { label: 'Ok', url: 'https://example.com/' },
        ])
      );
    });
    await p.reload();
    await expect(p.locator('.link-card', { hasText: 'Poisoned' })).toHaveCount(0);
    await expect(p.locator('.link-card', { hasText: 'Ok' })).toHaveCount(1);
    await p.close();
  });
});
