"use client";

import { useState } from "react";
import { AddonCard } from "@/components/addons/addon-card";
import type { Addon } from "@/components/addons/addon-card";
import { useAddons } from "@/hooks/use-addons";

import { Reorder } from "framer-motion";

const CATEGORIES = ["Installed", "Recommended", "All"];

const RECOMMENDED_ADDONS: Addon[] = [
  {
    id: "mediahoard.mhaddons",
    name: "MHAddons",
    description: "Ultimate addon dashboard for MediaHoard (Includes MHMetadata, MHStreams, and MHManager.)",
    version: "latest",
    author: "MediaHoard",
    icon: "/mhaddons-logo.webp",
    isInstalled: false,
    type: "stremio",
    typeLabel: "MediaHoard",
    tags: ["MediaHoard"],
    actionUrl: "https://github.com/clebmb/mhaddons",
    actionLabel: "Open",
  },
  {
    id: "aiometadata",
    name: "AIOMetadata",
    description: "AIOMetadata is a next-generation, power-user-focused metadata addon for Stremio. It aggregates and enriches movie, series, and anime metadata from multiple sources (TMDB, TVDB, MyAnimeList, AniList, IMDb, TVmaze, Fanart.tv, MDBList, and more), giving you full control over catalog sources, artwork, and search.",
    version: "latest",
    author: "AIOMetadata",
    icon: "/addon.webp",
    isInstalled: false,
    type: "stremio",
    tags: ["Stremio"],
    actionUrl: "https://github.com/cedya77/aiometadata",
    actionLabel: "Open",
  },
  {
    id: "aiostreams",
    name: "AIOStreams",
    description: "AIOStreams was created to give users ultimate control over their Stremio experience. Instead of juggling multiple addons with different configurations and limitations, AIOStreams acts as a central hub. It fetches results from all your favorite sources, then filters, sorts, and formats them according to your rules before presenting them in a single, clean list.",
    version: "latest",
    author: "AIOStreams",
    icon: "/addon.webp",
    isInstalled: false,
    type: "stremio",
    tags: ["Stremio"],
    actionUrl: "https://github.com/Viren070/AIOStreams",
    actionLabel: "Open",
  },
  {
    id: "mhmanager",
    name: "MHManager",
    description: "AIOManager is the ultimate account management toolkit for Stremio. Built for power users who demand full functional and granular control, it allows you to sync multiple identities, backup complex addon configurations, and track your watch history with absolute privacy.",
    version: "latest",
    author: "AIOManager",
    icon: "/addon.webp",
    isInstalled: false,
    type: "stremio",
    tags: ["Stremio"],
    actionUrl: "https://github.com/Sonicx161/AIOManager",
    actionLabel: "Open",
  },
  {
    id: "stremio.compatible.addons",
    name: "Stremio Addons",
    description: "MediaHoard uses Stremio-compatible manifest URLs. Browse maintained manifests and paste them into MediaHoard.",
    version: "latest",
    author: "Stremio",
    icon: "/addon.webp",
    isInstalled: false,
    type: "stremio",
    tags: ["Stremio"],
    actionUrl: "https://stremio-addons.net",
    actionLabel: "Browse",
  },
];

export default function AddonsPage() {
  const { installedAddons, isLoaded, installAddon, uninstallAddon, setAddons } = useAddons();
  const [activeCategory, setActiveCategory] = useState("Installed");
  const [searchQuery, setSearchQuery] = useState("");
  const [addonUrl, setAddonUrl] = useState("");
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState("");

  const filteredAddons = installedAddons.filter((addon) => {
    // Filter by search
    if (searchQuery && !addon.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Filter by category (for now we only have installed addons, so "All" and "Installed" are the same)
    return true;
  });

  const filteredRecommendedAddons = RECOMMENDED_ADDONS.filter((addon) => {
    if (!searchQuery) return true;
    return addon.name.toLowerCase().includes(searchQuery.toLowerCase())
      || addon.description.toLowerCase().includes(searchQuery.toLowerCase())
      || (addon.tags || []).some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const isRecommendedTab = activeCategory === "Recommended";

  const handleInstallUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addonUrl) return;
    
    setIsInstalling(true);
    setInstallError("");
    
    const result = await installAddon(addonUrl);
    
    if (result.success) {
      setAddonUrl("");
    } else {
      setInstallError(result.error || "Failed to install addon");
    }
    
    setIsInstalling(false);
  };

  return (
    <main className="flex-1 flex flex-col relative w-full min-h-screen pt-32 pb-32 md:pb-16 px-6">
      <div className="max-w-[1440px] mx-auto w-full flex-1 flex flex-col md:flex-row gap-8 animate-in fade-in duration-200">
        
        {/* Left Sidebar */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-6">
          <div className="sticky top-32">
            <h2 className="text-headline-md text-white mb-4 px-3">Addons</h2>
            <nav className="flex flex-col gap-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2.5 rounded-full text-left font-medium transition-all duration-200 flex items-center justify-between ${
                    activeCategory === cat 
                      ? "bg-white text-black shadow-lg scale-[1.02]" 
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {cat}
                  {cat === "Installed" && isLoaded && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeCategory === cat ? 'bg-black/10' : 'bg-white/10'}`}>
                      {installedAddons.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            
            <div className="mt-8 px-3">
              <p className="text-[10px] text-white/35 uppercase tracking-widest mb-3">STREMIO AND NUVIO SUPPORT</p>
              <h3 className="text-label-sm text-white/50 uppercase tracking-widest mb-3">Add Custom Addon</h3>
              <form onSubmit={handleInstallUrl} className="flex flex-col gap-3">
                <input 
                  type="text" 
                  value={addonUrl}
                  onChange={(e) => setAddonUrl(e.target.value)}
                  placeholder="Paste Addon URL..." 
                  disabled={isInstalling}
                  className="w-full bg-surface-container border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all disabled:opacity-50"
                />
                <button 
                  type="submit"
                  disabled={!addonUrl || isInstalling}
                  className="w-full bg-surface-container-high hover:bg-surface-bright text-white disabled:opacity-50 disabled:hover:bg-surface-container-high px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border border-white/5 flex items-center justify-center gap-2"
                >
                  {isInstalling ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">add_link</span>
                  )}
                  {isInstalling ? "Installing..." : "Add URL"}
                </button>
                {installError && (
                  <p className="text-xs text-error mt-1 px-1">{installError}</p>
                )}
              </form>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="flex-1 flex flex-col gap-6">
          
          {/* Top Bar (Search & Filter) */}
          <div className="flex items-center justify-between bg-surface-container/30 border border-white/5 p-2 rounded-2xl backdrop-blur-md">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/40">search</span>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRecommendedTab ? "Search recommended addons..." : "Search installed addons..."} 
                className="w-full bg-transparent border-none text-white placeholder:text-white/40 px-12 py-2 focus:outline-none focus:ring-0 text-body-md"
              />
            </div>
            <div className="px-4 flex items-center gap-2 border-l border-white/10 text-white/60">
              <span className="material-symbols-outlined text-[20px]">filter_list</span>
              <span className="text-sm font-medium hidden sm:inline-block">Filter</span>
            </div>
          </div>

          {/* Grid */}
          {!isLoaded ? (
             <div className="flex-1 flex items-center justify-center">
               <span className="material-symbols-outlined text-4xl text-white/20 animate-spin">refresh</span>
             </div>
          ) : isRecommendedTab ? (
            filteredRecommendedAddons.length > 0 ? (
              <div className="flex flex-col gap-3">
                {filteredRecommendedAddons.map((addon) => (
                  <AddonCard key={addon.id} addon={addon} />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border border-white/5 rounded-3xl bg-surface-container-lowest/50">
                <span className="material-symbols-outlined text-6xl text-white/10 mb-4">extension_off</span>
                <h3 className="text-headline-md text-white/80 mb-2">No recommendations found</h3>
                <p className="text-body-md text-white/40">Try clearing your search.</p>
              </div>
            )
          ) : filteredAddons.length > 0 ? (
            <Reorder.Group 
              axis="y" 
              values={installedAddons} 
              onReorder={setAddons}
              className="flex flex-col gap-3"
            >
              {filteredAddons.map((addon) => (
                <Reorder.Item 
                  key={addon.id} 
                  value={addon}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <AddonCard addon={addon} onUninstall={uninstallAddon} />
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border border-white/5 rounded-3xl bg-surface-container-lowest/50">
              <span className="material-symbols-outlined text-6xl text-white/10 mb-4">extension_off</span>
              <h3 className="text-headline-md text-white/80 mb-2">No addons found</h3>
              <p className="text-body-md text-white/40">Try adding a custom addon URL or clear your search.</p>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
