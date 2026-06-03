"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAddons } from "@/hooks/use-addons";
import { useProfiles } from "./ProfileProvider";
import { getAppStorageItem, setAppStorageItem } from "@/lib/app-storage";

export interface ListPreference {
  id: string;
  addonId: string;
  catalogId: string;
  catalogType: string;
  originalName: string;
  customNames: {
    home?: string;
    browse?: string;
    movies?: string;
    tv?: string;
  };
  pages: {
    home: boolean;
    browse: boolean;
    movies: boolean;
    tv: boolean;
  };
}

interface MediaHoardContextType {
  preferences: Record<string, ListPreference>;
  savePreferences: (newPrefs: Record<string, ListPreference>) => void;
  getVisibleLists: (page: "home" | "browse" | "movies" | "tv") => any[];
  getOrderedPreferences: (page: "home" | "browse" | "movies" | "tv") => ListPreference[];
  setListOrder: (page: string, newOrder: string[]) => void;
  isLoaded: boolean;
}

const MediaHoardContext = createContext<MediaHoardContextType | undefined>(undefined);

export function MediaHoardProvider({ children }: { children: React.ReactNode }) {
  const { installedAddons, isLoaded: addonsLoaded } = useAddons();
  const { getStorageKey, isLoaded: profilesLoaded } = useProfiles();
  const [preferences, setPreferences] = useState<Record<string, ListPreference>>({});
  const [orders, setOrders] = useState<Record<string, string[]>>({ home: [], browse: [], movies: [], tv: [] });
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load from local storage
  useEffect(() => {
    if (!profilesLoaded) return;

    let isCancelled = false;

    const loadPreferences = async () => {
      try {
        const [stored, storedOrders] = await Promise.all([
          getAppStorageItem(getStorageKey("mediahoard_lists")),
          getAppStorageItem(getStorageKey("mediahoard_list_orders")),
        ]);

        if (isCancelled) return;

        if (stored) {
          const parsed = JSON.parse(stored);
          Object.values(parsed).forEach((item: any) => {
            if (!item.customNames) item.customNames = {};
          });
          setPreferences(parsed);
        }

        if (storedOrders) {
          setOrders(JSON.parse(storedOrders));
        }
      } catch (e) {
        console.error("Failed to load list preferences", e);
      } finally {
        if (!isCancelled) {
          setPrefsLoaded(true);
        }
      }
    };

    void loadPreferences();

    return () => {
      isCancelled = true;
    };
  }, [profilesLoaded, getStorageKey]);

  // Sync available catalogs
  useEffect(() => {
    if (!addonsLoaded || !prefsLoaded) return;

    setPreferences(prev => {
      const newPrefs = { ...prev };
      let updated = false;

      installedAddons.forEach(addon => {
        if (!addon.catalogs) return;
        addon.catalogs.forEach(cat => {
          const uniqueId = `${addon.id}_${cat.type}_${cat.id}`;
          if (!newPrefs[uniqueId]) {
            newPrefs[uniqueId] = {
              id: uniqueId,
              addonId: addon.id,
              catalogId: cat.id,
              catalogType: cat.type,
              originalName: `${addon.name} - ${cat.name || cat.id}`,
              customNames: {},
              pages: {
                home: true,
                browse: true,
                movies: cat.type === "movie",
                tv: cat.type === "series" || cat.type === "tv",
              }
            };
            updated = true;
          }
        });
      });

      if (updated) {
        void setAppStorageItem(getStorageKey("mediahoard_lists"), JSON.stringify(newPrefs));
      }

      return updated ? newPrefs : prev;
    });
  }, [installedAddons, addonsLoaded, prefsLoaded, getStorageKey]);

  const savePreferences = (newPrefs: Record<string, ListPreference>) => {
    setPreferences(newPrefs);
    void setAppStorageItem(getStorageKey("mediahoard_lists"), JSON.stringify(newPrefs));
  };

  const setListOrder = (page: string, newOrder: string[]) => {
    const updatedOrders = { ...orders, [page]: newOrder };
    setOrders(updatedOrders);
    void setAppStorageItem(getStorageKey("mediahoard_list_orders"), JSON.stringify(updatedOrders));
  };

  const getOrderedPreferences = (page: "home" | "browse" | "movies" | "tv") => {
    if (!prefsLoaded || !addonsLoaded) return [];
    const allPrefs = Object.values(preferences);
    const visible = allPrefs.filter(pref => pref.pages?.[page]);
    const pageOrder = orders[page] || [];
    return [...visible].sort((a, b) => {
      const indexA = pageOrder.indexOf(a.id);
      const indexB = pageOrder.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  const getVisibleLists = (page: "home" | "browse" | "movies" | "tv") => {
    const sortedVisible = getOrderedPreferences(page);
    return sortedVisible
      .map(pref => {
        const addon = installedAddons.find(a => a.id === pref.addonId);
        if (!addon) return null;
        return {
          id: pref.id,
          addonName: addon.name,
          manifestUrl: addon.manifestUrl!,
          type: pref.catalogType,
          catalogId: pref.catalogId,
          name: pref.customNames?.[page] || pref.originalName,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
  };

  return (
    <MediaHoardContext.Provider value={{
      preferences,
      savePreferences,
      getVisibleLists,
      getOrderedPreferences,
      setListOrder,
      isLoaded: addonsLoaded && prefsLoaded
    }}>
      {children}
    </MediaHoardContext.Provider>
  );
}

export function useMediaHoard() {
  const context = useContext(MediaHoardContext);
  if (!context) throw new Error("useMediaHoard must be used within MediaHoardProvider");
  return context;
}
