const { contextBridge, ipcRenderer, webUtils } = require("electron");
const inv = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld("msk", {
  state: inv("state"),
  onState: (fn) => ipcRenderer.on("state", (_e, s) => fn(s)),
  onToast: (fn) => ipcRenderer.on("toast", (_e, t) => fn(t)),
  onNav: (fn) => ipcRenderer.on("nav", (_e, p) => fn(p)),
  onWin: (fn) => ipcRenderer.on("win", (_e, w) => fn(w)),
  pathFor: (file) => { try { return webUtils.getPathForFile(file); } catch { return null; } },
  media: { import: inv("media:import"), thumb: inv("media:thumb"), update: inv("media:update"), remove: inv("media:delete") },
  config: {
    save: inv("config:save"), remove: inv("config:delete"), duplicate: inv("config:duplicate"), rename: inv("config:rename"),
    rotate: inv("config:rotate"), reorder: inv("config:reorder"), activate: inv("config:activate"), next: inv("config:next"),
    preview: inv("config:preview"), export: inv("config:export"), import: inv("config:import"),
  },
  setEnabled: inv("enabled:set"),
  fxPause: inv("fx:pause"),
  update: { check: inv("update:check"), open: inv("update:open"), dismiss: inv("update:dismiss") },
  openUrl: inv("app:openUrl"),
  logs: { get: inv("logs:get"), clear: inv("logs:clear"), open: inv("logs:open"), verbose: inv("logs:verbose"), ui: inv("logs:ui"), on: (fn) => ipcRenderer.on("logs", (_e, b) => fn(b)) },
  settings: inv("settings:update"),
  tv: { launch: inv("tv:launch"), detect: inv("tv:detect"), browse: inv("tv:browse"), resetCopy: inv("tv:resetCopy"), shortcut: inv("tv:shortcut"), kill: inv("tv:kill"), diagnose: inv("tv:diagnose"), test: inv("tv:test") },
  app: { openData: inv("app:openData"), reset: inv("app:reset"), devtools: inv("app:devtools"), restart: inv("app:restart") },
  win: { min: inv("win:min"), max: inv("win:max"), close: inv("win:close") },
});
