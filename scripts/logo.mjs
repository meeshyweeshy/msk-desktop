// "meeshy" in a hand-drawn blocky pixel font (Minecraft-style look, original glyphs).
const GLYPHS = {
  m: ["", "", "XX.X.", "X.X.X", "X.X.X", "X...X", "X...X", ""],
  e: ["", "", ".XXX.", "X...X", "XXXXX", "X....", ".XXXX", ""],
  s: ["", "", ".XXXX", "X....", ".XXX.", "....X", "XXXX.", ""],
  h: ["X....", "X....", "X.XX.", "XX..X", "X...X", "X...X", "X...X", ""],
  y: ["", "", "X...X", "X...X", "X...X", ".XXXX", "....X", "XXXX."],
};
const WORD = "meeshy";
export const COLS = WORD.length * 6 - 1; // 35
export const ROWS = 8;

function pixels(px, ox, oy, fill) {
  let out = "";
  [...WORD].forEach((ch, i) => {
    GLYPHS[ch].forEach((row, r) => {
      [...row].forEach((c, col) => {
        if (c === "X") out += `<rect x="${ox + (i * 6 + col) * px}" y="${oy + r * px}" width="${px}" height="${px}" fill="${fill}"/>`;
      });
    });
  });
  return out;
}

// Square app icon: dark tile, white pixel text, Miku-cyan drop shadow.
export function logoSVG() {
  const px = 13, w = COLS * px, hgt = ROWS * px;
  const ox = Math.round((512 - w - px) / 2), oy = Math.round((512 - hgt - px) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" shape-rendering="crispEdges">
  <defs>
    <linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1d1f"/><stop offset="1" stop-color="#000"/></linearGradient>
  </defs>
  <rect x="8" y="8" width="496" height="496" rx="104" fill="url(#t)" shape-rendering="geometricPrecision"/>
  <rect x="8" y="8" width="496" height="496" rx="104" fill="none" stroke="#39C5BB" stroke-opacity=".55" stroke-width="6" shape-rendering="geometricPrecision"/>
  <g>${pixels(px, ox + px, oy + px, "#0F3F3C")}</g>
  <g>${pixels(px, ox, oy, "#FFFFFF")}</g>
</svg>`;
}

// Wordmark only (transparent), for inside the app.
export function wordmarkSVG() {
  const px = 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(COLS + 1) * px} ${(ROWS + 1) * px}" shape-rendering="crispEdges">
  <g class="sh">${pixels(px, px, px, "#39C5BB")}</g>
  <g class="fg">${pixels(px, 0, 0, "currentColor")}</g>
</svg>`;
}

// Tiny sizes (tray, small taskbar icons): just a pixel "m" so it stays readable.
export function smallIconSVG() {
  const g = GLYPHS.m.slice(2, 7), px = 64, ox = 96, oy = 112;
  let r = "";
  g.forEach((row, y) => [...row].forEach((c, x) => { if (c === "X") {
    r += `<rect x="${ox + x * px + 16}" y="${oy + y * px + 16}" width="${px}" height="${px}" fill="#0F3F3C"/>`;
  } }));
  g.forEach((row, y) => [...row].forEach((c, x) => { if (c === "X") {
    r += `<rect x="${ox + x * px}" y="${oy + y * px}" width="${px}" height="${px}" fill="#fff"/>`;
  } }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" shape-rendering="crispEdges">
  <rect x="8" y="8" width="496" height="496" rx="104" fill="#0b0d0e" shape-rendering="geometricPrecision"/>
  <rect x="8" y="8" width="496" height="496" rx="104" fill="none" stroke="#39C5BB" stroke-opacity=".6" stroke-width="14" shape-rendering="geometricPrecision"/>${r}</svg>`;
}
