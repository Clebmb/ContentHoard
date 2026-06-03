"use client";

import { useState, useEffect } from "react";
import { Addon, AddonCatalog } from "@/components/addons/addon-card";
import { useProfiles } from "@/providers/ProfileProvider";
import { getAppStorageItem, setAppStorageItem } from "@/lib/app-storage";

interface AddonManifest {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  author?: string;
  logo?: string;
  icon?: string;
  catalogs?: AddonCatalog[];
  resources?: Array<string | { name: string; types?: string[]; idPrefixes?: string[] }>;
  types?: string[];
  idPrefixes?: string[];
}

const normalizeAddonUrl = (url: string) => {
  let formattedUrl = url.trim();

  if (formattedUrl.startsWith("stremio://")) {
    formattedUrl = formattedUrl.replace("stremio://", "https://");
  }

  if (formattedUrl.startsWith("nuvio://")) {
    formattedUrl = formattedUrl.replace("nuvio://", "https://");
  }

  if (!formattedUrl.endsWith("/manifest.json") && !formattedUrl.endsWith("manifest.json")) {
    formattedUrl = formattedUrl.replace(/\/$/, "") + "/manifest.json";
  }

  return formattedUrl;
};

const inferAddonType = (originalUrl: string, formattedUrl: string, manifest: AddonManifest): Addon["type"] => {
  const source = `${originalUrl} ${formattedUrl} ${manifest.id || ""} ${manifest.name || ""}`.toLowerCase();
  return source.includes("nuvio") ? "nuvio" : "stremio";
};

export function useAddons() {
  const [installedAddons, setInstalledAddons] = useState<Addon[]>([]);
  const { getStorageKey, isLoaded: profilesLoaded } = useProfiles();
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (!profilesLoaded) return;

    let isCancelled = false;

    const loadInstalledAddons = async () => {
      try {
        const stored = await getAppStorageItem(getStorageKey("mediahoard_addons"));
        const parsedAddons = stored ? JSON.parse(stored) : [];
        await Promise.resolve();

        if (!isCancelled) {
          setInstalledAddons(parsedAddons);
        }
      } catch (e) {
        console.error("Failed to load addons from local storage", e);
      } finally {
        if (!isCancelled) {
          setIsLoaded(true);
        }
      }
    };

    void loadInstalledAddons();

    return () => {
      isCancelled = true;
    };
  }, [profilesLoaded, getStorageKey]);

  // Save to localStorage whenever installedAddons changes
  useEffect(() => {
    if (isLoaded && profilesLoaded) {
      void setAppStorageItem(getStorageKey("mediahoard_addons"), JSON.stringify(installedAddons));
    }
  }, [installedAddons, isLoaded, profilesLoaded, getStorageKey]);

  const installAddon = async (url: string) => {
    const formattedUrl = normalizeAddonUrl(url);

    try {
      const res = await fetch(`/api/addon/manifest?url=${encodeURIComponent(formattedUrl)}`);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch manifest");
      }

      const manifest = await res.json() as AddonManifest;

      if (!manifest.id || !manifest.name || !manifest.version) {
        throw new Error("Invalid Stremio/Nuvio-compatible manifest format");
      }

      // Convert Stremio manifest to our Addon format
      const newAddon: Addon = {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description || "No description provided.",
        version: manifest.version,
        author: manifest.author || "Unknown",
        icon: manifest.logo || manifest.icon || undefined,
        isInstalled: true,
        type: inferAddonType(url, formattedUrl, manifest),
        manifestUrl: formattedUrl,
        catalogs: manifest.catalogs || [],
        resources: manifest.resources || [],
        types: manifest.types || [],
        idPrefixes: manifest.idPrefixes || [],
      };

      setInstalledAddons((prev) => {
        const existingIndex = prev.findIndex((a) => a.id === newAddon.id);
        if (existingIndex >= 0) {
          // Update the existing addon to get any new fields (like catalogs)
          const updated = [...prev];
          updated[existingIndex] = newAddon;
          return updated;
        }
        return [...prev, newAddon];
      });

      return { success: true, addon: newAddon };
    } catch (error: unknown) {
      console.error("Install addon error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to install addon" };
    }
  };

  const uninstallAddon = (id: string) => {
    setInstalledAddons((prev) => prev.filter((a) => a.id !== id));
  };

  return {
    installedAddons,
    isLoaded,
    installAddon,
    uninstallAddon,
    setAddons: setInstalledAddons,
  };
}
