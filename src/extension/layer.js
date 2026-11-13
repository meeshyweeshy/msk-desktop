// Background layer shown inside TradingView (extension page in an iframe, so it can read media from IndexedDB).
(() => {
  const W = document.getElementById("w"), T = document.getElementById("t"), V = document.getElementById("v");
  let key = null, el = null, url = null, raf = null, base = null, lastFrame = 0;
  // write a style only when it changed (keeps the GPU idle between animation steps)
  const S = (e, k, v) => { const c = e.__c || (e.__c = {}); v = String(v); if (c[k] !== v) { c[k] = v; e.style[k] = v; } };
  const r3 = (n) => Math.round(n * 1000) / 1000;
  function look(c) {
    const bg = c.bg, behind = bg.mode === "behind";
    S(document.body, "opacity", behind ? 1 : r3(bg.opacity));
    if (el) {
      const z = Math.max(bg.blur > 0 ? 1.06 : 1, bg.zoom || 1);
      S(el, "objectFit", bg.fit === "stretch" ? "fill" : bg.fit);
      S(el, "objectPosition", bg.position || "center");
      S(el, "filter", `blur(${r3(bg.blur)}px) brightness(${r3(bg.brightness)}) saturate(${r3(bg.saturation)})${bg.hue ? ` hue-rotate(${Math.round(bg.hue)}deg)` : ""}`);
      S(el, "transform", z > 1 ? `scale(${r3(z)})` : "none");
      S(el, "opacity", behind ? r3(bg.opacity) : 1);
      if (el.tagName === "VIDEO" && el.playbackRate !== (bg.speed || 1)) el.playbackRate = bg.speed || 1;
    }
    S(T, "background", bg.tint || "#000"); S(T, "opacity", r3(bg.tintStrength || 0));
    S(V, "background", bg.vignette > 0 ? `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${r3(bg.vignette)}) 100%)` : "none");
  }
  function tick(now) {
    raf = null;
    if (!base || !base.on || !base.cfg) return;
    if (!MSK_FX.active(base.cfg).any) { look(base.cfg); return; }
    if (now - lastFrame >= (base.frameMs || 33)) { lastFrame = now; look(MSK_FX.apply(base.cfg, now / 1000)); }
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
  const KEYS = ["enabled", "configs", "activeConfigId", "preview", "fxPaused", "media", "settings"];
  let pend = null;
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== "local" || !KEYS.some((k) => k in c) || pend) return;
    pend = setTimeout(() => { pend = null; refresh(); }, 24);
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { if (el && el.play) el.play().catch(() => {}); if (!raf && base && base.cfg && MSK_FX.active(base.cfg).any) raf = requestAnimationFrame(tick); } });
  refresh();
})();
