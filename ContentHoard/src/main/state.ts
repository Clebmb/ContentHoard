import Store from "electron-store";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type Profile = {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: number;
};

export type ThemeSettings = {
  // MediaHoard-compatible theme settings
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
  logoUrl: string;
  headerText: string;
  headerFont: string;
  headerTextColor: string;
  navFont: string;
  titleFont: string;
  titleTextColor: string;
  dropdownFont: string;
  menuFont: string;
  streamsFont: string;
  // Per-app branding
  mediahoardLogoUrl: string;
  mediahoardHeaderText: string;
  mediahoardHeaderFont: string;
  mediahoardHeaderTextColor: string;
  audiohoardLogoUrl: string;
  audiohoardHeaderText: string;
  audiohoardHeaderFont: string;
  audiohoardHeaderTextColor: string;
  playhoardLogoUrl: string;
  playhoardHeaderText: string;
  playhoardHeaderFont: string;
  playhoardHeaderTextColor: string;
  // Compatibility aliases used by existing AudioHoard/PlayHoard bridges.
  surfaceColor: string;
  elevatedColor: string;
  secondaryTextColor: string;
};

export type SavedTheme = {
  id: string;
  name: string;
  settings: ThemeSettings;
};

export type ContentHoardState = {
  activeAppId: string;
  activeProfileId: string;
  profiles: Profile[];
  theme: ThemeSettings;
  savedThemes: SavedTheme[];
};

const defaultProfile: Profile = {
  id: "default",
  name: "Primary",
  icon: "person",
  color: "#39E079",
  createdAt: Date.now()
};

export const defaultTheme: ThemeSettings = {
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
  logoUrl: "",
  headerText: "ContentHoard",
  headerFont: "Inter, Space Grotesk, Noto Sans, system-ui, sans-serif",
  headerTextColor: "#ffffff",
  navFont: "Inter, Space Grotesk, Noto Sans, system-ui, sans-serif",
  titleFont: "Inter, Space Grotesk, Noto Sans, system-ui, sans-serif",
  titleTextColor: "#ffffff",
  dropdownFont: "Inter, Space Grotesk, Noto Sans, system-ui, sans-serif",
  menuFont: "Inter, Space Grotesk, Noto Sans, system-ui, sans-serif",
  streamsFont: "Inter, Space Grotesk, Noto Sans, system-ui, sans-serif",
  mediahoardLogoUrl: "",
  mediahoardHeaderText: "MediaHoard",
  mediahoardHeaderFont: "Inter, Space Grotesk, Noto Sans, system-ui, sans-serif",
  mediahoardHeaderTextColor: "#ffffff",
  audiohoardLogoUrl: "",
  audiohoardHeaderText: "AudioHoard",
  audiohoardHeaderFont: "Inter, Space Grotesk, Noto Sans, system-ui, sans-serif",
  audiohoardHeaderTextColor: "#ffffff",
  playhoardLogoUrl: "",
  playhoardHeaderText: "PlayHoard",
  playhoardHeaderFont: "Inter, Space Grotesk, Noto Sans, system-ui, sans-serif",
  playhoardHeaderTextColor: "#ffffff",
  surfaceColor: "rgba(26, 26, 26, 0.6)",
  elevatedColor: "rgba(26, 26, 26, 0.95)",
  secondaryTextColor: "rgba(255, 255, 255, 0.6)"
};

export const defaultState: ContentHoardState = {
  activeAppId: "mediahoard",
  activeProfileId: defaultProfile.id,
  profiles: [defaultProfile],
  theme: defaultTheme,
  savedThemes: []
};

const store = new Store<ContentHoardState>({ name: "contenthoard-state" }) as Store<ContentHoardState> & {
  store: Partial<ContentHoardState>;
  set: (value: Partial<ContentHoardState>) => void;
};

export const sharedStatePath = process.env.CONTENTHOARD_SHARED_STATE_PATH ||
  path.join(os.homedir(), ".contenthoard", "shared-state.json");

function readSharedState(): Partial<ContentHoardState> {
  try {
    const raw = fs.readFileSync(sharedStatePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ContentHoardState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSharedState(state: ContentHoardState) {
  fs.mkdirSync(path.dirname(sharedStatePath), { recursive: true });
  fs.writeFileSync(sharedStatePath, JSON.stringify(state, null, 2), "utf8");
}

export function loadState(): ContentHoardState {
  const stored = { ...(store.store as Partial<ContentHoardState>), ...readSharedState() };
  const profiles = Array.isArray(stored.profiles) && stored.profiles.length ? stored.profiles : defaultState.profiles;
  const activeProfileId = profiles.some((profile) => profile.id === stored.activeProfileId)
    ? String(stored.activeProfileId)
    : profiles[0].id;

  return {
    ...defaultState,
    ...stored,
    profiles,
    activeProfileId,
    theme: {
      ...defaultTheme,
      ...(stored.theme ?? {})
    },
    savedThemes: Array.isArray(stored.savedThemes) ? stored.savedThemes : []
  };
}

export function saveState(nextState: ContentHoardState): ContentHoardState {
  const normalized: ContentHoardState = {
    ...loadState(),
    ...nextState,
    profiles: Array.isArray(nextState.profiles) && nextState.profiles.length ? nextState.profiles : defaultState.profiles,
    theme: {
      ...defaultTheme,
      ...(nextState.theme ?? {})
    },
    savedThemes: Array.isArray(nextState.savedThemes) ? nextState.savedThemes : []
  };
  store.set(normalized);
  writeSharedState(normalized);
  return normalized;
}

export function buildLaunchEnvironment(appId: string) {
  const state = loadState();
  const activeProfile = state.profiles.find((profile) => profile.id === state.activeProfileId) ?? state.profiles[0];
  return {
    CONTENTHOARD: "1",
    CONTENTHOARD_APP_ID: appId,
    CONTENTHOARD_PROFILE_ID: activeProfile.id,
    CONTENTHOARD_PROFILE: JSON.stringify(activeProfile),
    CONTENTHOARD_THEME: JSON.stringify(state.theme),
    CONTENTHOARD_SAVED_THEMES: JSON.stringify(state.savedThemes),
    CONTENTHOARD_SHARED_STATE_PATH: sharedStatePath
  };
}
