"use client";

import { useState, useRef, useCallback } from "react";
import { useMediaHoard } from "@/providers/MediaHoardProvider";
import { CatalogSection } from "@/components/media/catalog-section";
import Loading from "@/app/loading";
import { motion, AnimatePresence } from "framer-motion";

export default function TvPage() {
  const { getVisibleLists, isLoaded } = useMediaHoard();
  const tvCatalogs = getVisibleLists("tv");
  
  const [visibleCount, setVisibleCount] = useState(4);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const lastSectionRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < tvCatalogs.length) {
        setVisibleCount(prev => Math.min(prev + 3, tvCatalogs.length));
      }
    }, { threshold: 0.1 });

    if (node) observerRef.current.observe(node);
  }, [visibleCount, tvCatalogs.length]);

  if (!isLoaded) return <Loading />;

  return (
    <main className="flex-1 flex flex-col relative w-full pt-32 pb-32 md:pb-16 px-6">
      <div className="max-w-[1440px] mx-auto w-full flex-1 flex flex-col">
        {tvCatalogs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 mt-20 border border-white/5 rounded-3xl bg-surface-container-lowest/50">
            <span className="material-symbols-outlined text-6xl text-white/10 mb-4">tv</span>
            <h3 className="text-headline-md text-white/80 mb-2">No TV lists available</h3>
            <p className="text-body-md text-white/40 mb-6">Install an addon with TV catalogs or manage your lists to see content here.</p>
            <a href="/lists" className="px-6 py-3 rounded-full bg-white text-black font-bold hover:bg-white/90 transition-all">
              Manage Lists
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <div className="px-6 mb-4 animate-in fade-in slide-in-from-left-4 duration-700">
              <h1 className="text-display-md text-white">TV Shows</h1>
            </div>
            
            <AnimatePresence mode="popLayout">
              {tvCatalogs.slice(0, visibleCount).map((cat, i) => (
                <motion.div 
                  key={`${cat.id}-${i}`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: i < 3 ? i * 0.1 : 0 }}
                  ref={i === Math.min(visibleCount, tvCatalogs.length) - 1 ? lastSectionRef : null}
                >
                  <CatalogSection 
                    title={cat.name}
                    manifestUrl={cat.manifestUrl}
                    type={cat.type}
                    id={cat.catalogId}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {visibleCount < tvCatalogs.length && (
              <div className="h-40 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
