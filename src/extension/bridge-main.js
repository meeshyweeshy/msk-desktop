// Page (MAIN world) side: receives configs from the content script and drives the MSK engine.
(() => {
  document.addEventListener("msk:apply", (e) => {
    try { const p = JSON.parse(e.detail); if (window.__MSK) window.__MSK.apply(p); } catch (err) { console.warn("[MSK]", err); }
  });
  const ready = () => document.dispatchEvent(new CustomEvent("msk:ready"));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true }); else ready();
  setTimeout(ready, 1500);
})();
