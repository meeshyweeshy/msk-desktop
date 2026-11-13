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
  let root, mediaEl, tintEl, vigEl, styleEl, baseEl, curKey = null;
  // Only touch the DOM when a value really changed: every style write can make TradingView restyle.
  const S = (el, k, v) => { const c = el.__mskc || (el.__mskc = {}); if (c[k] !== v) { c[k] = v; el.style[k] = v; } };
  const originals = new Map(); // property -> original value, so turning MSK off restores the chart

  const mk = (tag, css) => { const e = document.createElement(tag); if (css) e.style.cssText = css; return e; };

  function ensureRoot() {
    if (root && root.isConnected) return;
    root = mk("div", "position:fixed;inset:0;pointer-events:none;overflow:hidden;contain:strict;will-change:transform;");
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
    mediaEl = mk(video ? "video" : "img", "position:absolute;inset:0;width:100%;height:100%;transition:opacity .6s ease;will-change:transform;");
    if (video) Object.assign(mediaEl, { muted: true, loop: true, autoplay: true, playsInline: true });
    mediaEl.addEventListener("error", () => { M.status.mediaError = true; L("error", "Media failed to load", media.id); });
    mediaEl.addEventListener(video ? "loadeddata" : "load", () => L("info", (video ? "Video" : "Image") + " loaded", { id: media.id, w: mediaEl.naturalWidth || mediaEl.videoWidth, h: mediaEl.naturalHeight || mediaEl.videoHeight }));
    mediaEl.src = MEDIA + encodeURIComponent(media.id) + "?r=" + media.rev;
    root.prepend(mediaEl);
    if (video) mediaEl.play().catch(() => {});
  }

  const r3 = (n) => Math.round(n * 1000) / 1000;
  function styleLayer(bg) {
    const behind = bg.mode === "behind";
    S(root, "zIndex", behind ? "-1" : "2147483646");
    S(root, "opacity", behind ? "1" : String(r3(bg.opacity)));
    if (mediaEl) {
      S(mediaEl, "objectFit", bg.fit === "stretch" ? "fill" : bg.fit);
      S(mediaEl, "objectPosition", bg.position || "center");
      S(mediaEl, "filter", `blur(${r3(bg.blur)}px) brightness(${r3(bg.brightness)}) saturate(${r3(bg.saturation)})${bg.hue ? ` hue-rotate(${Math.round(bg.hue)}deg)` : ""}`);
      const z = Math.max(bg.blur > 0 ? 1.06 : 1, bg.zoom || 1);
      S(mediaEl, "transform", z > 1 ? `scale(${r3(z)})` : "none");
      S(mediaEl, "opacity", behind ? String(r3(bg.opacity)) : "1");
      if (mediaEl.tagName === "VIDEO" && mediaEl.playbackRate !== (bg.speed || 1)) mediaEl.playbackRate = bg.speed || 1;
    }
    S(tintEl, "background", bg.tint || "#000");
    S(tintEl, "opacity", String(r3(bg.tintStrength || 0)));
    S(vigEl, "background", bg.vignette > 0 ? `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${r3(bg.vignette)}) 100%)` : "none");
  }

  // The color behind your media lives on its own composited layer, so changing it (or animating
  // the gradient angle) repaints one element instead of restyling the whole TradingView page.
  function setBase(bg) {
    const v = bg && bg.mode === "behind" && window.MSK_FX ? window.MSK_FX.baseCSS(bg.base) : null;
    if (!v) { if (baseEl) S(baseEl, "display", "none"); return; }
    if (!baseEl || !baseEl.isConnected) {
      baseEl = mk("div", "position:fixed;inset:0;z-index:-2;pointer-events:none;contain:strict;will-change:transform;");
      baseEl.id = "__msk_base";
      document.documentElement.appendChild(baseEl);
    }
    S(baseEl, "display", "block");
    S(baseEl, "background", v);
  }
  function setCSS(cfg) {
    if (!styleEl || !styleEl.isConnected) {
      styleEl = document.createElement("style"); styleEl.id = "__msk_css";
      (document.head || document.documentElement).appendChild(styleEl);
    }
    let css = "";
    if (cfg.bg.mode === "behind") {
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
    if (styleEl.textContent !== css) styleEl.textContent = css;
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

  let colorKey = null;
  function render() {
    const p = M.payload;
    if (!p || !p.on || !p.cfg) {
      if (root) { root.remove(); root = null; curKey = null; mediaEl = null; }
      if (styleEl) styleEl.textContent = "";
      setBase(null);
      restoreColors(); M.status.bg = false; M.status.colors = "off"; colorKey = null;
      return;
    }
    if (!p.external) { ensureRoot(); setMedia(p.media); styleLayer(p.cfg.bg); }
    else if (root) { root.remove(); root = null; curKey = null; mediaEl = null; }
    setCSS(p.cfg);
    setBase(p.cfg.bg);
    M.status.bg = true;
    const key = JSON.stringify([p.cfg.chart, p.cfg.bg.mode]);
    if (key === colorKey && M.status.colors !== "waiting" && M.status.colors !== "no-chart") return;
    colorKey = key;
    if (p.cfg.chart && p.cfg.chart.apply) applyColors(p.cfg);
    else { restoreColors(); if (p.cfg.bg.mode === "behind") applyColors(p.cfg, true); M.status.colors = "skipped"; }
  }

  // ---------- animations ----------
  let fxRaf = null, lastColor = 0, lastFrame = 0;
  function fxTick(now) {
    fxRaf = null;
    const p = M.payload, FX = window.MSK_FX;
    if (!p || !p.on || !p.cfg || !FX || (!root && !p.external)) return;
    const act = FX.active(p.cfg);
    if (!act.any) return;
    if (now - lastFrame < (p.frameMs || 33)) { fxRaf = requestAnimationFrame(fxTick); return; }
    lastFrame = now;
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
    try { renderChecklist(payload && payload.checklist); } catch (e) { L("error", "Checklist failed", String(e && e.stack || e)); }
    return M.status;
  };

  // ---------- events back to MSK (checklist ticks etc.) ----------
  M.events = [];
  function emit(type, data) {
    const ev = { type, ...data, at: Date.now() }, json = JSON.stringify(ev);
    try { document.dispatchEvent(new CustomEvent("msk:event", { detail: json })); } catch {}
    if (typeof window.__mskEmit === "function") { try { window.__mskEmit(json); return; } catch {} }
    M.events.push(ev); if (M.events.length > 50) M.events.shift();
  }
  M.drainEvents = () => M.events.splice(0, M.events.length);

  // ---------- on-chart checklist ----------
  let ckHost = null, ckRoot = null, ckKey = null, ck = null, ckLocal = null, ckLocalAt = 0;
  const CK_CSS = `
    :host{all:initial}
    .card{position:fixed;z-index:2147483647;min-width:230px;max-width:320px;font:600 12.5px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Ubuntu,sans-serif;color:#eef2f4;
      background:rgba(12,14,16,.74);backdrop-filter:blur(12px) saturate(150%);-webkit-backdrop-filter:blur(12px) saturate(150%);border:1px solid rgba(255,255,255,.12);
      border-radius:14px;box-shadow:0 14px 40px -12px rgba(0,0,0,.6);overflow:hidden;user-select:none;transform-origin:top left;contain:layout paint}
    .hd{display:flex;align-items:center;gap:8px;padding:9px 10px 9px 12px;cursor:grab;border-bottom:1px solid rgba(255,255,255,.08)}
    .hd:active{cursor:grabbing}
    .t{flex:1;font-weight:800;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sc{font-weight:800;font-size:12px;padding:3px 9px;border-radius:99px;background:rgba(255,255,255,.1);font-variant-numeric:tabular-nums}
    .sc.ready{background:var(--a);color:var(--on)}
    .sc.wait{background:rgba(255,181,71,.18);color:#ffcf85}
    button{all:unset;cursor:pointer;box-sizing:border-box}
    .ic{width:22px;height:22px;display:grid;place-items:center;border-radius:7px;color:rgba(255,255,255,.6);font-size:14px;line-height:1}
    .ic:hover{background:rgba(255,255,255,.1);color:#fff}
    .list{display:flex;flex-direction:column;padding:6px}
    .it{display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:9px;color:rgba(255,255,255,.82)}
    .it:hover{background:rgba(255,255,255,.06)}
    .bx{width:16px;height:16px;flex:none;border-radius:5px;border:1.5px solid rgba(255,255,255,.35);display:grid;place-items:center;transition:background .15s,border-color .15s}
    .it.on .bx{background:var(--a);border-color:transparent}
    .it.on .bx::after{content:"";width:8px;height:4px;border:2px solid var(--on);border-top:0;border-right:0;transform:translateY(-1px) rotate(-45deg)}
    .it.on .tx{color:#fff}
    .tx{flex:1}
    .pt{font-size:11px;color:rgba(255,255,255,.45);font-variant-numeric:tabular-nums}
    .ft{display:flex;align-items:center;gap:8px;padding:8px 12px 10px;border-top:1px solid rgba(255,255,255,.08);font-size:11.5px;color:rgba(255,255,255,.6)}
    .ft .st{flex:1}
    .ft .st.ready{color:var(--a)}
    .rs{font-size:11px;font-weight:800;padding:4px 9px;border-radius:99px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.75)}
    .rs:hover{background:rgba(255,255,255,.16);color:#fff}
    .card.min .list,.card.min .ft{display:none}
    .card.min .hd{border-bottom:0}`;
  function ckScore(c, checked) {
    const items = c.items || [], set = new Set(checked);
    let got = 0, total = 0;
    for (const it of items) { const pts = Math.max(0, +it.pts || 0); total += pts; if (set.has(it.id)) got += pts; }
    const pct = total ? Math.round((got / total) * 100) : 0;
    const grade = pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 55 ? "C" : "D";
    const min = Math.max(0, +c.minScore || 0);
    return { got, total, pct, grade, min, ready: min > 0 ? got >= min : null };
  }
  function ckPos(card, c) {
    const pos = c.pos;
    for (const k of ["top", "left", "right", "bottom"]) card.style[k] = "auto";
    if (pos && typeof pos.x === "number") { card.style.left = Math.round(pos.x * innerWidth) + "px"; card.style.top = Math.round(pos.y * innerHeight) + "px"; return; }
    const corner = c.position || "tl";
    if (corner[0] === "t") card.style.top = "46px"; else card.style.bottom = "42px";
    if (corner[1] === "l") card.style.left = "62px"; else card.style.right = "112px";
  }
  function renderChecklist(c) {
    if (!c || !c.enabled || !(c.items || []).length) {
      if (ckHost) { ckHost.remove(); ckHost = null; ckRoot = null; ckKey = null; }
      ck = null; return;
    }
    // keep a tick you just made on the chart until MSK confirms it (avoids a flicker back)
    let checked = c.checked || [];
    if (ckLocal && Date.now() - ckLocalAt < 4000 && JSON.stringify(checked) !== JSON.stringify(ckLocal)) checked = ckLocal; else ckLocal = null;
    ck = { ...c, checked };
    if (!ckHost || !ckHost.isConnected) {
      ckHost = document.createElement("div"); ckHost.id = "__msk_checklist";
      ckRoot = ckHost.attachShadow({ mode: "open" });
      document.documentElement.appendChild(ckHost); ckKey = null;
      ckRoot.addEventListener("click", ckClick);
      ckRoot.addEventListener("pointerdown", ckDragStart);
    }
    const key = JSON.stringify([ck, innerWidth, innerHeight]);
    if (key === ckKey) return;
    ckKey = key;
    const sc = ckScore(ck, checked), set = new Set(checked);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
    const scoreTxt = ck.scoreStyle === "percent" ? sc.pct + "%" : ck.scoreStyle === "grade" ? sc.grade : `${sc.got}/${sc.total}`;
    const cls = sc.ready === null ? "" : sc.ready ? "ready" : "wait";
    const acc = /^#[0-9a-f]{6}$/i.test(ck.accent || "") ? ck.accent : "#39C5BB";
    const lum = (() => { const n = (i) => parseInt(acc.slice(i, i + 2), 16) / 255; return 0.2126 * n(1) + 0.7152 * n(3) + 0.0722 * n(5); })();
    ckRoot.innerHTML = `<style>${CK_CSS}</style>
      <div class="card ${ck.collapsed ? "min" : ""}" style="--a:${acc};--on:${lum > 0.55 ? "#071012" : "#fff"};opacity:${Math.min(1, Math.max(0.3, +ck.opacity || 1))};${(+ck.scale || 1) !== 1 ? `zoom:${+ck.scale}` : ""}">
        <div class="hd" data-drag="1"><span class="t">${esc(ck.title || "Checklist")}</span>
          ${ck.showScore !== false ? `<span class="sc ${cls}">${scoreTxt}</span>` : ""}
          <button class="ic" data-act="min" title="${ck.collapsed ? "Expand" : "Collapse"}">${ck.collapsed ? "+" : "–"}</button></div>
        <div class="list">${ck.items.map((it) => `<button class="it ${set.has(it.id) ? "on" : ""}" data-id="${esc(it.id)}"><span class="bx"></span><span class="tx">${esc(it.text)}</span>${ck.showScore !== false ? `<span class="pt">+${+it.pts || 0}</span>` : ""}</button>`).join("")}</div>
        <div class="ft"><span class="st ${cls}">${sc.ready === null ? `${sc.got} of ${sc.total} points` : sc.ready ? "Ready: setup meets your minimum" : `Wait: ${sc.min - sc.got} more point${sc.min - sc.got === 1 ? "" : "s"} needed`}</span><button class="rs" data-act="reset">Reset</button></div>
      </div>`;
    ckPos(ckRoot.querySelector(".card"), ck);
  }
  function ckClick(e) {
    if (!ck || ckDragged) return;
    const it = e.target.closest(".it"), act = e.target.closest("[data-act]");
    if (it) {
      const id = it.dataset.id, set = new Set(ck.checked);
      const on = !set.has(id); on ? set.add(id) : set.delete(id);
      ckLocal = ck.items.map((x) => x.id).filter((x) => set.has(x)); ckLocalAt = Date.now();
      emit("checklist", { checked: ckLocal });
      renderChecklist({ ...ck, checked: ckLocal });
    } else if (act && act.dataset.act === "reset") {
      ckLocal = []; ckLocalAt = Date.now(); emit("checklist", { checked: [] }); renderChecklist({ ...ck, checked: [] });
    } else if (act && act.dataset.act === "min") {
      emit("checklist", { collapsed: !ck.collapsed }); renderChecklist({ ...ck, collapsed: !ck.collapsed });
    }
  }
  let ckDragged = false;
  function ckDragStart(e) {
    const hd = e.target.closest("[data-drag]"); if (!hd || e.target.closest("button")) return;
    const card = ckRoot.querySelector(".card"), r = card.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    let moved = false; ckDragged = false;
    const mv = (ev) => {
      const x = Math.min(innerWidth - 60, Math.max(0, ev.clientX - dx)), y = Math.min(innerHeight - 30, Math.max(0, ev.clientY - dy));
      if (!moved && Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) < 4) return;
      moved = true; card.style.right = card.style.bottom = "auto"; card.style.left = x + "px"; card.style.top = y + "px";
    };
    const up = () => {
      removeEventListener("pointermove", mv, true); removeEventListener("pointerup", up, true);
      if (!moved) return;
      ckDragged = true; setTimeout(() => (ckDragged = false), 0);
      const pos = { x: +(parseFloat(card.style.left) / innerWidth).toFixed(4), y: +(parseFloat(card.style.top) / innerHeight).toFixed(4) };
      ck = { ...ck, pos }; ckKey = null; emit("checklist", { pos });
    };
    addEventListener("pointermove", mv, true); addEventListener("pointerup", up, true);
    e.preventDefault();
  }
  addEventListener("resize", () => { if (ck) { ckKey = null; renderChecklist(ck); } });

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") startFx(); if (mediaEl && mediaEl.tagName === "VIDEO" && document.visibilityState === "visible") mediaEl.play().catch(() => {}); });

  // self-heal: TradingView rebuilds parts of the page, and new layouts add new charts
  let lastCount = -1;
  setInterval(() => {
    const p = M.payload;
    if (p && p.checklist && p.checklist.enabled && (!ckHost || !ckHost.isConnected)) { try { renderChecklist(p.checklist); } catch {} }
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
