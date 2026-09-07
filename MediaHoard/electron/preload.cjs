const { contextBridge, ipcRenderer } = require("electron");

const listeners = new Set();
const propertyListeners = new Set();
const eventListeners = new Set();
const playerOpenListeners = new Set();
const sharedStateListeners = new Set();

ipcRenderer.on("mediahoard:open-url", (_event, urls) => {
  for (const listener of listeners) listener(urls);
});
ipcRenderer.on("mediahoard:mpv-property", (_event, payload) => {
  for (const listener of propertyListeners) listener(payload);
});
ipcRenderer.on("mediahoard:mpv-event", (_event, payload) => {
  for (const listener of eventListeners) listener(payload);
});
ipcRenderer.on("mediahoard:player-open", (_event, payload) => {
  for (const listener of playerOpenListeners) listener(payload);
});
ipcRenderer.on("contenthoard:shared-state-updated", (_event, state) => {
  for (const listener of sharedStateListeners) listener(state);
});

const parseContentHoardJson = (value) => {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
};

contextBridge.exposeInMainWorld("mediahoardElectron", {
  isElectron: true,
  contentHoard: {
    enabled: process.env.CONTENTHOARD === "1",
    appId: process.env.CONTENTHOARD_APP_ID || null,
    profile: parseContentHoardJson(process.env.CONTENTHOARD_PROFILE),
    theme: parseContentHoardJson(process.env.CONTENTHOARD_THEME),
    savedThemes: parseContentHoardJson(process.env.CONTENTHOARD_SAVED_THEMES),
    getApps: () => ipcRenderer.invoke("contenthoard:get-apps"),
    launchApp: (appId) => ipcRenderer.invoke("contenthoard:launch-app", appId),
    open: () => ipcRenderer.invoke("contenthoard:open"),
    readSharedState: () => ipcRenderer.invoke("contenthoard:read-shared-state"),
    writeSharedState: (state) => ipcRenderer.invoke("contenthoard:write-shared-state", state),
  },
  getWindowLabel: () => ipcRenderer.invoke("mediahoard:get-window-label"),
  openPlayerWindow: (payload) => ipcRenderer.invoke("mediahoard:open-player-window", payload),
  closeWindow: () => ipcRenderer.invoke("mediahoard:close-window"),
  pickExecutable: (options) => ipcRenderer.invoke("mediahoard:pick-executable", options),
  launchExternalPlayer: (payload) => ipcRenderer.invoke("mediahoard:launch-external-player", payload),
  pickVideoFiles: () => ipcRenderer.invoke("mediahoard:pick-video-files"),
  pickVideoDirectory: () => ipcRenderer.invoke("mediahoard:pick-video-directory"),
  getCurrentDeepLinks: () => ipcRenderer.invoke("mediahoard:get-current-deep-links"),
  onOpenUrl: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  onSharedStateUpdated: (listener) => {
    sharedStateListeners.add(listener);
    return () => sharedStateListeners.delete(listener);
  },
  onPlayerOpen: (listener) => {
    playerOpenListeners.add(listener);
    return () => playerOpenListeners.delete(listener);
  },
  fileUrl: (filePath) => ipcRenderer.invoke("mediahoard:file-url", filePath),
  mpv: {
    bootstrap: (request) => ipcRenderer.invoke("mediahoard:mpv-bootstrap", request),
    command: (windowLabel, command, args = []) =>
      ipcRenderer.invoke("mediahoard:mpv-command", { windowLabel, command, args }),
    getProperty: (windowLabel, name) =>
      ipcRenderer.invoke("mediahoard:mpv-get-property", { windowLabel, name }),
    setProperty: (windowLabel, name, value) =>
      ipcRenderer.invoke("mediahoard:mpv-set-property", { windowLabel, name, value }),
    observeProperties: (windowLabel, properties) =>
      ipcRenderer.invoke("mediahoard:mpv-observe-properties", { windowLabel, properties }),
    destroy: (windowLabel) => ipcRenderer.invoke("mediahoard:mpv-destroy", windowLabel),
    snapshot: (windowLabel) => ipcRenderer.invoke("mediahoard:mpv-snapshot", windowLabel),
    diagnostics: () => ipcRenderer.invoke("mediahoard:mpv-diagnostics"),
    onProperty: (listener) => {
      propertyListeners.add(listener);
      return () => propertyListeners.delete(listener);
    },
    onEvent: (listener) => {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
  },
});
