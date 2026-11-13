// MSK animations. Shared by the app preview and the engine injected into TradingView.
// An animation = { id, target, wave, period (s), min, max, phase (0-1), on, curve?, bez? }.
// curve shapes how the value travels between min and max (cubic-bezier, like CSS easing).
(function (root) {
  const TARGETS = {
    opacity: { label: "Opacity", group: "Background", kind: "num", min: 0, max: 100, unit: "%", def: [40, 100], path: "bg.opacity", scale: 0.01 },
    brightness: { label: "Brightness", group: "Background", kind: "num", min: 0, max: 200, unit: "%", def: [50, 115], path: "bg.brightness", scale: 0.01 },
    saturation: { label: "Saturation", group: "Background", kind: "num", min: 0, max: 300, unit: "%", def: [60, 220], path: "bg.saturation", scale: 0.01 },
    blur: { label: "Blur", group: "Background", kind: "num", min: 0, max: 40, unit: "px", def: [0, 10], path: "bg.blur", scale: 1 },
    hue: { label: "Hue shift (rainbow)", group: "Background", kind: "num", min: 0, max: 360, unit: "°", def: [0, 360], path: "bg.hue", scale: 1 },
    zoom: { label: "Zoom", group: "Background", kind: "num", min: 100, max: 160, unit: "%", def: [100, 112], path: "bg.zoom", scale: 0.01 },
    tintStrength: { label: "Tint strength", group: "Background", kind: "num", min: 0, max: 100, unit: "%", def: [0, 55], path: "bg.tintStrength", scale: 0.01 },
    vignette: { label: "Vignette", group: "Background", kind: "num", min: 0, max: 100, unit: "%", def: [20, 85], path: "bg.vignette", scale: 0.01 },
    baseAngle: { label: "Base gradient angle", group: "Background", kind: "num", min: 0, max: 360, unit: "°", def: [0, 360], path: "bg.base.angle", scale: 1 },
    base: { label: "Base color", group: "Color cycle", kind: "color", min: 0, max: 360, unit: "°", def: [0, 360], base: "color", l: 0.32 },
    base2: { label: "Base gradient 2nd color", group: "Color cycle", kind: "color", min: 0, max: 360, unit: "°", def: [180, 540], base: "color2", l: 0.32 },
    tint: { label: "Tint color", group: "Color cycle", kind: "color", min: 0, max: 360, unit: "°", def: [0, 360], bg: "tint", l: 0.45 },
    candles: { label: "All candles", group: "Color cycle", kind: "color", min: 0, max: 360, unit: "°", def: [0, 360], keys: ["up", "borderUp", "wickUp"], keys2: ["down", "borderDown", "wickDown"], chart: true },
    up: { label: "Up candles", group: "Color cycle", kind: "color", min: 0, max: 360, unit: "°", def: [0, 360], keys: ["up", "borderUp", "wickUp"], chart: true },
    down: { label: "Down candles", group: "Color cycle", kind: "color", min: 0, max: 360, unit: "°", def: [0, 360], keys: ["down", "borderDown", "wickDown"], chart: true },
    crosshair: { label: "Crosshair", group: "Color cycle", kind: "color", min: 0, max: 360, unit: "°", def: [0, 360], keys: ["crosshair"], chart: true },
    grid: { label: "Grid lines", group: "Color cycle", kind: "color", min: 0, max: 360, unit: "°", def: [0, 360], keys: ["gridColor"], alpha: "38", chart: true },
    text: { label: "Scale text", group: "Color cycle", kind: "color", min: 0, max: 360, unit: "°", def: [0, 360], keys: ["text"], chart: true },
  };
  const WAVES = {
    sine: "Pulse", triangle: "Ramp", saw: "Cycle", square: "Flash", strobe: "Strobe",
    heartbeat: "Heartbeat", flicker: "Flicker", random: "Random",
  };

  // ---------- curves ----------
  const CURVES = {
    linear: { label: "Linear", bez: [0, 0, 1, 1] },
    easeInOut: { label: "Smooth", bez: [0.42, 0, 0.58, 1] },
    easeIn: { label: "Ease in", bez: [0.42, 0, 1, 1] },
    easeOut: { label: "Ease out", bez: [0, 0, 0.58, 1] },
    snap: { label: "Snap", bez: [0.85, 0, 0.15, 1] },
    overshoot: { label: "Overshoot", bez: [0.34, 1.56, 0.64, 1] },
    custom: { label: "Custom", bez: null },
  };
  // y(x) for a cubic-bezier with fixed ends (0,0) and (1,1), baked into a lookup table once.
  const LUTS = new Map();
  function bezLUT(b) {
    const key = b.join(",");
    let lut = LUTS.get(key);
    if (lut) return lut;
    const [x1, y1, x2, y2] = b, N = 128;
    const bx = (t) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    const by = (t) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
    lut = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const x = i / N; let lo = 0, hi = 1, t = x;
      for (let k = 0; k < 22; k++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t; }
      lut[i] = by(t);
    }
    if (LUTS.size > 64) LUTS.clear();
    LUTS.set(key, lut);
    return lut;
  }
  function curveOf(a) {
    const c = a && a.curve;
    if (!c || c === "linear") return null;
    const b = c === "custom" ? a.bez : CURVES[c] && CURVES[c].bez;
    if (!Array.isArray(b) || b.length !== 4 || b.some((n) => typeof n !== "number" || !isFinite(n))) return null;
    const lut = bezLUT([Math.min(1, Math.max(0, b[0])), b[1], Math.min(1, Math.max(0, b[2])), b[3]]);
    return (v) => { v = v < 0 ? 0 : v > 1 ? 1 : v; const f = v * 128, i = f | 0; return i >= 128 ? lut[128] : lut[i] + (lut[i + 1] - lut[i]) * (f - i); };
  }

  const fract = (x) => x - Math.floor(x);
  const hash = (n) => fract(Math.sin(n * 12.9898 + 78.233) * 43758.5453);
  const g = (p, c, w) => Math.exp(-Math.pow((p - c) / w, 2));
  function wave(name, p, x, seed) {
    switch (name) {
      case "sine": return 0.5 - 0.5 * Math.cos(2 * Math.PI * p);
      case "triangle": return p < 0.5 ? p * 2 : 2 - p * 2;
      case "saw": return p;
      case "square": return p < 0.5 ? 1 : 0;
      case "strobe": return p < 0.08 ? 1 : 0;
      case "heartbeat": return Math.min(1, g(p, 0.1, 0.045) + 0.65 * g(p, 0.27, 0.045));
      case "flicker": {
        const y = x * 6 + seed * 17, i = Math.floor(y), f = y - i, s = f * f * (3 - 2 * f);
        const v = hash(i + seed) * (1 - s) + hash(i + 1 + seed) * s;
        return Math.pow(v, 0.6);
      }
      case "random": return hash(Math.floor(x) + seed * 31);
      default: return 0;
    }
  }

  function hsl2hex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
    return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  const seedOf = (id) => { let s = 0; for (const c of String(id || "x")) s = (s * 31 + c.charCodeAt(0)) % 997; return s / 97; };

  function active(cfg) {
    const out = { any: false, colors: false };
    if (!cfg || cfg.fxOn === false || !Array.isArray(cfg.fx)) return out;
    for (const a of cfg.fx) { if (!a || !a.on || !TARGETS[a.target]) continue; out.any = true; if (TARGETS[a.target].chart) out.colors = true; }
    return out;
  }

  const DEFAULT_BASE = { mode: "solid", color: "#000000", color2: "#0B3B3A", angle: 160 };
  // CSS background for the area behind your media (null = keep TradingView's own theme)
  function baseCSS(b) {
    b = { ...DEFAULT_BASE, ...(b || {}) };
    if (b.mode === "tv") return null;
    if (b.mode === "gradient") return `linear-gradient(${b.angle}deg, ${b.color}, ${b.color2})`;
    return b.color;
  }
  function apply(cfg, t) {
    if (!active(cfg).any) return cfg;
    const out = { ...cfg, bg: { ...cfg.bg, base: { ...DEFAULT_BASE, ...(cfg.bg.base || {}) } }, chart: { ...cfg.chart } };
    for (const a of cfg.fx) {
      const T = a && a.on && TARGETS[a.target]; if (!T) continue;
      const period = Math.max(0.05, +a.period || 1), x = t / period + (+a.phase || 0), p = fract(x);
      let w = wave(a.wave, p, x, seedOf(a.id));
      const cf = curveOf(a); if (cf) w = cf(w);
      let v = +a.min + (+a.max - +a.min) * w;
      if (T.kind === "num") { v = Math.min(T.max, Math.max(T.min, v)); const ks = T.path.split("."), last = ks.pop(); ks.reduce((o, k) => o[k], out)[last] = v * T.scale; continue; }
      const hex = hsl2hex(v, 0.88, T.l || 0.6) + (T.alpha || "");
      if (T.bg) out.bg[T.bg] = hex;
      if (T.base) { out.bg.base[T.base] = hsl2hex(v, 0.75, T.l); if (out.bg.base.mode === "tv") out.bg.base.mode = "solid"; }
      if (T.keys) for (const k of T.keys) out.chart[k] = hex;
      if (T.keys2) { const hex2 = hsl2hex(v + 180, 0.88, 0.6); for (const k of T.keys2) out.chart[k] = hex2; }
      if (a.target === "grid") out.chart.grid = true;
    }
    return out;
  }

  // One period of an animation after its curve, for drawing previews (values 0-1, may overshoot).
  function sample(a, n = 96) {
    const cf = curveOf(a), seed = seedOf(a && a.id), out = new Array(n);
    for (let i = 0; i < n; i++) { const p = i / (n - 1); let w = wave(a.wave, p >= 1 ? 0.9999 : p, p * 1, seed); if (cf) w = cf(w); out[i] = w; }
    return out;
  }

  root.MSK_FX = { TARGETS, WAVES, CURVES, apply, active, wave, curveOf, sample, hsl2hex, baseCSS, DEFAULT_BASE };
})(typeof window !== "undefined" ? window : globalThis);
