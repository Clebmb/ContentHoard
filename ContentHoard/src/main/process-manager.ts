import { spawn, type ChildProcess } from "node:child_process";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { BrowserWindow, shell } from "electron";
import { getAppDefinition, hoardApps } from "./app-registry";
import { buildLaunchEnvironment } from "./state";

export type AppStatus = {
  running: boolean;
  pid: number | null;
  startedAt: number | null;
  lastExitCode?: number | null;
};

const processes = new Map<string, ChildProcess>();
const statuses = new Map<string, AppStatus>(
  hoardApps.map((app) => [
    app.id,
    {
      running: false,
      pid: null,
      startedAt: null,
      lastExitCode: null
    }
  ])
);

const pidsFilePath = path.join(
  process.env.CONTENTHOARD_SHARED_STATE_PATH
    ? path.dirname(process.env.CONTENTHOARD_SHARED_STATE_PATH)
    : path.join(os.homedir(), ".contenthoard"),
  "running-pids.json"
);

const logsDirPath = path.join(
  process.env.CONTENTHOARD_SHARED_STATE_PATH
    ? path.dirname(process.env.CONTENTHOARD_SHARED_STATE_PATH)
    : path.join(os.homedir(), ".contenthoard"),
  "logs"
);

type PersistedPid = { pid: number; startedAt: number };

function readPersistedPids(): Record<string, PersistedPid> {
  try {
    const raw = readFileSync(pidsFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePersistedPids(pids: Record<string, PersistedPid | null>) {
  const cleaned: Record<string, PersistedPid> = {};
  for (const [appId, entry] of Object.entries(pids)) {
    if (entry) cleaned[appId] = entry;
  }
  mkdirSync(path.dirname(pidsFilePath), { recursive: true });
  writeFileSync(pidsFilePath, JSON.stringify(cleaned, null, 2), "utf8");
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function broadcastStatuses() {
  const snapshot = getStatuses();
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("contenthoard:statuses", snapshot);
  }
}

export function getStatuses() {
  return Object.fromEntries(statuses.entries());
}

export function launchApp(appId: string) {
  const app = getAppDefinition(appId);
  if (!app) throw new Error(`Unknown app: ${appId}`);
  if (!existsSync(app.path)) throw new Error(`${app.name} path does not exist: ${app.path}`);

  const existing = processes.get(appId);
  if (existing && !existing.killed) {
    statuses.set(appId, {
      running: true,
      pid: existing.pid ?? null,
      startedAt: statuses.get(appId)?.startedAt ?? Date.now(),
      lastExitCode: null
    });
    broadcastStatuses();
    return { ok: true, appId, status: statuses.get(appId) };
  }

  const command = app.windowCommand;
  const args = app.windowArgs;

  // Route child output to a per-app log file instead of discarding it, so
  // instant crashes are diagnosable (~/.contenthoard/logs/<appId>.log).
  mkdirSync(logsDirPath, { recursive: true });
  const logPath = path.join(logsDirPath, `${appId}.log`);
  const logFd = openSync(logPath, "a");
  writeSync(logFd, `\n===== ${new Date().toISOString()} — launch: ${command} ${args.join(" ")} =====\n`);

  // Node >= 18.20/20.12 (CVE-2024-27980) refuses to spawn .cmd/.bat files without a shell,
  // so Windows .cmd shims (npm.cmd, corepack.cmd) must go through cmd.exe.
  const needsShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
  let child: ChildProcess;
  try {
    child = spawn(command, args, {
      cwd: app.path,
      env: {
        ...process.env,
        COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
        ...buildLaunchEnvironment(appId)
      },
      stdio: ["ignore", logFd, logFd],
      shell: needsShell,
      detached: process.platform !== "win32",
      windowsHide: false
    });
  } catch (err) {
    closeSync(logFd);
    appendFileSync(logPath, `===== spawn failed: ${(err as Error).stack ?? err} =====\n`);
    statuses.set(appId, { running: false, pid: null, startedAt: null, lastExitCode: null });
    broadcastStatuses();
    throw err;
  }
  closeSync(logFd);

  processes.set(appId, child);
  statuses.set(appId, {
    running: true,
    pid: child.pid ?? null,
    startedAt: Date.now(),
    lastExitCode: null
  });

  const persisted = readPersistedPids();
  persisted[appId] = { pid: child.pid ?? 0, startedAt: Date.now() };
  writePersistedPids(persisted);

  child.once("exit", (code, signal) => {
    try {
      appendFileSync(logPath, `\n===== ${new Date().toISOString()} — exited code=${code} signal=${signal} =====\n`);
    } catch {
      /* best effort */
    }
    processes.delete(appId);
    statuses.set(appId, {
      running: false,
      pid: null,
      startedAt: null,
      lastExitCode: code
    });
    const current = readPersistedPids();
    delete current[appId];
    writePersistedPids(current);
    broadcastStatuses();
  });

  child.unref();
  broadcastStatuses();
  return { ok: true, appId, status: statuses.get(appId) };
}

export function restoreStatuses() {
  const persisted = readPersistedPids();
  for (const [appId, entry] of Object.entries(persisted)) {
    if (entry && isProcessAlive(entry.pid)) {
      statuses.set(appId, {
        running: true,
        pid: entry.pid,
        startedAt: entry.startedAt,
        lastExitCode: null
      });
    }
  }
  broadcastStatuses();
}

export function stopApp(appId: string) {
  const child = processes.get(appId);
  const status = statuses.get(appId);

  if (child) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], { stdio: "ignore", windowsHide: true });
    } else {
      try {
        process.kill(-child.pid!, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }
    return;
  }

  if (!status?.pid) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(status.pid), "/f", "/t"], { stdio: "ignore", windowsHide: true });
  } else {
    try {
      process.kill(-status.pid, "SIGTERM");
    } catch {
      try {
        process.kill(status.pid, "SIGTERM");
      } catch {
        /* process already gone */
      }
    }
  }

  statuses.set(appId, {
    running: false,
    pid: null,
    startedAt: null,
    lastExitCode: null
  });

  const persisted = readPersistedPids();
  delete persisted[appId];
  writePersistedPids(persisted);
  broadcastStatuses();
}

export async function revealApp(appId: string) {
  const app = getAppDefinition(appId);
  if (app) await shell.openPath(app.path);
}
