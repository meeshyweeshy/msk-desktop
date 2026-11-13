// Shared by every part of the MSK extension: storage, presets, media database, payload.
(function (g) {
  const uid = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
  const DEFAULT_SETTINGS = { theme: "dark", rotation: { enabled: false, minutes: 15 }, fxFps: 11, showLogs: false, hotkeys: {}, autoUpdate: true };

  function baseConfig(name, chart = {}, bg = {}) {
    return {
      id: uid(), name, builtIn: false, rotate: false, createdAt: Date.now(), updatedAt: Date.now(),
      bg: { mediaId: null, mode: "behind", fit: "cover", position: "center", opacity: 0.85, blur: 0, brightness: 0.8, saturation: 1, speed: 1, tint: "#000000", tintStrength: 0.25, vignette: 0.45, base: { mode: "solid", color: "#000000", color2: "#0B3B3A", angle: 160 }, ...bg },
      chart: { apply: true, up: "#FFFFFF", down: "#3A3A3A", borderUp: "#FFFFFF", borderDown: "#8A8A8A", wickUp: "#FFFFFF", wickDown: "#8A8A8A", paneBg: "#000000", paneTransparent: true, grid: false, gridColor: "#FFFFFF14", text: "#D9D9D9", crosshair: "#39C5BB", ...chart },
      ui: { glassToolbars: false }, fx: [], fxOn: true,
    };
  }
  function presets() {
    return [
      baseConfig("Monochrome"),
    ].map((c) => ({ ...c, builtIn: true }));
  }

  async function load() {
    const d = await chrome.storage.local.get(null);
    if (!d.configs || !d.configs.length) {
      const configs = presets();
      const init = { settings: DEFAULT_SETTINGS, media: [], configs, activeConfigId: configs[0].id, enabled: true, fxPaused: false, preview: null, lastRotate: Date.now() };
      await chrome.storage.local.set(init);
      return init;
    }
    d.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}), rotation: { ...DEFAULT_SETTINGS.rotation, ...((d.settings || {}).rotation || {}) } };
    d.media = d.media || [];
    // 1.4: Monochrome is the only built-in look. Drop the old untouched presets (your own copies stay).
    const kept = d.configs.filter((c) => !c.builtIn || ["MSK Mono", "Monochrome"].includes(c.name));
    if (kept.length !== d.configs.length || kept.some((c) => c.builtIn && c.name === "MSK Mono")) {
      kept.forEach((c) => { if (c.builtIn && c.name === "MSK Mono") c.name = "Monochrome"; });
      d.configs = kept.length ? kept : presets();
      if (!d.configs.find((c) => c.id === d.activeConfigId)) d.activeConfigId = d.configs[0].id;
      await chrome.storage.local.set({ configs: d.configs, activeConfigId: d.activeConfigId });
    }
    if (!d.configs.find((c) => c.id === d.activeConfigId)) d.activeConfigId = d.configs[0].id;
    return d;
  }

  // Media blobs live in IndexedDB (extension origin), metadata in chrome.storage.
  let dbp = null;
  function db() {
    return (dbp = dbp || new Promise((res, rej) => {
      const r = indexedDB.open("msk", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  }
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction("files", mode); const out = fn(t.objectStore("files")); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); };
  const fput = (k, v) => tx("readwrite", (s) => { s.put(v, k); });
  const fget = (k) => tx("readonly", (s) => s.get(k));
  const fdel = (k) => tx("readwrite", (s) => { s.delete(k); });
  const fclear = () => tx("readwrite", (s) => { s.clear(); });

  function activeConfig(d) { return d.configs.find((c) => c.id === d.activeConfigId) || d.configs[0]; }
  function payload(d) {
    let cfg = d.preview || activeConfig(d);
    if (cfg && d.fxPaused) cfg = { ...cfg, fxOn: false };
    const m = cfg && cfg.bg.mediaId && d.media.find((x) => x.id === cfg.bg.mediaId);
    return { on: !!d.enabled, fxMs: Math.round(1000 / ((d.settings && d.settings.fxFps) || 11)), cfg, media: m ? { id: m.id, type: m.type, rev: m.rev || 0 } : null, external: true };
  }
  function nextId(d, pool) {
    const list = pool && pool.length ? pool : d.configs;
    const i = list.findIndex((c) => c.id === d.activeConfigId);
    return list[(i + 1) % list.length].id;
  }

  g.MSKX = { uid, baseConfig, presets, load, fput, fget, fdel, fclear, payload, nextId, activeConfig, DEFAULT_SETTINGS };
})(typeof self !== "undefined" ? self : window);
