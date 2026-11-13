// MSK logger: keeps the last lines in memory (for the Logs page) and writes them to
// %APPDATA%\MSK\logs\msk.log (rotates at 3 MB to msk.old.log).
const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

const bus = new EventEmitter();
const lines = [];
const MAX = 3000;
let file = null, verbose = false, seq = 0;

function init(dir, opts = {}) {
  const d = path.join(dir, "logs");
  fs.mkdirSync(d, { recursive: true });
  file = path.join(d, "msk.log");
  try { if (fs.statSync(file).size > 3 * 1024 * 1024) fs.renameSync(file, path.join(d, "msk.old.log")); } catch {}
  verbose = !!opts.verbose;
  write("info", "app", `---- MSK start (pid ${process.pid}) ----`);
  return d;
}

function fmtData(data) {
  if (data === undefined) return "";
  if (data instanceof Error) return data.stack || data.message;
  if (typeof data === "string") return data;
  try { return JSON.stringify(data, null, 0); } catch { return String(data); }
}

function write(level, src, msg, data) {
  if (level === "debug" && !verbose) return;
  const e = { id: ++seq, t: Date.now(), level, src, msg: String(msg), data: data === undefined ? undefined : fmtData(data) };
  lines.push(e); if (lines.length > MAX) lines.splice(0, lines.length - MAX);
  if (file) {
    const ts = new Date(e.t).toISOString().replace("T", " ").slice(0, 23);
    try { fs.appendFileSync(file, `${ts} ${level.toUpperCase().padEnd(5)} [${src}] ${e.msg}${e.data ? " | " + e.data : ""}\n`); } catch {}
  }
  bus.emit("line", e);
}

const scoped = (src) => ({
  debug: (m, d) => write("debug", src, m, d), info: (m, d) => write("info", src, m, d),
  warn: (m, d) => write("warn", src, m, d), error: (m, d) => write("error", src, m, d),
});

module.exports = {
  init, write, scoped, bus,
  all: () => lines.slice(),
  clear: () => { lines.length = 0; },
  setVerbose: (v) => { verbose = !!v; write("info", "app", `Verbose logging ${verbose ? "on" : "off"}`); },
  isVerbose: () => verbose,
  file: () => file,
};
