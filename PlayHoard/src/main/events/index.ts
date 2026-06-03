import { appVersion, defaultDownloadsPath, isStaging } from "@main/constants";
import { BrowserWindow, ipcMain } from "electron";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import "./auth";
import "./autoupdater";
import "./catalogue";
import "./cloud-save";
import "./download-sources";
import "./hardware";
import "./library";
import "./leveldb";
import "./misc";
import "./notifications";
import "./profile";
import "./themes";
import "./torrenting";
import "./user";
import "./user-preferences";
import "./library/transfer-game-files";

import { isPortableVersion } from "@main/helpers";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const corepackCommand = process.platform === "win32" ? "corepack.cmd" : "corepack";
const sharedStatePath = process.env.CONTENTHOARD_SHARED_STATE_PATH ||
  path.join(os.homedir(), ".contenthoard", "shared-state.json");
const workspaceRoot = path.resolve(process.cwd(), "..");
const hoardApps = [
  { id: "mediahoard", name: "MediaHoard", command: npmCommand, args: ["run", "desktop:dev"], cwd: path.join(workspaceRoot, "MediaHoard") },
  { id: "audiohoard", name: "AudioHoard", command: npmCommand, args: ["run", "dev"], cwd: path.join(workspaceRoot, "AudioHoard") },
  { id: "playhoard", name: "PlayHoard", command: corepackCommand, args: ["yarn", "dev"], cwd: path.join(workspaceRoot, "PlayHoard") },
];
const contentHoardApp = {
  command: npmCommand,
  args: ["run", "dev"],
  cwd: path.join(workspaceRoot, "ContentHoard"),
};
const contentHoardFocusPort = Number(process.env.CONTENTHOARD_FOCUS_PORT || "18334");

const readContentHoardState = () => {
  try {
    return JSON.parse(fs.readFileSync(sharedStatePath, "utf8"));
  } catch {
    return null;
  }
};

if (process.env.CONTENTHOARD === "1") {
  console.log("[contenthoard] watcher starting, sharedStatePath:", sharedStatePath);
  let lastMtime = 0;
  try { lastMtime = fs.statSync(sharedStatePath, { throwIfNoEntry: false })?.mtimeMs || 0; } catch { /* ignore */ }
  console.log("[contenthoard] initial lastMtime:", lastMtime, "exists:", fs.existsSync(sharedStatePath));
  setInterval(() => {
    try {
      const stat = fs.statSync(sharedStatePath, { throwIfNoEntry: false });
      if (!stat) {
        console.log("[contenthoard] shared-state.json does not exist yet");
        return;
      }
      if (stat.mtimeMs > lastMtime) {
        console.log("[contenthoard] detected change:", { lastMtime, newMtime: stat.mtimeMs });
        lastMtime = stat.mtimeMs;
        const state = readContentHoardState();
        console.log("[contenthoard] read state, has theme:", Boolean(state?.theme));
        if (state) {
          const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
          console.log("[contenthoard] window found:", Boolean(win));
          if (win) {
            win.webContents.send("contenthoard:shared-state-updated", state);
            console.log("[contenthoard] IPC sent: contenthoard:shared-state-updated");
          }
        }
      }
    } catch (err) { console.error("[contenthoard] watcher error:", err); }
  }, 2000);
}

const writeContentHoardState = (nextState: unknown) => {
  fs.mkdirSync(path.dirname(sharedStatePath), { recursive: true });
  fs.writeFileSync(sharedStatePath, JSON.stringify(nextState, null, 2), "utf8");
  return nextState;
};

const launchHoardApp = (appId: string) => {
  const target = hoardApps.find((candidate) => candidate.id === appId);
  if (!target || !fs.existsSync(target.cwd)) return false;
  const shared = readContentHoardState() as {
    activeProfileId?: string;
    profiles?: Array<{ id: string }>;
    theme?: unknown;
    savedThemes?: unknown;
  } | null;
  const activeProfile = shared?.profiles?.find((profile) => profile.id === shared.activeProfileId) || shared?.profiles?.[0] || null;
  const child = spawn(target.command, target.args, {
    cwd: target.cwd,
    env: {
      ...process.env,
      CONTENTHOARD: "1",
      CONTENTHOARD_APP_ID: appId,
      CONTENTHOARD_SHARED_STATE_PATH: sharedStatePath,
      CONTENTHOARD_PROFILE_ID: activeProfile?.id || "",
      CONTENTHOARD_PROFILE: activeProfile ? JSON.stringify(activeProfile) : "",
      CONTENTHOARD_THEME: shared?.theme ? JSON.stringify(shared.theme) : "",
      CONTENTHOARD_SAVED_THEMES: shared?.savedThemes ? JSON.stringify(shared.savedThemes) : "",
    },
    detached: process.platform !== "win32",
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  return true;
};

const focusContentHoard = () =>
  new Promise<boolean>((resolve) => {
    const request = http.get(
      {
        host: "127.0.0.1",
        port: contentHoardFocusPort,
        path: "/focus",
        timeout: 700,
      },
      (response) => {
        response.resume();
        resolve(Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300));
      }
    );
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });

const openContentHoard = async () => {
  if (await focusContentHoard()) return true;
  if (!fs.existsSync(contentHoardApp.cwd)) return false;
  const child = spawn(contentHoardApp.command, contentHoardApp.args, {
    cwd: contentHoardApp.cwd,
    env: {
      ...process.env,
      CONTENTHOARD_SHARED_STATE_PATH: sharedStatePath,
      CONTENTHOARD_FOCUS_PORT: String(contentHoardFocusPort),
    },
    detached: process.platform !== "win32",
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  for (let i = 0; i < 10; i++) {
    if (await focusContentHoard()) break;
    await new Promise(r => setTimeout(r, 500));
  }
  return true;
};

ipcMain.handle("ping", () => "pong");
ipcMain.handle("getVersion", () => appVersion);
ipcMain.handle("isStaging", () => isStaging);
ipcMain.handle("isPortableVersion", () => isPortableVersion());
ipcMain.handle("getDefaultDownloadsPath", () => defaultDownloadsPath);
ipcMain.handle("contenthoard:get-apps", () => hoardApps.map(({ id, name }) => ({ id, name })));
ipcMain.handle("contenthoard:launch-app", (_event, appId: string) => launchHoardApp(appId));
ipcMain.handle("contenthoard:open", () => openContentHoard());
ipcMain.handle("contenthoard:read-shared-state", () => readContentHoardState());
ipcMain.handle("contenthoard:write-shared-state", (_event, nextState: unknown) => writeContentHoardState(nextState));
