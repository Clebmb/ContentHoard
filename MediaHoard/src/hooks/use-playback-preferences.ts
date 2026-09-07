"use client";

import { useEffect, useState } from "react";
import {
    defaultPlaybackPreferences,
    readPlaybackPreferences,
    writePlaybackPreferences,
} from "@/lib/playback-preferences";
import type {
    PlaybackPlatformPreferences,
    PlaybackPreferences,
} from "@/lib/playback-preferences-schema";

export function usePlaybackPreferences() {
    const [preferences, setPreferences] = useState<PlaybackPreferences>(defaultPlaybackPreferences);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        void readPlaybackPreferences().then((nextPreferences) => {
            if (cancelled) return;
            setPreferences(nextPreferences);
            setIsLoaded(true);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    const savePreferences = async (nextPreferences: PlaybackPreferences) => {
        setPreferences(nextPreferences);
        await writePlaybackPreferences(nextPreferences);
    };

    const updatePlatformPreferences = async (
        platform: keyof PlaybackPreferences,
        updates: Partial<PlaybackPlatformPreferences>,
    ) => {
        const nextPreferences = {
            ...preferences,
            [platform]: {
                ...preferences[platform],
                ...updates,
            },
        };

        await savePreferences(nextPreferences);
    };

    return {
        preferences,
        isLoaded,
        savePreferences,
        updatePlatformPreferences,
    };
}
