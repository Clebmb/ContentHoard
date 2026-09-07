import { openStandalonePlayerWindow } from "@player/window";
import { buildInstalledPlayerDeepLink } from "@player/query";
import type { PlayerLaunchPayload } from "@player/types";
import { getElectronApi, isElectronDesktop } from "@/lib/electron-desktop";
import type {
    PlaybackMode,
    PlaybackPlatformPreferences,
} from "@/lib/playback-preferences-schema";

export const isDesktopShell = () => isElectronDesktop();

export const openStandaloneDesktopPlayer = async (request: PlayerLaunchPayload) => {
    if (!request.playbackUrl) {
        throw new Error("Standalone desktop player requires a direct playbackUrl.");
    }
    await openStandalonePlayerWindow(request);
};

export const openConfiguredDesktopExternalPlayer = async (
    executablePath: string,
    request: PlayerLaunchPayload,
) => {
    if (!request.playbackUrl) {
        throw new Error("External player launch requires a direct playbackUrl.");
    }

    const api = getElectronApi();
    if (!api) {
        throw new Error("Desktop external player launch requires the Electron shell.");
    }

    await api.launchExternalPlayer({
        executablePath,
        playbackUrl: request.playbackUrl,
    });
};

export const openInstalledStandalonePlayer = (request: PlayerLaunchPayload) => {
    if (typeof window === "undefined") return;
    if (!request.playbackUrl) {
        throw new Error("Installed standalone player requires a direct playbackUrl.");
    }
    window.location.href = buildInstalledPlayerDeepLink(request);
};

export const launchConfiguredWebPlayer = async (
    mode: PlaybackMode,
    request: PlayerLaunchPayload,
) => {
    if (!request.playbackUrl) {
        throw new Error("Configured web player launch requires a direct playbackUrl.");
    }

    const response = await fetch("/api/playback/launch", {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({
            mode,
            playbackUrl: request.playbackUrl,
        }),
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to launch the configured player.");
    }
};

export const canLaunchWithExternalPlayer = (
    preferences: PlaybackPlatformPreferences,
) => Boolean(preferences.externalPlayerPath);
