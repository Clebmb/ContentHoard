"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    bootstrapNativePlayer,
    command,
    destroy,
    diagnoseNativePlayerRuntime,
    getCurrentDesktopWindow,
    getCurrentDesktopWindowLabel,
    getNativePlayerDebugSnapshot,
    getProperty,
    listenEvents,
    observeProperties,
    setProperty,
    setVideoMarginRatio,
} from "@player/native-api";
import { useRouter } from "next/navigation";
import type { Stream } from "@/hooks/use-details";
import { fetchStremioSubtitles, useDetails } from "@/hooks/use-details";
import { useAddons } from "@/hooks/use-addons";
import { useTheme } from "@/providers/ThemeProvider";
import { getLanguageLabel, buildSourceOption, type SourceOption, type SubtitleOption } from "@/lib/media-source";
import { isDesktopShell } from "@/lib/desktop-player";
import { normalizePlayerPayload } from "@player/query";
import { playerOpenEvent } from "@player/window";
import type { NativeSubtitleSettings, NativeTrackOption, PlayerLaunchPayload, PlayerQuery } from "@player/types";
import goblinPlayerLogo from "@player/goblinplayerlogo.png";

const subtitleSettingsStorageKey = "mediahoard_native_player_subtitle_settings";
const baseButtonClassName = "rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

const defaultSubtitleSettings: NativeSubtitleSettings = {
    font: "Arial",
    size: 52,
    color: "#ffffff",
    backgroundColor: "#000000",
    backgroundOpacity: 65,
    delay: 0,
};

const chromeIdleDelayMs = 2400;

type PlayerPageClientProps = {
    initialQuery: PlayerQuery;
};

type MpvTrackLike = {
    id?: number;
    type?: string;
    selected?: boolean;
    external?: boolean;
    lang?: string;
    title?: string;
};

type LibmpvRuntimeDiagnostics = {
    checks: Array<{
        path: string;
        exists: boolean;
        loadable: boolean;
        error: string | null;
    }>;
    pathEntries: string[];
};

type NativePlayerDebugSnapshot = {
    pause: unknown;
    timePos: unknown;
    duration: unknown;
    aid: unknown;
    sid: unknown;
    vid: unknown;
    trackList: unknown;
    mediaTitle: unknown;
};

type MpvNodeLike = {
    data?: unknown;
    value?: unknown;
    values?: unknown;
    items?: unknown;
};

type MpvMapEntryLike = {
    key?: unknown;
    name?: unknown;
    value?: unknown;
    data?: unknown;
};

const observedPlaybackProperties = [
    ["pause", "flag"],
    ["time-pos", "double", "none"],
    ["duration", "double", "none"],
    ["volume", "double", "none"],
    ["media-title", "string", "none"],
    ["aid", "int64", "none"],
    ["sid", "int64", "none"],
    ["track-list", "node", "none"],
] as const;

const unwrapMpvNodeValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value;
    }

    if (value && typeof value === "object") {
        const candidate = value as MpvNodeLike;
        if (Array.isArray(candidate.data)) {
            return candidate.data;
        }
        if (Array.isArray(candidate.value)) {
            return candidate.value;
        }
        if (Array.isArray(candidate.values)) {
            return candidate.values;
        }
        if (Array.isArray(candidate.items)) {
            return candidate.items;
        }
        if (candidate.data && typeof candidate.data === "object") {
            return unwrapMpvNodeValue(candidate.data);
        }
        if (candidate.value && typeof candidate.value === "object") {
            return unwrapMpvNodeValue(candidate.value);
        }
    }

    return value;
};

const unwrapMpvScalarValue = (value: unknown): unknown => {
    if (value && typeof value === "object") {
        const candidate = value as MpvNodeLike;
        if (candidate.data !== undefined && !Array.isArray(candidate.data)) {
            return unwrapMpvScalarValue(candidate.data);
        }
        if (candidate.value !== undefined && !Array.isArray(candidate.value)) {
            return unwrapMpvScalarValue(candidate.value);
        }
    }

    return value;
};

const takeTrackArray = (value: unknown) => {
    const normalized = unwrapMpvNodeValue(value);
    return Array.isArray(normalized) ? normalized as MpvTrackLike[] : [];
};

const readNumericProperty = (value: unknown) => {
    const normalized = unwrapMpvScalarValue(value);
    if (typeof normalized === "number" && Number.isFinite(normalized)) {
        return normalized;
    }

    if (typeof normalized === "string") {
        const parsed = Number(normalized);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return null;
};

const readBooleanProperty = (value: unknown) => {
    const normalized = unwrapMpvScalarValue(value);
    return typeof normalized === "boolean" ? normalized : null;
};

const readStringProperty = (value: unknown) => {
    const normalized = unwrapMpvScalarValue(value);
    return typeof normalized === "string" ? normalized : null;
};

const readMpvObjectField = (value: unknown, key: string): unknown => {
    if (!value || typeof value !== "object") {
        return undefined;
    }

    const direct = value as Record<string, unknown>;
    if (direct[key] !== undefined) {
        return direct[key];
    }

    for (const containerKey of ["data", "value", "values", "items"] as const) {
        const container = direct[containerKey];
        if (Array.isArray(container)) {
            for (const entry of container as MpvMapEntryLike[]) {
                const entryKey = readStringProperty(entry.key ?? entry.name);
                if (entryKey === key) {
                    return entry.value ?? entry.data;
                }
            }
        }
        if (container && typeof container === "object") {
            const nested = readMpvObjectField(container, key);
            if (nested !== undefined) {
                return nested;
            }
        }
    }

    return undefined;
};

const getTorrentPlaybackUrl = (stream: Stream) => {
    if (!stream.infoHash) return null;
    const filePart = typeof stream.fileIdx === "number" ? `/${stream.fileIdx}` : "";
    return `http://127.0.0.1:11470/${stream.infoHash}${filePart}`;
};

const mergeSubtitleOptions = (...groups: SubtitleOption[][]) => {
    const seen = new Set<string>();

    return groups
        .flat()
        .filter((subtitle) => {
            const key = `${subtitle.lang}:${subtitle.url}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const toSubtitleOptions = (subtitles: PlayerLaunchPayload["subtitles"] = []): SubtitleOption[] =>
    subtitles.map((subtitle, index) => ({
        id: subtitle.id || `payload-subtitle-${index}`,
        label: subtitle.label || `${getLanguageLabel(subtitle.lang)} Subtitle`,
        lang: subtitle.lang || "und",
        url: subtitle.url,
    }));

const formatUnknownError = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error === "string" && error.trim()) {
        return error;
    }

    if (error && typeof error === "object") {
        try {
            const serialized = JSON.stringify(error);
            if (serialized && serialized !== "{}") {
                return serialized;
            }
        } catch {}
    }

    return fallback;
};

const formatLibmpvDiagnostics = (diagnostics: LibmpvRuntimeDiagnostics) => {
    const failingCheck = diagnostics.checks.find((check) => !check.loadable);
    if (failingCheck) {
        const reason = failingCheck.error || (failingCheck.exists ? "Native library could not be loaded." : "Native library file is missing.");
        return `${reason} (${failingCheck.path})`;
    }

    const missingCheck = diagnostics.checks.find((check) => !check.exists);
    if (missingCheck) {
        return `Native library file is missing. (${missingCheck.path})`;
    }

    return null;
};

const formatTrackLabel = (track: { lang?: unknown; title?: unknown }, fallback: string) => {
    const title = readStringProperty(track.title);
    const lang = readStringProperty(track.lang);
    const parts = [
        title,
        lang ? getLanguageLabel(lang) : undefined,
    ].filter(Boolean);

    return parts.join(" - ") || fallback;
};

const normalizeMpvTracks = (
    trackList: unknown,
    selectedAid: number | null,
    selectedSid: number | null,
) => {
    const audioTracks: NativeTrackOption[] = [];
    const subtitleTracks: NativeTrackOption[] = [];

    for (const track of takeTrackArray(trackList)) {
        const rawTrackId = readMpvObjectField(track, "id");
        const rawTrackType = readMpvObjectField(track, "type");
        const rawTrackLang = readMpvObjectField(track, "lang");
        const rawTrackTitle = readMpvObjectField(track, "title");
        const rawTrackSelected = readMpvObjectField(track, "selected");
        const rawTrackExternal = readMpvObjectField(track, "external");
        const trackId = readNumericProperty(rawTrackId) ?? null;
        const trackType = readStringProperty(rawTrackType);
        const trackLang = readStringProperty(rawTrackLang) || undefined;
        const trackTitle = readStringProperty(rawTrackTitle) || undefined;
        const trackSelected = readBooleanProperty(rawTrackSelected) ?? Boolean(rawTrackSelected);
        const trackExternal = readBooleanProperty(rawTrackExternal) ?? Boolean(rawTrackExternal);

        if (trackType === "audio") {
            audioTracks.push({
                id: `audio-${trackId ?? crypto.randomUUID()}`,
                label: formatTrackLabel({ lang: rawTrackLang, title: rawTrackTitle }, `Audio ${trackId ?? audioTracks.length + 1}`),
                kind: "audio",
                mpvTrackId: trackId,
                selected: trackId === selectedAid || trackSelected,
                external: trackExternal,
                language: trackLang,
                title: trackTitle,
            });
        }

        if (trackType === "sub") {
            subtitleTracks.push({
                id: `subtitle-${trackId ?? crypto.randomUUID()}`,
                label: formatTrackLabel({ lang: rawTrackLang, title: rawTrackTitle }, `Subtitle ${trackId ?? subtitleTracks.length + 1}`),
                kind: "subtitle",
                mpvTrackId: trackId,
                selected: trackId === selectedSid || trackSelected,
                external: trackExternal,
                language: trackLang,
                title: trackTitle,
            });
        }
    }

    return { audioTracks, subtitleTracks };
};

const hexToMpvColor = (hex: string, alphaPercent = 100) => {
    const normalized = hex.replace("#", "");
    const value = normalized.length === 3
        ? normalized.split("").map((char) => char + char).join("")
        : normalized.padEnd(6, "0").slice(0, 6);
    const alpha = Math.max(0, Math.min(255, Math.round((alphaPercent / 100) * 255)));
    const alphaHex = alpha.toString(16).padStart(2, "0");

    return `#${alphaHex}${value}`;
};

const formatPlaybackTime = (seconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    try {
        return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
            }),
        ]);
    } finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isNativeMediaReady = (snapshot: NativePlayerDebugSnapshot | null) => {
    if (!snapshot) return false;

    const duration = readNumericProperty(snapshot.duration);
    const timePos = readNumericProperty(snapshot.timePos);
    const trackList = takeTrackArray(snapshot.trackList);
    const vid = readNumericProperty(snapshot.vid);
    const aid = readNumericProperty(snapshot.aid);

    return Boolean(
        (duration !== null && duration > 0)
        || timePos !== null
        || trackList.length > 0
        || vid !== null
        || aid !== null
    );
};

const waitForNativeMediaSnapshot = async (
    windowLabel: string,
    isCurrentRun: () => boolean,
    timeoutMs = 20000,
) => {
    const started = Date.now();
    let lastSnapshot: NativePlayerDebugSnapshot | null = null;

    while (isCurrentRun() && Date.now() - started < timeoutMs) {
        lastSnapshot = await getNativePlayerDebugSnapshot<NativePlayerDebugSnapshot>(windowLabel).catch(() => null);

        if (isNativeMediaReady(lastSnapshot)) {
            return lastSnapshot;
        }

        await delay(300);
    }

    if (!isCurrentRun()) {
        return lastSnapshot;
    }

    return lastSnapshot;
};

const extractReleaseYear = (value: string | undefined) => {
    if (!value) return null;
    const match = value.match(/\b(19\d{2}|20\d{2})\b/);
    return match?.[0] || null;
};

const debugPlayerEvent = (message: string, data?: Record<string, unknown>) => {
    if (typeof window === "undefined") {
        return;
    }

    const params = new URLSearchParams({
        scope: "player-debug",
        message,
    });

    if (data) {
        params.set("data", JSON.stringify(data));
    }

    void fetch(`/api/debug-log?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
    }).catch(() => undefined);
};

export default function PlayerPageClient({ initialQuery }: PlayerPageClientProps) {
    const router = useRouter();
    const { theme } = useTheme();
    const { installedAddons, isLoaded: addonsLoaded } = useAddons();
    const [desktopShell, setDesktopShell] = useState(false);
    const [desktopEnvironmentResolved, setDesktopEnvironmentResolved] = useState(false);
    const [currentPlayerWindowLabel, setCurrentPlayerWindowLabel] = useState<string | null>(null);
    const hasActiveMpvSessionRef = useRef(false);
    const mpvInitRunIdRef = useRef(0);
    const initializedPlaybackKeyRef = useRef<string | null>(null);
    const syncedSubtitleKeyRef = useRef<string | null>(null);
    const [launchState, setLaunchState] = useState<PlayerQuery>(initialQuery);
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(
        typeof initialQuery.sourceIndex === "number"
            ? `stream-${initialQuery.sourceIndex}`
            : initialQuery.playbackUrl
                ? "launch-source"
                : null
    );
    const [openPanel, setOpenPanel] = useState<"sources" | "audio" | "subtitles" | "style" | null>(null);
    const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string>("auto");
    const [selectedSubtitleTrackId, setSelectedSubtitleTrackId] = useState<string>("off");
    const [audioTracks, setAudioTracks] = useState<NativeTrackOption[]>([]);
    const [subtitleTracks, setSubtitleTracks] = useState<NativeTrackOption[]>([]);
    const [playbackState, setPlaybackState] = useState({
        pause: false,
        timePos: 0,
        duration: 0,
        volume: 100,
        mediaTitle: "",
    });
    const [playbackBackend, setPlaybackBackend] = useState<"native" | null>(null);
    const [playerReady, setPlayerReady] = useState(false);
    const [nativeMediaReady, setNativeMediaReady] = useState(false);
    const [playerLoading, setPlayerLoading] = useState(false);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const [playerMessage, setPlayerMessage] = useState<string | null>(null);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [addonSubtitles, setAddonSubtitles] = useState<SubtitleOption[]>([]);
    const [tmdbLogoUrl, setTmdbLogoUrl] = useState<string | null>(null);
    const [subtitleSettings, setSubtitleSettings] = useState<NativeSubtitleSettings>(() => {
        if (typeof window === "undefined") {
            return defaultSubtitleSettings;
        }

        try {
            const stored = window.localStorage.getItem(subtitleSettingsStorageKey);
            return stored ? { ...defaultSubtitleSettings, ...JSON.parse(stored) } : defaultSubtitleSettings;
        } catch {
            return defaultSubtitleSettings;
        }
    });
    const {
        meta,
        metaLoading,
        streams,
        streamsLoading,
        activeEpisodeId,
        setActiveEpisodeId,
        isFullyLoaded,
    } = useDetails(launchState.type, launchState.id, {
        skipStreams: !launchState.type || !launchState.id,
        skipMeta: false,
    });

    const payloadSource = useMemo<SourceOption | null>(() => {
        if (!launchState.playbackUrl) {
            return null;
        }

        const subtitles = toSubtitleOptions(launchState.subtitles);
        const playbackUrl = launchState.playbackUrl || undefined;
        const kind = launchState.sourceKind === "local"
            ? "local"
            : launchState.sourceKind === "torrent"
                    ? "torrent"
                    : launchState.sourceKind === "youtube"
                        ? "youtube"
                        : launchState.sourceKind === "hls"
                            ? "hls"
                            : launchState.sourceKind === "dash"
                                ? "dash"
                                : playbackUrl
                                    ? "direct"
                                : "direct";

        return {
            id: "launch-source",
            kind,
            label: launchState.sourceLabel || "Selected Source",
            description: launchState.sourceDescription || launchState.title || launchState.playbackUrl || "Selected source",
            badges: ["Launch"],
            url: playbackUrl,
            requestHeaders: launchState.requestHeaders || undefined,
            ytId: kind === "youtube" && playbackUrl ? playbackUrl : undefined,
            subtitles,
            isLikelyPlayable: Boolean(playbackUrl),
            isNativePreferred: true,
        };
    }, [launchState]);

    const nativePlaybackRequestActive = Boolean(launchState.playbackUrl || meta?.localPath);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            const nextDesktopShell = isDesktopShell();
            setDesktopShell(nextDesktopShell);
            setCurrentPlayerWindowLabel(nextDesktopShell ? null : "player");
            setDesktopEnvironmentResolved(true);
            debugPlayerEvent("desktop-environment-resolved", {
                nextDesktopShell,
                initialPlaybackUrl: initialQuery.playbackUrl,
            });
        });

        return () => {
            window.cancelAnimationFrame(frame);
        };
    }, [initialQuery.playbackUrl]);

    useEffect(() => {
        if (!desktopEnvironmentResolved || !desktopShell) return;

        if (!desktopShell) return;

        const frame = window.requestAnimationFrame(() => {
            void (async () => {
            try {
                const label = await getCurrentDesktopWindowLabel();
                setCurrentPlayerWindowLabel(label);
                debugPlayerEvent("window-label-resolved", { label });
            } catch (error) {
                console.error("[native-player] failed to resolve current window label", error);
                setPlayerError("Goblin Player could not attach to the desktop window.");
                setPlayerLoading(false);
                debugPlayerEvent("window-label-error", {
                    error: formatUnknownError(error, "unknown-window-label-error"),
                });
            }
            })();
        });

        return () => {
            window.cancelAnimationFrame(frame);
        };
    }, [desktopEnvironmentResolved, desktopShell]);

    useEffect(() => {
        if (!launchState.episodeId || launchState.episodeId === activeEpisodeId) return;
        setActiveEpisodeId(launchState.episodeId);
    }, [activeEpisodeId, launchState.episodeId, setActiveEpisodeId]);

    useEffect(() => {
        if (!desktopShell || !currentPlayerWindowLabel) return;

        document.documentElement.dataset.playerSurface = "goblin";
        document.body.dataset.playerSurface = "goblin";

        return () => {
            delete document.documentElement.dataset.playerSurface;
            delete document.body.dataset.playerSurface;
        };
    }, [currentPlayerWindowLabel, desktopShell]);

    useEffect(() => {
        if (!desktopShell || !currentPlayerWindowLabel) return;

        const currentWindow = getCurrentDesktopWindow();
        let disposed = false;
        let unlisten: (() => void) | null = null;

        void currentWindow.listen<PlayerLaunchPayload>(playerOpenEvent, (event) => {
            if (disposed) return;
            const nextLaunchState = normalizePlayerPayload(event.payload);
            setSelectedSourceId(
                typeof nextLaunchState.sourceIndex === "number"
                    ? `stream-${nextLaunchState.sourceIndex}`
                    : nextLaunchState.playbackUrl
                        ? "launch-source"
                        : null,
            );
            setOpenPanel(null);
            setSelectedAudioTrackId("auto");
            setSelectedSubtitleTrackId("off");
            setLaunchState(nextLaunchState);
        }).then((cleanup) => {
            unlisten = cleanup;
        }).catch(() => undefined);

        return () => {
            disposed = true;
            unlisten?.();
        };
    }, [currentPlayerWindowLabel, desktopShell]);

    useEffect(() => {
        if (!desktopShell || !currentPlayerWindowLabel) return;

        return () => {
            void destroy(currentPlayerWindowLabel).catch(() => undefined);
        };
    }, [currentPlayerWindowLabel, desktopShell]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(subtitleSettingsStorageKey, JSON.stringify(subtitleSettings));
    }, [subtitleSettings]);

    useEffect(() => {
        if (!currentPlayerWindowLabel || !playerReady || playbackBackend !== "native") return;

        void setProperty("sub-ass-override", "force", currentPlayerWindowLabel).catch(() => undefined);
        void setProperty("sub-font", subtitleSettings.font, currentPlayerWindowLabel).catch(() => undefined);
        void setProperty("sub-font-size", subtitleSettings.size, currentPlayerWindowLabel).catch(() => undefined);
        void setProperty("sub-color", hexToMpvColor(subtitleSettings.color), currentPlayerWindowLabel).catch(() => undefined);
        void setProperty("sub-back-color", hexToMpvColor(subtitleSettings.backgroundColor, subtitleSettings.backgroundOpacity), currentPlayerWindowLabel).catch(() => undefined);
        void setProperty("sub-delay", subtitleSettings.delay, currentPlayerWindowLabel).catch(() => undefined);
    }, [currentPlayerWindowLabel, playerReady, playbackBackend, subtitleSettings]);

    const sourceOptions: SourceOption[] = useMemo(() => {
        const options = meta?.localOnly
            ? [{
                id: "local-file",
                kind: "local",
                label: "Local File",
                description: meta.localPath || meta.name,
                badges: ["Local"],
                subtitles: [],
                isLikelyPlayable: true,
                isNativePreferred: true,
            } satisfies SourceOption]
            : streams.map(buildSourceOption);

        if (!payloadSource) {
            return options;
        }

        if (options.length === 0) {
            return [payloadSource];
        }

        if (typeof launchState.sourceIndex === "number") {
            return options;
        }

        const hasMatchingOption = options.some((option) =>
            option.url === payloadSource.url
            && option.kind === payloadSource.kind
        );

        return hasMatchingOption ? options : [payloadSource, ...options];
    }, [launchState.sourceIndex, meta, payloadSource, streams]);

    const selectedSource = sourceOptions.find((option) => option.id === selectedSourceId)
        || payloadSource
        || sourceOptions.find((option) => option.isLikelyPlayable)
        || sourceOptions[0]
        || null;
    const loadingLogoUrl = meta?.logo || tmdbLogoUrl;

    useEffect(() => {
        let cancelled = false;

        if (!meta) {
            queueMicrotask(() => {
                if (!cancelled) {
                    setTmdbLogoUrl(null);
                }
            });
            return () => {
                cancelled = true;
            };
        }

        if (meta.logo) {
            queueMicrotask(() => {
                if (!cancelled) {
                    setTmdbLogoUrl(null);
                }
            });
            return () => {
                cancelled = true;
            };
        }

        const year = extractReleaseYear(meta.releaseInfo);
        const params = new URLSearchParams({
            type: meta.type === "series" ? "series" : "movie",
            id: meta.id,
            title: meta.name,
        });

        if (meta.imdb_id) {
            params.set("imdbId", meta.imdb_id);
        }

        if (year) {
            params.set("year", year);
        }

        void fetch(`/api/tmdb/logo?${params.toString()}`, { cache: "no-store" })
            .then((response) => response.json())
            .then((payload: { logoUrl?: string | null }) => {
                if (cancelled) return;
                setTmdbLogoUrl(payload.logoUrl || null);
            })
            .catch(() => {
                if (cancelled) return;
                setTmdbLogoUrl(null);
            });

        return () => {
            cancelled = true;
        };
    }, [meta]);

    useEffect(() => {
        let cancelled = false;

        if (!addonsLoaded || !meta || !selectedSource?.stream) {
            queueMicrotask(() => {
                if (!cancelled) {
                    setAddonSubtitles([]);
                }
            });
            return () => {
                cancelled = true;
            };
        }

        const subtitleLookupId = meta.type === "series"
            ? activeEpisodeId || launchState.episodeId || null
            : meta.imdb_id || launchState.id;
        if (!subtitleLookupId) {
            queueMicrotask(() => {
                if (!cancelled) {
                    setAddonSubtitles([]);
                }
            });
            return () => {
                cancelled = true;
            };
        }
        const stream = selectedSource.stream;

        void fetchStremioSubtitles(
            installedAddons,
            decodeURIComponent(launchState.type),
            subtitleLookupId,
            {
                videoId: meta.type === "series" ? subtitleLookupId : undefined,
                videoHash: stream.behaviorHints?.videoHash,
                videoSize: stream.behaviorHints?.videoSize,
            },
        )
            .then((subtitles) => {
                if (cancelled) return;
                setAddonSubtitles(subtitles.map((subtitle, index) => ({
                    id: subtitle.id || `addon-subtitle-${index}`,
                    label: `${getLanguageLabel(subtitle.lang)} Subtitle`,
                    lang: subtitle.lang,
                    url: subtitle.url,
                })));
            })
            .catch(() => {
                if (cancelled) return;
                setAddonSubtitles([]);
            });

        return () => {
            cancelled = true;
        };
    }, [
        activeEpisodeId,
        addonsLoaded,
        installedAddons,
        launchState.episodeId,
        launchState.id,
        launchState.type,
        meta,
        selectedSource,
    ]);

    const refreshTrackState = useCallback(async () => {
        if (!currentPlayerWindowLabel) return;

        const [aid, sid, trackList] = await Promise.all([
            getProperty<unknown>("aid", "int64", currentPlayerWindowLabel)
                .catch(() => getProperty<unknown>("aid", "string", currentPlayerWindowLabel))
                .catch(() => null),
            getProperty<unknown>("sid", "int64", currentPlayerWindowLabel)
                .catch(() => getProperty<unknown>("sid", "string", currentPlayerWindowLabel))
                .catch(() => null),
            getProperty<unknown>("track-list", "node", currentPlayerWindowLabel).catch(() => []),
        ]);

        const nextTracks = normalizeMpvTracks(
            trackList,
            readNumericProperty(aid),
            readNumericProperty(sid),
        );
        setAudioTracks(nextTracks.audioTracks);
        setSubtitleTracks(nextTracks.subtitleTracks);
        setSelectedAudioTrackId(nextTracks.audioTracks.find((track) => track.selected)?.id || "auto");
        setSelectedSubtitleTrackId(nextTracks.subtitleTracks.find((track) => track.selected)?.id || "off");
    }, [currentPlayerWindowLabel]);

    const syncPlaybackState = useCallback(async () => {
        if (!currentPlayerWindowLabel) return;

        const [pause, timePos, duration, volume, mediaTitle] = await Promise.all([
            getProperty<unknown>("pause", "flag", currentPlayerWindowLabel).catch(() => null),
            getProperty<unknown>("time-pos", "double", currentPlayerWindowLabel).catch(() => null),
            getProperty<unknown>("duration", "double", currentPlayerWindowLabel).catch(() => null),
            getProperty<unknown>("volume", "double", currentPlayerWindowLabel).catch(() => null),
            getProperty<unknown>("media-title", "string", currentPlayerWindowLabel).catch(() => null),
        ]);

        const nextPause = readBooleanProperty(pause);
        const nextTimePos = readNumericProperty(timePos);
        const nextDuration = readNumericProperty(duration);
        const nextVolume = readNumericProperty(volume);
        const nextMediaTitle = readStringProperty(mediaTitle);

        setPlaybackState((current) => ({
            ...current,
            pause: nextPause ?? current.pause,
            timePos: nextTimePos ?? current.timePos,
            duration: nextDuration ?? current.duration,
            volume: nextVolume ?? current.volume,
            mediaTitle: nextMediaTitle || current.mediaTitle,
        }));
    }, [currentPlayerWindowLabel]);

    const resolvedSource = useMemo(() => {
        if (!selectedSource) {
            return null;
        }

        if (selectedSource.kind === "local") {
            return {
                kind: "local" as const,
                playbackUrl: meta?.localPath || selectedSource.url || launchState.playbackUrl || "",
                subtitles: mergeSubtitleOptions(selectedSource.subtitles, addonSubtitles),
                requestHeaders: null,
                note: meta?.localPath || selectedSource.url || launchState.playbackUrl
                    ? "Playing the local file directly through libmpv."
                    : "The local file path is missing.",
            };
        }

        if (selectedSource.kind === "torrent") {
            const torrentUrl = getTorrentPlaybackUrl(selectedSource.stream || {});
            return {
                kind: "direct" as const,
                playbackUrl: torrentUrl || selectedSource.url || launchState.playbackUrl || "",
                subtitles: mergeSubtitleOptions(selectedSource.subtitles, addonSubtitles),
                requestHeaders: selectedSource.requestHeaders || null,
                note: torrentUrl
                    ? "Torrent playback is routed through the local Stremio-compatible stream server."
                    : "This torrent source does not expose a playable file index.",
            };
        }

        if (selectedSource.kind === "youtube" && selectedSource.ytId) {
            return {
                kind: "youtube" as const,
                playbackUrl: selectedSource.ytId.startsWith("http")
                    ? selectedSource.ytId
                    : `https://www.youtube.com/watch?v=${selectedSource.ytId}`,
                subtitles: mergeSubtitleOptions(selectedSource.subtitles, addonSubtitles),
                requestHeaders: selectedSource.requestHeaders || null,
                note: "YouTube playback is delegated to mpv's network backend.",
            };
        }

        const playbackUrl = selectedSource.url || launchState.playbackUrl || "";

        if (!playbackUrl) {
            return {
                kind: selectedSource.kind,
                playbackUrl: "",
                subtitles: mergeSubtitleOptions(selectedSource.subtitles, addonSubtitles),
                requestHeaders: selectedSource.requestHeaders || null,
                note: "The selected source does not provide a playable URL.",
            };
        }

        return {
            kind: selectedSource.kind,
            playbackUrl,
            subtitles: mergeSubtitleOptions(selectedSource.subtitles, addonSubtitles),
            requestHeaders: selectedSource.requestHeaders || null,
            note: selectedSource.requestHeaders
                ? "Loading the source directly with request headers passed to Goblin Player."
                : undefined,
        };
    }, [addonSubtitles, launchState.playbackUrl, meta?.localPath, selectedSource]);

    const inlineSourceError = resolvedSource && !resolvedSource.playbackUrl
        ? resolvedSource.note || "The selected source is not playable."
        : null;

    useEffect(() => {
        if (!desktopShell || !currentPlayerWindowLabel || !nativePlaybackRequestActive || !resolvedSource) return;
        if (!resolvedSource.playbackUrl) return;

        const sourceKey = JSON.stringify({
            windowLabel: currentPlayerWindowLabel,
            playbackUrl: resolvedSource.playbackUrl,
            headers: resolvedSource.requestHeaders || null,
        });

        if (initializedPlaybackKeyRef.current === sourceKey) return;

        let disposed = false;
        const runId = ++mpvInitRunIdRef.current;
        const isCurrentRun = () =>
            !disposed && runId === mpvInitRunIdRef.current;

        const bootstrap = async () => {
            let lastError: unknown = null;
            initializedPlaybackKeyRef.current = sourceKey;
            syncedSubtitleKeyRef.current = null;
            hasActiveMpvSessionRef.current = false;
            debugPlayerEvent("bootstrap-start", {
                windowLabel: currentPlayerWindowLabel,
                playbackUrl: resolvedSource.playbackUrl,
                kind: resolvedSource.kind,
            });
            setPlayerReady(false);
            setNativeMediaReady(false);
            setPlaybackBackend(null);
            setAudioTracks([]);
            setSubtitleTracks([]);
            setSelectedAudioTrackId("auto");
            setSelectedSubtitleTrackId("off");
            setPlaybackState((current) => ({
                ...current,
                pause: false,
                timePos: 0,
                duration: 0,
                mediaTitle: "",
            }));
            setPlayerLoading(true);
            setPlayerMessage(resolvedSource.note || null);
            setPlayerError(null);

            console.info("[native-player] bootstrap source", {
                kind: resolvedSource.kind,
                windowLabel: currentPlayerWindowLabel,
                hasHeaders: Boolean(resolvedSource.requestHeaders && Object.keys(resolvedSource.requestHeaders).length),
                subtitleCount: resolvedSource.subtitles.length,
                playbackUrl: resolvedSource.playbackUrl,
            });

            try {
                await bootstrapNativePlayer({
                    windowLabel: currentPlayerWindowLabel,
                    requestHeaders: resolvedSource.requestHeaders || null,
                    forceReinitialize: true,
                });

                if (resolvedSource.requestHeaders && Object.keys(resolvedSource.requestHeaders).length > 0) {
                    const headerFields = Object.entries(resolvedSource.requestHeaders)
                        .filter(([, value]) => Boolean(value))
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(", ");

                    if (headerFields) {
                        await setProperty("file-local-options/http-header-fields", headerFields, currentPlayerWindowLabel).catch(() => undefined);
                        await setProperty("http-header-fields", headerFields, currentPlayerWindowLabel).catch(() => undefined);
                    }
                }

                await withTimeout(
                    command("stop", [], currentPlayerWindowLabel).catch(() => undefined),
                    2500,
                    "Timed out while stopping the previous source.",
                ).catch(() => undefined);

                await withTimeout(
                    command("loadfile", [resolvedSource.playbackUrl, "replace"], currentPlayerWindowLabel),
                    15000,
                    "Timed out while asking the native player to load the selected source.",
                );

                await setVideoMarginRatio({ left: 0, right: 0, top: 0, bottom: 0 }, currentPlayerWindowLabel).catch(() => undefined);
                await setProperty("vid", "auto", currentPlayerWindowLabel).catch(() => undefined);
                await setProperty("aid", "auto", currentPlayerWindowLabel).catch(() => undefined);
                await setProperty("pause", false, currentPlayerWindowLabel).catch(() => undefined);
                await setProperty("sid", "no", currentPlayerWindowLabel).catch(() => undefined);

                if (!isCurrentRun()) return;

                hasActiveMpvSessionRef.current = true;
                setPlaybackBackend("native");
                setPlayerReady(true);

                const snapshot = await waitForNativeMediaSnapshot(currentPlayerWindowLabel, isCurrentRun);
                if (!isCurrentRun()) return;

                await syncPlaybackState().catch(() => undefined);
                await refreshTrackState().catch(() => undefined);
                const mediaReady = isNativeMediaReady(snapshot);
                setNativeMediaReady(mediaReady);
                setPlayerLoading(false);
                if (mediaReady) {
                    setPlayerMessage(null);
                }
                if (snapshot) {
                    console.info("[native-player] post-load snapshot", snapshot);
                    debugPlayerEvent(isNativeMediaReady(snapshot) ? "bootstrap-success" : "bootstrap-metadata-pending", {
                        windowLabel: currentPlayerWindowLabel,
                        snapshot,
                    });
                }
            } catch (error) {
                lastError = error;
                if (!isCurrentRun()) return;
                hasActiveMpvSessionRef.current = false;
                initializedPlaybackKeyRef.current = null;
                setPlayerReady(false);
                setNativeMediaReady(false);
                setPlaybackBackend(null);
                debugPlayerEvent("bootstrap-error", {
                    windowLabel: currentPlayerWindowLabel,
                    error: formatUnknownError(error, "unknown-bootstrap-error"),
                });

                const diagnostics = await diagnoseNativePlayerRuntime<LibmpvRuntimeDiagnostics>().catch(() => null);
                const diagnosticMessage = diagnostics ? formatLibmpvDiagnostics(diagnostics) : null;
                const bootstrapError = formatUnknownError(error, "Native playback unavailable for this source.");
                setPlayerError(
                    diagnosticMessage
                        ? `${bootstrapError} ${diagnosticMessage}`
                        : bootstrapError
                );

                if (lastError) {
                    console.warn(
                        "Native playback bootstrap failed.",
                        diagnosticMessage
                            ? `${formatUnknownError(lastError, "Unknown native playback error.")} ${diagnosticMessage}`
                            : formatUnknownError(lastError, "Unknown native playback error.")
                    );
                }
            } finally {
                if (isCurrentRun()) {
                    setPlayerLoading(false);
                }
            }
        };

        void bootstrap();

        return () => {
            disposed = true;
        };
    }, [currentPlayerWindowLabel, desktopShell, nativePlaybackRequestActive, refreshTrackState, resolvedSource, syncPlaybackState]);

    useEffect(() => {
        if (!currentPlayerWindowLabel || !playerReady || playbackBackend !== "native") return;

        let cancelled = false;
        let eventUnlistenPromise: Promise<(() => void) | void> | null = null;
        let propertyUnlistenPromise: Promise<(() => void) | void> | null = null;
        const scheduledSyncs = new Set<number>();

        const syncNow = async () => {
            if (cancelled) return;
            await syncPlaybackState().catch(() => undefined);
            if (cancelled) return;
            await refreshTrackState().catch(() => undefined);
            if (cancelled) return;
            const snapshot = await getNativePlayerDebugSnapshot<NativePlayerDebugSnapshot>(currentPlayerWindowLabel).catch(() => null);
            if (isNativeMediaReady(snapshot)) {
                setNativeMediaReady(true);
                setPlayerLoading(false);
                setPlayerMessage(null);
            }
        };

        const scheduleWarmupSync = () => {
            for (const delay of [120, 350, 800, 1500, 2500]) {
                const timeout = window.setTimeout(() => {
                    scheduledSyncs.delete(timeout);
                    void syncNow().catch(() => undefined);
                }, delay);
                scheduledSyncs.add(timeout);
            }
        };

        void syncNow();
        scheduleWarmupSync();

        const interval = window.setInterval(() => {
            void syncNow().catch(() => undefined);
        }, 1000);

        propertyUnlistenPromise = observeProperties(observedPlaybackProperties, (event) => {
            if (cancelled) return;

            switch (event.name) {
                case "pause":
                    setPlaybackState((current) => ({ ...current, pause: readBooleanProperty(event.data) ?? current.pause }));
                    break;
                case "time-pos":
                    setPlaybackState((current) => ({ ...current, timePos: readNumericProperty(event.data) ?? current.timePos }));
                    break;
                case "duration":
                    setPlaybackState((current) => ({ ...current, duration: readNumericProperty(event.data) ?? current.duration }));
                    break;
                case "volume":
                    setPlaybackState((current) => ({ ...current, volume: readNumericProperty(event.data) ?? current.volume }));
                    break;
                case "media-title":
                    setPlaybackState((current) => ({ ...current, mediaTitle: readStringProperty(event.data) || current.mediaTitle }));
                    break;
                case "aid":
                case "sid":
                case "track-list":
                    void refreshTrackState().catch(() => undefined);
                    break;
                default:
                    break;
            }
        }, currentPlayerWindowLabel).catch(() => undefined);

        eventUnlistenPromise = listenEvents((event) => {
            if (cancelled) return;

            switch (event.event) {
                case "file-loaded":
                case "playback-restart":
                case "video-reconfig":
                case "audio-reconfig":
                case "seek":
                    setNativeMediaReady(true);
                    setPlayerLoading(false);
                    setPlayerMessage(null);
                    scheduleWarmupSync();
                    void syncNow();
                    break;
                case "end-file":
                    scheduleWarmupSync();
                    void syncNow();
                    break;
                default:
                    break;
            }
        }, currentPlayerWindowLabel).catch(() => undefined);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            for (const timeout of scheduledSyncs) {
                window.clearTimeout(timeout);
            }
            void eventUnlistenPromise?.then((unlisten) => unlisten?.()).catch(() => undefined);
            void propertyUnlistenPromise?.then((unlisten) => unlisten?.()).catch(() => undefined);
        };
    }, [currentPlayerWindowLabel, playbackBackend, playerReady, refreshTrackState, syncPlaybackState]);

    useEffect(() => {
        if (!desktopShell || !currentPlayerWindowLabel || !nativeMediaReady) {
            queueMicrotask(() => setControlsVisible(true));
            return;
        }

        let idleTimer: number | null = null;
        const showChrome = () => {
            setControlsVisible(true);
            if (idleTimer !== null) {
                window.clearTimeout(idleTimer);
            }
            idleTimer = window.setTimeout(() => {
                setControlsVisible(false);
                setOpenPanel(null);
            }, chromeIdleDelayMs);
        };

        showChrome();
        window.addEventListener("mousemove", showChrome);
        window.addEventListener("mousedown", showChrome);
        window.addEventListener("keydown", showChrome);
        window.addEventListener("touchstart", showChrome, { passive: true });

        return () => {
            if (idleTimer !== null) {
                window.clearTimeout(idleTimer);
            }
            window.removeEventListener("mousemove", showChrome);
            window.removeEventListener("mousedown", showChrome);
            window.removeEventListener("keydown", showChrome);
            window.removeEventListener("touchstart", showChrome);
        };
    }, [currentPlayerWindowLabel, desktopShell, nativeMediaReady]);

    useEffect(() => {
        if (!currentPlayerWindowLabel || !playerReady || playbackBackend !== "native" || !resolvedSource) return;

        const subtitleKey = JSON.stringify({
            windowLabel: currentPlayerWindowLabel,
            playbackUrl: resolvedSource.playbackUrl,
            subtitles: resolvedSource.subtitles.map((subtitle) => ({
                url: subtitle.url,
                label: subtitle.label,
                lang: subtitle.lang,
            })),
        });

        if (syncedSubtitleKeyRef.current === subtitleKey) {
            return;
        }

        let cancelled = false;

        const syncExternalSubtitles = async () => {
            const trackList = await getProperty<unknown>("track-list", "node", currentPlayerWindowLabel).catch(() => []);
            const externalSubtitleTracks = takeTrackArray(trackList)
                .filter((track) => {
                    const rawTrackId = readMpvObjectField(track, "id");
                    const rawTrackType = readMpvObjectField(track, "type");
                    const rawTrackExternal = readMpvObjectField(track, "external");
                    return readStringProperty(rawTrackType) === "sub"
                        && (readBooleanProperty(rawTrackExternal) ?? Boolean(rawTrackExternal))
                        && readNumericProperty(rawTrackId) !== null;
                });

            for (const track of externalSubtitleTracks) {
                if (cancelled) return;
                const trackId = readNumericProperty(readMpvObjectField(track, "id"));
                if (trackId !== null) {
                    await command("sub-remove", [trackId], currentPlayerWindowLabel).catch(() => undefined);
                }
            }

            for (const subtitle of resolvedSource.subtitles) {
                if (cancelled) return;
                await command(
                    "sub-add",
                    [
                        subtitle.url,
                        "auto",
                        subtitle.label || "Subtitle",
                        subtitle.lang || "und",
                    ],
                    currentPlayerWindowLabel,
                ).catch(() => undefined);
            }

            if (cancelled) return;

            await setProperty("sid", "no", currentPlayerWindowLabel).catch(() => undefined);
            await refreshTrackState().catch(() => undefined);
            await delay(350);
            await refreshTrackState().catch(() => undefined);
            syncedSubtitleKeyRef.current = subtitleKey;
        };

        void syncExternalSubtitles();

        return () => {
            cancelled = true;
        };
    }, [currentPlayerWindowLabel, playbackBackend, playerReady, refreshTrackState, resolvedSource]);

    const nowPlayingLabel = (() => {
        if (!meta) return launchState.title || "Goblin Player";
        if (!activeEpisodeId || !meta.videos) return meta.name;
        const activeEpisode = meta.videos.find((video) => video.id === activeEpisodeId);
        return activeEpisode
            ? `${meta.name} - S${activeEpisode.season}E${activeEpisode.episode}`
            : meta.name;
    })();

    const pageTitle = meta?.name || launchState.title || "Goblin Player";
    const canRenderFromPayload = Boolean(launchState.playbackUrl);

    const handleAudioChange = async (trackId: string) => {
        if (!currentPlayerWindowLabel) return;

        setSelectedAudioTrackId(trackId);
        setOpenPanel(null);

        if (trackId === "auto") {
            await setProperty("aid", "auto", currentPlayerWindowLabel).catch(() => undefined);
            await refreshTrackState().catch(() => undefined);
            return;
        }

        const track = audioTracks.find((item) => item.id === trackId);
        if (track?.mpvTrackId === null || track?.mpvTrackId === undefined) return;
        await setProperty("aid", track.mpvTrackId, currentPlayerWindowLabel).catch(() => undefined);
        await refreshTrackState().catch(() => undefined);
    };

    const handleSubtitleChange = async (trackId: string) => {
        if (!currentPlayerWindowLabel) return;

        setSelectedSubtitleTrackId(trackId);
        setOpenPanel(null);

        if (trackId === "off") {
            await setProperty("sid", "no", currentPlayerWindowLabel).catch(() => undefined);
            await refreshTrackState().catch(() => undefined);
            return;
        }

        const track = subtitleTracks.find((item) => item.id === trackId);
        if (track?.mpvTrackId === null || track?.mpvTrackId === undefined) return;
        await setProperty("sid", track.mpvTrackId, currentPlayerWindowLabel).catch(() => undefined);
        await refreshTrackState().catch(() => undefined);
    };

    const handleSeek = async (direction: "forward" | "backward") => {
        if (!currentPlayerWindowLabel) return;

        await command("seek", [direction === "forward" ? 10 : -10, "relative"], currentPlayerWindowLabel).catch(() => undefined);
    };

    const handleTimelineSeek = async (value: number) => {
        if (!currentPlayerWindowLabel) return;

        const targetTime = Math.max(0, Math.min(value, playbackState.duration || 0));

        setPlaybackState((current) => ({
            ...current,
            timePos: targetTime,
        }));

        await command("seek", [targetTime, "absolute", "exact"], currentPlayerWindowLabel).catch(() => undefined);
    };

    const handlePauseToggle = async () => {
        if (!currentPlayerWindowLabel) return;

        const nextPause = !playbackState.pause;
        setPlaybackState((current) => ({ ...current, pause: nextPause }));
        await setProperty("pause", nextPause, currentPlayerWindowLabel).catch(() => undefined);
        await syncPlaybackState().catch(() => undefined);
    };

    const handleVolumeChange = async (value: number) => {
        if (!currentPlayerWindowLabel) return;

        const nextVolume = Math.max(0, Math.min(value, 130));
        setPlaybackState((current) => ({ ...current, volume: nextVolume }));
        await setProperty("volume", nextVolume, currentPlayerWindowLabel).catch(() => undefined);
        await syncPlaybackState().catch(() => undefined);
    };

    const handleBack = async () => {
        if (desktopShell && currentPlayerWindowLabel && currentPlayerWindowLabel !== "main") {
            await getCurrentDesktopWindow().close().catch(() => undefined);
            return;
        }

        await router.push(`/detail/${encodeURIComponent(launchState.type)}/${encodeURIComponent(launchState.id)}`);
    };

    if (!desktopEnvironmentResolved) {
        return (
            <main className="fixed inset-0 flex items-center justify-center bg-black px-6 text-center text-white">
                <div className="rounded-[2rem] border border-white/10 bg-black/70 px-8 py-10 backdrop-blur-2xl">
                    <span className="material-symbols-outlined animate-spin text-4xl text-white/35">progress_activity</span>
                </div>
            </main>
        );
    }

    if (!desktopShell) {
        return (
            <main className="fixed inset-0 flex items-center justify-center bg-black px-6 text-center text-white">
                <div className="max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-8">
                    <h1 className="text-2xl font-black">Goblin Player is desktop-only</h1>
                    <p className="mt-3 text-sm text-white/60">
                        Open this route from the MediaHoard desktop shell to use the libmpv-based Goblin Player.
                    </p>
                </div>
            </main>
        );
    }

    if (!currentPlayerWindowLabel) {
        return (
            <main className="fixed inset-0 flex items-center justify-center bg-black px-6 text-center text-white">
                <div className="rounded-[2rem] border border-white/10 bg-black/70 px-8 py-10 backdrop-blur-2xl">
                    <span className="material-symbols-outlined animate-spin text-4xl text-white/35">progress_activity</span>
                </div>
            </main>
        );
    }

    if (!canRenderFromPayload && (!isFullyLoaded || metaLoading)) {
        return (
            <main className="fixed inset-0 flex items-center justify-center bg-transparent">
                <span className="material-symbols-outlined animate-spin text-4xl text-white/35">progress_activity</span>
            </main>
        );
    }

    if (!meta && !canRenderFromPayload) {
        return (
            <main className="fixed inset-0 flex items-center justify-center bg-transparent px-6 text-center text-white">
                <div className="rounded-[2rem] border border-white/10 bg-black/70 px-8 py-10 backdrop-blur-2xl">
                    <h1 className="text-2xl font-black">Nothing to play</h1>
                    <p className="mt-3 text-sm text-white/55">The selected media could not be loaded.</p>
                </div>
            </main>
        );
    }

    return (
        <section
            onMouseMove={() => setControlsVisible(true)}
            onMouseDown={() => setControlsVisible(true)}
            className="fixed inset-0 overflow-hidden"
            style={{
                color: theme.streamsTextColor,
                fontFamily: theme.streamsFont,
                background: "transparent",
            }}
        >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.52)_0%,rgba(0,0,0,0.16)_70%,transparent_100%)] transition-opacity duration-300 ${controlsVisible || !nativeMediaReady ? "opacity-100" : "opacity-0"}`} />
            <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(0deg,rgba(0,0,0,0.7)_0%,rgba(0,0,0,0.24)_56%,transparent_100%)] transition-opacity duration-300 ${controlsVisible || !nativeMediaReady ? "opacity-100" : "opacity-0"}`} />
            <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_48%,rgba(0,0,0,0.18)_100%)] transition-opacity duration-300 ${controlsVisible || !nativeMediaReady ? "opacity-100" : "opacity-0"}`} />
            {playerLoading && !nativeMediaReady && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
                    <div className="relative flex max-w-[70vw] items-center justify-center overflow-hidden rounded-[2rem] px-10 py-8">
                        <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.02)_45%,transparent_80%)]" />
                        <div className="absolute inset-0 rounded-[2rem] shadow-[0_0_90px_rgba(255,255,255,0.18)]" />
                        <div className="absolute inset-y-0 left-[-45%] w-[40%] rotate-[18deg] bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.08)_45%,rgba(255,255,255,0.68)_50%,rgba(255,255,255,0.08)_55%,transparent_100%)] blur-md [animation:shimmer_2.8s_linear_infinite]" />
                        {loadingLogoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={loadingLogoUrl}
                                alt={`${pageTitle} logo`}
                                className="relative z-10 max-h-28 max-w-[52vw] object-contain drop-shadow-[0_0_28px_rgba(255,255,255,0.34)] md:max-h-36 [animation:goblin-loading-logo_3.2s_ease-in-out_infinite]"
                            />
                        ) : (
                            <div className="relative z-10 text-center">
                                <div className="text-xs font-black uppercase tracking-[0.32em] text-white/45">Loading</div>
                                <div className="mt-3 text-3xl font-black text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.2)]">
                                    {pageTitle}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className={`absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 transition-opacity duration-300 md:p-6 ${controlsVisible || !nativeMediaReady || openPanel ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
                <div className="flex items-start gap-3">
                    <button
                        type="button"
                        onClick={() => void handleBack()}
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white backdrop-blur-xl transition hover:bg-black/75"
                    >
                        <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                    </button>
                    <div
                        className="flex items-start gap-4 rounded-[1.4rem] border border-white/10 px-4 py-3 backdrop-blur-xl"
                        style={{ backgroundColor: theme.streamsBackgroundColor }}
                    >
                        <div className="shrink-0 self-start">
                            <Image
                                src={goblinPlayerLogo}
                                alt="Goblin Player logo"
                                width={92}
                                height={92}
                                priority
                                className="h-[92px] w-[92px] object-contain"
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-black uppercase tracking-[0.22em] text-white/50">Goblin Player</div>
                            <div className="mt-1 text-lg font-black text-white">{pageTitle}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/50">{nowPlayingLabel}</div>
                            {selectedSource && (
                                <div className="mt-2 max-w-[460px] text-sm text-white/70 line-clamp-2">{selectedSource.description}</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex max-w-[520px] flex-col items-end gap-2">
                    {((playerLoading && !nativeMediaReady) || playerError || (playerMessage && !nativeMediaReady)) && (
                        <>
                            {playerLoading && !nativeMediaReady && (
                                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur-xl">
                                    <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                                    Loading Source
                                </div>
                            )}
                            {playerMessage && !nativeMediaReady && (
                                <div className="rounded-2xl border border-white/10 bg-black/65 px-4 py-3 text-sm text-white/75 backdrop-blur-xl">
                                    {playerMessage}
                                </div>
                            )}
                            {(playerError || inlineSourceError) && (
                                <div className="rounded-2xl border border-red-500/20 bg-red-500/15 px-4 py-3 text-sm text-red-100 backdrop-blur-xl">
                                    {playerError || inlineSourceError}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes goblin-loading-logo {
                    0% {
                        opacity: 1;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.4;
                        transform: scale(0.92);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
            `}</style>

            {openPanel && (
                <div className="absolute inset-0 z-30" onClick={() => setOpenPanel(null)}>
                    <div
                        className="absolute bottom-24 left-4 right-4 rounded-[1.8rem] border border-white/10 bg-black/82 p-4 text-white backdrop-blur-3xl md:left-auto md:right-6 md:w-[460px]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {openPanel === "sources" && (
                            <div>
                                <div className="mb-4">
                                    <h4 className="text-lg font-black">Sources</h4>
                                    <p className="text-sm text-white/45">
                                        {streamsLoading && sourceOptions.length <= 1 && !canRenderFromPayload ? "Loading source metadata..." : `${sourceOptions.length} source${sourceOptions.length === 1 ? "" : "s"} available`}
                                    </p>
                                </div>
                                <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                                    {sourceOptions.map((option) => {
                                        const isActive = option.id === selectedSource?.id;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                className={`w-full rounded-2xl border p-4 text-left transition ${isActive ? "border-white bg-white text-black" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                                                onClick={() => {
                                                    setSelectedSourceId(option.id);
                                                    setSelectedAudioTrackId("auto");
                                                    setSelectedSubtitleTrackId("off");
                                                    setOpenPanel(null);
                                                }}
                                            >
                                                <div className="text-xs font-black uppercase tracking-[0.22em]">{option.label}</div>
                                                <div className="mt-2 text-sm leading-relaxed opacity-80 line-clamp-3">{option.description}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {openPanel === "audio" && (
                            <div>
                                <h4 className="mb-4 text-lg font-black">Audio Tracks</h4>
                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${selectedAudioTrackId === "auto" ? "border-white bg-white text-black" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                                        onClick={() => void handleAudioChange("auto")}
                                    >
                                        Auto / Default
                                    </button>
                                    {audioTracks.map((track) => (
                                        <button
                                            key={track.id}
                                            type="button"
                                            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${selectedAudioTrackId === track.id ? "border-white bg-white text-black" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                                            onClick={() => void handleAudioChange(track.id)}
                                        >
                                            {track.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {openPanel === "subtitles" && (
                            <div>
                                <h4 className="mb-4 text-lg font-black">Subtitles</h4>
                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${selectedSubtitleTrackId === "off" ? "border-white bg-white text-black" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                                        onClick={() => void handleSubtitleChange("off")}
                                    >
                                        Off
                                    </button>
                                    {subtitleTracks.map((track) => (
                                        <button
                                            key={track.id}
                                            type="button"
                                            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${selectedSubtitleTrackId === track.id ? "border-white bg-white text-black" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                                            onClick={() => void handleSubtitleChange(track.id)}
                                        >
                                            {track.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {openPanel === "style" && (
                            <div className="space-y-5">
                                <h4 className="text-lg font-black">Subtitle Style</h4>
                                <label className="grid gap-2">
                                    <span className="text-xs font-black uppercase tracking-[0.22em] text-white/45">Font</span>
                                    <input
                                        type="text"
                                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                                        value={subtitleSettings.font}
                                        onChange={(event) => setSubtitleSettings((current) => ({ ...current, font: event.target.value }))}
                                    />
                                </label>
                                <label className="grid gap-2">
                                    <span className="text-xs font-black uppercase tracking-[0.22em] text-white/45">Text Size</span>
                                    <input
                                        type="range"
                                        min={28}
                                        max={84}
                                        value={subtitleSettings.size}
                                        onChange={(event) => setSubtitleSettings((current) => ({ ...current, size: Number(event.target.value) }))}
                                    />
                                </label>
                                <label className="grid gap-2">
                                    <span className="text-xs font-black uppercase tracking-[0.22em] text-white/45">Text Color</span>
                                    <input
                                        type="color"
                                        className="h-11 w-full rounded-xl border border-white/10 bg-black/40 p-1"
                                        value={subtitleSettings.color}
                                        onChange={(event) => setSubtitleSettings((current) => ({ ...current, color: event.target.value }))}
                                    />
                                </label>
                                <label className="grid gap-2">
                                    <span className="text-xs font-black uppercase tracking-[0.22em] text-white/45">Background Color</span>
                                    <input
                                        type="color"
                                        className="h-11 w-full rounded-xl border border-white/10 bg-black/40 p-1"
                                        value={subtitleSettings.backgroundColor}
                                        onChange={(event) => setSubtitleSettings((current) => ({ ...current, backgroundColor: event.target.value }))}
                                    />
                                </label>
                                <label className="grid gap-2">
                                    <span className="text-xs font-black uppercase tracking-[0.22em] text-white/45">Background Opacity</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={subtitleSettings.backgroundOpacity}
                                        onChange={(event) => setSubtitleSettings((current) => ({ ...current, backgroundOpacity: Number(event.target.value) }))}
                                    />
                                </label>
                                <label className="grid gap-2">
                                    <span className="text-xs font-black uppercase tracking-[0.22em] text-white/45">Delay (seconds)</span>
                                    <input
                                        type="number"
                                        min={-30}
                                        max={30}
                                        step={0.1}
                                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                                        value={subtitleSettings.delay}
                                        onChange={(event) => setSubtitleSettings((current) => ({ ...current, delay: Number(event.target.value) }))}
                                    />
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className={`absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 transition-opacity duration-300 md:p-6 ${controlsVisible || !nativeMediaReady || openPanel ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
                <div
                    className="flex w-full max-w-[1220px] flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/10 px-4 py-4 text-white shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
                    style={{ backgroundColor: theme.streamsBackgroundColor }}
                >
                    <div className="w-full">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-white/55">
                            <span>{formatPlaybackTime(playbackState.timePos)}</span>
                            <span>{formatPlaybackTime(playbackState.duration)}</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={Math.max(playbackState.duration, 0)}
                            step={0.1}
                            value={Math.min(playbackState.timePos, playbackState.duration || 0)}
                            disabled={playbackState.duration <= 0}
                            aria-label="Seek timeline"
                            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-white disabled:cursor-not-allowed disabled:opacity-40"
                            onChange={(event) => void handleTimelineSeek(Number(event.target.value))}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            aria-label={playbackState.pause ? "Play" : "Pause"}
                            className={`${baseButtonClassName} flex items-center justify-center border-white bg-white text-black`}
                            onClick={() => void handlePauseToggle()}
                        >
                            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                {playbackState.pause ? "play_arrow" : "pause"}
                            </span>
                        </button>
                        <button type="button" className={`${baseButtonClassName} border-white/10 bg-white/5 text-white hover:bg-white/10`} onClick={() => setOpenPanel((current) => current === "sources" ? null : "sources")}>
                            Sources
                        </button>
                        <button type="button" className={`${baseButtonClassName} border-white/10 bg-white/5 text-white hover:bg-white/10`} onClick={() => setOpenPanel((current) => current === "audio" ? null : "audio")}>
                            Audio
                        </button>
                        <button type="button" className={`${baseButtonClassName} border-white/10 bg-white/5 text-white hover:bg-white/10`} onClick={() => setOpenPanel((current) => current === "subtitles" ? null : "subtitles")}>
                            Subtitles
                        </button>
                        <button type="button" className={`${baseButtonClassName} border-white/10 bg-white/5 text-white hover:bg-white/10`} onClick={() => setOpenPanel((current) => current === "style" ? null : "style")}>
                            Subtitle Style
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" className={`${baseButtonClassName} border-white/10 bg-white/5 text-white hover:bg-white/10`} onClick={() => void handleSeek("backward")}>
                            -10s
                        </button>
                        <button type="button" className={`${baseButtonClassName} border-white/10 bg-white/5 text-white hover:bg-white/10`} onClick={() => void handleSeek("forward")}>
                            +10s
                        </button>
                        <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
                            <span>Volume</span>
                            <input
                                type="range"
                                min={0}
                                max={130}
                                value={Math.round(playbackState.volume)}
                                onChange={(event) => void handleVolumeChange(Number(event.target.value))}
                            />
                        </label>
                    </div>

                    <div className="w-full text-xs uppercase tracking-[0.18em] text-white/50">
                        {playbackState.mediaTitle || nowPlayingLabel}
                    </div>
                </div>
            </div>
        </section>
    );
}
