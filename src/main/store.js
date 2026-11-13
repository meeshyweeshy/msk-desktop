// Simple JSON store kept in the user's AppData folder. No accounts, everything local.
const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dir = app.getPath("userData");
const file = path.join(dir, "msk.json");
const mediaDir = path.join(dir, "media");
const thumbDir = path.join(dir, "thumbs");
for (const d of [mediaDir, thumbDir]) fs.mkdirSync(d, { recursive: true });

const uid = () => crypto.randomBytes(6).toString("hex");

const DEFAULT_SETTINGS = {
  theme: "dark",
  startup: false,
  startHidden: true,
  closeToTray: true,
  autoLaunchTV: true,
  tvPath: "",
  port: 9222,
  launchMethod: "auto",
  showLogs: true,
  autoUpdate: true,
  fxFps: 11,
  rotation: { enabled: false, minutes: 15 },
  hotkeys: { toggle: "CommandOrControl+Alt+B", next: "CommandOrControl+Alt+N", fx: "CommandOrControl+Alt+F" },
  firstRun: true,
};

function baseConfig(name, chart, bg = {}) {
  return {
    id: uid(),
    name,
    builtIn: false,
    rotate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    bg: {
      mediaId: null, mode: "behind", fit: "cover", position: "center",
      opacity: 0.85, blur: 0, brightness: 0.8, saturation: 1, speed: 1,
      tint: "#000000", tintStrength: 0.25, vignette: 0.45, base: { mode: "solid", color: "#000000", color2: "#0B3B3A", angle: 160 }, ...bg,
    },
    chart: {
      apply: true,
      up: "#FFFFFF", down: "#3A3A3A",
      borderUp: "#FFFFFF", borderDown: "#8A8A8A",
      wickUp: "#FFFFFF", wickDown: "#8A8A8A",
      paneBg: "#000000", paneTransparent: true,
      grid: false, gridColor: "#FFFFFF14",
      text: "#D9D9D9", crosshair: "#39C5BB",
      ...chart,
    },
    ui: { glassToolbars: false },
    fx: [],
    fxOn: true,
  };
}

function presets() {
  return [
    baseConfig("Monochrome", {}),
  ].map((c) => ({ ...c, builtIn: true }));
}

let data;
function load() {
  try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch { data = null; }
  if (!data) {
    const configs = presets();
    data = { settings: { ...DEFAULT_SETTINGS }, media: [], configs, activeConfigId: configs[0].id, enabled: true };
  }
  data.settings = { ...DEFAULT_SETTINGS, ...data.settings,
    rotation: { ...DEFAULT_SETTINGS.rotation, ...(data.settings?.rotation || {}) },
    hotkeys: { ...DEFAULT_SETTINGS.hotkeys, ...(data.settings?.hotkeys || {}) } };
  data.media ||= []; data.configs ||= [];
  // 1.4: Monochrome is the only built-in look. Drop the old untouched presets (your own copies stay).
  data.configs = data.configs.filter((c) => !c.builtIn || ["MSK Mono", "Monochrome"].includes(c.name));
  data.configs.forEach((c) => { if (c.builtIn && c.name === "MSK Mono") c.name = "Monochrome"; });
  if (!data.configs.length) data.configs = presets();
  if (!data.configs.find((c) => c.id === data.activeConfigId)) data.activeConfigId = data.configs[0]?.id || null;
  saveNow();
  return data;
}

let t;
function save() { clearTimeout(t); t = setTimeout(saveNow, 250); }
function saveNow() {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

const get = () => data;
const mediaPath = (m) => path.join(mediaDir, m.file);
const thumbPath = (m) => path.join(thumbDir, m.id + ".jpg");
const activeConfig = () => data.configs.find((c) => c.id === data.activeConfigId) || null;

module.exports = { load, save, saveNow, get, uid, baseConfig, presets, mediaDir, thumbDir, mediaPath, thumbPath, activeConfig, dir };
