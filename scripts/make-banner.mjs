// README banner + social preview: "MeeshySK" in MSK's hand-drawn pixel font, Miku blue.
import fs from "fs";
import { Resvg } from "@resvg/resvg-js";

const G = {
  M: ["X...X", "XX.XX", "X.X.X", "X.X.X", "X...X", "X...X", "X...X", ""],
  S: [".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX.", ""],
  K: ["X...X", "X..X.", "X.X..", "XX...", "X.X..", "X..X.", "X...X", ""],
  e: ["", "", ".XXX.", "X...X", "XXXXX", "X....", ".XXXX", ""],
  s: ["", "", ".XXXX", "X....", ".XXX.", "....X", "XXXX.", ""],
  h: ["X....", "X....", "X.XX.", "XX..X", "X...X", "X...X", "X...X", ""],
  y: ["", "", "X...X", "X...X", "X...X", ".XXXX", "....X", "XXXX."],
};
const WORD = "MeeshySK";
const cols = WORD.length * 6 - 1, rows = 8;
function pix(px, ox, oy, fill, cls = "") {
  let out = "";
  [...WORD].forEach((ch, i) => G[ch].forEach((row, r) => [...row].forEach((c, col) => {
    if (c === "X") out += `<rect class="${cls}" x="${ox + (i * 6 + col) * px}" y="${oy + r * px}" width="${px}" height="${px}" fill="${fill}"/>`;
  })));
  return out;
}
function candles(W, H, n, seed, anim) {
  let s = seed, out = "";
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const step = W / n; let p = H * 0.8;
  for (let i = 0; i < n; i++) {
    const o = p, c = o + (rnd() - 0.5) * 34, hi = Math.min(o, c) - rnd() * 16, lo = Math.max(o, c) + rnd() * 16;
    p = Math.min(H * 0.93, Math.max(H * 0.6, c));
    const x = i * step + step * 0.3, w = step * 0.42, up = c < o;
    const col = up ? "#39C5BB" : "#FFFFFF";
    out += `<g class="${anim ? "cd" : ""}" style="animation-delay:${(i * 0.09).toFixed(2)}s"><line x1="${x + w / 2}" y1="${hi}" x2="${x + w / 2}" y2="${lo}" stroke="${col}" stroke-width="2"/><rect x="${x}" y="${Math.min(o, c)}" width="${w}" height="${Math.max(3, Math.abs(c - o))}" fill="${col}" rx="1.5"/></g>`;
  }
  return `<g opacity="${anim ? 0.22 : 0.18}">${out}</g>`;
}
function banner({ W, H, px, animated, sub = true, subtitle = "BACKGROUNDS &amp; COLORS FOR TRADINGVIEW" }) {
  const tw = (cols + 1) * px, th = (rows + 1) * px;
  const ox = Math.round((W - tw) / 2), oy = Math.round(H * (sub ? 0.43 : 0.5) - th / 2);
  const css = animated ? `<style>
    .glow{animation:glow 4s ease-in-out infinite}
    @keyframes glow{0%,100%{opacity:.55}50%{opacity:1}}
    .cd{animation:bob 3.2s ease-in-out infinite}
    @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    .sweep{animation:sweep 5s ease-in-out infinite}
    @keyframes sweep{0%{transform:translateX(-${W}px)}60%,100%{transform:translateX(${W}px)}}
    .scan{animation:scan 7s linear infinite}
    @keyframes scan{from{transform:translateY(-40px)}to{transform:translateY(${H}px)}}
  </style>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">${css}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#03080A"/><stop offset=".55" stop-color="#071416"/><stop offset="1" stop-color="#020405"/></linearGradient>
    <radialGradient id="halo" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#39C5BB" stop-opacity=".33"/><stop offset=".55" stop-color="#39C5BB" stop-opacity=".07"/><stop offset="1" stop-color="#39C5BB" stop-opacity="0"/></radialGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <pattern id="grid" width="${px * 2}" height="${px * 2}" patternUnits="userSpaceOnUse"><path d="M ${px * 2} 0 L 0 0 0 ${px * 2}" fill="none" stroke="#39C5BB" stroke-opacity=".06" stroke-width="1"/></pattern>
    <filter id="blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${px * 1.2}"/></filter>
    <clipPath id="txt">${pix(px, ox, oy, "#fff")}</clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect width="${W}" height="${H}" fill="url(#halo)"/>
  ${candles(W, H, Math.round(W / 26), 11, animated)}
  ${animated ? `<rect class="scan" x="0" y="0" width="${W}" height="2" fill="#39C5BB" opacity=".18"/>` : ""}
  <g class="glow" filter="url(#blur)">${pix(px, ox, oy, "#39C5BB")}</g>
  <g>${pix(px, ox + px, oy + px, "#1F8F89")}</g>
  <g>${pix(px, ox, oy, "#FFFFFF")}</g>
  ${animated ? `<g clip-path="url(#txt)"><rect class="sweep" x="0" y="${oy}" width="${W * 0.18}" height="${th}" fill="url(#shine)"/></g>` : ""}
  ${sub ? `<text x="${W / 2}" y="${oy + th + px * 3.2}" text-anchor="middle" font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="${Math.round(px * 1.55)}" letter-spacing="${Math.round(px * 0.55)}" fill="#BFF7F2" shape-rendering="geometricPrecision">${subtitle}</text>
  <rect x="${W / 2 - px * 3}" y="${oy + th + px * 4.6}" width="${px * 6}" height="${Math.max(2, px / 4)}" fill="#39C5BB" rx="1"/>` : ""}
</svg>`;
}

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/banner.svg", banner({ W: 1280, H: 380, px: 14, animated: true }));
fs.writeFileSync("docs/banner-desktop.svg", banner({ W: 1280, H: 380, px: 14, animated: true, subtitle: "BACKGROUNDS &amp; COLORS FOR TRADINGVIEW DESKTOP" }));
fs.writeFileSync("docs/social-preview-desktop.png", new Resvg(banner({ W: 1280, H: 640, px: 18, animated: false, subtitle: "BACKGROUNDS &amp; COLORS FOR TRADINGVIEW DESKTOP" }), { fitTo: { mode: "width", value: 1280 }, font: { loadSystemFonts: true } }).render().asPng());
const social = banner({ W: 1280, H: 640, px: 18, animated: false });
fs.writeFileSync("docs/social-preview.png", new Resvg(social, { fitTo: { mode: "width", value: 1280 }, font: { loadSystemFonts: true } }).render().asPng());
fs.writeFileSync("docs/banner-preview.png", new Resvg(banner({ W: 1280, H: 380, px: 14, animated: false }), { fitTo: { mode: "width", value: 1280 }, font: { loadSystemFonts: true } }).render().asPng());
console.log("banner done");
