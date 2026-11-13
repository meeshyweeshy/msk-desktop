// Background layer shown inside TradingView (extension page in an iframe, so it can read media from IndexedDB).
(() => {
  const W = document.getElementById("w"), T = document.getElementById("t"), V = document.getElementById("v");
  let key = null, el = null, url = null, raf = null, base = null;
  function look(c) {
    const bg = c.bg, behind = bg.mode === "behind";
    document.body.style.opacity = behind ? 1 : bg.opacity;
    if (el) {
      const z = Math.max(bg.blur > 0 ? 1.06 : 1, bg.zoom || 1);
      el.style.objectFit = bg.fit === "stretch" ? "fill" : bg.fit;
      el.style.objectPosition = bg.position || "center";
      el.style.filter = `blur(${bg.blur}px) brightness(${bg.brightness}) saturate(${bg.saturation})${bg.hue ? ` hue-rotate(${bg.hue}deg)` : ""}`;
      el.style.transform = z > 1 ? `scale(${z})` : "none";
      el.style.opacity = behind ? bg.opacity : 1;
      if (el.tagName === "VIDEO") el.playbackRate = bg.speed || 1;
    }
    T.style.background = bg.tint || "#000"; T.style.opacity = bg.tintStrength || 0;
    V.style.background = bg.vignette > 0 ? `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${bg.vignette}) 100%)` : "none";
  }
  function tick(now) {
    raf = null;
    if (!base || !base.on || !base.cfg) return;
    if (!MSK_FX.active(base.cfg).any) { look(base.cfg); return; }
    look(MSK_FX.apply(base.cfg, now / 1000));
    raf = requestAnimationFrame(tick);
  }
  async function refresh() {
    const d = await MSKX.load();
    const p = MSKX.payload(d); base = p;
    if (!p.on || !p.cfg) { if (el) { el.remove(); el = null; } key = null; return; }
    const m = p.media, k = m ? m.id + ":" + m.rev : null;
    if (k !== key) {
      key = k;
      if (el) { if (el.pause) el.pause(); el.remove(); el = null; }
      if (url) { URL.revokeObjectURL(url); url = null; }
      if (m) {
        const blob = await MSKX.fget("media:" + m.id);
        if (blob) {
          url = URL.createObjectURL(blob);
          el = document.createElement(m.type === "video" ? "video" : "img");
          if (m.type === "video") Object.assign(el, { muted: true, loop: true, autoplay: true, playsInline: true });
          el.src = url; W.appendChild(el);
          if (el.play) el.play().catch(() => {});
        }
      }
    }
    look(p.cfg);
    if (!raf && MSK_FX.active(p.cfg).any) raf = requestAnimationFrame(tick);
  }
  chrome.storage.onChanged.addListener((_c, area) => { if (area === "local") refresh(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { if (el && el.play) el.play().catch(() => {}); if (!raf && base && base.cfg && MSK_FX.active(base.cfg).any) raf = requestAnimationFrame(tick); } });
  refresh();
})();
