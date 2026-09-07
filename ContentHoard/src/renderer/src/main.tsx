import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import appIconUrl from "../assets/icon.png";
import {
  Check,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Palette,
  Plus,
  Power,
  RotateCcw,
  Save,
  Settings,
  Share2,
  Square,
  Trash2,
  Type,
  Upload,
  UserRoundPen,
  X
} from "lucide-react";
import type { AppStatus, ContentHoardState, HoardApp, Profile, SavedTheme, ThemeSettings } from "./global";
import "./styles.css";

type ViewId = "settings" | string;
type ThemeTab = "colors" | "fonts" | "effects" | "branding";
type BrandingTab = "contenthoard" | "mediahoard" | "audiohoard" | "playhoard";

const profileColors = ["#39E079", "#E03939", "#397EE0", "#E0A339", "#9C39E0", "#39E0DC", "#FFFFFF"];
const profileIcons = [
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
  "celebration"
];

const fontOptions = [
  { name: "Spline Sans", value: "Inter, Space Grotesk, Noto Sans, system-ui, sans-serif" },
  { name: "Inter", value: "Inter, system-ui, sans-serif" },
  { name: "Outfit", value: "Outfit, Inter, system-ui, sans-serif" },
  { name: "Playfair Display", value: "Playfair Display, Georgia, serif" },
  { name: "Ubuntu Mono", value: "Ubuntu Mono, monospace" },
  { name: "Roboto Mono", value: "Roboto Mono, monospace" }
];

function setFavicon(href: string) {
  const existing = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  const link = existing ?? document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.href = href;
  if (!existing) document.head.appendChild(link);
}

setFavicon(appIconUrl);

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
  glowIntensity: 1,
  isSoundEnabled: true,
  globalVolume: 0.5,
  metadataLanguage: "English",
  preferredQuality: "1080p",
  logoUrl: "",
  headerText: "ContentHoard",
  headerFont: fontOptions[0].value,
  headerTextColor: "#ffffff",
  navFont: fontOptions[0].value,
  titleFont: fontOptions[0].value,
  titleTextColor: "#ffffff",
  dropdownFont: fontOptions[0].value,
  menuFont: fontOptions[0].value,
  streamsFont: fontOptions[0].value,
  mediahoardLogoUrl: "",
  mediahoardHeaderText: "MediaHoard",
  mediahoardHeaderFont: fontOptions[0].value,
  mediahoardHeaderTextColor: "#ffffff",
  audiohoardLogoUrl: "",
  audiohoardHeaderText: "AudioHoard",
  audiohoardHeaderFont: fontOptions[0].value,
  audiohoardHeaderTextColor: "#ffffff",
  playhoardLogoUrl: "",
  playhoardHeaderText: "PlayHoard",
  playhoardHeaderFont: fontOptions[0].value,
  playhoardHeaderTextColor: "#ffffff",
  surfaceColor: "rgba(26, 26, 26, 0.6)",
  elevatedColor: "rgba(26, 26, 26, 0.95)",
  secondaryTextColor: "rgba(255, 255, 255, 0.6)"
};

const effectPresets = [
  {
    name: "Cinematic Glass",
    settings: { isGlassy: true, isTransparent: true, glassBlur: 24, glassOpacity: 0.1 }
  },
  {
    name: "Clear Ghost",
    settings: { isGlassy: false, isTransparent: true, glassOpacity: 0.2 }
  },
  {
    name: "Solid Opaque",
    settings: { isGlassy: false, isTransparent: false }
  },
  {
    name: "High Frost",
    settings: { isGlassy: true, isTransparent: true, glassBlur: 64, glassOpacity: 0.05 }
  }
] satisfies Array<{ name: string; settings: Partial<ThemeSettings> }>;

function makeId(prefix: string) {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function activeProfile(state: ContentHoardState) {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) ?? state.profiles[0];
}

function isImageIcon(icon = "") {
  return icon.startsWith("data:") || icon.includes("://");
}

function MaterialIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-icon ${className}`}>{name}</span>;
}

function ProfileAvatar({ profile, className = "" }: { profile: Partial<Profile> | null; className?: string }) {
  const icon = profile?.icon || "person";
  return (
    <span className={`profile-avatar ${className}`} style={{ backgroundColor: profile?.color || "#39E079" }}>
      {isImageIcon(icon) ? <img src={icon} alt="" /> : <span className="material-icon">{icon}</span>}
    </span>
  );
}

function App() {
  const [apps, setApps] = useState<HoardApp[]>([]);
  const [state, setState] = useState<ContentHoardState | null>(null);
  const [statuses, setStatuses] = useState<Record<string, AppStatus>>({});
  const [view, setView] = useState<ViewId>("settings");
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [profileDraft, setProfileDraft] = useState({ name: "", color: profileColors[0], icon: "" });
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [themeTab, setThemeTab] = useState<ThemeTab>("colors");
  const [brandingTab, setBrandingTab] = useState<BrandingTab>("contenthoard");
  const [newThemeName, setNewThemeName] = useState("");
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  const [loadedThemeId, setLoadedThemeId] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([window.contenthoard.getApps(), window.contenthoard.getState(), window.contenthoard.getStatuses()])
      .then(([nextApps, nextState, nextStatuses]) => {
        setApps(nextApps);
        setState(nextState);
        setStatuses(nextStatuses);
      });
    const unsubStatus = window.contenthoard.onStatus(setStatuses);
    const unsubState = window.contenthoard.onStateUpdated((updatedState) => {
      setState(updatedState);
    });
    return () => {
      unsubStatus();
      unsubState();
    };
  }, []);

  const persistState = useCallback(async (nextState: ContentHoardState) => {
    const saved = await window.contenthoard.saveState(nextState);
    setState(saved);
  }, []);

  const selectedApp = useMemo(() => {
    if (!state) return null;
    return apps.find((app) => app.id === state.activeAppId) ?? apps[0] ?? null;
  }, [apps, state]);

  useEffect(() => {
    if (!state) return;
    const root = document.documentElement;
    const theme = state.theme;
    root.style.setProperty("--theme-background", theme.backgroundColor);
    root.style.setProperty("--theme-accent", theme.accentColor);
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
    root.style.setProperty("--theme-glass-blur", theme.isGlassy ? `${theme.glassBlur}px` : "0px");
    root.style.setProperty("--theme-glass-opacity", theme.isTransparent ? String(theme.glassOpacity) : "1");
    root.style.setProperty("--theme-glow-intensity", theme.isGlowEnabled ? String(theme.glowIntensity) : "0");
    root.style.setProperty("--theme-font-header", theme.headerFont);
    root.style.setProperty("--theme-font-nav", theme.navFont);
    root.style.setProperty("--theme-font-title", theme.titleFont);
    root.style.setProperty("--theme-font-menu", theme.menuFont);
  }, [state]);

  if (!state || !selectedApp) {
    return <main className="loading">Loading ContentHoard...</main>;
  }

  const profile = activeProfile(state);
  const activeApp = view === "settings" ? null : apps.find((app) => app.id === view) ?? selectedApp;

  const updateTheme = (patch: Partial<ThemeSettings>) => {
    const nextTheme = { ...state.theme, ...patch };
    nextTheme.surfaceColor = nextTheme.streamsBackgroundColor;
    nextTheme.elevatedColor = nextTheme.menuBackgroundColor;
    nextTheme.secondaryTextColor = nextTheme.navTextColorUnselected;
    void persistState({ ...state, theme: nextTheme });
  };

  const launchApp = async (appId: string) => {
    try {
      const result = await window.contenthoard.launchApp(appId);
      setStatuses((current) => ({ ...current, [appId]: result.status }));
    } catch (error) {
      console.error(`Failed to launch ${appId}:`, error);
      setStatuses((current) => ({ ...current, [appId]: { ...(current[appId] ?? { running: false, pid: null, startedAt: null }), running: false } }));
    }
  };

  const openProfileEditor = (target?: Profile) => {
    setEditingProfile(target ?? null);
    setProfileDraft({
      name: target?.name ?? "",
      color: target?.color ?? profileColors[0],
      icon: target?.icon ?? ""
    });
    setIsProfileEditorOpen(true);
  };

  const saveProfile = () => {
    const name = profileDraft.name.trim() || "New Profile";
    if (editingProfile) {
      void persistState({
        ...state,
        profiles: state.profiles.map((item) =>
          item.id === editingProfile.id ? { ...item, name, color: profileDraft.color, icon: profileDraft.icon } : item
        )
      });
    } else {
      const nextProfile = {
        id: makeId("profile"),
        name,
        color: profileDraft.color,
        icon: profileDraft.icon,
        createdAt: Date.now()
      };
      void persistState({ ...state, profiles: [...state.profiles, nextProfile], activeProfileId: nextProfile.id });
    }
    setIsProfileEditorOpen(false);
    setEditingProfile(null);
  };

  const deleteProfile = (id: string) => {
    if (state.profiles.length <= 1) return;
    const nextProfiles = state.profiles.filter((item) => item.id !== id);
    void persistState({
      ...state,
      profiles: nextProfiles,
      activeProfileId: state.activeProfileId === id ? nextProfiles[0].id : state.activeProfileId
    });
  };

  const saveTheme = () => {
    const name = newThemeName.trim() || "Custom Theme";
    const nextTheme: SavedTheme = { id: makeId("theme"), name, settings: { ...state.theme } };
    void persistState({ ...state, savedThemes: [...state.savedThemes, nextTheme] });
    setLoadedThemeId(nextTheme.id);
    setNewThemeName("");
  };

  const overwriteTheme = (id: string) => {
    void persistState({
      ...state,
      savedThemes: state.savedThemes.map((item) => (item.id === id ? { ...item, settings: { ...state.theme } } : item))
    });
  };

  const loadTheme = (settings: ThemeSettings) => {
    void persistState({ ...state, theme: { ...defaultTheme, ...settings } });
  };

  const resetTheme = () => {
    updateTheme(defaultTheme);
    setLoadedThemeId(null);
    setNewThemeName("");
  };

  const readImageFile = (file: File, onLoad: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") onLoad(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="app-shell">
      <header className="top-shell">
        <button type="button" className="brand-pill" onClick={() => setView("settings")} aria-label="ContentHoard settings">
          {state.theme.logoUrl ? <img src={state.theme.logoUrl} alt="" /> : <MaterialIcon name="view_apps" />}
          <strong>{state.theme.headerText || "ContentHoard"}</strong>
        </button>

        <nav className="top-nav" aria-label="Launcher">
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>
            <Settings size={16} />
            <span>Settings</span>
          </button>
          {apps.map((app) => (
              <button
                key={app.id}
                className={view === app.id ? "active" : ""}
                onClick={() => {
                  setView(app.id);
                  void persistState({ ...state, activeAppId: app.id });
                }}
              >
                <MaterialIcon name={app.icon} />
                <span>{app.name}</span>
              </button>
          ))}
        </nav>

        <div className="profile-control">
          <ProfileAvatar profile={profile} />
          <span>{profile.name}</span>
        </div>
      </header>

      {activeApp ? (
        <section className="app-view">
          <div className="app-hero" style={{ "--app-accent": activeApp.accent } as React.CSSProperties}>
            <div className="app-mark-large"><MaterialIcon name={activeApp.icon} /></div>
            <div>
              <p>{activeApp.domain}</p>
              <h1>{activeApp.name}</h1>
              <span>{activeApp.description}</span>
            </div>
            <i className={statuses[activeApp.id]?.running ? "status on" : "status"} />
          </div>
          <div className="app-command-row">
            <button className="primary" onClick={() => void launchApp(activeApp.id)} disabled={!activeApp.installed} title={activeApp.installed ? undefined : "App folder not found in this workspace"}>
              <Power size={16} /> Launch
            </button>
            <button onClick={() => window.contenthoard.revealApp(activeApp.id)}><FolderOpen size={16} /> Open Folder</button>
            {statuses[activeApp.id]?.running && <button onClick={() => window.contenthoard.stopApp(activeApp.id)}><Square size={14} /> Stop</button>}
            {!activeApp.installed && <span className="app-missing-hint">App folder not found — place this app next to ContentHoard to enable launch.</span>}
            {(() => {
              const st = statuses[activeApp.id];
              if (!activeApp.installed || st?.running) return null;
              if (typeof st?.lastExitCode !== "number" || st.lastExitCode === 0) return null;
              return <span className="app-missing-hint">Last run exited with code {st.lastExitCode} — see ~/.contenthoard/logs/{activeApp.id}.log</span>;
            })()}
          </div>
        </section>
      ) : (
        <section className="settings-view">
          <section className="profile-manager">
            <div className="section-heading">
              <div>
                <p>Profile</p>
                <h2>Profile Manager</h2>
              </div>
              <button onClick={() => openProfileEditor()}><Plus size={16} /> Add Profile</button>
            </div>
            <div className="profile-list">
              {state.profiles.map((item) => (
                <div className={`profile-row ${item.id === profile.id ? "active" : ""}`} key={item.id}>
                  <button className="profile-select" onClick={() => persistState({ ...state, activeProfileId: item.id })}>
                    <ProfileAvatar profile={item} />
                    <span><strong>{item.name}</strong><small>{item.id === profile.id ? "Active across apps" : "Available"}</small></span>
                  </button>
                  <button onClick={() => openProfileEditor(item)} title="Edit profile"><UserRoundPen size={16} /></button>
                  <button onClick={() => deleteProfile(item.id)} disabled={state.profiles.length <= 1} title="Delete profile"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </section>

          <section className="theme-manager">
            <div className="theme-editor-header">
              <div className="theme-title">
                <span><Palette size={20} /></span>
                <div>
                  <h2>Theme Editor</h2>
                  <p>Customization</p>
                </div>
              </div>
              <div className="icon-actions">
                <button onClick={resetTheme} title="Reset to default"><RotateCcw size={18} /></button>
                <button title="Current theme saved automatically"><Check size={18} /></button>
              </div>
            </div>

            <div className="theme-tabs">
              {[
                ["colors", Palette, "Colors"],
                ["fonts", Type, "Typography"],
                ["effects", Layers, "Effects"],
                ["branding", ImageIcon, "Branding"]
              ].map(([id, Icon, label]) => (
                <button key={id as string} className={themeTab === id ? "active" : ""} onClick={() => setThemeTab(id as ThemeTab)}>
                  {React.createElement(Icon as typeof Palette, { size: 15 })}
                  <span>{label as string}</span>
                </button>
              ))}
            </div>

            <div className="theme-body">
              {themeTab === "colors" && (
                <div className="control-grid">
                  <ColorControl label="Background Color" value={state.theme.backgroundColor} onChange={(value) => updateTheme({ backgroundColor: value })} isRgba />
                  <ColorControl label="Accent Color" value={state.theme.accentColor} onChange={(value) => updateTheme({ accentColor: value })} />
                  <ColorControl label="Navigation Background" value={state.theme.navBackgroundColor} onChange={(value) => updateTheme({ navBackgroundColor: value })} isRgba />
                  <ColorControl label="Top Bar Background" value={state.theme.headerBackgroundColor} onChange={(value) => updateTheme({ headerBackgroundColor: value })} isRgba />
                  <ColorControl label="Dropdown Background" value={state.theme.dropdownBackgroundColor} onChange={(value) => updateTheme({ dropdownBackgroundColor: value })} isRgba />
                  <ColorControl label="Menu Background" value={state.theme.menuBackgroundColor} onChange={(value) => updateTheme({ menuBackgroundColor: value })} isRgba />
                  <ColorControl label="Streams Menu Background" value={state.theme.streamsBackgroundColor} onChange={(value) => updateTheme({ streamsBackgroundColor: value })} isRgba />
                </div>
              )}

              {themeTab === "fonts" && (
                <div className="control-grid">
                  <ColorControl label="General Text Color" value={state.theme.textColor} onChange={(value) => updateTheme({ textColor: value })} />
                  <SelectControl label="Logo/Header Font" value={state.theme.headerFont} onChange={(value) => updateTheme({ headerFont: value })} />
                  <ColorControl label="Header Text Color" value={state.theme.headerTextColor} onChange={(value) => updateTheme({ headerTextColor: value })} />
                  <SelectControl label="Navigation Font" value={state.theme.navFont} onChange={(value) => updateTheme({ navFont: value })} />
                  <ColorControl label="Nav Text (Normal)" value={state.theme.navTextColorUnselected} onChange={(value) => updateTheme({ navTextColorUnselected: value })} isRgba />
                  <ColorControl label="Nav Text (Selected)" value={state.theme.navTextColorSelected} onChange={(value) => updateTheme({ navTextColorSelected: value })} />
                  <SelectControl label="Title/Heading Font" value={state.theme.titleFont} onChange={(value) => updateTheme({ titleFont: value })} />
                  <ColorControl label="Title Text Color" value={state.theme.titleTextColor} onChange={(value) => updateTheme({ titleTextColor: value })} />
                  <SelectControl label="Dropdown Font" value={state.theme.dropdownFont} onChange={(value) => updateTheme({ dropdownFont: value })} />
                  <ColorControl label="Dropdown Text Color" value={state.theme.dropdownTextColor} onChange={(value) => updateTheme({ dropdownTextColor: value })} />
                  <SelectControl label="Menu Font" value={state.theme.menuFont} onChange={(value) => updateTheme({ menuFont: value })} />
                  <ColorControl label="Menu Text Color" value={state.theme.menuTextColor} onChange={(value) => updateTheme({ menuTextColor: value })} />
                  <SelectControl label="Streams Font" value={state.theme.streamsFont} onChange={(value) => updateTheme({ streamsFont: value })} />
                  <ColorControl label="Streams Menu Text Color" value={state.theme.streamsTextColor} onChange={(value) => updateTheme({ streamsTextColor: value })} />
                </div>
              )}

              {themeTab === "effects" && (
                <div className="control-grid">
                  <ToggleControl label="Glass Blur" enabled={state.theme.isGlassy} onToggle={() => updateTheme({ isGlassy: !state.theme.isGlassy })} />
                  <ToggleControl label="Transparency" enabled={state.theme.isTransparent} onToggle={() => updateTheme({ isTransparent: !state.theme.isTransparent })} />
                  <ToggleControl label="Card Glow" enabled={state.theme.isGlowEnabled} onToggle={() => updateTheme({ isGlowEnabled: !state.theme.isGlowEnabled })} />
                  {state.theme.isGlowEnabled && (
                    <>
                      <RangeControl label="Glow Intensity" value={state.theme.glowIntensity * 100} max={200} suffix="%" onChange={(value) => updateTheme({ glowIntensity: value / 100 })} />
                      <ColorControl label="Glow Color" value={state.theme.cardGlowColor} onChange={(value) => updateTheme({ cardGlowColor: value })} isRgba />
                    </>
                  )}
                  {state.theme.isGlassy && <RangeControl label="Blur Strength" value={state.theme.glassBlur} max={64} suffix="px" onChange={(value) => updateTheme({ glassBlur: value })} />}
                  {state.theme.isTransparent && <RangeControl label="Opacity Level" value={state.theme.glassOpacity * 100} max={100} suffix="%" onChange={(value) => updateTheme({ glassOpacity: value / 100 })} />}
                  <div className="preset-group">
                    <span>Presets</span>
                    <div className="preset-grid">
                      {effectPresets.map((preset) => (
                        <button key={preset.name} onClick={() => updateTheme(preset.settings)}>
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {themeTab === "branding" && (
                <div className="control-grid">
                  <div className="branding-subtabs" style={{ display: "flex", gap: "6px", gridColumn: "1 / -1", marginBottom: "8px" }}>
                    {(["contenthoard", "mediahoard", "audiohoard", "playhoard"] as const).map((app) => (
                      <button key={app} type="button" className={brandingTab === app ? "branding-subtab active" : "branding-subtab"}
                        onClick={() => setBrandingTab(app)} style={{ flex: 1, padding: "6px 8px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", borderRadius: "8px", border: "none", cursor: "pointer", background: brandingTab === app ? "var(--theme-accent)" : "rgba(255,255,255,0.08)", color: brandingTab === app ? "#000" : "var(--theme-text)" }}>
                        {app === "contenthoard" ? "ContentHoard" : app === "mediahoard" ? "MediaHoard" : app === "audiohoard" ? "AudioHoard" : "PlayHoard"}
                      </button>
                    ))}
                  </div>
                  {brandingTab === "contenthoard" && (
                    <>
                      <TextControl label="Header Text" value={state.theme.headerText} onChange={(value) => updateTheme({ headerText: value })} />
                      <TextControl label="Logo URL or Data URI" value={state.theme.logoUrl} onChange={(value) => updateTheme({ logoUrl: value })} />
                      <label className="field-label file-field">
                        <span>Logo Upload</span>
                        <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) readImageFile(file, (logoUrl) => updateTheme({ logoUrl })); }} />
                      </label>
                    </>
                  )}
                  {brandingTab === "mediahoard" && (
                    <>
                      <TextControl label="Header Text" value={state.theme.mediahoardHeaderText} onChange={(value) => updateTheme({ mediahoardHeaderText: value })} />
                      <TextControl label="Logo URL or Data URI" value={state.theme.mediahoardLogoUrl} onChange={(value) => updateTheme({ mediahoardLogoUrl: value })} />
                      <label className="field-label file-field">
                        <span>Logo Upload</span>
                        <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) readImageFile(file, (logoUrl) => updateTheme({ mediahoardLogoUrl: logoUrl })); }} />
                      </label>
                    </>
                  )}
                  {brandingTab === "audiohoard" && (
                    <>
                      <TextControl label="Header Text" value={state.theme.audiohoardHeaderText} onChange={(value) => updateTheme({ audiohoardHeaderText: value })} />
                      <TextControl label="Logo URL or Data URI" value={state.theme.audiohoardLogoUrl} onChange={(value) => updateTheme({ audiohoardLogoUrl: value })} />
                      <label className="field-label file-field">
                        <span>Logo Upload</span>
                        <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) readImageFile(file, (logoUrl) => updateTheme({ audiohoardLogoUrl: logoUrl })); }} />
                      </label>
                    </>
                  )}
                  {brandingTab === "playhoard" && (
                    <>
                      <TextControl label="Header Text" value={state.theme.playhoardHeaderText} onChange={(value) => updateTheme({ playhoardHeaderText: value })} />
                      <TextControl label="Logo URL or Data URI" value={state.theme.playhoardLogoUrl} onChange={(value) => updateTheme({ playhoardLogoUrl: value })} />
                      <label className="field-label file-field">
                        <span>Logo Upload</span>
                        <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) readImageFile(file, (logoUrl) => updateTheme({ playhoardLogoUrl: logoUrl })); }} />
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="theme-management">
              <div className="save-theme-row">
                <input value={newThemeName} onChange={(event) => setNewThemeName(event.target.value)} placeholder="Theme name..." />
                <button onClick={saveTheme} disabled={!newThemeName.trim()}><Save size={16} /> Save</button>
                {loadedThemeId && <button onClick={() => overwriteTheme(loadedThemeId)}><Check size={16} /> Update</button>}
              </div>
              <div className="load-theme-row">
                <button onClick={() => setIsLoadOpen(!isLoadOpen)}><FolderOpen size={16} /> Load Appearance</button>
                {isLoadOpen && (
                  <div className="load-theme-menu">
                    <button onClick={() => { resetTheme(); setIsLoadOpen(false); }}>Default Theme</button>
                    {state.savedThemes.map((item) => (
                      <div className="load-theme-item" key={item.id}>
                        <button
                          className={loadedThemeId === item.id ? "active" : ""}
                          onClick={() => {
                            loadTheme(item.settings);
                            setLoadedThemeId(item.id);
                            setNewThemeName(item.name);
                            setIsLoadOpen(false);
                          }}
                        >
                          {item.name}
                        </button>
                        <button onClick={() => persistState({ ...state, savedThemes: state.savedThemes.filter((theme) => theme.id !== item.id) })}><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="apply-all-btn" onClick={() => persistState(state)}><Share2 size={16} /> Apply to All</button>
            </div>
          </section>
        </section>
      )}

      {isProfileEditorOpen && (
        <div className="modal-shell">
          <button className="modal-backdrop" onClick={() => setIsProfileEditorOpen(false)} aria-label="Close profile editor" />
          <section className="profile-modal">
            <button className="modal-close" onClick={() => setIsProfileEditorOpen(false)}><X size={18} /></button>
            <div className="profile-modal-title">
              <h2>{editingProfile ? "Edit Profile" : "New Profile"}</h2>
              <p>Customize your environment.</p>
            </div>
            <button className="profile-preview" onClick={() => setIsIconPickerOpen(true)}>
              <ProfileAvatar profile={{ ...profileDraft, id: "", createdAt: 0 }} />
              <span><span className="material-icon">photo_camera</span></span>
            </button>
            <div className="swatches">
              {profileColors.map((color) => (
                <button key={color} className={profileDraft.color === color ? "picked" : ""} style={{ background: color }} onClick={() => setProfileDraft({ ...profileDraft, color })} />
              ))}
              <input type="color" value={profileDraft.color} onChange={(event) => setProfileDraft({ ...profileDraft, color: event.target.value })} />
            </div>
            <label className="field-label">
              <span>Profile Name</span>
              <input value={profileDraft.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} placeholder="New Profile" />
            </label>
            <div className="modal-actions">
              {editingProfile && <button className="danger" onClick={() => { deleteProfile(editingProfile.id); setIsProfileEditorOpen(false); }}><Trash2 size={16} /></button>}
              <button onClick={() => setIsProfileEditorOpen(false)}>Cancel</button>
              <button className="primary" onClick={saveProfile}>{editingProfile ? "Save Changes" : "Create Profile"}</button>
            </div>
          </section>
        </div>
      )}

      {isIconPickerOpen && (
        <div className="modal-shell">
          <button className="modal-backdrop" onClick={() => setIsIconPickerOpen(false)} aria-label="Close avatar picker" />
          <section className="icon-modal">
            <div className="profile-modal-title">
              <h2>Profile Avatar</h2>
              <p>Source selection</p>
            </div>
            <div className="icon-section">
              <span>Built-in Icons</span>
              <div className="icon-grid">
                {profileIcons.map((icon) => (
                  <button key={icon} className={profileDraft.icon === icon ? "picked" : ""} onClick={() => { setProfileDraft({ ...profileDraft, icon }); setIsIconPickerOpen(false); }}>
                    <span className="material-icon">{icon}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="icon-source">
              <span className="material-icon">upload</span>
              <span><strong>Upload from Device</strong><small>Local file</small></span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) readImageFile(file, (icon) => {
                    setProfileDraft({ ...profileDraft, icon });
                    setIsIconPickerOpen(false);
                  });
                }}
              />
            </label>
            <div className="icon-url-option">
              <div className="icon-source static">
                <span className="material-icon">link</span>
                <span><strong>Direct Image URL</strong><small>Remote link</small></span>
              </div>
              <div>
                <input value={isImageIcon(profileDraft.icon) ? profileDraft.icon : ""} onChange={(event) => setProfileDraft({ ...profileDraft, icon: event.target.value })} placeholder="https://..." />
                <button onClick={() => setIsIconPickerOpen(false)}>Set</button>
              </div>
            </div>
            {profileDraft.icon && (
              <button className="icon-default" onClick={() => { setProfileDraft({ ...profileDraft, icon: "" }); setIsIconPickerOpen(false); }}>
                <span className="material-icon">close</span>
                <span><strong>Use Default</strong><small>Clear custom icon</small></span>
              </button>
            )}
            <button className="icon-close" onClick={() => setIsIconPickerOpen(false)}>Close</button>
          </section>
        </div>
      )}
    </main>
  );
}

function rgbaToHex(rgba: string): string {
  const match = rgba.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) return "#ffffff";
  const r = Math.min(255, Math.max(0, parseInt(match[1]))).toString(16).padStart(2, "0");
  const g = Math.min(255, Math.max(0, parseInt(match[2]))).toString(16).padStart(2, "0");
  const b = Math.min(255, Math.max(0, parseInt(match[3]))).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function parseAlpha(value: string): number {
  if (value.startsWith("#")) return 1;
  const match = value.match(/rgba?\s*\(.*,\s*([\d.]+)\s*\)/);
  if (match) return Math.max(0, Math.min(1, parseFloat(match[1])));
  return 1;
}

function ColorControl({ label, value, onChange, isRgba = false }: { label: string; value: string; onChange: (value: string) => void; isRgba?: boolean }) {
  const displayHex = value.startsWith("#") ? value : rgbaToHex(value);
  const alpha = parseAlpha(value);

  const handleColorChange = (hex: string) => {
    if (!isRgba) { onChange(hex); return; }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    onChange(`rgba(${r}, ${g}, ${b}, ${alpha})`);
  };

  const handleAlphaChange = (newAlpha: number) => {
    if (!isRgba) return;
    const r = parseInt(displayHex.slice(1, 3), 16);
    const g = parseInt(displayHex.slice(3, 5), 16);
    const b = parseInt(displayHex.slice(5, 7), 16);
    onChange(`rgba(${r}, ${g}, ${b}, ${newAlpha})`);
  };

  return (
    <label className="field-label">
      <span>{label}</span>
      <div style={{ display: "flex", gap: "6px", alignItems: "center", width: "100%" }}>
        <div style={{ position: "relative", width: "32px", height: "32px", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", flexShrink: 0 }}>
          <input type="color" value={displayHex} onChange={(e) => handleColorChange(e.target.value)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer", opacity: 0 }} />
          <div style={{ width: "100%", height: "100%", backgroundColor: value, pointerEvents: "none" }} />
        </div>
        {isRgba && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
            <input type="range" min="0" max="1" step="0.01" value={alpha}
              onChange={(e) => handleAlphaChange(parseFloat(e.target.value))}
              style={{ flex: 1, height: "4px", accentColor: "var(--theme-accent)" }} />
            <span style={{ fontSize: "10px", opacity: 0.6, minWidth: "32px", textAlign: "right" }}>{Math.round(alpha * 100)}%</span>
          </div>
        )}
      </div>
    </label>
  );
}

function TextControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {fontOptions.map((font) => <option key={font.name} value={font.value}>{font.name}</option>)}
      </select>
    </label>
  );
}

function RangeControl({ label, value, max, suffix, onChange }: { label: string; value: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <label className="field-label">
      <span>{label} <small>{Math.round(value)}{suffix}</small></span>
      <input type="range" min="0" max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ToggleControl({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <button className={`toggle ${enabled ? "enabled" : ""}`} onClick={onToggle}>
      <span>{label}</span>
      <i />
    </button>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
