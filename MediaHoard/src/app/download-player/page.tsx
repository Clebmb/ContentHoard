import Link from "next/link";

export default function DownloadPlayerPage() {
    return (
        <main className="min-h-screen px-6 pb-16 pt-36 text-white">
            <section className="mx-auto flex max-w-5xl flex-col gap-8 rounded-[2.5rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_34%),rgba(8,8,8,0.82)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-12">
                <div className="max-w-3xl">
                    <div className="text-xs font-black uppercase tracking-[0.28em] text-white/45">Playback</div>
                    <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">Set up playback before you start watching.</h1>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-white/68 md:text-lg">
                        Goblin Player is the recommended path for better compatibility and a cleaner MediaHoard playback flow. If you already prefer VLC or another app, you can configure that instead.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
                        <div className="text-sm font-black uppercase tracking-[0.2em] text-white/45">Goblin Player</div>
                        <p className="mt-3 text-sm leading-6 text-white/65">
                            Recommended for the intended MediaHoard playback experience, better source compatibility, and integrated controls.
                        </p>
                    </div>
                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
                        <div className="text-sm font-black uppercase tracking-[0.2em] text-white/45">External Apps</div>
                        <p className="mt-3 text-sm leading-6 text-white/65">
                            Use your own player if you already have one. MediaHoard can store a manual executable path from Playback settings.
                        </p>
                    </div>
                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
                        <div className="text-sm font-black uppercase tracking-[0.2em] text-white/45">Plugins</div>
                        <p className="mt-3 text-sm leading-6 text-white/65">
                            You also need addons to watch content. Recommended: AIOMetadata for metadata and AIOStreams for streams.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 rounded-[2rem] border border-dashed border-white/15 bg-black/35 p-6">
                    <div className="min-w-[220px] flex-1">
                        <div className="text-sm font-black uppercase tracking-[0.2em] text-white/45">Next Steps</div>
                        <p className="mt-2 text-sm leading-6 text-white/65">
                            Open Playback settings to configure Goblin Player or your external player, then install the addon stack you want to use.
                        </p>
                    </div>
                    <Link
                        href="/settings#playback"
                        className="rounded-full border border-white/15 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-black"
                    >
                        Open Playback Settings
                    </Link>
                    <Link
                        href="https://github.com/cedya77/aiometadata"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/15 bg-white/8 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white"
                    >
                        AIOMetadata
                    </Link>
                    <Link
                        href="https://github.com/Viren070/AIOStreams"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/15 bg-white/8 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white"
                    >
                        AIOStreams
                    </Link>
                </div>
            </section>
        </main>
    );
}
