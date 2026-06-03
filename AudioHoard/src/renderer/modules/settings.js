/**
 * settings.js
 * Settings panel, changelog, updater UI, developer tools, source lists.
 */

import state from './state.js';
import { escapeHtml, showToast, setupSliderTooltip } from './utils.js';
import { callbacks } from './callbacks.js';
import { audioRef } from './audio-ref.js';
import { getNormalizer, getPrefetchCache } from './player.js';
import {
  DEFAULT_THEME_BUILDER_SETTINGS,
  applyTheme,
  applyThemeBuilderSettings,
  populateCustomThemes,
  isCustomTheme,
  isThemeBuilderTheme,
  customThemeId,
  themeBuilderId,
  getThemeBuilderThemes,
  getThemeBuilderTheme,
  upsertThemeBuilderTheme,
  deleteThemeBuilderTheme,
  normalizeThemeBuilderSettings,
  applyCustomThemeCss,
  removeCustomThemeCss,
} from './theme.js';
import { renderPlugins } from './plugins.js';
import { renderHome } from './home.js';
import { invalidateExploreCache } from './explore.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const IS_MOBILE_RUNTIME = window.snowify?.platform === 'android' || window.snowify?.platform === 'ios' ||
  document.documentElement.classList.contains('platform-mobile');
const FONT_OPTIONS = [
  { name: 'Spline Sans', value: "'Inter', 'Space Grotesk', 'Noto Sans', system-ui, sans-serif" },
  { name: 'Inter', value: "'Inter', system-ui, sans-serif" },
  { name: 'Outfit', value: "'Outfit', 'Inter', system-ui, sans-serif" },
  { name: 'Playfair Display', value: "'Playfair Display', Georgia, serif" },
  { name: 'Ubuntu Mono', value: "'Ubuntu Mono', monospace" },
  { name: 'Roboto Mono', value: "'Roboto Mono', monospace" },
];

// ─── Markdown → HTML (for changelog) ─────────────────────────────────────────

function renderMarkdown(md) {
  const safeHref = (url) => {
    try {
      const parsed = new URL(String(url || ''), 'https://snowify.invalid');
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
    } catch {}
    return '#';
  };

  const tokens = [];
  let tIdx = 0;
  const stash = (html) => { const k = `\x00T${tIdx++}\x00`; tokens.push({ k, html }); return k; };

  md = md.replace(/`([^`]+)`/g, (_, c) => stash(`<code>${escapeHtml(c)}</code>`));
  md = md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => stash(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />`));
  md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => stash(`<a href="${escapeHtml(safeHref(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`));
  md = md.replace(/(^|[\s(])((https?:\/\/)[^\s)<]+)/gm, (_, pre, url) => pre + stash(`<a href="${escapeHtml(safeHref(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`));
  md = md.replace(/(^|[\s(])@([a-zA-Z0-9_-]+)/gm, (_, pre, user) => pre + stash(`<a href="https://github.com/${escapeHtml(user)}" target="_blank" rel="noopener">@${escapeHtml(user)}</a>`));

  let html = escapeHtml(md);
  for (const { k, html: v } of tokens) html = html.split(k).join(v);

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^[*\-] (.+)$/gm, '<li>$1</li>').replace(/((?:<li>.+<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*<\/p>/g, '').replace(/<p>\s*(<h[123]>)/g, '$1').replace(/(<\/h[123]>)\s*<\/p>/g, '$1')
    .replace(/<p>\s*(<ul>)/g, '$1').replace(/(<\/ul>)\s*<\/p>/g, '$1')
    .replace(/<p>\s*(<hr>)\s*<\/p>/g, '$1').replace(/<p>\s*(<blockquote>)/g, '$1').replace(/(<\/blockquote>)\s*<\/p>/g, '$1');
  return html;
}

function compareSemver(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0, vb = pb[i] || 0;
    if (va < vb) return -1; if (va > vb) return 1;
  }
  return 0;
}

function getActiveBuilderId() {
  return isThemeBuilderTheme(state.theme) ? themeBuilderId(state.theme) : null;
}

function currentBuilderDraft() {
  const saved = getActiveBuilderId() ? getThemeBuilderTheme(getActiveBuilderId()) : null;
  return {
    id: saved?.id || null,
    name: saved?.name || I18n.t('settings.themeBuilderDefaultName'),
    settings: normalizeThemeBuilderSettings(saved?.settings || DEFAULT_THEME_BUILDER_SETTINGS),
  };
}

function normalizeColorInput(value, fallback = '#ffffff') {
  const raw = String(value || '').trim();
  if (/^#[a-f0-9]{6}$/i.test(raw)) return raw;
  if (/^#[a-f0-9]{3}$/i.test(raw)) {
    return '#' + raw.slice(1).split('').map(ch => ch + ch).join('');
  }
  return fallback;
}

function readBuilderForm() {
  const settings = {};
  document.querySelectorAll('[data-builder-field]').forEach(input => {
    const key = input.dataset.builderField;
    if (!key) return;
    if (input.type === 'checkbox') settings[key] = input.checked;
    else if (input.type === 'range') settings[key] = Number(input.value);
    else settings[key] = input.value;
  });
  return normalizeThemeBuilderSettings(settings);
}

function writeBuilderForm(theme) {
  const nameInput = $('#theme-builder-name');
  if (nameInput) nameInput.value = theme.name || '';
  document.querySelectorAll('[data-builder-field]').forEach(input => {
    const key = input.dataset.builderField;
    if (!key) return;
    const value = theme.settings?.[key] ?? DEFAULT_THEME_BUILDER_SETTINGS[key];
    if (input.tagName === 'SELECT' && !input.options.length) {
      FONT_OPTIONS.forEach(font => {
        const opt = document.createElement('option');
        opt.value = font.value;
        opt.textContent = font.name;
        input.appendChild(opt);
      });
    }
    if (input.type === 'checkbox') input.checked = !!value;
    else if (input.type === 'color') input.value = normalizeColorInput(value, DEFAULT_THEME_BUILDER_SETTINGS[key]);
    else input.value = value;
  });
  document.querySelectorAll('[data-color-field]').forEach(input => {
    const key = input.dataset.colorField;
    const textInput = document.querySelector(`[data-text-field="${key}"]`);
    const textValue = textInput?.value || '';
    input.value = normalizeColorInput(textValue, '#ffffff');
  });
}

function updateBuilderPreview(settings) {
  const title = $('#theme-builder-preview-title');
  const logo = $('#theme-builder-preview-logo');
  const editor = $('#theme-builder-editor');
  const summary = $('#theme-builder-summary-preview');
  if (title) {
    title.textContent = settings.headerText || 'AudioHoard';
    title.style.fontFamily = settings.headerFont;
    title.style.color = settings.headerTextColor;
  }
  if (logo) {
    logo.style.backgroundColor = settings.accentColor;
    logo.innerHTML = settings.logoUrl ? `<img src="${escapeHtml(settings.logoUrl)}" alt="" draggable="false" />` : '<span class="material-symbols-outlined">music_cast</span>';
  }
  if (editor) {
    editor.style.setProperty('--theme-builder-preview-bg', settings.surfaceColor);
    editor.style.setProperty('--theme-builder-preview-text', settings.textColor);
    editor.style.setProperty('--theme-builder-preview-accent', settings.accentColor);
  }
  if (summary) {
    const swatches = summary.querySelectorAll('span');
    [settings.backgroundColor, settings.surfaceColor, settings.accentColor, settings.textColor].forEach((color, index) => {
      if (swatches[index]) swatches[index].style.background = color;
    });
  }
}

function renderBuilderThemeList(activeId = null) {
  const select = $('#theme-builder-load-select');
  if (!select) return;
  select.innerHTML = '';
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = I18n.t('settings.themeBuilderLoadDefault');
  select.appendChild(defaultOpt);
  getThemeBuilderThemes().forEach(theme => {
    const opt = document.createElement('option');
    opt.value = theme.id;
    opt.textContent = theme.name;
    select.appendChild(opt);
  });
  select.value = activeId || '';
}

// ─── initSettings ─────────────────────────────────────────────────────────────

let _settingsInitialized = false;
export async function initSettings() {
  if (_settingsInitialized) return;
  _settingsInitialized = true;

  const { engine, audio } = audioRef;
  const normalizer        = getNormalizer();
  const prefetchCache     = getPrefetchCache();

  // ── Tabs ──
  const settingsTabs = document.querySelector('.settings-tabs');
  if (settingsTabs) {
    const activateSettingsTab = (tabId) => {
      document.querySelectorAll('.settings-tab-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.settingsTab === tabId));
      document.querySelectorAll('.settings-tab-pane').forEach(p =>
        p.classList.toggle('active', p.dataset.tab === tabId));
      sessionStorage.setItem('settings-tab', tabId);
      if (tabId === 'marketplace') renderPlugins();
    };
    settingsTabs.addEventListener('click', e => {
      const btn = e.target.closest('.settings-tab-btn');
      if (btn) activateSettingsTab(btn.dataset.settingsTab);
    });
    const preferred = sessionStorage.getItem('settings-tab') || 'playback';
    const tabExists = document.querySelector(`.settings-tab-btn[data-settings-tab="${preferred}"]`);
    activateSettingsTab(tabExists ? preferred : 'playback');

    if (IS_MOBILE_RUNTIME) {
      document.getElementById('group-behavior')?.classList.add('hidden');
    }
  }

  const autoplayToggle       = $('#setting-autoplay');
  const qualitySelect        = $('#setting-quality');
  const videoQualitySelect   = $('#setting-video-quality');
  const videoPremuxedToggle  = $('#setting-video-premuxed');
  const animationsToggle     = $('#setting-animations');
  const effectsToggle        = $('#setting-effects');
  const miniplayerGlowToggle = $('#setting-miniplayer-glow');
  const miniplayerGlowRow    = $('#row-miniplayer-glow');
  const discordRpcToggle     = $('#setting-discord-rpc');
  const countrySelect        = $('#setting-country');
  const crossfadeToggle      = $('#setting-crossfade-toggle');
  const crossfadeSlider      = $('#crossfade-slider');
  const crossfadeFill        = $('#crossfade-fill');
  const crossfadeSliderRow   = $('#crossfade-slider-row');
  const crossfadeValueLabel  = $('#crossfade-value');
  let _cfDragging = false;
  let _cfValue    = state.crossfade > 0 ? state.crossfade : 5;

  autoplayToggle.checked   = state.autoplay;
  discordRpcToggle.checked = state.discordRpc;
  qualitySelect.value      = state.audioQuality;

  crossfadeToggle.checked = state.crossfade > 0;
  crossfadeSliderRow.classList.toggle('hidden', state.crossfade <= 0);
  $('.crossfade-label-max').textContent = engine.CROSSFADE_MAX + 's';
  updateCrossfadeSlider(_cfValue);
  videoQualitySelect.value       = state.videoQuality;
  videoPremuxedToggle.checked    = state.videoPremuxed;
  videoQualitySelect.disabled    = state.videoPremuxed;
  animationsToggle.checked       = state.animations;
  effectsToggle.checked          = state.effects;
  if (miniplayerGlowToggle) miniplayerGlowToggle.checked = state.miniplayerGlow;
  if (miniplayerGlowRow) miniplayerGlowRow.classList.toggle('hidden', !state.effects);
  if (countrySelect) countrySelect.value = state.country || '';
  if (state.country) window.snowify.setCountry(state.country);
  document.documentElement.classList.toggle('no-animations', !state.animations);
  document.documentElement.classList.toggle('no-effects', !state.effects);
  document.documentElement.classList.toggle('no-miniplayer-glow', !state.miniplayerGlow);

  // ── Minimize to tray ──
  const minimizeToTrayToggle = $('#setting-minimize-to-tray');
  if (minimizeToTrayToggle) {
    minimizeToTrayToggle.checked = state.minimizeToTray;
    minimizeToTrayToggle.addEventListener('change', () => {
      state.minimizeToTray = minimizeToTrayToggle.checked;
      window.snowify.setMinimizeToTray(state.minimizeToTray);
      callbacks.saveState();
    });
  }

  // ── Launch on startup ──
  const launchOnStartupToggle = $('#setting-launch-on-startup');
  if (launchOnStartupToggle) {
    launchOnStartupToggle.checked = state.launchOnStartup;
    launchOnStartupToggle.addEventListener('change', () => {
      state.launchOnStartup = launchOnStartupToggle.checked;
      window.snowify.setOpenAtLogin(state.launchOnStartup);
      callbacks.saveState();
    });
  }

  applyTheme(state.theme);

  // ── Language ──
  const languageSelect = $('#setting-language');
  if (languageSelect) {
    const savedLocale = localStorage.getItem('snowify_locale') || '';
    languageSelect.value = savedLocale;
    languageSelect.addEventListener('change', () => {
      const lang = languageSelect.value;
      if (lang) I18n.changeLanguage(lang);
      else { localStorage.removeItem('snowify_locale'); I18n.changeLanguage(navigator.language || 'en'); }
    });
  }

  // ── Theme ──
  const themeSelect = $('#theme-select');
  await populateCustomThemes(themeSelect, state.theme);
  if (themeSelect.value !== state.theme) {
    state.theme = themeSelect.value || 'dark';
    applyTheme(state.theme);
    callbacks.saveState();
  }
  themeSelect.addEventListener('change', () => {
    state.theme = themeSelect.value;
    applyTheme(state.theme);
    if (isThemeBuilderTheme(state.theme)) writeBuilderForm(currentBuilderDraft());
    updateBuilderPreview(readBuilderForm());
    renderBuilderThemeList(getActiveBuilderId());
    callbacks.saveState();
  });

  const btnOpenBuilder        = $('#btn-open-theme-builder');
  const btnNewBuilder         = $('#btn-new-theme-builder');
  const btnSaveBuilder        = $('#btn-save-theme-builder');
  const btnUpdateBuilder      = $('#btn-update-theme-builder');
  const btnDeleteBuilder      = $('#btn-delete-theme-builder');
  const btnApplyBuilder       = $('#btn-apply-theme-builder');
  const btnResetBuilder       = $('#btn-reset-theme-builder');
  const btnDismissBuilder     = $('#btn-dismiss-theme-builder');
  const btnCloseBuilder       = $('#btn-close-theme-builder');
  const builderEditor         = $('#theme-builder-editor');
  const builderLoadSelect     = $('#theme-builder-load-select');
  const btnReloadTheme        = $('#btn-reload-theme');
  const btnRemoveTheme        = $('#btn-remove-theme');
  let builderDraft = currentBuilderDraft();
  writeBuilderForm(builderDraft);
  updateBuilderPreview(builderDraft.settings);
  renderBuilderThemeList(builderDraft.id);

  const openThemeBuilder = () => {
    if (builderEditor && builderEditor.parentElement !== document.body) document.body.appendChild(builderEditor);
    if (isThemeBuilderTheme(state.theme)) builderDraft = currentBuilderDraft();
    writeBuilderForm(builderDraft);
    updateBuilderPreview(builderDraft.settings);
    renderBuilderThemeList(builderDraft.id);
    builderEditor?.classList.remove('hidden');
    builderEditor?.setAttribute('aria-hidden', 'false');
  };

  const closeThemeBuilder = ({ keepPreview = false } = {}) => {
    builderEditor?.classList.add('hidden');
    builderEditor?.setAttribute('aria-hidden', 'true');
    if (!keepPreview) applyTheme(state.theme);
  };

  const resetBuilderDraft = ({ preview = true } = {}) => {
    builderDraft = {
      id: null,
      name: I18n.t('settings.themeBuilderDefaultName'),
      settings: normalizeThemeBuilderSettings(DEFAULT_THEME_BUILDER_SETTINGS),
    };
    writeBuilderForm(builderDraft);
    updateBuilderPreview(builderDraft.settings);
    renderBuilderThemeList(null);
    if (preview) applyThemeBuilderSettings(builderDraft.settings);
  };

  const saveBuilderDraft = async ({ overwrite = false } = {}) => {
    builderDraft.settings = readBuilderForm();
    builderDraft.name = ($('#theme-builder-name')?.value || I18n.t('settings.themeBuilderDefaultName')).trim();
    const saved = upsertThemeBuilderTheme({
      id: overwrite ? builderDraft.id : null,
      name: builderDraft.name,
      settings: builderDraft.settings,
    });
    builderDraft = { id: saved.id, name: saved.name, settings: saved.settings };
    state.theme = 'builder:' + saved.id;
    await populateCustomThemes(themeSelect, state.theme);
    themeSelect.value = state.theme;
    writeBuilderForm(builderDraft);
    renderBuilderThemeList(saved.id);
    applyTheme(state.theme);
    callbacks.saveState();
    showToast(I18n.t('toast.themeBuilderSaved'));
    return saved;
  };

  document.querySelectorAll('.theme-builder-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.theme-builder-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.theme-builder-content').forEach(content => {
        content.classList.toggle('active', content.dataset.themeBuilderContent === tab.dataset.themeBuilderTab);
      });
    });
  });

  document.querySelectorAll('[data-builder-field]').forEach(input => {
    input.addEventListener('input', () => {
      builderDraft.settings = readBuilderForm();
      updateBuilderPreview(builderDraft.settings);
      applyThemeBuilderSettings(builderDraft.settings);
    });
  });

  // Sync dual color+text inputs for rgba support
  document.querySelectorAll('[data-color-field]').forEach(colorInput => {
    colorInput.addEventListener('input', () => {
      const key = colorInput.dataset.colorField;
      const textInput = document.querySelector(`[data-text-field="${key}"]`);
      if (!textInput) return;
      const hex = colorInput.value;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const current = textInput.value;
      const alpha = current.startsWith('rgba') ? current.match(/[\d.]+\)$/)?.[0]?.slice(0, -1) || '1' : '1';
      textInput.value = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      textInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  $('#theme-builder-logo-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const logoInput = $('[data-builder-field="logoUrl"]');
      if (logoInput) {
        logoInput.value = reader.result || '';
        logoInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    reader.readAsDataURL(file);
  });

  document.querySelectorAll('[data-theme-builder-preset]').forEach(button => {
    button.addEventListener('click', () => {
      const preset = button.dataset.themeBuilderPreset;
      const next = readBuilderForm();
      if (preset === 'glass') Object.assign(next, { isGlassy: true, isTransparent: true, glassBlur: 24, glassOpacity: 0.1 });
      if (preset === 'clear') Object.assign(next, { isGlassy: false, isTransparent: true, glassOpacity: 0.2 });
      if (preset === 'solid') Object.assign(next, { isGlassy: false, isTransparent: false, glassOpacity: 0 });
      if (preset === 'frost') Object.assign(next, { isGlassy: true, isTransparent: true, glassBlur: 64, glassOpacity: 0.05 });
      builderDraft.settings = normalizeThemeBuilderSettings(next);
      writeBuilderForm(builderDraft);
      updateBuilderPreview(builderDraft.settings);
      applyThemeBuilderSettings(builderDraft.settings);
    });
  });

  btnOpenBuilder?.addEventListener('click', openThemeBuilder);
  btnCloseBuilder?.addEventListener('click', () => closeThemeBuilder());
  btnDismissBuilder?.addEventListener('click', () => closeThemeBuilder());
  btnResetBuilder?.addEventListener('click', resetBuilderDraft);
  btnNewBuilder?.addEventListener('click', resetBuilderDraft);
  btnSaveBuilder?.addEventListener('click', () => saveBuilderDraft({ overwrite: false }));
  btnUpdateBuilder?.addEventListener('click', () => {
    if (!builderDraft.id) {
      saveBuilderDraft({ overwrite: false });
      return;
    }
    saveBuilderDraft({ overwrite: true });
  });
  btnApplyBuilder?.addEventListener('click', async () => {
    await saveBuilderDraft({ overwrite: !!builderDraft.id });
    closeThemeBuilder({ keepPreview: true });
  });
  builderLoadSelect?.addEventListener('change', () => {
    const id = builderLoadSelect.value;
    const saved = id ? getThemeBuilderTheme(id) : null;
    builderDraft = saved
      ? { id: saved.id, name: saved.name, settings: saved.settings }
      : { id: null, name: I18n.t('settings.themeBuilderDefaultName'), settings: normalizeThemeBuilderSettings(DEFAULT_THEME_BUILDER_SETTINGS) };
    writeBuilderForm(builderDraft);
    updateBuilderPreview(builderDraft.settings);
    renderBuilderThemeList(builderDraft.id);
    applyThemeBuilderSettings(builderDraft.settings);
  });
  btnDeleteBuilder?.addEventListener('click', async () => {
    const id = builderLoadSelect?.value || builderDraft.id;
    if (!id) return;
    const saved = getThemeBuilderTheme(id);
    if (!confirm(I18n.t('settings.confirmRemoveTheme', { id: saved?.name || id }))) return;
    deleteThemeBuilderTheme(id);
    const deletedActiveTheme = state.theme === 'builder:' + id;
    if (state.theme === 'builder:' + id) {
      state.theme = 'dark';
      themeSelect.value = 'dark';
      applyTheme(state.theme);
      callbacks.saveState();
    }
    await populateCustomThemes(themeSelect, state.theme);
    resetBuilderDraft({ preview: !deletedActiveTheme });
    showToast(I18n.t('toast.themeRemoved'));
  });

  if (btnReloadTheme) {
    btnReloadTheme.onclick = async () => {
      if (isCustomTheme(state.theme)) {
        const css = await window.snowify.reloadTheme(customThemeId(state.theme));
        if (css) { applyCustomThemeCss(css); showToast(I18n.t('toast.themeReloaded')); }
        else showToast(I18n.t('toast.themeNotFound'));
      } else {
        await populateCustomThemes(themeSelect, state.theme);
        showToast(I18n.t('toast.themeListRefreshed'));
      }
    };
  }
  if (btnRemoveTheme) {
    btnRemoveTheme.onclick = async () => {
      if (isThemeBuilderTheme(state.theme)) {
        const id = themeBuilderId(state.theme);
        const saved = getThemeBuilderTheme(id);
        if (!confirm(I18n.t('settings.confirmRemoveTheme', { id: saved?.name || id }))) return;
        deleteThemeBuilderTheme(id);
        state.theme = 'dark';
        themeSelect.value = 'dark';
        applyTheme(state.theme);
        await populateCustomThemes(themeSelect, state.theme);
        callbacks.saveState();
        showToast(I18n.t('toast.themeRemoved'));
        return;
      }
      if (!isCustomTheme(state.theme)) { showToast(I18n.t('toast.selectCustomTheme')); return; }
      const id = customThemeId(state.theme);
      if (!confirm(I18n.t('settings.confirmRemoveTheme', { id }))) return;
      await window.snowify.removeTheme(id);
      removeCustomThemeCss();
      state.theme = 'dark'; themeSelect.value = 'dark';
      applyTheme(state.theme); callbacks.saveState();
      await populateCustomThemes(themeSelect, state.theme);
      showToast(I18n.t('toast.themeRemoved'));
    };
  }

  autoplayToggle.addEventListener('change', () => { state.autoplay = autoplayToggle.checked; callbacks.saveState(); });

  discordRpcToggle.addEventListener('change', async () => {
    state.discordRpc = discordRpcToggle.checked; callbacks.saveState();
    if (state.discordRpc) {
      const ok = await window.snowify.connectDiscord();
      if (!ok) {
        showToast(I18n.t('toast.discordError'));
        state.discordRpc = false; discordRpcToggle.checked = false; callbacks.saveState(); return;
      }
      const track = state.queue[state.queueIndex];
      if (track && state.isPlaying) window.__updateDiscordPresence?.(track);
    } else {
      window.__clearDiscordPresence?.();
      window.snowify.disconnectDiscord();
    }
  });

  qualitySelect.addEventListener('change', () => {
    state.audioQuality = qualitySelect.value;
    normalizer.clearCache(); prefetchCache.clear(); callbacks.saveState();
  });

  function updateCrossfadeSlider(val) {
    _cfValue = Math.max(1, Math.min(engine.CROSSFADE_MAX, val));
    const pct = ((_cfValue - 1) / (engine.CROSSFADE_MAX - 1)) * 100;
    crossfadeFill.style.width    = pct + '%';
    crossfadeValueLabel.textContent = I18n.t('settings.seconds', { value: _cfValue });
  }

  function setCrossfadeFromPointer(e) {
    const rect = crossfadeSlider.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    updateCrossfadeSlider(Math.round(1 + pct * (engine.CROSSFADE_MAX - 1)));
    state.crossfade = _cfValue; callbacks.saveState();
  }

  crossfadeSlider.addEventListener('mousedown', (e) => { _cfDragging = true; setCrossfadeFromPointer(e); });
  document.addEventListener('mousemove', (e) => { if (_cfDragging) setCrossfadeFromPointer(e); });
  document.addEventListener('mouseup', () => { _cfDragging = false; });

  setupSliderTooltip(crossfadeSlider, (pct) => {
    const val = Math.round(1 + pct * (engine.CROSSFADE_MAX - 1));
    return I18n.t('settings.seconds', { value: val });
  });

  crossfadeToggle.addEventListener('change', () => {
    if (crossfadeToggle.checked) { state.crossfade = _cfValue; crossfadeSliderRow.classList.remove('hidden'); }
    else { state.crossfade = 0; crossfadeSliderRow.classList.add('hidden'); }
    callbacks.saveState();
  });

  // ── Normalization ──
  const normToggle     = $('#setting-normalization');
  const normTargetRow  = $('#normalization-target-row');
  const normTargetSel  = $('#setting-normalization-target');
  const normRow        = normToggle?.closest('.setting-row');

  if (IS_MOBILE_RUNTIME) {
    state.normalization = false; normToggle.checked = false; normToggle.disabled = true;
    normTargetRow.classList.add('hidden'); normRow?.classList.add('hidden'); callbacks.saveState();
  }

  normToggle.checked = state.normalization;
  normTargetRow.classList.toggle('hidden', !state.normalization);
  normTargetSel.value = String(state.normalizationTarget);

  normToggle.addEventListener('change', async () => {
    if (IS_MOBILE_RUNTIME) return;
    state.normalization = normToggle.checked;
    normalizer.setEnabled(state.normalization);
    normTargetRow.classList.toggle('hidden', !state.normalization);
    if (state.normalization) {
      await normalizer.initAudioContext();
      if (!normalizer.isWorkletReady()) showToast(I18n.t('toast.normalizationFailed'));
      normalizer.setTarget(state.normalizationTarget);
      const track = state.queue[state.queueIndex];
      if (track && state.isPlaying && audio.src) normalizer.analyzeAndApply(audio, audio.src, track.id);
    }
    callbacks.saveState();
  });

  normTargetSel.addEventListener('change', () => {
    if (IS_MOBILE_RUNTIME) return;
    state.normalizationTarget = parseInt(normTargetSel.value, 10);
    normalizer.setTarget(state.normalizationTarget);
    const track = state.queue[state.queueIndex];
    if (track && state.normalization) normalizer.applyGain(audio, track.id);
    callbacks.saveState();
  });

  // ── Prefetch ──
  const prefetchSelect = $('#setting-prefetch-count');
  prefetchSelect.value = String(state.prefetchCount);
  prefetchSelect.addEventListener('change', () => {
    const val = parseInt(prefetchSelect.value, 10);
    state.prefetchCount = val;
    if (val === 0) prefetchCache.clear();
    else {
      prefetchCache.setCount(val);
      if (state.queue.length && state.queueIndex >= 0) prefetchCache.onTrackChanged(state.queueIndex, state.queue);
    }
    callbacks.saveState();
  });

  videoQualitySelect.addEventListener('change', () => { state.videoQuality = videoQualitySelect.value; callbacks.saveState(); });
  videoPremuxedToggle.addEventListener('change', () => {
    state.videoPremuxed = videoPremuxedToggle.checked; videoQualitySelect.disabled = state.videoPremuxed; callbacks.saveState();
  });
  animationsToggle.addEventListener('change', () => {
    state.animations = animationsToggle.checked;
    document.documentElement.classList.toggle('no-animations', !state.animations); callbacks.saveState();
  });
  effectsToggle.addEventListener('change', () => {
    state.effects = effectsToggle.checked;
    document.documentElement.classList.toggle('no-effects', !state.effects);
    if (miniplayerGlowRow) miniplayerGlowRow.classList.toggle('hidden', !state.effects);
    callbacks.saveState();
  });

  if (miniplayerGlowToggle) {
    miniplayerGlowToggle.addEventListener('change', () => {
      state.miniplayerGlow = miniplayerGlowToggle.checked;
      document.documentElement.classList.toggle('no-miniplayer-glow', !state.miniplayerGlow);
      callbacks.saveState();
    });
  }

  if (countrySelect) {
    countrySelect.addEventListener('change', () => {
      state.country = countrySelect.value;
      window.snowify.setCountry(state.country);
      invalidateExploreCache();
      callbacks.saveState();
      showToast(state.country
        ? I18n.t('toast.exploreRegionSet', { region: countrySelect.options[countrySelect.selectedIndex].text })
        : I18n.t('toast.exploreRegionCleared'));
    });
  }

  // ── Data management ──
  $('#setting-clear-history').addEventListener('click', () => {
    if (confirm(I18n.t('settings.confirmClearHistory'))) {
      state.recentTracks = []; callbacks.saveState(); renderHome(); showToast(I18n.t('toast.historyCleared'));
    }
  });

  $('#setting-clear-search-history').addEventListener('click', () => {
    if (confirm(I18n.t('settings.confirmClearSearchHistory'))) {
      state.searchHistory = []; callbacks.saveState(); showToast(I18n.t('toast.searchHistoryCleared'));
    }
  });

  $('#setting-reset-all').addEventListener('click', () => {
    if (confirm(I18n.t('settings.confirmResetAll'))) { localStorage.removeItem('snowify_state'); location.reload(); }
  });

  // ── Changelog ──
  async function openChangelog(version, sinceVersion) {
    const modal = $('#changelog-modal'), body = $('#changelog-body'), meta = $('#changelog-meta'), title = $('#changelog-title');
    body.innerHTML = `<div class="changelog-loading"><div class="spinner"></div><p>${I18n.t('changelog.loading')}</p></div>`;
    meta.textContent = ''; title.textContent = I18n.t('changelog.title');
    modal.classList.remove('hidden');

    if (sinceVersion && compareSemver(sinceVersion, version) < 0) {
      const releases = await window.snowify.getRecentReleases();
      const missed = releases
        .filter(r => r.version && compareSemver(r.version, sinceVersion) > 0 && compareSemver(r.version, version) <= 0)
        .sort((a, b) => compareSemver(b.version, a.version));

      if (!missed.length) { return openChangelog(version); }

      title.textContent = missed.length === 1
        ? (missed[0].name || I18n.t('changelog.whatsNewVersion', { version }))
        : I18n.t('changelog.title');
      meta.textContent = missed.length > 1 ? I18n.t('changelog.updatesSince', { count: missed.length, version: sinceVersion }) : '';

      let html = '';
      missed.forEach((rel, i) => {
        if (missed.length > 1) {
          const dateStr = rel.date ? new Date(rel.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
          html += `<div class="changelog-version-section${i > 0 ? ' changelog-version-divider' : ''}">`;
          html += `<h2 class="changelog-version-heading">${escapeHtml(rel.name || `v${rel.version}`)}</h2>`;
          if (dateStr) html += `<p class="changelog-version-date">${dateStr}</p>`;
        }
        html += renderMarkdown(rel.body || '');
        if (missed.length > 1) html += '</div>';
      });
      body.innerHTML = html;

      if (missed.length === 1) {
        const rel = missed[0];
        title.textContent = rel.name || I18n.t('changelog.whatsNewVersion', { version: rel.version });
        if (rel.date) {
          const d = new Date(rel.date);
          meta.textContent = I18n.t('changelog.released', { date: d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) });
        }
      }
    } else {
      const data = await window.snowify.getChangelog(version);
      if (!data || !data.body) { body.innerHTML = `<div class="changelog-empty"><p>${I18n.t('changelog.noChangelog')}</p></div>`; meta.textContent = `v${version}`; return; }
      title.textContent = data.name || I18n.t('changelog.whatsNewVersion', { version: data.version });
      if (data.date) { const d = new Date(data.date); meta.textContent = I18n.t('changelog.released', { date: d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) }); }
      body.innerHTML = renderMarkdown(data.body);
    }

    body.querySelectorAll('a[href]').forEach(a => {
      a.addEventListener('click', (e) => { e.preventDefault(); window.snowify.openExternal(a.href); });
    });
  }

  function closeChangelog() { $('#changelog-modal').classList.add('hidden'); }
  $('#changelog-close').addEventListener('click', closeChangelog);
  $('#changelog-ok').addEventListener('click', closeChangelog);
  $('#changelog-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeChangelog(); });

  $('#btn-open-changelog').addEventListener('click', async () => {
    openChangelog(await window.snowify.getVersion());
  });
  $('#btn-discord-server').addEventListener('click', () => { window.snowify.openExternal('https://discord.gg/JHDZraE5TD'); });

  // Show changelog after update
  (async () => {
    const version        = await window.snowify.getVersion();
    const lastSeenVersion = localStorage.getItem('snowify_last_changelog_version');
    if (lastSeenVersion && lastSeenVersion !== version) setTimeout(() => openChangelog(version, lastSeenVersion), 1500);
    localStorage.setItem('snowify_last_changelog_version', version);
  })();

  // ── Version label ──
  (async () => { $('#app-version-label').textContent = `v${await window.snowify.getVersion()}`; })();

  // ── Update banner ──
  const _updateBanner    = $('#update-banner');
  const _updateBannerMsg = $('#update-banner-msg');
  function showUpdateBanner(msg, version) {
    const key = `snowify_update_dismissed_${version}`;
    if (localStorage.getItem(key)) return;
    _updateBannerMsg.textContent = msg;
    _updateBanner.style.display = '';
    $('#update-banner-go').onclick = () => callbacks.switchView('settings');
    $('#update-banner-dismiss').onclick = () => { _updateBanner.style.display = 'none'; localStorage.setItem(key, '1'); };
  }

  const btnCheckUpdate   = $('#btn-check-update');
  const btnInstallUpdate = $('#btn-install-update');
  const updateStatusRow  = $('#update-status-row');
  const updateStatusLabel = $('#update-status-label');
  const updateStatusDesc = $('#update-status-desc');

  btnCheckUpdate.addEventListener('click', async () => {
    btnCheckUpdate.disabled    = true;
    btnCheckUpdate.textContent = I18n.t('settings.checking');
    updateStatusRow.style.display = ''; updateStatusLabel.textContent = I18n.t('update.checking');
    updateStatusDesc.textContent = ''; btnInstallUpdate.style.display = 'none';
    await window.snowify.checkForUpdates();
    setTimeout(() => { btnCheckUpdate.disabled = false; btnCheckUpdate.textContent = I18n.t('settings.checkUpdates'); }, 3000);
  });

  btnInstallUpdate.addEventListener('click', () => {
    btnInstallUpdate.disabled = true; btnInstallUpdate.textContent = I18n.t('settings.downloading');
    window.snowify.installUpdate();
  });

  window.snowify.onUpdateStatus((data) => {
    updateStatusRow.style.display = '';
    switch (data.status) {
      case 'checking':
        updateStatusLabel.textContent = I18n.t('update.checking'); updateStatusDesc.textContent = ''; btnInstallUpdate.style.display = 'none'; break;
      case 'available':
        updateStatusLabel.textContent = I18n.t('update.available', { version: data.version }); updateStatusDesc.textContent = I18n.t('update.availableDesc');
        btnInstallUpdate.style.display = ''; btnInstallUpdate.disabled = false; btnInstallUpdate.textContent = I18n.t('settings.downloadInstall');
        showUpdateBanner(`Update available: v${data.version} — download it in Settings.`, data.version); break;
      case 'up-to-date':
        updateStatusLabel.textContent = I18n.t('update.upToDate'); updateStatusDesc.textContent = ''; btnInstallUpdate.style.display = 'none'; break;
      case 'downloading':
        updateStatusLabel.textContent = I18n.t('update.downloading', { percent: data.percent }); updateStatusDesc.textContent = ''; btnInstallUpdate.style.display = 'none'; break;
      case 'downloaded':
        updateStatusLabel.textContent = I18n.t('update.downloaded', { version: data.version }); updateStatusDesc.textContent = I18n.t('update.downloadedDesc');
        btnInstallUpdate.style.display = ''; btnInstallUpdate.disabled = false; btnInstallUpdate.textContent = I18n.t('settings.restartUpdate');
        btnInstallUpdate.onclick = () => window.snowify.installUpdate();
        showUpdateBanner(`v${data.version} is ready — restart AudioHoard to apply the update.`, data.version); break;
      case 'error': {
        updateStatusLabel.textContent = I18n.t('update.error');
        let errMsg = data.message || '';
        if (errMsg.includes('latest.yml') || errMsg.includes('latest-linux.yml')) errMsg = I18n.t('update.errorNoMetadata');
        else if (errMsg.includes('net::') || errMsg.includes('ENOTFOUND')) errMsg = I18n.t('update.errorNoConnection');
        else if (errMsg.length > 120) errMsg = errMsg.slice(0, 120) + '\u2026';
        updateStatusDesc.textContent = errMsg; btnInstallUpdate.style.display = 'none'; break;
      }
    }
  });

  // ── Developer section ──
  const _rendererLogs = [];
  const _maxRendererLogs = 200;
  function pushRendererLog(level, msg) {
    const ts = new Date().toISOString().slice(11, 23);
    _rendererLogs.push({ ts, level, msg, source: 'renderer' });
    if (_rendererLogs.length > _maxRendererLogs) _rendererLogs.shift();
  }
  const _origLog = console.log.bind(console), _origWarn = console.warn.bind(console), _origErr = console.error.bind(console);
  console.log   = (...args) => { pushRendererLog('log',  args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')); _origLog(...args);  };
  console.warn  = (...args) => { pushRendererLog('warn', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')); _origWarn(...args); };
  console.error = (...args) => { pushRendererLog('error',args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')); _origErr(...args);  };

  const devModeToggle  = $('#setting-dev-mode');
  const devModeContent = $('#dev-mode-content');
  devModeToggle.checked = localStorage.getItem('snowify_dev_mode') === '1';
  devModeContent.style.display = devModeToggle.checked ? '' : 'none';
  devModeToggle.addEventListener('change', () => {
    localStorage.setItem('snowify_dev_mode', devModeToggle.checked ? '1' : '0');
    devModeContent.style.display = devModeToggle.checked ? '' : 'none';
    if (devModeToggle.checked) { refreshLogs(); loadVersions(); }
  });

  const _VM_COLLAPSED = 5;
  let _vmLoaded = false;
  async function loadVersions() {
    if (_vmLoaded) return;
    const listEl = $('#version-manager-list');
    const currentVersion = await window.snowify.getVersion();
    try {
      const releases = await window.snowify.getRecentReleases();
      if (!releases || !releases.length) { listEl.innerHTML = `<div class="version-manager-empty">${I18n.t('settings.noReleases')}</div>`; _vmLoaded = true; return; }
      const platform = window.snowify.platform;
      let html = '';
      releases.forEach((r, idx) => {
        const isCurrent = r.version === currentVersion;
        const dateStr = r.date ? new Date(r.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
        let downloadAsset = null;
        if (r.assets?.length) {
          for (const a of r.assets) {
            const n = a.name.toLowerCase();
            if (platform === 'linux'  && (n.endsWith('.appimage') || n.endsWith('.deb'))) { downloadAsset = a; break; }
            if (platform === 'win32'  && n.endsWith('.exe'))  { downloadAsset = a; break; }
            if (platform === 'darwin' && (n.endsWith('.dmg') || n.endsWith('.zip'))) { downloadAsset = a; break; }
          }
          if (!downloadAsset) downloadAsset = r.assets.find(a => !a.name.endsWith('.yml') && !a.name.endsWith('.yaml') && !a.name.endsWith('.blockmap'));
        }
        const sizeStr     = downloadAsset ? `${(downloadAsset.size / 1024 / 1024).toFixed(1)} MB` : '';
        const tag         = isCurrent ? `<span class="version-tag version-tag-current">${I18n.t('settings.currentVersion')}</span>` : '';
        const downloadBtn = !isCurrent && downloadAsset
          ? `<button class="btn-setting-action btn-version-download" data-url="${escapeHtml(downloadAsset.url)}">${I18n.t('settings.download')}</button>`
          : !isCurrent && r.url ? `<button class="btn-setting-action btn-version-download" data-url="${escapeHtml(r.url)}">${I18n.t('settings.viewRelease')}</button>` : '';
        const hidden = idx >= _VM_COLLAPSED ? ' style="display:none" data-vm-extra' : '';
        html += `<div class="version-manager-item${isCurrent ? ' version-current' : ''}"${hidden}><div class="version-manager-info"><span class="version-manager-name">v${escapeHtml(r.version)} ${tag}</span><span class="version-manager-meta">${escapeHtml(dateStr)}${sizeStr ? ' · ' + sizeStr : ''}</span></div>${downloadBtn}</div>`;
      });
      if (releases.length > _VM_COLLAPSED) html += `<button class="version-manager-show-more" id="btn-vm-show-more">${I18n.t('settings.showOlderVersions', { count: releases.length - _VM_COLLAPSED })}</button>`;
      listEl.innerHTML = html;
      listEl.querySelectorAll('.btn-version-download').forEach(btn => btn.addEventListener('click', () => window.snowify.openExternal(btn.dataset.url)));
      const showMoreBtn = listEl.querySelector('#btn-vm-show-more');
      if (showMoreBtn) showMoreBtn.addEventListener('click', () => { listEl.querySelectorAll('[data-vm-extra]').forEach(el => el.style.display = ''); showMoreBtn.remove(); });
      _vmLoaded = true;
    } catch (_) { listEl.innerHTML = `<div class="version-manager-empty">${I18n.t('settings.releasesError')}</div>`; }
  }

  const logsOutput    = $('#debug-logs-output');
  const logsContainer = $('#debug-logs-container');

  async function refreshLogs() {
    try {
      const mainLogs = await window.snowify.getLogs();
      const all = [...mainLogs.map(l => ({ ...l, source: 'main' })), ..._rendererLogs].sort((a, b) => a.ts.localeCompare(b.ts));
      logsOutput.innerHTML = all.map(l => {
        const lt = l.level === 'error' ? 'ERR' : l.level === 'warn' ? 'WRN' : 'LOG';
        return `<span class="log-line log-${l.level}">[${l.ts}] [${l.source === 'main' ? 'main' : 'renderer'}] [${lt}] ${escapeHtml(l.msg)}</span>`;
      }).join('\n') || `<span class="log-empty">${I18n.t('settings.noLogs')}</span>`;
      logsContainer.scrollTop = logsContainer.scrollHeight;
    } catch (_) { logsOutput.textContent = 'Failed to load logs'; }
  }

  const _logsObserver = new MutationObserver(() => {
    if ($('#view-settings').classList.contains('active') && devModeToggle.checked) { refreshLogs(); loadVersions(); }
  });
  _logsObserver.observe($('#view-settings'), { attributes: true, attributeFilter: ['class'] });
  if (devModeToggle.checked) { refreshLogs(); loadVersions(); }

  $('#btn-copy-logs').addEventListener('click', async () => {
    await refreshLogs(); navigator.clipboard.writeText(logsOutput.textContent).then(() => showToast(I18n.t('settings.logsCopied')));
  });
  $('#btn-clear-logs').addEventListener('click', () => { _rendererLogs.length = 0; logsOutput.innerHTML = ''; showToast(I18n.t('settings.logsCleared')); });

  // ── Wrapped dev preview ──
  if (!document.getElementById('btn-preview-wrapped')) {
    const devWrappedBtn = document.createElement('div');
    devWrappedBtn.className = 'setting-row';
    devWrappedBtn.innerHTML = `
    <div class="setting-info">
      <span class="setting-label" data-i18n="settings.devWrapped">${I18n.t('settings.devWrapped')}</span>
      <span class="setting-desc" data-i18n="settings.devWrappedDesc">${I18n.t('settings.devWrappedDesc')}</span>
    </div>
    <button class="btn-setting-action" id="btn-preview-wrapped" data-i18n="settings.devWrappedBtn">${I18n.t('settings.devWrappedBtn')}</button>`;
    devModeContent.appendChild(devWrappedBtn);
    document.getElementById('btn-preview-wrapped')?.addEventListener('click', () => {
      const year = new Date().getFullYear();
      const targetYear = state.playLog.some(e => new Date(e.ts).getFullYear() === year) ? year : year - 1;
      window.WrappedManager?.show(targetYear, true);
    });
  }

  // ── Source lists ──
  function renderSourceList(listEl, available, enabled, onChange) {
    listEl.innerHTML = '';
    const enabledSet = new Set(enabled);
    const ordered = [
      ...enabled.filter(id => available.find(s => s.id === id)),
      ...available.filter(s => !enabledSet.has(s.id)).map(s => s.id),
    ];
    ordered.forEach((sourceId) => {
      const def = available.find(s => s.id === sourceId); if (!def) return;
      const isEnabled  = enabledSet.has(sourceId);
      const enabledPos = enabled.indexOf(sourceId);
      const isPrimary  = enabledPos === 0;
      const label = def.label ?? (def.labelKey ? I18n.t(def.labelKey) : sourceId);
      const desc  = def.desc  ?? (def.descKey  ? I18n.t(def.descKey)  : '');
      const item  = document.createElement('div');
      item.className     = 'source-item' + (isEnabled ? ' source-enabled' : ' source-disabled');
      item.dataset.sourceId = sourceId;
      item.innerHTML = `
        <div class="source-item-arrows">
          <button class="source-arrow-btn" data-dir="up" ${enabledPos <= 0 ? 'disabled' : ''} aria-label="Move up"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5z"/></svg></button>
          <button class="source-arrow-btn" data-dir="down" ${!isEnabled || enabledPos >= enabled.length - 1 ? 'disabled' : ''} aria-label="Move down"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg></button>
        </div>
        <div class="source-item-info"><span class="source-item-name">${escapeHtml(label)}</span><span class="source-item-desc">${escapeHtml(desc)}</span></div>
        ${isEnabled ? `<span class="source-badge ${isPrimary ? 'source-badge-primary' : 'source-badge-fallback'}">${I18n.t(isPrimary ? 'settings.sourcePrimary' : 'settings.sourceFallback')}</span>` : ''}
        <label class="toggle-switch source-item-toggle"><input type="checkbox" ${isEnabled ? 'checked' : ''}><span class="toggle-slider"></span></label>`;
      listEl.appendChild(item);

      item.querySelector('input[type=checkbox]').addEventListener('change', (e) => {
        const newEnabled = [...enabled];
        if (e.target.checked) { if (!newEnabled.includes(sourceId)) newEnabled.push(sourceId); }
        else {
          if (newEnabled.length <= 1) { e.target.checked = true; showToast(I18n.t('toast.atLeastOneSource')); return; }
          const i = newEnabled.indexOf(sourceId); if (i !== -1) newEnabled.splice(i, 1);
        }
        enabled = newEnabled; onChange(newEnabled); renderSourceList(listEl, available, enabled, onChange);
      });

      item.querySelectorAll('.source-arrow-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = btn.dataset.dir, newEnabled = [...enabled], i = newEnabled.indexOf(sourceId); if (i === -1) return;
          if (dir === 'up' && i > 0) { [newEnabled[i], newEnabled[i-1]] = [newEnabled[i-1], newEnabled[i]]; }
          else if (dir === 'down' && i < newEnabled.length - 1) { [newEnabled[i], newEnabled[i+1]] = [newEnabled[i+1], newEnabled[i]]; }
          enabled = newEnabled; onChange(newEnabled); renderSourceList(listEl, available, enabled, onChange);
        });
      });
    });
  }

  const songListEl = $('#song-sources-list');
  const metaListEl = $('#meta-sources-list');
  function renderAllSourceLists() {
    if (songListEl) renderSourceList(songListEl, window.SnowifySources._song, state.songSources, (v) => { state.songSources = v; callbacks.saveState(); });
    if (metaListEl) renderSourceList(metaListEl, window.SnowifySources._meta, state.metadataSources, (v) => { state.metadataSources = v; callbacks.saveState(); });
  }
  window.SnowifySources._refreshSources = renderAllSourceLists;
  renderAllSourceLists();
}

// ─── resettable for I18n.onChange ────────────────────────────────────────────
export function resetSettingsInitialized() {
  _settingsInitialized = false;
}
