"use client";

import React, { useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDetails, type Stream } from "@/hooks/use-details";
import { useLibrary } from "@/hooks/use-library";
import { usePlaybackPreferences } from "@/hooks/use-playback-preferences";
import { useTheme } from "@/providers/ThemeProvider";
import {
  isDesktopShell,
  launchConfiguredWebPlayer,
  openConfiguredDesktopExternalPlayer,
  openInstalledStandalonePlayer,
  openStandaloneDesktopPlayer,
} from "@/lib/desktop-player";
import { buildSourceOption, type SourceOption } from "@/lib/media-source";
import type { PlayerLaunchPayload } from "@player/types";

import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";

const getQualityBadges = (text: string) => {
    const badges: { label: string; color: string }[] = [];
    const lower = text.toLowerCase();

    if (lower.match(/\b(4k|2160p|uhd)\b/))
        badges.push({ label: '4K', color: 'text-yellow-200 border-yellow-500/30 bg-yellow-500/10' });
    if (lower.match(/\b(1080p|fhd)\b/))
        badges.push({ label: '1080p', color: 'text-blue-200 border-blue-500/30 bg-blue-500/10' });
    if (lower.match(/\b(720p|hd)\b/))
        badges.push({ label: '720p', color: 'text-green-200 border-green-500/30 bg-green-500/10' });
    if (lower.match(/\b(hdr|dv|dolby vision|10bit)\b/))
        badges.push({ label: 'HDR', color: 'text-purple-200 border-purple-500/30 bg-purple-500/10' });

    return badges;
};

export default function DetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { theme } = useTheme();
  const { preferences } = usePlaybackPreferences();
  const [accentColor, setAccentColor] = React.useState<string>("rgba(0,0,0,0)");
  const [playerLaunchError, setPlayerLaunchError] = React.useState<string | null>(null);
  
  const type = (typeof params.type === 'string' ? params.type : Array.isArray(params.type) ? params.type[0] : '') || "";
  const id = (typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '') || "";

  const {
    meta,
    metaLoading,
    streams,
    streamsLoading,
    activeSeason,
    setActiveSeason,
    activeEpisodeId,
    setActiveEpisodeId,
    isFullyLoaded
  } = useDetails(type, id);

  useEffect(() => {
    if (!meta?.poster) return;

    const img = new Image();
    img.crossOrigin = "anonymous"; // Ensure lowercase for consistency
    img.src = meta.poster;
    
    const extractColor = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = 1;
        canvas.height = 1;
        ctx?.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx?.getImageData(0, 0, 1, 1).data || [255, 255, 255];
        
        // Boost saturation and brightness for the ambient effect
        const boost = (val: number) => Math.min(Math.round(val * 1.8), 255);
        const br = boost(r);
        const bg = boost(g);
        const bb = boost(b);

        const accent = `rgb(${br}, ${bg}, ${bb})`;
        
        setAccentColor(accent);
      } catch (e) {
        console.warn("Ambient color extraction failed:", e);
        setAccentColor("rgba(255,255,255,0.6)");
      }
    };

    if (img.complete) {
      extractColor();
    } else {
      img.onload = extractColor;
    }
  }, [meta?.poster]);

  const { library, updateLibrary } = useLibrary();

  const seasons = useMemo(() => {
    if (!meta || !meta.videos) return [];
    const seasonSet = new Set(meta.videos.map(v => v.season));
    return Array.from(seasonSet).sort((a, b) => (a as number) - (b as number));
  }, [meta]);

  const episodesForActiveSeason = useMemo(() => {
    if (!meta || !meta.videos) return [];
    return meta.videos.filter(v => v.season === activeSeason);
  }, [meta, activeSeason]);

  const activeEpisode = useMemo(() => {
    if (!meta || !meta.videos || !activeEpisodeId) return null;
    return meta.videos.find(v => v.id === activeEpisodeId);
  }, [meta, activeEpisodeId]);

  const toggleLibrary = () => {
    if (!meta) return;
    const inLibrary = library.some(li => li.id === meta.id);
    if (inLibrary) {
      updateLibrary(library.filter(li => li.id !== meta.id));
    } else {
      updateLibrary([...library, meta]);
    }
  };

  const buildPlayerPayload = (stream?: Stream, sourceIndex?: number) => {
    if (!meta) {
      return {
        payload: {
          type,
          id,
          sourceIndex: typeof sourceIndex === "number" ? sourceIndex : null,
          episodeId: activeEpisodeId,
          title: null,
          sourceLabel: null,
          sourceDescription: null,
          sourceKind: null,
          playbackUrl: null,
          requestHeaders: null,
          subtitles: [],
        } satisfies PlayerLaunchPayload,
      };
    }

    const sourceOption: SourceOption | null = typeof sourceIndex === "number" && stream
      ? buildSourceOption(stream, sourceIndex)
      : meta.localOnly
        ? {
            id: "local-file",
            kind: "local",
            label: "Local File",
            description: meta.localPath || meta.name,
            badges: ["Local"],
            subtitles: [],
            isLikelyPlayable: true,
            isNativePreferred: true,
            url: meta.localPath,
          }
        : null;

    const activeEpisodeTitle = activeEpisode
      ? `S${activeEpisode.season}E${activeEpisode.episode}: ${activeEpisode.name || activeEpisode.title || `Episode ${activeEpisode.episode}`}`
      : null;
    const fileIndexPart = typeof stream?.fileIdx === "number" ? `/${stream.fileIdx}` : "";
    const playbackUrl = sourceOption?.kind === "external"
      ? null
      : sourceOption?.kind === "torrent" && stream?.infoHash
        ? `http://127.0.0.1:11470/${stream.infoHash}${fileIndexPart}`
        : sourceOption?.kind === "youtube" && sourceOption.ytId
          ? sourceOption.ytId.startsWith("http")
            ? sourceOption.ytId
            : `https://www.youtube.com/watch?v=${sourceOption.ytId}`
          : sourceOption?.url || meta.localPath || null;

    return {
      payload: {
        type,
        id,
        sourceIndex: typeof sourceIndex === "number" ? sourceIndex : null,
        episodeId: activeEpisodeId,
        title: activeEpisodeTitle ? `${meta.name} - ${activeEpisodeTitle}` : meta.name,
        sourceLabel: sourceOption?.label || (meta.localOnly ? "Local File" : null),
        sourceDescription: sourceOption?.description || meta.localPath || null,
        sourceKind: sourceOption?.kind || (meta.localOnly ? "local" : null),
        playbackUrl,
        requestHeaders: sourceOption?.requestHeaders || null,
        subtitles: sourceOption?.subtitles || [],
      } satisfies PlayerLaunchPayload,
    };
  };

  const openPlayer = async (stream?: Stream, sourceIndex?: number) => {
    const { payload } = buildPlayerPayload(stream, sourceIndex);

    if (!payload.playbackUrl) {
      setPlayerLaunchError("This source does not expose a direct playable URL for native playback.");
      console.warn("Refusing to open standalone player without a direct playback URL.", {
        type,
        id,
        sourceIndex,
      });
      return;
    }

    setPlayerLaunchError(null);

    if (isDesktopShell()) {
      if (preferences.desktop.selectedMode === "external") {
        if (!preferences.desktop.externalPlayerPath) {
          setPlayerLaunchError("Select an external player executable in Settings > Playback first.");
          return;
        }

        await openConfiguredDesktopExternalPlayer(preferences.desktop.externalPlayerPath, payload);
        return;
      }

      await openStandaloneDesktopPlayer(payload);
      return;
    }

    if (preferences.web.selectedMode === "external") {
      await launchConfiguredWebPlayer("external", payload);
      return;
    }

    if (preferences.web.goblinExecutablePath) {
      await launchConfiguredWebPlayer("goblin", payload);
      return;
    }

    openInstalledStandalonePlayer(payload);
  };

  // Parallax Background
  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 1000], ["0%", "30%"]);

  // 3D Tilt for Poster
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);
  const shineX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const shineY = useTransform(mouseYSpring, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  if (!isFullyLoaded || metaLoading) {
    return (
      <main className="flex-1 flex flex-col relative w-full min-h-screen">
        <div className="flex-1 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-white/20 animate-spin">refresh</span>
        </div>
      </main>
    );
  }

  if (!meta) {
    return (
      <main className="flex-1 flex flex-col relative w-full min-h-screen pt-32 px-6">
        <button onClick={() => router.back()} className="absolute top-24 left-6 z-50 flex items-center gap-2 text-white/60 hover:text-white bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 transition-all">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span className="text-sm font-bold">Back</span>
        </button>
        <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-12 border border-white/5 rounded-3xl bg-surface-container-lowest/50">
                <span className="material-symbols-outlined text-6xl text-white/10 mb-4">error</span>
                <h3 className="text-headline-md text-white/80 mb-2">Details not found</h3>
                <p className="text-body-md text-white/40">Could not fetch metadata for this item.</p>
            </div>
        </div>
      </main>
    );
  }

  const backgroundStyle = meta.background ? { backgroundImage: `url(${meta.background})` } : {};
  const inLibrary = library.some(li => li.id === meta.id);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        type: "spring" as const, 
        stiffness: 300, 
        damping: 24 
      } 
    }
  };

  return (
    <main className="flex-1 flex flex-col relative w-full min-h-screen overflow-hidden">
      {/* Dynamic Parallax Background */}
      <div className="fixed inset-0 z-0 bg-black overflow-hidden">
        <motion.div 
          className="absolute inset-0 bg-cover bg-top blur-[120px] scale-110 origin-top opacity-70 transition-opacity duration-1000" 
          style={{ ...backgroundStyle, y: bgY }} 
        />
        
        {/* Dynamic Ambient Glows - Ultra Enhanced */}
        <motion.div 
          animate={{ 
            x: [0, 80, -80, 0],
            y: [0, -50, 50, 0],
            scale: [1, 1.2, 0.8, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[-20%] w-[120%] h-[120%] rounded-full blur-[180px] opacity-50 pointer-events-none transition-colors duration-300 mix-blend-screen"
          style={{ backgroundColor: accentColor }}
        />
        <motion.div 
          animate={{ 
            x: [0, -60, 60, 0],
            y: [0, 70, -70, 0],
            scale: [1, 0.8, 1.2, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-30%] right-[-20%] w-[100%] h-[100%] rounded-full blur-[200px] opacity-40 pointer-events-none transition-colors duration-300 mix-blend-screen"
          style={{ backgroundColor: accentColor }}
        />
        
        {/* Central Intensity Glow */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full blur-[150px] opacity-20 pointer-events-none transition-colors duration-300 mix-blend-screen"
          style={{ backgroundColor: accentColor }}
        />
        
        {/* Clean, cinematic gradient overlay - darker to make colors pop */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-[1600px] mx-auto pt-28 pb-16 px-4 md:px-12 flex flex-col xl:flex-row gap-12 min-h-screen">
        
        {/* Main Details Area */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex-1 mt-12 xl:mt-0 min-w-0"
        >
          <div className="flex flex-col md:flex-row gap-10 items-start">
            
            {/* 3D Poster */}
            <motion.div 
              variants={itemVariants}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              className="w-56 md:w-72 xl:w-80 shrink-0 mx-auto md:mx-0 perspective-1000 z-20"
            >
              <div 
                className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 bg-surface-container-low"
                style={{ transform: "translateZ(30px)" }}
              >
                {meta.poster ? (
                  <img 
                    src={meta.poster} 
                    alt={meta.name} 
                    className="w-full h-full object-cover" 
                    style={{ viewTransitionName: `poster-${meta.id}` }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20">
                    <span className="material-symbols-outlined text-[64px]">movie</span>
                  </div>
                )}
                
                {/* 3D Glint/Shine */}
                <motion.div
                  className="absolute inset-0 z-10 pointer-events-none mix-blend-overlay opacity-50"
                  style={{
                    background: `radial-gradient(circle at ${shineX} ${shineY}, rgba(255,255,255,0.8) 0%, transparent 60%)`,
                  }}
                />
              </div>
              {/* Poster Ambient Shadow/Glow */}
              <div 
                className="absolute inset-0 -z-10 blur-3xl opacity-40 scale-95 transition-colors duration-300"
                style={{ backgroundColor: accentColor }}
              />
            </motion.div>

            {/* Meta Info */}
            <div className="flex-1 space-y-6 text-center md:text-left mt-4 md:mt-0 pt-4">
              
              <motion.div variants={itemVariants}>
                {/* Logo or Text Title */}
                {meta.logo ? (
                  <div className="mb-6 flex justify-center md:justify-start">
                    <img 
                      src={meta.logo} 
                      alt={meta.name} 
                      className="max-h-[120px] md:max-h-[160px] object-contain drop-shadow-2xl"
                    />
                  </div>
                ) : (
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-4 leading-none text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] tracking-tight" style={{ viewTransitionName: `title-${meta.id}` }}>
                    {meta.name}
                  </h1>
                )}
                
                {/* Badges and Actions */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-medium text-white/80 mt-6">
                  {meta.releaseInfo && <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg border border-white/10 shadow-lg">{meta.releaseInfo.substring(0, 4)}</span>}
                  {meta.runtime && <span className="font-mono">{meta.runtime}</span>}
                  {meta.imdbRating && (
                    <div 
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg border backdrop-blur-md shadow-lg transition-colors duration-300"
                      style={{ 
                        color: accentColor === "rgba(0,0,0,0)" ? "white" : accentColor, 
                        backgroundColor: accentColor === "rgba(0,0,0,0)" ? "rgba(255,255,255,0.1)" : `${accentColor.replace('rgb', 'rgba').replace(')', ', 0.1)')}`,
                        borderColor: accentColor === "rgba(0,0,0,0)" ? "rgba(255,255,255,0.2)" : `${accentColor.replace('rgb', 'rgba').replace(')', ', 0.2)')}`
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="font-bold">{meta.imdbRating}</span>
                    </div>
                  )}
                  <span className="uppercase tracking-widest text-[10px] font-black border border-white/20 text-white px-3 py-1.5 rounded-lg bg-white/5 backdrop-blur-md shadow-lg">
                    {meta.type}
                  </span>
                  
                  {meta.localOnly ? (
                    <span className="uppercase tracking-widest text-[10px] font-black bg-white text-black px-3 py-1.5 rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.3)]">Local Item</span>
                  ) : (
                    <button
                      onClick={toggleLibrary}
                      className="flex items-center gap-2 px-5 py-1.5 rounded-full font-bold transition-all text-xs border shadow-xl active:scale-95 group overflow-hidden relative"
                      style={{ 
                        backgroundColor: inLibrary ? 'white' : 'rgba(0,0,0,0.4)',
                        color: inLibrary ? 'black' : 'white',
                        borderColor: inLibrary ? 'white' : 'rgba(255,255,255,0.1)'
                      }}
                    >
                      {!inLibrary && (
                        <div 
                          className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500"
                          style={{ backgroundColor: accentColor }}
                        />
                      )}
                      <span className="material-symbols-outlined text-[18px]">{inLibrary ? "check" : "add"}</span>
                      {inLibrary ? 'In Library' : 'Add to Library'}
                    </button>
                  )}
                </div>

                {/* Local Play Button */}
                {meta.localOnly && (
                  <motion.div variants={itemVariants} className="mt-8">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void openPlayer();
                      }}
                      className="group relative flex items-center justify-center md:justify-start gap-4 bg-white text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:scale-[1.02] active:scale-95 transition-all w-full md:w-auto overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] mix-blend-overlay" />
                      <div className="bg-black/10 p-2 rounded-full transition-transform group-hover:scale-110">
                        <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                      </div>
                      Play Content
                    </button>
                  </motion.div>
                )}
                
                {/* Up Next / Active Episode */}
                {activeEpisode && (
                  <motion.div variants={itemVariants} className="mt-8 p-1 inline-block rounded-2xl bg-gradient-to-r from-white/20 to-white/5 shadow-2xl backdrop-blur-xl">
                    <div className="bg-background/80 p-3 rounded-xl flex items-center gap-4">
                      <div className="bg-white text-black text-xs font-black px-3 py-1.5 rounded-lg tracking-widest shadow-inner">
                        S{activeEpisode.season} E{activeEpisode.episode}
                      </div>
                      <div className="text-lg font-bold text-white/90 leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] md:max-w-[350px]">
                        {activeEpisode.name || activeEpisode.title || `Episode ${activeEpisode.episode}`}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>

              {/* Genres */}
              {meta.genres && (
                <motion.div variants={itemVariants} className="flex flex-wrap justify-center md:justify-start gap-2">
                  {meta.genres.map(g => (
                    <span key={g} className="text-xs font-bold bg-white/5 text-white/80 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-sm">
                      {g}
                    </span>
                  ))}
                </motion.div>
              )}
              
              {/* Description */}
              <motion.div variants={itemVariants}>
                <p className="leading-relaxed text-lg text-white/70 max-w-3xl font-light drop-shadow-sm">
                  {meta.description}
                </p>
              </motion.div>

            </div>
          </div>

          {/* Series Episodes Section */}
          {meta.type === 'series' && seasons.length > 0 && (
            <motion.div variants={itemVariants} className="mt-16">
              <h3 className="text-3xl font-black mb-8 flex items-center gap-3 text-white">
                <span className="material-symbols-outlined text-white/50 text-[32px]">video_library</span> 
                Episodes
              </h3>
              
              {/* Season Tabs */}
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide mb-6 relative">
                {seasons.map(season => (
                  <button 
                    key={season} 
                    onClick={() => {
                      setActiveSeason(season);
                      const audio = new Audio("/sounds/click.mp3");
                      audio.volume = 0.5;
                      audio.play().catch(() => {});
                    }} 
                    className={`relative px-8 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all duration-300 overflow-hidden flex items-center justify-center min-w-[80px] ${
                      activeSeason === season 
                        ? 'text-black shadow-xl scale-105' 
                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/5 backdrop-blur-md'
                    }`}
                  >
                    {activeSeason === season && (
                      <motion.div 
                        layoutId="active-season"
                        className="absolute inset-0 bg-white"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center">
                      {season === 0 ? <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> : `S${season}`}
                    </span>
                  </button>
                ))}
              </div>
              
              {/* Episodes List */}
              <div className="bg-surface-container-lowest/40 rounded-3xl border border-white/10 overflow-hidden backdrop-blur-2xl max-h-[600px] overflow-y-auto custom-scrollbar shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                {episodesForActiveSeason.map((video) => {
                  const isActive = activeEpisodeId === video.id;
                  return (
                    <div 
                      key={video.id} 
                      onMouseEnter={() => {
                        const audio = new Audio("/sounds/hover.mp3");
                        audio.volume = 0.4;
                        audio.play().catch(() => {});
                      }}
                      onClick={() => {
                        setActiveEpisodeId(video.id);
                        const audio = new Audio("/sounds/click.mp3");
                        audio.volume = 0.5;
                        audio.play().catch(() => {});
                      }} 
                      className={`p-4 md:p-6 flex items-center gap-6 cursor-pointer transition-all duration-300 border-b border-white/5 last:border-0 hover:bg-white/5 group relative ${
                        isActive ? 'bg-white/10' : ''
                      }`}
                    >
                      {isActive && (
                        <motion.div layoutId="active-episode-border" className="absolute left-0 top-0 bottom-0 w-1.5 bg-white rounded-r-full" />
                      )}
                      
                      <div className="w-12 text-center shrink-0">
                        <span className={`text-2xl font-black transition-colors ${isActive ? 'text-white' : 'text-white/20 group-hover:text-white/50'}`}>
                          {video.episode}
                        </span>
                      </div>
                      
                      {video.thumbnail && (
                        <div className="w-48 aspect-video bg-black rounded-xl overflow-hidden shrink-0 hidden md:block relative border border-white/5 group-hover:border-white/20 transition-all shadow-lg group-hover:shadow-xl">
                          <img src={video.thumbnail} alt={video.name || ''} className={`w-full h-full object-cover transition-transform duration-700 ${isActive ? 'scale-105 opacity-100' : 'opacity-60 group-hover:opacity-100 group-hover:scale-105'}`} loading="lazy" />
                          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-500 ${isActive ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}`} />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-bold text-xl line-clamp-1 transition-colors ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`} title={video.name || video.title || `Episode ${video.episode}`}>
                          {video.name || video.title || `Episode ${video.episode}`}
                        </h4>
                        {video.overview && (
                          <p className={`text-sm mt-2 line-clamp-2 transition-colors font-light leading-relaxed ${isActive ? 'text-white/70' : 'text-white/40 group-hover:text-white/60'}`}>
                            {video.overview}
                          </p>
                        )}
                      </div>
                      
                      {isActive && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] shrink-0"
                        >
                          <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </motion.div>

        {!meta.localOnly && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 25 }}
            className="xl:w-[480px] shrink-0 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-8 min-h-[50vh] xl:min-h-0 xl:max-h-[calc(100vh-120px)] flex flex-col shadow-[0_30px_60px_rgba(0,0,0,0.6)] xl:sticky xl:top-24 mt-8 xl:mt-0 relative overflow-hidden transition-colors duration-1000"
            style={{ 
              backgroundColor: theme.streamsBackgroundColor,
              color: theme.streamsTextColor,
              fontFamily: theme.streamsFont
            }}
          >
            <div 
              className="absolute inset-0 -z-10 opacity-10 pointer-events-none transition-colors duration-300"
              style={{ backgroundColor: accentColor }}
            />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            
            <h3 className="text-3xl font-black mb-8 flex flex-col gap-2 shrink-0 relative z-10">
              <div className="flex items-center gap-3 text-white">
                <span className="material-symbols-outlined text-white text-[32px] drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">play_circle</span> 
                Available Streams
              </div>
              {activeEpisode && (
                <span className="text-xs text-white/50 font-mono uppercase tracking-widest ml-11 bg-white/5 inline-block w-fit px-2 py-1 rounded">
                  S{activeEpisode.season}E{activeEpisode.episode}: {activeEpisode.name || activeEpisode.title || `Episode ${activeEpisode.episode}`}
                </span>
              )}
            </h3>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-3 -mr-3 relative z-10">
              {playerLaunchError ? (
                <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
                  {playerLaunchError}
                </div>
              ) : null}
              {streamsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-28 bg-white/5 rounded-2xl animate-pulse border border-white/5" />
                  ))}
                </div>
              ) : streams.length === 0 ? (
                <div className="text-center py-20 text-white/40 bg-black/20 rounded-3xl border border-white/5 border-dashed">
                  <span className="material-symbols-outlined text-5xl mb-4 opacity-50">search_off</span>
                  <p className="font-bold text-lg text-white/60">No streams found.</p>
                  <p className="text-sm mt-2 max-w-[250px] mx-auto">Try selecting a different episode or installing more addons from the Addons page.</p>
                </div>
              ) : (
                <div className="space-y-4 pb-4">
                  {streams.map((stream, idx) => {
                    const sourceOption = buildSourceOption(stream, idx);
                    const isPlayable = sourceOption.isLikelyPlayable;
                    const badges = getQualityBadges((stream.title || '') + ' ' + (stream.name || ''));
                    const displayTitle = stream.title || stream.description || stream.behaviorHints?.filename || stream.url || stream.externalUrl || 'Unknown Details';
                    
                    return (
                      <button
                        type="button"
                        key={idx}
                        disabled={!isPlayable}
                        onClick={(event) => {
                          if (!isPlayable) {
                            event.preventDefault();
                            event.stopPropagation();
                            setPlayerLaunchError("This source does not expose a direct playable URL for native playback.");
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          void openPlayer(stream, idx);
                          const audio = new Audio("/sounds/click.mp3");
                          audio.volume = 0.5;
                          audio.play().catch(() => {});
                        }}
                        className={`w-full border p-5 rounded-2xl transition-all duration-300 group relative overflow-hidden shadow-lg text-left ${
                          isPlayable
                            ? "bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/30 hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] active:scale-[0.98]"
                            : "bg-white/5 border-white/5 opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-5 relative z-10">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <span className="font-black text-black text-[10px] shadow-sm bg-white px-2.5 py-1 rounded tracking-widest uppercase">
                                {stream.name || 'Stream'}
                              </span>
                              {!isPlayable && (
                                <span className="text-[9px] px-2 py-1 rounded border border-red-400/30 bg-red-500/10 text-red-100 font-black tracking-widest uppercase">
                                  No Direct URL
                                </span>
                              )}
                              {badges.map((b, i) => (
                                <span key={i} className={`text-[9px] px-2 py-1 rounded border ${b.color} font-black tracking-widest uppercase`}>
                                  {b.label}
                                </span>
                              ))}
                            </div>
                            <div 
                              className="text-xs text-white/50 font-mono whitespace-pre-wrap break-words bg-black/40 p-3 rounded-xl border border-white/5 group-hover:text-white/90 group-hover:border-white/10 transition-colors leading-relaxed"
                              title={displayTitle}
                            >
                              {displayTitle}
                            </div>
                          </div>
                          
                          <div 
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 shadow-xl mt-1 ${
                              isPlayable
                                ? "bg-white/10 group-hover:bg-white group-hover:text-black group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
                                : "bg-white/5 text-white/40"
                            }`}
                          >
                            <span 
                              className="material-symbols-outlined text-[28px]" 
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              play_arrow
                            </span>
                          </div>
                        </div>
                        
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}
