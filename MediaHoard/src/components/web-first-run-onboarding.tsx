"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getAppStorageItem, setAppStorageItem } from "@/lib/app-storage";
import { isDesktopShell } from "@/lib/desktop-player";
import {
    goblinPlayerIconUrl,
    goblinPlayerDownloadUrl,
    webFirstRunOnboardingStorageKey,
} from "@/lib/playback-preferences-schema";

export function WebFirstRunOnboarding() {
    const desktopShell = isDesktopShell();
    const [isVisible, setIsVisible] = useState(false);
    const [isReady, setIsReady] = useState(desktopShell);

    useEffect(() => {
        if (desktopShell) {
            return;
        }

        let cancelled = false;

        void getAppStorageItem(webFirstRunOnboardingStorageKey)
            .then((value) => {
                if (cancelled) return;
                setIsVisible(value !== "1");
                setIsReady(true);
            })
            .catch(() => {
                if (cancelled) return;
                setIsVisible(true);
                setIsReady(true);
            });

        return () => {
            cancelled = true;
        };
    }, [desktopShell]);

    useEffect(() => {
        if (!isVisible || desktopShell) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [desktopShell, isVisible]);

    const rememberSeen = async () => {
        setIsVisible(false);
        await setAppStorageItem(webFirstRunOnboardingStorageKey, "1").catch(() => undefined);
    };

    if (!isReady || !isVisible || desktopShell) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[1200] flex items-start justify-center overflow-y-auto bg-black px-4 pb-8 pt-24">
            <div className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_34%),rgba(8,8,8,0.96)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)] md:p-7">
                <div className="flex items-start justify-between gap-4">
                    <div className="max-w-2xl">
                        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/45">Welcome</div>
                        <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl">
                            Set up playback before you start watching.
                        </h2>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-white/68">
                            Goblin Player is the recommended path for better compatibility and a cleaner MediaHoard playback flow. You also need plugins for metadata and streams.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void rememberSeen()}
                        className="rounded-full border border-white/12 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                        aria-label="Dismiss onboarding"
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                        <div className="text-sm font-black text-white">Playback Setup</div>
                        <p className="mt-2 text-sm leading-6 text-white/62">
                            Download Goblin Player for the intended MediaHoard experience, or configure your own external player if you already use one.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <Link
                                href={goblinPlayerDownloadUrl}
                                onClick={() => void rememberSeen()}
                                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-black"
                            >
                                <Image src={goblinPlayerIconUrl} alt="" width={20} height={20} className="h-5 w-5" />
                                Download Goblin Player
                            </Link>
                            <Link
                                href="/settings#playback"
                                onClick={() => void rememberSeen()}
                                className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white"
                            >
                                Set Up External Player
                            </Link>
                        </div>
                    </div>

                    <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                        <div className="text-sm font-black text-white">Required Plugins</div>
                        <p className="mt-2 text-sm leading-6 text-white/62">
                            You need plugins to watch content. Recommended: AIOMetadata for metadata and AIOStreams for stream sources.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <Link
                                href="https://github.com/cedya77/aiometadata"
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => void rememberSeen()}
                                className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white"
                            >
                                AIOMetadata
                            </Link>
                            <Link
                                href="https://github.com/Viren070/AIOStreams"
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => void rememberSeen()}
                                className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white"
                            >
                                AIOStreams
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/8 pt-4">
                    <p className="text-xs leading-5 text-white/42">
                        You can reopen or change all playback settings later from Settings.
                    </p>
                    <button
                        type="button"
                        onClick={() => void rememberSeen()}
                        className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
}
