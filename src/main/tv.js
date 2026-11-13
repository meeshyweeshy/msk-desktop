// TradingView Desktop connector: finds/launches the app with the Chromium debug port,
// attaches to each chart window, injects the MSK engine and serves media to it.
const { EventEmitter } = require("events");
const { spawn, execSync, exec, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const LOG = require("./log");
// Electron's fs treats .asar files as folders. Copying TradingView needs the plain Node fs.
const ofs = (() => { try { return require("original-fs"); } catch { return require("fs"); } })();
const log = LOG.scoped("tv");
const plog = LOG.scoped("page");
const KNOWN_MSIX_DIRS = [
  // Fallback for TradingView 3.5.0 if Get-AppxPackage can't answer
  "C:\\Program Files\\WindowsApps\\TradingView.Desktop_3.5.0.8375_x64__n534cwy3pjxzj",
];

const ENGINE = fs.readFileSync(path.join(__dirname, "..", "renderer", "fx.js"), "utf8") + "\n;\n" + fs.readFileSync(path.join(__dirname, "..", "inject", "engine.js"), "utf8");
const MEDIA_PREFIX = "https://media.msk.invalid/";
const CHUNK = 4 * 1024 * 1024;
const TV_MATCH = new RegExp(process.env.MSK_TV_MATCH || "tradingview\\.com", "i");
const MIME = {
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".mov": "video/mp4", ".mkv": "video/webm",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
  ".avif": "image/avif", ".bmp": "image/bmp",
};
const mimeOf = (f) => MIME[path.extname(f).toLowerCase()] || "application/octet-stream";

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
    this.id = 0; this.pending = new Map(); this.handlers = {};
    this.ready = new Promise((res, rej) => { this.ws.once("open", res); this.ws.once("error", rej); });
    this.ws.on("message", (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method && this.handlers[m.method]) this.handlers[m.method](m.params);
    });
    this.ws.on("close", () => { for (const { rej } of this.pending.values()) rej(new Error("closed")); this.pending.clear(); this.onclose && this.onclose(); });
    this.ws.on("error", () => {});
  }
  send(method, params = {}) {
    return new Promise((res, rej) => {
      if (this.ws.readyState !== 1) return rej(new Error("not open"));
      const id = ++this.id; this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error("timeout " + method)); } }, 15000);
    });
  }
  on(ev, fn) { this.handlers[ev] = fn; }
  close() { try { this.ws.close(); } catch {} }
}

function getJSON(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let d = ""; res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(1500, () => { req.destroy(); resolve(null); });
  });
}

class TVConnector extends EventEmitter {
  constructor({ getPayload, getMediaFile, getSettings }) {
    super();
    this.getPayload = getPayload; // () => { cfg, on, media }
    this.getMediaFile = getMediaFile; // (id) => absolute path | null
    this.getSettings = getSettings;
    this.targets = new Map(); // targetId -> { cdp, url, status, reloaded }
    this.state = { status: "offline", charts: 0, colors: "", windows: 0, message: "" };
    this.timer = setInterval(() => this.poll(), 2000);
    this.poll();
  }

  get port() { return Number(this.getSettings().port) || 9222; }
  get cdpPort() { return this.livePort || this.port; }

  // Finds a TradingView that's already running with the debug switch and returns its port.
  findHookedPort() {
    return new Promise((resolve) => {
      if (process.platform !== "win32") {
        return exec("ps -axo command", { timeout: 5000 }, (err, out) => {
          if (err || !out) return resolve(null);
          for (const line of out.split(/\n/)) {
            if (!/tradingview/i.test(line) || /--type=/.test(line) || /MSK/.test(line)) continue;
            const m = /--remote-debugging-port=(\d+)/.exec(line);
            if (m && +m[1] > 0) return resolve(+m[1]);
          }
          resolve(null);
        });
      }
      const ps = "Get-CimInstance Win32_Process -Filter \"Name='TradingView.exe'\" | ForEach-Object { $_.CommandLine }";
      runPS(ps, 8000, (err, out) => {
        if (err || !out) return resolve(null);
        for (const line of out.split(/\r?\n/)) {
          if (/--type=/.test(line)) continue;
          const m = /--remote-debugging-port=(\d+)/.exec(line);
          if (m && +m[1] > 0) return resolve(+m[1]);
        }
        resolve(null);
      });
    });
  }

  setState(patch) {
    const next = { ...this.state, ...patch };
    if (JSON.stringify(next) !== JSON.stringify(this.state)) {
      if (next.status !== this.state.status) log.info(`Status: ${this.state.status} -> ${next.status}`);
      if (next.colors !== this.state.colors && next.colors) log.info(`Chart colors: ${next.colors}`);
      if (next.message && next.message !== this.state.message) log.info(next.message);
      this.state = next; this.emit("state", next);
    }
  }

  isRunning() {
    try {
      if (process.platform === "win32") return /TradingView\.exe/i.test(execSync('tasklist /FI "IMAGENAME eq TradingView.exe" /NH', { timeout: 4000, windowsHide: true }).toString());
      if (process.platform === "darwin") return execSync("pgrep -x TradingView || true", { timeout: 3000 }).toString().trim().length > 0;
      return execSync("pgrep -i -x tradingview || true", { timeout: 3000 }).toString().trim().length > 0;
    } catch { return false; }
  }

  async poll() {
    if (this.polling) return; this.polling = true;
    try {
      let list = await getJSON(`http://127.0.0.1:${this.cdpPort}/json/list`);
      if (!list && this.livePort) { log.info(`Lost TradingView on port ${this.livePort}`); this.livePort = null; }
      if (!list && !this.launching && (!this.lastScan || Date.now() - this.lastScan > 6000)) {
        this.lastScan = Date.now();
        const p = await this.findHookedPort();
        if (p && p !== this.port) {
          const l2 = await getJSON(`http://127.0.0.1:${p}/json/list`);
          if (l2) { this.livePort = p; list = l2; log.info(`Found TradingView already hooked on port ${p} (launched by another app), attaching to it`); }
        }
      }
      if (!list) {
        for (const t of this.targets.values()) t.cdp.close();
        this.targets.clear();
        const now = Date.now();
        if (!this.lastRunCheck || now - this.lastRunCheck > 6000) { this.lastRunCheck = now; this.runningNoPort = this.isRunning(); }
        this.setState({ status: this.launching ? "launching" : this.runningNoPort ? "no-hook" : "offline", charts: 0, windows: 0 });
        return;
      }
      const pages = list.filter((t) => t.type === "page" && TV_MATCH.test(t.url) && t.webSocketDebuggerUrl);
      const sig = list.map((t) => t.type + ":" + t.url.slice(0, 80)).join("|");
      if (sig !== this.lastSig) { this.lastSig = sig; log.debug(`Debug port targets (${list.length})`, list.map((t) => ({ type: t.type, url: t.url.slice(0, 120) }))); if (!pages.length) log.warn("Port open but no TradingView chart window found yet"); }
      for (const t of pages) if (!this.targets.has(t.id)) this.attach(t);
      for (const [id, t] of this.targets) if (!pages.find((p) => p.id === id)) { t.cdp.close(); this.targets.delete(id); }
      // read engine status from each window
      let charts = 0, colors = "";
      for (const [, t] of this.targets) {
        try {
          const r = await t.cdp.send("Runtime.evaluate", { expression: "window.__MSK && { status: window.__MSK.status, logs: window.__MSK.drain ? window.__MSK.drain() : [], events: window.__MSK.drainEvents ? window.__MSK.drainEvents() : [] }", returnByValue: true });
          const v = r && r.result && r.result.value, st = v && v.status;
          if (v && v.logs) for (const l of v.logs) LOG.write(l.level || "info", "page", l.msg, l.data);
          if (v && v.events) for (const ev of v.events) this.emit("page-event", ev);
          if (!st) { this.push(t); continue; }
          charts += st.charts || 0; colors = st.colors || colors;
          if (st.mediaError && !t.reloaded) { t.reloaded = true; log.warn("Media blocked in page, reloading the chart once"); t.cdp.send("Page.reload", { ignoreCache: false }).catch(() => {}); }
        } catch (e) { log.debug("Status read failed", e.message); }
      }
      this.launching = false;
      this.setState({ status: this.targets.size ? "connected" : "waiting", windows: this.targets.size, charts, colors, port: this.cdpPort });
    } finally { this.polling = false; }
  }

  async attach(t) {
    const cdp = new CDP(t.webSocketDebuggerUrl);
    const rec = { cdp, url: t.url, reloaded: false };
    this.targets.set(t.id, rec);
    cdp.onclose = () => { this.targets.delete(t.id); log.info("Detached from window", t.url.slice(0, 100)); };
    log.info("Attaching to TradingView window", t.url.slice(0, 120));
    try {
      await cdp.ready;
      cdp.on("Fetch.requestPaused", (p) => this.serveMedia(cdp, p));
      // bindings don't survive a reload without the Runtime domain, so add it back on every load
      cdp.on("Page.loadEventFired", () => { cdp.send("Runtime.addBinding", { name: "__mskEmit" }).catch(() => {}); setTimeout(() => this.push(rec), 300); });
      // the page calls window.__mskEmit(json) for things you do on the chart (checklist ticks)
      cdp.on("Runtime.bindingCalled", (p) => { if (p.name !== "__mskEmit") return; try { this.emit("page-event", JSON.parse(p.payload)); } catch {} });
      await cdp.send("Runtime.addBinding", { name: "__mskEmit" }).catch(() => {});
      await cdp.send("Page.enable");
      await cdp.send("Network.enable").catch(() => {});
      await cdp.send("Network.setBypassServiceWorker", { bypass: true }).catch(() => {});
      await cdp.send("Page.setBypassCSP", { enabled: true }).catch(() => {});
      await cdp.send("Fetch.enable", { patterns: [{ urlPattern: MEDIA_PREFIX + "*", requestStage: "Request" }] });
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: ENGINE });
      await cdp.send("Runtime.evaluate", { expression: ENGINE });
      await this.push(rec);
      log.info("Engine injected");
    } catch (e) { log.error("Attach failed", e.message); cdp.close(); this.targets.delete(t.id); }
  }

  async push(rec) {
    // one push in flight per window; rapid changes (dragging a slider) collapse into the latest
    if (rec.pushing) { rec.again = true; return; }
    rec.pushing = true;
    try { await this.pushNow(rec); } finally { rec.pushing = false; }
    if (rec.again) { rec.again = false; return this.push(rec); }
  }

  async pushNow(rec) {
    const payload = this.getPayload();
    const expr = `window.__MSK ? window.__MSK.apply(${JSON.stringify(payload)}) : null`;
    try {
      const r = await rec.cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true });
      if (r && r.exceptionDetails) log.error("Engine threw", r.exceptionDetails.exception && r.exceptionDetails.exception.description);
      if (!r || !r.result || r.result.value == null) { log.debug("Engine missing, re-injecting"); await rec.cdp.send("Runtime.evaluate", { expression: ENGINE + ";" + expr }); }
      log.debug("Pushed config", { on: payload.on, cfg: payload.cfg && payload.cfg.name, media: payload.media && payload.media.id });
    } catch (e) { log.warn("Push failed", e.message); }
  }

  pushAll() { for (const rec of this.targets.values()) this.push(rec); setTimeout(() => this.poll(), 400); }

  async serveMedia(cdp, p) {
    const { requestId, request } = p;
    try {
      const id = decodeURIComponent(request.url.slice(MEDIA_PREFIX.length).split("?")[0]);
      const file = this.getMediaFile(id);
      if (!file || !fs.existsSync(file)) {
        log.warn("Media not found", id);
        return cdp.send("Fetch.fulfillRequest", { requestId, responseCode: 404, body: "" }).catch(() => {});
      }
      const size = fs.statSync(file).size;
      const range = Object.entries(request.headers || {}).find(([k]) => k.toLowerCase() === "range");
      const headers = [
        { name: "Content-Type", value: mimeOf(file) }, { name: "Accept-Ranges", value: "bytes" },
        { name: "Access-Control-Allow-Origin", value: "*" }, { name: "Cache-Control", value: "no-store" },
      ];
      let start = 0, end = size - 1, code = 200;
      const m = range && /bytes=(\d*)-(\d*)/.exec(range[1]);
      if (m) {
        code = 206;
        start = m[1] ? +m[1] : Math.max(0, size - +m[2]);
        end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
        end = Math.min(end, start + CHUNK - 1);
        headers.push({ name: "Content-Range", value: `bytes ${start}-${end}/${size}` });
      } else if (mimeOf(file).startsWith("video") && size > CHUNK) {
        code = 206; end = CHUNK - 1;
        headers.push({ name: "Content-Range", value: `bytes 0-${end}/${size}` });
      }
      const len = end - start + 1;
      const buf = Buffer.alloc(len);
      const fd = fs.openSync(file, "r"); fs.readSync(fd, buf, 0, len, start); fs.closeSync(fd);
      headers.push({ name: "Content-Length", value: String(len) });
      await cdp.send("Fetch.fulfillRequest", { requestId, responseCode: code, responseHeaders: headers, body: buf.toString("base64") });
      log.debug(`Served media ${id} ${code} bytes ${start}-${end}/${size}`);
    } catch (e) {
      log.error("Serving media failed", e.message);
      cdp.send("Fetch.failRequest", { requestId, errorReason: "Failed" }).catch(() => {});
    }
  }

  // ---------- finding and launching TradingView ----------
  // Kinds: "custom" (path set in Settings), "classic" (old .exe installer),
  // "msixcore" (MSIX Core installs), "msix" (tradingview.com download / Store, lives in WindowsApps).
  detectTV() {
    const s = this.getSettings(), env = process.env;
    if (s.tvPath) {
      let p = s.tvPath.replace(/^"|"$/g, "");
      if (process.platform === "darwin") { if (/\.app\/?$/i.test(p)) p = macExe(p); }
      else if (!/\.exe$/i.test(p)) p = path.join(p, "TradingView.exe");
      const msix = /\\WindowsApps\\/i.test(p);
      if (fs.existsSync(p) || msix) return { path: p, kind: msix ? "msix" : "custom", pkg: msix ? path.basename(path.dirname(p)) : undefined };
      log.warn("Custom TradingView path not found", p);
    }
    if (process.platform === "darwin") {
      const hit = (apps) => { for (const a of apps) { const p = macExe(a); if (fs.existsSync(p)) return { path: p, kind: "mac", app: a }; } return null; };
      const r = hit(["/Applications/TradingView.app", path.join(require("os").homedir(), "Applications", "TradingView.app")]);
      if (r) return r;
      if (this._mdfind === undefined) {
        try { this._mdfind = execSync(`mdfind "kMDItemFSName == 'TradingView.app'" | head -3`, { timeout: 5000 }).toString().trim().split("\n").filter(Boolean); } catch { this._mdfind = []; }
      }
      return hit(this._mdfind);
    }
    if (process.platform !== "win32") {
      for (const p of ["/opt/TradingView/tradingview", "/usr/bin/tradingview", "/snap/tradingview/current/tradingview"]) if (fs.existsSync(p)) return { path: p, kind: "classic" };
      return null;
    }
    const classic = [
      path.join(env.LOCALAPPDATA || "", "Programs", "TradingView", "TradingView.exe"),
      path.join(env.LOCALAPPDATA || "", "TradingView", "TradingView.exe"),
      path.join(env.PROGRAMFILES || "", "TradingView", "TradingView.exe"),
      path.join(env["PROGRAMFILES(X86)"] || "", "TradingView", "TradingView.exe"),
    ];
    for (const p of classic) if (fs.existsSync(p)) return { path: p, kind: "classic" };
    try {
      const core = path.join(env.PROGRAMFILES || "C:\\Program Files", "MsixCoreApps");
      const dirs = fs.readdirSync(core).filter((d) => /^TradingView/i.test(d)).sort().reverse();
      for (const d of dirs) { const p = path.join(core, d, "TradingView.exe"); if (fs.existsSync(p)) return { path: p, kind: "msixcore" }; }
    } catch {}
    try {
      const dir = execSync(`powershell -NoProfile -Command "(Get-AppxPackage -Name 'TradingView.Desktop' -ErrorAction SilentlyContinue | Sort-Object Version -Descending | Select-Object -First 1).InstallLocation"`,
        { timeout: 10000, windowsHide: true }).toString().trim();
      if (dir) return { path: path.join(dir, "TradingView.exe"), kind: "msix", pkg: path.basename(dir) };
      log.warn("Get-AppxPackage found no TradingView.Desktop package");
    } catch (e) { log.warn("Get-AppxPackage failed", e.message); }
    for (const d of KNOWN_MSIX_DIRS) if (fs.existsSync(path.join(d, "TradingView.exe"))) return { path: path.join(d, "TradingView.exe"), kind: "msix", pkg: path.basename(d) };
    return null;
  }
  findTV() { const d = this.detectTV(); return d ? d.path : null; }

  killTV() {
    try {
      if (process.platform === "win32") execSync("taskkill /F /IM TradingView.exe", { timeout: 6000, windowsHide: true });
      else if (process.platform === "darwin") execSync("pkill -x TradingView", { timeout: 4000 });
      else execSync("pkill -i -x tradingview", { timeout: 4000 });
    } catch {}
  }

  // Windows blocks starting the MSIX TradingView.exe with the debug flag (Access Denied).
  // Running a private copy of the same package files from MSK's folder works.
  // The copy is named after the package version, so it refreshes itself when TradingView updates.
  async msixLocalCopy(exe, dataDir) {
    const src = path.dirname(exe), pkg = path.basename(src);
    const root = path.join(dataDir, "tv-copy"), dst = path.join(root, pkg), done = path.join(dst, ".msk-ok");
    const dstExe = path.join(dst, "TradingView.exe");
    if (ofs.existsSync(done) && ofs.existsSync(dstExe)) {
      const v = verifyCopy(src, dst);
      if (v.ok) return dstExe;
      log.warn("Existing copy is broken, rebuilding", v.bad);
    }
    this.setState({ status: "launching", message: "Setting up TradingView for MSK (one time per TradingView update)..." });
    log.info("Copying TradingView package", { from: src, to: dst });
    const t0 = Date.now();
    try { for (const e of ofs.readdirSync(root)) { log.info("Removing old copy", e); await ofs.promises.rm(path.join(root, e), { recursive: true, force: true }); } } catch (e) { if (e.code !== "ENOENT") log.warn("Couldn't fully remove old copy", e.message); }
    await ofs.promises.mkdir(root, { recursive: true });
    try {
      await ofs.promises.cp(src, dst, { recursive: true, force: true, errorOnExist: false });
    } catch (e) {
      log.warn(`Normal copy failed (${e.code || e.message}), trying with admin rights (UAC prompt)`);
      await this.elevatedCopy(src, dst);
    }
    const v = verifyCopy(src, dst);
    if (!v.ok) throw Object.assign(new Error("Copy is incomplete: " + JSON.stringify(v.bad)), { code: "COPYFAIL" });
    ofs.writeFileSync(done, new Date().toISOString());
    log.info(`Copy done in ${((Date.now() - t0) / 1000).toFixed(1)}s`, { size: dirSize(dst), checked: v.checked });
    return dstExe;
  }
  getAumid(tv) {
    const fallback = "TradingView.Desktop_n534cwy3pjxzj!TradingView.Desktop";
    return new Promise((resolve) => {
      const ps = "$p = Get-AppxPackage -Name 'TradingView.Desktop' | Sort-Object Version -Descending | Select-Object -First 1; if ($p) { $id = (Get-AppxPackageManifest $p).Package.Applications.Application | Select-Object -First 1 -ExpandProperty Id; $p.PackageFamilyName + '!' + $id }";
      runPS(ps, 10000, (err, out) => {
        const v = (out || "").trim();
        if (!err && /^[^!\s]+![^!\s]+$/.test(v)) return resolve(v);
        if (tv.pkg) { const m = /^(.+?)_[\d.]+_[^_]+__(\w+)$/.exec(tv.pkg); if (m) return resolve(`${m[1]}_${m[2]}!TradingView.Desktop`); }
        resolve(fallback);
      });
    });
  }

  // Windows' IApplicationActivationManager: starts a packaged app and passes arguments to it.
  activatePackage(aumid, argStr) {
    return new Promise((resolve) => {
      if (process.platform !== "win32") return resolve({ ok: false, error: "Windows only" });
      const cs = `using System; using System.Runtime.InteropServices;
[ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMskAAM {
  void ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appUserModelId, [MarshalAs(UnmanagedType.LPWStr)] string arguments, int options, out uint processId);
}
public static class MskActivate {
  public static uint Run(string aumid, string args) {
    var t = Type.GetTypeFromCLSID(new Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C"));
    var m = (IMskAAM)Activator.CreateInstance(t);
    uint pid; m.ActivateApplication(aumid, args, 0, out pid); return pid;
  }
}`;
      const q = (x) => "'" + String(x).replace(/'/g, "''") + "'";
      const ps = `Add-Type -TypeDefinition @'\n${cs}\n'@\n[MskActivate]::Run(${q(aumid)}, ${q(argStr)})`;
      runPS(ps, 30000, (err, out, errOut) => {
        const pid = parseInt((out || "").trim().split(/\s+/).pop(), 10);
        if (!err && pid > 0) { log.info(`Package activated (pid ${pid})`); return resolve({ ok: true, pid }); }
        const msg = ((errOut || "") + " " + (err ? err.message : "")).trim().slice(0, 400);
        log.warn("Package activation error", msg);
        resolve({ ok: false, error: msg || "no pid returned" });
      });
    });
  }

  // Start-Process on the package exe (works on some PCs, blocked on others).
  startDirect(exe, args) {
    return new Promise((resolve) => {
      if (process.platform !== "win32") { try { const c = spawn(exe, args, { detached: true, stdio: "ignore" }); c.unref(); return resolve(null); } catch (e) { return resolve(e.code); } }
      const q = (x) => "'" + String(x).replace(/'/g, "''") + "'";
      const ps = `Start-Process -FilePath ${q(exe)} -ArgumentList ${args.map(q).join(",")}`;
      log.info("Launch method: direct start", { exe, args });
      runPS(ps, 20000, (err, out, errOut) => {
        if (err) { const m = ((errOut || "") + err.message).trim().slice(0, 300); log.warn("Direct start error", m); return resolve(m || "failed"); }
        resolve(null);
      });
    });
  }

  elevatedCopy(src, dst) {
    return new Promise((resolve) => {
      const q = (x) => "'" + x.replace(/'/g, "''") + "'";
      // robocopy args are wrapped in double quotes inside single-quoted PowerShell strings
      const arg = (x) => q('"' + x + '"');
      const ps = `$p = Start-Process -FilePath robocopy -ArgumentList ${arg(src)},${arg(dst)},'/E','/R:1','/W:1','/NFL','/NDL','/NP' -Verb RunAs -Wait -WindowStyle Hidden -PassThru; exit $p.ExitCode`;
      log.debug("Elevated copy command", ps);
      runPS(ps, 300000, (err, out, errOut) => {
        const code = err ? err.code : 0;
        if (typeof code === "number" && code < 8) log.info(`Elevated copy finished (robocopy ${code})`);
        else log.error("Elevated copy failed", (errOut || (err && err.message) || "").trim());
        resolve();
      });
    });
  }

  // Kill TradingView (store + MSK copy) and whatever is holding the hook port.
  async killAll() {
    const killed = [];
    for (const t of this.targets.values()) t.cdp.close();
    this.targets.clear();
    if (process.platform === "win32") {
      const list = () => { try { return execSync("tasklist /FO CSV /NH", { windowsHide: true, timeout: 8000 }).toString(); } catch { return ""; } };
      const procs = list().split(/\r?\n/).map((l) => l.split('","').map((x) => x.replace(/"/g, ""))).filter((r) => r.length > 1);
      for (const [name, pid] of procs) if (/^TradingView\.exe$/i.test(name)) killed.push(`${name} (${pid})`);
      try { execSync("taskkill /F /T /IM TradingView.exe", { windowsHide: true, timeout: 10000 }); } catch {}
      try {
        const net = execSync("netstat -ano -p TCP", { windowsHide: true, timeout: 8000 }).toString();
        const pids = new Set();
        for (const line of net.split(/\r?\n/)) { const m = line.trim().split(/\s+/); if (m.length >= 5 && m[1].endsWith(":" + this.port) && /LISTEN/i.test(m[3])) pids.add(m[4]); }
        for (const pid of pids) {
          if (+pid === process.pid || +pid === 0) continue;
          const name = (procs.find((r) => r[1] === pid) || [])[0] || "pid";
          try { execSync(`taskkill /F /T /PID ${pid}`, { windowsHide: true, timeout: 8000 }); killed.push(`${name} (${pid}) on port ${this.port}`); } catch (e) { log.warn(`Couldn't kill ${name} (${pid})`, e.message); }
        }
      } catch (e) { log.warn("netstat failed", e.message); }
    } else {
      const darwin = process.platform === "darwin";
      try { const l = execSync(darwin ? "pgrep -lf 'TradingView.app/Contents/' || true" : "pgrep -l -i tradingview || true", { timeout: 4000 }).toString().trim(); if (l) l.split("\n").forEach((x) => killed.push(x.slice(0, 80))); } catch {}
      try { execSync(darwin ? "pkill -9 -f 'TradingView.app/Contents/'" : "pkill -9 -i -x tradingview", { timeout: 4000 }); } catch {}
      try {
        const pids = execSync(`lsof -nP -iTCP:${this.port} -sTCP:LISTEN -t || true`, { timeout: 5000 }).toString().trim().split("\n").filter(Boolean);
        for (const pid of pids) { if (+pid === process.pid) continue; try { process.kill(+pid, "SIGKILL"); killed.push(`pid ${pid} on port ${this.port}`); } catch {} }
      } catch {}
    }
    log.info(killed.length ? `Killed: ${killed.join(", ")}` : "Nothing to kill");
    this.runningNoPort = false; this.lastRunCheck = 0;
    setTimeout(() => this.poll(), 800);
    return killed;
  }

  // One-shot health check that dumps everything useful into the log.
  async diagnose(dataDir) {
    log.info("==== Diagnostics ====");
    log.info("MSK", { platform: process.platform, arch: process.arch, electron: process.versions.electron, port: this.port });
    const d = this.detectTV();
    log.info("TradingView detected", d || "none");
    if (d && d.kind === "msix") {
      log.info("Package exe readable", fs.existsSync(d.path));
      log.info("MSK copy", this.copyInfo(dataDir) || "none yet");
    }
    log.info("TradingView running", this.isRunning());
    log.info("Ports", { configured: this.port, attachedTo: this.cdpPort, hookedProcessPort: await this.findHookedPort() });
    const ver = await getJSON(`http://127.0.0.1:${this.cdpPort}/json/version`);
    log.info("Hook port", ver ? { open: true, browser: ver.Browser, ua: (ver["User-Agent"] || "").slice(0, 90) } : { open: false });
    const list = await getJSON(`http://127.0.0.1:${this.cdpPort}/json/list`);
    if (list) log.info(`Targets (${list.length})`, list.map((t) => ({ type: t.type, url: t.url.slice(0, 120) })));
    for (const [, rec] of this.targets) {
      try {
        const r = await rec.cdp.send("Runtime.evaluate", { returnByValue: true, expression: `(() => {
          const out = { url: location.href.slice(0, 100), engine: !!window.__MSK, status: window.__MSK && window.__MSK.status };
          const api = window.TradingViewApi; out.api = !!api;
          if (api) {
            out.apiKeys = Object.keys(api).slice(0, 50);
            try { out.chartsCount = api.chartsCount ? api.chartsCount() : null; } catch (e) { out.chartsCountErr = String(e); }
            try {
              const c = api._activeChartWidgetWV && api._activeChartWidgetWV.value(); out.chartApi = !!c;
              const cw = c && c._chartWidget; out.chartWidget = !!cw;
              const keys = (o) => o ? Object.keys(o.childs ? o.childs() : o).slice(0, 40) : null;
              try { out.mainSeriesProps = keys(cw.model().mainSeries().properties()); } catch (e) { out.mainSeriesErr = String(e); }
              try { out.chartProps = keys(cw.properties()); } catch (e) { out.chartPropsErr = String(e); }
            } catch (e) { out.chartErr = String(e); }
          }
          out.root = !!document.getElementById("__msk_root");
          const m = document.querySelector("#__msk_root img, #__msk_root video");
          out.media = m ? { tag: m.tagName, src: m.src.slice(0, 80), w: m.naturalWidth || m.videoWidth, ready: m.readyState, paused: m.paused } : null;
          return out; })()` });
        log.info("Window probe", r && r.result && r.result.value);
      } catch (e) { log.error("Probe failed", e.message); }
    }
    log.info("==== End diagnostics ====");
  }

  // Launch experiments: does TradingView survive without the hook flag? with it? Logs exit codes + output.
  async hookTest(dataDir) {
    log.info("==== Launch test ====");
    const tv = this.detectTV();
    if (!tv) { log.error("TradingView not found"); return; }
    await this.killAll();
    await new Promise((r) => setTimeout(r, 1500));
    let exe = tv.path;
    if (tv.kind === "msix") { try { exe = await this.msixLocalCopy(tv.path, dataDir); } catch (e) { log.error("Copy failed", e.message); return; } }
    const logDir = path.dirname(LOG.file() || dataDir);
    const trial = (name, args, exePath = exe) => new Promise((resolve) => {
      const out = path.join(logDir, `test-${name}.log`);
      let fd = "ignore"; try { fd = ofs.openSync(out, "w"); } catch {}
      log.info(`Test ${name}: starting`, { exe: exePath, args });
      let exited = null, c;
      try { c = spawn(exePath, args, { stdio: ["ignore", fd, fd], cwd: path.dirname(exePath) }); } catch (e) { log.error(`Test ${name}: spawn threw`, e.message); return resolve(); }
      c.on("error", (e) => { exited = "spawn error " + e.code; });
      c.on("exit", (code, sig) => { exited = `exit code ${code}${sig ? " " + sig : ""}`; });
      setTimeout(async () => {
        const port = args.find((a) => a.startsWith("--remote-debugging-port"));
        const portOpen = port ? !!(await getJSON(`http://127.0.0.1:${this.port}/json/version`)) : null;
        let tail = ""; try { tail = ofs.readFileSync(out, "utf8").trim().slice(-4000); } catch {}
        log[exited ? "warn" : "info"](`Test ${name}: ${exited ? "CLOSED (" + exited + ")" : "still running after 12s"}${port ? ", port " + (portOpen ? "open" : "closed") : ""}`, tail || "(no output)");
        try { process.kill(c.pid); } catch {}
        this.killTV();
        await new Promise((r) => setTimeout(r, 2000));
        resolve();
      }, 12000);
    });
    log.info("TradingView kind", tv);
    await trial("A-plain", ["--enable-logging=stderr"]);
    await trial("B-hook", [`--remote-debugging-port=${this.port}`, "--enable-logging=stderr"]);
    await trial("C-hook-port0", ["--remote-debugging-port=0", "--enable-logging=stderr"]);
    log.info("==== End launch test ====");
    this.poll();
  }

  copyInfo(dataDir) {
    const root = path.join(dataDir, "tv-copy");
    try { const d = ofs.readdirSync(root).find((x) => ofs.existsSync(path.join(root, x, ".msk-ok"))); return d ? { pkg: d, path: path.join(root, d, "TradingView.exe") } : null; } catch { return null; }
  }
  async resetCopy(dataDir) { await ofs.promises.rm(path.join(dataDir, "tv-copy"), { recursive: true, force: true }).catch((e) => log.warn("Reset copy failed", e.message)); log.info("MSK's TradingView copy cleared"); }

  async waitForPort(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await getJSON(`http://127.0.0.1:${this.port}/json/version`)) return true;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }

  async launch({ restart = false, dataDir } = {}) {
    if (this.busy) return { ok: false, message: "Already starting TradingView..." };
    if (await getJSON(`http://127.0.0.1:${this.cdpPort}/json/version`)) return { ok: true, message: "Already hooked" };
    const tv = this.detectTV();
    log.info("Launch requested", { restart, found: tv });
    if (!tv) { log.error("TradingView not found"); return { ok: false, message: "Couldn't find TradingView. Install it from tradingview.com/desktop or set the path in Settings." }; }
    if (this.isRunning()) {
      if (!restart) return { ok: false, needsRestart: true, message: "MSK isn't connected to the running TradingView. Relaunch it from MSK." };
      this.killTV(); await new Promise((r) => setTimeout(r, 1500));
    }
    this.busy = true; this.launching = true; this.setState({ status: "launching", message: "Starting TradingView..." });
    this.livePort = null;
    const args = [`--remote-debugging-port=${this.port}`, "--remote-debugging-address=127.0.0.1"];
    if (LOG.isVerbose()) args.push("--enable-logging");
    const run = (file) => new Promise((resolve) => {
      log.info("Starting", { exe: file, args });
      const outFile = path.join(path.dirname(LOG.file() || dataDir), "tradingview.log");
      let fd = "ignore"; try { fd = ofs.openSync(outFile, "w"); } catch {}
      const darwin = process.platform === "darwin";
      const bundle = darwin ? file.replace(/\/Contents\/MacOS\/[^/]+$/, "") : null;
      let c; try {
        c = darwin
          ? spawn("open", ["-n", "-a", bundle, ...(fd !== "ignore" ? ["--stdout", outFile, "--stderr", outFile] : []), "--args", ...args], { detached: true, stdio: "ignore" })
          : spawn(file, args, { detached: true, stdio: ["ignore", fd, fd], cwd: path.dirname(file) });
      } catch (e) { log.error("Spawn threw", e.message); return resolve(e.code || "spawn failed"); }
      c.once("error", (e) => { log.error("Spawn error", e.message); resolve(e.code || "spawn failed"); });
      c.once("exit", (code) => {
        if (darwin && code === 0) return; // `open` hands off to macOS and exits right away
        let tail = ""; try { tail = ofs.readFileSync(outFile, "utf8").trim().slice(-1500); } catch {}
        log.warn(`TradingView process exited (code ${code})`, tail || "(no output)");
      });
      c.unref(); setTimeout(() => resolve(null), 1200);
    });
    let ok = false, why = "";
    const method = this.getSettings().launchMethod || "auto";
    try {
      if (tv.kind === "msix" && (method === "auto" || method === "package")) {
        // Standard Windows package activation (IApplicationActivationManager) with the debug switch as an argument.
        const aumid = await this.getAumid(tv);
        log.info("Launch method: package activation", { aumid });
        this.setState({ status: "launching", message: "Starting TradingView..." });
        const r = await this.activatePackage(aumid, args.join(" "));
        if (r.ok) { ok = await this.waitForPort(25000); if (!ok) why = "package started but the hook port didn't open"; }
        else why = "package activation failed: " + r.error;
        if (!ok) {
          log.warn("Package activation didn't hook (" + why + "), trying direct start");
          this.killTV(); await new Promise((r2) => setTimeout(r2, 1200));
          const err = await this.startDirect(tv.path, args);
          if (!err) { ok = await this.waitForPort(20000); if (!ok) why = "direct start didn't open the hook port"; } else why = "direct start failed: " + err;
        }
        if (!ok && method === "auto") { log.warn("Falling back to MSK's private copy"); this.killTV(); await new Promise((r2) => setTimeout(r2, 1200)); }
      }
      if (!ok && (tv.kind !== "msix" || method === "auto" || method === "copy")) {
        let exe = tv.path;
        if (tv.kind === "msix") { log.info("Launch method: private copy"); exe = await this.msixLocalCopy(tv.path, dataDir); }
        this.setState({ status: "launching", message: "Starting TradingView..." });
        const err = await run(exe);
        if (err) why = `couldn't start it (${err})`;
        else { ok = await this.waitForPort(25000); if (!ok) why = "it started but the hook port never opened"; }
      }
    } catch (e) { log.error("Launch failed", e); why = e.code === "EPERM" || e.code === "EACCES" ? "Windows blocked copying TradingView's files" : String(e.message || e); }
    log[ok ? "info" : "error"](ok ? "Hook port is open" : "Not hooked: " + why);
    this.busy = false; this.launching = false;
    this.setState({ message: "" });
    this.poll();
    return ok ? { ok: true, message: "TradingView hooked" } : { ok: false, message: `TradingView not hooked: ${why}.` };
  }
}

// The executable inside a macOS .app bundle (CFBundleExecutable, usually "TradingView").
function macExe(app) {
  let name = "TradingView";
  try { const m = fs.readFileSync(path.join(app, "Contents", "Info.plist"), "utf8").match(/<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/); if (m) name = m[1]; } catch {}
  return path.join(app, "Contents", "MacOS", name);
}

// Run a PowerShell script safely (no quoting issues) via -EncodedCommand.
function runPS(script, timeout, cb) {
  const enc = Buffer.from(script, "utf16le").toString("base64");
  return execFile("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", enc], { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, cb);
}

function dirBytes(d) {
  let n = 0;
  try { for (const e of ofs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); n += e.isDirectory() ? dirBytes(p) : ofs.statSync(p).size; } } catch {}
  return n;
}
function dirSize(d) { return Math.round(dirBytes(d) / 1048576) + " MB"; }
// Compare the files that matter. The source may not be listable (WindowsApps), but single files can be stat'ed.
function verifyCopy(src, dst) {
  const bad = [], checked = [];
  for (const rel of ["TradingView.exe", path.join("resources", "app.asar"), "resources.pak", "icudtl.dat", "v8_context_snapshot.bin"]) {
    let a = null, b = null;
    try { a = ofs.statSync(path.join(src, rel)).size; } catch {}
    try { b = ofs.statSync(path.join(dst, rel)).size; } catch {}
    if (a === null && b !== null && b > 0) { checked.push(rel + " (src unreadable)"); continue; }
    if (a === null && b === null) continue;
    if (a !== b || !b) bad.push({ file: rel, src: a, copy: b }); else checked.push(rel);
  }
  return { ok: !bad.length && checked.length > 0, bad, checked };
}

module.exports = { TVConnector, mimeOf };
