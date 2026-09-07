export const playbackPreferencesStorageKey = "mediahoard_playback_preferences";
export const goblinPlayerProtocol = "goblin";
export const goblinPlayerDownloadUrl = "/download-player";
export const goblinPlayerIconUrl = "/goblin-player-icon.svg";
export const webFirstRunOnboardingStorageKey = "mediahoard_web_first_run_onboarding_seen";

export type PlaybackMode = "goblin" | "external";

export type PlaybackPlatformPreferences = {
    selectedMode: PlaybackMode;
    goblinExecutablePath: string | null;
    externalPlayerPath: string | null;
    externalPlayerName: string | null;
};

export type PlaybackPreferences = {
    desktop: PlaybackPlatformPreferences;
    web: PlaybackPlatformPreferences;
};

const defaultPlatformPreferences = (): PlaybackPlatformPreferences => ({
    selectedMode: "goblin",
    goblinExecutablePath: null,
    externalPlayerPath: null,
    externalPlayerName: null,
});

export const defaultPlaybackPreferences = (): PlaybackPreferences => ({
    desktop: defaultPlatformPreferences(),
    web: defaultPlatformPreferences(),
});

export const normalizePlatformPreferences = (
    value: Partial<PlaybackPlatformPreferences> | null | undefined,
): PlaybackPlatformPreferences => ({
    selectedMode: value?.selectedMode === "external" ? "external" : "goblin",
    goblinExecutablePath: typeof value?.goblinExecutablePath === "string" && value.goblinExecutablePath.trim()
        ? value.goblinExecutablePath.trim()
        : null,
    externalPlayerPath: typeof value?.externalPlayerPath === "string" && value.externalPlayerPath.trim()
        ? value.externalPlayerPath.trim()
        : null,
    externalPlayerName: typeof value?.externalPlayerName === "string" && value.externalPlayerName.trim()
        ? value.externalPlayerName.trim()
        : null,
});

export const normalizePlaybackPreferences = (
    value: Partial<PlaybackPreferences> | null | undefined,
): PlaybackPreferences => ({
    desktop: normalizePlatformPreferences(value?.desktop),
    web: normalizePlatformPreferences(value?.web),
});
