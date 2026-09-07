export {};

declare global {
  interface Window {
    contenthoard: {
      getApps: () => Promise<HoardApp[]>;
      getState: () => Promise<ContentHoardState>;
      saveState: (state: ContentHoardState) => Promise<ContentHoardState>;
      launchApp: (appId: string) => Promise<LaunchResult>;
      stopApp: (appId: string) => Promise<void>;
      revealApp: (appId: string) => Promise<void>;
      getStatuses: () => Promise<Record<string, AppStatus>>;
      onStatus: (callback: (statuses: Record<string, AppStatus>) => void) => () => void;
      onStateUpdated: (callback: (state: ContentHoardState) => void) => () => void;
    };
  }
}

export type HoardApp = {
  id: string;
  name: string;
  shortName: string;
  domain: string;
  description: string;
  accent: string;
  icon: string;
  path: string;
  windowCommand: string;
  windowArgs: string[];
  installed: boolean;
};

export type Profile = {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: number;
};

export type ThemeSettings = {
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

export type AppStatus = {
  running: boolean;
  pid: number | null;
  startedAt: number | null;
  lastExitCode?: number | null;
};

export type LaunchResult = {
  ok: boolean;
  appId: string;
  status: AppStatus;
};
