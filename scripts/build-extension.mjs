// Builds the MSK Chrome extension into dist/extension (+ dist/MSK-extension.zip).
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { Resvg } from "@resvg/resvg-js";
import { logoSVG, smallIconSVG } from "./logo.mjs";

const test = process.env.MSK_EXT_TEST === "1";
const out = "dist/extension";
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "studio"), { recursive: true });
fs.mkdirSync(path.join(out, "icons"), { recursive: true });

// Studio = the desktop UI + a browser-backed API shim
fs.cpSync("src/renderer", path.join(out, "studio"), { recursive: true });
let html = fs.readFileSync("src/renderer/index.html", "utf8");
html = html.replace('<script src="logo.js"></script>', '<script src="../common.js"></script>\n  <script src="shim.js"></script>\n  <script src="logo.js"></script>');
html = html.replace("<title>MSK</title>", "<title>MSK Studio</title>");
fs.writeFileSync(path.join(out, "studio/index.html"), html);
fs.copyFileSync("src/extension/shim.js", path.join(out, "studio/shim.js"));

for (const f of ["common.js", "content.js", "bridge-main.js", "layer.html", "layer.js", "background.js", "popup.html", "popup.css", "popup.js"])
  fs.copyFileSync(path.join("src/extension", f), path.join(out, f));
fs.copyFileSync("src/inject/engine.js", path.join(out, "engine.js"));

const render = (svg, w) => new Resvg(svg, { fitTo: { mode: "width", value: w } }).render().asPng();
for (const s of [16, 32]) fs.writeFileSync(path.join(out, `icons/${s}.png`), render(smallIconSVG(), s));
for (const s of [48, 128]) fs.writeFileSync(path.join(out, `icons/${s}.png`), render(logoSVG(), s));

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const chart = ["https://*.tradingview.com/chart*", ...(test ? ["http://localhost/chart*"] : [])];
const manifest = {
  manifest_version: 3,
  name: "MSK",
  version: pkg.version,
  description: "Custom photo/video backgrounds, candle colors and animations for TradingView charts.",
  icons: { 16: "icons/16.png", 32: "icons/32.png", 48: "icons/48.png", 128: "icons/128.png" },
  action: { default_popup: "popup.html", default_title: "MSK", default_icon: { 16: "icons/16.png", 32: "icons/32.png" } },
  options_page: "studio/index.html",
  background: { service_worker: "background.js" },
  permissions: ["storage", "unlimitedStorage", "alarms"],
  host_permissions: ["https://*.tradingview.com/*", ...(test ? ["http://localhost/*"] : [])],
  content_scripts: [
    { matches: chart, js: ["studio/fx.js", "engine.js", "bridge-main.js"], run_at: "document_start", world: "MAIN" },
    { matches: chart, js: ["common.js", "content.js"], run_at: "document_idle" },
  ],
  web_accessible_resources: [{ resources: ["layer.html", "layer.js", "common.js", "studio/fx.js"], matches: test ? ["https://*.tradingview.com/*", "http://localhost/*"] : ["https://*.tradingview.com/*"] }],
  commands: {
    "toggle-bg": { suggested_key: { default: "Alt+Shift+B" }, description: "Turn background on/off" },
    "next-config": { suggested_key: { default: "Alt+Shift+N" }, description: "Next config" },
    "toggle-fx": { suggested_key: { default: "Alt+Shift+F" }, description: "Pause/resume animations" },
  },
};
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
if (!test && !process.env.MSK_NO_ZIP) {
  fs.rmSync("dist/MSK-extension.zip", { force: true });
  execSync(`cd dist && cp -r extension MSK-extension && zip -q -r -9 MSK-extension.zip MSK-extension && rm -rf MSK-extension`);
}
console.log("extension built", test ? "(test)" : "");
