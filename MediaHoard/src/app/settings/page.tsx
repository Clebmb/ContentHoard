"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "@/providers/ThemeProvider";
import { useLibrary } from "@/hooks/use-library";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { removeAppStorageItem } from "@/lib/app-storage";
import { usePlaybackPreferences } from "@/hooks/use-playback-preferences";
import { goblinPlayerDownloadUrl, goblinPlayerIconUrl } from "@/lib/playback-preferences-schema";
import { isDesktopShell } from "@/lib/desktop-player";
import { getElectronApi } from "@/lib/electron-desktop";

// Stable components defined outside the main page component to prevent re-mounting on every render
const SettingSection = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6 backdrop-blur-xl shadow-2xl"
  >
    <div className="flex items-center gap-4 border-b border-white/5 pb-4">
      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-[0_0_20px_rgba(var(--theme-accent-rgb),0.3)]">
        <span className="material-symbols-outlined text-[24px]">{icon}</span>
      </div>
      <h2 className="text-2xl font-black text-white">{title}</h2>
    </div>
    <div className="space-y-8">
      {children}
    </div>
  </motion.div>
);

const ToggleSetting = ({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: () => void }) => (
  <div className="flex items-center justify-between group">
    <div className="space-y-1">
      <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{label}</h3>
      {description && <p className="text-sm text-white/40">{description}</p>}
    </div>
    <button 
      onClick={onChange}
      className={`w-14 h-7 rounded-full relative transition-all duration-300 shadow-inner ${value ? 'bg-primary' : 'bg-white/10'}`}
    >
      <motion.div 
        animate={{ x: value ? 28 : 4 }}
        className={`absolute top-1 w-5 h-5 rounded-full shadow-lg ${value ? 'bg-black' : 'bg-white/40'}`} 
      />
    </button>
  </div>
);

const SliderSetting = ({ label, initialValue, max, onInput, onChange, suffix = "" }: { label: string; initialValue: number; max: number; onInput?: (v: number) => void; onChange: (v: number) => void; suffix?: string }) => {
  const labelRef = useRef<HTMLSpanElement>(null);
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <h3 className="text-lg font-bold text-white">{label}</h3>
        <span ref={labelRef} className="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{initialValue}{suffix}</span>
      </div>
      <input 
        type="range"
        min="0"
        max={max}
        defaultValue={initialValue}
        onInput={(e) => {
          const val = parseInt((e.target as HTMLInputElement).value);
          if (labelRef.current) labelRef.current.innerText = `${val}${suffix}`;
          if (onInput) onInput(val);
        }}
        onChange={(e) => onChange(parseInt((e.target as HTMLInputElement).value))}
        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
};

export default function SettingsPage() {
  const { theme, updateTheme, resetTheme } = useTheme();
  const { tmdbSettings, saveTmdbSettings } = useLibrary();
  const { preferences, updatePlatformPreferences } = usePlaybackPreferences();
  const [showSaved, setShowSaved] = useState(false);
  const [playbackPickerMessage, setPlaybackPickerMessage] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [webDiscovery, setWebDiscovery] = useState<{
    goblinPlayerInstalled: boolean;
    detectedGoblinPath: string | null;
    externalPlayerConfigured: boolean;
    externalPlayerPath: string | null;
    externalPlayerName: string | null;
  } | null>(null);
  const tmdbKeyRef = useRef<HTMLInputElement>(null);
  const webGoblinPathRef = useRef<HTMLInputElement>(null);
  const webExternalPathRef = useRef<HTMLInputElement>(null);
  const webExternalNameRef = useRef<HTMLInputElement>(null);
  const isDesktopApp = typeof window !== "undefined" && isDesktopShell();
  const localVolume = Math.round(theme.globalVolume * 100);

  useEffect(() => {
    if (isDesktopApp) return;
    let cancelled = false;

    void fetch("/api/playback/discovery", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        setWebDiscovery(payload);
      })
      .catch(() => {
        if (cancelled) return;
        setWebDiscovery(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isDesktopApp, preferences.web.goblinExecutablePath]);

  const handleSaveTmdb = () => {
    saveTmdbSettings({ ...tmdbSettings, apiKey: tmdbKeyRef.current?.value || "" });
    triggerSaveIndicator();
  };

  const triggerSaveIndicator = () => {
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const clearCache = () => {
    if (confirm("Are you sure you want to clear the local cache? This will not delete your library, but may remove cached posters and temporary data.")) {
        void removeAppStorageItem("mediahoard-theme").finally(() => {
          window.location.reload();
        });
    }
  };

  const resetAll = () => {
    if (confirm("DANGER: This will reset all your theme settings and audio preferences. Continue?")) {
        resetTheme();
        triggerSaveIndicator();
    }
  };

  const saveDesktopMode = async (selectedMode: "goblin" | "external") => {
    await updatePlatformPreferences("desktop", { selectedMode });
    triggerSaveIndicator();
  };

  const saveWebMode = async (selectedMode: "goblin" | "external") => {
    await updatePlatformPreferences("web", { selectedMode });
    triggerSaveIndicator();
  };

  const handlePickDesktopExecutable = async (target: "goblin" | "external") => {
    setPlaybackPickerMessage(null);

    try {
      const api = getElectronApi();
      if (!api) {
        throw new Error("The executable picker is only available in the Electron desktop app.");
      }

      const result = await api.pickExecutable({
        title: target === "goblin" ? "Select Goblin Player executable" : "Select external player executable",
      });

      if (!result) {
        setPlaybackPickerMessage("No executable was selected.");
        return;
      }

      if (target === "goblin") {
        await updatePlatformPreferences("desktop", { goblinExecutablePath: result.path });
      } else {
        await updatePlatformPreferences("desktop", {
          externalPlayerPath: result.path,
          externalPlayerName: result.name,
        });
      }

      triggerSaveIndicator();
      setPlaybackPickerMessage(`Selected ${result.name}.`);
    } catch (error) {
      setPlaybackPickerMessage(error instanceof Error ? error.message : "Failed to open the desktop executable picker.");
    }
  };

  const handleSaveWebGoblinPath = async () => {
    await updatePlatformPreferences("web", {
      goblinExecutablePath: webGoblinPathRef.current?.value.trim() || null,
    });
    triggerSaveIndicator();
  };

  const handlePickHostedExecutable = async (target: "goblin" | "external") => {
    setPlaybackPickerMessage(null);

    try {
      const response = await fetch("/api/playback/pick-executable", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: target === "goblin" ? "Select Goblin Player executable" : "Select external player executable",
        }),
      });

      const payload = await response.json().catch(() => null) as {
        error?: string;
        result?: { path: string; name: string } | null;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to open the host executable picker.");
      }

      if (!payload?.result) {
        setPlaybackPickerMessage("No executable was selected.");
        return;
      }

      if (target === "goblin") {
        if (webGoblinPathRef.current) {
          webGoblinPathRef.current.value = payload.result.path;
        }
        await updatePlatformPreferences("web", {
          goblinExecutablePath: payload.result.path,
        });
      } else {
        if (webExternalPathRef.current) {
          webExternalPathRef.current.value = payload.result.path;
        }
        if (webExternalNameRef.current) {
          webExternalNameRef.current.value = payload.result.name;
        }
        await updatePlatformPreferences("web", {
          externalPlayerPath: payload.result.path,
          externalPlayerName: payload.result.name,
        });
      }

      triggerSaveIndicator();
      setPlaybackPickerMessage(`Selected ${payload.result.name}.`);
    } catch (error) {
      setPlaybackPickerMessage(error instanceof Error ? error.message : "Failed to open the host executable picker.");
    }
  };

  const handleSaveWebExternalPlayer = async () => {
    await updatePlatformPreferences("web", {
      externalPlayerPath: webExternalPathRef.current?.value.trim() || null,
      externalPlayerName: webExternalNameRef.current?.value.trim() || null,
    });
    triggerSaveIndicator();
  };

  return (
    <main className="flex-1 flex flex-col relative w-full pt-32 pb-32 px-6 overflow-x-hidden">
      <div className="max-w-[800px] mx-auto w-full space-y-12">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-16">
          <div className="space-y-2">
            <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">Settings</h1>
            <p className="text-lg text-white/40 font-medium">Control your MediaHoard experience</p>
          </div>
          
          <AnimatePresence>
            {showSaved && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                className="bg-primary text-black px-6 py-2 rounded-full font-black text-sm shadow-[0_0_30px_rgba(var(--theme-accent-rgb),0.4)] flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Changes Saved
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Audio Section */}
        <SettingSection title="Audio & Feedback" icon="volume_up">
          <ToggleSetting 
            label="Application Sounds" 
            description="Play sounds when browsing, hovering, and clicking."
            value={theme.isSoundEnabled}
            onChange={() => { updateTheme({ isSoundEnabled: !theme.isSoundEnabled }); triggerSaveIndicator(); }}
          />
          <SliderSetting 
            label="Master Volume"
            initialValue={localVolume}
            max={100}
            onChange={(v) => { updateTheme({ globalVolume: v / 100 }); triggerSaveIndicator(); }}
            suffix="%"
          />
        </SettingSection>

        <SettingSection title="Playback" icon="play_circle" >
          <div id="playback" className="space-y-6 scroll-mt-36">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Choose your preferred player</h3>
              <p className="text-sm text-white/40">
                {isDesktopApp
                  ? "Desktop can use the built-in Goblin Player or launch a separate executable like VLC."
                  : "Web can use Goblin Player when it is installed locally, or a manually configured external executable on the host machine."}
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5 space-y-5">
              <label className="flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  <Image
                    src={goblinPlayerIconUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="mt-0.5 h-12 w-12 rounded-xl bg-white/5 p-2"
                  />
                  <div className="space-y-1">
                    <div className="text-base font-black text-white">Use Goblin Player {isDesktopApp ? "(Built-In)" : ""}</div>
                    <p className={`text-sm ${!isDesktopApp && !webDiscovery?.goblinPlayerInstalled ? "font-bold italic text-white" : "text-white/45"}`}>
                      {isDesktopApp
                        ? "Keeps playback inside the integrated Goblin Player surface."
                        : webDiscovery?.goblinPlayerInstalled
                          ? "Goblin Player was detected on this machine and can be used for web playback."
                          : "Goblin Player was not detected automatically yet."}
                    </p>
                    {!isDesktopApp && (
                      <p className="max-w-2xl text-sm leading-6 text-white/70">
                        Get the most out of MediaHoard with Goblin Player the dedicated media player built for full feature support, smoother playback, and maximum compatibility. <strong>Please download Goblin Player for the best MediaHoard experience.</strong>
                      </p>
                    )}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences[isDesktopApp ? "desktop" : "web"].selectedMode === "goblin"}
                  onChange={() => void (isDesktopApp ? saveDesktopMode("goblin") : saveWebMode("goblin"))}
                  className="mt-1 h-5 w-5 accent-primary"
                />
              </label>

              {!isDesktopApp && !webDiscovery?.goblinPlayerInstalled && (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-4 text-sm text-white/65">
                  <div className="font-bold text-white">Goblin Player isn&apos;t installed yet.</div>
                  <div className="mt-2">Open the download page, install Goblin Player, then come back and enable it for web playback.</div>
                  <Link
                    href={goblinPlayerDownloadUrl}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-black"
                  >
                    <Image
                      src={goblinPlayerIconUrl}
                      alt=""
                      width={16}
                      height={16}
                      className="h-4 w-4"
                    />
                    Download Goblin Player
                  </Link>
                </div>
              )}

              {playbackPickerMessage && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72">
                  {playbackPickerMessage}
                </div>
              )}

              {!isDesktopApp && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="text-sm font-bold text-white">Browser can&apos;t find Goblin Player? Select the executable here.</div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      key={preferences.web.goblinExecutablePath || "web-goblin-empty"}
                      ref={webGoblinPathRef}
                      defaultValue={preferences.web.goblinExecutablePath || ""}
                      placeholder="C:\\Program Files\\Goblin Player\\Goblin Player.exe"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handlePickHostedExecutable("goblin")}
                      className="rounded-full border border-white/15 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-black"
                    >
                      Browse
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-white/35">
                      {webDiscovery?.detectedGoblinPath ? `Detected path: ${webDiscovery.detectedGoblinPath}` : "Manual path is used when automatic discovery misses the install."}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveWebGoblinPath()}
                      className="rounded-full border border-white/15 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-black"
                    >
                      Save Path
                    </button>
                  </div>
                </div>
              )}

              {isDesktopApp && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="text-sm font-bold text-white">Optional Goblin Player executable override</div>
                  <div className="text-xs text-white/35">
                    Leave this empty to use the built-in player. Set it only if you want desktop launches to target a packaged Goblin Player executable instead.
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={preferences.desktop.goblinExecutablePath || ""}
                      readOnly
                      placeholder="Use built-in Goblin Player"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handlePickDesktopExecutable("goblin")}
                      className="rounded-full border border-white/15 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-black"
                    >
                      Browse
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5 space-y-5">
              <label className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-base font-black text-white">Use an external player</div>
                  <p className="text-sm text-white/45">
                    {isDesktopApp
                      ? "Pick an executable such as VLC or MPC-HC for direct URL playback."
                      : "Set an executable path on the machine hosting the web app. This is best for local/self-hosted installs."}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences[isDesktopApp ? "desktop" : "web"].selectedMode === "external"}
                  onChange={() => void (isDesktopApp ? saveDesktopMode("external") : saveWebMode("external"))}
                  className="mt-1 h-5 w-5 accent-primary"
                />
              </label>

              {isDesktopApp ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={preferences.desktop.externalPlayerPath || ""}
                      readOnly
                      placeholder="Select VLC, MPC-HC, or another player executable"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handlePickDesktopExecutable("external")}
                      className="rounded-full border border-white/15 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-black"
                    >
                      Browse
                    </button>
                  </div>
                  {preferences.desktop.externalPlayerName && (
                    <div className="text-xs text-white/35">Selected external player: {preferences.desktop.externalPlayerName}</div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    key={preferences.web.externalPlayerName || "web-external-name-empty"}
                    ref={webExternalNameRef}
                    defaultValue={preferences.web.externalPlayerName || ""}
                    placeholder="Player label (for example VLC)"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                  />
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      key={preferences.web.externalPlayerPath || "web-external-path-empty"}
                      ref={webExternalPathRef}
                      defaultValue={preferences.web.externalPlayerPath || ""}
                      placeholder="C:\\Program Files\\VideoLAN\\VLC\\vlc.exe"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handlePickHostedExecutable("external")}
                      className="rounded-full border border-white/15 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-black"
                    >
                      Browse
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-white/35">
                      Browser launch uses the local host machine running this MediaHoard instance.
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveWebExternalPlayer()}
                      className="rounded-full border border-white/15 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-black"
                    >
                      Save Player
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SettingSection>

        {/* Streaming Section */}
        <SettingSection title="Streaming & Playback" icon="movie">
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">Preferred Metadata Language</h3>
            <p className="text-sm text-white/40 mb-4">Choose the language for titles and descriptions.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {['English', 'Spanish', 'French', 'German', 'Japanese'].map(lang => (
                <button 
                  key={lang}
                  onClick={() => { updateTheme({ metadataLanguage: lang }); triggerSaveIndicator(); }}
                  className={`py-3 rounded-xl border font-bold text-sm transition-all ${theme.metadataLanguage === lang ? 'bg-primary text-black border-primary shadow-[0_0_20px_rgba(var(--theme-accent-rgb),0.3)]' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
          <div className="h-px bg-white/5" />
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">Maximum Stream Quality</h3>
            <div className="grid grid-cols-3 gap-3">
              {['4K', '1080p', '720p'].map(quality => (
                <button 
                  key={quality}
                  onClick={() => { updateTheme({ preferredQuality: quality }); triggerSaveIndicator(); }}
                  className={`py-3 rounded-xl border font-bold text-sm transition-all ${theme.preferredQuality === quality ? 'bg-white/10 text-white border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}`}
                >
                  {quality}
                </button>
              ))}
            </div>
          </div>
        </SettingSection>

        {/* External Services */}
        <SettingSection title="External Services" icon="api">
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">TMDB API Key</h3>
              <p className="text-sm text-white/40">Used for pulling metadata and high-quality posters for your local library items.</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input 
                  key={tmdbSettings?.apiKey || "tmdb-empty"}
                  ref={tmdbKeyRef}
                  type={showKey ? "text" : "password"}
                  defaultValue={tmdbSettings?.apiKey || ""}
                  placeholder="Enter your API Key..."
                  className="w-full bg-black/20 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-primary transition-all font-mono text-sm pr-12"
                />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">{showKey ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              <button 
                onClick={handleSaveTmdb}
                className="bg-white text-black hover:bg-white/90 px-8 py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95"
              >
                Connect
              </button>
            </div>
            <p className="text-[11px] text-white/30 italic">You can get a free API key at themoviedb.org</p>
          </div>
        </SettingSection>

        {/* Maintenance */}
        <SettingSection title="Maintenance & Privacy" icon="security">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={clearCache}
              className="bg-white/5 hover:bg-white/10 border border-white/10 p-6 rounded-3xl transition-all text-left group"
            >
              <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">Clear Cache</h3>
              <p className="text-sm text-white/40">Refresh the application storage and temporary cache.</p>
            </button>
            <button 
              onClick={resetAll}
              className="bg-error/10 hover:bg-error/20 border border-error/20 p-6 rounded-3xl transition-all text-left group"
            >
              <h3 className="text-lg font-bold text-error group-hover:text-error-container transition-colors">Hard Reset</h3>
              <p className="text-sm text-error/40">Reset all theme and app settings to default.</p>
            </button>
          </div>
        </SettingSection>

        <div className="pt-20 pb-10 text-center space-y-4 opacity-20">
          <div className="flex items-center justify-center gap-4">
            <div className="h-px w-12 bg-white" />
            <span className="font-mono text-xs tracking-widest uppercase">MediaHoard Cinematic Dashboard</span>
            <div className="h-px w-12 bg-white" />
          </div>
          <p className="text-[10px] font-bold">VERSION 1.2.4 • CINEMATIC GLASS CORE</p>
        </div>

      </div>
    </main>
  );
}
