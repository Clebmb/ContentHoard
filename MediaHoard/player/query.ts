import type { PlayerLaunchPayload, PlayerQuery } from "@player/types";
import { goblinPlayerProtocol } from "@/lib/playback-preferences-schema";

const takeFirst = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

export const normalizePlayerQuery = (
    params: Record<string, string | string[] | undefined>,
): PlayerQuery => {
    const serializedPayload = takeFirst(params.payload);
    if (serializedPayload) {
        try {
            return deserializePlayerPayload(serializedPayload);
        } catch {}
    }

    const type = takeFirst(params.type) || "";
    const id = takeFirst(params.id) || "";
    const sourceParam = takeFirst(params.source);
    const sourceIndex = sourceParam !== undefined && Number.isFinite(Number(sourceParam))
        ? Number(sourceParam)
        : null;

    return {
        type,
        id,
        sourceIndex,
        episodeId: takeFirst(params.episode) || null,
        title: null,
        sourceLabel: null,
        sourceDescription: null,
        sourceKind: null,
        playbackUrl: null,
        requestHeaders: null,
        subtitles: [],
    };
};

const encodeBase64Url = (value: string) => {
    if (typeof window === "undefined") {
        return Buffer.from(value, "utf8").toString("base64url");
    }

    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
};

const decodeBase64Url = (value: string) => {
    if (typeof window === "undefined") {
        return Buffer.from(value, "base64url").toString("utf8");
    }

    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const normalized = padded + "=".repeat((4 - padded.length % 4) % 4);
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
};

export const serializePlayerPayload = (payload: PlayerLaunchPayload) =>
    encodeBase64Url(JSON.stringify(payload));

export const normalizePlayerPayload = (parsed: PlayerLaunchPayload): PlayerQuery => {
    return {
        type: parsed.type || "",
        id: parsed.id || "",
        sourceIndex: typeof parsed.sourceIndex === "number" ? parsed.sourceIndex : null,
        episodeId: parsed.episodeId || null,
        title: parsed.title || null,
        sourceLabel: parsed.sourceLabel || null,
        sourceDescription: parsed.sourceDescription || null,
        sourceKind: parsed.sourceKind || null,
        playbackUrl: parsed.playbackUrl || null,
        requestHeaders: parsed.requestHeaders || null,
        subtitles: parsed.subtitles || [],
    };
};

export const deserializePlayerPayload = (payload: string): PlayerQuery =>
    normalizePlayerPayload(JSON.parse(decodeBase64Url(payload)) as PlayerLaunchPayload);

export const parsePlayerQuery = (
    searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>,
) => Promise.resolve(searchParams).then(normalizePlayerQuery);

export const buildPlayerUrl = (payload: PlayerLaunchPayload) => {
    if (!payload.playbackUrl) {
        throw new Error("Player URL requires a direct playbackUrl.");
    }

    const params = new URLSearchParams({
        payload: serializePlayerPayload(payload),
    });
    return `/player?${params.toString()}`;
};

export const buildInstalledPlayerDeepLink = (payload: PlayerLaunchPayload) => {
    if (!payload.playbackUrl) {
        throw new Error("Installed player deep link requires a direct playbackUrl.");
    }

    const params = new URLSearchParams({
        payload: serializePlayerPayload(payload),
    });
    return `${goblinPlayerProtocol}://player?${params.toString()}`;
};
