"use client";

import { useState } from "react";
import { useMediaHoard } from "@/providers/MediaHoardProvider";
import { ListPreference } from "@/providers/MediaHoardProvider";
import { Reorder } from "framer-motion";

const TABS = ["Home", "Browse", "Movies", "TV"] as const;
type TabType = typeof TABS[number];

export default function ListsPage() {
  const { preferences, savePreferences, isLoaded, setListOrder, getOrderedPreferences } = useMediaHoard();
  const [activeTab, setActiveTab] = useState<TabType>("Home");
  const [listUrl, setListUrl] = useState("");
  
  // Local state for names to prevent immediate reset when clearing input
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!listUrl) return;
    console.log("Adding list from URL:", listUrl);
    setListUrl("");
    alert("Adding lists via URL will be implemented in the Addon engine.");
  };

  const toggleListVisibility = (listId: string, tab: TabType, visible: boolean) => {
    const tabKey = tab.toLowerCase() as keyof ListPreference['pages'];
    const newPrefs = {
      ...preferences,
      [listId]: {
        ...preferences[listId],
        pages: {
          ...preferences[listId].pages,
          [tabKey]: visible
        }
      }
    };
    savePreferences(newPrefs);
  };

  const updateListName = (listId: string, newName: string) => {
    // Only update local state while typing
    setEditingNames(prev => ({ ...prev, [listId]: newName }));
  };

  const commitListName = (listId: string) => {
    const newName = editingNames[listId];
    if (newName === undefined) return;

    const tabKey = activeTab.toLowerCase() as keyof ListPreference['customNames'];
    const newPrefs = {
      ...preferences,
      [listId]: {
        ...preferences[listId],
        customNames: {
          ...preferences[listId].customNames,
          [tabKey]: newName.trim() || undefined // If empty, revert to original (by making it undefined)
        }
      }
    };
    savePreferences(newPrefs);
    // Clear editing state for this list
    setEditingNames(prev => {
      const next = { ...prev };
      delete next[listId];
      return next;
    });
  };

  if (!isLoaded) {
    return (
      <main className="flex-1 flex flex-col relative w-full h-full pt-32 pb-16 px-6">
        <div className="flex-1 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-white/20 animate-spin">refresh</span>
        </div>
      </main>
    );
  }

  const allLists = Object.values(preferences);
  const activeTabKey = activeTab.toLowerCase() as "home" | "browse" | "movies" | "tv";
  const activeLists = getOrderedPreferences(activeTabKey);

  const availableLists = allLists.filter(list => {
    // Must not already be active on this tab
    const isActive = list.pages[activeTab.toLowerCase() as keyof ListPreference['pages']];
    if (isActive) return false;

    // If on Movies tab, only show movie catalogs
    if (activeTab === "Movies") {
      return list.catalogType === "movie";
    }
    // If on TV tab, only show series/tv catalogs
    if (activeTab === "TV") {
      return list.catalogType === "series" || list.catalogType === "tv";
    }
    // Home shows everything available
    return true;
  });

  const getTag = (type: string) => {
    const isMovie = type === "movie";
    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isMovie ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
        {isMovie ? 'MOVIE' : 'TV'}
      </span>
    );
  };

  const handleReorder = (newOrderedLists: ListPreference[]) => {
    const pageKey = activeTab.toLowerCase();
    setListOrder(pageKey, newOrderedLists.map(l => l.id));
  };

  return (
    <main className="flex-1 flex flex-col relative w-full pt-32 pb-32 md:pb-16 px-6">
      <div className="max-w-[1440px] mx-auto w-full flex-1 flex flex-col lg:flex-row gap-8 animate-in fade-in duration-200">
        
        {/* Left Sidebar - Tabs & Add URL */}
        <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-6">
          <div className="sticky top-32">
            <h2 className="text-headline-md text-white mb-4 px-3">Manage Lists</h2>
            <nav className="flex flex-col gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 rounded-full text-left font-medium transition-all duration-200 flex items-center justify-between ${
                    activeTab === tab 
                      ? "bg-white text-black shadow-lg scale-[1.02]" 
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">
                      {tab === "Home" ? "home" : tab === "Browse" ? "apps" : tab === "Movies" ? "movie" : "tv"}
                    </span>
                    {tab} Page
                  </div>
                </button>
              ))}
            </nav>
            
            <div className="mt-8 px-3">
              <h3 className="text-label-sm text-white/50 uppercase tracking-widest mb-1 leading-relaxed">Add List from URL</h3>
              <p className="text-[10px] text-white/30 mb-3 italic">New lists will appear in 'Available' for {activeTab}.</p>
              <form onSubmit={handleAddUrl} className="flex flex-col gap-3">
                <input 
                  type="text" 
                  value={listUrl}
                  onChange={(e) => setListUrl(e.target.value)}
                  placeholder="Paste URL..." 
                  className="w-full bg-surface-container border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all"
                />
                <button 
                  type="submit"
                  disabled={!listUrl}
                  className="w-full bg-surface-container-high hover:bg-surface-bright text-white disabled:opacity-50 disabled:hover:bg-surface-container-high px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border border-white/5 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">add_link</span>
                  Add List
                </button>
              </form>
              <p className="mt-4 text-[10px] text-white/20 leading-tight">Supports MDBList, Trakt, Letterboxd, SIMKL</p>
            </div>
          </div>
        </aside>

        {/* Middle Area - Active Lists */}
        <section className="flex-1 flex flex-col gap-4">
          <div className="flex items-center justify-between bg-surface-container/30 border border-white/5 p-4 rounded-2xl backdrop-blur-md mb-2">
            <h3 className="text-body-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-white/50">visibility</span>
              Active on {activeTab}
            </h3>
            <span className="text-sm font-medium text-white/40">{activeLists.length} Lists</span>
          </div>

          <div className="flex flex-col gap-3">
            {activeLists.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-surface-container-low/30">
                <p className="text-white/40">No lists are currently visible on the {activeTab} page.</p>
              </div>
            ) : (
              <Reorder.Group axis="y" values={activeLists} onReorder={handleReorder} className="flex flex-col gap-3">
                {activeLists.map(list => (
                  <Reorder.Item 
                    key={list.id} 
                    value={list}
                    className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-surface-container-low border border-white/5 hover:border-white/20 transition-colors group cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getTag(list.catalogType)}
                        <p className="text-[10px] text-white/40 uppercase tracking-wide truncate">{list.originalName}</p>
                      </div>
                      <input 
                        type="text"
                        value={editingNames[list.id] !== undefined ? editingNames[list.id] : (list.customNames[activeTab.toLowerCase() as keyof ListPreference['customNames']] || list.originalName)}
                        onChange={(e) => updateListName(list.id, e.target.value)}
                        onBlur={() => commitListName(list.id)}
                        className="bg-transparent border-none text-white font-medium text-body-md focus:outline-none focus:ring-0 w-full truncate placeholder:text-white/30"
                        placeholder={list.originalName}
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white/20 group-hover:text-white/40 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleListVisibility(list.id, activeTab, false);
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-error/20 text-white/40 hover:text-error transition-colors"
                        title="Remove from page"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}
          </div>
        </section>

        {/* Right Sidebar - Available Lists */}
        <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
          <div className="flex items-center justify-between bg-surface-container/30 border border-white/5 p-4 rounded-2xl backdrop-blur-md mb-2">
            <h3 className="text-body-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-white/50">visibility_off</span>
              Available Lists
            </h3>
            <span className="text-sm font-medium text-white/40">{availableLists.length}</span>
          </div>

          <div className="flex flex-col gap-3 max-h-[calc(100vh-250px)] overflow-y-auto scrollbar-hide pr-2">
            {availableLists.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-surface-container-low/30">
                <p className="text-white/40 text-sm">All available lists are already added to the {activeTab} page.</p>
              </div>
            ) : (
              availableLists.map(list => (
                <div key={list.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-container-lowest border border-white/5 hover:border-white/20 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {getTag(list.catalogType)}
                      <p className="text-[10px] text-white/30 uppercase tracking-wide truncate">{list.addonId}</p>
                    </div>
                    <p className="text-sm font-medium text-white/70 group-hover:text-white truncate">
                      {list.customNames[activeTab.toLowerCase() as keyof ListPreference['customNames']] || list.originalName}
                    </p>
                  </div>
                  <button 
                    onClick={() => toggleListVisibility(list.id, activeTab, true)}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white text-white/60 hover:text-black transition-all shrink-0"
                    title="Add to page"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

      </div>
    </main>
  );
}

