"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { openStandaloneDesktopPlayer, isDesktopShell } from "@/lib/desktop-player";
import { deserializePlayerPayload } from "@player/query";
import { goblinPlayerProtocol } from "@/lib/playback-preferences-schema";
import { getElectronApi } from "@/lib/electron-desktop";

const takeDeepLinkPayload = (urlValue: string) => {
    try {
        const parsed = new URL(urlValue);
        const target = parsed.hostname || parsed.pathname.replace(/^\/+/, "");
        const supportedProtocols = new Set([`${goblinPlayerProtocol}:`]);
        if (!supportedProtocols.has(parsed.protocol) || target !== "player") {
            return null;
        }

        return parsed.searchParams.get("payload");
    } catch {
        return null;
    }
};

export function DesktopPlayerLinkBridge() {
    const pathname = usePathname();

    useEffect(() => {
        if (!isDesktopShell() || pathname === "/player") {
            return;
        }

        console.info("[native-player] deep-link bridge active", { pathname });
        const api = getElectronApi();
        if (!api) return;

        const handleUrls = async (urls: string[] | null | undefined) => {
            console.info("[native-player] deep-link URLs received", {
                pathname,
                urlCount: urls?.length || 0,
                urls: urls || [],
            });

            const lastPayload = (urls || [])
                .map(takeDeepLinkPayload)
                .filter((value): value is string => Boolean(value))
                .at(-1);

            if (!lastPayload) {
                console.info("[native-player] deep-link payload missing");
                return;
            }

            const payload = deserializePlayerPayload(lastPayload);
            if (!payload.playbackUrl) {
                console.warn("Ignoring standalone-player deep link without a direct playback URL.");
                return;
            }

            console.info("[native-player] deep-link launching standalone player", {
                type: payload.type,
                id: payload.id,
                sourceKind: payload.sourceKind,
                playbackUrl: payload.playbackUrl,
            });
            await openStandaloneDesktopPlayer(payload);
        };

        void api.getCurrentDeepLinks().then(handleUrls).catch(() => undefined);

        const unlisten = api.onOpenUrl((urls) => {
            console.info("[native-player] onOpenUrl fired", {
                pathname,
                urlCount: urls.length,
            });
            void handleUrls(urls);
        });

        return () => {
            unlisten();
        };
    }, [pathname]);

    return null;
}
