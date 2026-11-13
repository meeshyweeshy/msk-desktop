(async () => {
  // custom UI colors (same settings as the Studio's Appearance section)
  function paint(a) {
    a = a || {}; const st = document.documentElement.style;
    const rgb = (h) => { h = String(h || "").replace("#", ""); return /^[0-9a-f]{6}$/i.test(h) ? [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) : null; };
    const acc = rgb(a.accent) || [57, 197, 187], glow = rgb(a.glow) || acc;
    st.setProperty("--acc", acc.join(",")); st.setProperty("--glow", glow.join(",")); st.setProperty("--miku", `rgb(${acc.join(",")})`);
    const L = acc.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s2, v, i) => s2 + v * [0.2126, 0.7152, 0.0722][i], 0);
    st.setProperty("--on-acc", L > 0.32 ? "#05110f" : "#ffffff");
    const bg = document.documentElement.dataset.theme === "light" ? a.bgLight : a.bgDark;
    if (bg && rgb(bg)) st.setProperty("--bg", bg); else st.removeProperty("--bg");
  }
  const $ = (s) => document.querySelector(s);
  $("#wm").innerHTML = window.MSK_WORDMARK || "";
  const thumbs = {};
  async function thumbURL(m) {
    if (!m || !m.hasThumb) return null;
    const k = m.id + ":" + (m.thumbRev || 0);
    if (!thumbs[k]) { const b = await MSKX.fget("thumb:" + m.id); thumbs[k] = b ? URL.createObjectURL(b) : null; }
    return thumbs[k];
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  async function render() {
    const d = await MSKX.load();
    document.documentElement.dataset.theme = d.settings.theme || "dark";
    paint(d.settings.appearance);
    $("#on").checked = !!d.enabled; $("#fx").checked = !d.fxPaused;
    $("#upd").hidden = !d.update; if (d.update) { $("#upd-v").textContent = "v" + d.update.version; $("#upd").onclick = () => chrome.tabs.create({ url: d.update.zip }); }
    const c = MSKX.activeConfig(d), media = (id) => d.media.find((m) => m.id === id);
    const bgOf = async (cfg) => { const u = await thumbURL(cfg.bg.mediaId && media(cfg.bg.mediaId)); return u ? `background-image:url('${u}')` : `background:linear-gradient(135deg, ${cfg.chart.up} 50%, ${cfg.chart.down} 50%)`; };
    $("#np-thumb").setAttribute("style", await bgOf(c));
    $("#np-name").textContent = c.name;
    $("#np-sub").textContent = `${c.bg.mode === "behind" ? "Behind chart" : "Overlay"}${(c.fx || []).some((a) => a.on) ? " · FX" : ""}${d.enabled ? "" : " · Off"}`;
    const rows = await Promise.all(d.configs.map(async (x, i) => `<button class="cfg ${x.id === d.activeConfigId ? "on" : ""}" data-id="${x.id}" style="--i:${i}"><span class="t" style="${await bgOf(x)}"></span><span class="n">${esc(x.name)}</span><small>${x.bg.mode === "behind" ? "Behind" : "Overlay"}</small></button>`));
    $("#list").innerHTML = rows.join("");
  }
  $("#on").onchange = (e) => chrome.storage.local.set({ enabled: e.target.checked });
  $("#fx").onchange = (e) => chrome.storage.local.set({ fxPaused: !e.target.checked });
  $("#next").onclick = async () => { const d = await MSKX.load(); chrome.storage.local.set({ activeConfigId: MSKX.nextId(d), lastRotate: Date.now(), preview: null }); };
  $("#list").onclick = (e) => { const b = e.target.closest(".cfg"); if (b) chrome.storage.local.set({ activeConfigId: b.dataset.id, lastRotate: Date.now(), preview: null }); };
  $("#np").onclick = (e) => { if (!e.target.closest("#next")) chrome.runtime.openOptionsPage(); };
  $("#studio").onclick = () => chrome.runtime.openOptionsPage();
  $("#chart").onclick = () => chrome.tabs.create({ url: "https://www.tradingview.com/chart/" });
  chrome.storage.onChanged.addListener((_c, a) => { if (a === "local") render(); });
  render();
})();
