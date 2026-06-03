"use client";

import { buildPlayerUrl } from "@player/query";
import type { PlayerLaunchPayload } from "@player/types";
import { getElectronApi } from "@/lib/electron-desktop";

const PLAYER_WINDOW_LABEL = "goblin-player";
export const playerOpenEvent = "goblin://player-open";
let pendingPlayerWindowPromise: Promise<void> | null = null;

export const openStandalonePlayerWindow = async (payload: PlayerLaunchPayload) => {
    if (!payload.playbackUrl) {
        throw new Error("Standalone player requires a direct playbackUrl.");
    }

    const api = getElectronApi();
    if (!api) {
        throw new Error("Standalone player requires the Electron shell.");
    }

    if (pendingPlayerWindowPromise) {
        await pendingPlayerWindowPromise.catch(() => undefined);
    }

    const playerUrl = new URL(buildPlayerUrl(payload), window.location.origin);
    const playerWindowPromise = api.openPlayerWindow({
        label: PLAYER_WINDOW_LABEL,
        path: playerUrl.pathname,
        search: playerUrl.search,
        payload,
    });

    pendingPlayerWindowPromise = playerWindowPromise;

    try {
        await playerWindowPromise;
    } finally {
        if (pendingPlayerWindowPromise === playerWindowPromise) {
            pendingPlayerWindowPromise = null;
        }
    }
};
