// MSK trading checklist: defaults and scoring. Shared by the app, the extension and the main process.
(function (root) {
  const DEFAULT = {
    enabled: false,
    title: "Pre-trade checklist",
    items: [
      { id: "htf", text: "Higher-timeframe bias agrees", pts: 2 },
      { id: "liq", text: "Liquidity taken first", pts: 2 },
      { id: "mss", text: "Clear shift in structure", pts: 2 },
      { id: "lvl", text: "Entry at a key level", pts: 1 },
      { id: "ses", text: "Inside my trading session", pts: 1 },
      { id: "news", text: "No big news in the next 30 min", pts: 1 },
      { id: "risk", text: "Stop set, risk within my limit", pts: 1 },
      { id: "rr", text: "Target gives at least 2R", pts: 1 },
    ],
    checked: [],
    checkedDay: "",
    autoReset: "day",
    showScore: true,
    scoreStyle: "points",
    minScore: 8,
    position: "tl",
    pos: null,
    collapsed: false,
    opacity: 1,
    scale: 1,
  };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  function normalize(c) {
    const out = { ...DEFAULT, ...(c || {}) };
    out.items = Array.isArray(out.items) ? out.items.filter((i) => i && i.id) : DEFAULT.items;
    const ids = new Set(out.items.map((i) => i.id));
    out.checked = (Array.isArray(out.checked) ? out.checked : []).filter((id) => ids.has(id));
    if (out.autoReset === "day" && out.checked.length && out.checkedDay !== today()) out.checked = [];
    return out;
  }
  function score(c, checked = c.checked) {
    const set = new Set(checked || []);
    let got = 0, total = 0;
    for (const it of c.items || []) { const p = Math.max(0, +it.pts || 0); total += p; if (set.has(it.id)) got += p; }
    const pct = total ? Math.round((got / total) * 100) : 0;
    const grade = pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 55 ? "C" : "D";
    const min = Math.max(0, +c.minScore || 0);
    return { got, total, pct, grade, min, ready: min > 0 ? got >= min : null };
  }
  // Apply something you did on the chart (tick, reset, collapse, drag) to the stored checklist.
  function applyEvent(c, ev) {
    c = normalize(c);
    if (Array.isArray(ev.checked)) { const ids = new Set(c.items.map((i) => i.id)); c.checked = ev.checked.filter((id) => ids.has(id)); c.checkedDay = today(); }
    if (typeof ev.collapsed === "boolean") c.collapsed = ev.collapsed;
    if (ev.pos && isFinite(ev.pos.x) && isFinite(ev.pos.y)) c.pos = { x: Math.min(0.97, Math.max(0, +ev.pos.x)), y: Math.min(0.97, Math.max(0, +ev.pos.y)) };
    return c;
  }
  const api = { DEFAULT, normalize, score, applyEvent, today };
  root.MSK_CHECK = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
