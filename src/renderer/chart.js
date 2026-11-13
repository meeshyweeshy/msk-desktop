// Mock candlestick chart used for live previews. Draws with the config's colors.
(function () {
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function makeBars(n, seed) {
    const r = rng(seed), bars = []; let p = 21450;
    for (let i = 0; i < n; i++) {
      const o = p, drift = (r() - 0.48) * 26, c = o + drift;
      const hi = Math.max(o, c) + r() * 9, lo = Math.min(o, c) - r() * 9;
      bars.push({ o, h: hi, l: lo, c }); p = c;
    }
    return bars;
  }
  function rgba(hex) {
    if (!hex) return "transparent";
    const h = hex.replace("#", "");
    if (h.length === 8) { const n = (i) => parseInt(h.slice(i, i + 2), 16); return `rgba(${n(0)},${n(2)},${n(4)},${(n(6) / 255).toFixed(3)})`; }
    return hex;
  }

  class MSKChart {
    constructor(canvas, { animate = false, seed = 7, interactive = false } = {}) {
      this.cv = canvas; this.ctx = canvas.getContext("2d");
      this.bars = makeBars(140, seed); this.r = rng(seed + 1);
      this.cfg = null; this.mouse = null; this.animate = animate;
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas);
      if (interactive) {
        canvas.addEventListener("pointermove", (e) => { const b = canvas.getBoundingClientRect(); this.mouse = { x: e.clientX - b.left, y: e.clientY - b.top }; if (!this.animate) this.draw(); });
        canvas.addEventListener("pointerleave", () => { this.mouse = null; if (!this.animate) this.draw(); });
      }
      if (animate) this.loop();
    }
    resize() {
      const b = this.cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
      if (!b.width) return;
      this.w = b.width; this.h = b.height;
      this.cv.width = Math.round(b.width * d); this.cv.height = Math.round(b.height * d);
      this.ctx.setTransform(d, 0, 0, d, 0, 0);
      this.draw();
    }
    set(cfg) { this.cfg = cfg; this.draw(); }
    loop() {
      let last = 0, born = performance.now();
      // ~14 fps ticker; setTimeout instead of spinning requestAnimationFrame 60x a second
      const step = () => {
        if (this.dead) return;
        const t = performance.now();
        if (document.visibilityState === "visible" && this.cv.isConnected) {
          last = t;
          const b = this.bars[this.bars.length - 1];
          b.c += (this.r() - 0.5) * 4; b.h = Math.max(b.h, b.c); b.l = Math.min(b.l, b.c);
          if (t - born > 2600) { born = t; this.bars.shift(); const o = b.c; this.bars.push({ o, h: o, l: o, c: o }); }
          this.draw();
        }
        setTimeout(step, 70);
      };
      setTimeout(step, 70);
    }
    destroy() { this.dead = true; this.ro.disconnect(); }
    draw() {
      const { ctx, w, h, cfg } = this;
      if (!w || !cfg) return;
      const ch = cfg.chart, bg = cfg.bg;
      ctx.clearRect(0, 0, w, h);
      const transparent = bg.mode === "behind" || ch.paneTransparent;
      if (!transparent) { ctx.fillStyle = rgba(ch.paneBg); ctx.fillRect(0, 0, w, h); }
      const fs = Math.max(9, Math.min(11, h / 28));
      ctx.font = `600 ${fs}px Manrope, sans-serif`;
      const axis = Math.ceil(ctx.measureText("00000.00").width) + 18, pw = w - axis, padT = h * 0.08, padB = h * 0.1;
      const cw = Math.max(3, Math.min(10, pw / 70)), gap = Math.max(1.5, cw * 0.45), n = Math.min(this.bars.length, Math.floor(pw / (cw + gap)) - 2);
      const vis = this.bars.slice(-n);
      let hi = -Infinity, lo = Infinity; for (const b of vis) { hi = Math.max(hi, b.h); lo = Math.min(lo, b.l); }
      const pad = (hi - lo) * 0.08; hi += pad; lo -= pad;
      const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
      // grid
      if (ch.grid) {
        ctx.strokeStyle = rgba(ch.gridColor); ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 1; i < 6; i++) { const gy = Math.round((h / 6) * i) + 0.5; ctx.moveTo(0, gy); ctx.lineTo(pw, gy); }
        for (let i = 1; i < 8; i++) { const gx = Math.round((pw / 8) * i) + 0.5; ctx.moveTo(gx, 0); ctx.lineTo(gx, h); }
        ctx.stroke();
      }
      // candles
      vis.forEach((b, i) => {
        const x = pw - (n - i) * (cw + gap) - gap, up = b.c >= b.o, cx = Math.round(x + cw / 2) + 0.5;
        ctx.strokeStyle = up ? ch.wickUp : ch.wickDown; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, y(b.h)); ctx.lineTo(cx, y(b.l)); ctx.stroke();
        const top = y(Math.max(b.o, b.c)), bh = Math.max(1, y(Math.min(b.o, b.c)) - top);
        ctx.fillStyle = up ? ch.up : ch.down; ctx.fillRect(Math.round(x), top, Math.round(cw), bh);
        ctx.strokeStyle = up ? ch.borderUp : ch.borderDown;
        ctx.strokeRect(Math.round(x) + 0.5, top + 0.5, Math.round(cw) - 1, Math.max(0, bh - 1));
      });
      // price axis
      ctx.font = `600 ${fs}px Manrope, sans-serif`; ctx.fillStyle = rgba(ch.text); ctx.textBaseline = "middle";
      for (let i = 1; i < 6; i++) { const v = hi - ((hi - lo) / 6) * i; ctx.fillText(v.toFixed(2), pw + 8, y(v)); }
      const lastB = vis[vis.length - 1];
      if (lastB) {
        const ly = y(lastB.c), up = lastB.c >= lastB.o;
        ctx.setLineDash([2, 3]); ctx.strokeStyle = up ? ch.up : ch.down; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.moveTo(0, Math.round(ly) + 0.5); ctx.lineTo(pw, Math.round(ly) + 0.5); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.fillStyle = up ? ch.up : ch.down; ctx.fillRect(pw + 2, ly - 9, axis - 4, 18);
        ctx.fillStyle = lum(up ? ch.up : ch.down) > 0.55 ? "#000" : "#fff"; ctx.fillText(lastB.c.toFixed(2), pw + 7, ly);
      }
      // crosshair
      if (this.mouse && this.mouse.x < pw) {
        ctx.strokeStyle = rgba(ch.crosshair); ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Math.round(this.mouse.x) + 0.5, 0); ctx.lineTo(Math.round(this.mouse.x) + 0.5, h);
        ctx.moveTo(0, Math.round(this.mouse.y) + 0.5); ctx.lineTo(pw, Math.round(this.mouse.y) + 0.5); ctx.stroke(); ctx.setLineDash([]);
        const v = hi - ((this.mouse.y - padT) / (h - padT - padB)) * (hi - lo);
        ctx.fillStyle = rgba(ch.crosshair); ctx.fillRect(pw + 2, this.mouse.y - 9, axis - 4, 18);
        ctx.fillStyle = lum(ch.crosshair) > 0.55 ? "#000" : "#fff"; ctx.fillText(v.toFixed(2), pw + 7, this.mouse.y);
      }
    }
  }
  function lum(hex) {
    const h = (hex || "#000").replace("#", "").slice(0, 6); if (h.length < 6) return 0;
    const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255; return 0.2126 * n(0) + 0.7152 * n(2) + 0.0722 * n(4);
  }
  window.MSKChart = MSKChart;
  window.mskRGBA = rgba;
})();
