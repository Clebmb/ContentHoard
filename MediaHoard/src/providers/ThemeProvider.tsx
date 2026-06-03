"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useProfiles } from "./ProfileProvider";
import { getAppStorageItem, setAppStorageItem } from "@/lib/app-storage";

export type ThemeSettings = {
  // Colors
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  cardGlowColor: string;
  navBackgroundColor: string;
  navTextColorUnselected: string;
  navTextColorSelected: string;
  headerBackgroundColor: string;
  dropdownBackgroundColor: string;
  dropdownTextColor: string;
  menuBackgroundColor: string;
  menuTextColor: string;
  streamsBackgroundColor: string;
  streamsTextColor: string;
  
  // Transparency & Glass
  isGlassy: boolean;
  isTransparent: boolean;
  glassBlur: number;
  glassOpacity: number;
  isGlowEnabled: boolean;
  glowIntensity: number;
  isSoundEnabled: boolean;
  globalVolume: number;
  metadataLanguage: string;
  preferredQuality: string;
  
  // Branding
  logoUrl: string;
  headerText: string;
  
  // Fonts
  headerFont: string;
  headerTextColor: string;
  navFont: string;
  titleFont: string;
  titleTextColor: string;
  dropdownFont: string;
  menuFont: string;
  streamsFont: string;
};

export type SavedTheme = {
  id: string;
  name: string;
  settings: ThemeSettings;
};

const defaultTheme: ThemeSettings = {
  backgroundColor: "#000000",
  accentColor: "#FFFFFF",
  textColor: "#ffffff",
  cardGlowColor: "rgba(255, 255, 255, 0.15)",
  navBackgroundColor: "rgba(255, 255, 255, 0.1)",
  navTextColorUnselected: "rgba(255, 255, 255, 0.6)",
  navTextColorSelected: "#000000",
  headerBackgroundColor: "#1a1a1a",
  dropdownBackgroundColor: "rgba(26, 26, 26, 0.9)",
  dropdownTextColor: "#ffffff",
  menuBackgroundColor: "rgba(26, 26, 26, 0.95)",
  menuTextColor: "#ffffff",
  streamsBackgroundColor: "rgba(26, 26, 26, 0.6)",
  streamsTextColor: "#ffffff",
  isGlassy: true,
  isTransparent: true,
  glassBlur: 24,
  glassOpacity: 0.1,
  isGlowEnabled: true,
  glowIntensity: 1.0,
  isSoundEnabled: true,
  globalVolume: 0.5,
  metadataLanguage: "English",
  preferredQuality: "1080p",
  logoUrl: "/mediahoard.png",
  headerText: "MediaHoard",
  headerFont: "var(--font-spline-sans)",
  headerTextColor: "#ffffff",
  navFont: "var(--font-spline-sans)",
  titleFont: "var(--font-spline-sans)",
  titleTextColor: "#ffffff",
  dropdownFont: "var(--font-spline-sans)",
  menuFont: "var(--font-spline-sans)",
  streamsFont: "var(--font-spline-sans)",
};

type ThemeContextType = {
  theme: ThemeSettings;
  updateTheme: (updates: Partial<ThemeSettings>) => void;
  resetTheme: () => void;
  savedThemes: SavedTheme[];
  saveTheme: (name: string) => void;
  loadTheme: (theme: ThemeSettings) => void;
  deleteSavedTheme: (id: string) => void;
  overwriteSavedTheme: (id: string, name?: string) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function hexToRgb(hex: string) {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map(x => x + x).join("");
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return isNaN(r) || isNaN(g) || isNaN(b) ? "255, 255, 255" : `${r}, ${g}, ${b}`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { getStorageKey, activeProfile } = useProfiles();
  const [theme, setTheme] = useState<ThemeSettings>(defaultTheme);
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Load global saved themes
  useEffect(() => {
    let isCancelled = false;

    const loadGlobalThemes = async () => {
      const globalSaved = await getAppStorageItem("mediahoard_global_themes");
      if (!isCancelled && globalSaved) {
        setSavedThemes(JSON.parse(globalSaved));
      }
    };

    void loadGlobalThemes();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Load per-profile theme
  useEffect(() => {
    if (!activeProfile) return;
    let isCancelled = false;

    const loadThemeState = async () => {
      const key = getStorageKey("mediahoard-theme");
      const savedTheme = await getAppStorageItem(key);

      if (isCancelled) return;

      if (savedTheme) {
        try {
          // Merge with defaultTheme to prevent errors from missing properties in older saved themes
          setTheme({ ...defaultTheme, ...JSON.parse(savedTheme) });
        } catch (e) {
          console.error("Failed to load theme", e);
        }
      } else {
        setTheme(defaultTheme);
      }

      setIsMounted(true);
    };

    void loadThemeState();

    return () => {
      isCancelled = true;
    };
  }, [activeProfile, getStorageKey]);

  // Save per-profile theme
  useEffect(() => {
    if (!isMounted || !activeProfile) return;
    const key = getStorageKey("mediahoard-theme");
    void setAppStorageItem(key, JSON.stringify(theme));
    applyTheme(theme);
    if (window.mediahoardElectron?.contentHoard?.enabled) {
      void window.mediahoardElectron.contentHoard.readSharedState().then((shared) => {
        const sharedRecord = shared && typeof shared === "object" ? shared as Record<string, unknown> : {};
        return window.mediahoardElectron?.contentHoard?.writeSharedState({
          ...sharedRecord,
          theme: {
            ...(sharedRecord.theme && typeof sharedRecord.theme === "object"
              ? (sharedRecord.theme as Record<string, unknown>)
              : {}),
            backgroundColor: theme.backgroundColor,
            surfaceColor: theme.headerBackgroundColor,
            elevatedColor: theme.menuBackgroundColor,
            accentColor: theme.accentColor,
            textColor: theme.textColor,
            secondaryTextColor: theme.navTextColorUnselected,
            navBackgroundColor: theme.navBackgroundColor,
            glassBlur: theme.glassBlur,
            glassOpacity: theme.glassOpacity,
            isGlassy: theme.isGlassy,
            isTransparent: theme.isTransparent,
            headerFont: theme.headerFont,
            headerText: theme.headerText,
            logoUrl: theme.logoUrl,
            mediahoardHeaderText: theme.headerText,
            mediahoardLogoUrl: theme.logoUrl,
          },
        });
      }).catch(() => undefined);
    }
  }, [theme, isMounted, activeProfile, getStorageKey]);

  // Listen for shared state updates from ContentHoard
  useEffect(() => {
    if (!window.mediahoardElectron?.contentHoard?.enabled) return;
    const unsub = window.mediahoardElectron.onSharedStateUpdated?.((shared: unknown) => {
      const s = shared as Record<string, unknown>;
      if (s.theme && typeof s.theme === "object") {
        const t = s.theme as Record<string, unknown>;
        const promoted = {
          ...t,
          headerText: (t.mediahoardHeaderText as string) || (t.headerText as string) || "MediaHoard",
          logoUrl: (t.mediahoardLogoUrl as string) || (t.logoUrl as string) || "",
        } as Partial<ThemeSettings>;
        // Sync runtime values into the renderer-side copy so components
        // reading contentHoard.theme get the latest state.
        const chTheme = window.mediahoardElectron?.contentHoard?.theme;
        if (chTheme && typeof chTheme === "object") {
          Object.assign(chTheme, t);
          const chThemeRecord = chTheme as Record<string, string>;
          if (t.mediahoardHeaderText) chThemeRecord.headerText = t.mediahoardHeaderText as string;
          if (t.mediahoardLogoUrl) chThemeRecord.logoUrl = t.mediahoardLogoUrl as string;
        }
        setTheme((prev) => ({ ...prev, ...promoted }));
        applyTheme({ ...defaultTheme, ...promoted } as ThemeSettings);
        if (s.savedThemes && Array.isArray(s.savedThemes)) {
          setSavedThemes(s.savedThemes as SavedTheme[]);
          void setAppStorageItem("mediahoard_global_themes", JSON.stringify(s.savedThemes));
        }
      }
      // Profile sync from ContentHoard is intentionally only at launch time
      // (via env vars), not during runtime. Child apps manage profiles
      // independently once launched. Theme and savedThemes still sync live.
      if (s.profiles && Array.isArray(s.profiles) && s.activeProfileId) {
        // Only cache profile data for reference — don't force a reload.
        const newActiveId = String(s.activeProfileId);
        try {
          localStorage.setItem("mediahoard-contenthoard-cached-profiles", JSON.stringify(s.profiles));
          localStorage.setItem("mediahoard-contenthoard-cached-activeProfileId", newActiveId);
        } catch { /* ignore */ }
      }
    });
    return () => { unsub?.(); };
  }, []);

  const applyTheme = (t: ThemeSettings) => {
    const root = document.documentElement;
    
    // Colors
    root.style.setProperty("--theme-background", t.backgroundColor);
    root.style.setProperty("--theme-accent", t.accentColor);
    root.style.setProperty("--theme-text", t.textColor);
    root.style.setProperty("--theme-card-glow", t.cardGlowColor);
    root.style.setProperty("--theme-nav-bg", t.navBackgroundColor);
    root.style.setProperty("--theme-nav-bg-rgb", t.navBackgroundColor.startsWith("rgba") ? "255,255,255" : hexToRgb(t.navBackgroundColor));
    root.style.setProperty("--theme-nav-text-unselected", t.navTextColorUnselected);
    root.style.setProperty("--theme-nav-text-selected", t.navTextColorSelected);
    root.style.setProperty("--theme-header-bg", t.headerBackgroundColor);
    root.style.setProperty("--theme-header-bg-rgb", hexToRgb(t.headerBackgroundColor));
    root.style.setProperty("--theme-dropdown-bg", t.dropdownBackgroundColor);
    root.style.setProperty("--theme-dropdown-text", t.dropdownTextColor);
    root.style.setProperty("--theme-menu-bg", t.menuBackgroundColor);
    root.style.setProperty("--theme-menu-text", t.menuTextColor);
    root.style.setProperty("--theme-streams-bg", t.streamsBackgroundColor);
    root.style.setProperty("--theme-streams-text", t.streamsTextColor);
    
    // Effects
    root.style.setProperty("--theme-glass-blur", t.isGlassy ? `${t.glassBlur}px` : "0px");
    root.style.setProperty("--theme-glass-opacity", t.isTransparent ? `${t.glassOpacity}` : "1");
    root.style.setProperty("--theme-glow-intensity", t.isGlowEnabled ? `${t.glowIntensity}` : "0");
    
    // Fonts
    root.style.setProperty("--theme-font-header", t.headerFont);
    root.style.setProperty("--theme-text-header", t.headerTextColor);
    root.style.setProperty("--theme-font-nav", t.navFont);
    root.style.setProperty("--theme-font-title", t.titleFont);
    root.style.setProperty("--theme-text-title", t.titleTextColor);
    root.style.setProperty("--theme-font-dropdown", t.dropdownFont);
    root.style.setProperty("--theme-font-menu", t.menuFont);
    root.style.setProperty("--theme-font-streams", t.streamsFont);
  };

  const updateTheme = (updates: Partial<ThemeSettings>) => {
    setTheme((prev) => ({ ...prev, ...updates }));
  };

  const resetTheme = () => {
    setTheme(defaultTheme);
  };

  const saveTheme = (name: string) => {
    const newSaved: SavedTheme = {
      id: crypto.randomUUID(),
      name,
      settings: { ...theme }
    };
    const updated = [...savedThemes, newSaved];
    setSavedThemes(updated);
    void setAppStorageItem("mediahoard_global_themes", JSON.stringify(updated));
  };

  const loadTheme = (settings: ThemeSettings) => {
    // Merge with defaultTheme for safety
    setTheme({ ...defaultTheme, ...settings });
  };

  const deleteSavedTheme = (id: string) => {
    const updated = savedThemes.filter(t => t.id !== id);
    setSavedThemes(updated);
    void setAppStorageItem("mediahoard_global_themes", JSON.stringify(updated));
  };

  const overwriteSavedTheme = (id: string, name?: string) => {
    const updated = savedThemes.map(t => 
      t.id === id ? { ...t, name: name || t.name, settings: { ...theme } } : t
    );
    setSavedThemes(updated);
    void setAppStorageItem("mediahoard_global_themes", JSON.stringify(updated));
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      updateTheme, 
      resetTheme, 
      savedThemes, 
      saveTheme, 
      loadTheme,
      deleteSavedTheme,
      overwriteSavedTheme
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
