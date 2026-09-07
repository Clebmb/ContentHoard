"use client";

import { useState, useEffect } from "react";
import { useAddons } from "./use-addons";
import type { Addon, AddonManifestResource } from "@/components/addons/addon-card";
import { useLibrary, MetaItem } from "./use-library";

// --- Types ---
export interface CastMember {
    name: string;
    character?: string;
    url?: string;
}

export interface MetaVideo {
    id: string;
    title: string;
    released: string;
    season: number;
    episode: number;
    name?: string;
    thumbnail?: string;
    overview?: string;
}

export interface MetaDetail extends MetaItem {
    background?: string;
    logo?: string;
    runtime?: string;
    director?: string[];
    cast?: string[] | CastMember[];
    videos?: MetaVideo[];
    imdb_id?: string;
    imdbRating?: string | number;
}

export interface Stream {
    description?: string;
    name?: string;
    title?: string;
    url?: string;
    externalUrl?: string;
    ytId?: string;
    infoHash?: string;
    fileIdx?: number;
    subtitles?: Array<{
        id: string;
        url: string;
        lang: string;
    }>;
    behaviorHints?: {
        bingeGroup?: string;
        filename?: string;
        notWebReady?: boolean;
        videoHash?: string;
        videoSize?: number;
        proxyHeaders?: {
            request?: Record<string, string>;
            response?: Record<string, string>;
        };
    };
}

export interface Subtitle {
    id: string;
    url: string;
    lang: string;
}

class PriorityFetchQueue {
    private queue: { priority: number, task: () => Promise<unknown>, resolve: (v: unknown) => void, reject: (e: unknown) => void }[] = [];
    private activeCount = 0;
    private maxConcurrency = 3;

    async add<T>(task: () => Promise<T>, priority: number = 0): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({
                priority,
                task: async () => task(),
                resolve: (value) => resolve(value as T),
                reject: (error) => reject(error),
            });
            this.queue.sort((a, b) => b.priority - a.priority);
            this.process();
        });
    }

    private async process() {
        if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) return;

        const { task, resolve, reject } = this.queue.shift()!;
        this.activeCount++;

        try {
            const result = await task();
            resolve(result);
        } catch (e) {
            reject(e);
        } finally {
            this.activeCount--;
            this.process();
        }
    }
}

const fetchQueue = new PriorityFetchQueue();

const matchesAddonResource = (
    addon: Addon,
    resourceName: string,
    type: string,
    id: string,
) => {
    const resources = addon.resources || [];
    if (resources.length === 0) {
        return true;
    }

    const matchingResource = resources.find((resource) =>
        typeof resource === "string" ? resource === resourceName : resource.name === resourceName
    );

    if (!matchingResource) return false;

    const resourceConfig: AddonManifestResource | null =
        typeof matchingResource === "string" ? null : matchingResource;

    const supportedTypes = resourceConfig?.types || addon.types || [];
    if (supportedTypes.length > 0 && !supportedTypes.includes(type)) {
        return false;
    }

    const idPrefixes = resourceConfig?.idPrefixes || addon.idPrefixes || [];
    if (idPrefixes.length > 0 && !idPrefixes.some((prefix) => id.startsWith(prefix))) {
        return false;
    }

    return true;
};

export const fetchStremioMeta = async (addons: Addon[], type: string, id: string): Promise<MetaDetail | null> => {
    const metaAddons = addons.filter((addon) =>
        addon.manifestUrl && matchesAddonResource(addon, "meta", type, id)
    );

    if (metaAddons.length === 0) return null;

    const fetchWithQueue = async (addon: Addon) => {
        if (!addon.manifestUrl) return null;
        return fetchQueue.add(async () => {
            try {
                const res = await fetch(
                    `/api/addon/meta?manifestUrl=${encodeURIComponent(addon.manifestUrl!)}&type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`,
                    { cache: "no-store" },
                );
                if (!res.ok) return null;
                const data = await res.json();
                return data.meta || null;
            } catch { return null; }
        }, 15);
    };

    for (const addon of metaAddons) {
        const meta = await fetchWithQueue(addon);
        if (meta) return meta;
    }
    return null;
};

export const fetchStremioStreams = async (addons: Addon[], type: string, id: string): Promise<Stream[]> => {
    const streamAddons = addons.filter((addon) =>
        addon.manifestUrl && matchesAddonResource(addon, "stream", type, id)
    );

    const promises = streamAddons.map(async (addon) => {
        if (!addon.manifestUrl) return [];
        try {
            const res = await fetch(
                `/api/addon/stream?manifestUrl=${encodeURIComponent(addon.manifestUrl!)}&type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`,
                { cache: "no-store" },
            );
            if (!res.ok) {
                return [];
            }
            const data = await res.json();
            return (data.streams || []).map((s: Stream) => ({
                ...s,
                name: s.name || addon.name
            }));
        } catch {
            return [];
        }
    });

    const results = await Promise.all(promises);
    return results.flat();
};

export const mergeStreamSubtitles = (
    streams: Stream[],
    subtitles: Subtitle[],
) => {
    if (subtitles.length === 0) {
        return streams;
    }

    return streams.map((stream, streamIndex) => {
        const seen = new Set(
            (stream.subtitles || []).map((subtitle) => `${subtitle.lang}:${subtitle.url}`),
        );
        const mergedSubtitles = [...(stream.subtitles || [])];

        subtitles.forEach((subtitle, subtitleIndex) => {
            const key = `${subtitle.lang}:${subtitle.url}`;
            if (seen.has(key)) {
                return;
            }

            seen.add(key);
            mergedSubtitles.push({
                id: subtitle.id || `addon-subtitle-${streamIndex}-${subtitleIndex}`,
                lang: subtitle.lang,
                url: subtitle.url,
            });
        });

        return {
            ...stream,
            subtitles: mergedSubtitles,
        };
    });
};

export const fetchStremioSubtitles = async (
    addons: Addon[],
    type: string,
    id: string,
    options?: {
        videoId?: string;
        videoHash?: string;
        videoSize?: number;
    }
): Promise<Subtitle[]> => {
    const subtitleAddons = addons.filter((addon) =>
        addon.manifestUrl && matchesAddonResource(addon, "subtitles", type, id)
    );

    const subtitleId = options?.videoHash || id;
    const extra = new URLSearchParams();

    if (options?.videoId) {
        extra.set("videoID", options.videoId);
    }

    if (typeof options?.videoSize === "number" && Number.isFinite(options.videoSize)) {
        extra.set("videoSize", String(options.videoSize));
    }

    const promises = subtitleAddons.map(async (addon) => {
        try {
            const response = await fetch(
                `/api/addon/subtitles?manifestUrl=${encodeURIComponent(addon.manifestUrl!)}&type=${encodeURIComponent(type)}&id=${encodeURIComponent(subtitleId)}&${extra.toString()}`
            );
            if (!response.ok) {
                return [];
            }

            const data = await response.json() as { subtitles?: Subtitle[] };
            return (data.subtitles || []).map((subtitle, index) => ({
                ...subtitle,
                id: subtitle.id || `${addon.id}-${subtitle.lang}-${index}`,
            }));
        } catch {
            return [];
        }
    });

    const results = await Promise.all(promises);
    const seen = new Set<string>();

    return results
        .flat()
        .filter((subtitle) => {
            const key = `${subtitle.lang}:${subtitle.url}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

export function useDetails(type: string, id: string, options?: { skipStreams?: boolean; skipMeta?: boolean }) {
    const { installedAddons, isLoaded: addonsLoaded } = useAddons();
    const { library, isLoaded: libraryLoaded } = useLibrary();
    const skipStreams = options?.skipStreams ?? false;
    const skipMeta = options?.skipMeta ?? false;
    
    const [meta, setMeta] = useState<MetaDetail | null>(null);
    const [streams, setStreams] = useState<Stream[]>([]);
    const [metaLoading, setMetaLoading] = useState(true);
    const [streamsLoading, setStreamsLoading] = useState(true);
    const [activeSeason, setActiveSeason] = useState<number>(1);
    const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);

    useEffect(() => {
        if (!addonsLoaded || !libraryLoaded) return;
        if (skipMeta) return;
        
        let isMounted = true;
        const loadMeta = async () => {
            setMetaLoading(true);

            // 1. Check Library first for local items
            const localItem = library.find(i => i.id === id);
            if (localItem && localItem.localOnly) {
                if (isMounted) {
                    setMeta(localItem as MetaDetail);
                    setMetaLoading(false);
                    setStreamsLoading(false);
                    return;
                }
            }

            // 2. Fallback to Stremio Addons
            const decodedId = decodeURIComponent(id);
            const decodedType = decodeURIComponent(type);
            const metaData = await fetchStremioMeta(installedAddons, decodedType, decodedId);
            if (isMounted && metaData) {
                if (metaData.videos && metaData.videos.length > 0) {
                    metaData.videos.sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
                }
                setMeta(metaData);
                if (metaData.type === 'series' && metaData.videos && metaData.videos.length > 0) {
                    const firstVideo = metaData.videos[0];
                    setActiveSeason(firstVideo.season);
                    setActiveEpisodeId(firstVideo.id);
                }
                setMetaLoading(false);
            } else if (isMounted) {
                setMetaLoading(false);
            }
        };
        loadMeta();
        return () => { isMounted = false; };
    }, [type, id, addonsLoaded, libraryLoaded, installedAddons, library, skipMeta]);

    useEffect(() => {
        if (!meta) return;
        if (skipStreams) return;

        const loadStreams = async () => {
            setStreamsLoading(true);
            setStreams([]);
            
            let streamIdToUse = decodeURIComponent(id);
            if (meta.type === 'series') {
                if (activeEpisodeId) streamIdToUse = activeEpisodeId;
                else { setStreamsLoading(false); return; }
            } else {
                streamIdToUse = meta.imdb_id || decodeURIComponent(id);
            }
            
            const decodedType = decodeURIComponent(type);
            const streamData = await fetchStremioStreams(installedAddons, decodedType, streamIdToUse);
            setStreams(streamData);
            setStreamsLoading(false);
        };
        loadStreams();
    }, [meta, activeEpisodeId, installedAddons, type, id, skipStreams]);

    return {
        meta,
        metaLoading: skipMeta ? false : metaLoading,
        streams: skipStreams ? [] : streams,
        streamsLoading: skipStreams || skipMeta ? false : streamsLoading,
        activeSeason,
        setActiveSeason,
        activeEpisodeId,
        setActiveEpisodeId,
        isFullyLoaded: addonsLoaded && libraryLoaded
    };
}
