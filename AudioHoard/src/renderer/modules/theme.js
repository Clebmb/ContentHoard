// ─── Theme management ───

export const BUILTIN_THEMES = ['dark', 'light', 'ocean', 'forest', 'sunset', 'rose', 'midnight'];
export const THEME_BUILDER_STORAGE_KEY = 'snowify_theme_builder_themes';

export const DEFAULT_THEME_BUILDER_SETTINGS = {
  backgroundColor: '#000000',
  surfaceColor: '#0e0e0e',
  elevatedColor: '#1b1b1b',
  cardColor: '#0e0e0e',
  accentColor: '#ffffff',
  textColor: '#ffffff',
  secondaryTextColor: 'rgba(255, 255, 255, 0.78)',
  subduedTextColor: 'rgba(255, 255, 255, 0.42)',
  navBackgroundColor: '#141414',
  navTextColorUnselected: 'rgba(255, 255, 255, 0.6)',
  navTextColorSelected: '#000000',
  headerBackgroundColor: '#0e0e0e',
  dropdownBackgroundColor: '#141414',
  dropdownTextColor: '#ffffff',
  menuBackgroundColor: '#141414',
  menuTextColor: '#ffffff',
  streamsBackgroundColor: 'rgba(26, 26, 26, 0.6)',
  streamsTextColor: '#ffffff',
  cardGlowColor: 'rgba(255, 255, 255, 0.15)',
  headerText: 'AudioHoard',
  logoUrl: '',
  appFont: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headerFont: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headerTextColor: '#ffffff',
  headingFont: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  titleFont: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  titleTextColor: '#ffffff',
  navFont: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  dropdownFont: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  menuFont: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  streamsFont: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  isGlassy: true,
  isTransparent: true,
  glassBlur: 24,
  glassOpacity: 0.1,
  isGlowEnabled: true,
  glowIntensity: 1,
};

export function isCustomTheme(theme) {
  return theme && theme.startsWith('custom:');
}

export function isThemeBuilderTheme(theme) {
  return theme && theme.startsWith('builder:');
}

export function customThemeId(theme) {
  return theme.slice('custom:'.length);
}

export function themeBuilderId(theme) {
  return theme.slice('builder:'.length);
}

function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'theme-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

export function normalizeThemeBuilderSettings(settings = {}) {
  const normalized = { ...DEFAULT_THEME_BUILDER_SETTINGS, ...(settings || {}) };
  normalized.surfaceColor = normalized.streamsBackgroundColor || normalized.surfaceColor;
  normalized.elevatedColor = normalized.menuBackgroundColor || normalized.elevatedColor;
  normalized.cardColor = normalized.streamsBackgroundColor || normalized.cardColor;
  normalized.secondaryTextColor = normalized.navTextColorUnselected || normalized.secondaryTextColor;
  normalized.subduedTextColor = normalized.navTextColorUnselected || normalized.subduedTextColor;
  normalized.appFont = normalized.menuFont || normalized.appFont;
  normalized.headingFont = normalized.titleFont || normalized.headingFont;
  return normalized;
}

export function normalizeThemeBuilderThemes(value) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .filter(t => t && typeof t === 'object')
    .map(t => ({
      id: String(t.id || uid()),
      name: String(t.name || 'Custom Theme'),
      settings: normalizeThemeBuilderSettings(t.settings),
      updatedAt: Number(t.updatedAt || Date.now()),
    }));
}

export function getThemeBuilderThemes() {
  try {
    return normalizeThemeBuilderThemes(JSON.parse(localStorage.getItem(THEME_BUILDER_STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function saveThemeBuilderThemes(themes, { sync = true } = {}) {
  const normalized = normalizeThemeBuilderThemes(themes);
  localStorage.setItem(THEME_BUILDER_STORAGE_KEY, JSON.stringify(normalized));
  if (sync) syncContentHoardSavedThemes(normalized);
  return normalized;
}

export function getThemeBuilderTheme(id) {
  return getThemeBuilderThemes().find(t => t.id === id) || null;
}

export function upsertThemeBuilderTheme(theme, { sync = true } = {}) {
  const themes = getThemeBuilderThemes();
  const id = theme.id || uid();
  const next = {
    id,
    name: String(theme.name || 'Custom Theme').trim() || 'Custom Theme',
    settings: normalizeThemeBuilderSettings(theme.settings),
    updatedAt: Date.now(),
  };
  const index = themes.findIndex(t => t.id === id);
  if (index >= 0) themes[index] = next;
  else themes.push(next);
  saveThemeBuilderThemes(themes, { sync });
  if (sync) syncContentHoardTheme(next);
  return next;
}

export function deleteThemeBuilderTheme(id) {
  saveThemeBuilderThemes(getThemeBuilderThemes().filter(t => t.id !== id));
}

function toSharedThemeSettings(settings) {
  return {
    backgroundColor: settings.backgroundColor,
    surfaceColor: settings.surfaceColor,
    elevatedColor: settings.elevatedColor,
    accentColor: settings.accentColor,
    textColor: settings.textColor,
    secondaryTextColor: settings.secondaryTextColor,
    cardGlowColor: settings.cardGlowColor || 'rgba(255, 255, 255, 0.15)',
    navTextColorUnselected: settings.navTextColorUnselected || settings.secondaryTextColor,
    navTextColorSelected: settings.navTextColorSelected,
    navBackgroundColor: settings.navBackgroundColor,
    headerBackgroundColor: settings.headerBackgroundColor,
    dropdownBackgroundColor: settings.dropdownBackgroundColor,
    dropdownTextColor: settings.dropdownTextColor,
    menuBackgroundColor: settings.menuBackgroundColor,
    menuTextColor: settings.menuTextColor,
    streamsBackgroundColor: settings.streamsBackgroundColor,
    streamsTextColor: settings.streamsTextColor,
    glassBlur: settings.glassBlur,
    glassOpacity: settings.glassOpacity,
    isGlassy: settings.isGlassy,
    isTransparent: settings.isTransparent,
    isGlowEnabled: settings.isGlowEnabled,
    glowIntensity: settings.glowIntensity,
    logoUrl: settings.logoUrl,
    headerText: settings.headerText,
    audiohoardLogoUrl: settings.logoUrl,
    audiohoardHeaderText: settings.headerText,
    headerFont: settings.headerFont || settings.appFont,
    headerTextColor: settings.headerTextColor,
    navFont: settings.navFont,
    titleFont: settings.titleFont || settings.headingFont,
    titleTextColor: settings.titleTextColor,
    dropdownFont: settings.dropdownFont,
    menuFont: settings.menuFont,
    streamsFont: settings.streamsFont || settings.appFont,
  };
}

async function syncContentHoardSavedThemes(themes) {
  const bridge = window.snowify?.contentHoard;
  if (!bridge?.enabled || !bridge.writeSharedState) return;
  const shared = await bridge.readSharedState?.() || {};
  await bridge.writeSharedState({
    ...shared,
    savedThemes: normalizeThemeBuilderThemes(themes)
      .filter(theme => !theme.id.startsWith('contenthoard-'))
      .map(theme => ({
        id: theme.id,
        name: theme.name,
        settings: {
          ...(shared.theme || {}),
          ...toSharedThemeSettings(theme.settings),
        },
      })),
  });
}

async function syncContentHoardTheme(theme) {
  const bridge = window.snowify?.contentHoard;
  if (!bridge?.enabled || !bridge.writeSharedState || !theme?.settings) return;
  const shared = await bridge.readSharedState?.() || {};
  await bridge.writeSharedState({
    ...shared,
    theme: {
      ...(shared.theme || {}),
      ...toSharedThemeSettings(theme.settings),
      isSoundEnabled: shared.theme?.isSoundEnabled ?? true,
      globalVolume: shared.theme?.globalVolume ?? 0.5,
      metadataLanguage: shared.theme?.metadataLanguage || 'English',
      preferredQuality: shared.theme?.preferredQuality || '1080p',
    },
  });
}

export function applyCustomThemeCss(css) {
  // Remove existing to force full re-parse (including @import)
  removeCustomThemeCss();
  const el = document.createElement('style');
  el.id = 'custom-theme-style';
  el.textContent = css;
  document.head.appendChild(el);
}

export function removeCustomThemeCss() {
  const el = document.getElementById('custom-theme-style');
  if (el) el.remove();
}

export function removeThemeBuilderCss() {
  const el = document.getElementById('theme-builder-style');
  if (el) el.remove();
}

function hexToRgb(hex) {
  const clean = String(hex || '').replace(/^#/, '');
  if (!/^[a-f0-9]{6}$/i.test(clean)) return '57, 224, 121';
  return `${parseInt(clean.slice(0, 2), 16)}, ${parseInt(clean.slice(2, 4), 16)}, ${parseInt(clean.slice(4, 6), 16)}`;
}

function cssValue(value) {
  return String(value || '').replace(/[;{}]/g, '');
}

function cssString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

export function buildThemeBuilderCss(settings) {
  const t = normalizeThemeBuilderSettings(settings);
  const accentRgb = hexToRgb(t.accentColor);
  const glassOpacity = Math.max(0, Math.min(1, Number(t.glassOpacity) || 0));
  const blur = Math.max(0, Math.min(64, Number(t.glassBlur) || 0));
  const glowIntensity = Math.max(0, Math.min(2, Number(t.glowIntensity) || 0));
  const surfaceAlpha = t.isTransparent ? glassOpacity : 1;
  const cardShadow = t.isGlowEnabled
    ? `0 16px 36px rgba(0, 0, 0, 0.16), 0 0 ${Math.round(28 * glowIntensity)}px ${cssValue(t.cardGlowColor)}`
    : '0 16px 36px rgba(0, 0, 0, 0.16)';
  const escapedLogo = String(t.logoUrl || '').replace(/"/g, '%22');
  const brandLogoCss = escapedLogo ? `
#titlebar .app-logo::before {
  content: "";
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  border-radius: 6px;
  background: url("${escapedLogo}") center / cover no-repeat;
}
#titlebar .app-logo-icon { display: none; }
` : '';
  return `
:root {
  --bg-base: ${cssValue(t.backgroundColor)};
  --bg-surface: ${cssValue(t.surfaceColor)};
  --bg-elevated: ${cssValue(t.elevatedColor)};
  --bg-highlight: color-mix(in srgb, ${cssValue(t.elevatedColor)} 78%, ${cssValue(t.accentColor)});
  --bg-card: ${cssValue(t.cardColor)};
  --bg-surface-top: ${cssValue(t.backgroundColor)};
  --text-primary: ${cssValue(t.textColor)};
  --text-secondary: ${cssValue(t.secondaryTextColor)};
  --text-subdued: ${cssValue(t.subduedTextColor)};
  --accent: ${cssValue(t.accentColor)};
  --accent-hover: color-mix(in srgb, ${cssValue(t.accentColor)} 82%, white);
  --accent-dim: rgba(${accentRgb}, 0.13);
  --accent-dim-hover: rgba(${accentRgb}, 0.22);
  --accent-glow: rgba(${accentRgb}, 0.24);
  --accent-border: rgba(${accentRgb}, 0.38);
  --glass-blur: ${t.isGlassy ? `blur(${blur}px)` : 'none'};
  --glass-border: 1px solid rgba(255, 255, 255, ${glassOpacity});
  --glass-shadow: 0 20px 45px rgba(0, 0, 0, ${0.3 + glassOpacity});
  --font: ${cssValue(t.appFont)};
}
body {
  background: ${cssValue(t.backgroundColor)};
  color: ${cssValue(t.textColor)};
  font-family: ${cssValue(t.menuFont || t.appFont)};
}
#titlebar {
  background: ${cssValue(t.headerBackgroundColor)};
  color: ${cssValue(t.headerTextColor)};
  backdrop-filter: ${t.isGlassy ? `blur(${blur}px)` : 'none'};
  -webkit-backdrop-filter: ${t.isGlassy ? `blur(${blur}px)` : 'none'};
}
#titlebar .app-logo { gap: 10px; }
#titlebar .app-logo span {
  font-size: 0;
  font-family: ${cssValue(t.headerFont)};
  color: ${cssValue(t.headerTextColor)};
}
#titlebar .app-logo span::after {
  content: "${cssString(t.headerText || 'AudioHoard')}";
  font-size: 14px;
}
${brandLogoCss}
#sidebar {
  background: ${cssValue(t.navBackgroundColor)};
  backdrop-filter: ${t.isGlassy ? `blur(${blur}px)` : 'none'};
  -webkit-backdrop-filter: ${t.isGlassy ? `blur(${blur}px)` : 'none'};
}
.nav-btn, .settings-tab-btn, .marketplace-tab {
  font-family: ${cssValue(t.navFont)};
  color: ${cssValue(t.navTextColorUnselected)};
}
.nav-btn.active, .settings-tab-btn.active, .marketplace-tab.active {
  background: ${cssValue(t.accentColor)};
  color: ${cssValue(t.navTextColorSelected)};
}
.view-header h1, .section h2, .settings-group h3, .playlist-hero-name, .artist-name {
  font-family: ${cssValue(t.titleFont || t.headingFont)};
  color: ${cssValue(t.titleTextColor)};
}
.settings-group,
.album-card,
.playlist-item,
.track-row,
.modal-content,
.toast,
.source-item,
.profile-card {
  background-color: color-mix(in srgb, ${cssValue(t.cardColor)} ${Math.round(surfaceAlpha * 100)}%, transparent);
  box-shadow: ${cardShadow};
}
.context-menu,
.profile-menu,
.search-suggestions,
.lyrics-menu,
.queue-panel,
#queue-panel {
  background: ${cssValue(t.menuBackgroundColor)};
  color: ${cssValue(t.menuTextColor)};
  font-family: ${cssValue(t.menuFont)};
  backdrop-filter: ${t.isGlassy ? `blur(${blur}px)` : 'none'};
  -webkit-backdrop-filter: ${t.isGlassy ? `blur(${blur}px)` : 'none'};
}
.queue-list,
.lyrics-panel,
.playlist-track-list,
.search-results {
  background: ${cssValue(t.streamsBackgroundColor)};
  color: ${cssValue(t.streamsTextColor)};
  font-family: ${cssValue(t.streamsFont)};
}
select,
.setting-select,
.auth-input,
.plugin-search-input,
.search-input {
  background: ${cssValue(t.dropdownBackgroundColor)};
  color: ${cssValue(t.dropdownTextColor)};
  font-family: ${cssValue(t.dropdownFont)};
}
`.trim();
}

export function applyThemeBuilderSettings(settings) {
  removeCustomThemeCss();
  removeThemeBuilderCss();
  const el = document.createElement('style');
  el.id = 'theme-builder-style';
  el.textContent = buildThemeBuilderCss(settings);
  document.head.appendChild(el);
}

export async function loadAndApplyThemeFile(themeValue) {
  if (!isCustomTheme(themeValue)) { removeCustomThemeCss(); return false; }
  removeThemeBuilderCss();
  try {
    const css = await window.snowify.loadTheme(customThemeId(themeValue));
    if (css) { applyCustomThemeCss(css); return true; }
    removeCustomThemeCss();
    return false;
  } catch (err) {
    console.error('Failed to load custom theme:', err);
    removeCustomThemeCss();
    return false;
  }
}

export function applyTheme(theme) {
  if (isThemeBuilderTheme(theme)) {
    document.documentElement.removeAttribute('data-theme');
    const saved = getThemeBuilderTheme(themeBuilderId(theme));
    if (saved) applyThemeBuilderSettings(saved.settings);
    else removeThemeBuilderCss();
    return Promise.resolve(!!saved);
  }
  removeThemeBuilderCss();
  if (theme === 'dark' || isCustomTheme(theme)) {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  return loadAndApplyThemeFile(theme);
}

export async function populateCustomThemes(selectEl, currentValue) {
  // Remove old custom options
  selectEl.querySelectorAll('option[data-custom]').forEach(o => o.remove());
  selectEl.querySelectorAll('option[data-builder]').forEach(o => o.remove());
  const builderThemes = getThemeBuilderThemes();
  if (builderThemes.length) {
    const sep = document.createElement('option');
    sep.disabled = true;
    sep.textContent = I18n.t('settings.themeBuilderSeparator');
    sep.dataset.builder = '1';
    selectEl.appendChild(sep);
    for (const t of builderThemes) {
      const opt = document.createElement('option');
      opt.value = 'builder:' + t.id;
      opt.textContent = t.name;
      opt.dataset.builder = '1';
      selectEl.appendChild(opt);
    }
  }
  const themes = await window.snowify.scanThemes();
  if (themes.length) {
    const sep = document.createElement('option');
    sep.disabled = true;
    sep.textContent = I18n.t('settings.customThemeSeparator');
    sep.dataset.custom = '1';
    selectEl.appendChild(sep);
    for (const t of themes) {
      const opt = document.createElement('option');
      opt.value = 'custom:' + t.id;
      opt.textContent = t.name;
      opt.dataset.custom = '1';
      selectEl.appendChild(opt);
    }
  }
  selectEl.value = currentValue;
  // If the value didn't match (theme was removed), fall back to dark
  if (selectEl.value !== currentValue && (isCustomTheme(currentValue) || isThemeBuilderTheme(currentValue))) {
    selectEl.value = 'dark';
  }
}
