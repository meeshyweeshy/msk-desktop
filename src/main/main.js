const { app, BrowserWindow, ipcMain, protocol, Tray, Menu, nativeImage, dialog, shell, globalShortcut, Notification, screen, net } = require("electron");
const path = require("path");
const fs = require("fs");
const { Readable } = require("stream");

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.setAppUserModelId("com.meeshy.msk");
protocol.registerSchemesAsPrivileged([{ scheme: "msk", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);

if (process.env.MSK_USERDATA) app.setPath("userData", process.env.MSK_USERDATA);
const store = require("./store");
const LOG = require("./log");
const DEBUG = process.argv.includes("--msk-debug") || process.env.MSK_DEBUG === "1";
LOG.init(store.dir, { verbose: DEBUG });
const log = LOG.scoped("app");
process.on("uncaughtException", (e) => log.error("Uncaught exception", e));
process.on("unhandledRejection", (e) => log.error("Unhandled rejection", e instanceof Error ? e : String(e)));
const { TVConnector, mimeOf } = require("./tv");
const watcher = require("./watch");

let win, tray, tv, data, preview = null, quitting = false, lastRotate = Date.now(), updateInfo = null;
const UPDATE_REPO = "meeshyweeshy/msk-desktop";
const ROOT = path.join(__dirname, "..", "..");
const ICON = path.join(ROOT, "build", "icon.png");
const IS_MAC = process.platform === "darwin";
const startHidden = process.argv.includes("--hidden") || process.argv.includes("--launch-tv") || (IS_MAC && (() => { try { return app.getLoginItemSettings().wasOpenedAtLogin; } catch { return false; } })());

// ---------- state ----------
const findMedia = (id) => data.media.find((m) => m.id === id);
const findConfig = (id) => data.configs.find((c) => c.id === id);
function payload() {
  let cfg = preview || store.activeConfig();
  if (cfg && data.fxPaused) cfg = { ...cfg, fxOn: false };
  const m = cfg && cfg.bg.mediaId && findMedia(cfg.bg.mediaId);
  return { on: !!data.enabled, fxMs: Math.round(1000 / (data.settings.fxFps || 11)), cfg, media: m ? { id: m.id, type: m.type, rev: m.rev || 0 } : null };
}
function fullState() {
  return { settings: data.settings, media: data.media, configs: data.configs, activeConfigId: data.activeConfigId,
    os: (process.env.MSK_SHOT && process.env.MSK_FAKE_OS) || process.platform, enabled: data.enabled, fxPaused: !!data.fxPaused, update: updateInfo, dismissedUpdate: data.dismissedUpdate || null, tv: tv ? tv.state : { status: "offline" }, version: app.getVersion(), dataDir: store.dir };
}
let bt;
function changed({ push = true } = {}) {
  store.save();
  clearTimeout(bt);
  bt = setTimeout(() => { win && !win.isDestroyed() && win.webContents.send("state", fullState()); buildTray(); }, 30);
  if (push && tv) tv.pushAll();
}

// ---------- window ----------
function createWindow() {
  const wa = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.max(1100, Math.min(1480, Math.round(wa.width * 0.86))), height: Math.max(720, Math.min(960, Math.round(wa.height * 0.88))),
    ...(IS_MAC ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 16, y: 15 } } : {}), minWidth: 1040, minHeight: 700, show: false, frame: IS_MAC,
    backgroundColor: data.settings.theme === "light" ? "#f4f5f6" : "#000000",
    icon: ICON, title: "MSK",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, backgroundThrottling: true },
  });
  win.loadFile(path.join(ROOT, "src", "renderer", "index.html"));
  win.once("ready-to-show", () => { if (process.argv.includes("--launch-tv")) return; if (!(startHidden && data.settings.startHidden)) win.show(); });
  win.on("close", (e) => { if (!quitting && data.settings.closeToTray) { e.preventDefault(); win.hide(); } });
  win.on("maximize", () => win.webContents.send("win", { max: true }));
  win.on("unmaximize", () => win.webContents.send("win", { max: false }));
  if (DEBUG) win.webContents.once("did-finish-load", () => { win.webContents.openDevTools({ mode: "detach" }); win.webContents.send("nav", "logs"); });
  win.webContents.on("render-process-gone", (_e, d) => log.error("Window crashed", d));
  win.webContents.on("console-message", (e) => { const lvl = e.level; if (lvl === "error" || lvl === 3) log.error("UI console", e.message); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}
function showWindow(page) {
  if (!win || win.isDestroyed()) createWindow();
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  if (page) win.webContents.send("nav", page);
}

// ---------- tray ----------
function buildTray() {
  if (!tray) {
    const img = nativeImage.createFromPath(path.join(__dirname, IS_MAC ? "trayTemplate.png" : "tray.png"));
    if (IS_MAC) img.setTemplateImage(true);
    tray = new Tray(img);
    tray.setToolTip("MSK");
    tray.on("click", () => showWindow());
  }
  const st = tv ? tv.state.status : "offline";
  const label = { connected: "TradingView: hooked", "no-hook": "TradingView: open without MSK", launching: "TradingView: launching...", waiting: "TradingView: loading..." }[st] || "TradingView: closed";
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open MSK", click: () => showWindow() },
    ...(updateInfo ? [{ label: `⬆  Update to v${updateInfo.version}`, click: () => openUpdate() }] : []),
    { type: "separator" },
    { label: "Background on", type: "checkbox", checked: !!data.enabled, click: () => setEnabled(!data.enabled) },
    { label: "Configs", submenu: data.configs.map((c) => ({ label: c.name, type: "radio", checked: c.id === data.activeConfigId, click: () => setActive(c.id) })) },
    { label: "Next config", click: () => nextConfig() },
    { label: "Animations on", type: "checkbox", checked: !data.fxPaused, click: () => setFxPaused(!data.fxPaused) },
    { type: "separator" },
    { label, enabled: false },
    { label: st === "no-hook" ? "Restart TradingView with MSK" : "Launch TradingView", enabled: st !== "connected" && st !== "launching", click: () => launchTV(st === "no-hook") },
    { label: "Kill all TradingView processes", click: () => tv.killAll() },
    { label: "Open logs", click: () => showWindow("logs") },
    { type: "separator" },
    { label: "Restart MSK", click: () => restartApp() },
    { label: "Quit MSK", click: () => { quitting = true; app.quit(); } },
  ]));
}

// ---------- actions ----------
function setEnabled(v) { data.enabled = !!v; log.info(`Background ${data.enabled ? "on" : "off"}`); changed(); }
// ---------- updates (GitHub Releases) ----------
const newer = (a, b) => { const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0), pb = String(b).split(".").map((n) => parseInt(n, 10) || 0); for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); } return false; };
async function checkUpdates(manual) {
  const url = process.env.MSK_UPDATE_URL || `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;
  try {
    const r = await net.fetch(url, { headers: { "User-Agent": "MSK-desktop", Accept: "application/vnd.github+json" } });
    if (!r.ok) { log.info(`Update check: no release found (${r.status})`); return { status: r.status === 404 ? "none" : "error" }; }
    const j = await r.json();
    const latest = String(j.tag_name || j.name || "").replace(/^v/i, "");
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    const exe = IS_MAC ? (j.assets || []).find((a) => /\.dmg$/i.test(a.name) && a.name.includes(arch)) : (j.assets || []).find((a) => /\.exe$/i.test(a.name));
    const zip = (j.assets || []).find((a) => (IS_MAC ? new RegExp(`mac-${arch}\\.zip$`, "i") : /win.*\.zip$/i).test(a.name));
    data.lastUpdateCheck = Date.now();
    if (latest && newer(latest, app.getVersion())) {
      const fresh = !updateInfo || updateInfo.version !== latest;
      updateInfo = { version: latest, page: j.html_url || `https://github.com/${UPDATE_REPO}/releases/latest`, exe: exe && exe.browser_download_url, zip: zip && zip.browser_download_url, notes: String(j.body || "").replace(/\r/g, "").trim().slice(0, 600), date: j.published_at };
      log.info(`Update available: v${latest} (you have v${app.getVersion()})`);
      if (fresh && !manual && data.dismissedUpdate !== latest && Notification.isSupported()) {
        const n = new Notification({ title: `MSK v${latest} is out`, body: "Click to download the update from GitHub.", icon: ICON });
        n.on("click", () => openUpdate()); n.show();
      }
    } else { updateInfo = null; log.info(`Update check: up to date (v${app.getVersion()})`); }
    changed({ push: false });
    return updateInfo ? { status: "available", version: latest } : { status: "latest", version: app.getVersion() };
  } catch (e) { log.warn("Update check failed", e.message); return { status: "error", error: e.message }; }
}
function openUpdate(kind) {
  const u = updateInfo || {};
  const url = (kind === "page" ? u.page : u.exe || u.zip || u.page) || `https://github.com/${UPDATE_REPO}/releases/latest`;
  shell.openExternal(url);
}
setInterval(() => { if (data && data.settings.autoUpdate !== false) checkUpdates(false); }, 6 * 3600 * 1000);

function restartApp() { log.info("Restarting MSK"); quitting = true; app.relaunch({ args: process.argv.slice(1).filter((a) => a !== "--hidden" && a !== "--launch-tv") }); app.exit(0); }
function setFxPaused(v) { data.fxPaused = !!v; log.info(`Animations ${v ? "paused" : "on"}`); changed(); }
function setActive(id) { const c = findConfig(id); if (c) { data.activeConfigId = id; preview = null; lastRotate = Date.now(); log.info(`Active config: ${c.name}`); changed(); } }
function nextConfig(pool) {
  const list = pool && pool.length ? pool : data.configs;
  if (!list.length) return;
  const i = list.findIndex((c) => c.id === data.activeConfigId);
  setActive(list[(i + 1) % list.length].id);
}
async function launchTV(restart) {
  const r = await tv.launch({ restart, dataDir: store.dir });
  if (!r.ok) log.warn(r.message);
  win && !win.isDestroyed() && win.webContents.send("toast", { kind: r.ok ? "ok" : "warn", text: r.message });
  return r;
}
function applyLoginItem() {
  try {
    if (IS_MAC) app.setLoginItemSettings({ openAtLogin: !!data.settings.startup, openAsHidden: true });
    else app.setLoginItemSettings({ openAtLogin: !!data.settings.startup, path: process.execPath, args: ["--hidden"] });
  } catch {}
}
function registerHotkeys() {
  globalShortcut.unregisterAll();
  const hk = data.settings.hotkeys || {};
  const reg = (acc, fn) => { if (!acc) return; try { globalShortcut.register(acc, fn); } catch {} };
  reg(hk.toggle, () => setEnabled(!data.enabled));
  reg(hk.next, () => nextConfig());
  reg(hk.fx, () => setFxPaused(!data.fxPaused));
}
setInterval(() => {
  const r = data && data.settings.rotation;
  if (!r || !r.enabled) return;
  if (Date.now() - lastRotate >= Math.max(1, +r.minutes || 15) * 60000) {
    const pool = data.configs.filter((c) => c.rotate);
    nextConfig(pool);
  }
}, 20000);

// ---------- media protocol for the MSK window ----------
function serveFile(file, type, req) {
  const size = fs.statSync(file).size;
  const range = req.headers.get("range");
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (m) {
    const start = m[1] ? +m[1] : Math.max(0, size - +m[2]);
    const end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), { status: 206,
      headers: { "Content-Type": type, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*" } });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200,
    headers: { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*" } });
}

// ---------- IPC ----------
const h = (name, fn) => ipcMain.handle(name, (_e, ...a) => fn(...a));
function addMediaFile(src, name) {
  const type = mimeOf(src);
  if (!/^(image|video)\//.test(type)) return null;
  const id = store.uid(), ext = path.extname(src).toLowerCase();
  fs.copyFileSync(src, path.join(store.mediaDir, id + ext));
  const item = { id, name: name || path.basename(src, ext), type: type.startsWith("video") ? "video" : "image", file: id + ext,
    size: fs.statSync(src).size, fav: false, added: Date.now(), rev: 0, hasThumb: false };
  data.media.unshift(item);
  return item;
}
function registerIPC() {
  h("state", () => fullState());
  h("media:import", async (paths) => {
    if (!paths || !paths.length) {
      const r = await dialog.showOpenDialog(win, { title: "Add to MSK library", properties: ["openFile", "multiSelections"],
        filters: [{ name: "Images & videos", extensions: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "mp4", "webm", "mov", "m4v", "mkv"] }] });
      if (r.canceled) return [];
      paths = r.filePaths;
    }
    const added = paths.map((p) => { try { return addMediaFile(p); } catch (e) { log.error("Import failed", { file: p, err: e.message }); return null; } }).filter(Boolean);
    log.info(`Imported ${added.length}/${paths.length} file(s)`);
    changed({ push: false });
    return added;
  });
  h("media:thumb", (id, dataUrl) => {
    const m = findMedia(id); if (!m) return;
    fs.writeFileSync(store.thumbPath(m), Buffer.from(dataUrl.split(",")[1], "base64"));
    m.hasThumb = true; m.thumbRev = (m.thumbRev || 0) + 1; changed({ push: false });
  });
  h("media:update", (id, patch) => { const m = findMedia(id); if (m) { Object.assign(m, { name: patch.name ?? m.name, fav: patch.fav ?? m.fav }); changed({ push: false }); } });
  h("media:delete", (id) => {
    const m = findMedia(id); if (!m) return;
    data.media = data.media.filter((x) => x !== m);
    for (const f of [store.mediaPath(m), store.thumbPath(m)]) { try { fs.unlinkSync(f); } catch {} }
    for (const c of data.configs) if (c.bg.mediaId === id) c.bg.mediaId = null;
    changed();
  });
  h("config:save", (cfg) => {
    cfg = JSON.parse(JSON.stringify(cfg));
    const existing = cfg.id && findConfig(cfg.id);
    if (existing && !existing.builtIn) { Object.assign(existing, cfg, { updatedAt: Date.now() }); changed(); return existing; }
    const base = store.baseConfig(cfg.name || "New config", {});
    const created = { ...base, ...cfg, id: store.uid(), builtIn: false, createdAt: Date.now(), updatedAt: Date.now(),
      name: existing && existing.builtIn && cfg.name === existing.name ? cfg.name + " (mine)" : cfg.name || "New config" };
    data.configs.push(created); changed(); return created;
  });
  h("config:delete", (id) => {
    data.configs = data.configs.filter((c) => c.id !== id);
    if (!data.configs.length) data.configs = store.presets();
    if (data.activeConfigId === id) data.activeConfigId = data.configs[0].id;
    changed();
  });
  h("config:duplicate", (id) => {
    const c = findConfig(id); if (!c) return null;
    const copy = { ...JSON.parse(JSON.stringify(c)), id: store.uid(), name: c.name + " copy", builtIn: false, createdAt: Date.now(), updatedAt: Date.now() };
    data.configs.splice(data.configs.indexOf(c) + 1, 0, copy); changed({ push: false }); return copy;
  });
  h("config:rename", (id, name) => { const c = findConfig(id); if (c && name) { c.name = name; changed({ push: false }); } });
  h("config:rotate", (id, v) => { const c = findConfig(id); if (c) { c.rotate = !!v; changed({ push: false }); } });
  h("config:reorder", (ids) => { data.configs.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); changed({ push: false }); });
  h("config:activate", (id) => setActive(id));
  h("config:next", () => nextConfig());
  h("config:preview", (cfg) => { preview = cfg ? JSON.parse(JSON.stringify(cfg)) : null; if (tv) tv.pushAll(); });
  h("config:export", async (id) => {
    const c = findConfig(id); if (!c) return false;
    const r = await dialog.showSaveDialog(win, { title: "Export MSK config", defaultPath: c.name.replace(/[^\w\- ]+/g, "") + ".msk", filters: [{ name: "MSK config", extensions: ["msk"] }] });
    if (r.canceled) return false;
    const m = c.bg.mediaId && findMedia(c.bg.mediaId);
    const pack = { msk: 1, config: { ...c, builtIn: false }, media: m ? { name: m.name, type: m.type, ext: path.extname(m.file), data: fs.readFileSync(store.mediaPath(m)).toString("base64") } : null };
    fs.writeFileSync(r.filePath, JSON.stringify(pack));
    return true;
  });
  h("config:import", async () => {
    const r = await dialog.showOpenDialog(win, { title: "Import MSK config", properties: ["openFile", "multiSelections"], filters: [{ name: "MSK config", extensions: ["msk", "json"] }] });
    if (r.canceled) return 0;
    let n = 0;
    for (const f of r.filePaths) {
      try {
        const pack = JSON.parse(fs.readFileSync(f, "utf8"));
        const cfg = pack.config || pack;
        if (!cfg.bg || !cfg.chart) continue;
        let mediaId = null;
        if (pack.media && pack.media.data) {
          const tmp = path.join(app.getPath("temp"), "msk-import" + pack.media.ext);
          fs.writeFileSync(tmp, Buffer.from(pack.media.data, "base64"));
          const item = addMediaFile(tmp, pack.media.name); try { fs.unlinkSync(tmp); } catch {}
          mediaId = item && item.id;
        }
        const base = store.baseConfig(cfg.name || "Imported", {});
        data.configs.push({ ...base, ...cfg, bg: { ...base.bg, ...cfg.bg, mediaId }, chart: { ...base.chart, ...cfg.chart }, id: store.uid(), builtIn: false, createdAt: Date.now(), updatedAt: Date.now() });
        n++;
      } catch {}
    }
    changed({ push: false }); return n;
  });
  h("enabled:set", (v) => setEnabled(v));
  h("fx:pause", (v) => setFxPaused(v));
  h("settings:update", (patch) => {
    const before = JSON.stringify(data.settings);
    data.settings = { ...data.settings, ...patch,
      rotation: { ...data.settings.rotation, ...(patch.rotation || {}) }, hotkeys: { ...data.settings.hotkeys, ...(patch.hotkeys || {}) } };
    if ("startup" in patch) applyLoginItem();
    if (patch.hotkeys) registerHotkeys();
    if (patch.rotation) lastRotate = Date.now();
    if (before !== JSON.stringify(data.settings)) { log.info("Settings changed", patch); changed({ push: "port" in patch }); }
    return data.settings;
  });
  h("tv:launch", (restart) => launchTV(!!restart));
  h("tv:detect", () => { const d = tv.detectTV(); const c = tv.copyInfo(store.dir); return d ? { ...d, copy: c && c.pkg } : null; });
  h("tv:resetCopy", async () => { tv.killTV(); await tv.resetCopy(store.dir); return true; });
  h("tv:shortcut", () => {
    if (process.platform !== "win32") return { ok: false, message: "Windows only" };
    const c = tv.copyInfo(store.dir);
    const lnk = path.join(app.getPath("desktop"), "TradingView (MSK).lnk");
    const ok = shell.writeShortcutLink(lnk, { target: process.execPath, args: "--launch-tv", description: "Open TradingView with your MSK background",
      icon: c ? c.path : process.execPath, iconIndex: 0, appUserModelId: "com.meeshy.msk" });
    return { ok, message: ok ? "Shortcut added to your desktop" : "Couldn't make the shortcut" };
  });
  h("tv:browse", async () => {
    const r = await dialog.showOpenDialog(win, IS_MAC
      ? { title: "Find TradingView", defaultPath: "/Applications", properties: ["openFile"], filters: [{ name: "Apps", extensions: ["app"] }] }
      : { title: "Find TradingView.exe", properties: ["openFile"], filters: [{ name: "TradingView", extensions: process.platform === "win32" ? ["exe"] : ["*"] }] });
    if (r.canceled) return null;
    data.settings.tvPath = r.filePaths[0]; changed({ push: false }); return r.filePaths[0];
  });
  h("app:openData", () => shell.openPath(store.dir));
  h("app:restart", () => restartApp());
  h("update:check", () => checkUpdates(true));
  h("update:open", (kind) => openUpdate(kind));
  h("update:dismiss", (v) => { data.dismissedUpdate = v; changed({ push: false }); });
  h("app:openUrl", (u) => { if (/^https:\/\/github\.com\//.test(u)) shell.openExternal(u); });
  h("logs:get", () => ({ lines: LOG.all(), verbose: LOG.isVerbose(), file: LOG.file(), debug: DEBUG, watching: watcher.running() }));
  h("logs:clear", () => { LOG.clear(); return true; });
  h("logs:open", () => shell.showItemInFolder(LOG.file()));
  h("logs:verbose", (v) => LOG.setVerbose(v));
  h("logs:ui", (level, msg, d) => LOG.write(level === "error" ? "error" : "warn", "ui", msg, d));
  h("tv:kill", () => tv.killAll());
  h("tv:diagnose", () => tv.diagnose(store.dir));
  h("tv:test", () => tv.hookTest(store.dir));
  h("watch:set", (on) => (on ? watcher.start() : watcher.stop()));
  h("app:devtools", () => win.webContents.openDevTools({ mode: "detach" }));
  h("app:reset", async () => {
    const r = await dialog.showMessageBox(win, { type: "warning", buttons: ["Cancel", "Reset everything"], defaultId: 0, cancelId: 0,
      title: "Reset MSK", message: "Delete all media and configs?", detail: "This can't be undone." });
    if (r.response !== 1) return false;
    for (const d of [store.mediaDir, store.thumbDir]) for (const f of fs.readdirSync(d)) { try { fs.unlinkSync(path.join(d, f)); } catch {} }
    const configs = store.presets();
    Object.assign(data, { media: [], configs, activeConfigId: configs[0].id, enabled: true });
    changed(); return true;
  });
  h("win:min", () => win.minimize());
  h("win:max", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
  h("win:close", () => win.close());
}

// ---------- boot ----------
app.on("second-instance", (_e, argv) => {
  if (argv.includes("--msk-debug")) { LOG.setVerbose(true); showWindow("logs"); win.webContents.openDevTools({ mode: "detach" }); return; }
  if (argv.includes("--launch-tv")) launchTV(true); else showWindow();
});
app.on("before-quit", () => { quitting = true; });
let booted = false;
app.on("activate", (_e, hasVisible) => { if (booted && !hasVisible) showWindow(); });
app.on("will-quit", () => { globalShortcut.unregisterAll(); watcher.stop(); });
app.on("window-all-closed", (e) => { if (!data.settings.closeToTray) app.quit(); });

function macMenu() {
  if (!IS_MAC) return;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "MSK", submenu: [
      { role: "about" }, { type: "separator" },
      { label: "Settings…", accelerator: "Cmd+,", click: () => showWindow("settings") },
      { label: "Check for updates…", click: () => checkUpdates(true) },
      { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
      { type: "separator" }, { label: "Quit MSK", accelerator: "Cmd+Q", click: () => { quitting = true; app.quit(); } },
    ] },
    { role: "editMenu" },
    { label: "View", submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "togglefullscreen" }] },
    { role: "windowMenu" },
  ]));
}

app.whenReady().then(async () => {
  macMenu();
  data = store.load();
  protocol.handle("msk", (req) => {
    try {
      const u = new URL(req.url); const id = decodeURIComponent(u.pathname.slice(1)); const m = findMedia(id);
      if (!m) return new Response("not found", { status: 404 });
      if (u.hostname === "thumb") return serveFile(store.thumbPath(m), "image/jpeg", req);
      return serveFile(store.mediaPath(m), mimeOf(m.file), req);
    } catch { return new Response("error", { status: 500 }); }
  });
  registerIPC();
  tv = new TVConnector({ getPayload: payload, getMediaFile: (id) => { const m = findMedia(id); return m ? store.mediaPath(m) : null; }, getSettings: () => data.settings });
  tv.on("state", () => changed({ push: false }));
  let pend = [], lt = null;
  LOG.bus.on("line", (e) => { pend.push(e); if (!lt) lt = setTimeout(() => { lt = null; const b = pend; pend = []; win && !win.isDestroyed() && win.webContents.send("logs", b); }, 120); });
  log.info(`MSK ${app.getVersion()}${DEBUG ? " (debug)" : ""}`, { exe: process.execPath, data: store.dir, electron: process.versions.electron });
  createWindow();
  if (process.env.MSK_SHOT) devShots();
  buildTray();
  applyLoginItem();
  registerHotkeys();
  setTimeout(() => { booted = true; }, 1500);
  if (data.settings.autoUpdate !== false) setTimeout(() => checkUpdates(false), process.env.MSK_UPDATE_URL ? 500 : 8000);
  if (process.argv.includes("--launch-tv")) setTimeout(() => launchTV(true), 800);
  else if (data.settings.autoLaunchTV) {
    setTimeout(async () => {
      const r = await tv.launch({ restart: false, dataDir: store.dir });
      if (r.needsRestart && Notification.isSupported()) {
        const n = new Notification({ title: "MSK", body: "TradingView is open without MSK. Click to restart it with your background.", icon: ICON });
        n.on("click", () => launchTV(true)); n.show();
      }
    }, 1200);
  }
});

// dev only: screenshot every page (MSK_SHOT=dir)
function devShots() {
  const out = process.env.MSK_SHOT;
  for (const f of (process.env.MSK_TEST_MEDIA || "").split(",").filter(Boolean)) addMediaFile(f);
  if (data.media[0] && !process.env.MSK_DEMO) { const img = data.media.find((m) => m.type === "image"); data.configs[1].bg.mediaId = (img || data.media[0]).id; data.activeConfigId = data.configs[1].id; }
  if (process.env.MSK_THEME) data.settings.theme = process.env.MSK_THEME;
  if (process.env.MSK_DEMO && data.media.length >= 3) {
    const [city, night, wave] = data.media.slice(-3).reverse().length ? [data.media.find((m) => /city/.test(m.name)), data.media.find((m) => /night/.test(m.name)), data.media.find((m) => m.type === "video")] : [];
    const c = data.configs;
    Object.assign(c[1], { name: "Neon City", builtIn: false, fx: [{ id: "d1", on: true, target: "candles", wave: "saw", period: 6, min: 0, max: 360, phase: 0 }, { id: "d2", on: true, target: "brightness", wave: "heartbeat", period: 1.4, min: 75, max: 115, phase: 0 }] });
    Object.assign(c[1].bg, { mediaId: city.id, opacity: 0.9, brightness: 0.9 });
    Object.assign(c[0], { name: "Night Hills", builtIn: false }); Object.assign(c[0].bg, { mediaId: night.id, base: { mode: "gradient", color: "#0B4A46", color2: "#1A0B2E", angle: 135 } });
    Object.assign(c[3], { name: "Teal Wave", builtIn: false }); c[3].bg.mediaId = wave.id;
    data.activeConfigId = c[1].id;
  }
  if (process.env.MSK_TEST_BASE) Object.assign(data.configs[1].bg, { fit: "contain", base: { mode: "gradient", color: "#0B4A46", color2: "#1A0B2E", angle: 135 } });
  if (process.env.MSK_TEST_FX) data.configs[1].fx = [
    { id: "t1", on: true, target: "candles", wave: "saw", period: 6, min: 0, max: 360, phase: 0 },
    { id: "t2", on: true, target: "opacity", wave: "heartbeat", period: 1.2, min: 50, max: 100, phase: 0 }];
  win.webContents.on("console-message", (e) => { const m = e.message || e; if (/error/i.test(String(m))) console.log("[renderer]", m); });
  win.webContents.once("did-finish-load", async () => {
    win.show();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(+(process.env.MSK_SHOT_WAIT || 2500));
    for (const p of (process.env.MSK_PAGES || "home,library,workshop,configs,settings").split(",")) {
      if (p === "logs") await tv.diagnose(store.dir);
      if (p === "palette") { await win.webContents.executeJavaScript(`document.getElementById('pal-btn').click(); setTimeout(()=>{const i=document.querySelector('.cmdk input'); i.value='mi'; i.dispatchEvent(new Event('input'))},300)`); await wait(1200); }
      else if (p.startsWith("settings@")) { win.webContents.send("nav", "settings"); await wait(1500); await win.webContents.executeJavaScript(`document.querySelector('[data-sec="${p.split("@")[1]}"]').click()`); await wait(1200); }
      else { win.webContents.send("nav", p); await wait(1800); }
      if (p === "workshop" && process.env.MSK_SCROLL) { await win.webContents.executeJavaScript(`document.querySelectorAll('.panel').forEach(p=>p.open=true);document.querySelector('#view').scrollTop=${process.env.MSK_SCROLL}`); await wait(900); }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(out, p.replace("@", "-") + ".png"), img.toPNG());
    }
    quitting = true; app.exit(0);
  });
}
