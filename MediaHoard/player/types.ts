export type PlayerSubtitlePayload = {
    id: string;
    label: string;
    lang: string;
    url: string;
};

export type PlayerLaunchPayload = {
    type: string;
    id: string;
    sourceIndex?: number | null;
    episodeId?: string | null;
    title?: string | null;
    sourceLabel?: string | null;
    sourceDescription?: string | null;
    sourceKind?: string | null;
    playbackUrl?: string | null;
    requestHeaders?: Record<string, string> | null;
    subtitles?: PlayerSubtitlePayload[];
};

export type PlayerQuery = PlayerLaunchPayload & {
    sourceIndex: number | null;
    episodeId: string | null;
    title: string | null;
    sourceLabel: string | null;
    sourceDescription: string | null;
    sourceKind: string | null;
    playbackUrl: string | null;
    requestHeaders: Record<string, string> | null;
    subtitles: PlayerSubtitlePayload[];
};

export type NativeTrackOption = {
    id: string;
    label: string;
    kind: "audio" | "subtitle";
    mpvTrackId: number | null;
    selected: boolean;
    external: boolean;
    language?: string;
    title?: string;
};

export type NativeSubtitleSettings = {
    font: string;
    size: number;
    color: string;
    backgroundColor: string;
    backgroundOpacity: number;
    delay: number;
};
