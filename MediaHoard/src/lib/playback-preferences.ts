import { getAppStorageItem, setAppStorageItem } from "@/lib/app-storage";
import {
    defaultPlaybackPreferences,
    normalizePlaybackPreferences,
    playbackPreferencesStorageKey,
    type PlaybackPreferences,
} from "@/lib/playback-preferences-schema";

export {
    defaultPlaybackPreferences,
    normalizePlaybackPreferences,
    playbackPreferencesStorageKey,
};
export type { PlaybackMode, PlaybackPlatformPreferences, PlaybackPreferences } from "@/lib/playback-preferences-schema";

export const readPlaybackPreferences = async () => {
    const raw = await getAppStorageItem(playbackPreferencesStorageKey);
    if (!raw) {
        return defaultPlaybackPreferences();
    }

    try {
        return normalizePlaybackPreferences(JSON.parse(raw) as Partial<PlaybackPreferences>);
    } catch {
        return defaultPlaybackPreferences();
    }
};

export const writePlaybackPreferences = async (value: PlaybackPreferences) => {
    await setAppStorageItem(
        playbackPreferencesStorageKey,
        JSON.stringify(normalizePlaybackPreferences(value)),
    );
};
