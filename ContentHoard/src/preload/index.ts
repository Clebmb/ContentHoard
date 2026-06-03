import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("contenthoard", {
  getApps: () => ipcRenderer.invoke("contenthoard:get-apps"),
  getState: () => ipcRenderer.invoke("contenthoard:get-state"),
  saveState: (state: unknown) => ipcRenderer.invoke("contenthoard:save-state", state),
  launchApp: (appId: string) => ipcRenderer.invoke("contenthoard:launch-app", appId),
  stopApp: (appId: string) => ipcRenderer.invoke("contenthoard:stop-app", appId),
  revealApp: (appId: string) => ipcRenderer.invoke("contenthoard:reveal-app", appId),
  getStatuses: () => ipcRenderer.invoke("contenthoard:get-statuses"),
  onStatus: (callback: (statuses: Record<string, unknown>) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, statuses: Record<string, unknown>) => callback(statuses);
    ipcRenderer.on("contenthoard:statuses", listener);
    return () => ipcRenderer.removeListener("contenthoard:statuses", listener);
  },
  onStateUpdated: (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on("contenthoard:state-updated", listener);
    return () => ipcRenderer.removeListener("contenthoard:state-updated", listener);
  }
});
