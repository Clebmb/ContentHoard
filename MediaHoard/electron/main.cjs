const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } = require("electron");
const { spawn } = require("node:child_process");
const { MpvController } = require("./mpv-controller.cjs");

const isDev = !app.isPackaged;
const host = "127.0.0.1";
const port = Number(process.env.MEDIAHOARD_DESKTOP_PORT || "3000");
const appUrl = process.env.MEDIAHOARD_DESKTOP_URL || `http://${host}:${port}`;
const playerWindowLabel = "goblin-player";
const windowsByLabel = new Map();
let mainWindow = null;
let serverProcess = null;
let pendingDeepLinks = [];
const sharedStatePath = process.env.CONTENTHOARD_SHARED_STATE_PATH ||
  path.join(os.homedir(), ".contenthoard", "shared-state.json");
const workspaceRoot = path.resolve(__dirname, "..", "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const yarnCommand = process.platform === "win32" ? "yarn.cmd" : "yarn";
const hoardApps = [
  { id: "mediahoard", name: "MediaHoard", command: npmCommand, args: ["run", "desktop:dev"], cwd: path.join(workspaceRoot, "MediaHoard") },
  { id: "audiohoard", name: "AudioHoard", command: npmCommand, args: ["run", "dev"], cwd: path.join(workspaceRoot, "AudioHoard") },
  { id: "playhoard", name: "PlayHoard", command: yarnCommand, args: ["dev"], cwd: path.join(workspaceRoot, "PlayHoard") },
];
const contentHoardApp = {
  command: npmCommand,
  args: ["run", "dev"],
  cwd: path.join(workspaceRoot, "ContentHoard"),
};
const contentHoardFocusPort = Number(process.env.CONTENTHOARD_FOCUS_PORT || "18334");

const resourcePath = (...parts) => path.join(isDev ? app.getAppPath() : process.resourcesPath, ...parts);
const appIconPath = () => path.join(
  app.getAppPath(),
  "public",
  process.platform === "win32" ? "mediahoard.ico" : "mediahoard.png"
);
const appIcon = () => nativeImage.createFromPath(appIconPath());

app.setName("MediaHoard");
if (process.platform === "win32") {
  app.setAppUserModelId("com.mediahoard.desktop");
}

const readContentHoardState = () => {
  try {
    return JSON.parse(fs.readFileSync(sharedStatePath, "utf8"));
  } catch {
    return null;
  }
};

const writeContentHoardState = (nextState) => {
  fs.mkdirSync(path.dirname(sharedStatePath), { recursive: true });
  fs.writeFileSync(sharedStatePath, JSON.stringify(nextState, null, 2), "utf8");
  return nextState;
};

let sharedStateWatchInterval;
function startSharedStateWatcher() {
  if (process.env.CONTENTHOARD !== "1") return;
  let lastMtime = 0;
  try { lastMtime = fs.statSync(sharedStatePath, { throwIfNoEntry: false })?.mtimeMs || 0; } catch { /* ignore */ }
  sharedStateWatchInterval = setInterval(() => {
    try {
      const stat = fs.statSync(sharedStatePath, { throwIfNoEntry: false });
      if (!stat) return;
      if (stat.mtimeMs > lastMtime) {
        lastMtime = stat.mtimeMs;
        const state = readContentHoardState();
        if (state && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("contenthoard:shared-state-updated", state);
        }
      }
    } catch { /* ignore */ }
  }, 2000);
}

const launchHoardApp = (appId) => {
  const target = hoardApps.find((candidate) => candidate.id === appId);
  if (!target || !fs.existsSync(target.cwd)) return false;
  const shared = readContentHoardState() || {};
  const activeProfile = shared.profiles?.find?.((profile) => profile.id === shared.activeProfileId) || shared.profiles?.[0] || null;
  const child = spawn(target.command, target.args, {
    cwd: target.cwd,
    env: {
      ...process.env,
      CONTENTHOARD: "1",
      CONTENTHOARD_APP_ID: appId,
      CONTENTHOARD_SHARED_STATE_PATH: sharedStatePath,
      CONTENTHOARD_PROFILE_ID: activeProfile?.id || "",
      CONTENTHOARD_PROFILE: activeProfile ? JSON.stringify(activeProfile) : "",
      CONTENTHOARD_THEME: shared.theme ? JSON.stringify(shared.theme) : "",
    },
    detached: process.platform !== "win32",
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  return true;
};

const focusContentHoard = () => new Promise((resolve) => {
  const request = http.get({
    host: "127.0.0.1",
    port: contentHoardFocusPort,
    path: "/focus",
    timeout: 700,
  }, (response) => {
    response.resume();
    resolve(response.statusCode >= 200 && response.statusCode < 300);
  });
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

const getPlatformMpvName = () => process.platform === "win32" ? "mpv.exe" : "mpv";

const resolveMpvPath = () => {
  const candidates = [
    process.env.MEDIAHOARD_MPV_PATH,
    resourcePath("mpv", "bin", getPlatformMpvName()),
    resourcePath("electron", "resources", "mpv", "bin", getPlatformMpvName()),
    process.platform === "win32" ? null : "/usr/bin/mpv",
  ].filter(Boolean);

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error("Packaged mpv executable was not found. Run npm run desktop:prepare.");
  }
  return found;
};

const emitToPlayerRenderers = (channel, payload) => {
  for (const window of windowsByLabel.values()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
};

const mpvController = new MpvController({
  resolveMpvPath,
  emit: (type, payload) => {
    if (type === "property") emitToPlayerRenderers("mediahoard:mpv-property", payload);
    if (type === "event") emitToPlayerRenderers("mediahoard:mpv-event", payload);
    if (type === "log") console.info("[mpv]", payload.label, payload.message.trim());
  },
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const probeServer = () => new Promise((resolve) => {
  const request = http.get(`${appUrl}/`, (response) => {
    response.resume();
    resolve(true);
  });
  request.setTimeout(2000, () => {
    request.destroy();
    resolve(false);
  });
  request.on("error", () => resolve(false));
});

const startPackagedServer = async () => {
  if (isDev || await probeServer()) return;

  const nodePath = resourcePath("runtime", process.platform === "win32" ? "node.exe" : "node");
  const serverDir = resourcePath("server");
  const serverPath = path.join(serverDir, "server.js");

  if (!fs.existsSync(nodePath) || !fs.existsSync(serverPath)) {
    throw new Error("Packaged Next runtime is missing. Run npm run desktop:prepare before packaging.");
  }

  serverProcess = spawn(nodePath, [serverPath], {
    cwd: serverDir,
    env: {
      ...process.env,
      HOSTNAME: host,
      PORT: String(port),
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProcess.stdout.on("data", (chunk) => console.info("[next]", chunk.toString("utf8").trim()));
  serverProcess.stderr.on("data", (chunk) => console.error("[next]", chunk.toString("utf8").trim()));

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await probeServer()) return;
    await wait(250);
  }

  throw new Error("Timed out waiting for the packaged Next server.");
};

const createWindow = ({ label, url, player = false }) => {
  const window = new BrowserWindow({
    title: player ? "Goblin Player" : "MediaHoard",
    width: player ? 1680 : 1440,
    height: player ? 980 : 960,
    minWidth: player ? 1100 : 960,
    minHeight: player ? 700 : 680,
    center: true,
    show: false,
    backgroundColor: player ? "#00000000" : "#050505",
    transparent: player,
    icon: appIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [`--mediahoard-window-label=${label}`],
    },
  });

  windowsByLabel.set(label, window);
  window.once("ready-to-show", () => {
    if (player) window.maximize();
    window.show();
  });
  window.on("closed", () => {
    windowsByLabel.delete(label);
    void mpvController.destroy(label).catch(() => undefined);
  });

  void window.loadURL(url);
  return window;
};

const openPlayerWindow = async (payloadOrUrl) => {
  const url = typeof payloadOrUrl === "string"
    ? payloadOrUrl
    : `${appUrl}${payloadOrUrl.path || "/player"}${payloadOrUrl.search || ""}`;
  const existing = windowsByLabel.get(playerWindowLabel);

  if (existing && !existing.isDestroyed()) {
    existing.webContents.send("mediahoard:player-open", payloadOrUrl.payload || null);
    existing.show();
    existing.focus();
    return;
  }

  createWindow({ label: playerWindowLabel, url, player: true });
};

const handleDeepLink = (url) => {
  if (!url) return;
  pendingDeepLinks.push(url);
  emitToPlayerRenderers("mediahoard:open-url", [url]);
};

const isSupportedExecutable = (filePath) => {
  if (!filePath) return false;
  if (process.platform === "win32") return /\.(exe|bat|cmd)$/i.test(filePath);
  return true;
};

const walkVideoFiles = async (directoryPath) => {
  const results = [];
  const stack = [directoryPath];
  const supported = new Set([".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v"]);

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.promises.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (supported.has(path.extname(entry.name).toLowerCase())) {
        results.push({
          path: entryPath,
          name: entry.name,
          size: (await fs.promises.stat(entryPath).catch(() => ({ size: 0 }))).size,
        });
      }
    }
  }

  return results;
};

app.setAsDefaultProtocolClient("goblin");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const url = argv.find((value) => value.startsWith("goblin://"));
    if (url) handleDeepLink(url);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });
}

ipcMain.handle("mediahoard:get-window-label", (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  for (const [label, window] of windowsByLabel.entries()) {
    if (window === owner) return label;
  }
  return "main";
});
ipcMain.handle("contenthoard:get-apps", () => hoardApps.map(({ id, name }) => ({ id, name })));
ipcMain.handle("contenthoard:launch-app", (_event, appId) => launchHoardApp(appId));
ipcMain.handle("contenthoard:open", () => openContentHoard());
ipcMain.handle("contenthoard:read-shared-state", () => readContentHoardState());
ipcMain.handle("contenthoard:write-shared-state", (_event, nextState) => writeContentHoardState(nextState));

ipcMain.handle("mediahoard:open-player-window", async (_event, payload) => {
  await openPlayerWindow(payload);
});

ipcMain.handle("mediahoard:close-window", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle("mediahoard:pick-executable", async (_event, options = {}) => {
  const result = await dialog.showOpenDialog({
    title: options.title || "Select executable",
    properties: ["openFile"],
  });
  const filePath = result.filePaths[0];
  if (result.canceled || !isSupportedExecutable(filePath)) return null;
  return { path: filePath, name: path.basename(filePath) };
});

ipcMain.handle("mediahoard:launch-external-player", async (_event, { executablePath, playbackUrl }) => {
  const child = spawn(executablePath, [playbackUrl], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
});

ipcMain.handle("mediahoard:pick-video-files", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Video", extensions: ["mp4", "mkv", "avi", "mov", "webm", "m4v"] }],
  });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.map(async (filePath) => ({
    path: filePath,
    name: path.basename(filePath),
    size: (await fs.promises.stat(filePath).catch(() => ({ size: 0 }))).size,
  })));
});

ipcMain.handle("mediahoard:pick-video-directory", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  const directoryPath = result.filePaths[0];
  if (result.canceled || !directoryPath) return null;
  return {
    path: directoryPath,
    name: path.basename(directoryPath),
    files: await walkVideoFiles(directoryPath),
  };
});

ipcMain.handle("mediahoard:get-current-deep-links", () => {
  const links = pendingDeepLinks;
  pendingDeepLinks = [];
  return links;
});

ipcMain.handle("mediahoard:mpv-bootstrap", async (_event, request) => {
  await mpvController.bootstrap(request);
});
ipcMain.handle("mediahoard:mpv-command", async (_event, { windowLabel, command, args }) =>
  mpvController.getSession(windowLabel).command(command, args));
ipcMain.handle("mediahoard:mpv-get-property", async (_event, { windowLabel, name }) =>
  mpvController.getSession(windowLabel).getProperty(name));
ipcMain.handle("mediahoard:mpv-set-property", async (_event, { windowLabel, name, value }) =>
  mpvController.getSession(windowLabel).setProperty(name, value));
ipcMain.handle("mediahoard:mpv-observe-properties", async (_event, { windowLabel, properties }) =>
  mpvController.getSession(windowLabel).observeProperties(properties));
ipcMain.handle("mediahoard:mpv-destroy", async (_event, windowLabel) =>
  mpvController.destroy(windowLabel));
ipcMain.handle("mediahoard:mpv-snapshot", async (_event, windowLabel) =>
  mpvController.getSession(windowLabel).snapshot());
ipcMain.handle("mediahoard:mpv-diagnostics", () => {
  const mpvPath = resolveMpvPath();
  return {
    checks: [{ path: mpvPath, exists: fs.existsSync(mpvPath), loadable: fs.existsSync(mpvPath), error: null }],
    pathEntries: (process.env.PATH || "").split(path.delimiter),
  };
});
ipcMain.handle("mediahoard:open-path", (_event, filePath) => shell.openPath(filePath));
ipcMain.handle("mediahoard:file-url", (_event, filePath) => pathToFileURL(filePath).toString());

app.whenReady().then(async () => {
  await startPackagedServer();
  mainWindow = createWindow({ label: "main", url: appUrl, player: false });
  startSharedStateWatcher();
});

app.on("before-quit", () => {
  if (sharedStateWatchInterval) clearInterval(sharedStateWatchInterval);
  void mpvController.destroyAll().catch(() => undefined);
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
