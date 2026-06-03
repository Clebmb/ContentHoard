import { useCallback, useContext, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import "./settings-appearance.scss";
import appIconUrl from "@renderer/assets/icon.png";
import { ThemeActions, ThemeCard, ThemePlaceholder } from "./index";
import type { Theme } from "@types";
import { ImportThemeModal } from "./modals/import-theme-modal";
import { settingsContext } from "@renderer/context";
import { useNavigate } from "react-router-dom";
import { levelDBService } from "@renderer/services/leveldb.service";
import {
  Check,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import {
  defaultPlayhoardTheme,
  deletePlayhoardThemePreset,
  getPlayhoardThemeSettings,
  getSavedPlayhoardThemes,
  overwritePlayhoardThemePreset,
  PLAYHOARD_PROFILE_SWITCHED_EVENT,
  PLAYHOARD_CONTENTHOARD_STATE_UPDATED_EVENT,
  savePlayhoardThemePreset,
  savePlayhoardThemeSettings,
} from "@renderer/helpers";
import type {
  PlayhoardThemeSettings,
  SavedPlayhoardTheme,
} from "@renderer/helpers";

interface SettingsAppearanceProps {
  appearance: {
    theme: string | null;
    authorId: string | null;
    authorName: string | null;
  };
}

const playhoardIconUrl = `${appIconUrl}${appIconUrl.includes("?") ? "&" : "?"}v=phicon`;

export function SettingsAppearance({
  appearance,
}: Readonly<SettingsAppearanceProps>) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [isImportThemeModalVisible, setIsImportThemeModalVisible] =
    useState(false);
  const [importTheme, setImportTheme] = useState<{
    theme: string;
    authorId: string;
    authorName: string;
  } | null>(null);
  const [hasShownModal, setHasShownModal] = useState(false);
  const [activeCustomizationTab, setActiveCustomizationTab] = useState<
    "colors" | "fonts" | "effects" | "branding"
  >("colors");
  const [brandingTab, setBrandingTab] = useState<
    "contenthoard" | "mediahoard" | "audiohoard" | "playhoard"
  >("contenthoard");
  const [liveTheme, setLiveTheme] = useState<PlayhoardThemeSettings>(
    defaultPlayhoardTheme
  );
  const [savedPlayhoardThemes, setSavedPlayhoardThemes] = useState<
    SavedPlayhoardTheme[]
  >([]);
  const [newThemeName, setNewThemeName] = useState("");
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  const [loadedThemeId, setLoadedThemeId] = useState<string | null>(null);

  const { clearTheme } = useContext(settingsContext);
  const navigate = useNavigate();

  const loadThemes = useCallback(async () => {
    const themesList = (await levelDBService.values("themes")) as Theme[];
    setThemes(themesList);
  }, []);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  useEffect(() => {
    const loadLiveTheme = () => {
      setLiveTheme(getPlayhoardThemeSettings());
      setSavedPlayhoardThemes(getSavedPlayhoardThemes());
    };

    loadLiveTheme();
    window.addEventListener(PLAYHOARD_PROFILE_SWITCHED_EVENT, loadLiveTheme);
    window.addEventListener(PLAYHOARD_CONTENTHOARD_STATE_UPDATED_EVENT, loadLiveTheme);

    return () => {
      window.removeEventListener(
        PLAYHOARD_PROFILE_SWITCHED_EVENT,
        loadLiveTheme
      );
      window.removeEventListener(
        PLAYHOARD_CONTENTHOARD_STATE_UPDATED_EVENT,
        loadLiveTheme
      );
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.electron.onCustomThemeUpdated(() => {
      loadThemes();
    });

    return () => unsubscribe();
  }, [loadThemes]);

  useEffect(() => {
    if (
      appearance.theme &&
      appearance.authorId &&
      appearance.authorName &&
      !hasShownModal
    ) {
      setIsImportThemeModalVisible(true);
      setImportTheme({
        theme: appearance.theme,
        authorId: appearance.authorId,
        authorName: appearance.authorName,
      });
      setHasShownModal(true);

      navigate("/settings", { replace: true });
      clearTheme();
    }
  }, [
    appearance.theme,
    appearance.authorId,
    appearance.authorName,
    navigate,
    hasShownModal,
    clearTheme,
  ]);

  const onThemeImported = useCallback(() => {
    setIsImportThemeModalVisible(false);
    setImportTheme(null);
    loadThemes();
  }, [loadThemes]);

  const updateLiveTheme = useCallback(
    (updates: Partial<PlayhoardThemeSettings>) => {
      setLiveTheme((currentTheme) => {
        const nextTheme = { ...currentTheme, ...updates };
        savePlayhoardThemeSettings(nextTheme);
        return nextTheme;
      });
    },
    []
  );

  const resetLiveTheme = useCallback(() => {
    setLiveTheme(defaultPlayhoardTheme);
    savePlayhoardThemeSettings(defaultPlayhoardTheme);
    setLoadedThemeId(null);
    setNewThemeName("");
  }, []);

  const handleSaveLiveTheme = useCallback(() => {
    if (!newThemeName.trim()) return;
    const nextThemes = savePlayhoardThemePreset(newThemeName.trim(), liveTheme);
    setSavedPlayhoardThemes(nextThemes);
    setLoadedThemeId(nextThemes.at(-1)?.id ?? null);
    setNewThemeName("");
  }, [liveTheme, newThemeName]);

  const handleUpdateLiveTheme = useCallback(() => {
    if (!loadedThemeId) return;
    setSavedPlayhoardThemes(
      overwritePlayhoardThemePreset(
        loadedThemeId,
        newThemeName.trim() || "Custom Theme",
        liveTheme
      )
    );
  }, [liveTheme, loadedThemeId, newThemeName]);

  const handleDeleteLiveTheme = useCallback((id: string) => {
    setSavedPlayhoardThemes(deletePlayhoardThemePreset(id));
    if (loadedThemeId === id) {
      setLoadedThemeId(null);
      setNewThemeName("");
    }
  }, [loadedThemeId]);

  const handleLoadLiveTheme = useCallback((theme: SavedPlayhoardTheme) => {
    setLiveTheme(theme.settings);
    savePlayhoardThemeSettings(theme.settings);
    setLoadedThemeId(theme.id);
    setNewThemeName(theme.name);
    setIsLoadOpen(false);
  }, []);

  const handleLogoUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const key = brandingTab === "contenthoard" ? "logoUrl" : `${brandingTab}LogoUrl` as keyof PlayhoardThemeSettings;
        updateLiveTheme({ [key]: readerEvent.target?.result as string } as any);
      };
      reader.readAsDataURL(file);
    },
    [updateLiveTheme, brandingTab]
  );

  return (
    <div className="settings-appearance">
      <header className="settings-appearance__hero">
        <div className="settings-appearance__hero-icon">
          <Palette size={30} />
        </div>

        <div className="settings-appearance__hero-copy">
          <h3>Theming Engine</h3>
          <p>
            Customize PlayHoard with glassy interface themes, imported presets,
            editor-made CSS, and achievement sounds.
          </p>
        </div>

        <div className="settings-appearance__hero-chip">
          <Sparkles size={15} />
          {themes.length} {themes.length === 1 ? "theme" : "themes"}
        </div>
      </header>

      <section className="settings-appearance__customizer">
        <div className="settings-appearance__customizer-header">
          <div>
            <span>Customization</span>
            <h3>Theme Editor</h3>
          </div>

          <div className="settings-appearance__customizer-actions">
            <button type="button" onClick={resetLiveTheme} title="Reset">
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              onClick={() => setIsLoadOpen((isOpen) => !isOpen)}
              title="Load appearance"
            >
              <FolderOpen size={17} />
            </button>
          </div>
        </div>

        <div className="settings-appearance__customizer-tabs">
          {[
            { id: "colors", icon: Palette, label: "Colors" },
            { id: "fonts", icon: Type, label: "Typography" },
            { id: "effects", icon: Layers, label: "Effects" },
            { id: "branding", icon: ImageIcon, label: "Branding" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={
                activeCustomizationTab === tab.id
                  ? "settings-appearance__customizer-tab settings-appearance__customizer-tab--active"
                  : "settings-appearance__customizer-tab"
              }
              onClick={() =>
                setActiveCustomizationTab(
                  tab.id as "colors" | "fonts" | "effects" | "branding"
                )
              }
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="settings-appearance__customizer-body">
          {activeCustomizationTab === "colors" && (
            <div className="settings-appearance__control-grid">
              <ColorPicker
                label="Background Color"
                value={liveTheme.backgroundColor}
                onChange={(value) => updateLiveTheme({ backgroundColor: value })}
                isRgba
              />
              <ColorPicker
                label="Accent Color"
                value={liveTheme.accentColor}
                onChange={(value) => updateLiveTheme({ accentColor: value })}
              />
              <ColorPicker
                label="Navigation Background"
                value={liveTheme.navBackgroundColor}
                onChange={(value) =>
                  updateLiveTheme({ navBackgroundColor: value })
                }
                isRgba
              />
              <ColorPicker
                label="Top Bar Background"
                value={liveTheme.headerBackgroundColor}
                onChange={(value) =>
                  updateLiveTheme({ headerBackgroundColor: value })
                }
                isRgba
              />
              <ColorPicker
                label="Dropdown Background"
                value={liveTheme.dropdownBackgroundColor}
                onChange={(value) =>
                  updateLiveTheme({ dropdownBackgroundColor: value })
                }
                isRgba
              />
              <ColorPicker
                label="Menu Background"
                value={liveTheme.menuBackgroundColor}
                onChange={(value) =>
                  updateLiveTheme({ menuBackgroundColor: value })
                }
                isRgba
              />
              <ColorPicker
                label="Streams Menu Background"
                value={liveTheme.streamsBackgroundColor}
                onChange={(value) =>
                  updateLiveTheme({ streamsBackgroundColor: value })
                }
                isRgba
              />
            </div>
          )}

          {activeCustomizationTab === "fonts" && (
            <div className="settings-appearance__control-grid">
              <ColorPicker
                label="General Text Color"
                value={liveTheme.textColor}
                onChange={(value) => updateLiveTheme({ textColor: value })}
              />
              <FontPicker
                label="Logo/Header Font"
                value={liveTheme.headerFont}
                onChange={(value) => updateLiveTheme({ headerFont: value })}
              />
              <ColorPicker
                label="Header Text Color"
                value={liveTheme.headerTextColor}
                onChange={(value) =>
                  updateLiveTheme({ headerTextColor: value })
                }
              />
              <FontPicker
                label="Navigation Font"
                value={liveTheme.navFont}
                onChange={(value) => updateLiveTheme({ navFont: value })}
              />
              <ColorPicker
                label="Nav Text (Normal)"
                value={liveTheme.navTextColorUnselected}
                onChange={(value) =>
                  updateLiveTheme({ navTextColorUnselected: value })
                }
                isRgba
              />
              <ColorPicker
                label="Nav Text (Selected)"
                value={liveTheme.navTextColorSelected}
                onChange={(value) =>
                  updateLiveTheme({ navTextColorSelected: value })
                }
              />
              <FontPicker
                label="Title/Heading Font"
                value={liveTheme.titleFont}
                onChange={(value) => updateLiveTheme({ titleFont: value })}
              />
              <ColorPicker
                label="Title Text Color"
                value={liveTheme.titleTextColor}
                onChange={(value) =>
                  updateLiveTheme({ titleTextColor: value })
                }
              />
              <FontPicker
                label="Dropdown Font"
                value={liveTheme.dropdownFont}
                onChange={(value) => updateLiveTheme({ dropdownFont: value })}
              />
              <ColorPicker
                label="Dropdown Text Color"
                value={liveTheme.dropdownTextColor}
                onChange={(value) =>
                  updateLiveTheme({ dropdownTextColor: value })
                }
              />
              <FontPicker
                label="Menu Font"
                value={liveTheme.menuFont}
                onChange={(value) => updateLiveTheme({ menuFont: value })}
              />
              <ColorPicker
                label="Menu Text Color"
                value={liveTheme.menuTextColor}
                onChange={(value) =>
                  updateLiveTheme({ menuTextColor: value })
                }
              />
              <FontPicker
                label="Streams Menu Font"
                value={liveTheme.streamsFont}
                onChange={(value) => updateLiveTheme({ streamsFont: value })}
              />
              <ColorPicker
                label="Streams Menu Text Color"
                value={liveTheme.streamsTextColor}
                onChange={(value) =>
                  updateLiveTheme({ streamsTextColor: value })
                }
              />
            </div>
          )}

          {activeCustomizationTab === "effects" && (
            <div className="settings-appearance__effects">
              <div className="settings-appearance__toggle-grid">
                <ToggleTile
                  label="Glass Blur"
                  value={liveTheme.isGlassy}
                  onChange={() =>
                    updateLiveTheme({ isGlassy: !liveTheme.isGlassy })
                  }
                />
                <ToggleTile
                  label="Transparency"
                  value={liveTheme.isTransparent}
                  onChange={() =>
                    updateLiveTheme({ isTransparent: !liveTheme.isTransparent })
                  }
                />
                <ToggleTile
                  label="Card Glow"
                  value={liveTheme.isGlowEnabled}
                  onChange={() =>
                    updateLiveTheme({ isGlowEnabled: !liveTheme.isGlowEnabled })
                  }
                />
              </div>

              {liveTheme.isGlowEnabled && (
                <>
                  <SliderSetting
                    label="Glow Intensity"
                    value={Math.round(liveTheme.glowIntensity * 100)}
                    max={200}
                    suffix="%"
                    onChange={(value) =>
                      updateLiveTheme({ glowIntensity: value / 100 })
                    }
                  />
                  <ColorPicker
                    label="Glow Color"
                    value={liveTheme.cardGlowColor}
                    onChange={(value) => updateLiveTheme({ cardGlowColor: value })}
                    isRgba
                  />
                </>
              )}
              {liveTheme.isGlassy && (
                <SliderSetting
                  label="Blur Strength"
                  value={liveTheme.glassBlur}
                  max={64}
                  suffix="px"
                  onChange={(value) => updateLiveTheme({ glassBlur: value })}
                />
              )}
              {liveTheme.isTransparent && (
                <SliderSetting
                  label="Opacity Level"
                  value={Math.round(liveTheme.glassOpacity * 100)}
                  max={100}
                  suffix="%"
                  onChange={(value) =>
                    updateLiveTheme({ glassOpacity: value / 100 })
                  }
                />
              )}

              <div className="settings-appearance__preset-grid">
                <button
                  type="button"
                  onClick={() =>
                    updateLiveTheme({
                      isGlassy: true,
                      isTransparent: true,
                      glassBlur: 24,
                      glassOpacity: 0.1,
                    })
                  }
                >
                  Cinematic Glass
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateLiveTheme({
                      isGlassy: false,
                      isTransparent: true,
                      glassOpacity: 0.2,
                    })
                  }
                >
                  Clear Ghost
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateLiveTheme({ isGlassy: false, isTransparent: false })
                  }
                >
                  Solid Opaque
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateLiveTheme({
                      isGlassy: true,
                      isTransparent: true,
                      glassBlur: 64,
                      glassOpacity: 0.05,
                    })
                  }
                >
                  High Frost
                </button>
              </div>
            </div>
          )}

          {activeCustomizationTab === "branding" && (
            <div className="settings-appearance__branding">
              <div className="settings-appearance__branding-subtabs">
                {(["contenthoard", "mediahoard", "audiohoard", "playhoard"] as const).map((app) => (
                  <button
                    key={app}
                    type="button"
                    className={
                      brandingTab === app
                        ? "settings-appearance__branding-subtab settings-appearance__branding-subtab--active"
                        : "settings-appearance__branding-subtab"
                    }
                    onClick={() => setBrandingTab(app)}
                  >
                    {app === "contenthoard" ? "ContentHoard" : app === "mediahoard" ? "MediaHoard" : app === "audiohoard" ? "AudioHoard" : "PlayHoard"}
                  </button>
                ))}
              </div>
              {(function() {
                const prefix = brandingTab === "contenthoard" ? "" : brandingTab;
                const headerKey = prefix ? `${prefix}HeaderText` : "headerText";
                const logoKey = prefix ? `${prefix}LogoUrl` : "logoUrl";
                const logoUrl = headerKey === "headerText" ? liveTheme.logoUrl : (liveTheme as any)[logoKey];
                const headerText = (liveTheme as any)[headerKey] || (brandingTab.charAt(0).toUpperCase() + brandingTab.slice(1));

                return (
                  <>
                    <label>
                      <span>Header Text</span>
                      <input
                        type="text"
                        value={headerText}
                        onChange={(event) =>
                          updateLiveTheme({ [headerKey]: event.target.value } as any)
                        }
                      />
                    </label>
                    <div className="settings-appearance__logo-preview">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo preview" />
                      ) : (
                        <img src={playhoardIconUrl} alt="Logo preview" />
                      )}
                    </div>
                    <div className="settings-appearance__logo-row">
                      <input
                        type="text"
                        value={logoUrl && logoUrl.startsWith("data:") ? "" : logoUrl || ""}
                        placeholder="Logo URL..."
                        onChange={(event) =>
                          updateLiveTheme({ [logoKey]: event.target.value } as any)
                        }
                      />
                      <label>
                        <Upload size={16} />
                        <input type="file" accept="image/*" onChange={handleLogoUpload} />
                      </label>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <div className="settings-appearance__theme-management">
          <div className="settings-appearance__save-row">
            <input
              type="text"
              value={newThemeName}
              placeholder="Theme name..."
              onChange={(event) => setNewThemeName(event.target.value)}
            />
            <button
              type="button"
              onClick={handleSaveLiveTheme}
              disabled={!newThemeName.trim()}
            >
              <Save size={15} />
              Save
            </button>
            {loadedThemeId && (
              <button type="button" onClick={handleUpdateLiveTheme}>
                <Check size={15} />
                Update
              </button>
            )}
          </div>

          <div className="settings-appearance__load-row">
            <button
              type="button"
              onClick={() => setIsLoadOpen((isOpen) => !isOpen)}
            >
              <FolderOpen size={15} />
              Load Appearance
            </button>
            {isLoadOpen && (
              <div className="settings-appearance__saved-themes">
                <button
                  type="button"
                  onClick={() => {
                    resetLiveTheme();
                    setIsLoadOpen(false);
                  }}
                >
                  Default Theme
                </button>

                {savedPlayhoardThemes.map((theme) => (
                  <div key={theme.id}>
                    <button type="button" onClick={() => handleLoadLiveTheme(theme)}>
                      <Check size={14} />
                      {theme.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLiveTheme(theme.id)}
                      title="Delete theme"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <ThemeActions onListUpdated={loadThemes} themesCount={themes.length} />

      <div className="settings-appearance__themes">
        {!themes.length ? (
          <ThemePlaceholder onListUpdated={loadThemes} />
        ) : (
          [...themes]
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            )
            .map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                onListUpdated={loadThemes}
              />
            ))
        )}
      </div>

      {importTheme && (
        <ImportThemeModal
          visible={isImportThemeModalVisible}
          onClose={() => {
            setIsImportThemeModalVisible(false);
            clearTheme();
            setHasShownModal(false);
          }}
          onThemeImported={onThemeImported}
          themeName={importTheme.theme}
          authorId={importTheme.authorId}
          authorName={importTheme.authorName}
        />
      )}
    </div>
  );
}

const fontOptions = [
  { name: "Space Grotesk", value: "Space Grotesk, Noto Sans, sans-serif" },
  { name: "Noto Sans", value: "Noto Sans, sans-serif" },
  { name: "Ubuntu Mono", value: "Ubuntu Mono, monospace" },
  { name: "Inter", value: "Inter, Space Grotesk, sans-serif" },
  { name: "Outfit", value: "Outfit, Space Grotesk, sans-serif" },
  { name: "Roboto Mono", value: "Roboto Mono, monospace" },
];

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

function ColorPicker({
  label,
  value,
  onChange,
  isRgba = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isRgba?: boolean;
}) {
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
    const r = parseInt(displayHex.slice(1, 3), 16);
    const g = parseInt(displayHex.slice(3, 5), 16);
    const b = parseInt(displayHex.slice(5, 7), 16);
    onChange(`rgba(${r}, ${g}, ${b}, ${newAlpha})`);
  };

  return (
    <div className="settings-appearance__color-picker">
      <div>
        <span>{label}</span>
        <small>{value}</small>
      </div>
      <div className="settings-appearance__color-picker-controls">
        <label style={{ backgroundColor: value }}>
          <input
            type="color"
            value={displayHex}
            onChange={(event) => handleColorChange(event.target.value)}
          />
        </label>
        {isRgba && (
          <div className="settings-appearance__alpha-control">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={alpha}
              onChange={(e) => handleAlphaChange(parseFloat(e.target.value))}
            />
            <small>{Math.round(alpha * 100)}%</small>
          </div>
        )}
      </div>
    </div>
  );
}

function TextValueControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-appearance__text-value">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ToggleTile({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      className={
        value
          ? "settings-appearance__toggle-tile settings-appearance__toggle-tile--active"
          : "settings-appearance__toggle-tile"
      }
      onClick={onChange}
    >
      <span>{label}</span>
      <div>
        <i />
      </div>
    </button>
  );
}

function SliderSetting({
  label,
  value,
  max,
  onChange,
  suffix = "",
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div className="settings-appearance__slider">
      <div>
        <span>{label}</span>
        <small>
          {value}
          {suffix}
        </small>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function FontPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="settings-appearance__font-picker">
      <span>{label}</span>
      <div>
        {fontOptions.map((font) => (
          <button
            key={font.name}
            type="button"
            className={
              value === font.value
                ? "settings-appearance__font-button settings-appearance__font-button--active"
                : "settings-appearance__font-button"
            }
            style={{ fontFamily: font.value }}
            onClick={() => onChange(font.value)}
          >
            <strong>{font.name}</strong>
            <small>Abc 123</small>
          </button>
        ))}
      </div>
    </div>
  );
}
