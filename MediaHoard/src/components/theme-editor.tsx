"use client";

import React, { useState } from "react";
import { useTheme, ThemeSettings } from "@/providers/ThemeProvider";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  RotateCcw, 
  Palette, 
  Layers, 
  Type, 
  Image as ImageIcon,
  Check,
  Upload,
  Save,
  FolderOpen,
  Trash2
} from "lucide-react";

type ThemeEditorProps = {
  isOpen: boolean;
  onClose: () => void;
};

const fontOptions = [
  { name: "Spline Sans", value: "var(--font-spline-sans)" },
  { name: "Inter", value: "var(--font-inter)" },
  { name: "Outfit", value: "var(--font-outfit)" },
  { name: "Playfair Display", value: "var(--font-playfair)" },
  { name: "Ubuntu Mono", value: "var(--font-ubuntu-mono)" },
  { name: "Roboto Mono", value: "var(--font-roboto-mono)" },
];

export function ThemeEditor({ isOpen, onClose }: ThemeEditorProps) {
  const { theme, updateTheme, resetTheme, savedThemes, saveTheme, loadTheme, deleteSavedTheme, overwriteSavedTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"colors" | "fonts" | "effects" | "branding">("colors");
  const [newThemeName, setNewThemeName] = useState("");
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  const [loadedThemeId, setLoadedThemeId] = useState<string | null>(null);

  const handleColorChange = (key: keyof ThemeSettings, value: string) => {
    updateTheme({ [key]: value });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updateTheme({ logoUrl: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 md:p-8 pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          className="w-full max-w-md h-[90vh] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden pointer-events-auto"
          style={{
            backgroundColor: theme.menuBackgroundColor,
            color: theme.menuTextColor,
            fontFamily: theme.menuFont
          }}
        >
          {/* Header */}
          <div className="px-8 py-6 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold leading-tight">Theme Editor</h2>
                <p className="opacity-40 text-[10px] font-bold uppercase tracking-widest">Customization</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={resetTheme}
                className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all"
                title="Reset to Default"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-all bg-white/5"
                title="Confirm and Close"
              >
                <Check className="w-5 h-5" />
              </button>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex px-4 py-1.5 gap-1 border-b border-white/5">
            {[
              { id: "colors", icon: Palette, label: "Colors" },
              { id: "fonts", icon: Type, label: "Typography" },
              { id: "effects", icon: Layers, label: "Effects" },
              { id: "branding", icon: ImageIcon, label: "Branding" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${activeTab === tab.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-tight">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
            {activeTab === "colors" && (
              <div className="space-y-3">
                <ColorPicker 
                  label="Background Color" 
                  value={theme.backgroundColor} 
                  onChange={(v) => handleColorChange("backgroundColor", v)} 
                />
                <ColorPicker 
                  label="Accent Color" 
                  value={theme.accentColor} 
                  onChange={(v) => handleColorChange("accentColor", v)} 
                />
                <ColorPicker 
                  label="Navigation Background" 
                  value={theme.navBackgroundColor} 
                  onChange={(v) => handleColorChange("navBackgroundColor", v)} 
                  isRgba
                />
                <ColorPicker 
                  label="Top Bar Background" 
                  value={theme.headerBackgroundColor} 
                  onChange={(v) => handleColorChange("headerBackgroundColor", v)} 
                  isRgba
                />
                <ColorPicker 
                  label="Dropdown Background" 
                  value={theme.dropdownBackgroundColor} 
                  onChange={(v) => handleColorChange("dropdownBackgroundColor", v)} 
                  isRgba
                />
                <ColorPicker 
                  label="Menu Background" 
                  value={theme.menuBackgroundColor} 
                  onChange={(v) => handleColorChange("menuBackgroundColor", v)} 
                  isRgba
                />
                <ColorPicker 
                  label="Streams Menu Background" 
                  value={theme.streamsBackgroundColor} 
                  onChange={(v) => handleColorChange("streamsBackgroundColor", v)} 
                  isRgba
                />
              </div>
            )}

            {activeTab === "effects" && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => updateTheme({ isGlassy: !theme.isGlassy })}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${theme.isGlassy ? 'bg-white text-black border-white' : 'bg-white/5 text-white/40 border-white/10'}`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-tight">Glass Blur</span>
                    <div className={`w-6 h-3 rounded-full relative transition-all ${theme.isGlassy ? 'bg-black/20' : 'bg-white/10'}`}>
                       <div className={`absolute top-0.5 bottom-0.5 w-2 rounded-full transition-all ${theme.isGlassy ? 'right-0.5 bg-black' : 'left-0.5 bg-white/40'}`} />
                    </div>
                  </button>
                  <button 
                    onClick={() => updateTheme({ isTransparent: !theme.isTransparent })}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${theme.isTransparent ? 'bg-white text-black border-white' : 'bg-white/5 text-white/40 border-white/10'}`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-tight">Transparency</span>
                    <div className={`w-6 h-3 rounded-full relative transition-all ${theme.isTransparent ? 'bg-black/20' : 'bg-white/10'}`}>
                       <div className={`absolute top-0.5 bottom-0.5 w-2 rounded-full transition-all ${theme.isTransparent ? 'right-0.5 bg-black' : 'left-0.5 bg-white/40'}`} />
                    </div>
                  </button>
                  <button 
                    onClick={() => updateTheme({ isGlowEnabled: !theme.isGlowEnabled })}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${theme.isGlowEnabled ? 'bg-white text-black border-white' : 'bg-white/5 text-white/40 border-white/10'}`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-tight">Card Glow</span>
                    <div className={`w-6 h-3 rounded-full relative transition-all ${theme.isGlowEnabled ? 'bg-black/20' : 'bg-white/10'}`}>
                       <div className={`absolute top-0.5 bottom-0.5 w-2 rounded-full transition-all ${theme.isGlowEnabled ? 'right-0.5 bg-black' : 'left-0.5 bg-white/40'}`} />
                    </div>
                  </button>
                </div>

                {theme.isGlowEnabled && (
                  <div className="space-y-4">
                    <Slider 
                      label="Glow Intensity" 
                      value={theme.glowIntensity * 100} 
                      max={200} 
                      onChange={(v) => updateTheme({ glowIntensity: v / 100 })} 
                      suffix="%"
                    />
                    <ColorPicker 
                      label="Glow Color" 
                      value={theme.cardGlowColor} 
                      onChange={(v) => handleColorChange("cardGlowColor", v)} 
                      isRgba
                    />
                  </div>
                )}
                {theme.isGlassy && (
                  <Slider 
                    label="Blur Strength" 
                    value={theme.glassBlur} 
                    max={64} 
                    onChange={(v) => updateTheme({ glassBlur: v })} 
                    suffix="px"
                  />
                )}
                {theme.isTransparent && (
                  <Slider 
                    label="Opacity Level" 
                    value={theme.glassOpacity * 100} 
                    max={100} 
                    onChange={(v) => updateTheme({ glassOpacity: v / 100 })} 
                    suffix="%"
                  />
                )}
                
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                   <h3 className="text-[9px] font-bold text-white/60 uppercase tracking-tight">Presets</h3>
                   <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => updateTheme({ isGlassy: true, isTransparent: true, glassBlur: 24, glassOpacity: 0.1 })}
                        className="py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white transition-all"
                      >
                        Cinematic Glass
                      </button>
                      <button 
                        onClick={() => updateTheme({ isGlassy: false, isTransparent: true, glassOpacity: 0.2 })}
                        className="py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white transition-all"
                      >
                        Clear Ghost
                      </button>
                      <button 
                        onClick={() => updateTheme({ isGlassy: false, isTransparent: false })}
                        className="py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white transition-all"
                      >
                        Solid Opaque
                      </button>
                      <button 
                        onClick={() => updateTheme({ isGlassy: true, isTransparent: true, glassBlur: 64, glassOpacity: 0.05 })}
                        className="py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white transition-all"
                      >
                        High Frost
                      </button>
                   </div>
                </div>
              </div>
            )}

            {activeTab === "branding" && (
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-tight px-1">Header Text</label>
                  <input 
                    type="text"
                    value={theme.headerText}
                    onChange={(e) => updateTheme({ headerText: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-white/30 transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-tight px-1">Custom Logo</label>
                  <div className="flex flex-col gap-3">
                    <div className="w-full aspect-video rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden p-6">
                      {theme.logoUrl && <img src={theme.logoUrl} className="max-h-full object-contain" alt="Logo preview" />}
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input 
                          type="text"
                          placeholder="Logo URL..."
                          value={theme.logoUrl.startsWith('data:') ? '' : theme.logoUrl}
                          onChange={(e) => updateTheme({ logoUrl: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none focus:border-white/30"
                        />
                      </div>
                      <label className="p-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white cursor-pointer transition-all">
                        <Upload className="w-4 h-4" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "fonts" && (
              <div className="space-y-5">
                <ColorPicker 
                  label="General Text Color" 
                  value={theme.textColor} 
                  onChange={(v) => handleColorChange("textColor", v)} 
                />

                <div className="space-y-3">
                  <FontPicker 
                    label="Logo/Header Font" 
                    value={theme.headerFont} 
                    onChange={(v) => updateTheme({ headerFont: v })} 
                  />
                  <ColorPicker 
                    label="Header Text Color" 
                    value={theme.headerTextColor} 
                    onChange={(v) => handleColorChange("headerTextColor", v)} 
                  />
                </div>

                <div className="space-y-3">
                  <FontPicker 
                    label="Navigation Font" 
                    value={theme.navFont} 
                    onChange={(v) => updateTheme({ navFont: v })} 
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <ColorPicker 
                      label="Nav Text (Normal)" 
                      value={theme.navTextColorUnselected} 
                      onChange={(v) => handleColorChange("navTextColorUnselected", v)} 
                      isRgba
                    />
                    <ColorPicker 
                      label="Nav Text (Selected)" 
                      value={theme.navTextColorSelected} 
                      onChange={(v) => handleColorChange("navTextColorSelected", v)} 
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <FontPicker 
                    label="Title/Heading Font" 
                    value={theme.titleFont} 
                    onChange={(v) => updateTheme({ titleFont: v })} 
                  />
                  <ColorPicker 
                    label="Title Text Color" 
                    value={theme.titleTextColor} 
                    onChange={(v) => handleColorChange("titleTextColor", v)} 
                  />
                </div>

                <div className="space-y-3">
                  <FontPicker 
                    label="Dropdown Font" 
                    value={theme.dropdownFont} 
                    onChange={(v) => updateTheme({ dropdownFont: v })} 
                  />
                  <ColorPicker 
                    label="Dropdown Text Color" 
                    value={theme.dropdownTextColor} 
                    onChange={(v) => handleColorChange("dropdownTextColor", v)} 
                  />
                </div>

                <div className="space-y-3">
                  <FontPicker 
                    label="Menu Font" 
                    value={theme.menuFont} 
                    onChange={(v) => updateTheme({ menuFont: v })} 
                  />
                  <ColorPicker 
                    label="Menu Text Color" 
                    value={theme.menuTextColor} 
                    onChange={(v) => handleColorChange("menuTextColor", v)} 
                  />
                </div>

                <div className="space-y-3">
                  <FontPicker 
                    label="Streams Menu Font" 
                    value={theme.streamsFont} 
                    onChange={(v) => updateTheme({ streamsFont: v })} 
                  />
                  <ColorPicker 
                    label="Streams Menu Text Color" 
                    value={theme.streamsTextColor} 
                    onChange={(v) => handleColorChange("streamsTextColor", v)} 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer - Theme Management */}
          <div className="px-6 py-4 border-t border-white/5 space-y-4 bg-white/[0.02]">
             <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Theme name..."
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-white/30 transition-all"
                />
                <button 
                  onClick={() => {
                    if (newThemeName.trim()) {
                      saveTheme(newThemeName.trim());
                      setNewThemeName("");
                      // We don't have the ID yet, but the user can now overwrite it next time
                    }
                  }}
                  disabled={!newThemeName.trim()}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all flex items-center gap-2"
                >
                  <Save className="w-3.5 h-3.5" /> Save
                </button>
                {loadedThemeId && (
                   <button 
                    onClick={() => {
                      overwriteSavedTheme(loadedThemeId);
                    }}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all flex items-center gap-2"
                  >
                    <Check className="w-3.5 h-3.5" /> Update
                  </button>
                )}
             </div>

             <div className="relative">
                <button 
                  onClick={() => setIsLoadOpen(!isLoadOpen)}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all flex items-center justify-center gap-2 border border-white/5"
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Load Appearance
                </button>

                <AnimatePresence>
                  {isLoadOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 right-0 mb-2 bg-surface-container-high border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar"
                    >
                      <button 
                        onClick={() => {
                          resetTheme();
                          setIsLoadOpen(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-white/5 text-[10px] font-bold text-white/60 uppercase tracking-tight transition-all border-b border-white/5"
                      >
                        Default Theme
                      </button>
                      {savedThemes.map((t) => (
                        <div key={t.id} className="flex group">
                          <button 
                            onClick={() => {
                              loadTheme(t.settings);
                              setLoadedThemeId(t.id);
                              setNewThemeName(t.name);
                              setIsLoadOpen(false);
                            }}
                            className={`flex-1 px-4 py-3 text-left hover:bg-white/5 text-[10px] font-bold uppercase tracking-tight transition-all ${loadedThemeId === t.id ? 'text-white' : 'text-white/40'}`}
                          >
                            {t.name}
                          </button>
                          <button 
                            onClick={() => deleteSavedTheme(t.id)}
                            className="px-4 hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
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

function ColorPicker({ label, value, onChange, isRgba = false }: { label: string; value: string; onChange: (v: string) => void; isRgba?: boolean }) {
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
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold text-white/40 uppercase tracking-tight truncate">{label}</p>
        <p className="text-[10px] font-mono text-white/60 mt-0.5 truncate">{value}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/10 shadow-inner group flex-shrink-0">
          <input 
            type="color" 
            value={displayHex}
            onChange={(e) => handleColorChange(e.target.value)}
            className="absolute inset-0 w-full h-full cursor-pointer opacity-0" 
          />
          <div 
            className="absolute inset-0 pointer-events-none group-hover:scale-110 transition-transform" 
            style={{ backgroundColor: value }}
          />
        </div>
        {isRgba && (
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={alpha}
              onChange={(e) => handleAlphaChange(parseFloat(e.target.value))}
              className="w-12 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-current"
            />
            <span className="text-[9px] font-mono text-white/40 w-7 text-right">{Math.round(alpha * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Slider({ label, value, max, onChange, suffix = "" }: { label: string; value: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center px-1">
        <label className="text-[9px] font-bold text-white/40 uppercase tracking-tight">{label}</label>
        <span className="text-[10px] font-bold">{Math.round(value)}{suffix}</span>
      </div>
      <input 
        type="range"
        min="0"
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-current"
      />
    </div>
  );
}

function FontPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-bold text-white/40 uppercase tracking-tight px-1">{label}</label>
      <div className="grid grid-cols-2 gap-1.5">
        {fontOptions.map((f) => (
          <button
            key={f.name}
            onClick={() => onChange(f.value)}
            className={`p-2.5 rounded-lg border text-left transition-all ${value === f.value ? 'bg-white text-black border-white' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}`}
            style={{ fontFamily: f.value }}
          >
            <div className="text-[10px] font-bold truncate">{f.name}</div>
            <div className="text-[8px] opacity-60 mt-0.5">Abc 123</div>
          </button>
        ))}
      </div>
    </div>
  );
}
