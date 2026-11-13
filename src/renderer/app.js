(() => {
  const api = window.msk;
  let S = null, page = null, cur = null;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const sv = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
  const I = {
    plus: sv('<path d="M12 5v14M5 12h14"/>'), upload: sv('<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>'),
    wand: sv('<path d="M15 4V2M15 10V8M11 6h2M17 6h2M4 20L14 10"/><path d="M19 13l1 1-1 1-1-1zM8 3l1 1-1 1-1-1z"/>'),
    edit: sv('<path d="M4 20h4L19 9l-4-4L4 16z"/>'), copy: sv('<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    out: sv('<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>'), trash: sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    next: sv('<path d="M5 5l9 7-9 7zM18 5v14"/>'), star: sv('<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>'),
    search: sv('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'), chev: sv('<path d="M6 9l6 6 6-6"/>'),
    check: sv('<path d="M5 12l5 5 9-10"/>'), play: sv('<path d="M7 4l13 8-13 8z"/>'), more: sv('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'),
    image: sv('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
    folder: sv('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    refresh: sv('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'), layers: sv('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
    in: sv('<path d="M12 20V8M7 13l5-5 5 5M4 4h16"/>'),
    home: sv('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    chart: sv('<path d="M7 4v16M17 4v16"/><rect x="5" y="8" width="4" height="7" rx="1"/><rect x="15" y="6" width="4" height="9" rx="1"/>'),
    keyboard: sv('<rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 10h0M10 10h0M14 10h0M18 10h0M7 14h10"/>'),
    bug: sv('<rect x="8" y="7" width="8" height="12" rx="4"/><path d="M12 7V4M9 4l1 3M15 4l-1 3M4 11h4M16 11h4M4 17l4-2M20 17l-4-2"/>'),
    power: sv('<path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/>'), eye: sv('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    moon: sv('<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/>'), clock: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    bolt: sv('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'), plug: sv('<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>'),
    list: sv('<path d="M8 6h13M8 12h13M8 18h13M3 6h0M3 12h0M3 18h0"/>'),
  };
  const WORDMARK = window.MSK_WORDMARK;
  const mediaURL = (m) => (window.MSK_URLS ? window.MSK_URLS.media(m) : `msk://media/${m.id}?r=${m.rev || 0}`);
  const thumbURL = (m) => (window.MSK_URLS ? window.MSK_URLS.thumb(m) : `msk://thumb/${m.id}?r=${m.thumbRev || 0}`);
  const isExt = () => S && S.platform === "extension";
  const isMac = () => S && S.os === "darwin";
  const findMedia = (id) => S.media.find((m) => m.id === id);
  const findCfg = (id) => S.configs.find((c) => c.id === id);
  const activeCfg = () => findCfg(S.activeConfigId) || S.configs[0];

  const DEFAULT_CFG = () => ({
    id: null, name: "New config", builtIn: false, rotate: false,
    bg: { mediaId: null, mode: "behind", fit: "cover", position: "center", opacity: 0.85, blur: 0, brightness: 0.8, saturation: 1, speed: 1, tint: "#000000", tintStrength: 0.25, vignette: 0.45, base: { mode: "solid", color: "#000000", color2: "#0B3B3A", angle: 160 } },
    chart: { apply: true, up: "#FFFFFF", down: "#3A3A3A", borderUp: "#FFFFFF", borderDown: "#8A8A8A", wickUp: "#FFFFFF", wickDown: "#8A8A8A", paneBg: "#000000", paneTransparent: true, grid: false, gridColor: "#FFFFFF14", text: "#D9D9D9", crosshair: "#39C5BB" },
    ui: { glassToolbars: false },
    fx: [], fxOn: true,
  });
  const PALETTES = [
    ["Mono", "#FFFFFF", "#3A3A3A", "#8A8A8A"], ["Miku", "#39C5BB", "#FFFFFF"], ["Classic", "#089981", "#F23645"],
    ["Neon", "#00F5D4", "#FF2E88"], ["Sunset", "#FFB86B", "#FF5E7E"], ["Ice", "#A5F3FC", "#64748B"], ["Gold", "#F5D06F", "#4A4A4A", "#9A9A9A"],
  ];

  // ---------- small UI helpers ----------
  function toast(text, kind = "ok") {
    const t = el(`<div class="toast glass"><span class="dot ${kind === "ok" ? "on" : kind === "warn" ? "warn" : ""}"></span><span>${esc(text)}</span></div>`);
    $("#toasts").appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 320); }, 3200);
  }
  function modal({ title, text = "", input = null, ok = "OK", danger = false }) {
    return new Promise((resolve) => {
      const m = el(`<div class="scrim"><div class="modal glass">
        <h2 class="title" style="font-size:24px">${esc(title)}</h2>${text ? `<div class="muted">${esc(text)}</div>` : ""}
        ${input !== null ? `<input class="field" value="${esc(input)}" />` : ""}
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-x>Cancel</button><button class="btn ${danger ? "glass danger" : "solid"}" data-ok>${esc(ok)}</button></div>
      </div></div>`);
      const inp = $("input", m);
      const close = (v) => { m.remove(); resolve(v); };
      $("[data-x]", m).onclick = () => close(null);
      $("[data-ok]", m).onclick = () => close(inp ? inp.value.trim() : true);
      m.addEventListener("pointerdown", (e) => { if (e.target === m) close(null); });
      m.addEventListener("keydown", (e) => { if (e.key === "Enter") close(inp ? inp.value.trim() : true); if (e.key === "Escape") close(null); });
      $("#modal-root").appendChild(m);
      (inp || $("[data-ok]", m)).focus(); if (inp) inp.select();
    });
  }
  let openMenu = null;
  function menu(x, y, items) {
    openMenu && openMenu.remove();
    const m = el(`<div class="menu glass"></div>`);
    for (const it of items) {
      const b = el(`<button class="${it.danger ? "danger" : ""}">${esc(it.label)}</button>`);
      b.onclick = () => { m.remove(); openMenu = null; it.run(); };
      m.appendChild(b);
    }
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 10) + "px"; m.style.top = Math.min(y, innerHeight - r.height - 10) + "px";
    openMenu = m;
  }
  document.addEventListener("pointerdown", (e) => { if (openMenu && !openMenu.contains(e.target)) { openMenu.remove(); openMenu = null; } });
  // ripple + liquid highlight that follows the cursor
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest(".btn"); if (!b) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height);
    const sp = el(`<span class="ripple"></span>`);
    Object.assign(sp.style, { width: s + "px", height: s + "px", left: e.clientX - r.left - s / 2 + "px", top: e.clientY - r.top - s / 2 + "px" });
    b.appendChild(sp); setTimeout(() => sp.remove(), 650);
  });
  document.addEventListener("pointermove", (e) => {
    const g = e.target.closest && e.target.closest(".glass"); if (!g) return;
    const r = g.getBoundingClientRect();
    g.style.setProperty("--mx", e.clientX - r.left + "px"); g.style.setProperty("--my", e.clientY - r.top + "px");
  }, { passive: true });

  function seg(options, value, onChange, cls = "") {
    const s = el(`<div class="seg glass ${cls}"><span class="thumb"></span>${options.map(([v, l]) => `<button data-v="${v}">${esc(l)}</button>`).join("")}</div>`);
    const place = () => {
      const on = $(`button[data-v="${CSS.escape(String(value))}"]`, s) || $("button", s);
      $$("button", s).forEach((b) => b.classList.toggle("on", b === on));
      const th = $(".thumb", s); th.style.width = on.offsetWidth + "px"; th.style.transform = `translateX(${on.offsetLeft}px)`;
    };
    s.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; value = b.dataset.v; place(); onChange(value); });
    requestAnimationFrame(place); new ResizeObserver(place).observe(s);
    s.set = (v) => { value = v; place(); };
    return s;
  }
  function sw(checked, onChange, big = false) {
    const s = el(`<label class="switch ${big ? "big" : ""}"><input type="checkbox" ${checked ? "checked" : ""}/><span></span></label>`);
    $("input", s).onchange = (e) => onChange(e.target.checked);
    return s;
  }

  // ---------- preview stage ----------
  function Stage({ animate = false, interactive = false, seed = 7, playVideo = animate, fx = animate } = {}) {
    const root = el(`<div class="stage"><div class="layer m-wrap"><div class="layer tint"></div><div class="layer vig"></div></div><canvas></canvas></div>`);
    const wrap = $(".m-wrap", root), tint = $(".tint", root), vig = $(".vig", root);
    const chart = new MSKChart($("canvas", root), { animate, interactive, seed });
    let key = null, media = null, cur = null, raf = null, dead = false, lastDraw = 0;
    function look(c) {
      const bg = c.bg, behind = bg.mode === "behind";
      root.classList.toggle("overlay", !behind);
      root.style.background = behind ? (MSK_FX.baseCSS(bg.base) || "#131722") : "#000";
      wrap.style.opacity = behind ? 1 : bg.opacity;
      if (media) {
        const w = root.clientWidth || 600, z = Math.max(bg.blur > 0 ? 1.06 : 1, bg.zoom || 1);
        media.style.objectFit = bg.fit === "stretch" ? "fill" : bg.fit;
        media.style.objectPosition = bg.position;
        media.style.filter = `blur(${(bg.blur * w) / 1600}px) brightness(${bg.brightness}) saturate(${bg.saturation})${bg.hue ? ` hue-rotate(${bg.hue}deg)` : ""}`;
        media.style.transform = z > 1 ? `scale(${z})` : "none";
        media.style.opacity = behind ? bg.opacity : 1;
        if (media.tagName === "VIDEO") media.playbackRate = bg.speed || 1;
      }
      tint.style.background = bg.tint; tint.style.opacity = bg.tintStrength;
      vig.style.background = bg.vignette > 0 ? `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${bg.vignette}) 100%)` : "none";
    }
    function tick(now) {
      raf = null;
      if (dead || !cur || !root.isConnected) return;
      if (!MSK_FX.active(cur).any || S.fxPaused) { look(cur); chart.set(cur); return; }
      const live = MSK_FX.apply(cur, now / 1000);
      look(live);
      if (now - lastDraw > 40) { lastDraw = now; chart.set(live); }
      raf = requestAnimationFrame(tick);
    }
    function set(cfg) {
      if (!cfg) return;
      cur = cfg;
      const m = cfg.bg.mediaId && findMedia(cfg.bg.mediaId);
      const k = m ? m.id + ":" + (m.rev || 0) + ":" + (m.thumbRev || 0) : null;
      if (k !== key) {
        key = k; if (media) { media.pause && media.pause(); media.remove(); } media = null;
        if (m) {
          if (m.type === "video" && playVideo) { media = el(`<video muted loop autoplay playsinline></video>`); media.src = mediaURL(m); }
          else { media = el(`<img alt="" />`); media.src = m.type === "video" ? thumbURL(m) : mediaURL(m); }
          wrap.prepend(media);
        }
      }
      look(cfg); chart.set(cfg);
      if (fx && !raf && MSK_FX.active(cfg).any && !S.fxPaused) raf = requestAnimationFrame(tick);
    }
    return { root, set, destroy() { dead = true; chart.destroy(); if (media && media.pause) media.pause(); } };
  }

  // ---------- thumbnails ----------
  const thumbBusy = new Set();
  let thumbQ = Promise.resolve();
  function queueThumbs() {
    for (const m of S.media) if (!m.hasThumb && !thumbBusy.has(m.id)) { thumbBusy.add(m.id); thumbQ = thumbQ.then(() => makeThumb(m)); }
  }
  function makeThumb(m) {
    return new Promise((resolve) => {
      let finished = false;
      const fin = () => { if (!finished) { finished = true; resolve(); } };
      const draw = (src, sw, sh) => {
        try {
          const c = document.createElement("canvas"); c.width = 480; c.height = 300;
          const x = c.getContext("2d"), s = Math.max(480 / sw, 300 / sh);
          x.drawImage(src, (480 - sw * s) / 2, (300 - sh * s) / 2, sw * s, sh * s);
          api.media.thumb(m.id, c.toDataURL("image/jpeg", 0.82)).then(fin, fin);
        } catch { fin(); }
      };
      if (m.type === "video") {
        const v = document.createElement("video"); v.crossOrigin = "anonymous"; v.muted = true; v.preload = "auto";
        v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) * 0.1); };
        v.onseeked = () => { draw(v, v.videoWidth, v.videoHeight); v.removeAttribute("src"); v.load(); };
        v.onerror = fin; v.src = mediaURL(m);
      } else {
        const i = new Image(); i.crossOrigin = "anonymous";
        i.onload = () => draw(i, i.naturalWidth, i.naturalHeight); i.onerror = fin; i.src = mediaURL(m);
      }
      setTimeout(fin, 10000);
    });
  }
  async function importMedia(paths) {
    const added = await api.media.import(paths || []);
    if (added && added.length) toast(`Added ${added.length} item${added.length > 1 ? "s" : ""} to your library`);
    return added || [];
  }

  // ---------- pages ----------
  const pages = {};

  const COLOR_TEXT = {
    "series-props": "Chart colors applied", "series-api": "Chart colors applied", overrides: "Chart colors applied", applied: "Chart colors applied",
    unsupported: "Colors not supported in this TradingView version", waiting: "Waiting for the chart...", "no-chart": "Waiting for the chart...",
    skipped: "Colors off in this config", off: "MSK is off",
  };
  function tvInfo() {
    const t = S.tv || {};
    if (isExt()) return t.status === "connected"
      ? { title: "On TradingView", sub: `${t.windows} chart tab${t.windows === 1 ? "" : "s"} open in this browser`, dot: "on", btn: null }
      : { title: "No chart open", sub: "Open a TradingView chart tab to see MSK", dot: "", btn: ["Open TradingView", false] };
    return {
      connected: { title: "Hooked", sub: `${t.charts || 0} chart${t.charts === 1 ? "" : "s"} · ${COLOR_TEXT[t.colors] || "Applying..."}${t.port && t.port !== S.settings.port ? ` · via port ${t.port}` : ""}`, dot: "on", btn: null },
      "no-hook": { title: "Not hooked", sub: "TradingView is open without MSK", dot: "warn", btn: ["Restart with MSK", true] },
      launching: { title: "Launching", sub: t.message || "Starting TradingView...", dot: "busy", btn: null },
      waiting: { title: "Loading", sub: "Waiting for a chart window...", dot: "busy", btn: null },
      offline: { title: "Closed", sub: "TradingView isn't running", dot: "", btn: ["Launch TradingView", false] },
    }[t.status || "offline"];
  }
  async function launchTV(restart) { const r = await api.tv.launch(restart); if (r && r.needsRestart) { const ok = await modal({ title: "Restart TradingView?", text: "It's open without MSK. Restarting lets MSK hook in. Your layout stays saved.", ok: "Restart" }); if (ok) api.tv.launch(true); } }

  // HOME
  pages.home = {
    mount(v) {
      v.innerHTML = `<div class="page stagger">
        <div id="h-upd" style="--i:0"></div>
        <div class="hero" style="--i:0">
          <section class="hero-main glass">
            <div class="eyebrow">MSK · chart studio</div>
            <div class="wm-big">${WORDMARK}</div>
            <h1 class="title">Make the chart<br/>feel like yours.</h1>
            <div class="row wrap"><button class="btn solid" data-go="workshop">${I.wand}Open Workshop</button><button class="btn glass bubble" data-act="import">${I.upload}Add media</button></div>
          </section>
          <section class="status-card glass" id="h-status"></section>
        </div>
        <section class="active-card glass" style="--i:1"><div id="h-stage"></div><div class="active-info" id="h-active"></div></section>
        <div class="row" style="--i:2;justify-content:space-between;margin:6px 4px 8px"><h3>Quick switch</h3><button class="btn ghost sm" data-go="configs">All configs</button></div>
        <div class="chips" style="--i:3" id="h-chips"></div>
        <div class="stats" style="--i:4" id="h-stats"></div>
      </div>`;
      this.stage = Stage({ animate: true, interactive: true, seed: 11 });
      $("#h-stage", v).replaceWith(this.stage.root);
      v.addEventListener("click", (e) => {
        const g = e.target.closest("[data-go]"); if (g) return go(g.dataset.go);
        const a = e.target.closest("[data-act]"); if (!a) return;
        const act = a.dataset.act;
        if (act === "import") importMedia();
        if (act === "launch") launchTV(a.dataset.restart === "1");
        if (act === "edit") go("workshop", { configId: S.activeConfigId });
        if (act === "next") api.config.next();
        if (act === "toggle") api.setEnabled(!S.enabled);
        if (act === "chip") api.config.activate(a.dataset.id);
        if (act === "upd-get") api.update.open();
        if (act === "upd-notes") api.update.open("page");
        if (act === "upd-later") api.update.dismiss(S.update.version);
      });
      this.update();
    },
    update() {
      const v = document, t = tvInfo(), c = activeCfg();
      const u = S.update, showU = u && S.dismissedUpdate !== u.version;
      $("#h-upd").innerHTML = showU ? `<section class="upd-card glass"><div class="upd-ico">${I.upload.replace("M12 16V4M7 9l5-5 5 5M4 20h16", "M12 20V8M7 13l5-5 5 5M4 4h16")}</div>
        <div class="grow"><b>MSK v${esc(u.version)} is out</b><div class="muted" style="font-size:12.5px">${isExt() ? "Download the new version from GitHub, replace your MSK folder's files, then hit reload on your extensions page." : "Download the new installer from GitHub and run it. Your media and configs stay."}</div>
          ${u.notes ? `<div class="faint upd-notes">${esc(u.notes.split("\n").map((l) => l.replace(/^[-*#\s]+/, "").trim()).filter(Boolean).slice(0, 3).join(" · ")).slice(0, 220)}</div>` : ""}</div>
        <div class="row"><button class="btn ghost sm" data-act="upd-later">Later</button><button class="btn ghost sm" data-act="upd-notes">What's new</button><button class="btn miku" data-act="upd-get">${I.out}Download</button></div></section>` : "";
      $("#h-status", v).innerHTML = `<div class="eyebrow">TradingView</div>
        <div class="status-big"><div class="status-orb"><span class="dot ${t.dot}"></span></div><div><div class="status-title">${t.title}</div><div class="muted">${esc(t.sub)}</div></div></div>
        <div class="kv"><span>Background</span><span>${S.enabled ? "On" : "Off"}</span></div>
        <div class="kv"><span>Active config</span><span>${esc(c ? c.name : "-")}</span></div>
        <div class="kv"><span>Rotation</span><span>${S.settings.rotation.enabled ? `Every ${S.settings.rotation.minutes} min` : "Off"}</span></div>
        ${t.btn ? `<button class="btn ${t.btn[1] ? "miku" : "solid"}" data-act="launch" data-restart="${t.btn[1] ? 1 : 0}">${I.play}${t.btn[0]}</button>` : ""}`;
      if (c) {
        this.stage.set(c);
        const m = c.bg.mediaId && findMedia(c.bg.mediaId);
        $("#h-active", v).innerHTML = `<div class="eyebrow">Now playing</div>
          <div class="big-name">${esc(c.name)}</div>
          <div class="row wrap"><span class="badge ${S.enabled ? "on" : ""}">${S.enabled ? "Live" : "Paused"}</span><span class="badge">${c.bg.mode === "behind" ? "Behind chart" : "Overlay"}</span>${MSK_FX.active(c).any ? `<span class="badge ${S.fxPaused ? "" : "on"}">FX${S.fxPaused ? " paused" : ""}</span>` : ""}${m ? `<span class="badge">${m.type}</span>` : `<span class="badge">No media</span>`}</div>
          <div class="swatches">${[c.chart.up, c.chart.down, c.chart.wickUp, c.chart.wickDown, c.chart.crosshair].map((x) => `<span class="sw" style="background:${x}"></span>`).join("")}</div>
          <div class="muted" style="font-size:13px">${m ? esc(m.name) : "Pick a photo or video in the Workshop."}</div>
          ${MSK_FX.active(c).any ? `<div class="fx-sum">${(c.fx || []).filter((a) => a.on && MSK_FX.TARGETS[a.target]).map((a) => `<span>${esc(MSK_FX.TARGETS[a.target].label)} · ${MSK_FX.WAVES[a.wave] || a.wave}</span>`).join("")}</div>` : ""}
          <div class="row wrap" style="margin-top:auto"><button class="btn solid sm" data-act="edit">${I.edit}Edit</button><button class="btn glass bubble sm" data-act="next">${I.next}Next</button><button class="btn ghost sm" data-act="toggle">${S.enabled ? "Pause" : "Resume"}</button></div>`;
      }
      $("#h-chips", v).innerHTML = S.configs.map((x) => {
        const m = x.bg.mediaId && findMedia(x.bg.mediaId);
        const bgImg = m && m.hasThumb ? `background-image:url('${thumbURL(m)}')` : `background:linear-gradient(135deg, ${x.chart.up} 50%, ${x.chart.down} 50%)`;
        return `<button class="chip glass ${x.id === S.activeConfigId ? "active" : ""}" data-act="chip" data-id="${x.id}"><span class="thumb" style="${bgImg}"></span>${esc(x.name)}</button>`;
      }).join("");
      const vids = S.media.filter((m) => m.type === "video").length;
      $("#h-stats", v).innerHTML = `<div class="stat glass"><b>${S.media.length}</b><span>Media · ${vids} video</span></div>
        <div class="stat glass"><b>${S.configs.length}</b><span>Configs</span></div>
        <div class="stat glass"><b>${S.configs.filter((c) => c.rotate).length}</b><span>In rotation</span></div>`;
    },
    leave() { this.stage && this.stage.destroy(); },
  };

  // LIBRARY
  const L = { filter: "all", q: "" };
  pages.library = {
    mount(v) {
      v.innerHTML = `<div class="page">
        <div class="page-head"><div class="left"><div class="eyebrow">Library</div><h2 class="title">Your media</h2></div>
          <button class="btn solid" data-act="import">${I.upload}Add media</button></div>
        <div class="toolbar"><span id="l-seg"></span>
          <label class="search glass">${I.search}<input placeholder="Search" value="${esc(L.q)}" /></label></div>
        <div id="l-grid"></div></div>`;
      $("#l-seg", v).replaceWith(seg([["all", "All"], ["image", "Images"], ["video", "Videos"], ["fav", "Favorites"]], L.filter, (f) => { L.filter = f; this.update(); }));
      $(".search input", v).oninput = (e) => { L.q = e.target.value.toLowerCase(); this.update(); };
      v.addEventListener("click", async (e) => {
        const a = e.target.closest("[data-act]"); if (!a) return;
        e.stopPropagation();
        const id = a.dataset.id, m = id && findMedia(id);
        if (a.dataset.act === "import") importMedia();
        if (a.dataset.act === "fav") api.media.update(id, { fav: !m.fav });
        if (a.dataset.act === "open") go("workshop", { mediaId: id });
        if (a.dataset.act === "more") {
          const r = a.getBoundingClientRect();
          menu(r.left, r.bottom + 6, [
            { label: "New config from this", run: () => go("workshop", { mediaId: id }) },
            { label: "Use on active config", run: async () => { const c = clone(activeCfg()); c.bg.mediaId = id; const saved = await api.config.save(c); await api.config.activate(saved.id); toast("Background updated"); } },
            { label: "Rename", run: async () => { const n = await modal({ title: "Rename", input: m.name, ok: "Save" }); if (n) api.media.update(id, { name: n }); } },
            { label: "Delete", danger: true, run: async () => { if (await modal({ title: "Delete media?", text: `"${m.name}" will be removed from your library.`, ok: "Delete", danger: true })) api.media.remove(id); } },
          ]);
        }
      });
      v.addEventListener("pointerover", (e) => {
        const card = e.target.closest(".m-card"); if (!card || card.dataset.type !== "video" || $("video", card)) return;
        const m = findMedia(card.dataset.id); if (!m) return;
        const vid = el(`<video muted loop autoplay playsinline></video>`); vid.src = mediaURL(m);
        $(".m-thumb", card).appendChild(vid);
        card.addEventListener("pointerleave", () => { vid.pause(); vid.remove(); }, { once: true });
      });
      this.update();
    },
    update() {
      const g = $("#l-grid");
      let list = S.media;
      if (L.filter === "fav") list = list.filter((m) => m.fav); else if (L.filter !== "all") list = list.filter((m) => m.type === L.filter);
      if (L.q) list = list.filter((m) => m.name.toLowerCase().includes(L.q));
      if (!S.media.length) {
        g.innerHTML = `<div class="empty glass"><div class="ico">${I.image}</div><h2 class="title" style="font-size:26px">Nothing here yet</h2>
          <div class="muted">Drag photos or videos anywhere in this window, or add them below.</div><button class="btn solid" data-act="import">${I.upload}Add media</button></div>`;
        return;
      }
      const sz = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB");
      g.innerHTML = `<div class="media-grid stagger">${list.map((m, i) => `
        <div class="m-card glass" style="--i:${Math.min(i, 14)}" data-id="${m.id}" data-type="${m.type}" data-act="open">
          <div class="m-thumb">${m.hasThumb ? `<img src="${thumbURL(m)}" alt="" />` : ""}<span class="type">${m.type}</span>
            <button class="fav ${m.fav ? "on" : ""}" data-act="fav" data-id="${m.id}">${I.star}</button></div>
          <div class="m-meta"><span class="name">${esc(m.name)}</span><small>${sz(m.size || 0)}</small>
            <button class="btn ghost sm icon" data-act="more" data-id="${m.id}">${I.more}</button></div>
        </div>`).join("")}</div>${!list.length ? `<div class="muted" style="padding:30px">No matches.</div>` : ""}`;
    },
  };

  // WORKSHOP
  const W = { draft: null, sourceId: null, dirty: false, live: false, link: true };
  function openDraft(opts = {}) {
    if (opts.configId) { const c = findCfg(opts.configId); if (c) { W.draft = clone(c); W.sourceId = c.id; W.dirty = false; } }
    else if (opts.mediaId) {
      const base = clone(activeCfg() || DEFAULT_CFG()), m = findMedia(opts.mediaId);
      W.draft = { ...base, id: null, builtIn: false, rotate: false, name: m ? m.name : "New config", bg: { ...base.bg, mediaId: opts.mediaId } };
      W.sourceId = null; W.dirty = true;
    } else if (opts.fresh) { W.draft = DEFAULT_CFG(); W.sourceId = null; W.dirty = true; }
    else if (!W.draft) { const c = activeCfg(); W.draft = clone(c); W.sourceId = c.id; W.dirty = false; }
  }
  let liveT;
  function pushLive() { if (!W.live) return; clearTimeout(liveT); liveT = setTimeout(() => api.config.preview(W.draft), 70); }

  pages.workshop = {
    mount(v, opts) {
      openDraft(opts);
      const d = W.draft;
      const src = W.sourceId && findCfg(W.sourceId);
      v.innerHTML = `<div class="page">
        <div class="ws-bar glass">${I.edit.replace("<svg", '<svg style="width:18px;height:18px;fill:none;stroke:var(--fg-3);stroke-width:2"')}
          <input class="name" value="${esc(d.name)}" spellcheck="false" />
          <label class="row" style="gap:8px;font-size:12.5px;color:var(--fg-2)"><span>Live on TradingView</span><span id="w-live"></span></label>
          <button class="btn ghost sm" data-act="load">${I.layers}Load</button>
          <button class="btn ghost sm" data-act="revert" ${W.sourceId ? "" : "disabled"}>${I.refresh}Revert</button>
          <button class="btn glass bubble sm" data-act="saveNew">${I.plus}Save as new</button>
          <button class="btn solid sm" data-act="save">${I.check}${src && !src.builtIn ? "Save & apply" : "Save & apply"}</button>
        </div>
        <div class="ws">
          <div class="ws-left"><div id="w-stage"></div><div class="strip glass" id="w-strip"></div>
            <div class="faint" style="font-size:12px;padding:0 6px">${src && src.builtIn ? "Built-in preset: saving makes your own copy." : "Tip: hover the preview to see your crosshair color."}</div></div>
          <div class="ws-right" id="w-panels"></div>
        </div></div>`;
      $("#w-live", v).replaceWith(sw(W.live, (on) => { W.live = on; on ? pushLive() : api.config.preview(null); }));
      this.stage = Stage({ animate: true, interactive: true, seed: 5 });
      $("#w-stage", v).replaceWith(this.stage.root);
      $(".name", v).oninput = (e) => { d.name = e.target.value; W.dirty = true; };
      v.addEventListener("click", async (e) => {
        const a = e.target.closest("[data-act]"); if (!a) return;
        const act = a.dataset.act;
        if (act === "media") { d.bg.mediaId = a.dataset.id || null; this.changed(); this.strip(); }
        if (act === "add") { const added = await importMedia(); if (added[0]) { d.bg.mediaId = added[0].id; this.changed(); } }
        if (act === "revert" && W.sourceId) { openDraft({ configId: W.sourceId }); this.remount(); toast("Reverted"); }
        if (act === "load") {
          const r = a.getBoundingClientRect();
          menu(r.left, r.bottom + 6, [{ label: "New blank config", run: () => { openDraft({ fresh: true }); this.remount(); } },
            ...S.configs.map((c) => ({ label: c.name, run: () => { openDraft({ configId: c.id }); this.remount(); } }))]);
        }
        if (act === "save" || act === "saveNew") {
          const c = clone(d); if (act === "saveNew") { c.id = null; if (src && c.name === src.name) c.name += " copy"; }
          const saved = await api.config.save(c);
          await api.config.activate(saved.id);
          W.draft = clone(saved); W.sourceId = saved.id; W.dirty = false;
          if (W.live) api.config.preview(W.draft);
          toast(act === "saveNew" ? "Saved as a new config" : "Saved and applied");
          this.remount();
        }
      });
      this.panels(); this.strip(); this.changed(true);
      if (W.live) pushLive();
    },
    remount() { const v = $("#view"); this.leave(true); v.innerHTML = ""; const host = document.createElement("div"); v.appendChild(host); this.mount(host); },
    changed(initial) { this.stage.set(W.draft); if (!initial) { W.dirty = true; pushLive(); } },
    strip() {
      const d = W.draft, s = $("#w-strip");
      s.innerHTML = `<div class="s-item none ${!d.bg.mediaId ? "on" : ""}" data-act="media" data-id="">None</div>` +
        S.media.map((m) => `<div class="s-item ${d.bg.mediaId === m.id ? "on" : ""}" data-act="media" data-id="${m.id}" title="${esc(m.name)}" style="${m.hasThumb ? `background-image:url('${thumbURL(m)}')` : ""}"></div>`).join("") +
        `<div class="s-item add" data-act="add" title="Add media">+</div>`;
    },
    panels() {
      const d = W.draft, P = $("#w-panels"), self = this;
      const get = (p) => p.split(".").reduce((o, k) => o[k], d);
      const set = (p, val) => { const ks = p.split("."), last = ks.pop(); ks.reduce((o, k) => o[k], d)[last] = val; self.changed(); };
      const panel = (title, open, kids) => {
        const p = el(`<details class="panel glass" ${open ? "open" : ""}><summary><h3>${title}</h3>${I.chev.replace("<svg", '<svg class="chev"')}</summary><div class="body"></div></details>`);
        kids.forEach((k) => k && $(".body", p).appendChild(k)); P.appendChild(p); return p;
      };
      const ctrl = (label, node, valText) => { const c = el(`<div class="ctrl"><div class="lbl"><span>${label}</span><b>${valText || ""}</b></div></div>`); c.appendChild(node); return c; };
      const slider = (label, path, min, max, step, fmt = (x) => x) => {
        const r = el(`<input type="range" min="${min}" max="${max}" step="${step}" value="${get(path)}" />`);
        const c = ctrl(label, r, fmt(get(path)));
        const paint = () => { r.style.setProperty("--p", ((r.value - min) / (max - min)) * 100 + "%"); $("b", c).textContent = fmt(+r.value); };
        r.oninput = () => { set(path, +r.value); paint(); }; paint(); return c;
      };
      const segC = (label, path, opts) => ctrl(label, seg(opts, get(path), (val) => set(path, val), "full"));
      const color = (label, path, after) => {
        const val = get(path);
        const c = el(`<div class="color"><span class="chip-c" style="background:${mskRGBA(val)}"><input type="color" value="${val.slice(0, 7)}"/></span><input class="hex" value="${val}" spellcheck="false" maxlength="9"/><span class="lab">${label}</span></div>`);
        const pick = $("input[type=color]", c), hex = $(".hex", c), chip = $(".chip-c", c);
        const apply = (x) => { chip.style.background = mskRGBA(x); set(path, x); after && after(x); };
        pick.oninput = () => { const alpha = (get(path).length === 9 ? get(path).slice(7) : ""); const x = pick.value.toUpperCase() + alpha; hex.value = x; apply(x); };
        hex.onchange = () => { let x = hex.value.trim(); if (!x.startsWith("#")) x = "#" + x; if (/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(x)) { x = x.toUpperCase(); hex.value = x; pick.value = x.slice(0, 7); apply(x); } else hex.value = get(path); };
        c.sync = () => { const x = get(path); hex.value = x; pick.value = x.slice(0, 7); chip.style.background = mskRGBA(x); };
        return c;
      };
      const line = (label, node) => { const l = el(`<div class="line"><span>${label}</span></div>`); l.appendChild(node); return l; };
      const pct = (x) => Math.round(x * 100) + "%";

      panel("Background", true, [
        segC("Placement", "bg.mode", [["behind", "Behind chart"], ["overlay", "Overlay"]]),
        segC("Fit", "bg.fit", [["cover", "Cover"], ["contain", "Contain"], ["stretch", "Stretch"]]),
        segC("Position", "bg.position", [["top", "Top"], ["center", "Center"], ["bottom", "Bottom"]]),
        slider("Opacity", "bg.opacity", 0.05, 1, 0.01, pct),
        slider("Blur", "bg.blur", 0, 30, 1, (x) => x + "px"),
        slider("Brightness", "bg.brightness", 0.2, 1.5, 0.01, pct),
        slider("Saturation", "bg.saturation", 0, 2, 0.01, pct),
        slider("Video speed", "bg.speed", 0.25, 2, 0.05, (x) => x.toFixed(2) + "x"),
      ]);
      // Base color
      d.bg.base = { ...MSK_FX.DEFAULT_BASE, ...(d.bg.base || {}) };
      const baseP = panel("Base color", true, []), bb = $(".body", baseP);
      const SOLIDS = [["Black", "#000000"], ["Charcoal", "#111315"], ["TV dark", "#131722"], ["Midnight", "#0B1020"], ["Navy", "#0A1A33"], ["Deep teal", "#062A2A"], ["Plum", "#1A0B24"], ["White", "#FFFFFF"]];
      const GRADS = [["Miku", "#0B4A46", "#000000", 160], ["Aurora", "#03322C", "#1A0B2E", 135], ["Sunset", "#3A0F25", "#0B1020", 180], ["Ocean", "#0A2A4A", "#020812", 170], ["Smoke", "#2A2D33", "#060708", 160], ["Daylight", "#FFFFFF", "#D9E7F2", 180]];
      const renderBase = () => {
        const b = d.bg.base;
        bb.innerHTML = "";
        bb.appendChild(el(`<div class="faint" style="font-size:12px">Shows behind your photo or video: around it with Fit "Contain", through it when opacity is under 100%, and as the whole chart background when Media is "None". Applies with "Behind chart".</div>`));
        bb.appendChild(ctrl("Style", seg([["solid", "Solid"], ["gradient", "Gradient"], ["tv", "TradingView"]], b.mode, (m) => { b.mode = m; self.changed(); renderBase(); }, "full")));
        if (b.mode === "tv") { bb.appendChild(el(`<div class="faint" style="font-size:12px">Keeps TradingView's own theme color behind your media.</div>`)); return; }
        const list = b.mode === "gradient" ? GRADS : SOLIDS;
        const sws = el(`<div class="palettes">${list.map((x, i) => `<button class="pal glass" data-i="${i}"><i class="base-dot" style="background:${x.length > 2 ? `linear-gradient(${x[3]}deg, ${x[1]}, ${x[2]})` : x[1]}"></i>${x[0]}</button>`).join("")}</div>`);
        sws.onclick = (e) => {
          const t = e.target.closest(".pal"); if (!t) return;
          const x = list[+t.dataset.i];
          if (b.mode === "gradient") Object.assign(b, { color: x[1], color2: x[2], angle: x[3] }); else b.color = x[1];
          self.changed(); renderBase();
        };
        bb.appendChild(sws);
        if (b.mode === "gradient") {
          bb.appendChild(el(`<div class="two"></div>`));
          const two = $(".two", bb); two.appendChild(color("From", "bg.base.color")); two.appendChild(color("To", "bg.base.color2"));
          bb.appendChild(slider("Angle", "bg.base.angle", 0, 360, 1, (x) => Math.round(x) + "°"));
        } else bb.appendChild(color("Color", "bg.base.color"));
      };
      renderBase();

      panel("Mood", false, [
        color("Tint", "bg.tint"),
        slider("Tint strength", "bg.tintStrength", 0, 1, 0.01, pct),
        slider("Vignette", "bg.vignette", 0, 1, 0.01, pct),
      ]);
      const pals = el(`<div class="palettes">${PALETTES.map((p, i) => `<button class="pal glass" data-i="${i}"><i style="background:${p[1]}"></i><i style="background:${p[2]}"></i>${p[0]}</button>`).join("")}</div>`);
      const cols = {};
      const linkTo = (kind) => (x) => { if (!W.link) return; for (const k of [kind === "up" ? "borderUp" : "borderDown", kind === "up" ? "wickUp" : "wickDown"]) { d.chart[k] = x; cols[k] && cols[k].sync(); } self.changed(); };
      for (const [k, lab, after] of [["up", "Up body", linkTo("up")], ["down", "Down body", linkTo("down")], ["borderUp", "Up border"], ["borderDown", "Down border"], ["wickUp", "Up wick"], ["wickDown", "Down wick"]]) cols[k] = color(lab, "chart." + k, after);
      pals.onclick = (e) => {
        const b = e.target.closest(".pal"); if (!b) return;
        const [, up, down, downEdge] = PALETTES[+b.dataset.i];
        Object.assign(d.chart, { up, down, borderUp: up, wickUp: up, borderDown: downEdge || down, wickDown: downEdge || down });
        Object.values(cols).forEach((c) => c.sync()); self.changed();
      };
      panel("Candles", true, [
        line("Recolor the chart", sw(d.chart.apply, (on) => set("chart.apply", on))),
        pals,
        el(`<div class="two"></div>`),
        line("Match borders & wicks to body", sw(W.link, (on) => { W.link = on; })),
      ]);
      const two = $$(".panel .two", P).pop();
      ["up", "down", "borderUp", "borderDown", "wickUp", "wickDown"].forEach((k) => two.appendChild(cols[k]));
      panel("Chart", false, [
        line("Transparent pane", sw(d.chart.paneTransparent, (on) => set("chart.paneTransparent", on))),
        el(`<div class="faint" style="font-size:12px">"Behind chart" always clears the pane so your media shows.</div>`),
        color("Pane", "chart.paneBg"),
        line("Grid lines", sw(d.chart.grid, (on) => set("chart.grid", on))),
        color("Grid", "chart.gridColor"),
        color("Scale text", "chart.text"),
        color("Crosshair", "chart.crosshair"),
      ]);
      // Animations
      const fxP = panel("Animations", true, []);
      const fxBody = $(".body", fxP);
      const FXT = MSK_FX.TARGETS, FXW = MSK_FX.WAVES;
      const FX_PRESETS = [
        ["Breathing", [["opacity", "sine", 4, 45, 100]]],
        ["Rainbow candles", [["candles", "saw", 6, 0, 360]]],
        ["Rainbow background", [["hue", "saw", 10, 0, 360]]],
        ["Neon tint", [["tint", "saw", 8, 0, 360], ["tintStrength", "sine", 3, 15, 45]]],
        ["Heartbeat", [["brightness", "heartbeat", 1.2, 70, 135]]],
        ["Strobe", [["brightness", "strobe", 0.7, 60, 160]]],
        ["Slow zoom", [["zoom", "sine", 20, 100, 112]]],
        ["Flicker", [["opacity", "flicker", 1.5, 55, 100]]],
        ["Rainbow crosshair", [["crosshair", "saw", 3, 0, 360]]],
        ["Glitch", [["hue", "random", 0.25, 0, 360], ["blur", "random", 0.25, 0, 3]]],
      ];
      const newFx = (target = "opacity", wv = "sine", period = 3, min, max) => {
        const T = FXT[target];
        return { id: Math.random().toString(36).slice(2, 9), on: true, target, wave: wv, period, min: min ?? T.def[0], max: max ?? T.def[1], phase: 0 };
      };
      const fxChanged = () => { d.fx = d.fx || []; self.changed(); };
      const renderFx = () => {
        d.fx = d.fx || [];
        fxBody.innerHTML = "";
        fxBody.appendChild(line("Animations on", sw(d.fxOn !== false, (on) => { d.fxOn = on; fxChanged(); })));
        const pr = el(`<div class="palettes">${FX_PRESETS.map((x, i) => `<button class="pal glass" data-i="${i}">${x[0]}</button>`).join("")}</div>`);
        pr.onclick = (e) => {
          const b = e.target.closest(".pal"); if (!b) return;
          for (const [t, w, per, mn, mx] of FX_PRESETS[+b.dataset.i][1]) d.fx.push(newFx(t, w, per, mn, mx));
          if (FX_PRESETS[+b.dataset.i][1].some(([t]) => FXT[t].chart) && !d.chart.apply) { d.chart.apply = true; toast("Turned on 'Recolor the chart' for color animations"); }
          renderFx(); fxChanged();
        };
        fxBody.appendChild(pr);
        d.fx.forEach((a, i) => {
          const T = FXT[a.target] || FXT.opacity;
          const groups = {};
          for (const [k, t] of Object.entries(FXT)) (groups[t.group] = groups[t.group] || []).push(`<option value="${k}" ${k === a.target ? "selected" : ""}>${t.label}</option>`);
          const card = el(`<div class="fx-card">
            <div class="row"><select class="field fx-sel">${Object.entries(groups).map(([g, o]) => `<optgroup label="${g}">${o.join("")}</optgroup>`).join("")}</select>
              <span class="fx-sw"></span><button class="btn ghost sm icon danger" title="Remove">${I.trash}</button></div>
            <div class="waves">${Object.entries(FXW).map(([k, l]) => `<button class="wv ${k === a.wave ? "on" : ""}" data-w="${k}">${l}</button>`).join("")}</div>
          </div>`);
          $(".fx-sw", card).replaceWith(sw(a.on, (on) => { a.on = on; fxChanged(); }));
          $(".fx-sel", card).onchange = (e) => { const nt = FXT[e.target.value]; a.target = e.target.value; a.min = nt.def[0]; a.max = nt.def[1]; renderFx(); fxChanged(); };
          $(".btn.danger", card).onclick = () => { d.fx.splice(i, 1); renderFx(); fxChanged(); };
          $(".waves", card).onclick = (e) => { const b = e.target.closest(".wv"); if (!b) return; a.wave = b.dataset.w; $$(".wv", card).forEach((x) => x.classList.toggle("on", x === b)); fxChanged(); };
          const u = (x) => Math.round(x) + T.unit;
          card.appendChild(slider("Speed (seconds per cycle)", `fx.${i}.period`, 0.1, 20, 0.1, (x) => x.toFixed(1) + "s"));
          card.appendChild(slider(T.kind === "color" ? "From hue" : "From", `fx.${i}.min`, T.min, T.max, 1, u));
          card.appendChild(slider(T.kind === "color" ? "To hue" : "To", `fx.${i}.max`, T.min, T.max, 1, u));
          card.appendChild(slider("Offset", `fx.${i}.phase`, 0, 1, 0.01, (x) => Math.round(x * 100) + "%"));
          if ((a.wave === "strobe" || a.wave === "square") && a.period < 0.4) card.appendChild(el(`<div class="faint" style="font-size:11.5px">Very fast flashing can be rough on the eyes.</div>`));
          if (T.chart && !d.chart.apply) card.appendChild(el(`<div class="faint" style="font-size:11.5px">Turn on "Recolor the chart" for this to show on TradingView.</div>`));
          fxBody.appendChild(card);
        });
        const add = el(`<button class="btn glass bubble sm" style="align-self:flex-start">${I.plus}Add animation</button>`);
        add.onclick = () => { d.fx.push(newFx()); renderFx(); fxChanged(); };
        fxBody.appendChild(add);
      };
      renderFx();

      panel("Extras", false, [
        line("Glass toolbars", sw(d.ui.glassToolbars, (on) => set("ui.glassToolbars", on))),
        el(`<div class="faint" style="font-size:12px">Makes TradingView's side and top bars see-through. Works best with "Behind chart".</div>`),
        line("Include in rotation", sw(!!d.rotate, (on) => { d.rotate = on; W.dirty = true; })),
      ]);
    },
    update() { this.strip(); this.stage.set(W.draft); },
    leave(keep) { this.stage && this.stage.destroy(); if (W.live && !keep) api.config.preview(null); },
  };

  // CONFIGS
  pages.configs = {
    mount(v) {
      v.innerHTML = `<div class="page">
        <div class="page-head"><div class="left"><div class="eyebrow">Configs</div><h2 class="title">Your looks</h2></div>
          <div class="row"><button class="btn glass bubble" data-act="import">${I.in}Import</button><button class="btn solid" data-act="new">${I.plus}New config</button></div></div>
        <div id="c-grid"></div></div>`;
      v.addEventListener("click", async (e) => {
        const a = e.target.closest("[data-act]"); if (!a) return;
        const id = a.dataset.id, c = id && findCfg(id);
        switch (a.dataset.act) {
          case "import": { const n = await api.config.import(); if (n) toast(`Imported ${n} config${n > 1 ? "s" : ""}`); break; }
          case "new": go("workshop", { fresh: true }); break;
          case "apply": api.config.activate(id); toast(`${c.name} applied`); break;
          case "edit": go("workshop", { configId: id }); break;
          case "dup": api.config.duplicate(id); break;
          case "export": if (await api.config.export(id)) toast("Exported"); break;
          case "del": if (await modal({ title: "Delete config?", text: `"${c.name}" will be gone for good.`, ok: "Delete", danger: true })) api.config.remove(id); break;
        }
      });
      v.addEventListener("dblclick", async (e) => {
        const n = e.target.closest(".name[data-id]"); if (!n) return;
        const c = findCfg(n.dataset.id); const name = await modal({ title: "Rename config", input: c.name, ok: "Save" });
        if (name) api.config.rename(c.id, name);
      });
      this.update();
    },
    update() {
      (this.stages || []).forEach((s) => s.destroy()); this.stages = [];
      const g = $("#c-grid");
      g.innerHTML = `<div class="cfg-grid stagger">${S.configs.map((c, i) => `
        <div class="cfg glass ${c.id === S.activeConfigId ? "active" : ""}" style="--i:${Math.min(i, 12)}">
          <div data-stage="${c.id}"></div>
          <div class="cfg-info">
            <div class="row"><span class="name grow" data-id="${c.id}" title="Double-click to rename">${esc(c.name)}</span>
              ${c.id === S.activeConfigId ? `<span class="badge on">Active</span>` : ""}${MSK_FX.active(c).any ? `<span class="badge">FX</span>` : ""}${c.builtIn ? `<span class="badge">Preset</span>` : ""}</div>
            <div class="row"><div class="swatches">${[c.chart.up, c.chart.down, c.chart.crosshair].map((x) => `<span class="sw" style="background:${x}"></span>`).join("")}</div>
              <span class="faint grow" style="font-size:12px">${c.bg.mode === "behind" ? "Behind" : "Overlay"}</span>
              <span class="faint" style="font-size:12px">Rotate</span><span data-rot="${c.id}"></span></div>
            <div class="cfg-actions">
              <button class="btn ${c.id === S.activeConfigId ? "glass" : "solid"} sm grow" data-act="apply" data-id="${c.id}">${c.id === S.activeConfigId ? I.check + "Applied" : I.play + "Apply"}</button>
              <button class="btn ghost sm icon" title="Edit" data-act="edit" data-id="${c.id}">${I.edit}</button>
              <button class="btn ghost sm icon" title="Duplicate" data-act="dup" data-id="${c.id}">${I.copy}</button>
              <button class="btn ghost sm icon" title="Export" data-act="export" data-id="${c.id}">${I.out}</button>
              <button class="btn ghost sm icon danger" title="Delete" data-act="del" data-id="${c.id}">${I.trash}</button>
            </div>
          </div>
        </div>`).join("")}</div>`;
      S.configs.forEach((c, i) => {
        const st = Stage({ seed: 20 + i }); this.stages.push(st);
        $(`[data-stage="${c.id}"]`, g).replaceWith(st.root); st.set(c);
        $(`[data-rot="${c.id}"]`, g).replaceWith(sw(!!c.rotate, (on) => api.config.rotate(c.id, on)));
      });
    },
    leave() { (this.stages || []).forEach((s) => s.destroy()); },
  };

  // SETTINGS
  const SET = { tab: "general", q: "" };
  const keycaps = (acc) => acc ? hkShow(acc).split("+").map((k) => `<kbd>${esc(k)}</kbd>`).join("") : `<span class="faint">Not set</span>`;
  pages.settings = {
    async mount(v) {
      const s = S.settings, info = await api.logs.get();
      const R = (icon, title, sub, id, extra = "") => `<div class="set-row" data-q="${esc((title + " " + sub).toLowerCase())}" ${extra}>
        <span class="row-ico">${icon}</span><div class="t"><b>${title}</b><small>${sub}</small></div><span data-c="${id}"></span></div>`;
      const EXT = isExt();
      const SECTIONS = [
        ["general", "General", I.home],
        ["tv", "TradingView", I.chart],
        ["fx", "Animations", I.wand],
        ["keys", "Hotkeys", I.keyboard],
        ...(EXT ? [] : [["debug", "Debug", I.bug]]),
        ["data", "Data", I.folder],
      ];
      const D = (html) => (EXT ? "" : html);
      v.innerHTML = `<div class="page set-page">
        <div class="page-head"><div class="left"><div class="eyebrow">Settings</div><h2 class="title">Make it run your way</h2></div>
          <label class="search glass">${I.search}<input placeholder="Search settings" value="${esc(SET.q)}" /></label></div>
        <div class="set-tabs glass" id="set-tabs"><span class="thumb"></span>${SECTIONS.map(([k, l, ic]) => `<button data-sec="${k}">${ic}<span>${l}</span></button>`).join("")}</div>
        <div class="set-body stagger">
          <section class="set-sec glass" id="sec-general" style="--i:0"><h3>${I.home}General</h3>
            ${D(R(I.power, isMac() ? "Open MSK when you log in" : "Launch MSK when Windows starts", isMac() ? "Starts quietly in the menu bar" : "Starts quietly in the tray when you log in", "startup"))}
            ${D(R(I.eye, "Start hidden", isMac() ? "Only the menu bar icon shows on login" : "Only the tray icon shows on startup", "startHidden"))}
            ${D(R(I.layers, isMac() ? "Keep running when closed" : "Close to tray", isMac() ? "Closing the window keeps MSK in the menu bar" : "The X button keeps MSK running in the background", "closeToTray"))}
            ${R(I.moon, "Theme", "Black or white app look", "theme")}
            ${R(I.out, "Check for updates automatically", "Looks for a new version on GitHub every few hours", "autoUpdate")}
            ${R(I.refresh, "Check for updates", `You're on v${esc(S.version)}`, "checkUpd")}
            ${R(I.refresh, "Auto-rotate configs", 'Cycles configs marked "Rotate" (all of them if none are)', "rotEnabled")}
            ${R(I.clock, "Rotate every", "Minutes between switches", "rotMins")}
          </section>
          <section class="set-sec glass" id="sec-tv" style="--i:1"><h3>${I.chart}TradingView</h3>
            <div class="tv-hero" id="tv-hero"></div>
            ${EXT ? `<div class="faint" style="font-size:12.5px;padding:6px 0 14px">MSK runs on every tradingview.com chart tab in this browser. Changes show up instantly, no restart needed.</div>` : ""}
            ${EXT ? "" : `${R(I.play, "Open TradingView with MSK", "Starts it hooked whenever MSK starts", "autoLaunchTV")}
            ${isMac() ? "" : R(I.bolt, "Launch method", "Auto tries the package way first, then a private copy", "method")}
            ${R(I.plug, "Hook port", "Change only if another app already uses it", "port")}
            <div class="set-row col" data-q="app location path tradingview exe detect browse"><span class="row-ico">${I.folder}</span>
              <div class="t"><b>App location</b><small>Leave on auto unless MSK can't find TradingView</small></div>
              <div class="path" id="s-path">${esc(s.tvPath || "Auto-detect")}</div>
              <div class="row wrap"><button class="btn glass bubble sm" data-act="detect">${I.search}Detect</button><button class="btn glass bubble sm" data-act="browse">${I.folder}Browse</button><button class="btn ghost sm" data-act="clearPath">Use auto</button></div></div>
            ${isMac() ? "" : R(I.plus, "Desktop shortcut", '"TradingView (MSK)" opens it already hooked', "shortcut")}
            ${isMac() ? "" : R(I.refresh, "Refresh MSK's TradingView copy", "Only matters if the copy method is used", "resetCopy")}`}
          </section>
          <section class="set-sec glass" id="sec-fx" style="--i:2"><h3>${I.wand}Animations</h3>
            ${R(I.wand, "Animations on", "Master switch for every config's FX", "fxOn")}
            ${R(I.bolt, "Chart color speed", "How often animated candle colors update on TradingView. Lower is lighter on your computer.", "fxFps")}
          </section>
          <section class="set-sec glass" id="sec-keys" style="--i:3"><h3>${I.keyboard}Hotkeys</h3>
            <div class="faint" style="font-size:12px;margin:-4px 0 6px">${EXT ? "Chrome shortcuts. Change them on Chrome's shortcuts page." : `Work anywhere ${isMac() ? "on your Mac" : "in Windows"}. Click a shortcut, press the new keys. Backspace clears it.`}</div>
            ${R(I.power, "Toggle background", "Turns your background on or off", "hk-toggle")}
            ${R(I.next, "Next config", "Jumps to the next config", "hk-next")}
            ${R(I.wand, "Pause animations", "Freezes all FX instantly", "hk-fx")}
            ${R(I.search, "Command palette", "Inside MSK only", "hk-pal")}
            ${EXT ? R(I.keyboard, "Change shortcuts", "Opens Chrome's extension shortcuts page", "hk-edit") : ""}
          </section>
          ${EXT ? "" : `<section class="set-sec glass" id="sec-debug" style="--i:4"><h3>${I.bug}Debug</h3>
            ${R(I.eye, "Show logs", "Shows the Logs page in the sidebar", "showLogs")}
            ${R(I.list, "Verbose logging", "Logs every detail. Turn on when something's off.", "verbose")}
            ${isMac() ? "" : R(I.search, "Watch processes", "Logs TradingView and ChartSkins processes, ports and connections", "watch")}
            ${R(I.list, "Open logs", "Live log viewer with filters", "openLogs")}
            ${R(I.folder, "Log file", "msk.log in your MSK data folder", "logFile")}
            ${R(I.search, "Run diagnostics", "Checks the whole hook chain and writes it to the log", "diag")}
            ${R(I.play, "Launch test", "Starts TradingView 3 ways to see what makes it quit (about 50s)", "test")}
            ${R(I.trash, "Kill all related processes", isMac() ? "Every TradingView process plus anything holding the hook port" : "Every TradingView.exe plus anything holding the hook port", "kill")}
          </section>`}
          <section class="set-sec glass" id="sec-data" style="--i:5"><h3>${I.folder}Data</h3>
            ${EXT ? R(I.folder, "Storage", "Media and configs are stored inside this browser profile. Export configs to move them to the desktop app.", "data") : R(I.folder, "Data folder", esc(S.dataDir || ""), "data")}
            ${R(I.image, "Library", `${S.media.length} item${S.media.length === 1 ? "" : "s"} · ${S.configs.length} config${S.configs.length === 1 ? "" : "s"}`, "libStat")}
            ${R(I.refresh, "Restart MSK", "Reloads the app, e.g. after an update", "restart")}
            ${R(I.trash, "Reset MSK", "Deletes all media and configs. Can't be undone.", "reset")}
            <div class="about"><div class="about-wm">${WORDMARK}</div><div><b>MSK ${esc(S.version)}${isExt() ? " · Chrome extension" : ""}</b><div class="faint" style="font-size:12px">Private build · no account · everything stays on this ${isExt() ? "browser" : "PC"}</div></div></div>
          </section>
          <div class="faint none-found" style="display:none;padding:30px;text-align:center">No settings match that.</div>
        </div></div>`;

      // controls
      const C = {};
      const put = (id, node) => { const ph = $(`[data-c="${id}"]`, v); if (ph) ph.replaceWith(node); C[id] = node; };
      const setSw = (key) => sw(!!S.settings[key], (on) => api.settings({ [key]: on }));
      put("startup", setSw("startup")); put("startHidden", setSw("startHidden")); put("closeToTray", setSw("closeToTray"));
      put("theme", seg([["dark", "Black"], ["light", "White"]], s.theme, (t) => api.settings({ theme: t })));
      put("autoUpdate", sw(s.autoUpdate !== false, (on) => api.settings({ autoUpdate: on })));
      put("checkUpd", btn(`${I.refresh}Check now`, "glass bubble", async () => {
        toast("Checking GitHub...");
        const r = await api.update.check();
        if (r.status === "available") { toast(`v${r.version} is available`); go("home"); }
        else if (r.status === "latest") toast("You're on the latest version");
        else if (r.status === "none") toast("No releases on GitHub yet", "warn");
        else toast("Couldn't reach GitHub", "warn");
      }));
      put("rotEnabled", sw(s.rotation.enabled, (on) => api.settings({ rotation: { enabled: on } })));
      put("rotMins", stepper(s.rotation.minutes, 1, 240, 1, "min", (n) => api.settings({ rotation: { minutes: n } })));
      put("autoLaunchTV", setSw("autoLaunchTV"));
      put("method", seg([["auto", "Auto"], ["package", "Package"], ["copy", "Copy"]], s.launchMethod || "auto", (m) => api.settings({ launchMethod: m })));
      put("port", stepper(s.port, 1025, 65534, 1, "", (n) => api.settings({ port: n })));
      put("shortcut", btn(`${I.plus}Add`, "glass bubble", async () => { const r = await api.tv.shortcut(); toast(r.message, r.ok ? "ok" : "warn"); }));
      put("resetCopy", btn(`${I.refresh}Refresh`, "ghost", async () => { if (await modal({ title: "Refresh the copy?", text: "TradingView will close. MSK rebuilds its copy next time it needs it.", ok: "Refresh" })) { await api.tv.resetCopy(); toast("Copy cleared"); } }));
      put("fxOn", sw(!S.fxPaused, (on) => api.fxPause(!on)));
      put("fxFps", seg([["6", "Light"], ["11", "Normal"], ["20", "Smooth"]], String(s.fxFps || 11), (f) => api.settings({ fxFps: +f })));
      for (const k of ["toggle", "next", "fx"]) put("hk-" + k, EXT ? el(`<span class="keys">${keycaps(S.settings.hotkeys[k])}</span>`) : hotkeyBox(k));
      if (EXT) put("hk-edit", btn("Open", "glass bubble", () => api.tv.shortcuts()));
      put("hk-pal", el(`<span class="keys">${keycaps(isMac() ? "CommandOrControl+K" : "Ctrl+K")}</span>`));
      put("showLogs", sw(s.showLogs !== false, (on) => api.settings({ showLogs: on })));
      put("verbose", sw(info.verbose, (on) => api.logs.verbose(on)));
      put("watch", sw(info.watching, async (on) => { const r = await api.watch(on); if (on && !r) toast("Watcher only works on Windows", "warn"); }));
      put("openLogs", btn("Open", "glass bubble", () => go("logs")));
      put("logFile", btn(`${I.folder}Show`, "ghost", () => api.logs.open()));
      put("diag", btn(`${I.search}Run`, "glass bubble", async () => { toast("Running diagnostics..."); await api.tv.diagnose(); toast("Diagnostics written to the log"); }));
      put("test", btn(`${I.play}Run`, "glass bubble", async () => { if (await modal({ title: "Run launch test?", text: "Closes TradingView, then opens it 3 times for ~12s each. Takes about 50 seconds.", ok: "Run test" })) { toast("Launch test running..."); await api.tv.test(); toast("Launch test done, check Logs"); } }));
      put("kill", btn(`${I.trash}Kill all`, "kill", () => killAll()));
      if (!EXT) put("data", btn(`${I.folder}Open`, "glass bubble", () => api.app.openData()));
      put("libStat", btn("Library", "ghost", () => go("library")));
      put("restart", btn(`${I.refresh}Restart`, "glass bubble", () => api.app.restart()));
      put("reset", btn(`${I.trash}Reset`, "ghost danger", async () => { if (await api.app.reset()) { W.draft = null; toast("MSK reset"); } }));

      v.addEventListener("click", async (e) => {
        const a = e.target.closest("[data-act]"); if (!a) return;
        const act = a.dataset.act;
        if (act === "detect") { const d = await api.tv.detect(); $("#s-path").textContent = d ? `${TV_KIND[d.kind] || d.kind}\n${d.path}${d.copy ? "\nMSK copy: " + d.copy : ""}` : "Not found. Use Browse."; toast(d ? "Found TradingView" : "TradingView not found", d ? "ok" : "warn"); }
        if (act === "browse") { const p = await api.tv.browse(); if (p) $("#s-path").textContent = p; }
        if (act === "clearPath") { api.settings({ tvPath: "" }); $("#s-path").textContent = "Auto-detect"; }
        if (act === "launch") launchTV(a.dataset.restart === "1");
      });

      // tabs: jump + scrollspy
      const tabs = $("#set-tabs", v), view = $("#view");
      const placeTab = (k) => {
        SET.tab = k;
        const b = $(`button[data-sec="${k}"]`, tabs); if (!b) return;
        $$("button", tabs).forEach((x) => x.classList.toggle("on", x === b));
        const th = $(".thumb", tabs); th.style.width = b.offsetWidth + "px"; th.style.transform = `translateX(${b.offsetLeft}px)`;
      };
      tabs.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; const sec = $("#sec-" + b.dataset.sec, v); placeTab(b.dataset.sec); this.lock = Date.now(); view.scrollTo({ top: sec.offsetTop - 70, behavior: "smooth" }); };
      this.onScroll = () => {
        if (this.lock && Date.now() - this.lock < 700) return;
        let cur = SECTIONS[0][0];
        for (const [k] of SECTIONS) { const sec = $("#sec-" + k, v); if (sec && sec.style.display !== "none" && sec.offsetTop - 120 <= view.scrollTop) cur = k; }
        if (cur !== SET.tab) placeTab(cur);
      };
      view.addEventListener("scroll", this.onScroll, { passive: true });
      requestAnimationFrame(() => placeTab(SET.tab));

      // search
      const filter = () => {
        const q = SET.q.trim(); let any = false;
        for (const sec of $$(".set-sec", v)) {
          let n = 0;
          for (const r of $$(".set-row", sec)) { const hit = !q || r.dataset.q.includes(q); r.style.display = hit ? "" : "none"; if (hit) n++; }
          const tvHero = $(".tv-hero", sec); if (tvHero) tvHero.style.display = q ? "none" : "";
          sec.style.display = n || !q ? "" : "none"; if (n) any = true;
        }
        $(".none-found", v).style.display = any || !q ? "none" : "";
      };
      $(".search input", v).oninput = (e) => { SET.q = e.target.value.toLowerCase(); filter(); };
      filter();
      this.update();
    },
    update() {
      const h = $("#tv-hero"); if (!h) return;
      const t = tvInfo(), st = S.tv || {};
      h.innerHTML = `<div class="status-orb"><span class="dot ${t.dot}"></span></div>
        <div class="grow"><div class="status-title" style="font-size:18px">${t.title}</div><div class="muted" style="font-size:12.5px">${esc(t.sub)}</div></div>
        <div class="tv-stats">${isExt() ? "" : `<span><small>Port</small><b>${st.status === "connected" ? (st.port || S.settings.port) : S.settings.port}</b></span>`}<span><small>${isExt() ? "Tabs" : "Windows"}</small><b>${st.windows || 0}</b></span></div>
        ${t.btn ? `<button class="btn ${t.btn[1] ? "miku" : "solid"} sm" data-act="launch" data-restart="${t.btn[1] ? 1 : 0}">${I.play}${t.btn[0]}</button>` : isExt() ? `<button class="btn ghost sm" data-act="launch">${I.plus}New chart tab</button>` : `<button class="btn ghost sm" data-act="launch" data-restart="1">${I.refresh}Restart</button>`}`;
      const lib = $('[data-q^="library"] small'); if (lib) lib.textContent = `${S.media.length} item${S.media.length === 1 ? "" : "s"} · ${S.configs.length} config${S.configs.length === 1 ? "" : "s"}`;
    },
    leave() { if (this.onScroll) $("#view").removeEventListener("scroll", this.onScroll); },
  };
  function btn(html, cls, fn) { const b = el(`<button class="btn sm ${cls}">${html}</button>`); b.onclick = fn; return b; }
  function stepper(val, min, max, step, unit, onChange) {
    const w = el(`<div class="stepper"><button data-d="-1">−</button><input class="mono" value="${val}" /><span class="u">${unit}</span><button data-d="1">+</button></div>`);
    const inp = $("input", w);
    const commit = (n) => { n = Math.max(min, Math.min(max, Math.round(n / step) * step)); inp.value = n; onChange(n); };
    w.onclick = (e) => { const b = e.target.closest("button"); if (b) commit((parseFloat(inp.value) || min) + step * +b.dataset.d); };
    inp.onchange = () => commit(parseFloat(inp.value) || min);
    if (!unit) $(".u", w).remove();
    return w;
  }
  function hotkeyBox(key) {
    const box = el(`<button class="hotkey" title="Click, then press keys">${keycaps(S.settings.hotkeys[key])}</button>`);
    box.onclick = () => {
      box.classList.add("rec"); box.innerHTML = `<span class="faint">Press keys...</span>`;
      const done = () => { box.classList.remove("rec"); window.removeEventListener("keydown", onKey, true); box.innerHTML = keycaps(S.settings.hotkeys[key]); };
      const onKey = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
        if (e.key === "Escape") return done();
        if (e.key === "Backspace") { api.settings({ hotkeys: { [key]: "" } }); S.settings.hotkeys[key] = ""; return done(); }
        const parts = [];
        if (isMac() ? e.metaKey : e.ctrlKey) parts.push("CommandOrControl");
        if (isMac() && e.ctrlKey) parts.push("Control");
        if (e.altKey) parts.push("Alt"); if (e.shiftKey) parts.push("Shift");
        const k = e.code.startsWith("Key") ? e.code.slice(3) : e.code.startsWith("Digit") ? e.code.slice(5) : /^F\d+$/.test(e.key) ? e.key : null;
        if (!k || !parts.length) return;
        const acc = [...parts, k].join("+");
        S.settings.hotkeys[key] = acc; api.settings({ hotkeys: { [key]: acc } }); toast("Hotkey saved"); done();
      };
      window.addEventListener("keydown", onKey, true);
      box.addEventListener("blur", done, { once: true });
    };
    return box;
  }

  // LOGS
  let LOGS = [], logInfo = { verbose: false, file: "" };
  const LG = { level: "all", q: "", follow: true };
  const RANK = { debug: 0, info: 1, warn: 2, error: 3 };
  const showLine = (e) => (LG.level === "all" || RANK[e.level] >= RANK[LG.level]) && (!LG.q || (e.msg + " " + (e.data || "") + " " + e.src).toLowerCase().includes(LG.q));
  const lineHTML = (e) => {
    const d = new Date(e.t), ts = d.toTimeString().slice(0, 8) + "." + String(d.getMilliseconds()).padStart(3, "0");
    return `<div class="log-line ${e.level}"><span class="ts">${ts}</span><span class="lv ${e.level}">${e.level.toUpperCase()}</span><span class="src">${esc(e.src)}</span><span class="msg">${esc(e.msg)}${e.data ? `<span class="dat">${esc(e.data)}</span>` : ""}</span></div>`;
  };
  async function killAll() {
    if (!(await modal({ title: "Kill everything?", text: "Closes TradingView (normal and MSK's copy) and anything holding the hook port.", ok: "Kill all", danger: true }))) return;
    const k = await api.tv.kill();
    toast(k && k.length ? `Killed ${k.length} process${k.length > 1 ? "es" : ""}` : "Nothing was running");
  }
  pages.logs = {
    async mount(v) {
      v.innerHTML = `<div class="page">
        <div class="page-head"><div class="left"><div class="eyebrow">Debug</div><h2 class="title">Logs</h2></div>
          <div class="row"><button class="btn ghost" data-act="dev">DevTools</button><button class="btn glass bubble" data-act="test">${I.play}Launch test</button><button class="btn glass bubble" data-act="diag">${I.search}Run diagnostics</button><button class="btn kill" data-act="kill">${I.trash}Kill all related</button></div></div>
        <div class="toolbar"><span id="g-seg"></span>
          <label class="search glass">${I.search}<input placeholder="Filter logs" value="${esc(LG.q)}" /></label>
          <span class="grow"></span>
          <label class="row" style="gap:8px;font-size:12.5px;color:var(--fg-2)">Watch processes<span id="g-watch"></span></label>
          <label class="row" style="gap:8px;font-size:12.5px;color:var(--fg-2)">Verbose<span id="g-verb"></span></label>
          <button class="btn ghost sm" data-act="copy">${I.copy}Copy</button>
          <button class="btn ghost sm" data-act="file">${I.folder}Log file</button>
          <button class="btn ghost sm" data-act="clear">${I.trash}Clear</button></div>
        <div class="log-box glass" id="g-box"></div>
        <div class="faint" style="font-size:12px;margin-top:10px" id="g-file"></div></div>`;
      $("#g-seg", v).replaceWith(seg([["all", "All"], ["info", "Info+"], ["warn", "Warnings"], ["error", "Errors"]], LG.level, (l) => { LG.level = l; this.render(); }));
      $(".search input", v).oninput = (e) => { LG.q = e.target.value.toLowerCase(); this.render(); };
      const box = $("#g-box", v);
      box.addEventListener("scroll", () => { LG.follow = box.scrollTop + box.clientHeight >= box.scrollHeight - 30; });
      v.addEventListener("click", async (e) => {
        const a = e.target.closest("[data-act]"); if (!a) return;
        const act = a.dataset.act;
        if (act === "kill") killAll();
        if (act === "diag") { toast("Running diagnostics..."); await api.tv.diagnose(); }
        if (act === "test") { if (await modal({ title: "Run launch test?", text: "Closes TradingView, then opens it 3 times for ~12s each to see what makes it quit. Takes about 50 seconds.", ok: "Run test" })) { toast("Launch test running..."); await api.tv.test(); toast("Launch test done"); } }
        if (act === "copy") { const txt = LOGS.filter(showLine).map((x) => `${new Date(x.t).toISOString()} ${x.level.toUpperCase()} [${x.src}] ${x.msg}${x.data ? " | " + x.data : ""}`).join("\n"); await navigator.clipboard.writeText(txt); toast("Logs copied"); }
        if (act === "file") api.logs.open();
        if (act === "clear") { await api.logs.clear(); LOGS = []; this.render(); }
        if (act === "dev") api.app.devtools();
      });
      const info = await api.logs.get();
      logInfo = info; LOGS = info.lines;
      $("#g-verb", v).replaceWith(sw(info.verbose, (on) => api.logs.verbose(on)));
      $("#g-watch", v).replaceWith(sw(info.watching, async (on) => { const r = await api.watch(on); if (on && !r) toast("Watcher only works on Windows", "warn"); }));
      $("#g-file", v).textContent = `Log file: ${info.file}${info.debug ? "  ·  debug mode" : ""}`;
      this.render();
    },
    render() {
      const box = $("#g-box"); if (!box) return;
      box.innerHTML = LOGS.filter(showLine).slice(-1500).map(lineHTML).join("") || `<div class="faint" style="padding:20px">No logs yet.</div>`;
      box.scrollTop = box.scrollHeight; LG.follow = true;
    },
    append(batch) {
      const box = $("#g-box"); if (!box) return;
      const html = batch.filter(showLine).map(lineHTML).join(""); if (!html) return;
      if (box.firstElementChild && box.firstElementChild.classList.contains("faint")) box.innerHTML = "";
      box.insertAdjacentHTML("beforeend", html);
      while (box.children.length > 1500) box.firstElementChild.remove();
      if (LG.follow) box.scrollTop = box.scrollHeight;
    },
    update() {},
  };

  // ---------- command palette (Ctrl+K) ----------
  function palette() {
    if ($(".pal-scrim")) return;
    const items = () => [
      ...S.configs.map((c) => ({ g: "Apply config", label: c.name, hint: c.id === S.activeConfigId ? "Active" : c.bg.mode === "behind" ? "Behind" : "Overlay", icon: I.layers, run: () => { api.config.activate(c.id); toast(`${c.name} applied`); } })),
      ...S.configs.map((c) => ({ g: "Edit config", label: "Edit " + c.name, icon: I.edit, run: () => go("workshop", { configId: c.id }) })),
      ...[["home", "Home", I.home], ["library", "Library", I.image], ["workshop", "Workshop", I.wand], ["configs", "Configs", I.layers], ["logs", "Logs", I.list], ["settings", "Settings", I.keyboard]]
        .filter(([p]) => !(isExt() && p === "logs")).map(([p, l, ic]) => ({ g: "Go to", label: l, icon: ic, run: () => go(p) })),
      { g: "Actions", label: S.enabled ? "Turn background off" : "Turn background on", icon: I.power, run: () => api.setEnabled(!S.enabled) },
      { g: "Actions", label: S.fxPaused ? "Resume animations" : "Pause animations", icon: I.wand, run: () => api.fxPause(!S.fxPaused) },
      { g: "Actions", label: "Next config", icon: I.next, run: () => api.config.next() },
      { g: "Actions", label: "Add media", icon: I.upload, run: () => importMedia() },
      { g: "Actions", label: "New config", icon: I.plus, run: () => go("workshop", { fresh: true }) },
      { g: "Actions", label: "Launch / restart TradingView", icon: I.play, run: () => launchTV((S.tv || {}).status === "no-hook") },
      ...(isExt() ? [] : [{ g: "Actions", label: "Kill all TradingView processes", icon: I.trash, run: () => killAll() }]),
      { g: "Actions", label: "Restart MSK", icon: I.refresh, run: () => api.app.restart() },
      { g: "Actions", label: S.update ? `Download update v${S.update.version}` : "Check for updates", icon: I.out, run: () => (S.update ? api.update.open() : api.update.check().then((r) => toast(r.status === "available" ? `v${r.version} is available` : r.status === "latest" ? "You're on the latest version" : "Couldn't check right now", r.status === "error" ? "warn" : "ok"))) },
      ...(isExt() ? [] : [{ g: "Actions", label: "Run diagnostics", icon: I.search, run: () => { api.tv.diagnose(); go("logs"); } }]),
      { g: "Actions", label: S.settings.theme === "dark" ? "Switch to white theme" : "Switch to black theme", icon: I.moon, run: () => api.settings({ theme: S.settings.theme === "dark" ? "light" : "dark" }) },
    ];
    const m = el(`<div class="pal-scrim"><div class="cmdk glass"><label class="pal-in">${I.search}<input placeholder="Type a config, page or action..." /><kbd>Esc</kbd></label><div class="pal-list"></div></div></div>`);
    const inp = $("input", m), list = $(".pal-list", m);
    let shown = [], sel = 0;
    const score = (t, q) => { t = t.toLowerCase(); if (!q) return 1; if (t.startsWith(q)) return 3; if (t.includes(q)) return 2; let i = 0; for (const ch of t) if (ch === q[i]) i++; return i === q.length ? 1 : 0; };
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      shown = items().map((x) => ({ ...x, s: score(x.label + " " + x.g, q) })).filter((x) => x.s).sort((a, b) => b.s - a.s).slice(0, 40);
      if (!q) shown = shown.filter((x) => x.g !== "Edit config");
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      let lastG = "";
      list.innerHTML = shown.map((x, i) => { const head = x.g !== lastG && !q ? `<div class="pal-g">${x.g}</div>` : ""; lastG = x.g; return `${head}<button class="pal-item ${i === sel ? "on" : ""}" data-i="${i}">${x.icon}<span class="grow">${esc(x.label)}</span>${x.hint ? `<small>${esc(x.hint)}</small>` : ""}</button>`; }).join("") || `<div class="faint" style="padding:16px">Nothing found.</div>`;
      const on = $(".pal-item.on", list); if (on) on.scrollIntoView({ block: "nearest" });
    };
    const close = () => { m.classList.add("out"); setTimeout(() => m.remove(), 180); };
    const run = (i) => { const x = shown[i]; if (!x) return; close(); x.run(); };
    inp.oninput = () => { sel = 0; draw(); };
    m.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); draw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (e.key === "Enter") run(sel);
    });
    list.onclick = (e) => { const b = e.target.closest(".pal-item"); if (b) run(+b.dataset.i); };
    list.onmousemove = (e) => { const b = e.target.closest(".pal-item"); if (b && +b.dataset.i !== sel) { sel = +b.dataset.i; $$(".pal-item", list).forEach((x) => x.classList.toggle("on", x === b)); } };
    m.addEventListener("pointerdown", (e) => { if (e.target === m) close(); });
    document.body.appendChild(m); draw(); inp.focus();
  }

  const TV_KIND = { custom: "Custom path", classic: "Classic installer", msixcore: "MSIX Core install", msix: "tradingview.com / Microsoft package" };
  function hkShow(a) {
    if (!a) return "None";
    return isMac() ? a.replace("CommandOrControl", "⌘").replace("Control", "⌃").replace("Alt", "⌥").replace("Shift", "⇧") : a.replace("CommandOrControl", "Ctrl");
  }

  // ---------- router ----------
  function placeBlob() {
    const b = $(`#nav button[data-page="${page}"]`); if (!b) return;
    $$("#nav button").forEach((x) => x.classList.toggle("active", x === b));
    $(".nav-blob").style.transform = `translateY(${b.offsetTop}px)`;
  }
  let navT;
  function go(name, opts) {
    if (name === page && !opts) return;
    const v = $("#view");
    const old = $(".page", v);
    if (cur && cur.leave) cur.leave();
    page = name; placeBlob();
    clearTimeout(navT);
    const mount = () => { v.innerHTML = ""; v.scrollTop = 0; const host = document.createElement("div"); v.appendChild(host); cur = pages[name]; cur.mount(host, opts); };
    if (old) { old.classList.add("out"); navT = setTimeout(mount, 170); } else mount();
  }

  // ---------- global chrome ----------
  function renderChrome() {
    document.documentElement.dataset.theme = S.settings.theme;
    const up = $("#upd-pill");
    if (up) { up.hidden = !S.update; if (S.update) $("#upd-text").textContent = `Update v${S.update.version}`; }
    const lb = $('#nav button[data-page="logs"]'), showLogs = S.settings.showLogs !== false;
    if (lb && lb.hidden === showLogs) { lb.hidden = !showLogs; requestAnimationFrame(placeBlob); }
    const c = activeCfg(), np = $("#np");
    if (c && np) {
      const m = c.bg.mediaId && findMedia(c.bg.mediaId);
      $(".np-thumb", np).style.backgroundImage = m && m.hasThumb ? `url('${thumbURL(m)}')` : `linear-gradient(135deg, ${c.chart.up} 50%, ${c.chart.down} 50%)`;
      $(".np-name", np).textContent = c.name;
      $(".np-sub", np).textContent = `${c.bg.mode === "behind" ? "Behind" : "Overlay"}${MSK_FX.active(c).any ? (S.fxPaused ? " · FX paused" : " · FX") : ""}`;
    }
    $("#master").checked = !!S.enabled;
    $("#master-sub").textContent = S.enabled ? "On" : "Off";
    const t = tvInfo();
    $("#tv-pill .dot").className = "dot " + t.dot;
    $("#tv-text").textContent = `TradingView · ${t.title}`;
  }

  async function boot() {
    S = await api.state();
    if (isExt()) { document.body.classList.add("ext"); document.title = "MSK Studio"; }
    if (isMac()) { document.body.classList.add("mac"); const k = $("#pal-btn kbd"); if (k) k.textContent = "⌘K"; }
    $("#wm-small").innerHTML = WORDMARK;
    renderChrome();
    $$("#nav button").forEach((b) => (b.onclick = () => go(b.dataset.page)));
    $("#master").onchange = (e) => api.setEnabled(e.target.checked);
    $("#np-next").onclick = (e) => { e.stopPropagation(); api.config.next(); };
    $("#np").onclick = () => go("workshop", { configId: S.activeConfigId });
    $("#pal-btn").onclick = () => palette();
    $("#upd-pill").onclick = () => go("home");
    window.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette(); } });
    $("#theme-btn").onclick = () => api.settings({ theme: S.settings.theme === "dark" ? "light" : "dark" });
    $("#w-min").onclick = api.win.min; $("#w-max").onclick = api.win.max; $("#w-close").onclick = api.win.close;
    $("#tv-pill").onclick = () => { const st = (S.tv || {}).status; if (st === "offline" || st === "no-hook") launchTV(st === "no-hook"); else go("home"); };
    api.onState((s) => {
      S = s; renderChrome(); queueThumbs();
      if (cur && cur.update) { try { cur.update(); } catch (e) { console.error(e); } }
    });
    api.onToast((t) => toast(t.text, t.kind));
    api.logs.on((batch) => { LOGS.push(...batch); if (LOGS.length > 3000) LOGS = LOGS.slice(-3000); if (page === "logs") pages.logs.append(batch); });
    api.onNav((p) => go(p));
    // drag and drop anywhere
    let depth = 0;
    window.addEventListener("dragenter", (e) => { if ([...(e.dataTransfer.types || [])].includes("Files")) { depth++; $("#drop").classList.add("on"); } });
    window.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; $("#drop").classList.remove("on"); } });
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", async (e) => {
      e.preventDefault(); depth = 0; $("#drop").classList.remove("on");
      const paths = [...e.dataTransfer.files].map((f) => api.pathFor(f)).filter(Boolean);
      if (paths.length) { const added = await importMedia(paths); if (!added.length) toast("Only images and videos can be added", "warn"); }
    });
    window.addEventListener("resize", placeBlob);
    go("home");
    requestAnimationFrame(placeBlob);
    queueThumbs();
  }
  window.addEventListener("error", (e) => api.logs.ui("error", e.message, `${e.filename}:${e.lineno}`));
  window.addEventListener("unhandledrejection", (e) => api.logs.ui("error", "Unhandled promise", String(e.reason && e.reason.stack || e.reason)));
  boot();
})();
