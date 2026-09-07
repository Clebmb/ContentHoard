import { app, BrowserWindow, net, protocol } from "electron";
import updater from "electron-updater";
import i18n from "i18next";
import path from "node:path";
import url from "node:url";
import { optimizer } from "@electron-toolkit/utils";
import {
  logger,
  clearGamesPlaytime,
  WindowManager,
  Lock,
  PowerSaveBlockerManager,
} from "@main/services";
import resources from "@locales";
import { PythonRPC } from "./services/python-rpc";
import { db, gamesSublevel, levelKeys } from "./level";
import { GameShop, UserPreferences } from "@types";
import { launchGame } from "./helpers";
import { loadState } from "./main";

const { autoUpdater } = updater;

app.setName("PlayHoard");

// Windows taskbar identity. Must be set directly on `app` — NOT via
// @electron-toolkit/utils, whose setAppUserModelId replaces the given id with
// process.execPath in dev mode (ContentHoard's electron.exe), making
// PlayHoard's taskbar button bundle with ContentHoard's.
if (process.platform === "win32") {
  app.setAppUserModelId("app.playhoard.desktop");
}

autoUpdater.setFeedURL({
  provider: "github",
  owner: "playhoard",
  repo: "playhoard",
});

autoUpdater.logger = logger;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();

if (process.platform !== "linux") {
  app.commandLine.appendSwitch("--no-sandbox");
}

if (process.env.PLAYHOARD_REMOTE_DEBUGGING_PORT) {
  app.commandLine.appendSwitch(
    "remote-debugging-port",
    process.env.PLAYHOARD_REMOTE_DEBUGGING_PORT
  );
}

i18n.init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

const PRIMARY_PROTOCOL = "playhoard";
const LEGACY_PROTOCOL = "hydralauncher";
const APP_PROTOCOLS = [PRIMARY_PROTOCOL, LEGACY_PROTOCOL];

const isAppProtocolUrl = (value?: string) => {
  return Boolean(
    value &&
      APP_PROTOCOLS.some((protocol) => value.startsWith(`${protocol}://`))
  );
};

const isRunDeepLinkUrl = (value?: string) => {
  return Boolean(
    value &&
      APP_PROTOCOLS.some((protocol) => value.startsWith(`${protocol}://run`))
  );
};

const decodeLocalFilePath = (filePath: string) => {
  try {
    return decodeURIComponent(filePath);
  } catch {
    return decodeURI(filePath);
  }
};

for (const protocol of APP_PROTOCOLS) {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(protocol, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(protocol);
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  protocol.handle("local", (request) => {
    const filePath = request.url.slice("local:".length);
    return net.fetch(url.pathToFileURL(decodeLocalFilePath(filePath)).toString());
  });

  protocol.handle("gradient", (request) => {
    const gradientCss = decodeURIComponent(
      request.url.slice("gradient:".length)
    );

    // Parse gradient CSS safely without regex to prevent ReDoS
    let direction = "45deg";
    let color1 = "#4a90e2";
    let color2 = "#7b68ee";

    // Simple string parsing approach - more secure than regex
    if (
      gradientCss.startsWith("linear-gradient(") &&
      gradientCss.endsWith(")")
    ) {
      const content = gradientCss.slice(16, -1); // Remove "linear-gradient(" and ")"
      const parts = content.split(",").map((part) => part.trim());

      if (parts.length >= 3) {
        direction = parts[0];
        color1 = parts[1];
        color2 = parts[2];
      }
    }

    let x1 = "0%",
      y1 = "0%",
      x2 = "100%",
      y2 = "100%";

    if (direction === "to right") {
      y2 = "0%";
    } else if (direction === "to bottom") {
      x2 = "0%";
    } else if (direction === "45deg") {
      y1 = "100%";
      y2 = "0%";
    } else if (direction === "225deg") {
      x1 = "100%";
      x2 = "0%";
    } else if (direction === "315deg") {
      x1 = "100%";
      y1 = "100%";
      x2 = "0%";
      y2 = "0%";
    }
    // Note: "135deg" case removed as it uses all default values

    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <defs>
          <linearGradient id="grad" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
            <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
      </svg>
    `;

    return new Response(svgContent, {
      headers: { "Content-Type": "image/svg+xml" },
    });
  });

  await loadState();

  const language = await db
    .get<string, string>(levelKeys.language, {
      valueEncoding: "utf8",
    })
    .catch(() => "en");

  if (language) i18n.changeLanguage(language);

  // Check if starting from a "run" deep link - don't show main window in that case
  const deepLinkArg = process.argv.find(isAppProtocolUrl);
  const isRunDeepLink = isRunDeepLinkUrl(deepLinkArg);

  if (!process.argv.includes("--hidden") && !isRunDeepLink) {
    WindowManager.createMainWindow();
  }

  WindowManager.createNotificationWindow();
  WindowManager.createSystemTray(language || "en");

  if (deepLinkArg) {
    handleDeepLinkPath(deepLinkArg);
  }
});

app.on("browser-window-created", (_, window) => {
  optimizer.watchWindowShortcuts(window);
});

const handleRunGame = async (shop: GameShop, objectId: string) => {
  const gameKey = levelKeys.game(shop, objectId);
  const game = await gamesSublevel.get(gameKey);

  if (!game?.executablePath) {
    logger.error("Game not found or no executable path", { shop, objectId });
    return;
  }

  const userPreferences = await db.get<string, UserPreferences | null>(
    levelKeys.userPreferences,
    { valueEncoding: "json" }
  );

  // Only open main window if setting is disabled
  if (!userPreferences?.hideToTrayOnGameStart) {
    WindowManager.createMainWindow();
  }

  await launchGame({
    shop,
    objectId,
    executablePath: game.executablePath,
    launchOptions: game.launchOptions,
  });
};

const handleDeepLinkPath = (uri?: string) => {
  if (!uri) return;

  try {
    const url = new URL(uri);

    if (url.host === "run") {
      const shop = url.searchParams.get("shop") as GameShop | null;
      const objectId = url.searchParams.get("objectId");

      if (shop && objectId) {
        handleRunGame(shop, objectId);
      }

      return;
    }

    if (url.host === "install-source") {
      WindowManager.redirect(`settings${url.search}`);
      return;
    }

    if (url.host === "profile") {
      const userId = url.searchParams.get("userId");

      if (userId) {
        WindowManager.redirect(`profile/${userId}`);
      }

      return;
    }

    if (url.host === "install-theme") {
      const themeName = url.searchParams.get("theme");
      const authorId = url.searchParams.get("authorId");
      const authorName = url.searchParams.get("authorName");

      if (themeName && authorId && authorName) {
        WindowManager.redirect(
          `settings?theme=${themeName}&authorId=${authorId}&authorName=${authorName}`
        );
      }
    }
  } catch (error) {
    logger.error("Error handling deep link", uri, error);
  }
};

app.on("second-instance", (_event, commandLine) => {
  const deepLink = commandLine.find(isAppProtocolUrl);

  // Check if this is a "run" deep link - don't show main window in that case
  const isRunDeepLink = isRunDeepLinkUrl(deepLink);

  if (!isRunDeepLink) {
    if (WindowManager.mainWindow) {
      if (WindowManager.mainWindow.isMinimized())
        WindowManager.mainWindow.restore();

      WindowManager.mainWindow.focus();
    } else {
      WindowManager.createMainWindow();
    }
  }

  handleDeepLinkPath(deepLink);
});

app.on("open-url", (_event, url) => {
  handleDeepLinkPath(url);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  WindowManager.mainWindow = null;
});

let canAppBeClosed = false;

app.on("before-quit", async (e) => {
  await Lock.releaseLock();

  if (!canAppBeClosed) {
    e.preventDefault();
    PowerSaveBlockerManager.reset();
    /* Disconnects Python RPC */
    PythonRPC.kill();
    await clearGamesPlaytime();
    canAppBeClosed = true;
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    WindowManager.createMainWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
