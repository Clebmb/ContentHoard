"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAppStorageItem, removeAppStorageItem, setAppStorageItem } from "@/lib/app-storage";

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

    return newProfile;
  };

  const switchProfile = (id: string) => {
    setActiveProfileId(id);
    void setAppStorageItem("mediahoard_active_profile_id", id);
    // Reload to reset all providers and hooks with new storage keys
    window.location.reload();
  };

  const deleteProfile = (id: string) => {
    const updated = profiles.filter((p) => p.id !== id);
    setProfiles(updated);
    void setAppStorageItem("mediahoard_profiles_list", JSON.stringify(updated));

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
  };

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || null;

  // Profile sync from ContentHoard is intentionally only at launch time
  // (via env vars), not during runtime. Child apps manage profiles
  // independently once launched.

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
