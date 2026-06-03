"use client";

import { useState, useEffect } from "react";
import { useAddons } from "./use-addons";

export interface ListPreference {
  id: string; // unique id combining addon.id and catalog.id
  addonId: string;
  catalogId: string;
  catalogType: string;
  originalName: string;
  customNames: {
    home?: string;
    movies?: string;
    tv?: string;
  };
  pages: {
    home: boolean;
    movies: boolean;
    tv: boolean;
  };
}

export function useListPreferences() {
  const { installedAddons, isLoaded: addonsLoaded } = useAddons();
  const [preferences, setPreferences] = useState<Record<string, ListPreference>>({});
  const [orders, setOrders] = useState<Record<string, string[]>>({ home: [], movies: [], tv: [] });
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("mediahoard_lists");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migration: Ensure customNames exists for legacy items
        Object.values(parsed).forEach((item: any) => {
          if (!item.customNames) {
            item.customNames = {};
          }
        });
        setPreferences(parsed);
      }

      const storedOrders = localStorage.getItem("mediahoard_list_orders");
      if (storedOrders) {
        setOrders(JSON.parse(storedOrders));
      }
    } catch (e) {
      console.error("Failed to load list preferences", e);
    } finally {
      setPrefsLoaded(true);
    }
  }, []);

  // Sync available catalogs from addons into preferences
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
                movies: cat.type === "movie",
                tv: cat.type === "series" || cat.type === "tv",
              }
            };
            updated = true;
          } else if (!newPrefs[uniqueId].customNames) {
            // Migration for existing items
            newPrefs[uniqueId].customNames = {};
            updated = true;
          }
        });
      });

      // Save if updated
      if (updated) {
        localStorage.setItem("mediahoard_lists", JSON.stringify(newPrefs));
      }

      return updated ? newPrefs : prev;
    });
  }, [installedAddons, addonsLoaded, prefsLoaded]);

  // Method to manually save preferences
  const savePreferences = (newPrefs: Record<string, ListPreference>) => {
    setPreferences(newPrefs);
    localStorage.setItem("mediahoard_lists", JSON.stringify(newPrefs));
  };

  const setListOrder = (page: string, newOrder: string[]) => {
    const updatedOrders = { ...orders, [page]: newOrder };
    setOrders(updatedOrders);
    localStorage.setItem("mediahoard_list_orders", JSON.stringify(updatedOrders));
  };

  const getOrderedPreferences = (page: "home" | "movies" | "tv") => {
    if (!prefsLoaded || !addonsLoaded) return [];

    const allPrefs = Object.values(preferences);
    const visible = allPrefs.filter(pref => pref.pages?.[page]);
    
    // Sort based on stored order
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

  const getVisibleLists = (page: "home" | "movies" | "tv") => {
    const sortedVisible = getOrderedPreferences(page);

    return sortedVisible
      .map(pref => {
        // Find the corresponding addon to get the manifestUrl
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

  return {
    preferences,
    savePreferences,
    getVisibleLists,
    getOrderedPreferences,
    setListOrder,
    isLoaded: addonsLoaded && prefsLoaded,
  };
}
