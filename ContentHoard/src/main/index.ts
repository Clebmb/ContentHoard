import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { app, BrowserWindow, Menu, ipcMain } from "electron";
import { is } from "@electron-toolkit/utils";
import { hoardApps } from "./app-registry";
import { getStatuses, launchApp, revealApp, stopApp, restoreStatuses } from "./process-manager";
import { loadState, saveState, sharedStatePath, readSharedState, ingestChildSync, type ContentHoardState } from "./state";

let mainWindow: BrowserWindow | null = null;
const focusHost = "127.0.0.1";
const focusPort = Number(process.env.CONTENTHOARD_FOCUS_PORT || "18334");

const gotSingleInstanceLock = app.requestSingleInstanceLock();

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();

  mainWindow.setVisibleOnAllWorkspaces(true);

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  }

  mainWindow.show();
  mainWindow.moveTop();
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(true, "screen-saver");

  const resetOverrides = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setVisibleOnAllWorkspaces(false);
    }
  };

  mainWindow.once("focus", resetOverrides);
  setTimeout(resetOverrides, 5000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: "#070807",
    title: "ContentHoard",
    icon: path.join(__dirname, "../../build/icon.png"),
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "linux" ? "default" : "hidden",
    trafficLightPosition: { x: 16, y: 16 },
    titleBarOverlay: {
      color: "#00000000",
      symbolColor: "#ffffff",
      height: 36
    },
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    },
    show: false
  });
  Menu.setApplicationMenu(null);

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.moveTop();
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(true, "screen-saver");
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(false);
      }
    }, 250);
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function startFocusServer() {
  const server = http.createServer((request, response) => {
    if (request.url !== "/focus") {
      response.writeHead(404);
      response.end();
      return;
    }

    focusMainWindow();
    response.writeHead(204);
    response.end();
  });

  server.on("error", () => undefined);
  server.listen(focusPort, focusHost);
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    focusMainWindow();
  });
}

ipcMain.handle("contenthoard:get-apps", () =>
  hoardApps.map((app) => ({ ...app, installed: fs.existsSync(app.path) }))
);
ipcMain.handle("contenthoard:get-state", () => loadState());
ipcMain.handle("contenthoard:save-state", (_event, state: ContentHoardState) => saveState(state));
ipcMain.handle("contenthoard:get-statuses", () => getStatuses());
ipcMain.handle("contenthoard:launch-app", (_event, appId: string) => launchApp(appId));
ipcMain.handle("contenthoard:stop-app", (_event, appId: string) => stopApp(appId));
ipcMain.handle("contenthoard:reveal-app", (_event, appId: string) => revealApp(appId));

function startSharedStateWatcher() {
  let lastMtime = 0;
  let lastState: ContentHoardState | null = null;
  try {
    lastMtime = fs.statSync(sharedStatePath, { throwIfNoEntry: false })?.mtimeMs || 0;
  } catch {
    /* ignore */
  }

  setInterval(() => {
    try {
      const stat = fs.statSync(sharedStatePath, { throwIfNoEntry: false });
      if (!stat) return;
      if (stat.mtimeMs > lastMtime) {
        lastMtime = stat.mtimeMs;
        // Child apps (AudioHoard/MediaHoard/PlayHoard) stamp their writes with
        // lastStateUpdateSource: "child". Ingest those into the persistent
        // store so profiles created/edited/deleted in children are adopted,
        // then broadcast the merged result to our renderer.
        const raw = readSharedState();
        const isChildWrite =
          raw.lastStateUpdateSource === "child" ||
          (!!raw.activeProfileId && !!lastState && raw.activeProfileId !== lastState.activeProfileId);
        let state: ContentHoardState;
        if (isChildWrite) {
          const ingest = ingestChildSync(raw);
          state = ingest ? saveState(ingest.patch as ContentHoardState) : loadState();
        } else {
          state = loadState();
        }
        lastState = state;
        for (const window of BrowserWindow.getAllWindows()) {
          if (!window.isDestroyed()) {
            window.webContents.send("contenthoard:state-updated", state);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, 2000);
}

app.whenReady().then(() => {
  if (gotSingleInstanceLock) {
    createWindow();
    startFocusServer();
    restoreStatuses();
    startSharedStateWatcher();
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else focusMainWindow();
});
