import type { PlayerLaunchPayload } from "@player/types";

type ElectronMpvEvent = {
    label: string;
    event: Record<string, unknown>;
};

type ElectronMpvProperty = {
    label: string;
    property: {
        name: string;
        data: unknown;
    };
};

type ElectronPickedVideoFile = {
    path: string;
    name: string;
    size: number;
};

type ElectronPickedVideoDirectory = {
    path: string;
    name: string;
    files: ElectronPickedVideoFile[];
};

type ElectronExecutablePick = {
    path: string;
    name: string;
};

declare global {
    interface Window {
        mediahoardElectron?: {
    isElectron: true;
    contentHoard?: {
      enabled: boolean;
      appId: string | null;
      profile: Record<string, unknown> | null;
      theme: Record<string, unknown> | null;
      savedThemes: unknown[] | null;
      getApps: () => Promise<Array<{ id: string; name: string }>>;
      launchApp: (appId: string) => Promise<boolean>;
      open: () => Promise<boolean>;
      readSharedState: () => Promise<unknown>;
      writeSharedState: (state: unknown) => Promise<unknown>;
    };
    onSharedStateUpdated: (
      listener: (state: Record<string, unknown>) => void
    ) => () => void;
    getWindowLabel: () => Promise<string>;
            openPlayerWindow: (payload: unknown) => Promise<void>;
            closeWindow: () => Promise<void>;
            pickExecutable: (options?: { title?: string }) => Promise<ElectronExecutablePick | null>;
            launchExternalPlayer: (payload: { executablePath: string; playbackUrl: string }) => Promise<void>;
            pickVideoFiles: () => Promise<ElectronPickedVideoFile[]>;
            pickVideoDirectory: () => Promise<ElectronPickedVideoDirectory | null>;
            getCurrentDeepLinks: () => Promise<string[]>;
            onOpenUrl: (listener: (urls: string[]) => void) => () => void;
            onPlayerOpen: (listener: (payload: PlayerLaunchPayload | null) => void) => () => void;
            fileUrl: (filePath: string) => Promise<string>;
            mpv: {
                bootstrap: (request: {
                    windowLabel: string;
                    requestHeaders?: Record<string, string> | null;
                    forceReinitialize?: boolean;
                }) => Promise<void>;
                command: (windowLabel: string, command: string, args?: unknown[]) => Promise<unknown>;
                getProperty: (windowLabel: string, name: string) => Promise<unknown>;
                setProperty: (windowLabel: string, name: string, value: unknown) => Promise<unknown>;
                observeProperties: (windowLabel: string, properties: readonly (readonly unknown[])[]) => Promise<void>;
                destroy: (windowLabel: string) => Promise<void>;
                snapshot: (windowLabel: string) => Promise<unknown>;
                diagnostics: () => Promise<unknown>;
                onProperty: (listener: (payload: ElectronMpvProperty) => void) => () => void;
                onEvent: (listener: (payload: ElectronMpvEvent) => void) => () => void;
            };
        };
    }
}

export {};
