"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMediaHoard } from "@/providers/MediaHoardProvider";
import { CatalogSection } from "@/components/media/catalog-section";
import Loading from "@/app/loading";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { getVisibleLists, isLoaded } = useMediaHoard();
  const allCatalogs = getVisibleLists("home");
  
  const [visibleCount, setVisibleCount] = useState(4);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const lastSectionRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < allCatalogs.length) {
        setVisibleCount(prev => Math.min(prev + 3, allCatalogs.length));
      }
    }, { threshold: 0.1 });

    if (node) observerRef.current.observe(node);
  }, [visibleCount, allCatalogs.length]);

  if (!isLoaded) return <Loading />;

  if (allCatalogs.length === 0) {
    return (
      <main className="flex-1 flex flex-col relative w-full pt-32 pb-32 md:pb-16 px-6">
        <div className="max-w-[1440px] mx-auto w-full flex-1 flex flex-col items-center justify-center text-center p-12 mt-20 border border-white/5 rounded-3xl bg-surface-container-lowest/50">
          <span className="material-symbols-outlined text-6xl text-white/10 mb-4">extension</span>
          <h3 className="text-headline-md text-white/80 mb-2">No lists available for Home</h3>
          <p className="text-body-md text-white/40 mb-6">Install an addon with catalogs or manage your lists to see content here.</p>
          <a href="/lists" className="px-6 py-3 rounded-full bg-white text-black font-bold hover:bg-white/90 transition-all">
            Manage Lists
          </a>
        </div>
      </main>
    );
  }

  const visibleCatalogs = allCatalogs.slice(0, visibleCount);

  return (
    <main className="flex-1 flex flex-col relative w-full pt-32 pb-16">
      <div className="w-full flex-1 flex flex-col">
        <div className="flex flex-col gap-12">
          <AnimatePresence mode="popLayout">
            {visibleCatalogs.map((cat, i) => (
              <motion.div 
                key={`${cat.id}-${i}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: i < 3 ? i * 0.1 : 0 }}
                ref={i === visibleCatalogs.length - 1 ? lastSectionRef : null}
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
          
          {visibleCount < allCatalogs.length && (
            <div className="h-40 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
