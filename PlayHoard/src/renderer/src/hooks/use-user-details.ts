import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "./redux";
import {
  setProfileBackground,
  setUserDetails,
  setFriendRequests,
  clearCollections,
  setLibrary,
} from "@renderer/features";
import {
  PLAYHOARD_PROFILE_SWITCHED_EVENT,
  resolveImageUrl,
} from "@renderer/helpers";
import { levelDBService } from "@renderer/services/leveldb.service";
import type {
  UpdateProfileRequest,
  UserDetails,
} from "@types";

const LOCAL_PROFILE_STORAGE_KEY = "playhoardProfile";
const LOCAL_PROFILES_STORAGE_KEY = "playhoardProfiles";
const LOCAL_ACTIVE_PROFILE_ID_KEY = "playhoardActiveProfileId";
const LOCAL_PROFILE_LIBRARY_PREFIX = "playhoardProfileLibrary:";

export const MEDIAHOARD_PROFILE_COLORS = [
  "#39E079",
  "#E03939",
  "#397EE0",
  "#E0A339",
  "#9C39E0",
  "#39E0DC",
  "#FFFFFF",
];

export const MEDIAHOARD_PROFILE_ICONS = [
  "face",
  "face_6",
  "face_5",
  "face_3",
  "face_4",
  "face_2",
  "child_care",
  "comedy_mask",
  "family_restroom",
  "groups",
  "person",
  "pets",
  "emoticon",
  "rocket_launch",
  "celebration",
];

const createLocalProfile = (): UserDetails => ({
  id: globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}`,
  username: "player",
  email: null,
  displayName: "Player",
  profileImageUrl: null,
  backgroundImageUrl: null,
  profileColor: "#39E079",
  profileIcon: "person",
  profileVisibility: "PUBLIC",
  bio: "",
  workwondersJwt: "",
  subscription: null,
  karma: 0,
  quirks: {
    backupsPerGameLimit: 0,
  },
});

const CONTENTHOARD_PROFILE_IDS_KEY = "playhoard-contenthoard-profile-ids";

const getContentHoardProfile = (): UserDetails | null => {
  const contentHoard = (globalThis.window as unknown as {
    electron?: {
      contentHoard?: {
        enabled?: boolean;
        profile?: {
          id?: string;
          name?: string;
          icon?: string;
          color?: string;
          createdAt?: number;
        } | null;
      };
    };
  }).electron?.contentHoard;

  if (!contentHoard?.enabled) return null;

  const cachedProfiles = globalThis.window.localStorage.getItem("playhoard-contenthoard-cached-profiles");
  const cachedActiveId = globalThis.window.localStorage.getItem("playhoard-contenthoard-cached-activeProfileId");    if (cachedProfiles && cachedActiveId) {
    try {
      const parsed = JSON.parse(cachedProfiles) as Array<{ id: string; name?: string; icon?: string; color?: string }>;
      const active = parsed.find((p) => String(p.id) === cachedActiveId) || parsed[0];
      if (active) {
        const dn = String(active.name || "ContentHoard");
        return {
          id: String(active.id),
          username: getUsernameFromDisplayName(dn),
          email: null,
          displayName: dn,
          profileImageUrl: null,
          backgroundImageUrl: null,
          profileColor: String(active.color || "#FFFFFF"),
          profileIcon: String(active.icon || "person"),
          profileVisibility: "PUBLIC",
          bio: "",
          workwondersJwt: "",
          subscription: null,
          karma: 0,
          quirks: { backupsPerGameLimit: 0 },
        } as UserDetails;
      }
    } catch { /* fall through */ }
  }

  if (!contentHoard.profile) return null;

  const profile = contentHoard.profile;
  const displayName = String(profile.name || "ContentHoard");
  return {
    id: String(profile.id || "contenthoard"),
    username: getUsernameFromDisplayName(displayName),
    email: null,
    displayName,
    profileImageUrl: null,
    backgroundImageUrl: null,
    profileColor: String(profile.color || "#FFFFFF"),
    profileIcon: String(profile.icon || "person"),
    profileVisibility: "PUBLIC",
    bio: "",
    workwondersJwt: "",
    subscription: null,
    karma: 0,
    quirks: {
      backupsPerGameLimit: 0,
    },
  } as UserDetails;
};

const normalizeLocalImageUrl = (url?: string | null): string | null => {
  return resolveImageUrl(url);
};

const normalizeLocalProfile = (profile: UserDetails): UserDetails => ({
  ...profile,
  profileImageUrl: normalizeLocalImageUrl(profile.profileImageUrl),
  backgroundImageUrl: normalizeLocalImageUrl(profile.backgroundImageUrl),
  profileColor: profile.profileColor || "#FFFFFF",
  profileIcon: profile.profileIcon || "person",
});

const getUsernameFromDisplayName = (displayName?: string) => {
  const username = displayName
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return username || "player";
};

const persistProfiles = (profiles: UserDetails[]) => {
  globalThis.window.localStorage.setItem(
    LOCAL_PROFILES_STORAGE_KEY,
    JSON.stringify(profiles.map(normalizeLocalProfile))
  );
};

const getStoredLocalProfiles = (): UserDetails[] => {
  const contentHoardProfile = getContentHoardProfile();
  const storedProfiles = globalThis.window.localStorage.getItem(
    LOCAL_PROFILES_STORAGE_KEY
  );

  if (storedProfiles) {
    try {
      const profiles = JSON.parse(storedProfiles).map(normalizeLocalProfile);
      if (profiles.length) {
        const mergedProfiles = contentHoardProfile && !profiles.some((profile) => profile.id === contentHoardProfile.id)
          ? [contentHoardProfile, ...profiles]
          : profiles;
        persistProfiles(mergedProfiles);
        // Ensure ContentHoard profile IDs are tracked even for existing users
        if (contentHoardProfile) {
          const existing = globalThis.window.localStorage.getItem(CONTENTHOARD_PROFILE_IDS_KEY);
          if (!existing) {
            globalThis.window.localStorage.setItem(CONTENTHOARD_PROFILE_IDS_KEY, JSON.stringify([contentHoardProfile.id]));
          }
        }
        return mergedProfiles;
      }
    } catch {
      /* Fall through to legacy migration or profile creation. */
    }
  }

  const legacyProfile = globalThis.window.localStorage.getItem(
    LOCAL_PROFILE_STORAGE_KEY
  );

  if (legacyProfile) {
    try {
      const profile = normalizeLocalProfile(JSON.parse(legacyProfile));
      persistProfiles([profile]);
      globalThis.window.localStorage.setItem(
        LOCAL_ACTIVE_PROFILE_ID_KEY,
        profile.id
      );
      return [profile];
    } catch {
      /* Fall through to profile creation. */
    }
  }

  const profile = contentHoardProfile ?? createLocalProfile();
  persistProfiles([profile]);
  globalThis.window.localStorage.setItem(LOCAL_ACTIVE_PROFILE_ID_KEY, profile.id);
  // Track ContentHoard profile IDs for deletion sync
  if (contentHoardProfile) {
    globalThis.window.localStorage.setItem(CONTENTHOARD_PROFILE_IDS_KEY, JSON.stringify([contentHoardProfile.id]));
  }
  return [profile];
};

const syncContentHoardProfiles = async (_profiles: UserDetails[], _activeProfile: UserDetails) => {
  // Child apps manage profiles independently once launched.
  // Profile changes in this app should NOT affect ContentHoard.
  return;
};

const getActiveProfileId = () =>
  globalThis.window.localStorage.getItem(LOCAL_ACTIVE_PROFILE_ID_KEY);

const setStoredActiveProfile = (profile: UserDetails) => {
  globalThis.window.localStorage.setItem(LOCAL_ACTIVE_PROFILE_ID_KEY, profile.id);
  globalThis.window.localStorage.setItem(
    LOCAL_PROFILE_STORAGE_KEY,
    JSON.stringify(profile)
  );
  globalThis.window.localStorage.setItem("userDetails", JSON.stringify(profile));
  window["userDetails"] = profile;
};

const getStoredLocalProfile = (): UserDetails => {
  const profiles = getStoredLocalProfiles();
  const activeProfile =
    profiles.find((profile) => profile.id === getActiveProfileId()) ??
    profiles[0];

  setStoredActiveProfile(activeProfile);
  return activeProfile;
};

const getProfileLibraryStorageKey = (profileId: string) =>
  `${LOCAL_PROFILE_LIBRARY_PREFIX}${profileId}`;

const saveCurrentProfileLibrary = async (profileId: string) => {
  const games = await levelDBService.iterator("games").catch(() => []);
  globalThis.window.localStorage.setItem(
    getProfileLibraryStorageKey(profileId),
    JSON.stringify(games)
  );
};

const restoreProfileLibrary = async (profileId: string) => {
  const storedGames = globalThis.window.localStorage.getItem(
    getProfileLibraryStorageKey(profileId)
  );
  const games = storedGames ? (JSON.parse(storedGames) as [string, unknown][]) : [];

  await levelDBService.clear("games").catch(() => undefined);
  await Promise.all(
    games.map(([key, value]) => levelDBService.put(key, value, "games"))
  );
};

export function useUserDetails() {
  const dispatch = useAppDispatch();

  const { userDetails, profileBackground } = useAppSelector(
    (state) => state.userDetails
  );

  const clearUserDetails = useCallback(async () => {
    dispatch(setUserDetails(null));
    dispatch(setProfileBackground(null));
    dispatch(clearCollections());

    globalThis.window.localStorage.removeItem("userDetails");
  }, [dispatch]);

  const updateUserDetails = useCallback(
    async (userDetails: UserDetails) => {
      const normalizedProfile = normalizeLocalProfile(userDetails);
      const profiles = getStoredLocalProfiles();
      const updatedProfiles = profiles.some(
        (profile) => profile.id === normalizedProfile.id
      )
        ? profiles.map((profile) =>
            profile.id === normalizedProfile.id ? normalizedProfile : profile
          )
        : [...profiles, normalizedProfile];

      persistProfiles(updatedProfiles);
      setStoredActiveProfile(normalizedProfile);
      void syncContentHoardProfiles(updatedProfiles, normalizedProfile);
      dispatch(setUserDetails(normalizedProfile));
    },
    [dispatch]
  );

  const createProfile = useCallback(
    async (values?: Partial<UpdateProfileRequest>) => {
      if (userDetails) await saveCurrentProfileLibrary(userDetails.id);

      const profile = normalizeLocalProfile({
        ...createLocalProfile(),
        ...values,
        displayName: values?.displayName?.trim() || "New Profile",
        username: getUsernameFromDisplayName(values?.displayName),
      });

      const profiles = [...getStoredLocalProfiles(), profile];
      persistProfiles(profiles);
      setStoredActiveProfile(profile);
      void syncContentHoardProfiles(profiles, profile);
      await restoreProfileLibrary(profile.id);
      dispatch(setLibrary([]));
      dispatch(setUserDetails(profile));
      window.dispatchEvent(new Event(PLAYHOARD_PROFILE_SWITCHED_EVENT));
      return profile;
    },
    [dispatch, userDetails]
  );

  const updateProfile = useCallback(
    async (profileId: string, values: Partial<UpdateProfileRequest>) => {
      const profiles = getStoredLocalProfiles();
      const currentProfile = profiles.find((profile) => profile.id === profileId);
      if (!currentProfile) return null;

      const updatedProfile = normalizeLocalProfile({
        ...currentProfile,
        ...values,
        profileImageUrl:
          values.profileImageUrl === undefined
            ? currentProfile.profileImageUrl
            : normalizeLocalImageUrl(values.profileImageUrl),
        backgroundImageUrl:
          values.backgroundImageUrl === undefined
            ? currentProfile.backgroundImageUrl
            : normalizeLocalImageUrl(values.backgroundImageUrl),
        username: values.displayName
          ? getUsernameFromDisplayName(values.displayName)
          : currentProfile.username || "player",
        subscription: currentProfile.subscription || null,
        workwondersJwt: currentProfile.workwondersJwt || "",
        karma: currentProfile.karma || 0,
      });
      const updatedProfiles = profiles.map((profile) =>
        profile.id === profileId ? updatedProfile : profile
      );
      const activeProfile =
        updatedProfiles.find((profile) => profile.id === getActiveProfileId()) ??
        updatedProfile;

      persistProfiles(updatedProfiles);
      void syncContentHoardProfiles(updatedProfiles, activeProfile);
      if (userDetails?.id === profileId) {
        setStoredActiveProfile(updatedProfile);
        dispatch(setUserDetails(updatedProfile));
      }

      return updatedProfile;
    },
    [dispatch, userDetails?.id]
  );

  const switchProfile = useCallback(
    async (profileId: string) => {
      if (userDetails?.id === profileId) return userDetails;
      if (userDetails) await saveCurrentProfileLibrary(userDetails.id);

      const profile = getStoredLocalProfiles().find(
        (profile) => profile.id === profileId
      );

      if (!profile) return null;

      setStoredActiveProfile(profile);
      void syncContentHoardProfiles(getStoredLocalProfiles(), profile);
      await restoreProfileLibrary(profile.id);
      const library = await window.electron.getLibrary().catch(() => []);
      dispatch(setLibrary(library));
      dispatch(setUserDetails(profile));
      window.dispatchEvent(new Event(PLAYHOARD_PROFILE_SWITCHED_EVENT));
      return profile;
    },
    [dispatch, userDetails]
  );

  const deleteProfile = useCallback(
    async (profileId: string) => {
      const profiles = getStoredLocalProfiles();
      if (profiles.length <= 1) return null;

      const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
      persistProfiles(nextProfiles);
      void syncContentHoardProfiles(
        nextProfiles,
        nextProfiles.find((profile) => profile.id === getActiveProfileId()) ?? nextProfiles[0]
      );
      globalThis.window.localStorage.removeItem(
        getProfileLibraryStorageKey(profileId)
      );

      if (userDetails?.id === profileId) {
        const nextProfile = nextProfiles[0];
        setStoredActiveProfile(nextProfile);
        await restoreProfileLibrary(nextProfile.id);
        const library = await window.electron.getLibrary().catch(() => []);
        dispatch(setLibrary(library));
        dispatch(setUserDetails(nextProfile));
        window.dispatchEvent(new Event(PLAYHOARD_PROFILE_SWITCHED_EVENT));
        return nextProfile;
      }

      return userDetails ?? getStoredLocalProfile();
    },
    [dispatch, userDetails]
  );

  const signOut = useCallback(async () => createProfile(), [createProfile]);

  const fetchUserDetails = useCallback(async () => {
    const userDetails = getStoredLocalProfile();
    dispatch(setUserDetails(userDetails));
    globalThis.window.localStorage.setItem(
      "userDetails",
      JSON.stringify(userDetails)
    );
    setStoredActiveProfile(userDetails);

    return userDetails;
  }, [dispatch]);

  const patchUser = useCallback(
    async (values: UpdateProfileRequest) => {
      const currentProfile = userDetails ?? getStoredLocalProfile();
      return updateUserDetails({
        ...currentProfile,
        ...values,
        profileImageUrl:
          values.profileImageUrl === undefined
            ? currentProfile.profileImageUrl
            : normalizeLocalImageUrl(values.profileImageUrl),
        backgroundImageUrl:
          values.backgroundImageUrl === undefined
            ? currentProfile.backgroundImageUrl
            : normalizeLocalImageUrl(values.backgroundImageUrl),
        username: values.displayName
          ? getUsernameFromDisplayName(values.displayName)
          : currentProfile.username || "player",
        subscription: currentProfile.subscription || null,
        workwondersJwt: currentProfile.workwondersJwt || "",
        karma: currentProfile.karma || 0,
      });
    },
    [updateUserDetails, userDetails]
  );

  const profiles = useMemo(() => getStoredLocalProfiles(), [userDetails]);

  const fetchFriendRequests = useCallback(async () => {
    dispatch(setFriendRequests([]));
  }, [dispatch]);

  const sendFriendRequest = useCallback(async () => {}, []);
  const updateFriendRequestState = useCallback(async () => {}, []);
  const undoFriendship = useCallback(async () => {}, []);
  const blockUser = useCallback(async () => {}, []);
  const unblockUser = useCallback(async () => {}, []);

  const hasActiveSubscription = useMemo(() => {
    const expiresAt = new Date(userDetails?.subscription?.expiresAt ?? 0);
    return expiresAt > new Date();
  }, [userDetails]);

  return {
    userDetails,
    profiles,
    profileBackground,
    friendRequests: [],
    friendRequestCount: 0,
    hasActiveSubscription,
    fetchUserDetails,
    createProfile,
    updateProfile,
    switchProfile,
    deleteProfile,
    signOut,
    clearUserDetails,
    updateUserDetails,
    patchUser,
    sendFriendRequest,
    fetchFriendRequests,
    updateFriendRequestState,
    blockUser,
    unblockUser,
    undoFriendship,
  };
}
