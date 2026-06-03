"use client";

import type { Stream } from "@/hooks/use-details";

export type ResolvedSourceKind =
    | "direct"
    | "hls"
    | "dash"
    | "youtube"
    | "external"
    | "torrent"
    | "local";

export interface SubtitleOption {
    id: string;
    label: string;
    lang: string;
    url: string;
}

export interface SourceOption {
    id: string;
    kind: ResolvedSourceKind;
    label: string;
    description: string;
    badges: string[];
    stream?: Stream;
    url?: string;
    requestHeaders?: Record<string, string>;
    externalUrl?: string;
    ytId?: string;
    subtitles: SubtitleOption[];
    isLikelyPlayable: boolean;
    isNativePreferred: boolean;
}

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

export const getStreamDisplayText = (stream: Stream) =>
    stream.description || stream.title || stream.behaviorHints?.filename || stream.url || stream.externalUrl || "Unknown source";

export const getStreamBadges = (stream: Stream) => {
    const text = `${stream.name || ""} ${stream.title || ""} ${stream.description || ""}`.toLowerCase();
    const badges: string[] = [];

    if (/\b(4k|2160p|uhd)\b/.test(text)) badges.push("4K");
    if (/\b(1080p|fhd)\b/.test(text)) badges.push("1080p");
    if (/\b(720p|hd)\b/.test(text)) badges.push("720p");
    if (/\b(hdr|dv|dolby vision|10bit)\b/.test(text)) badges.push("HDR");
    if (stream.behaviorHints?.notWebReady) badges.push("Needs Proxy");

    return badges;
};

export const getSourceKindFromUrl = (url: string | undefined): ResolvedSourceKind | null => {
    if (!url) return null;

    const lower = url.toLowerCase().split("?")[0];

    if (lower.endsWith(".m3u8")) return "hls";
    if (lower.endsWith(".mpd")) return "dash";
    return "direct";
};

export const toSubtitleOption = (subtitle: NonNullable<Stream["subtitles"]>[number], index: number): SubtitleOption => {
    const baseLabel = getLanguageLabel(subtitle.lang);
    return {
        id: subtitle.id || `${subtitle.lang}-${index}`,
        label: baseLabel,
        lang: subtitle.lang,
        url: subtitle.url,
    };
};

export const getLanguageLabel = (lang: string | undefined) => {
    if (!lang) return "Unknown";
    const trimmed = lang.trim();
    if (!trimmed) return "Unknown";

    const normalized = trimmed.toLowerCase();
    try {
        if (normalized.length === 2 || normalized.length === 3 || normalized.includes("-")) {
            return languageNames.of(normalized) || trimmed;
        }
    } catch {}

    return trimmed.toUpperCase() === trimmed ? trimmed : trimmed[0].toUpperCase() + trimmed.slice(1);
};

export const getAudioTrackLabel = (track: {
    language?: string;
    label?: string;
    roles?: string[];
    audioRoles?: string[];
    channelsCount?: number;
}) => {
    const parts = [
        track.label,
        getLanguageLabel(track.language),
        track.roles?.[0],
        track.audioRoles?.[0],
        track.channelsCount ? `${track.channelsCount}ch` : undefined,
    ].filter(Boolean);

    return parts[0] || "Default";
};

export const buildSourceOption = (stream: Stream, index: number): SourceOption => {
    const kindFromUrl = getSourceKindFromUrl(stream.url);
    const kind: ResolvedSourceKind =
        stream.ytId ? "youtube" :
        stream.infoHash ? "torrent" :
        kindFromUrl ? kindFromUrl :
        stream.url ? "direct" :
        stream.externalUrl ? "external" :
        "direct";

    const subtitles = (stream.subtitles || []).map(toSubtitleOption);
    const description = getStreamDisplayText(stream);

    return {
        id: `stream-${index}`,
        kind,
        label: stream.name || "Stream",
        description,
        badges: getStreamBadges(stream),
        stream,
        url: stream.url,
        requestHeaders: stream.behaviorHints?.proxyHeaders?.request,
        externalUrl: stream.externalUrl,
        ytId: stream.ytId,
        subtitles,
        isLikelyPlayable: kind !== "external",
        isNativePreferred: kind === "direct" || kind === "local",
    };
};
