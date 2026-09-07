import React, { useEffect, useState, useRef, useCallback } from "react";
import { MediaItem, MediaCard } from "./media-card";
import { motion, AnimatePresence } from "framer-motion";

interface CatalogSectionProps {
  title: string;
  manifestUrl: string;
  type: string;
  id: string;
}

// Global in-memory cache for catalog data to persist across tab navigation
const catalogCache = new Map<string, { items: MediaItem[], skip: number, hasMore: boolean }>();

export function CatalogSection({ title, manifestUrl, type, id }: CatalogSectionProps) {
  const cacheKey = `${manifestUrl}-${type}-${id}`;
  const cached = catalogCache.get(cacheKey);

  const [items, setItems] = useState<MediaItem[]>(cached?.items || []);
  const [skip, setSkip] = useState(cached?.skip || 0);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const [loading, setLoading] = useState(!cached);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchCatalog = useCallback(async (isInitial = false) => {
    const currentSkip = isInitial ? 0 : skip + 20;
    if (!isInitial && !hasMore) return;

    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    setError("");
    try {
      const url = `/api/addon/catalog?manifestUrl=${encodeURIComponent(manifestUrl)}&type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}&skip=${currentSkip}`;
      const res = await fetch(url);
      
      if (!res.ok) throw new Error("Failed to fetch catalog data");
      
      const data = await res.json();
      const fetchedItems = data.metas || [];
      
      const newItems = isInitial ? fetchedItems : [...items, ...fetchedItems];
      const newHasMore = fetchedItems.length >= 20;

      setItems(newItems);
      setSkip(currentSkip);
      setHasMore(newHasMore);
      
      // Update cache
      catalogCache.set(cacheKey, { items: newItems, skip: currentSkip, hasMore: newHasMore });

    } catch (err: any) {
      setError(err.message || "Failed to load catalog");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [manifestUrl, type, id, items, skip, hasMore, cacheKey]);

  useEffect(() => {
    if (!cached) {
      fetchCatalog(true);
    }
  }, [fetchCatalog, cached]);

  // Sentinel for infinite scroll
  const lastItemRef = useCallback((node: HTMLDivElement | null) => {
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchCatalog(false);
      }
    }, { root: scrollContainerRef.current, threshold: 0.1 });

    if (node) observerRef.current.observe(node);
  }, [loadingMore, hasMore, fetchCatalog]);

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col gap-4 mb-12 animate-in fade-in duration-500">
        <h2 className="text-headline-md text-white font-semibold px-6">{title}</h2>
        <div className="flex gap-4 overflow-hidden px-6 pb-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-[160px] md:w-[200px] shrink-0 aspect-[2/3] bg-white/5 animate-pulse rounded-lg border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (error && items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 mb-12">
      <div className="flex items-center justify-between px-12">
        <h2 
          className="text-headline-md text-white font-semibold tracking-tight hover:text-white/80 transition-colors cursor-default"
          style={{ fontFamily: 'var(--theme-font-title)' }}
        >
          {title}
        </h2>
        {loadingMore && (
           <div className="flex items-center gap-2 text-white/40 text-xs font-medium animate-pulse">
             <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
             Loading more...
           </div>
        )}
      </div>
      
      <div className="relative group/scroll overflow-visible [mask-image:linear-gradient(to_right,black_85%,transparent)] -mt-12 -mb-12">
        {/* Horizontal scrollable container */}
        <div 
          ref={scrollContainerRef}
          className="flex gap-5 overflow-x-auto overflow-y-visible px-12 py-16 scrollbar-hide snap-x scroll-smooth" 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <AnimatePresence initial={false}>
            {items.map((item, i) => (
              <motion.div 
                key={`${item.id}-${i}`} 
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: (i % 20) * 0.05, ease: "easeOut" }}
                className="snap-start first:pl-2"
                ref={i === items.length - 3 ? lastItemRef : null} // Trigger early
              >
                <MediaCard item={item} />
              </motion.div>
            ))}
          </AnimatePresence>

          {hasMore && (
            <div 
              ref={items.length < 3 ? lastItemRef : null} // Fallback for very short lists
              className="flex items-center justify-center min-w-[200px] aspect-[2/3] rounded-xl border border-dashed border-white/10 bg-white/5 hover:bg-white/10 transition-all group/load"
            >
              {loadingMore ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span className="text-xs text-white/40 font-bold uppercase tracking-widest">Loading</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 opacity-40 group-hover/load:opacity-100 transition-opacity">
                   <span className="material-symbols-outlined text-4xl">keyboard_double_arrow_right</span>
                   <span className="text-[10px] font-bold uppercase tracking-wider">Scroll for more</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
