"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { IconPickerDialog } from "@/components/ui/icon-picker-dialog";
import { useProfiles } from "@/providers/ProfileProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { getAppStorageItem, setAppStorageItem } from "@/lib/app-storage";
import { isDesktopShell } from "@/lib/desktop-player";
import {
    goblinPlayerDownloadUrl,
    goblinPlayerIconUrl,
    webFirstRunOnboardingStorageKey,
} from "@/lib/playback-preferences-schema";

type AppStartupGateProps = {
    children: React.ReactNode;
    header: React.ReactNode;
};

type StartupPhase = "loading" | "onboarding" | "profile" | "ready";

const starterColors = ["#39E079", "#E03939", "#397EE0", "#E0A339", "#9C39E0", "#39E0DC", "#FFFFFF"];

const AppGateFrame = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 z-[1400] overflow-y-auto bg-black px-4 py-10 md:py-14">
        <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-3xl translate-y-8 rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_34%),rgba(8,8,8,0.96)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)] md:translate-y-10 md:p-7">
                {children}
            </div>
        </div>
    </div>
);

export function AppStartupGate({ children, header }: AppStartupGateProps) {
    const pathname = usePathname();
    const [desktopShell, setDesktopShell] = useState(false);
    const { profiles, activeProfile, isLoaded: profilesLoaded, createProfile } = useProfiles();
    const { theme } = useTheme();
    const [phase, setPhase] = useState<StartupPhase>("loading");
    const [setupData, setSetupData] = useState({ name: "", color: "#39E079", icon: "" });
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            const nextDesktopShell = isDesktopShell();
            setDesktopShell(nextDesktopShell);

            if (nextDesktopShell) {
                setPhase("ready");
            }
        });

        return () => {
            window.cancelAnimationFrame(frame);
        };
    }, []);

    useEffect(() => {
        if (desktopShell || !profilesLoaded) {
            return;
        }

        let cancelled = false;

        void getAppStorageItem(webFirstRunOnboardingStorageKey)
            .then((value) => {
                if (cancelled) return;

                if (value !== "1") {
                    setPhase("onboarding");
                    return;
                }

                if (!activeProfile || profiles.length === 0) {
                    setPhase("profile");
                    return;
                }

                setPhase("ready");
            })
            .catch(() => {
                if (cancelled) return;
                setPhase("onboarding");
            });

        return () => {
            cancelled = true;
        };
    }, [activeProfile, desktopShell, profiles.length, profilesLoaded]);

    useEffect(() => {
        if (phase === "ready") {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [phase]);

    const completeOnboarding = async () => {
        await setAppStorageItem(webFirstRunOnboardingStorageKey, "1").catch(() => undefined);
        setPhase("profile");
    };

    const createInitialProfile = () => {
        createProfile(setupData.name.trim() || "New Profile", setupData.icon || undefined, setupData.color);
        setPhase("ready");
    };

    if (pathname === "/player") {
        return (
            <>
                {header}
                {children}
            </>
        );
    }

    return (
        <>
            <div className={`transition-opacity duration-500 ${phase === "ready" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                {header}
                {children}
            </div>

            {phase === "onboarding" && (
                <AppGateFrame>
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
                                    onClick={() => void completeOnboarding()}
                                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-black"
                                >
                                    <Image src={goblinPlayerIconUrl} alt="" width={20} height={20} className="h-5 w-5" />
                                    Download Goblin Player
                                </Link>
                                <Link
                                    href="/settings#playback"
                                    onClick={() => void completeOnboarding()}
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
                                    onClick={() => void completeOnboarding()}
                                    className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white"
                                >
                                    AIOMetadata
                                </Link>
                                <Link
                                    href="https://github.com/Viren070/AIOStreams"
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={() => void completeOnboarding()}
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
                            onClick={() => void completeOnboarding()}
                            className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white"
                        >
                            Continue
                        </button>
                    </div>
                </AppGateFrame>
            )}

            {phase === "profile" && (
                <>
                    <AppGateFrame>
                        <div className="mx-auto max-w-lg space-y-10">
                            <div className="text-center">
                                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/45">Profile</div>
                                <h2 className="mt-3 text-4xl font-black text-white">Create Your First Profile</h2>
                                <p className="mt-3 text-sm leading-6 text-white/62">
                                    Set up your profile before MediaHoard loads the rest of the app.
                                </p>
                            </div>

                            <div className="flex flex-col items-center gap-8">
                                <div
                                    className="w-32 h-32 rounded-[2.5rem] border-4 border-white/10 flex items-center justify-center overflow-hidden bg-white/5 relative group shadow-2xl"
                                    style={{ backgroundColor: setupData.color }}
                                >
                                    {setupData.icon ? (
                                        setupData.icon.includes("://") || setupData.icon.startsWith("data:")
                                            ? <img src={setupData.icon} alt="" className="w-full h-full object-cover" />
                                            : <span className="material-symbols-outlined text-white text-[64px]">{setupData.icon}</span>
                                    ) : (
                                        <span className="material-symbols-outlined text-white/90 text-[64px]">person</span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setIsIconPickerOpen(true)}
                                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                                    </button>
                                </div>

                                <div className="flex flex-wrap justify-center gap-4">
                                    {starterColors.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setSetupData((current) => ({ ...current, color }))}
                                            className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-125 ${setupData.color === color ? "border-white scale-125 ring-4 ring-white/20 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.3em] px-1">
                                    Profile Name
                                </label>
                                <input
                                    type="text"
                                    value={setupData.name}
                                    onChange={(event) => setSetupData((current) => ({ ...current, name: event.target.value }))}
                                    placeholder="Enter name..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-white/30 focus:bg-white/10 outline-none transition-all text-xl font-bold shadow-inner text-white"
                                    autoFocus
                                />
                            </div>

                            <button
                                type="button"
                                onClick={createInitialProfile}
                                className="w-full py-4 bg-white text-black font-black rounded-2xl shadow-lg transition-all uppercase tracking-widest text-xs active:scale-95"
                                style={{
                                    backgroundColor: "#ffffff",
                                    color: "#000000",
                                    fontFamily: theme.menuFont,
                                }}
                            >
                                Create Profile
                            </button>
                        </div>
                    </AppGateFrame>

                    <IconPickerDialog
                        isOpen={isIconPickerOpen}
                        onClose={() => setIsIconPickerOpen(false)}
                        onSelectUpload={(url: string) => setSetupData((current) => ({ ...current, icon: url }))}
                        onSelectUrl={(url: string) => setSetupData((current) => ({ ...current, icon: url }))}
                        onSelectPreset={(name: string) => setSetupData((current) => ({ ...current, icon: name }))}
                        onSelectDefault={() => setSetupData((current) => ({ ...current, icon: "" }))}
                        hasExistingIcon={!!setupData.icon}
                        title="Profile Avatar"
                        initialUrl={setupData.icon && (setupData.icon.includes("://") || setupData.icon.startsWith("data:")) ? setupData.icon : ""}
                        presets={["face", "face_6", "face_5", "face_3", "face_4", "face_2", "child_care", "comedy_mask", "family_restroom", "groups", "person", "pets", "emoticon", "rocket_launch", "celebration"]}
                    />
                </>
            )}
        </>
    );
}
