// Gives the MSK Studio UI (same app.js as the desktop app) a `window.msk` API backed by
// chrome.storage + IndexedDB instead of the Electron main process.
(() => {
  const X = MSKX;
  let D = null;
  const subs = { state: [], toast: [], nav: [] };
  const urlCache = new Map(), cur = {};
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const save = (patch) => chrome.storage.local.set(patch);
  const findC = (id) => D.configs.find((c) => c.id === id);
  const toast = (text, kind = "ok") => subs.toast.forEach((f) => f({ text, kind }));

  async function ensureUrls() {
    for (const m of D.media) {
      for (const [kind, rev, has] of [["media", m.rev || 0, true], ["thumb", m.thumbRev || 0, m.hasThumb]]) {
        if (!has) continue;
        const k = `${kind}:${m.id}:${rev}`;
        if (!urlCache.has(k)) {
          const blob = await X.fget(`${kind}:${m.id}`);
          if (!blob) continue;
          const old = cur[`${kind}:${m.id}`]; if (old) { URL.revokeObjectURL(old); }
          urlCache.set(k, URL.createObjectURL(blob));
        }
        cur[`${kind}:${m.id}`] = urlCache.get(k);
      }
    }
  }
  window.MSK_URLS = { media: (m) => cur["media:" + m.id] || "", thumb: (m) => cur["thumb:" + m.id] || "" };

  async function tvState() {
    try {
      const tabs = await chrome.tabs.query({ url: ["https://*.tradingview.com/chart*"] });
      return { status: tabs.length ? "connected" : "offline", windows: tabs.length, charts: tabs.length, colors: "" };
    } catch { return { status: "offline", windows: 0 }; }
  }
  async function commandKeys() {
    const out = {};
    try { for (const c of await chrome.commands.getAll()) { const k = { "toggle-bg": "toggle", "next-config": "next", "toggle-fx": "fx" }[c.name]; if (k) out[k] = c.shortcut || ""; } } catch {}
    return out;
  }
  let tvLast = "";
  async function state() {
    D = await X.load();
    await ensureUrls();
    const tv = await tvState(); tvLast = JSON.stringify(tv);
    return {
      settings: { ...D.settings, hotkeys: await commandKeys(), showLogs: false }, media: D.media, configs: D.configs,
      activeConfigId: D.activeConfigId, enabled: D.enabled, fxPaused: !!D.fxPaused, tv,
      update: D.update || null, dismissedUpdate: D.dismissedUpdate || null,
      version: chrome.runtime.getManifest().version, dataDir: "Stored inside this browser", platform: "extension",
    };
  }
  let bt;
  const emit = () => { clearTimeout(bt); bt = setTimeout(async () => { const s = await state(); subs.state.forEach((f) => f(s)); }, 40); };
  chrome.storage.onChanged.addListener((_c, area) => { if (area === "local") emit(); });
  setInterval(async () => { if (document.visibilityState !== "visible") return; const tv = JSON.stringify(await tvState()); if (tv !== tvLast) emit(); }, 3000);
  window.addEventListener("beforeunload", () => { chrome.storage.local.set({ preview: null }); });

  function pickFiles(accept, multiple = true) {
    return new Promise((resolve) => {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = accept; inp.multiple = multiple;
      inp.onchange = () => resolve([...inp.files]);
      inp.addEventListener("cancel", () => resolve([]));
      inp.click();
    });
  }
  const typeOf = (f) => (f.type || "").startsWith("video") ? "video" : (f.type || "").startsWith("image") ? "image" : null;
  async function addBlob(blob, name) {
    const type = typeOf(blob); if (!type) return null;
    const id = X.uid();
    await X.fput("media:" + id, blob);
    return { id, name: (name || "media").replace(/\.[^.]+$/, ""), type, file: name || "", size: blob.size, fav: false, added: Date.now(), rev: 0, hasThumb: false };
  }
  const b64ToBlob = (b64, type) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); };
  const blobToB64 = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
  const MIME = { ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/mp4", ".m4v": "video/mp4", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif" };

  async function setActive(id) { D = await X.load(); if (findC(id)) await save({ activeConfigId: id, preview: null, lastRotate: Date.now() }); }

  window.msk = {
    state,
    onState: (fn) => subs.state.push(fn),
    onToast: (fn) => subs.toast.push(fn),
    onNav: (fn) => subs.nav.push(fn),
    onWin: () => {},
    pathFor: (file) => file,
    media: {
      async import(list) {
        const files = list && list.length ? list : await pickFiles("image/*,video/*");
        const added = [];
        for (const f of files) { if (f instanceof Blob) { const it = await addBlob(f, f.name); if (it) added.push(it); } }
        if (added.length) { D = await X.load(); await save({ media: [...added, ...D.media] }); }
        return added;
      },
      async thumb(id, dataUrl) {
        const [head, b64] = dataUrl.split(",");
        const blob = b64ToBlob(b64, (head.match(/data:([^;]+)/) || [0, "image/jpeg"])[1]);
        await X.fput("thumb:" + id, blob);
        D = await X.load(); const m = D.media.find((x) => x.id === id);
        if (m) { m.hasThumb = true; m.thumbRev = (m.thumbRev || 0) + 1; await save({ media: D.media }); }
      },
      async update(id, patch) { D = await X.load(); const m = D.media.find((x) => x.id === id); if (m) { if (patch.name != null) m.name = patch.name; if (patch.fav != null) m.fav = patch.fav; await save({ media: D.media }); } },
      async remove(id) {
        D = await X.load();
        await X.fdel("media:" + id); await X.fdel("thumb:" + id);
        for (const c of D.configs) if (c.bg.mediaId === id) c.bg.mediaId = null;
        await save({ media: D.media.filter((m) => m.id !== id), configs: D.configs });
      },
    },
    config: {
      async save(cfg) {
        D = await X.load(); cfg = clone(cfg);
        const ex = cfg.id && findC(cfg.id);
        if (ex && !ex.builtIn) { Object.assign(ex, cfg, { updatedAt: Date.now() }); await save({ configs: D.configs }); return ex; }
        const base = X.baseConfig(cfg.name || "New config");
        const created = { ...base, ...cfg, id: X.uid(), builtIn: false, createdAt: Date.now(), updatedAt: Date.now(),
          name: ex && ex.builtIn && cfg.name === ex.name ? cfg.name + " (mine)" : cfg.name || "New config" };
        D.configs.push(created); await save({ configs: D.configs }); return created;
      },
      async remove(id) {
        D = await X.load();
        let configs = D.configs.filter((c) => c.id !== id); if (!configs.length) configs = X.presets();
        await save({ configs, activeConfigId: D.activeConfigId === id ? configs[0].id : D.activeConfigId });
      },
      async duplicate(id) {
        D = await X.load(); const c = findC(id); if (!c) return null;
        const copy = { ...clone(c), id: X.uid(), name: c.name + " copy", builtIn: false, createdAt: Date.now(), updatedAt: Date.now() };
        D.configs.splice(D.configs.indexOf(c) + 1, 0, copy); await save({ configs: D.configs }); return copy;
      },
      async rename(id, name) { D = await X.load(); const c = findC(id); if (c && name) { c.name = name; await save({ configs: D.configs }); } },
      async rotate(id, v) { D = await X.load(); const c = findC(id); if (c) { c.rotate = !!v; await save({ configs: D.configs }); } },
      async reorder(ids) { D = await X.load(); D.configs.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); await save({ configs: D.configs }); },
      activate: setActive,
      async next() { D = await X.load(); await setActive(X.nextId(D)); },
      async preview(cfg) { await save({ preview: cfg ? clone(cfg) : null }); },
      async export(id) {
        D = await X.load(); const c = findC(id); if (!c) return false;
        const m = c.bg.mediaId && D.media.find((x) => x.id === c.bg.mediaId);
        let media = null;
        if (m) { const blob = await X.fget("media:" + m.id); if (blob) media = { name: m.name, type: m.type, ext: (m.file.match(/\.[^.]+$/) || [m.type === "video" ? ".mp4" : ".png"])[0], data: await blobToB64(blob) }; }
        const url = URL.createObjectURL(new Blob([JSON.stringify({ msk: 1, config: { ...c, builtIn: false }, media })], { type: "application/json" }));
        const a = document.createElement("a"); a.href = url; a.download = c.name.replace(/[^\w\- ]+/g, "") + ".msk"; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        return true;
      },
      async import() {
        const files = await pickFiles(".msk,.json");
        let n = 0;
        for (const f of files) {
          try {
            const pack = JSON.parse(await f.text()); const cfg = pack.config || pack;
            if (!cfg.bg || !cfg.chart) continue;
            D = await X.load();
            let mediaId = null;
            if (pack.media && pack.media.data) {
              const it = await addBlob(b64ToBlob(pack.media.data, MIME[(pack.media.ext || "").toLowerCase()] || (pack.media.type === "video" ? "video/mp4" : "image/png")), pack.media.name + (pack.media.ext || ""));
              if (it) { D.media.unshift(it); mediaId = it.id; }
            }
            const base = X.baseConfig(cfg.name || "Imported");
            D.configs.push({ ...base, ...cfg, bg: { ...base.bg, ...cfg.bg, mediaId }, chart: { ...base.chart, ...cfg.chart }, id: X.uid(), builtIn: false, createdAt: Date.now(), updatedAt: Date.now() });
            await save({ media: D.media, configs: D.configs }); n++;
          } catch (e) { console.warn("Import failed", e); }
        }
        return n;
      },
    },
    update: {
      check: () => new Promise((res) => chrome.runtime.sendMessage({ type: "checkUpdate" }, (r) => res(r || { status: "error" }))),
      open: async (kind) => { const u = D.update || {}; chrome.tabs.create({ url: kind === "page" ? (u.page || "https://github.com/meeshyweeshy/msk-extension") : (u.zip || "https://github.com/meeshyweeshy/msk-extension/archive/refs/heads/main.zip") }); },
      dismiss: (v) => save({ dismissedUpdate: v }),
    },
    openUrl: async (u) => { if (/^https:\/\/github\.com\//.test(u)) chrome.tabs.create({ url: u }); },
    setEnabled: (v) => save({ enabled: !!v }),
    fxPause: (v) => save({ fxPaused: !!v }),
    async settings(patch) {
      D = await X.load();
      const s = { ...D.settings, ...patch, rotation: { ...D.settings.rotation, ...(patch.rotation || {}) } };
      delete s.hotkeys;
      await save({ settings: s, ...(patch.rotation ? { lastRotate: Date.now() } : {}) });
      return s;
    },
    logs: { get: async () => ({ lines: [], verbose: false, file: "", debug: false, watching: false }), clear: async () => true, open: async () => {}, verbose: async () => {}, ui: async (l, m, d) => console.warn("[MSK]", m, d || ""), on: () => {} },
    watch: async () => false,
    tv: {
      launch: async () => { await chrome.tabs.create({ url: "https://www.tradingview.com/chart/" }); return { ok: true, message: "Opened a TradingView chart" }; },
      detect: async () => null, browse: async () => null, resetCopy: async () => true,
      shortcut: async () => ({ ok: false, message: "Not needed in the browser" }),
      kill: async () => [], diagnose: async () => {}, test: async () => {},
      shortcuts: () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" }),
    },
    app: {
      openData: async () => toast("Your media is stored inside this browser"),
      async reset() {
        if (!confirm("Delete all media and configs in the MSK extension? This can't be undone.")) return false;
        await X.fclear(); await chrome.storage.local.clear(); await X.load(); return true;
      },
      devtools: async () => {}, restart: async () => location.reload(),
    },
    win: { min: async () => {}, max: async () => {}, close: async () => window.close() },
  };
})();
