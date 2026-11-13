// Process watcher (Windows): logs TradingView processes, their launch commands,
// listening ports and local connections between them. Only logs changes.
const { spawn } = require("child_process");
const LOG = require("./log");
const log = LOG.scoped("watch");

const PS = `
$ErrorActionPreference = 'SilentlyContinue'
while ($true) {
  $all = Get-CimInstance Win32_Process
  $hit = $all | Where-Object { $_.Name -match 'tradingview' -or $_.ExecutablePath -match 'tradingview' }
  $ids = @($hit | ForEach-Object { $_.ProcessId })
  $names = @{}; foreach ($x in $all) { $names[[string]$x.ProcessId] = $x.Name }
  $procs = @($hit | ForEach-Object { [pscustomobject]@{ pid = $_.ProcessId; ppid = $_.ParentProcessId; parent = $names[[string]$_.ParentProcessId]; name = $_.Name; exe = $_.ExecutablePath; cmd = $_.CommandLine } })
  $listen = @(Get-NetTCPConnection -State Listen | Where-Object { $ids -contains $_.OwningProcess } | ForEach-Object { [pscustomobject]@{ pid = $_.OwningProcess; addr = $_.LocalAddress; port = $_.LocalPort } })
  $conns = @(Get-NetTCPConnection -State Established | Where-Object { ($ids -contains $_.OwningProcess) -and ($_.RemoteAddress -eq '127.0.0.1' -or $_.RemoteAddress -eq '::1') } | ForEach-Object { [pscustomobject]@{ pid = $_.OwningProcess; lport = $_.LocalPort; rport = $_.RemotePort } })
  $pipes = @(Get-ChildItem -Path '\\\\.\\pipe\\' | Where-Object { $_.Name -match 'tradingview' } | Select-Object -First 40 | ForEach-Object { $_.Name })
  [pscustomobject]@{ procs = $procs; listen = $listen; conns = $conns; pipes = $pipes } | ConvertTo-Json -Depth 4 -Compress
  Start-Sleep -Milliseconds 1500
}`;

let child = null, buf = "", prev = { procs: new Map(), listen: new Set(), conns: new Set(), pipes: new Set() };
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

function handle(snap) {
  const procs = new Map(arr(snap.procs).map((p) => [String(p.pid), p]));
  for (const [pid, p] of procs) if (!prev.procs.has(pid)) log.info(`NEW ${p.name} (${pid}) parent ${p.parent || "?"} (${p.ppid})`, { exe: p.exe, cmd: p.cmd });
  for (const [pid, p] of prev.procs) if (!procs.has(pid)) log.info(`GONE ${p.name} (${pid})`);
  const nameOf = (pid) => (procs.get(String(pid)) || prev.procs.get(String(pid)) || {}).name || "pid " + pid;
  const listen = new Set(arr(snap.listen).map((l) => `${nameOf(l.pid)} (${l.pid}) listening on ${l.addr}:${l.port}`));
  for (const l of listen) if (!prev.listen.has(l)) log.info("PORT " + l);
  for (const l of prev.listen) if (!listen.has(l)) log.info("PORT closed: " + l);
  const conns = new Set(arr(snap.conns).map((c) => `${nameOf(c.pid)} (${c.pid}) -> localhost:${c.rport}`));
  for (const c of conns) if (!prev.conns.has(c)) log.info("CONN " + c);
  const pipes = new Set(arr(snap.pipes));
  const newPipes = [...pipes].filter((p) => !prev.pipes.has(p));
  if (newPipes.length) log.debug("New pipes", newPipes);
  prev = { procs, listen, conns, pipes };
}

function start() {
  if (child) return true;
  if (process.platform !== "win32") { log.warn("Process watcher only works on Windows"); return false; }
  prev = { procs: new Map(), listen: new Set(), conns: new Set(), pipes: new Set() };
  child = spawn("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", PS], { windowsHide: true });
  log.info("Process watcher ON (TradingView)");
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("{")) continue;
      try { handle(JSON.parse(line)); } catch (e) { log.debug("Watcher parse error", e.message); }
    }
  });
  child.stderr.on("data", (d) => log.debug("Watcher stderr", d.toString().slice(0, 300)));
  child.on("exit", (code) => { log.info(`Process watcher OFF (code ${code})`); child = null; });
  return true;
}
function stop() { if (child) { try { child.kill(); } catch {} child = null; } return false; }
const running = () => !!child;

module.exports = { start, stop, running };
