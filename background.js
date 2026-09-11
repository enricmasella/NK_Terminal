const TAB = chrome.runtime.getURL('terminal.html');

/* ── Every known format of new-tab / startpage URLs ── */
const NT = [
  'opera://startpage',
  'chrome://startpage',
  'chrome://newtab',
  'browser://startpage',
  'edge://newtab',
];
function isNewTab(url) {
  if (!url) return false; // empty URL → let the polling catch it
  const u = url.split('?')[0].split('#')[0]; // strip query/hash
  if (u==='about:blank'||u==='about:newtab') return true;
  return NT.some(p => u.startsWith(p));
}

/* ── redirect: replace the new tab with our terminal ──
   Instead of tabs.update (which keeps address-bar focus on Opera)
   we close the Opera-created tab and spawn a fresh one.          ── */
const redirecting = new Set();
function redirect(tabId) {
  if (redirecting.has(tabId)) return;
  redirecting.add(tabId);
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError || !tab) { redirecting.delete(tabId); return; }
    chrome.tabs.create({
      url: TAB,
      index: tab.index,
      active: true,
      windowId: tab.windowId,
    }, () => {
      chrome.tabs.remove(tabId, () => { void chrome.runtime.lastError; });
      redirecting.delete(tabId);
    });
  });
}

/* ── tabs.onCreated + aggressive polling ──
   MV3 service workers wake up lazily.  By the time our listener
   runs, Opera may already have navigated to startpage.
   We poll the tab URL for 3 s to catch late overrides.       ── */
chrome.tabs.onCreated.addListener((tab) => {
  const url = tab.pendingUrl || tab.url || '';
  if (isNewTab(url)) redirect(tab.id);

  let n = 0;
  const iv = setInterval(() => {
    chrome.tabs.get(tab.id, t => {
      if (chrome.runtime.lastError || !t) { clearInterval(iv); return; }
      if (isNewTab(t.url)) redirect(tab.id);
      else clearInterval(iv); // no longer a new-tab page → stop
    });
    if (++n > 30) clearInterval(iv); // 3 s max
  }, 100);
});

/* ── Fallback: catch late navigation to startpage ── */
chrome.tabs.onUpdated.addListener((tabId, chg, tab) => {
  const u = chg.url || (chg.status==='loading' ? tab.url : '');
  if (u && isNewTab(u)) redirect(tabId);
});

chrome.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId === 0 && isNewTab(d.url)) redirect(d.tabId);
});

chrome.webNavigation.onCommitted.addListener((d) => {
  if (d.frameId === 0 && isNewTab(d.url)) redirect(d.tabId);
});

/* ── Extension icon click → popup ── */
chrome.action.onClicked.addListener(() => {
  chrome.windows.create({ url: TAB, type: 'popup', width: 900, height: 640, focused: true });
});

/* ── Message relay (page ↔ background ↔ external APIs) ── */
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'fetch') {
    fetch(req.url, req.options || {})
      .then(async r => ({ ok: r.ok, status: r.status, body: await r.text() }))
      .then(sendResponse)
      .catch(e => sendResponse({ ok: false, status: 0, body: e.message }));
    return true;
  }
  if (req.type === 'storageGet') {
    chrome.storage.local.get(req.keys, data => sendResponse(data));
    return true;
  }
  if (req.type === 'storageSet') {
    chrome.storage.local.set(req.data, () => sendResponse({ ok: true }));
    return true;
  }
});
