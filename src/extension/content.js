// Isolated-world content script on TradingView chart pages: places the background layer
// (an extension iframe) and hands the config to the engine running in the page.
(() => {
  let frame = null, last = "";
  const send = (s) => document.dispatchEvent(new CustomEvent("msk:apply", { detail: s }));
  function layer(p) {
    if (!p.on || !p.cfg) { if (frame) { frame.remove(); frame = null; } return; }
    if (!frame || !frame.isConnected) {
      frame = document.createElement("iframe");
      frame.src = chrome.runtime.getURL("layer.html");
      frame.setAttribute("allowtransparency", "true");
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      document.documentElement.appendChild(frame);
    }
    const behind = p.cfg.bg.mode === "behind";
    frame.style.cssText = `position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;border:0!important;margin:0!important;padding:0!important;pointer-events:none!important;background:transparent!important;color-scheme:normal!important;display:block!important;z-index:${behind ? -1 : 2147483646}!important;`;
  }
  async function update() {
    try {
      const d = await MSKX.load();
      const p = MSKX.payload(d);
      layer(p);
      last = JSON.stringify(p);
      send(last);
    } catch (e) { /* extension reloaded or storage unavailable */ }
  }
  document.addEventListener("msk:ready", () => { if (last) send(last); });
  chrome.storage.onChanged.addListener((_c, area) => { if (area === "local") update(); });
  update();
  setInterval(() => { if (last && JSON.parse(last).on && (!frame || !frame.isConnected)) update(); }, 2000);
})();
