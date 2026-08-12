'use strict';

const DEFAULT_TARGET = 'https://tenfyzhong.github.io/vimium-homepage/';

function isSafeTarget(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

chrome.storage.sync.get({ targetUrl: DEFAULT_TARGET }, (items) => {
  const target = isSafeTarget(items.targetUrl) ? items.targetUrl : DEFAULT_TARGET;
  window.location.replace(target);
});
