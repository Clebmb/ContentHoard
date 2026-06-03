"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Loader2, Info } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAddons } from "@/hooks/use-addons";
import { MediaCard } from "./media/media-card";

type SearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const { theme } = useTheme();
  const { installedAddons } = useAddons();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setHasSearched(false);
      setResults([]);
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      handleSearch(query);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const searchTasks = installedAddons.flatMap(addon => {
        const searchableCatalogs = addon.catalogs?.filter(cat => 
          cat.extra?.some(e => e.name === 'search')
        ) || [];

        const targetCatalogs = searchableCatalogs.length > 0 
          ? searchableCatalogs 
          : (addon.catalogs?.filter(cat => cat.type === 'movie' || cat.type === 'series') || []);

        return targetCatalogs.map(async (cat) => {
          try {
            const res = await fetch(
              `/api/addon/catalog?manifestUrl=${encodeURIComponent(addon.manifestUrl!)}&type=${cat.type}&id=${cat.id}&extra=${encodeURIComponent(`search=${searchTerm}`)}`
            );
            if (!res.ok) return null;
            const data = await res.json();
            
            const metas = (data.metas || []).filter((item: any) => {
              const name = (item.name || "").toLowerCase();
              const term = searchTerm.toLowerCase();
              return name.includes(term) || term.includes(name);
            });
            
            return metas;
          } catch (e) {
            return null;
          }
        });
      });

      const allResults = await Promise.all(searchTasks);
      const flattened = allResults.filter(Boolean).flat();
      
      const seen = new Set();
      const uniqueResults = flattened.filter(item => {
        const duplicate = seen.has(item.id);
        seen.add(item.id);
        return !duplicate;
      });

      setResults(uniqueResults);
    } catch (e: any) {
      setError("Failed to search catalogs");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-start justify-center pt-20 px-4">
        {/* Backdrop - No blur to ensure crystal clear text rendering on top */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 pointer-events-auto"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="relative z-10 w-full max-w-4xl max-h-[80vh] rounded-[2.5rem] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden pointer-events-auto"
          style={{
            backgroundColor: theme.menuBackgroundColor,
            color: theme.menuTextColor,
            fontFamily: theme.menuFont,
            WebkitFontSmoothing: 'antialiased'
          }}
        >
          {/* Search Input Header */}
          <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-white/[0.02]">
            <Search className="w-6 h-6" style={{ color: theme.menuTextColor, opacity: 0.4 }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search movies, TV shows, and more..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-2xl font-bold placeholder:text-white/20"
              style={{ color: theme.menuTextColor }}
            />
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.menuTextColor, opacity: 0.4 }} />
            ) : (
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-all">
                <X className="w-6 h-6" style={{ color: theme.menuTextColor, opacity: 0.4 }} />
              </button>
            )}
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            {error && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <Info className="w-12 h-12 text-red-400" />
                <p className="opacity-60">{error}</p>
              </div>
            )}

            {!isLoading && results.length === 0 && query.trim() !== "" && hasSearched && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <Search className="w-12 h-12 opacity-20" />
                <p className="opacity-40">No results found for "{query}"</p>
              </div>
            )}

            {!hasSearched && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
                <Search className="w-16 h-16 mb-4" />
                <p className="text-xl font-bold">Start typing to search...</p>
                <p className="text-sm">We'll search across all your installed addons</p>
              </div>
            )}

            {results.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-10 pb-10">
                {results.map((item) => (
                  <div key={item.id} onClick={onClose} className="cursor-pointer">
                    <MediaCard item={item} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="px-8 py-4 border-t border-white/5 flex justify-between items-center bg-white/[0.04]">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-30">
              Searching {installedAddons.length} Addons
            </p>
            {results.length > 0 && (
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-30">
                {results.length} Results
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
