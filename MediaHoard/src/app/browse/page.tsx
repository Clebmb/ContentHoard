"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMediaHoard } from "@/providers/MediaHoardProvider";
import { MediaItem, MediaCard } from "@/components/media/media-card";
import Loading from "@/app/loading";
import { motion, AnimatePresence } from "framer-motion";

// Genre mapping for TMDB-style catalogs if needed, or just extract from items
const TMDB_GENRES: Record<number, string> = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
    99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
    27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
    10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western", 10759: "Action & Adventure",
    10762: "Kids", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy",
    10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

export default function BrowsePage() {
  const { getVisibleLists, isLoaded } = useMediaHoard();
  
  // Get catalogs visible for browse page
  const allCatalogs = useMemo(() => {
    return getVisibleLists("browse");
  }, [getVisibleLists]);

  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  
  // Filters
  const [genreFilter, setGenreFilter] = useState("All Genres");
  const [yearFilter, setYearFilter] = useState("All Years");

  const observerRef = useRef<IntersectionObserver | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const prevCatalogIdRef = useRef<string | null>(null);

  const selectedCatalog = useMemo(() => 
    allCatalogs.find(c => c.id === selectedCatalogId) || allCatalogs[0], 
    [allCatalogs, selectedCatalogId]
  );

  useEffect(() => {
    if (allCatalogs.length > 0 && !selectedCatalogId) {
      setSelectedCatalogId(allCatalogs[0].id);
    }
  }, [allCatalogs, selectedCatalogId]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchItems = useCallback(async (isInitial = false) => {
    if (!selectedCatalog) {
      if (isInitial) setLoading(false);
      return;
    }
    
    const currentSkip = isInitial ? 0 : items.length;
    if (!isInitial && !hasMore) return;

    if (isInitial) {
      setLoading(true);
      setItems([]);
      setSkip(0);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    setError("");
    try {
      const url = `/api/addon/catalog?manifestUrl=${encodeURIComponent(selectedCatalog.manifestUrl)}&type=${encodeURIComponent(selectedCatalog.type)}&id=${encodeURIComponent(selectedCatalog.catalogId)}&skip=${currentSkip}`;
      const res = await fetch(url);
      
      if (!res.ok) throw new Error("Failed to fetch catalog data");
      
      const data = await res.json();
      const fetchedItems = data.metas || [];
      
      setItems(prev => {
        if (isInitial) return fetchedItems;
        // Deduplicate
        const existingIds = new Set(prev.map(i => i.id));
        const newItems = fetchedItems.filter((i: any) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
      setSkip(currentSkip);
      setHasMore(fetchedItems.length >= 20);

    } catch (err: any) {
      setError(err.message || "Failed to load catalog");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedCatalog, hasMore, items.length]);

  useEffect(() => {
    if (isLoaded && allCatalogs.length > 0) {
      if (!selectedCatalogId) {
        setSelectedCatalogId(allCatalogs[0].id);
      } else if (prevCatalogIdRef.current !== selectedCatalogId) {
        // Catalog changed or initial load
        fetchItems(true);
        prevCatalogIdRef.current = selectedCatalogId;
        // Reset filters
        setGenreFilter("All Genres");
        setYearFilter("All Years");
      }
    }
  }, [selectedCatalogId, isLoaded, allCatalogs.length, fetchItems]);

  // Infinite Scroll Sentinel
  const lastItemRef = useCallback((node: HTMLDivElement | null) => {
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchItems(false);
      }
    }, { threshold: 0.1 });

    if (node) observerRef.current.observe(node);
  }, [loadingMore, hasMore, fetchItems]);

  // Derived filters
  const genres = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      if (Array.isArray((item as any).genres)) {
        (item as any).genres.forEach((g: string) => set.add(g));
      }
    });
    return ["All Genres", ...Array.from(set).sort()];
  }, [items]);

  const years = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      const year = item.releaseInfo || (item as any).year;
      if (year) {
        const y = year.toString().substring(0, 4);
        if (/^\d{4}$/.test(y)) set.add(y);
      }
    });
    return ["All Years", ...Array.from(set).sort().reverse()];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesGenre = genreFilter === "All Genres" || 
        (Array.isArray((item as any).genres) && (item as any).genres.includes(genreFilter));
      
      const year = item.releaseInfo || (item as any).year;
      const matchesYear = yearFilter === "All Years" || 
        (year && year.toString().includes(yearFilter));
        
      return matchesGenre && matchesYear;
    });
  }, [items, genreFilter, yearFilter]);

  if (!isLoaded) return <Loading />;

  return (
    <main className="flex-1 flex flex-col relative w-full pt-32 pb-32 md:pb-16 px-6 overflow-hidden">
      <div className="max-w-[1600px] mx-auto w-full flex-1 flex flex-col">
        
        {/* Browse Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 px-4 relative z-50">
          <div className="space-y-4">
            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-500">
               <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.3)]">
                 <span className="material-symbols-outlined text-3xl">apps</span>
               </div>
               <div>
                 <h1 className="text-display-sm md:text-display-md text-white font-bold tracking-tight">Browse</h1>
                 <p className="text-body-sm text-white/40 font-medium uppercase tracking-widest">Explore all catalogs</p>
               </div>
            </div>

            {/* Catalog Selector Dropdown */}
            <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200" ref={selectorRef}>
              <button
                onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all min-w-[240px] justify-between"
              >
                <span className="font-bold">{selectedCatalog?.name || "Select Catalog"}</span>
                <span className={`material-symbols-outlined transition-transform duration-300 ${isSelectorOpen ? "rotate-180" : ""}`}>expand_more</span>
              </button>

              <AnimatePresence>
                {isSelectorOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 mt-2 w-full max-h-64 overflow-y-auto z-[100] bg-surface-container-high/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl custom-scrollbar"
                  >
                    {allCatalogs.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCatalogId(cat.id);
                          setIsSelectorOpen(false);
                        }}
                        className={`w-full text-left px-6 py-4 text-sm font-medium transition-all hover:bg-white/10 ${
                          selectedCatalogId === cat.id ? "text-primary bg-primary/5" : "text-white/60"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-700 delay-300">
             <div className="relative">
                <select 
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                  className="appearance-none bg-surface-container-high/40 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3 pr-12 text-sm text-white focus:outline-none focus:border-primary/50 transition-all cursor-pointer hover:bg-surface-container-high/60"
                >
                  {genres.map(g => <option key={g} value={g} className="bg-surface-container-high">{g}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">expand_more</span>
             </div>

             <div className="relative">
                <select 
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="appearance-none bg-surface-container-high/40 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3 pr-12 text-sm text-white focus:outline-none focus:border-primary/50 transition-all cursor-pointer hover:bg-surface-container-high/60"
                >
                  {years.map(y => <option key={y} value={y} className="bg-surface-container-high">{y}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">calendar_month</span>
             </div>
          </div>
        </div>

        {/* Results Grid */}
        <div className="flex-1 min-h-0 custom-scrollbar overflow-y-auto px-4 pt-10 -mt-10 pb-20">
          {loading && items.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-12">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-2xl bg-white/5 animate-pulse border border-white/5" />
              ))}
            </div>
          ) : filteredItems.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-40 text-center">
               <span className="material-symbols-outlined text-6xl text-white/10 mb-4">search_off</span>
               <h3 className="text-headline-md text-white/60">No items found</h3>
               <p className="text-body-md text-white/30">Try adjusting your filters or selecting a different catalog.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-12">
              <AnimatePresence mode="popLayout">
                {filteredItems.map((item, i) => (
                  <motion.div
                    key={`${item.id}-${i}`}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ 
                      duration: 0.5, 
                      delay: loadingMore ? ((i - (items.length - 20)) * 0.05) : (i * 0.03),
                      ease: [0.23, 1, 0.32, 1] 
                    }}
                    ref={i === filteredItems.length - 6 ? lastItemRef : null}
                  >
                    <MediaCard item={item} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Load More Sentinel */}
          <div className="h-40 flex items-center justify-center mt-12">
            {loadingMore ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                <span className="text-xs text-white/40 font-bold uppercase tracking-widest animate-pulse">Fetching more...</span>
              </div>
            ) : hasMore && items.length > 0 ? (
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="w-1/3 h-full bg-gradient-to-r from-transparent via-primary/50 to-transparent"
                />
              </div>
            ) : items.length > 0 && (
               <div className="flex flex-col items-center gap-2 opacity-20">
                 <div className="h-px w-20 bg-white/50" />
                 <span className="text-[10px] font-bold uppercase tracking-tighter">End of Catalog</span>
                 <div className="h-px w-20 bg-white/50" />
               </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
