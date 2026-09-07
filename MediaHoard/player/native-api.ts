"use client";

type ObservedProperty = readonly [string, ...unknown[]];
type MpvPropertyEvent = {
    name: string;
    data: unknown;
};
type MpvEvent = {
    event: string;
    [key: string]: unknown;
};

const getElectronApi = () => {
    if (typeof window === "undefined" || !window.mediahoardElectron) {
        throw new Error("MediaHoard Electron API is not available.");
    }

    return window.mediahoardElectron;
};

export const getCurrentDesktopWindow = () => ({
    get label() {
        return "goblin-player";
    },
    listen: async <T>(eventName: string, listener: (event: { payload: T }) => void) => {
        if (eventName !== "goblin://player-open") {
            return () => undefined;
        }

        return getElectronApi().onPlayerOpen((payload) => {
            if (payload) {
                listener({ payload: payload as T });
            }
        });
    },
    close: () => getElectronApi().closeWindow(),
});

export const getCurrentDesktopWindowLabel = async () => getElectronApi().getWindowLabel();

export const bootstrapNativePlayer = (request: {
    windowLabel: string;
    requestHeaders?: Record<string, string> | null;
    forceReinitialize?: boolean;
}) => getElectronApi().mpv.bootstrap(request);

export const diagnoseNativePlayerRuntime = <T>() =>
    getElectronApi().mpv.diagnostics() as Promise<T>;

export const getNativePlayerDebugSnapshot = <T>(windowLabel: string) =>
    getElectronApi().mpv.snapshot(windowLabel) as Promise<T>;

export const command = (name: string, args: unknown[], windowLabel: string) =>
    getElectronApi().mpv.command(windowLabel, name, args);

export const getProperty = <T>(name: string, _format: string, windowLabel: string) =>
    getElectronApi().mpv.getProperty(windowLabel, name) as Promise<T>;

export const setProperty = (name: string, value: unknown, windowLabel: string) =>
    getElectronApi().mpv.setProperty(windowLabel, name, value);

export const setVideoMarginRatio = (_value: unknown, _windowLabel: string) =>
    Promise.resolve();

export const destroy = (windowLabel: string) => getElectronApi().mpv.destroy(windowLabel);

export const observeProperties = async (
    properties: readonly ObservedProperty[],
    listener: (event: MpvPropertyEvent) => void,
    windowLabel: string,
) => {
    const dispose = getElectronApi().mpv.onProperty((payload) => {
        if (payload.label !== windowLabel) return;
        listener(payload.property);
    });

    await getElectronApi().mpv.observeProperties(windowLabel, properties);
    return dispose;
};

export const listenEvents = async (
    listener: (event: MpvEvent) => void,
    windowLabel: string,
) => getElectronApi().mpv.onEvent((payload) => {
    if (payload.label !== windowLabel) return;
    listener(payload.event as MpvEvent);
});
