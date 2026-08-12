'use strict';

const DEFAULT_TARGET = 'https://tenfyzhong.github.io/vimium-homepage/';

const input = document.getElementById('target-url');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');

let statusTimer = null;

function showStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.className = ok ? 'ok' : 'err';
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.textContent = '';
  }, 3000);
}

function normalizeUrl(raw) {
  let url = raw.trim();
  if (!url) {
    return null;
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  return parsed.href;
}

function save() {
  const url = normalizeUrl(input.value);
  if (!url) {
    showStatus('Please enter a valid http(s) URL', false);
    return;
  }
  chrome.storage.sync.set({ targetUrl: url }, () => {
    input.value = url;
    showStatus('Saved', true);
  });
}

chrome.storage.sync.get({ targetUrl: DEFAULT_TARGET }, (items) => {
  input.value = items.targetUrl || DEFAULT_TARGET;
});

saveBtn.addEventListener('click', save);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    save();
  }
});
