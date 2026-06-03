import type { GameShop } from "@types";

import Color from "color";
import i18next from "i18next";
import { v4 as uuidv4 } from "uuid";
import { THEME_WEB_STORE_URL } from "./constants";
import { levelDBService } from "./services/leveldb.service";

export const formatDownloadProgress = (
  progress?: number,
  fractionDigits?: number
) => {
  if (!progress) return "0%";
  const progressPercentage = progress * 100;

  if (Number(progressPercentage.toFixed(fractionDigits ?? 2)) % 1 === 0)
    return `${Math.floor(progressPercentage)}%`;

  return `${progressPercentage.toFixed(fractionDigits ?? 2)}%`;
};

export const getSteamLanguage = (language: string) => {
  if (language.startsWith("pt")) return "brazilian";
  if (language.startsWith("es")) return "spanish";
  if (language.startsWith("fr")) return "french";
  if (language.startsWith("ru") || language.startsWith("be")) return "russian";
  if (language.startsWith("it")) return "italian";
  if (language.startsWith("hu")) return "hungarian";
  if (language.startsWith("pl")) return "polish";
  if (language.startsWith("zh")) return "schinese";
  if (language.startsWith("da")) return "danish";

  return "english";
};

export const buildGameDetailsPath = (
  game: { shop: GameShop; objectId: string; title: string },
  params: Record<string, string> = {}
) => {
  const searchParams = new URLSearchParams({ title: game.title, ...params });
  return `/game/${game.shop}/${game.objectId}?${searchParams.toString()}`;
};

export const buildGameAchievementPath = (
  game: { shop: GameShop; objectId: string; title: string },
  user?: { userId: string }
) => {
  const searchParams = new URLSearchParams({
    title: game.title,
    shop: game.shop,
    objectId: game.objectId,
    userId: user?.userId || "",
  });

  return `/achievements/?${searchParams.toString()}`;
};

export const darkenColor = (color: string, amount: number, alpha: number = 1) =>
  new Color(color).darken(amount).alpha(alpha).toString();

export type PlayhoardThemeSettings = {
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
  headerText: string;
  logoUrl: string;
  headerFont: string;
  headerTextColor: string;
  mediahoardHeaderText: string;
  mediahoardLogoUrl: string;
  audiohoardHeaderText: string;
  audiohoardLogoUrl: string;
  playhoardHeaderText: string;
  playhoardLogoUrl: string;
  navFont: string;
  titleFont: string;
  titleTextColor: string;
  dropdownFont: string;
  menuFont: string;
  streamsFont: string;
};

export type SavedPlayhoardTheme = {
  id: string;
  name: string;
  settings: PlayhoardThemeSettings;
};

export const PLAYHOARD_THEME_STORAGE_KEY = "playhoard-theme-settings";
export const PLAYHOARD_SAVED_THEMES_STORAGE_KEY = "playhoard-saved-themes";
export const PLAYHOARD_THEME_UPDATED_EVENT = "playhoard-theme-updated";
export const PLAYHOARD_PROFILE_SWITCHED_EVENT = "playhoard-profile-switched";
export const PLAYHOARD_CONTENTHOARD_STATE_UPDATED_EVENT = "playhoard-contenthoard-state-updated";

export const defaultPlayhoardTheme: PlayhoardThemeSettings = {
  backgroundColor: "#131313",
  accentColor: "#FFFFFF",
  textColor: "#ffffff",
  cardGlowColor: "rgba(255, 255, 255, 0.15)",
  navBackgroundColor: "rgba(255, 255, 255, 0.08)",
  navTextColorUnselected: "rgba(255, 255, 255, 0.78)",
  navTextColorSelected: "#0e0e0e",
  headerBackgroundColor: "rgba(255, 255, 255, 0.08)",
  dropdownBackgroundColor: "rgba(14, 14, 14, 0.92)",
  dropdownTextColor: "#ffffff",
  menuBackgroundColor: "rgba(14, 14, 14, 0.92)",
  menuTextColor: "#ffffff",
  streamsBackgroundColor: "rgba(14, 14, 14, 0.62)",
  streamsTextColor: "#ffffff",
  isGlassy: true,
  isTransparent: true,
  glassBlur: 30,
  glassOpacity: 0.08,
  isGlowEnabled: true,
  glowIntensity: 1,
  isSoundEnabled: true,
  globalVolume: 0.5,
  metadataLanguage: "English",
  preferredQuality: "1080p",
  headerText: "PlayHoard",
  logoUrl: "",
  headerFont: "Space Grotesk, Noto Sans, sans-serif",
  mediahoardHeaderText: "MediaHoard",
  mediahoardLogoUrl: "",
  audiohoardHeaderText: "AudioHoard",
  audiohoardLogoUrl: "",
  playhoardHeaderText: "PlayHoard",
  playhoardLogoUrl: "",
  headerTextColor: "#ffffff",
  navFont: "Space Grotesk, Noto Sans, sans-serif",
  titleFont: "Space Grotesk, Noto Sans, sans-serif",
  titleTextColor: "#ffffff",
  dropdownFont: "Space Grotesk, Noto Sans, sans-serif",
  menuFont: "Space Grotesk, Noto Sans, sans-serif",
  streamsFont: "Space Grotesk, Noto Sans, sans-serif",
};

const getContentHoardThemeSettings = (): Partial<PlayhoardThemeSettings> | null => {
  const contentHoard = (globalThis.window as unknown as {
    electron?: {
      contentHoard?: {
        enabled?: boolean;
        theme?: {
          backgroundColor?: string;
          accentColor?: string;
          textColor?: string;
          cardGlowColor?: string;
          menuTextColor?: string;
          secondaryTextColor?: string;
          navTextColorUnselected?: string;
          navTextColorSelected?: string;
          navBackgroundColor?: string;
          surfaceColor?: string;
          elevatedColor?: string;
          headerBackgroundColor?: string;
          dropdownBackgroundColor?: string;
          dropdownTextColor?: string;
          menuBackgroundColor?: string;
          streamsBackgroundColor?: string;
          streamsTextColor?: string;
          isGlassy?: boolean;
          isTransparent?: boolean;
          glassBlur?: number;
          glassOpacity?: number;
          isGlowEnabled?: boolean;
          glowIntensity?: number;
          isSoundEnabled?: boolean;
          globalVolume?: number;
          metadataLanguage?: string;
          preferredQuality?: string;
          headerText?: string;
          logoUrl?: string;
          headerFont?: string;
          headerTextColor?: string;
          navFont?: string;
          titleFont?: string;
          titleTextColor?: string;
          dropdownFont?: string;
          menuFont?: string;
          streamsFont?: string;
        } | null;
      };
    };
  }).electron?.contentHoard;

  if (!contentHoard?.enabled || !contentHoard.theme) return null;

  const theme = contentHoard.theme;
  return {
    backgroundColor: theme.backgroundColor,
    accentColor: theme.accentColor,
    textColor: theme.textColor,
    cardGlowColor: theme.cardGlowColor,
    navBackgroundColor: theme.navBackgroundColor,
    navTextColorUnselected: theme.navTextColorUnselected ?? theme.secondaryTextColor,
    navTextColorSelected: theme.navTextColorSelected,
    headerBackgroundColor: theme.headerBackgroundColor ?? theme.surfaceColor,
    dropdownBackgroundColor: theme.dropdownBackgroundColor ?? theme.elevatedColor,
    dropdownTextColor: theme.dropdownTextColor ?? theme.textColor,
    menuBackgroundColor: theme.menuBackgroundColor ?? theme.elevatedColor,
    menuTextColor: theme.menuTextColor ?? theme.textColor,
    streamsBackgroundColor: theme.streamsBackgroundColor ?? theme.surfaceColor,
    streamsTextColor: theme.streamsTextColor ?? theme.textColor,
    isGlassy: theme.isGlassy,
    isTransparent: theme.isTransparent,
    glassBlur: theme.glassBlur,
    glassOpacity: theme.glassOpacity,
    isGlowEnabled: theme.isGlowEnabled,
    glowIntensity: theme.glowIntensity,
    isSoundEnabled: theme.isSoundEnabled,
    globalVolume: theme.globalVolume,
    metadataLanguage: theme.metadataLanguage,
    preferredQuality: theme.preferredQuality,
    headerText: theme.playhoardHeaderText || theme.headerText,
    logoUrl: theme.playhoardLogoUrl || theme.logoUrl,
    headerFont: theme.headerFont,
    headerTextColor: theme.headerTextColor,
    navFont: theme.navFont ?? theme.headerFont,
    titleFont: theme.titleFont ?? theme.headerFont,
    titleTextColor: theme.titleTextColor,
    dropdownFont: theme.dropdownFont ?? theme.headerFont,
    menuFont: theme.menuFont ?? theme.headerFont,
    streamsFont: theme.streamsFont ?? theme.headerFont,
  };
};

const getContentHoardSavedThemes = (): SavedPlayhoardTheme[] | null => {
  const contentHoard = window.electron.contentHoard;
  if (!contentHoard?.enabled) return null;

  const mapTheme = (theme: { id?: string; name?: string; settings?: Partial<PlayhoardThemeSettings> }) => ({
    id: String(theme.id || uuidv4()),
    name: String(theme.name || "Custom Theme"),
    settings: { ...defaultPlayhoardTheme, ...theme.settings },
  });

  const runtimeThemes = window.localStorage.getItem("playhoard-contenthoard-saved-themes");
  if (runtimeThemes) {
    try {
      const parsed = JSON.parse(runtimeThemes) as Array<{ id?: string; name?: string; settings?: Partial<PlayhoardThemeSettings> }>;
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.filter((t) => t && t.settings).map(mapTheme);
      }
    } catch { /* ignore */ }
  }

  const shared = contentHoard as unknown as {
    savedThemes?: Array<{ id?: string; name?: string; settings?: Partial<PlayhoardThemeSettings> }>;
  };

  if (!Array.isArray(shared.savedThemes)) return null;

  return shared.savedThemes.filter((theme) => theme && theme.settings).map(mapTheme);
};

const hexToRgb = (hex: string) => {
  const normalizedHex = hex.replace(/^#/, "");
  const fullHex =
    normalizedHex.length === 3
      ? normalizedHex
          .split("")
          .map((value) => value + value)
          .join("")
      : normalizedHex;

  const red = Number.parseInt(fullHex.slice(0, 2), 16);
  const green = Number.parseInt(fullHex.slice(2, 4), 16);
  const blue = Number.parseInt(fullHex.slice(4, 6), 16);

  if ([red, green, blue].some(Number.isNaN)) return "255, 255, 255";

  return `${red}, ${green}, ${blue}`;
};

const getActiveProfileStoragePrefix = () => {
  const profileId = window.localStorage.getItem("playhoardActiveProfileId");
  return profileId ? `profile:${profileId}:` : "";
};

const getProfileStorageKey = (key: string) =>
  `${getActiveProfileStoragePrefix()}${key}`;

const isBundledOrStaleLogoUrl = (logoUrl?: string) => {
  if (!logoUrl) return false;
  const normalized = logoUrl.trim().toLowerCase().split("?")[0];

  const staleSuffixes = [
    "/mediahoard.png",
    "/mediahoard.ico",
    "/logo.webp",
    "play-logo.svg",
    "hydra.svg",
  ];

  return (
    staleSuffixes.some((staleLogo) => normalized.endsWith(staleLogo)) ||
    normalized.includes("/assets/icon.") ||
    normalized.endsWith("/assets/icon") ||
    normalized.endsWith("/src/assets/icon.png")
  );
};

const normalizePlayhoardTheme = (
  theme: Partial<PlayhoardThemeSettings>
): PlayhoardThemeSettings => {
  const nextTheme = { ...defaultPlayhoardTheme, ...theme };
  if (isBundledOrStaleLogoUrl(nextTheme.logoUrl)) {
    nextTheme.logoUrl = "";
  }
  return nextTheme;
};

export const getPlayhoardThemeSettings = (): PlayhoardThemeSettings => {
  let baseTheme = getContentHoardThemeSettings();

  if (baseTheme) {
    const cached = window.localStorage.getItem("playhoard-contenthoard-cached-theme");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Record<string, string>;
        baseTheme = {
          ...baseTheme,
          backgroundColor: parsed.backgroundColor ?? baseTheme.backgroundColor,
          accentColor: parsed.accentColor ?? baseTheme.accentColor,
          textColor: parsed.textColor ?? baseTheme.textColor,
          cardGlowColor: parsed.cardGlowColor ?? baseTheme.cardGlowColor,
          navBackgroundColor: parsed.navBackgroundColor ?? baseTheme.navBackgroundColor,
          navTextColorUnselected: parsed.navTextColorUnselected ?? parsed.secondaryTextColor ?? baseTheme.navTextColorUnselected,
          navTextColorSelected: parsed.navTextColorSelected ?? baseTheme.navTextColorSelected,
          headerBackgroundColor: parsed.headerBackgroundColor ?? parsed.surfaceColor ?? baseTheme.headerBackgroundColor,
          dropdownBackgroundColor: parsed.dropdownBackgroundColor ?? parsed.elevatedColor ?? baseTheme.dropdownBackgroundColor,
          dropdownTextColor: parsed.dropdownTextColor ?? baseTheme.dropdownTextColor,
          menuBackgroundColor: parsed.menuBackgroundColor ?? parsed.elevatedColor ?? baseTheme.menuBackgroundColor,
          menuTextColor: parsed.menuTextColor ?? baseTheme.menuTextColor,
          streamsBackgroundColor: parsed.streamsBackgroundColor ?? baseTheme.streamsBackgroundColor,
          streamsTextColor: parsed.streamsTextColor ?? baseTheme.streamsTextColor,
          isGlassy: parsed.isGlassy !== undefined ? Boolean(parsed.isGlassy) : baseTheme.isGlassy,
          isTransparent: parsed.isTransparent !== undefined ? Boolean(parsed.isTransparent) : baseTheme.isTransparent,
          glassBlur: parsed.glassBlur !== undefined ? Number(parsed.glassBlur) : baseTheme.glassBlur,
          glassOpacity: parsed.glassOpacity !== undefined ? Number(parsed.glassOpacity) : baseTheme.glassOpacity,
          isGlowEnabled: parsed.isGlowEnabled !== undefined ? Boolean(parsed.isGlowEnabled) : baseTheme.isGlowEnabled,
          glowIntensity: parsed.glowIntensity !== undefined ? Number(parsed.glowIntensity) : baseTheme.glowIntensity,
          headerFont: parsed.headerFont ?? baseTheme.headerFont,
          headerTextColor: parsed.headerTextColor ?? baseTheme.headerTextColor,
          navFont: parsed.navFont ?? baseTheme.navFont,
          titleFont: parsed.titleFont ?? baseTheme.titleFont,
          titleTextColor: parsed.titleTextColor ?? baseTheme.titleTextColor,
          dropdownFont: parsed.dropdownFont ?? baseTheme.dropdownFont,
          menuFont: parsed.menuFont ?? baseTheme.menuFont,
          streamsFont: parsed.streamsFont ?? baseTheme.streamsFont,
          headerText: parsed.playhoardHeaderText || parsed.headerText || baseTheme.headerText,
          logoUrl: parsed.playhoardLogoUrl || parsed.logoUrl || baseTheme.logoUrl,
        };
      } catch { /* ignore */ }
    }

    const withLogo = { ...baseTheme };
    if (withLogo.playhoardLogoUrl) {
      withLogo.logoUrl = withLogo.playhoardLogoUrl;
    } else {
      withLogo.logoUrl = "";
    }
    return normalizePlayhoardTheme(withLogo);
  }

  const storedTheme = window.localStorage.getItem(
    getProfileStorageKey(PLAYHOARD_THEME_STORAGE_KEY)
  );

  if (!storedTheme) return defaultPlayhoardTheme;

  try {
    return normalizePlayhoardTheme(JSON.parse(storedTheme));
  } catch {
    return defaultPlayhoardTheme;
  }
};

export const getSavedPlayhoardThemes = (): SavedPlayhoardTheme[] => {
  const contentHoardThemes = getContentHoardSavedThemes();
  if (contentHoardThemes) return contentHoardThemes;

  const storedThemes = window.localStorage.getItem(
    getProfileStorageKey(PLAYHOARD_SAVED_THEMES_STORAGE_KEY)
  );

  if (!storedThemes) return [];

  try {
    return JSON.parse(storedThemes);
  } catch {
    return [];
  }
};

export const applyPlayhoardTheme = (theme: PlayhoardThemeSettings) => {
  const root = document.documentElement;

  root.style.setProperty("--playhoard-background", theme.backgroundColor);
  root.style.setProperty("--playhoard-accent", theme.accentColor);
  root.style.setProperty("--playhoard-accent-rgb", hexToRgb(theme.accentColor));
  root.style.setProperty("--playhoard-text", theme.textColor);
  root.style.setProperty("--playhoard-card-glow", theme.cardGlowColor);
  root.style.setProperty("--playhoard-nav-bg", theme.navBackgroundColor);
  root.style.setProperty("--playhoard-nav-text", theme.navTextColorUnselected);
  root.style.setProperty("--playhoard-nav-selected-text", theme.navTextColorSelected);
  root.style.setProperty("--playhoard-header-bg", theme.headerBackgroundColor);
  root.style.setProperty("--playhoard-dropdown-bg", theme.dropdownBackgroundColor);
  root.style.setProperty("--playhoard-dropdown-text", theme.dropdownTextColor);
  root.style.setProperty("--playhoard-menu-bg", theme.menuBackgroundColor);
  root.style.setProperty("--playhoard-menu-text", theme.menuTextColor);
  root.style.setProperty("--playhoard-streams-bg", theme.streamsBackgroundColor);
  root.style.setProperty("--playhoard-streams-text", theme.streamsTextColor);
  root.style.setProperty("--playhoard-glass-blur", theme.isGlassy ? `${theme.glassBlur}px` : "0px");
  root.style.setProperty("--playhoard-glass-opacity", theme.isTransparent ? `${theme.glassOpacity}` : "1");
  root.style.setProperty("--playhoard-glow-intensity", theme.isGlowEnabled ? `${theme.glowIntensity}` : "0");
  root.style.setProperty("--playhoard-header-font", theme.headerFont);
  root.style.setProperty("--playhoard-header-text", theme.headerTextColor);
  root.style.setProperty("--playhoard-nav-font", theme.navFont);
  root.style.setProperty("--playhoard-title-font", theme.titleFont);
  root.style.setProperty("--playhoard-title-text", theme.titleTextColor);
  root.style.setProperty("--playhoard-dropdown-font", theme.dropdownFont);
  root.style.setProperty("--playhoard-menu-font", theme.menuFont);
  root.style.setProperty("--playhoard-streams-font", theme.streamsFont);

  root.style.setProperty("--theme-background", theme.backgroundColor);
  root.style.setProperty("--theme-accent", theme.accentColor);
  root.style.setProperty("--theme-accent-rgb", hexToRgb(theme.accentColor));
  root.style.setProperty("--theme-text", theme.textColor);
  root.style.setProperty("--theme-card-glow", theme.cardGlowColor);
  root.style.setProperty("--theme-nav-bg", theme.navBackgroundColor);
  root.style.setProperty("--theme-nav-text-unselected", theme.navTextColorUnselected);
  root.style.setProperty("--theme-nav-text-selected", theme.navTextColorSelected);
  root.style.setProperty("--theme-header-bg", theme.headerBackgroundColor);
  root.style.setProperty("--theme-dropdown-bg", theme.dropdownBackgroundColor);
  root.style.setProperty("--theme-dropdown-text", theme.dropdownTextColor);
  root.style.setProperty("--theme-menu-bg", theme.menuBackgroundColor);
  root.style.setProperty("--theme-menu-text", theme.menuTextColor);
  root.style.setProperty("--theme-streams-bg", theme.streamsBackgroundColor);
  root.style.setProperty("--theme-streams-text", theme.streamsTextColor);
  root.style.setProperty("--theme-glass-blur", theme.isGlassy ? `${theme.glassBlur}px` : "0px");
  root.style.setProperty("--theme-glass-opacity", theme.isTransparent ? `${theme.glassOpacity}` : "1");
  root.style.setProperty("--theme-glow-intensity", theme.isGlowEnabled ? `${theme.glowIntensity}` : "0");
  root.style.setProperty("--theme-font-header", theme.headerFont);
  root.style.setProperty("--theme-text-header", theme.headerTextColor);
  root.style.setProperty("--theme-font-nav", theme.navFont);
  root.style.setProperty("--theme-font-title", theme.titleFont);
  root.style.setProperty("--theme-text-title", theme.titleTextColor);
  root.style.setProperty("--theme-font-dropdown", theme.dropdownFont);
  root.style.setProperty("--theme-font-menu", theme.menuFont);
  root.style.setProperty("--theme-font-streams", theme.streamsFont);
}

export const savePlayhoardThemeSettings = (
  theme: PlayhoardThemeSettings
) => {
  window.localStorage.setItem(
    getProfileStorageKey(PLAYHOARD_THEME_STORAGE_KEY),
    JSON.stringify(theme)
  );
  applyPlayhoardTheme(theme);
  const bridge = window.electron.contentHoard;
  if (bridge?.enabled) {
    void bridge.readSharedState().then((shared) => {
      const sharedRecord = shared && typeof shared === "object" ? shared as Record<string, unknown> : {};
      return bridge.writeSharedState({
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
          cardGlowColor: theme.cardGlowColor,
          menuTextColor: theme.menuTextColor,
          secondaryTextColor: theme.navTextColorUnselected,
          navTextColorUnselected: theme.navTextColorUnselected,
          navTextColorSelected: theme.navTextColorSelected,
          navBackgroundColor: theme.navBackgroundColor,
          headerBackgroundColor: theme.headerBackgroundColor,
          dropdownBackgroundColor: theme.dropdownBackgroundColor,
          dropdownTextColor: theme.dropdownTextColor,
          menuBackgroundColor: theme.menuBackgroundColor,
          streamsBackgroundColor: theme.streamsBackgroundColor,
          streamsTextColor: theme.streamsTextColor,
          glassBlur: theme.glassBlur,
          glassOpacity: theme.glassOpacity,
          isGlassy: theme.isGlassy,
          isTransparent: theme.isTransparent,
          isGlowEnabled: theme.isGlowEnabled,
          glowIntensity: theme.glowIntensity,
          isSoundEnabled: theme.isSoundEnabled,
          globalVolume: theme.globalVolume,
          metadataLanguage: theme.metadataLanguage,
          preferredQuality: theme.preferredQuality,
          headerText: theme.headerText,
          logoUrl: theme.logoUrl,
          playhoardHeaderText: theme.headerText,
          playhoardLogoUrl: theme.logoUrl,
          headerFont: theme.headerFont,
          headerTextColor: theme.headerTextColor,
          navFont: theme.navFont,
          titleFont: theme.titleFont,
          titleTextColor: theme.titleTextColor,
          dropdownFont: theme.dropdownFont,
          menuFont: theme.menuFont,
          streamsFont: theme.streamsFont,
        },
      });
    }).catch(() => undefined);
  }
  window.dispatchEvent(new Event(PLAYHOARD_THEME_UPDATED_EVENT));
};

export const savePlayhoardThemePreset = (
  name: string,
  settings: PlayhoardThemeSettings
) => {
  const savedThemes = getSavedPlayhoardThemes();
  const nextThemes = [
    ...savedThemes,
    {
      id: globalThis.crypto?.randomUUID?.() ?? `theme-${Date.now()}`,
      name,
      settings,
    },
  ];

  window.localStorage.setItem(
    getProfileStorageKey(PLAYHOARD_SAVED_THEMES_STORAGE_KEY),
    JSON.stringify(nextThemes)
  );
  const bridge = window.electron.contentHoard;
  if (bridge?.enabled) {
    void bridge.readSharedState().then((shared) => {
      const sharedRecord = shared && typeof shared === "object" ? shared as Record<string, unknown> : {};
      return bridge.writeSharedState({ ...sharedRecord, savedThemes: nextThemes });
    }).catch(() => undefined);
  }

  return nextThemes;
};

export const overwritePlayhoardThemePreset = (
  id: string,
  name: string,
  settings: PlayhoardThemeSettings
) => {
  const nextThemes = getSavedPlayhoardThemes().map((theme) =>
    theme.id === id ? { ...theme, name, settings } : theme
  );

  window.localStorage.setItem(
    getProfileStorageKey(PLAYHOARD_SAVED_THEMES_STORAGE_KEY),
    JSON.stringify(nextThemes)
  );
  const bridge = window.electron.contentHoard;
  if (bridge?.enabled) {
    void bridge.readSharedState().then((shared) => {
      const sharedRecord = shared && typeof shared === "object" ? shared as Record<string, unknown> : {};
      return bridge.writeSharedState({ ...sharedRecord, savedThemes: nextThemes });
    }).catch(() => undefined);
  }

  return nextThemes;
};

export const deletePlayhoardThemePreset = (id: string) => {
  const nextThemes = getSavedPlayhoardThemes().filter(
    (theme) => theme.id !== id
  );
  window.localStorage.setItem(
    getProfileStorageKey(PLAYHOARD_SAVED_THEMES_STORAGE_KEY),
    JSON.stringify(nextThemes)
  );
  const bridge = window.electron.contentHoard;
  if (bridge?.enabled) {
    void bridge.readSharedState().then((shared) => {
      const sharedRecord = shared && typeof shared === "object" ? shared as Record<string, unknown> : {};
      return bridge.writeSharedState({ ...sharedRecord, savedThemes: nextThemes });
    }).catch(() => undefined);
  }
  return nextThemes;
};

export const injectCustomCss = (
  css: string,
  target: HTMLElement = document.head
) => {
  try {
    target.querySelector("#custom-css")?.remove();

    if (css.startsWith(THEME_WEB_STORE_URL)) {
      const link = document.createElement("link");
      link.id = "custom-css";
      link.rel = "stylesheet";
      link.href = css;
      target.appendChild(link);
    } else {
      const style = document.createElement("style");
      style.id = "custom-css";
      style.textContent = `
        ${css}
      `;
      target.appendChild(style);
    }
  } catch (error) {
    console.error("failed to inject custom css:", error);
  }
};

export const removeCustomCss = (target: HTMLElement = document.head) => {
  target.querySelector("#custom-css")?.remove();
};

const encodeLocalPathSegment = (segment: string, index: number) => {
  if (index === 0 && /^[a-zA-Z]:$/.test(segment)) return segment;

  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
};

export const resolveImageUrl = (imageUrl?: string | null): string | null => {
  if (!imageUrl) return null;

  const trimmedImageUrl = imageUrl.trim();
  if (!trimmedImageUrl) return null;

  if (
    trimmedImageUrl.startsWith("http://") ||
    trimmedImageUrl.startsWith("https://") ||
    trimmedImageUrl.startsWith("data:") ||
    trimmedImageUrl.startsWith("blob:")
  ) {
    return trimmedImageUrl;
  }

  const localPath = trimmedImageUrl.startsWith("local:")
    ? trimmedImageUrl.slice("local:".length)
    : trimmedImageUrl;
  const normalizedLocalPath = localPath
    .replace(/\\/g, "/")
    .split("/")
    .map(encodeLocalPathSegment)
    .join("/");

  return `local:${normalizedLocalPath}`;
};

export const generateRandomGradient = (): string => {
  // Use a single consistent gradient with softer colors for custom games as placeholder
  const color1 = "#2c3e50"; // Dark blue-gray
  const color2 = "#34495e"; // Darker slate

  // Create SVG data URL that works in img tags
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)" />
  </svg>`;

  // Return as data URL that works in img tags
  return `data:image/svg+xml;base64,${btoa(svgContent)}`;
};

export const formatNumber = (num: number): string => {
  const locale = i18next.resolvedLanguage || i18next.language || undefined;

  return new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(num);
};

/**
 * Generates a UUID v4
 * @returns A random UUID string
 */
export const generateUUID = (): string => {
  return uuidv4();
};

export const getAchievementSoundUrl = async (): Promise<string> => {
  const defaultSound = (await import("@renderer/assets/audio/achievement.wav"))
    .default;

  try {
    const allThemes = (await levelDBService.values("themes")) as {
      id: string;
      isActive?: boolean;
      hasCustomSound?: boolean;
    }[];
    const activeTheme = allThemes.find((theme) => theme.isActive);

    if (activeTheme?.hasCustomSound) {
      const soundDataUrl = await window.electron.getThemeSoundDataUrl(
        activeTheme.id
      );
      if (soundDataUrl) {
        return soundDataUrl;
      }
    }
  } catch (error) {
    console.error("Failed to get theme sound", error);
  }

  return defaultSound;
};

export const getAchievementSoundVolume = async (): Promise<number> => {
  try {
    const prefs = (await levelDBService.get(
      "userPreferences",
      null,
      "json"
    )) as { achievementSoundVolume?: number } | null;
    return prefs?.achievementSoundVolume ?? 0.15;
  } catch (error) {
    console.error("Failed to get sound volume", error);
    return 0.15;
  }
};

export const getGameKey = (shop: GameShop, objectId: string): string => {
  return `${shop}:${objectId}`;
};
