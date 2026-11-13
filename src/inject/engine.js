// MSK engine. Injected into the TradingView Desktop page over the debug port.
// Draws the background layer and recolors the chart. Everything here is best-effort:
// TradingView's internals are undocumented, so each step is wrapped in try/catch.
(() => {
  if (window.__MSK) return;
  const MEDIA = "https://media.msk.invalid/";
  const M = (window.__MSK = { payload: null, status: { bg: false, colors: "waiting", charts: 0, mediaError: false } });
  const Q = [];
  const L = (level, msg, data) => { Q.push({ level, msg, data: data === undefined ? undefined : (typeof data === "string" ? data : JSON.stringify(data)) }); if (Q.length > 200) Q.shift(); };
  M.drain = () => Q.splice(0, Q.length);
  L("info", "Engine loaded", location.href.slice(0, 100));
  window.addEventListener("error", (e) => { if (String(e.filename || "").includes("msk") || !e.filename) L("debug", "Page error", e.message); });
  let root, mediaEl, tintEl, vigEl, styleEl, curKey = null;
  const originals = new Map(); // property -> original value, so turning MSK off restores the chart

  const mk = (tag, css) => { const e = document.createElement(tag); if (css) e.style.cssText = css; return e; };

  function ensureRoot() {
    if (root && root.isConnected) return;
    root = mk("div", "position:fixed;inset:0;pointer-events:none;overflow:hidden;contain:strict;");
    root.id = "__msk_root";
    tintEl = mk("div", "position:absolute;inset:0;");
    vigEl = mk("div", "position:absolute;inset:0;");
    root.append(tintEl, vigEl);
    document.documentElement.appendChild(root);
    curKey = null; mediaEl = null;
  }

  function setMedia(media) {
    const key = media ? media.id + ":" + media.rev : null;
    if (key === curKey && (!mediaEl || mediaEl.isConnected)) return;
    curKey = key;
    if (mediaEl) { try { mediaEl.pause && mediaEl.pause(); } catch {} mediaEl.remove(); }
    mediaEl = null; M.status.mediaError = false;
    if (!media) return;
    const video = media.type === "video";
    mediaEl = mk(video ? "video" : "img", "position:absolute;inset:0;width:100%;height:100%;transition:opacity .6s ease;");
    if (video) Object.assign(mediaEl, { muted: true, loop: true, autoplay: true, playsInline: true });
    mediaEl.addEventListener("error", () => { M.status.mediaError = true; L("error", "Media failed to load", media.id); });
    mediaEl.addEventListener(video ? "loadeddata" : "load", () => L("info", (video ? "Video" : "Image") + " loaded", { id: media.id, w: mediaEl.naturalWidth || mediaEl.videoWidth, h: mediaEl.naturalHeight || mediaEl.videoHeight }));
    mediaEl.src = MEDIA + encodeURIComponent(media.id) + "?r=" + media.rev;
    root.prepend(mediaEl);
    if (video) mediaEl.play().catch(() => {});
  }

  function styleLayer(bg) {
    const behind = bg.mode === "behind";
    root.style.zIndex = behind ? "-1" : "2147483646";
    root.style.opacity = behind ? "1" : String(bg.opacity);
    if (mediaEl) {
      const s = mediaEl.style;
      s.objectFit = bg.fit === "stretch" ? "fill" : bg.fit;
      s.objectPosition = bg.position || "center";
      s.filter = `blur(${bg.blur}px) brightness(${bg.brightness}) saturate(${bg.saturation})${bg.hue ? ` hue-rotate(${bg.hue}deg)` : ""}`;
      const z = Math.max(bg.blur > 0 ? 1.06 : 1, bg.zoom || 1);
      s.transform = z > 1 ? `scale(${z})` : "none";
      s.opacity = behind ? String(bg.opacity) : "1";
      if (mediaEl.tagName === "VIDEO") mediaEl.playbackRate = bg.speed || 1;
    }
    tintEl.style.background = bg.tint || "#000";
    tintEl.style.opacity = String(bg.tintStrength || 0);
    vigEl.style.background = bg.vignette > 0
      ? `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${bg.vignette}) 100%)` : "none";
  }

  let lastBase;
  function setBase(bg) {
    const v = bg && bg.mode !== "overlay" && window.MSK_FX ? window.MSK_FX.baseCSS(bg.base) : null;
    if (v === lastBase) return;
    lastBase = v;
    const st = document.documentElement.style;
    if (v) st.setProperty("--msk-base", v); else st.removeProperty("--msk-base");
  }
  function setCSS(cfg) {
    if (!styleEl || !styleEl.isConnected) {
      styleEl = document.createElement("style"); styleEl.id = "__msk_css";
      (document.head || document.documentElement).appendChild(styleEl);
    }
    let css = "";
    if (cfg.bg.mode === "behind") {
      if (window.MSK_FX && window.MSK_FX.baseCSS(cfg.bg.base) !== null) css += `html{background:var(--msk-base,#000)!important;background-attachment:fixed!important}`;
      css += `
      body,#overlap-manager-root,.js-rootresizer__contents,.layout__area--center,.chart-container,
      .chart-container-border,.chart-markup-table,.chart-widget,.chart-gui-wrapper,.chart-page,
      .chart-markup-table td{background:transparent!important;background-color:transparent!important}`;
    }
    if (cfg.ui && cfg.ui.glassToolbars) {
      css += `.layout__area--top,.layout__area--left,.layout__area--right,.layout__area--bottom{
        background:rgba(8,10,12,.42)!important;backdrop-filter:blur(18px) saturate(160%)!important}
      .layout__area--top *,.layout__area--left *{background-color:transparent}`;
    }
    styleEl.textContent = css;
  }

  // ---------- chart colors ----------
  const pick = (o, k) => { try { if (!o) return null; if (o[k] != null) return o[k]; const c = o.childs && o.childs(); return c ? c[k] : null; } catch { return null; } };
  const at = (o, pathStr) => pathStr.split(".").reduce((a, k) => pick(a, k), o);
  function setP(prop, val) {
    if (!prop || typeof prop.setValue !== "function") return false;
    try {
      if (!originals.has(prop)) originals.set(prop, prop.value());
      if (prop.value() !== val) prop.setValue(val);
      return true;
    } catch { return false; }
  }
  function restoreColors() {
    for (const [p, v] of originals) { try { p.setValue(v); } catch {} }
    originals.clear();
  }
  function chartApis() {
    const api = window.TradingViewApi, out = [];
    if (!api) return out;
    try { const n = api.chartsCount && api.chartsCount(); for (let i = 0; i < (n || 0); i++) { const c = api.chart(i); if (c) out.push(c); } } catch {}
    if (!out.length) { try { const c = api._activeChartWidgetWV && api._activeChartWidgetWV.value(); if (c) out.push(c); } catch {} }
    if (!out.length) { try { const c = api.activeChart && api.activeChart(); if (c) out.push(c); } catch {} }
    return out;
  }
  function hexAlpha(hex) {
    if (!/^#?[0-9a-f]{8}$/i.test(hex || "")) return hex;
    const h = hex.replace("#", ""); const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return `rgba(${n(0)},${n(2)},${n(4)},${(n(6) / 255).toFixed(3)})`;
  }
  function applyColors(c, paneOnly, fast) {
    const ch = c.chart;
    const apis = chartApis();
    M.status.charts = apis.length;
    if (!apis.length) { M.status.colors = window.TradingViewApi ? "no-chart" : "waiting"; return false; }
    const paneBg = c.bg.mode === "behind" || ch.paneTransparent ? "rgba(0,0,0,0)" : hexAlpha(ch.paneBg);
    const gridColor = ch.grid ? hexAlpha(ch.gridColor) : "rgba(0,0,0,0)";
    let hits = 0, method = "";
    for (const api of apis) {
      let cw = null, ms = null, chartProps = null;
      try { cw = api._chartWidget; } catch {}
      try { ms = cw.model().mainSeries().properties(); } catch {}
      try { chartProps = cw.properties(); } catch {}
      if (!chartProps) { try { chartProps = cw.model().model().properties(); } catch {} }
      if (ms && !paneOnly) {
        for (const style of fast ? ["candleStyle"] : ["candleStyle", "hollowCandleStyle", "haStyle"]) {
          const s = pick(ms, style); if (!s) continue;
          hits += setP(pick(s, "upColor"), ch.up) + setP(pick(s, "downColor"), ch.down)
            + setP(pick(s, "borderUpColor"), ch.borderUp) + setP(pick(s, "borderDownColor"), ch.borderDown)
            + setP(pick(s, "wickUpColor"), ch.wickUp) + setP(pick(s, "wickDownColor"), ch.wickDown);
          setP(pick(s, "drawBorder"), true); setP(pick(s, "drawWick"), true);
        }
        const bar = !fast && pick(ms, "barStyle");
        if (bar) hits += setP(pick(bar, "upColor"), ch.up) + setP(pick(bar, "downColor"), ch.down);
        if (hits) method = "series-props";
      }
      if (chartProps) {
        const pane = pick(chartProps, "paneProperties");
        if (pane) {
          setP(pick(pane, "backgroundType"), "solid");
          hits += setP(pick(pane, "background"), paneBg);
          setP(at(pane, "backgroundGradientStartColor"), paneBg);
          setP(at(pane, "backgroundGradientEndColor"), paneBg);
          if (paneOnly) continue;
          setP(at(pane, "vertGridProperties.color"), gridColor);
          setP(at(pane, "horzGridProperties.color"), gridColor);
          setP(at(pane, "crossHairProperties.color"), ch.crosshair);
          setP(pick(pane, "separatorColor"), gridColor);
        }
        if (paneOnly) continue;
        const scales = pick(chartProps, "scalesProperties");
        if (scales) { setP(pick(scales, "textColor"), ch.text); setP(pick(scales, "lineColor"), "rgba(0,0,0,0)"); }
      }
      // fallback: charting-library style API
      if (!hits && !paneOnly) {
        try {
          const ser = api.getSeries && api.getSeries();
          if (ser && ser.setChartStyleProperties) {
            ser.setChartStyleProperties(1, { upColor: ch.up, downColor: ch.down, borderUpColor: ch.borderUp,
              borderDownColor: ch.borderDown, wickUpColor: ch.wickUp, wickDownColor: ch.wickDown, drawBorder: true, drawWick: true });
            hits++; method = "series-api";
          }
        } catch {}
      }
    }
    if (!hits && !paneOnly) {
      try {
        const api = window.TradingViewApi;
        if (api && api.applyOverrides) {
          api.applyOverrides({
            "mainSeriesProperties.candleStyle.upColor": ch.up, "mainSeriesProperties.candleStyle.downColor": ch.down,
            "mainSeriesProperties.candleStyle.borderUpColor": ch.borderUp, "mainSeriesProperties.candleStyle.borderDownColor": ch.borderDown,
            "mainSeriesProperties.candleStyle.wickUpColor": ch.wickUp, "mainSeriesProperties.candleStyle.wickDownColor": ch.wickDown,
            "paneProperties.background": paneBg, "paneProperties.backgroundType": "solid",
            "paneProperties.vertGridProperties.color": gridColor, "paneProperties.horzGridProperties.color": gridColor,
            "scalesProperties.textColor": ch.text,
          });
          hits++; method = "overrides";
        }
      } catch {}
    }
    const before = M.status.colors;
    M.status.colors = hits ? method || "applied" : "unsupported";
    if (before !== M.status.colors || paneOnly) L(hits ? "info" : "warn", paneOnly ? "Pane cleared" : "Colors " + M.status.colors, { charts: apis.length, props: hits });
    return !!hits;
  }

  function render() {
    const p = M.payload;
    if (!p || !p.on || !p.cfg) {
      if (root) { root.remove(); root = null; curKey = null; mediaEl = null; }
      if (styleEl) styleEl.textContent = "";
      setBase(null);
      restoreColors(); M.status.bg = false; M.status.colors = "off";
      return;
    }
    if (!p.external) { ensureRoot(); setMedia(p.media); styleLayer(p.cfg.bg); }
    else if (root) { root.remove(); root = null; curKey = null; mediaEl = null; }
    setCSS(p.cfg);
    setBase(p.cfg.bg);
    M.status.bg = true;
    if (p.cfg.chart && p.cfg.chart.apply) applyColors(p.cfg);
    else { restoreColors(); if (p.cfg.bg.mode === "behind") applyColors(p.cfg, true); M.status.colors = "skipped"; }
  }

  // ---------- animations ----------
  let fxRaf = null, lastColor = 0;
  function fxTick(now) {
    fxRaf = null;
    const p = M.payload, FX = window.MSK_FX;
    if (!p || !p.on || !p.cfg || !FX || (!root && !p.external)) return;
    const act = FX.active(p.cfg);
    if (!act.any) return;
    try {
      const live = FX.apply(p.cfg, now / 1000);
      if (root) styleLayer(live.bg);
      setBase(live.bg);
      if (act.colors && p.cfg.chart && p.cfg.chart.apply && now - lastColor > (p.fxMs || 90)) { lastColor = now; applyColors(live, false, true); }
    } catch (e) { L("error", "Animation error", String(e)); return; }
    fxRaf = requestAnimationFrame(fxTick);
  }
  function startFx() {
    const p = M.payload;
    if (!fxRaf && p && p.on && p.cfg && window.MSK_FX && window.MSK_FX.active(p.cfg).any) { L("info", "Animations running", (p.cfg.fx || []).filter((a) => a.on).map((a) => a.target + ":" + a.wave)); fxRaf = requestAnimationFrame(fxTick); }
  }

  M.apply = (payload) => {
    M.payload = payload;
    L("debug", "Apply", { on: payload && payload.on, cfg: payload && payload.cfg && payload.cfg.name, mode: payload && payload.cfg && payload.cfg.bg.mode });
    try { render(); startFx(); } catch (e) { M.status.error = String(e); L("error", "Render failed", String(e && e.stack || e)); }
    return M.status;
  };

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") startFx(); if (mediaEl && mediaEl.tagName === "VIDEO" && document.visibilityState === "visible") mediaEl.play().catch(() => {}); });

  // self-heal: TradingView rebuilds parts of the page, and new layouts add new charts
  let lastCount = -1;
  setInterval(() => {
    const p = M.payload;
    if (!p || !p.on) return;
    try {
      if ((!p.external && (!root || !root.isConnected)) || !styleEl || !styleEl.isConnected) render();
      const n = chartApis().length;
      const wantColors = (p.cfg.chart && p.cfg.chart.apply) || p.cfg.bg.mode === "behind";
      if (wantColors && (n !== lastCount || M.status.colors === "waiting" || M.status.colors === "no-chart")) {
        lastCount = n; applyColors(p.cfg, !(p.cfg.chart && p.cfg.chart.apply));
      }
      if (mediaEl && mediaEl.tagName === "VIDEO" && mediaEl.paused) mediaEl.play().catch(() => {});
    } catch {}
  }, 1500);
})();
