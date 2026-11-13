importScripts("common.js");
const ensureAlarm = () => { chrome.alarms.create("rotate", { periodInMinutes: 1 }); chrome.alarms.create("update", { periodInMinutes: 360 }); };
chrome.runtime.onInstalled.addListener(async () => { await MSKX.load(); ensureAlarm(); checkUpdate(); });
chrome.runtime.onStartup.addListener(async () => { await chrome.storage.local.set({ preview: null }); ensureAlarm(); checkUpdate(); });

// ---------- updates: compare our version with manifest.json on GitHub ----------
const REPO = "meeshyweeshy/msk-extension";
const newer = (a, b) => { const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0), pb = String(b).split(".").map((n) => parseInt(n, 10) || 0); for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); } return false; };
async function checkUpdate(manual) {
  const d = await MSKX.load();
  if (!manual && d.settings.autoUpdate === false) return { status: "off" };
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/manifest.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return { status: "error" };
    const remote = (await r.json()).version, mine = chrome.runtime.getManifest().version;
    if (newer(remote, mine)) {
      await chrome.storage.local.set({ update: { version: remote, page: `https://github.com/${REPO}`, zip: `https://github.com/${REPO}/archive/refs/heads/main.zip`, howto: `https://github.com/${REPO}#-updating` }, lastUpdateCheck: Date.now() });
      chrome.action.setBadgeText({ text: "NEW" }); chrome.action.setBadgeBackgroundColor({ color: "#39C5BB" });
      if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: "#001a18" });
      return { status: "available", version: remote };
    }
    await chrome.storage.local.set({ update: null, lastUpdateCheck: Date.now() });
    chrome.action.setBadgeText({ text: "" });
    return { status: "latest", version: mine };
  } catch (e) { return { status: "error", error: String(e) }; }
}
chrome.runtime.onMessage.addListener((msg, _s, reply) => { if (msg && msg.type === "checkUpdate") { checkUpdate(true).then(reply); return true; } });
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === "update") return checkUpdate();
  if (a.name !== "rotate") return;
  const d = await MSKX.load(), r = d.settings.rotation;
  if (!r || !r.enabled || Date.now() - (d.lastRotate || 0) < Math.max(1, r.minutes) * 60000) return;
  await chrome.storage.local.set({ activeConfigId: MSKX.nextId(d, d.configs.filter((c) => c.rotate)), lastRotate: Date.now(), preview: null });
});
chrome.commands.onCommand.addListener(async (cmd) => {
  const d = await MSKX.load();
  if (cmd === "toggle-bg") chrome.storage.local.set({ enabled: !d.enabled });
  if (cmd === "next-config") chrome.storage.local.set({ activeConfigId: MSKX.nextId(d), lastRotate: Date.now(), preview: null });
  if (cmd === "toggle-fx") chrome.storage.local.set({ fxPaused: !d.fxPaused });
  if (cmd === "toggle-checklist") { const c = MSK_CHECK.normalize(d.settings.checklist); c.enabled = !c.enabled; chrome.storage.local.set({ settings: { ...d.settings, checklist: c } }); }
});
