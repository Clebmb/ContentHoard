"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getAppStorageItem, removeAppStorageItem, setAppStorageItem } from "@/lib/app-storage";

const CONTENTHOARD_TRACKED_IDS_KEY = "mediahoard-contenthoard-profile-ids";
const CONTENTHOARD_CACHED_ACTIVE_KEY = "mediahoard-contenthoard-cached-activeProfileId";

export interface Profile {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  createdAt: number;
}

interface ProfileContextType {
  profiles: Profile[];
  activeProfile: Profile | null;
  isLoaded: boolean;
  createProfile: (name: string, icon?: string, color?: string) => Profile;
  switchProfile: (id: string) => void;
  deleteProfile: (id: string) => void;
  updateProfile: (id: string, updates: Partial<Profile>) => void;
  getStorageKey: (key: string) => string;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const profilesRef = useRef<Profile[]>([]);
  const activeProfileIdRef = useRef<string | null>(null);
  const isLoadedRef = useRef(false);
  useEffect(() => { profilesRef.current = profiles; }, [profiles]);
  useEffect(() => { activeProfileIdRef.current = activeProfileId; }, [activeProfileId]);
  useEffect(() => { isLoadedRef.current = isLoaded; }, [isLoaded]);

  useEffect(() => {
    let isCancelled = false;

    const loadProfiles = async () => {
      const [savedProfiles, savedActiveId] = await Promise.all([
        getAppStorageItem("mediahoard_profiles_list"),
        getAppStorageItem("mediahoard_active_profile_id"),
      ]);

      if (isCancelled) return;

      if (savedProfiles) {
        setProfiles(JSON.parse(savedProfiles));
      }

      if (savedActiveId) {
        setActiveProfileId(savedActiveId);
      }

      setIsLoaded(true);
    };

    void loadProfiles();

    return () => {
      isCancelled = true;
    };
  }, []);

  const getStorageKey = useCallback((key: string) => {
    if (!activeProfileId) return key;
    return `p_${activeProfileId}_${key}`;
  }, [activeProfileId]);

  // Publish MediaHoard's profile list to ContentHoard's shared state.
  // ContentHoard stays the owner of profiles it created; profiles created
  // or deleted here are adopted/removed there via its child-sync ingest.
  const publishProfilesToContentHoard = useCallback(
    (list: Profile[], activeId: string | null, deletedProfileIds: string[] = []) => {
      const bridge = window.mediahoardElectron?.contentHoard;
      if (!bridge?.enabled || typeof bridge.writeSharedState !== "function") return;
      void (async () => {
        try {
          const shared = (await bridge.readSharedState?.()) ?? {};
          await bridge.writeSharedState({
            ...shared,
            profiles: list.map((profile) => ({
              id: String(profile.id),
              name: String(profile.name || "Profile"),
              icon: String(profile.icon || "person"),
              color: String(profile.color || "#39E079"),
              createdAt: Number(profile.createdAt || Date.now()),
            })),
            activeProfileId: activeId ? String(activeId) : undefined,
            deletedProfileIds,
            lastStateUpdateSource: "child",
          });
        } catch (error) {
          console.warn("[MediaHoard] ContentHoard profile sync failed:", error);
        }
      })();
    },
    []
  );

  const createProfile = (name: string, icon?: string, color?: string) => {
    const newProfile: Profile = {
      id: crypto.randomUUID(),
      name,
      icon,
      color: color || "#39E079",
      createdAt: Date.now(),
    };

    const updated = [...profiles, newProfile];
    setProfiles(updated);
    void setAppStorageItem("mediahoard_profiles_list", JSON.stringify(updated));

    if (!activeProfileId) {
      setActiveProfileId(newProfile.id);
      void setAppStorageItem("mediahoard_active_profile_id", newProfile.id);
    }

    publishProfilesToContentHoard(updated, activeProfileId ?? newProfile.id);
    return newProfile;
  };

  const switchProfile = (id: string) => {
    setActiveProfileId(id);
    void setAppStorageItem("mediahoard_active_profile_id", id);
    publishProfilesToContentHoard(profilesRef.current, id);
    // Reload to reset all providers and hooks with new storage keys
    window.location.reload();
  };

  const deleteProfile = (id: string) => {
    const updated = profiles.filter((p) => p.id !== id);
    if (updated.length === profiles.length) return; // nothing deleted
    setProfiles(updated);
    void setAppStorageItem("mediahoard_profiles_list", JSON.stringify(updated));
    publishProfilesToContentHoard(
      updated,
      activeProfileId === id ? updated[0]?.id ?? null : activeProfileId,
      [id]
    );

    if (activeProfileId === id) {
      const nextActive = updated.length > 0 ? updated[0].id : null;
      setActiveProfileId(nextActive);
      if (nextActive) {
        void setAppStorageItem("mediahoard_active_profile_id", nextActive);
      } else {
        void removeAppStorageItem("mediahoard_active_profile_id");
      }
      window.location.reload();
    }
  };

  const updateProfile = (id: string, updates: Partial<Profile>) => {
    const updated = profiles.map((p) => (p.id === id ? { ...p, ...updates } : p));
    setProfiles(updated);
    void setAppStorageItem("mediahoard_profiles_list", JSON.stringify(updated));
    publishProfilesToContentHoard(updated, activeProfileId);
  };

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || null;

  // Live profile sync with ContentHoard: new/edited/deleted ContentHoard
  // profiles are mirrored here, and profile switches in ContentHoard are
  // followed. Locally-created (non-ContentHoard) profiles stay independent.
  useEffect(() => {
    const bridge = window.mediahoardElectron?.contentHoard;
    if (!bridge?.enabled) return;

    let isCancelled = false;

    const readTrackedIds = (): string[] => {
      try {
        const parsed = JSON.parse(localStorage.getItem(CONTENTHOARD_TRACKED_IDS_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    };

    const applySharedProfiles = (shared: Record<string, unknown>) => {
      if (!isLoadedRef.current || isCancelled) return;
      const sharedProfiles = Array.isArray(shared.profiles) ? (shared.profiles as Profile[]) : [];
      if (!sharedProfiles.length) return;
      const sharedActiveId = shared.activeProfileId ? String(shared.activeProfileId) : "";
      const previousActiveId = localStorage.getItem(CONTENTHOARD_CACHED_ACTIVE_KEY) || "";
      if (sharedActiveId) localStorage.setItem(CONTENTHOARD_CACHED_ACTIVE_KEY, sharedActiveId);

      const chIds = new Set(sharedProfiles.map((p) => String(p.id)));
      let tracked = readTrackedIds();
      let next = [...profilesRef.current];
      let mutated = false;

      // Deletion sync: drop tracked profiles that no longer exist in ContentHoard.
      const removed = tracked.filter((id) => !chIds.has(id));
      if (removed.length) {
        next = next.filter((p) => !removed.includes(p.id));
        tracked = tracked.filter((id) => chIds.has(id));
        mutated = true;
      }

      // Upsert: mirror the full ContentHoard profile list so profiles created
      // in any Hoard app (via ContentHoard) reach this one too.
      for (const sharedProfile of sharedProfiles) {
        const id = String(sharedProfile.id);
        if (!id) continue;
        const index = next.findIndex((p) => p.id === id);
        if (index >= 0) {
          const local = next[index];
          if (local.name !== sharedProfile.name || local.icon !== sharedProfile.icon || local.color !== sharedProfile.color) {
            next[index] = { ...local, name: sharedProfile.name, icon: sharedProfile.icon, color: sharedProfile.color };
            mutated = true;
          }
        } else {
          next.push({
            id,
            name: String(sharedProfile.name || "ContentHoard"),
            icon: sharedProfile.icon,
            color: sharedProfile.color,
            createdAt: Number(sharedProfile.createdAt || Date.now()),
          });
          mutated = true;
        }
        if (!tracked.includes(id)) tracked = [...tracked, id];
      }
      if (tracked.length) localStorage.setItem(CONTENTHOARD_TRACKED_IDS_KEY, JSON.stringify(tracked));

      if (mutated) {
        setProfiles(next);
        void setAppStorageItem("mediahoard_profiles_list", JSON.stringify(next));
        if (!next.some((p) => p.id === activeProfileIdRef.current) && next.length) {
          // The active profile was deleted in ContentHoard — fall back to the first.
          const nextActive = next[0].id;
          setActiveProfileId(nextActive);
          void setAppStorageItem("mediahoard_active_profile_id", nextActive);
          window.location.reload();
          return;
        }
      }

      // Follow ContentHoard's active profile when it changes. Skip the very
      // first event so first contact never hijacks the locally active profile.
      if (sharedActiveId && previousActiveId && sharedActiveId !== previousActiveId) {
        const known = next.some((p) => p.id === sharedActiveId);
        if (known && activeProfileIdRef.current !== sharedActiveId) {
          switchProfile(sharedActiveId);
        }
      }
    };

    const unsubscribe = window.mediahoardElectron?.onSharedStateUpdated?.((shared: unknown) => {
      if (shared && typeof shared === "object") applySharedProfiles(shared as Record<string, unknown>);
    });

    void bridge.readSharedState?.().then((shared) => {
      if (!shared || typeof shared !== "object" || isCancelled) return;
      // The initial read may resolve before local profiles finish loading.
      let attempts = 0;
      const applyWhenLoaded = () => {
        if (isCancelled) return;
        if (isLoadedRef.current || attempts++ > 20) {
          applySharedProfiles(shared as Record<string, unknown>);
          return;
        }
        setTimeout(applyWhenLoaded, 250);
      };
      applyWhenLoaded();
    }).catch(() => undefined);

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfile,
        isLoaded,
        createProfile,
        switchProfile,
        deleteProfile,
        updateProfile,
        getStorageKey,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfiles must be used within ProfileProvider");
  return context;
}
