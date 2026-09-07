import state from './modules/state.js';
import { showToast, escapeHtml } from './modules/utils.js';
import { populateCustomThemes, upsertThemeBuilderTheme, applyTheme } from './modules/theme.js';
import { audioRef } from './modules/audio-ref.js';
import { callbacks } from './modules/callbacks.js';
import { closeLyricsPanel } from './modules/lyrics.js';
import { extractDominantColor, openMaxNP, closeMaxNP } from './modules/now-playing.js';
import { setVolume, togglePlay, playNext, playPrev, playTrack, updateRepeatButton, showNowPlaying, getPrefetchCache } from './modules/player.js';
import { renderQueue } from './modules/queue.js';
import { renderPlaylists, renderLibrary, renderSidebarArtists } from './modules/library.js';
import { renderHome } from './modules/home.js';
import { renderExplore } from './modules/explore.js';
import { showAlbumDetail } from './modules/album.js';
import { openArtistPage } from './modules/artist.js';
import { syncSearchHint, closeSuggestions } from './modules/search.js';
import { initSettings, resetSettingsInitialized } from './modules/settings.js';
import { loadEnabledPlugins } from './modules/plugins.js';
import { initProfiles } from './modules/profiles.js';
import {
  captureActiveProfileData,
  applyActiveProfileData,
  normalizeProfileDataMap,
} from './modules/profile-data.js';

'use strict';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const IS_MOBILE_RUNTIME =
  window.snowify?.platform === 'android' ||
  window.snowify?.platform === 'ios' ||
  document.documentElement.classList.contains('platform-mobile') ||
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

function resolveImageUrl(url) {
  if (!url) return url;
  return window.snowify?.resolveImageUrl?.(url) || deproxyUrl(url);
}

const MOBILE_PROXY_PREFIX = 'http://127.0.0.1:17890/stream?url=';

function deproxyUrl(url) {
  if (typeof url !== 'string' || !url.startsWith(MOBILE_PROXY_PREFIX)) return url;
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('url') || url;
  } catch {
    return url;
  }
}

function normalizeForCloud(value) {
  if (Array.isArray(value)) return value.map(normalizeForCloud);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeForCloud(v);
    return out;
  }
  if (typeof value === 'string') return deproxyUrl(value);
  return value;
}

// ─── Throttled image loader — prevents 429 from simultaneous thumbnail requests ───
// Images use `data-src` in templates; a MutationObserver feeds them into this queue.
const _imgQ = (() => {
  const CONCURRENCY = IS_MOBILE_RUNTIME ? 1 : 2; // mobile is more aggressive with per-host throttling
  const RETRY_MS = IS_MOBILE_RUNTIME ? [4000, 11000, 22000] : [2500, 7000, 18000];
  const START_GAP = IS_MOBILE_RUNTIME ? 180 : 80;
  let _active = 0;
  let _drainPending = false;
  const _queue = [];
  const _queued = new Set();
  const _loaded = new Set();                // URLs known to be loaded successfully
  const _inFlight = new Map();              // src -> { els:Set<HTMLImageElement>, attempt:number }
  const _forceReloadEls = new WeakSet();    // elements that should bypass currentSrc check in _applySrc
  let _errorStreak = 0;
  let _resumeAt = 0;

  const _jitter = ms => ms * (0.75 + Math.random() * 0.5); // ±25% jitter

  function _applySrc(el, src) {
    if (!el || !el.isConnected) return;
    if (el.dataset.src === src) el.removeAttribute('data-src');
    const resolvedSrc = resolveImageUrl(src);
    const forced = _forceReloadEls.has(el);
    if (forced) _forceReloadEls.delete(el);
    if (!forced && (el.getAttribute('src') === resolvedSrc || el.currentSrc === resolvedSrc)) return;
    el.loading = 'lazy';
    el.decoding = 'async';
    el.classList.remove('img-error');
    el.src = resolvedSrc;
  }

  function _drain() {
    _drainPending = false;
    if (_resumeAt > Date.now()) {
      if (!_drainPending) {
        _drainPending = true;
        setTimeout(_drain, Math.max(40, _resumeAt - Date.now()));
      }
      return;
    }
    if (_active >= CONCURRENCY || !_queue.length) return;
    const next = _queue.shift();
    if (!next) return;
    _queued.delete(next.src);
    _start(next);
    // Schedule the next slot after a small gap to prevent simultaneous burst
    if (!_drainPending && _queue.length && _active < CONCURRENCY) {
      _drainPending = true;
      setTimeout(_drain, START_GAP);
    }
  }

  function _start({ src, attempt }) {
    _active++;
    const probe = new Image();
    probe.decoding = 'async';
    const resolvedSrc = resolveImageUrl(src);
    probe.onload = () => {
      _active--;
      _errorStreak = 0;
      _resumeAt = 0;
      _loaded.add(src);
      const entry = _inFlight.get(src);
      _inFlight.delete(src);
      entry?.els.forEach(el => _applySrc(el, src));
      _drain();
    };
    probe.onerror = () => {
      _active--;
      const entry = _inFlight.get(src);
      _inFlight.delete(src);
      const liveEls = [...(entry?.els || [])].filter(el => el && el.isConnected);

      const _applyError = () => {
        // Show placeholder immediately — don't leave a blank dark box while retrying.
        liveEls.forEach(el => el.classList.add('img-error'));
        _errorStreak = Math.min(10, _errorStreak + 1);
        if (IS_MOBILE_RUNTIME) {
          // Brief global cooldown helps avoid repeated host throttling bursts.
          const cooldown = Math.min(12000, 1200 + (_errorStreak * 900));
          _resumeAt = Math.max(_resumeAt, Date.now() + cooldown);
        }
        if (attempt < RETRY_MS.length && liveEls.length) {
          setTimeout(() => {
            if (!liveEls.some(el => el.isConnected)) return;
            _inFlight.set(src, { els: new Set(liveEls.filter(el => el.isConnected)), attempt: attempt + 1 });
            if (!_queued.has(src)) {
              _queued.add(src);
              _queue.push({ src, attempt: attempt + 1 });
            }
            _drain();
          }, _jitter(RETRY_MS[attempt]));
        } else if (liveEls.length) {
          // Keep slow-retrying every ~18s indefinitely instead of giving up
          setTimeout(() => {
            const stillLive = liveEls.filter(el => el.isConnected);
            if (!stillLive.length) return;
            if (_loaded.has(src)) { stillLive.forEach(el => _applySrc(el, src)); return; }
            _inFlight.set(src, { els: new Set(stillLive), attempt: RETRY_MS.length - 1 });
            if (!_queued.has(src)) {
              _queued.add(src);
              _queue.push({ src, attempt: RETRY_MS.length - 1 });
            }
            _drain();
          }, _jitter(RETRY_MS[RETRY_MS.length - 1]));
        }
        _drain();
      };

      if (IS_MOBILE_RUNTIME) {
        // On mobile all images go through the local proxy. Use fetch to distinguish
        // dead images (4xx — give up silently, no error-streak penalty so a handful
        // of expired CDN URLs don't cascade-stall the whole queue) from genuine
        // proxy / network failures (retryable with normal streak + cooldown).
        // Show placeholder while the probe is in flight.
        liveEls.forEach(el => el.classList.add('img-error'));
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        fetch(resolvedSrc, { signal: ctrl.signal, cache: 'no-store' })
          .then(res => {
            clearTimeout(timer);
            if (res.ok) {
              // Recovered during probe — apply to waiters without penalising streak.
              _loaded.add(src);
              liveEls.forEach(el => _applySrc(el, src));
              _drain();
            } else if (res.status >= 400 && res.status < 500) {
              // Dead image (404 / 410 / etc.) — give up silently.
              _drain();
            } else {
              _applyError(); // 5xx — treat as transient
            }
          })
          .catch(() => {
            clearTimeout(timer);
            _applyError(); // Network / proxy error — apply streak and retry.
          });
        return; // _drain is called inside fetch callbacks above
      }

      _applyError();
    };
    probe.src = resolvedSrc;
  }

  // IntersectionObserver: only enqueue when image enters extended viewport.
  // 300px root margin means images start loading just before scrolling into view.
  // This prevents the burst of 40+ simultaneous requests on track list renders.
  const _io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      _io.unobserve(el);
      const src = el.dataset.src;
      if (!src) continue;
      // data: URIs are self-contained — never need a network probe.
      if (src.startsWith('data:')) { _applySrc(el, src); continue; }
      if (el.getAttribute('src') === src || el.currentSrc === src) {
        el.removeAttribute('data-src');
        _loaded.add(src);
        continue;
      }
      if (_loaded.has(src)) {
        _applySrc(el, src);
        continue;
      }
      const existing = _inFlight.get(src);
      if (existing) {
        existing.els.add(el);
        el.removeAttribute('data-src');
        continue;
      }
      el.removeAttribute('data-src');
      _inFlight.set(src, { els: new Set([el]), attempt: 0 });
      if (!_queued.has(src)) {
        _queued.add(src);
        _queue.push({ src, attempt: 0 });
      }
      _drain();
    }
  }, { rootMargin: '300px 0px' });

  return {
    enqueue(el) {
      if (!el.dataset.src) return;
      const src = el.dataset.src;
      if (!src) return;
      // data: URIs are self-contained — apply immediately, no network probe needed.
      if (src.startsWith('data:')) { _applySrc(el, src); return; }
      if (el.getAttribute('src') === src || el.currentSrc === src || _loaded.has(src)) {
        _applySrc(el, src);
        return;
      }
      const existing = _inFlight.get(src);
      if (existing) {
        existing.els.add(el);
        el.removeAttribute('data-src');
        return;
      }
      if (_queued.has(src)) {
        _io.observe(el);
        return;
      }
      _io.observe(el); // defer until near viewport
    },
    bust(src) {
      _loaded.delete(src);
      _queued.delete(src);
      _inFlight.delete(src);
    },
    // Force-reload: bypasses _loaded / currentSrc checks and goes straight to probe.
    reload(el, src) {
      if (!src || src.startsWith('data:')) return;
      _loaded.delete(src);
      _queued.delete(src);
      _inFlight.delete(src);
      _io.unobserve(el);
      // Mark so _applySrc skips the currentSrc short-circuit for this element.
      _forceReloadEls.add(el);
      el.dataset.src = src;
      _inFlight.set(src, { els: new Set([el]), attempt: 0 });
      _queued.add(src);
      _queue.push({ src, attempt: 0 });
      _drain();
    },
  };
})();

// Auto-process any img[data-src] inserted into the DOM
new MutationObserver(muts => {
  for (const m of muts)
    for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'IMG' && n.dataset.src) _imgQ.enqueue(n);
      else n.querySelectorAll?.('img[data-src]').forEach(e => _imgQ.enqueue(e));
    }
}).observe(document.documentElement, { childList: true, subtree: true });

// ─── Auto marquee for truncated titles/artists ───
const _MARQUEE_SELECTORS = [
  '.np-title',
  '.np-artist',
  '.max-np-title',
  '.max-np-artist',
  '.max-np-topbar-title',
  '.max-np-topbar-artist',
  '.track-title',
  '.track-artist-col',
  '.card-title',
  '.card-artist',
  '.queue-item-title',
  '.queue-item-artist',
  '.suggestion-title',
  '.suggestion-subtitle',
  '.search-suggestion-text',
  '.playlist-name',
  '.album-card-name',
  '.album-card-meta',
  '.lib-card-name',
  '.video-card-name',
  '.top-song-title',
  '.top-song-artist',
  '.similar-artist-name'
].join(', ');

let _marqueeRefreshRAF = 0;

function _applyAutoMarquee(el) {
  if (!el || !el.isConnected) return;
  el.classList.add('auto-marquee-target');

  let inner = el.querySelector(':scope > .auto-marquee-inner');
  if (!inner) {
    inner = document.createElement('span');
    inner.className = 'auto-marquee-inner';
    while (el.firstChild) inner.appendChild(el.firstChild);
    el.appendChild(inner);
  }

  // Hidden/collapsed elements should not animate.
  if (el.offsetParent === null || el.clientWidth <= 0) {
    el.classList.remove('auto-marquee-active');
    return;
  }

  const overflowPx = Math.ceil(inner.scrollWidth - el.clientWidth);
  if (overflowPx > 12) {
    const distance = Math.min(overflowPx + 18, 680);
    const duration = Math.max(6, Math.min(18, distance / 22));
    el.style.setProperty('--marquee-distance', `${distance}px`);
    el.style.setProperty('--marquee-duration', `${duration}s`);
    el.classList.add('auto-marquee-active');
  } else {
    el.classList.remove('auto-marquee-active');
    el.style.removeProperty('--marquee-distance');
    el.style.removeProperty('--marquee-duration');
  }
}

function refreshAutoMarquee() {
  _marqueeRefreshRAF = 0;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.auto-marquee-active').forEach(el => el.classList.remove('auto-marquee-active'));
    return;
  }
  document.querySelectorAll(_MARQUEE_SELECTORS).forEach(_applyAutoMarquee);
}

function scheduleAutoMarqueeRefresh() {
  if (_marqueeRefreshRAF) return;
  _marqueeRefreshRAF = requestAnimationFrame(refreshAutoMarquee);
}

new MutationObserver(() => {
  scheduleAutoMarqueeRefresh();
}).observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true
});

window.addEventListener('resize', scheduleAutoMarqueeRefresh);
window.addEventListener('orientationchange', scheduleAutoMarqueeRefresh);
setInterval(scheduleAutoMarqueeRefresh, 4000);
setTimeout(scheduleAutoMarqueeRefresh, 250);

  const appEl = $('#app');

  const views = $$('.view');
  const navBtns = $$('.nav-btn');

  $('#btn-minimize')?.addEventListener('click', () => window.snowify.minimize());
  $('#btn-maximize')?.addEventListener('click', () => window.snowify.maximize());
  $('#btn-close')?.addEventListener('click', () => window.snowify.close());

  async function initContentHoardSwitcher() {
    const contentHoard = window.snowify?.contentHoard;
    const button = $('#contenthoard-switcher-btn');
    if (!contentHoard?.open || !button) return;
    button.classList.remove('hidden');
    button.addEventListener('click', () => {
      contentHoard.open?.();
    });
  }

  initContentHoardSwitcher();

  function initContentHoardSharedStateListener() {
    const contentHoard = window.snowify?.contentHoard;
    if (!contentHoard?.enabled || !contentHoard.onSharedStateUpdated) return;
    contentHoard.onSharedStateUpdated((shared) => {
      if (!shared || typeof shared !== 'object') return;
      // Profile sync from ContentHoard is intentionally only at launch time
      // (via env vars), not during runtime. Child apps manage profiles
      // independently once launched. Theme and savedThemes still sync live.
      if (shared.profiles && Array.isArray(shared.profiles)) {
        // Cache profile data for reference
        const previousActiveId = (() => {
          try { return localStorage.getItem('audiohoard-contenthoard-cached-activeProfileId') || ''; } catch { return ''; }
        })();
        try {
          localStorage.setItem('audiohoard-contenthoard-cached-profiles', JSON.stringify(shared.profiles));
          if (shared.activeProfileId) {
            localStorage.setItem('audiohoard-contenthoard-cached-activeProfileId', String(shared.activeProfileId));
          }
        } catch { /* ignore */ }

        let changed = false;
        let pendingSwitchId = null;
        try {
          let trackedIds = JSON.parse(localStorage.getItem('audiohoard-contenthoard-profile-ids') || '[]');
          if (!Array.isArray(trackedIds)) trackedIds = [];
          const chIds = new Set(shared.profiles.map(function(p) { return String(p.id); }));

          // Sync deletions: if a profile that originated from ContentHoard
          // is no longer in ContentHoard's list, remove it locally.
          const toRemove = trackedIds.filter(function(id) { return !chIds.has(id); });
          if (toRemove.length) {
            toRemove.forEach(function(id) {
              state.profiles = state.profiles.filter(function(lp) { return lp.id !== id; });
              if (state.profileData) delete state.profileData[id];
            });
            if (toRemove.includes(state.activeProfileId)) {
              state.activeProfileId = state.profiles[0]?.id || null;
            }
            trackedIds = trackedIds.filter(function(id) { return chIds.has(id); });
            changed = true;
          }

          // Live upsert: mirror the full ContentHoard profile list so profiles
          // created in any Hoard app (via ContentHoard) reach this one too.
          shared.profiles.forEach(function(p) {
            const id = String(p.id);
            if (!id) return;
            const local = state.profiles.find(function(lp) { return lp.id === id; });
            if (local) {
              const name = String(p.name || local.name);
              const icon = String(p.icon || local.icon);
              const color = String(p.color || local.color);
              if (local.name !== name || local.icon !== icon || local.color !== color) {
                local.name = name;
                local.icon = icon;
                local.color = color;
                changed = true;
              }
            } else {
              state.profiles.push({
                id: id,
                name: String(p.name || 'ContentHoard'),
                icon: String(p.icon || 'person'),
                color: String(p.color || '#39E079'),
                createdAt: Number(p.createdAt || Date.now()),
              });
              changed = true;
            }
            if (!trackedIds.includes(id)) trackedIds.push(id);
          });
          localStorage.setItem('audiohoard-contenthoard-profile-ids', JSON.stringify(trackedIds));

          // Follow ContentHoard's active profile when it changes (skip the
          // very first event so first contact never hijacks the local app).
          const nextActiveId = String(shared.activeProfileId || '');
          if (nextActiveId && previousActiveId && nextActiveId !== previousActiveId &&
              state.profiles.some(function(lp) { return lp.id === nextActiveId; })) {
            pendingSwitchId = nextActiveId;
          }
        } catch { /* ignore */ }

        if (changed) {
          _flushSaveState();
          if (typeof window.__renderProfiles === 'function') window.__renderProfiles();
        }
        // Defer the switch until this handler finishes so theme/savedThemes
        // below still apply before the reload triggered by switchProfile.
        if (pendingSwitchId && typeof window.__switchProfile === 'function') {
          setTimeout(function() { window.__switchProfile(pendingSwitchId); }, 50);
        }
      }
      if (shared.theme && typeof shared.theme === 'object') {
        const t = shared.theme;
        upsertThemeBuilderTheme({
          id: 'contenthoard-shared',
          name: 'ContentHoard Shared',
          settings: {
            backgroundColor: t.backgroundColor,
            surfaceColor: t.streamsBackgroundColor || t.surfaceColor,
            elevatedColor: t.menuBackgroundColor || t.elevatedColor,
            cardColor: t.streamsBackgroundColor || t.surfaceColor,
            accentColor: t.accentColor,
            textColor: t.textColor,
            secondaryTextColor: t.navTextColorUnselected || t.secondaryTextColor,
            subduedTextColor: t.navTextColorUnselected || t.secondaryTextColor,
            navBackgroundColor: t.navBackgroundColor,
            navTextColorUnselected: t.navTextColorUnselected || t.secondaryTextColor,
            navTextColorSelected: t.navTextColorSelected,
            headerBackgroundColor: t.headerBackgroundColor || t.surfaceColor,
            dropdownBackgroundColor: t.dropdownBackgroundColor || t.elevatedColor,
            dropdownTextColor: t.dropdownTextColor || t.textColor,
            menuBackgroundColor: t.menuBackgroundColor || t.elevatedColor,
            menuTextColor: t.menuTextColor || t.textColor,
            headerText: t.audiohoardHeaderText || t.headerText || 'AudioHoard',
            logoUrl: t.audiohoardLogoUrl || t.logoUrl || '',
            cardGlowColor: t.cardGlowColor || 'rgba(255, 255, 255, 0.15)',
            isGlowEnabled: t.isGlowEnabled ?? true,
            glowIntensity: t.glowIntensity ?? 1,
            isGlassy: t.isGlassy,
            isTransparent: t.isTransparent,
            glassBlur: t.glassBlur,
            glassOpacity: t.glassOpacity,
            appFont: t.menuFont || t.headerFont,
            headerFont: t.headerFont,
            headerTextColor: t.headerTextColor || t.textColor,
            headingFont: t.titleFont || t.headerFont,
            titleTextColor: t.titleTextColor || t.textColor,
            navFont: t.navFont || t.headerFont,
            dropdownFont: t.dropdownFont || t.headerFont,
            menuFont: t.menuFont || t.headerFont,
          },
        }, { sync: false });
        applyTheme('builder:contenthoard-shared');
      }
      if (shared.savedThemes && Array.isArray(shared.savedThemes)) {
        shared.savedThemes.forEach((theme) => {
          if (!theme?.settings) return;
          upsertThemeBuilderTheme({
            id: `contenthoard-saved-${theme.id}`,
            name: theme.name || 'ContentHoard Theme',
            settings: {
              backgroundColor: theme.settings.backgroundColor,
              surfaceColor: theme.settings.streamsBackgroundColor || theme.settings.surfaceColor,
              elevatedColor: theme.settings.menuBackgroundColor || theme.settings.elevatedColor,
              cardColor: theme.settings.streamsBackgroundColor || theme.settings.surfaceColor,
              accentColor: theme.settings.accentColor,
              textColor: theme.settings.textColor,
              secondaryTextColor: theme.settings.navTextColorUnselected || theme.settings.secondaryTextColor,
              subduedTextColor: theme.settings.navTextColorUnselected || theme.settings.secondaryTextColor,
              navBackgroundColor: theme.settings.navBackgroundColor,
              navTextColorUnselected: theme.settings.navTextColorUnselected || theme.settings.secondaryTextColor,
              navTextColorSelected: theme.settings.navTextColorSelected,
              headerBackgroundColor: theme.settings.headerBackgroundColor || theme.settings.surfaceColor,
              dropdownBackgroundColor: theme.settings.dropdownBackgroundColor || theme.settings.elevatedColor,
              dropdownTextColor: theme.settings.dropdownTextColor || theme.settings.textColor,
              menuBackgroundColor: theme.settings.menuBackgroundColor || theme.settings.elevatedColor,
              menuTextColor: theme.settings.menuTextColor || theme.settings.textColor,
              headerText: theme.settings.audiohoardHeaderText || theme.settings.headerText || 'AudioHoard',
              logoUrl: theme.settings.audiohoardLogoUrl || theme.settings.logoUrl || '',
              cardGlowColor: theme.settings.cardGlowColor || 'rgba(255, 255, 255, 0.15)',
              isGlowEnabled: theme.settings.isGlowEnabled ?? true,
              glowIntensity: theme.settings.glowIntensity ?? 1,
              isGlassy: theme.settings.isGlassy,
              isTransparent: theme.settings.isTransparent,
              glassBlur: theme.settings.glassBlur,
              glassOpacity: theme.settings.glassOpacity,
              appFont: theme.settings.menuFont || theme.settings.headerFont,
              headerFont: theme.settings.headerFont,
              headerTextColor: theme.settings.headerTextColor || theme.settings.textColor,
              headingFont: theme.settings.titleFont || theme.settings.headerFont,
              titleTextColor: theme.settings.titleTextColor || theme.settings.textColor,
              navFont: theme.settings.navFont || theme.settings.headerFont,
              dropdownFont: theme.settings.dropdownFont || theme.settings.headerFont,
              menuFont: theme.settings.menuFont || theme.settings.headerFont,
            },
          }, { sync: false });
        });
      }
    });
  }

  initContentHoardSharedStateListener();

  let _saveStateTimer = null;
  function saveState() {
    if (_saveStateTimer) return; // already scheduled
    _saveStateTimer = setTimeout(() => {
      _saveStateTimer = null;
      _flushSaveState();
    }, 300);
  }
  function _flushSaveState() {
    if (_saveStateTimer) { clearTimeout(_saveStateTimer); _saveStateTimer = null; }
    captureActiveProfileData();
    try {
      localStorage.setItem('snowify_state', JSON.stringify({
        playlists: state.playlists,
        likedSongs: state.likedSongs,
        recentTracks: state.recentTracks,
        followedArtists: state.followedArtists,
        profileData: state.profileData,
        volume: state.volume,
        shuffle: state.shuffle,
        repeat: state.repeat,
        musicOnly: state.musicOnly,
        autoplay: state.autoplay,
        audioQuality: state.audioQuality,
        videoQuality: state.videoQuality,
        videoPremuxed: state.videoPremuxed,
        animations: state.animations,
        effects: state.effects,
        theme: state.theme,
        discordRpc: state.discordRpc,
        country: state.country,
        searchHistory: state.searchHistory,
        crossfade: state.crossfade,
        normalization: state.normalization,
        normalizationTarget: state.normalizationTarget,
        prefetchCount: state.prefetchCount,
        showListeningActivity: state.showListeningActivity,
        minimizeToTray: state.minimizeToTray,
        launchOnStartup: state.launchOnStartup,
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
        songSources: state.songSources,
        metadataSources: state.metadataSources,
        wrappedShownYear: state.wrappedShownYear,
      }));
      localStorage.setItem('snowify_lastSave', String(Date.now()));
    } catch (e) {
      console.error('State save failed (storage quota exceeded):', e);
    }
    // Queue persistence (local-only)
    try {
      localStorage.setItem('snowify_queue', JSON.stringify({
        queue: state.queue,
        originalQueue: state.originalQueue,
        queueIndex: state.queueIndex,
        playingPlaylistId: state.playingPlaylistId
      }));
    } catch (e) {
      console.error('Queue save failed (storage quota exceeded):', e);
    }
    // Play log — stored separately to avoid bloating the main state key
    try {
      localStorage.setItem('snowify_play_log', JSON.stringify(state.playLog));
    } catch (e) {
      console.warn('Play log save failed (quota?):', e);
    }
    // Genre cache — stored separately
    try {
      localStorage.setItem('snowify_genre_cache', JSON.stringify(state.trackGenreCache));
    } catch (e) {
      console.warn('Genre cache save failed (quota?):', e);
    }
  }

  function loadState() {
    const normalizeSongSources = (sources) => {
      const list = Array.isArray(sources) && sources.length ? sources : ['youtube'];
      const normalized = [...new Set(list.filter(Boolean))];
      if (!normalized.includes('youtube')) normalized.unshift('youtube');
      if (!normalized.includes('soundcloud')) normalized.push('soundcloud');
      return normalized;
    };

    try {
      // Migrate old 'snowfy' localStorage keys to 'snowify'
      if (localStorage.getItem('snowfy_state') && !localStorage.getItem('snowify_state')) {
        localStorage.setItem('snowify_state', localStorage.getItem('snowfy_state'));
        localStorage.removeItem('snowfy_state');
      }
      if (localStorage.getItem('snowfy_migrated_v2') && !localStorage.getItem('snowify_migrated_v2')) {
        localStorage.setItem('snowify_migrated_v2', localStorage.getItem('snowfy_migrated_v2'));
        localStorage.removeItem('snowfy_migrated_v2');
      }
      // One-time migration: clear data from old yt-dlp implementation
      if (!localStorage.getItem('snowify_migrated_v2')) {
        localStorage.removeItem('snowify_state');
        localStorage.setItem('snowify_migrated_v2', '1');
        return;
      }
      const rawSaved = JSON.parse(localStorage.getItem('snowify_state'));
      const saved = rawSaved ? normalizeForCloud(rawSaved) : null;
      if (saved) {
        state.playlists = saved.playlists || [];
        state.likedSongs = saved.likedSongs || [];
        state.recentTracks = saved.recentTracks || [];
        state.followedArtists = saved.followedArtists || [];
        state.volume = saved.volume ?? 0.7;
        state.shuffle = saved.shuffle ?? false;
        state.repeat = saved.repeat || 'off';
        state.musicOnly = saved.musicOnly ?? true;
        state.autoplay = saved.autoplay ?? true;
        state.audioQuality = saved.audioQuality || 'bestaudio';
        state.videoQuality = saved.videoQuality || '720';
        state.videoPremuxed = saved.videoPremuxed ?? true;
        state.animations = saved.animations ?? true;
        state.effects = saved.effects ?? true;
        state.miniplayerGlow = saved.miniplayerGlow ?? true;
        state.theme = saved.theme || 'dark';
        state.discordRpc = saved.discordRpc ?? false;
        state.country = saved.country || '';
        state.searchHistory = saved.searchHistory || [];
        state.crossfade = saved.crossfade ?? 0;
        state.normalization = saved.normalization ?? false;
        state.normalizationTarget = saved.normalizationTarget ?? -14;
        state.prefetchCount = saved.prefetchCount ?? 0;
        state.minimizeToTray = saved.minimizeToTray ?? false;
        state.launchOnStartup = saved.launchOnStartup ?? false;
        state.profiles = Array.isArray(saved.profiles) ? saved.profiles : [];
        state.activeProfileId = saved.activeProfileId || null;
        state.profileData = normalizeProfileDataMap(saved.profileData);
        applyActiveProfileData({ fallback: saved });
        state.songSources = normalizeSongSources(saved.songSources);
        state.metadataSources = saved.metadataSources || ['youtube'];
        state.wrappedShownYear = saved.wrappedShownYear ?? null;

        // Persist once after deproxying old mobile proxy URLs in local state.
        if (JSON.stringify(rawSaved) !== JSON.stringify(saved)) {
          localStorage.setItem('snowify_state', JSON.stringify(saved));
        }
      }
      const contentHoard = window.snowify?.contentHoard;
      if (contentHoard?.enabled && contentHoard.profile) {
        // Only use ContentHoard's profile on FIRST launch (no existing profiles).
        // After that, AudioHoard manages profiles independently.
        if (state.profiles.length === 0) {
          const sharedProfile = {
            id: String(contentHoard.profile.id || 'contenthoard'),
            name: String(contentHoard.profile.name || 'ContentHoard'),
            icon: String(contentHoard.profile.icon || 'person'),
            color: String(contentHoard.profile.color || '#39E079'),
            createdAt: Number(contentHoard.profile.createdAt || Date.now()),
          };
          state.profiles = [sharedProfile];
          state.activeProfileId = sharedProfile.id;
          // Track ContentHoard profile IDs for deletion sync
          try {
            localStorage.setItem('audiohoard-contenthoard-profile-ids', JSON.stringify([sharedProfile.id]));
          } catch { /* ignore */ }
        }
      }
      if (contentHoard?.enabled && contentHoard.theme) {
        const sharedTheme = contentHoard.theme;
        upsertThemeBuilderTheme({
          id: 'contenthoard-shared',
          name: 'ContentHoard Shared',
          settings: {
            backgroundColor: sharedTheme.backgroundColor,
            surfaceColor: sharedTheme.streamsBackgroundColor || sharedTheme.surfaceColor,
            elevatedColor: sharedTheme.menuBackgroundColor || sharedTheme.elevatedColor,
            cardColor: sharedTheme.streamsBackgroundColor || sharedTheme.surfaceColor,
            accentColor: sharedTheme.accentColor,
            textColor: sharedTheme.textColor,
            secondaryTextColor: sharedTheme.navTextColorUnselected || sharedTheme.secondaryTextColor,
            subduedTextColor: sharedTheme.navTextColorUnselected || sharedTheme.secondaryTextColor,
            navBackgroundColor: sharedTheme.navBackgroundColor,
            navTextColorUnselected: sharedTheme.navTextColorUnselected || sharedTheme.secondaryTextColor,
            navTextColorSelected: sharedTheme.navTextColorSelected,
            headerBackgroundColor: sharedTheme.headerBackgroundColor || sharedTheme.surfaceColor,
            dropdownBackgroundColor: sharedTheme.dropdownBackgroundColor || sharedTheme.elevatedColor,
            dropdownTextColor: sharedTheme.dropdownTextColor || sharedTheme.textColor,
            menuBackgroundColor: sharedTheme.menuBackgroundColor || sharedTheme.elevatedColor,
            menuTextColor: sharedTheme.menuTextColor || sharedTheme.textColor,
            headerText: sharedTheme.audiohoardHeaderText || sharedTheme.headerText || 'AudioHoard',
            logoUrl: sharedTheme.audiohoardLogoUrl || sharedTheme.logoUrl || '',
            cardGlowColor: sharedTheme.cardGlowColor || 'rgba(255, 255, 255, 0.15)',
            isGlowEnabled: sharedTheme.isGlowEnabled ?? true,
            glowIntensity: sharedTheme.glowIntensity ?? 1,
            isGlassy: sharedTheme.isGlassy,
            isTransparent: sharedTheme.isTransparent,
            glassBlur: sharedTheme.glassBlur,
            glassOpacity: sharedTheme.glassOpacity,
            appFont: sharedTheme.menuFont || sharedTheme.headerFont,
            headerFont: sharedTheme.headerFont,
            headerTextColor: sharedTheme.headerTextColor || sharedTheme.textColor,
            headingFont: sharedTheme.titleFont || sharedTheme.headerFont,
            titleTextColor: sharedTheme.titleTextColor || sharedTheme.textColor,
            navFont: sharedTheme.navFont || sharedTheme.headerFont,
            dropdownFont: sharedTheme.dropdownFont || sharedTheme.headerFont,
            menuFont: sharedTheme.menuFont || sharedTheme.headerFont,
          },
        }, { sync: false });
        state.theme = 'builder:contenthoard-shared';
      }
      if (contentHoard?.enabled && Array.isArray(contentHoard.savedThemes)) {
        contentHoard.savedThemes.forEach((theme) => {
          if (!theme?.settings) return;
          const sharedTheme = theme.settings;
          upsertThemeBuilderTheme({
            id: `contenthoard-saved-${theme.id}`,
            name: theme.name || 'ContentHoard Theme',
            settings: {
              backgroundColor: sharedTheme.backgroundColor,
              surfaceColor: sharedTheme.streamsBackgroundColor || sharedTheme.surfaceColor,
              elevatedColor: sharedTheme.menuBackgroundColor || sharedTheme.elevatedColor,
              cardColor: sharedTheme.streamsBackgroundColor || sharedTheme.surfaceColor,
              accentColor: sharedTheme.accentColor,
              textColor: sharedTheme.textColor,
              secondaryTextColor: sharedTheme.navTextColorUnselected || sharedTheme.secondaryTextColor,
              subduedTextColor: sharedTheme.navTextColorUnselected || sharedTheme.secondaryTextColor,
              navBackgroundColor: sharedTheme.navBackgroundColor,
              navTextColorUnselected: sharedTheme.navTextColorUnselected || sharedTheme.secondaryTextColor,
              navTextColorSelected: sharedTheme.navTextColorSelected,
              headerBackgroundColor: sharedTheme.headerBackgroundColor || sharedTheme.surfaceColor,
              dropdownBackgroundColor: sharedTheme.dropdownBackgroundColor || sharedTheme.elevatedColor,
              dropdownTextColor: sharedTheme.dropdownTextColor || sharedTheme.textColor,
              menuBackgroundColor: sharedTheme.menuBackgroundColor || sharedTheme.elevatedColor,
              menuTextColor: sharedTheme.menuTextColor || sharedTheme.textColor,
              headerText: sharedTheme.audiohoardHeaderText || sharedTheme.headerText || 'AudioHoard',
              logoUrl: sharedTheme.audiohoardLogoUrl || sharedTheme.logoUrl || '',
              cardGlowColor: sharedTheme.cardGlowColor || 'rgba(255, 255, 255, 0.15)',
              isGlowEnabled: sharedTheme.isGlowEnabled ?? true,
              glowIntensity: sharedTheme.glowIntensity ?? 1,
              isGlassy: sharedTheme.isGlassy,
              isTransparent: sharedTheme.isTransparent,
              glassBlur: sharedTheme.glassBlur,
              glassOpacity: sharedTheme.glassOpacity,
              appFont: sharedTheme.menuFont || sharedTheme.headerFont,
              headerFont: sharedTheme.headerFont,
              headerTextColor: sharedTheme.headerTextColor || sharedTheme.textColor,
              headingFont: sharedTheme.titleFont || sharedTheme.headerFont,
              titleTextColor: sharedTheme.titleTextColor || sharedTheme.textColor,
              navFont: sharedTheme.navFont || sharedTheme.headerFont,
              dropdownFont: sharedTheme.dropdownFont || sharedTheme.headerFont,
              menuFont: sharedTheme.menuFont || sharedTheme.headerFont,
            },
          }, { sync: false });
        });
      }
      if (IS_MOBILE_RUNTIME) {
        state.normalization = false;
      }
      // Restore queue from local-only storage.
      const rawSavedQueue = JSON.parse(localStorage.getItem('snowify_queue'));
      const savedQueue = rawSavedQueue ? normalizeForCloud(rawSavedQueue) : null;
      if (savedQueue) {
        state.queue = savedQueue.queue || [];
        state.originalQueue = savedQueue.originalQueue || [];
        state.queueIndex = savedQueue.queueIndex ?? -1;
        state.playingPlaylistId = savedQueue.playingPlaylistId || null;

        if (JSON.stringify(rawSavedQueue) !== JSON.stringify(savedQueue)) {
          localStorage.setItem('snowify_queue', JSON.stringify(savedQueue));
        }
      }
      // Play log, genre cache, and backfill are loaded async in loadPlayLogAsync()
      // to avoid blocking the main thread on startup.
    } catch (_) {}
  }

  function updateGreeting() {
    const h = new Date().getHours();
    const key = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
    $('#greeting-text').textContent = I18n.t('home.greeting.' + key);
  }

  function switchView(name) {
    const targetView = $(`#view-${name}`);
    const alreadyActive = state.currentView === name && targetView && targetView.classList.contains('active');

    state.currentView = name;
    views.forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === name));

    if (alreadyActive && targetView && state.animations) {
      targetView.style.animation = 'none';
      targetView.offsetHeight;
      targetView.style.animation = '';
    }

    closeLyricsPanel();

    if (name === 'home') {
      renderHome();
    }
    if (name === 'explore') {
      renderExplore();
    }
    if (name === 'search') {
      syncSearchHint();
      setTimeout(() => $('#search-input').focus(), 100);
    }
    if (name === 'library') {
      renderLibrary();
    }
    // Social listeners remain active while signed in; only stopped on sign-out
    if (name === 'settings') {
      const ts = $('#theme-select');
      if (ts) populateCustomThemes(ts, state.theme);
    }

    updateFloatingSearch();
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // ── Sidebar collapse toggle ──
  const btnToggleSidebar = $('#btn-toggle-sidebar');
  const SIDEBAR_COLLAPSED_KEY = 'snowify_sidebar_collapsed';
  let _sidebarCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '0';

  function applySidebarCollapsed(collapsed) {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    if (btnToggleSidebar) btnToggleSidebar.setAttribute('aria-expanded', String(!collapsed));
  }

  applySidebarCollapsed(_sidebarCollapsed);

  btnToggleSidebar?.addEventListener('click', () => {
    _sidebarCollapsed = !_sidebarCollapsed;
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, _sidebarCollapsed ? '0' : '1');
    applySidebarCollapsed(_sidebarCollapsed);
  });

  // ── Sidebar section collapse toggles ──
  document.querySelectorAll('.section-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.sidebar-section').classList.toggle('section-collapsed');
    });
  });

  // ── Floating search pill ──
  const floatingSearch = $('#floating-search');
  floatingSearch.addEventListener('click', () => switchView('search'));

  // ── Search shortcut hint (Ctrl+K / ⌘K) ──
  const isMac = navigator.platform.includes('Mac');
  const searchShortcutHint = $('#search-shortcut-hint');
  const searchShortcutMod = $('#search-shortcut-mod');
  const floatingSearchMod = $('#floating-search-mod');
  if (searchShortcutMod) searchShortcutMod.textContent = isMac ? '⌘' : 'Ctrl';
  if (floatingSearchMod) floatingSearchMod.textContent = isMac ? '⌘' : 'Ctrl';

  function updateFloatingSearch() {
    const show = ['home', 'explore', 'library', 'artist', 'album', 'playlist'].includes(state.currentView);
    floatingSearch.classList.toggle('hidden', !show);

    // ─── Global keyboard shortcuts ───────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
      // Ctrl+K / Cmd+K  or  /  → open search
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        $('#search-input').value = '';
        $('#search-clear').classList.add('hidden');
        closeSuggestions();
        switchView('search');
        return;
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          if (e.ctrlKey) { playNext(); break; }
          if (audioRef.audio.duration) {
            if (audioRef.engine.isInProgress()) { audioRef.engine.instantComplete(); }
            const newTimeR = Math.min(audioRef.audio.duration, audioRef.audio.currentTime + 5);
            const remainingR = audioRef.audio.duration - newTimeR;
            if (remainingR > state.crossfade) audioRef.engine.resetTrigger();
            else audioRef.engine.markTriggered();
            audioRef.audio.currentTime = newTimeR;
          }
          break;
        case 'ArrowLeft':
          if (e.ctrlKey) { playPrev(); break; }
          if (audioRef.audio.duration) {
            if (audioRef.engine.isInProgress()) { audioRef.engine.instantComplete(); }
            const newTimeL = Math.max(0, audioRef.audio.currentTime - 5);
            const remainingL = audioRef.audio.duration - newTimeL;
            if (remainingL > state.crossfade) audioRef.engine.resetTrigger();
            else audioRef.engine.markTriggered();
            audioRef.audio.currentTime = newTimeL;
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(state.volume + 0.05);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(state.volume - 0.05);
          break;
        case '/':
          e.preventDefault();
          switchView('search');
          break;
      }
    });
  }

  async function init() {
    const systemLocale = await window.snowify.getLocale();
    await I18n.init(systemLocale);
    loadState();
    finishInit();
    loadPlayLogAsync(); // fire-and-forget — avoids blocking startup with large JSON parse
  }

  // ─── Wrapped trigger ───
  let _playLogReady = false;

  async function loadPlayLogAsync() {
    // Yield control back to the renderer so the UI can paint before we touch localStorage
    await new Promise(r => setTimeout(r, 0));

    // Parse play log — can be several MB for heavy listeners
    try {
      const raw = localStorage.getItem('snowify_play_log');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) state.playLog = parsed;
      }
    } catch (_) {}

    // Yield again before genre cache
    await new Promise(r => setTimeout(r, 0));
    try {
      const raw = localStorage.getItem('snowify_genre_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') state.trackGenreCache = parsed;
      }
    } catch (_) {}

    // One-time backfill from recentTracks for users predating the Wrapped feature.
    // v2: clear stale v1 backfill (spread wrongly across multiple years) and re-seed within current year.
    const backfillVer = localStorage.getItem('snowify_playlog_backfill_ver');
    if (backfillVer !== '2' && state.recentTracks.length > 0) {
      state.playLog = []; // discard any stale backfill
    }
    if (state.playLog.length === 0 && state.recentTracks.length > 0) {
      await new Promise(r => setTimeout(r, 0));
      const now = Date.now();
      // Spread entries across the current calendar year so they all count in Wrapped
      const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
      const span = now - yearStart;
      const n = state.recentTracks.length;
      // recentTracks[0] = most recent → assign closest timestamp
      state.playLog = state.recentTracks.map((t, i) => ({
        id: t.id,
        title: t.title,
        artist: t.artist || '',
        thumbnail: t.thumbnail || '',
        durationMs: t.durationMs || 210000, // fall back to 3.5 min average if unknown
        ts: now - (i / n) * span,
      }));
      // Persist without blocking UI (write in next task)
      await new Promise(r => setTimeout(r, 0));
      try {
        localStorage.setItem('snowify_play_log', JSON.stringify(state.playLog));
        localStorage.setItem('snowify_playlog_backfill_ver', '2');
      } catch (_) {}
    }

    _playLogReady = true;
    checkWrappedTrigger();
  }

  function checkWrappedTrigger() {
    if (!_playLogReady) return; // data not loaded yet — loadPlayLogAsync() will re-call us
    const now = new Date();
    const month = now.getMonth(); // 0 = Jan, 11 = Dec
    let targetYear = null;
    if (month === 11) targetYear = now.getFullYear();       // December → this year's data
    else if (month === 0) targetYear = now.getFullYear() - 1; // January → last year's data
    if (targetYear === null) return;
    if (state.wrappedShownYear === targetYear) return;
    if (!state.playLog.some(e => new Date(e.ts).getFullYear() === targetYear)) return;
    window.WrappedManager?.show(targetYear);
  }

  // ─── Plugin metadata helpers ───

  // If the currently playing track has a richer album art from a plugin, update the now-playing UI.
  function _maybeUpdateNowPlayingArt(track) {
    const current = state.queue[state.queueIndex];
    if (current?.id !== track.id) return;
    const cached = state.trackGenreCache[track.id];
    if (!cached?.albumArt) return;
    const thumb = $('#np-thumbnail');
    const resolvedAlbumArt = resolveImageUrl(cached.albumArt);
    if (thumb && thumb.src !== resolvedAlbumArt) {
      const originalSrc = thumb.src;
      const onError = () => {
        thumb.src = originalSrc; // restore original thumbnail if cached art fails
        thumb.removeEventListener('error', onError);
      };
      thumb.addEventListener('error', onError);
      thumb.addEventListener('load', () => thumb.removeEventListener('error', onError), { once: true });
      thumb.src = resolvedAlbumArt;
      extractDominantColor(resolvedAlbumArt).then(color => {
        const rgb = color ? `${color.r}, ${color.g}, ${color.b}` : '170, 85, 230';
        document.documentElement.style.setProperty('--ambient-rgb', rgb);
      }).catch(() => {});
    }
  }

  // ─── Track metadata enrichment (background, fire-and-forget) ───
  async function maybeEnrichTrackMeta(track) {
    if (!track?.id || !track.title) return;
    if (state.trackGenreCache[track.id]) {
      _maybeUpdateNowPlayingArt(track); // still apply cached art on repeat plays
      return;
    }
    for (const sourceId of state.metadataSources) {
      const handler = window.SnowifySources?._metaHandlers?.[sourceId];
      if (!handler) continue;
      try {
        const meta = await handler(track.title, track.artist || '');
        if (meta) {
          state.trackGenreCache[track.id] = meta;
          try { localStorage.setItem('snowify_genre_cache', JSON.stringify(state.trackGenreCache)); } catch (_) {}
          _maybeUpdateNowPlayingArt(track);
          break; // first successful source wins
        }
      } catch (_) { /* enrichment is best-effort */ }
    }
  }

  function finishInit() {
    // Expose state reference and save function for wrapped.js + plugins
    window.__snowifyState = state;
    window.__snowifySaveState = _flushSaveState;
    updateGreeting();
    // ─── Wire cross-module callbacks ───
    callbacks.saveState = saveState;
    callbacks.maybeEnrichTrackMeta = maybeEnrichTrackMeta;
    callbacks.switchView = switchView;
    initProfiles();
    callbacks.forceReloadTrack = async (track) => {
      delete state.trackGenreCache[track.id];
      try { localStorage.setItem('snowify_genre_cache', JSON.stringify(state.trackGenreCache)); } catch (_) {}
      const thumbBefore = track.thumbnail;
      if (thumbBefore && !thumbBefore.startsWith('data:')) _imgQ.bust(thumbBefore);
      await maybeEnrichTrackMeta(track);
      const thumbAfter = track.thumbnail || thumbBefore;
      if (thumbAfter) {
        document.querySelectorAll(`[data-track-id="${track.id}"] img`).forEach(el => {
          _imgQ.reload(el, thumbAfter);
        });
      }
    };
    setVolume(state.volume);
    if (state.discordRpc) window.snowify.connectDiscord();
    if (state.minimizeToTray) window.snowify.setMinimizeToTray(true);
    if (state.launchOnStartup) window.snowify.setOpenAtLogin(true);
    $('#btn-shuffle').classList.toggle('active', state.shuffle);
    $('#btn-repeat').classList.toggle('active', state.repeat !== 'off');
    updateRepeatButton();
    renderPlaylists();
    renderSidebarArtists();
    renderHome();
    initSettings().catch(err => {
      console.error('[initSettings crashed]', err);
      showToast('Settings error: ' + err.message);
    });

    // ─── Export / Import local data (wired here, outside the async initSettings) ───
    $('#btn-export-data').addEventListener('click', async () => {
      try {
        const data = localStorage.getItem('snowify_state');
        if (!data) { showToast(I18n.t('toast.nothingToExport')); return; }
        showToast(I18n.t('toast.exportingSave'));
        const ok = await window.snowify.exportLibrary(data);
        if (ok) showToast(I18n.t('toast.libraryExported'));
      } catch (err) {
        console.error('[Export]', err);
        showToast('Export failed: ' + err.message);
      }
    });

    $('#btn-import-data').addEventListener('click', async () => {
      try {
        const text = await window.snowify.importLibrary();
        if (!text) return;
        try { JSON.parse(text); } catch { showToast(I18n.t('toast.importInvalidFile')); return; }
        if (!confirm(I18n.t('settings.confirmImportLibrary'))) return;
        localStorage.setItem('snowify_state', text);
        location.reload();
      } catch (err) {
        console.error('[Import]', err);
        showToast('Import failed: ' + err.message);
      }
    });

    // ─── Source registration API (available to plugins via window.SnowifySources) ───
    window.SnowifySources = {
      _song: [
        { id: 'youtube', label: I18n.t('settings.sourceYouTube'), desc: I18n.t('settings.sourceYouTubeDesc') },
        { id: 'soundcloud', label: 'SoundCloud', desc: 'Stream from SoundCloud as a fallback when YouTube is unavailable.' },
      ],
      _meta: [
        { id: 'youtube', label: I18n.t('settings.sourceYTMeta'), desc: I18n.t('settings.sourceYTMetaDesc') },
      ],
      _metaHandlers: {},
      _artistMetaHandlers: {},
      registerSongSource(def) {
        if (!this._song.find(s => s.id === def.id)) {
          this._song.push(def);
          this._refreshSources?.();
        }
      },
      registerMetaSource(def) {
        if (!this._meta.find(s => s.id === def.id)) {
          this._meta.push(def);
          if (typeof def.enrich === 'function') this._metaHandlers[def.id] = def.enrich;
          if (typeof def.getArtistMeta === 'function') this._artistMetaHandlers[def.id] = def.getArtistMeta;
          this._refreshSources?.();
        }
      },
      _refreshSources: null,
    };

    loadEnabledPlugins();
        // ─── Windows taskbar thumbbar buttons ───
        if (window.snowify.onThumbarPrev) {
          window.snowify.onThumbarPrev(() => playPrev());
          window.snowify.onThumbarPlayPause(() => togglePlay());
          window.snowify.onThumbarNext(() => playNext());
        }
    // Restore queue display (but don't auto-play)
    const restoredTrack = state.queue[state.queueIndex];
    if (restoredTrack) {
      showNowPlaying(restoredTrack);
      appEl.classList.remove('no-player');
    } else {
      appEl.classList.add('no-player');
    }

    // Wrapped trigger is now fired by loadPlayLogAsync() once data is ready
  }

  // ─── Deep link handler ───
  async function handleAppDeepLink({ type, id }) {
    if (type === 'track') {
      const track = await window.snowify.getTrackInfo(id).catch(() => null);
      if (track) {
        state.queue = [track];
        state.queueIndex = 0;
        playTrack(track);
      } else {
        showToast('Could not load track');
      }
    } else if (type === 'album') {
      showAlbumDetail(id, null);
    } else if (type === 'artist') {
      openArtistPage(id);
    }
  }

  if (window.snowify.onDeepLink) {
    window.snowify.onDeepLink(handleAppDeepLink);
  }

  // Check for a buffered deep link from cold start
  if (window.snowify.getPendingDeepLink) {
    window.snowify.getPendingDeepLink().then(link => {
      if (link) handleAppDeepLink(link);
    });
  }

  // Flush any pending saves before the window closes
  window.snowify.onBeforeClose(async () => {
    getPrefetchCache().destroy();
    _flushSaveState();
    window.snowify.closeReady();
  });

  // visibilitychange fires in the WebView when Android backgrounds/foregrounds the app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      _flushSaveState(); // sync localStorage write, also clears the 300ms timer
    }
  });
  I18n.onChange(() => {
    updateGreeting();
    renderPlaylists();
    renderSidebarArtists();
    renderHome();
    renderQueue();
    const view = state.currentView;
    if (view === 'settings') {
      resetSettingsInitialized();
      initSettings().catch(console.error);
    }
    if (view === 'library') renderLibrary();
    if (view === 'explore') renderExplore();
  });

  // ─── Mobile-specific interactions ─────────────────────────────────────────
  if (window.snowify?.platform === 'android' || window.snowify?.platform === 'ios' ||
      document.documentElement.classList.contains('platform-mobile')) {

    // Tap the mini player bar (outside the controls) → expand to full screen
    const npBar = $('#now-playing-bar');
    if (npBar) {
      npBar.addEventListener('click', (e) => {
        // Don't intercept clicks on the transport buttons
        if (e.target.closest('.np-controls')) return;
        openMaxNP();
      });
    }

    // Swipe-down gesture on max-NP to dismiss
    const maxNPEl = $('#max-np');
    if (maxNPEl) {
      let _touchStartY = 0;
      let _lastTouchY  = 0;
      let _touchActive = false;
      let _touchFromHandle = false;

      maxNPEl.addEventListener('touchstart', (e) => {
        const target = e.target;
        _touchFromHandle = !!(target && target.closest && target.closest('.max-np-topbar'));
        if (!_touchFromHandle) {
          _touchActive = false;
          return;
        }
        _touchStartY = e.touches[0].clientY;
        _lastTouchY  = _touchStartY;
        _touchActive = true;
        maxNPEl.style.transition = 'none';
      }, { passive: true });

      maxNPEl.addEventListener('touchmove', (e) => {
        if (!_touchActive || !_touchFromHandle) return;
        const dy = e.touches[0].clientY - _touchStartY;
        _lastTouchY = e.touches[0].clientY;
        if (dy > 0) {
          maxNPEl.style.transform = `translateY(${dy}px)`;
        }
      }, { passive: true });

      maxNPEl.addEventListener('touchend', () => {
        if (!_touchActive || !_touchFromHandle) return;
        _touchActive = false;
        _touchFromHandle = false;
        const dy = _lastTouchY - _touchStartY;
        maxNPEl.style.transition = '';
        maxNPEl.style.transform  = '';
        if (dy > 80) {
          closeMaxNP();
        }
      }, { passive: true });
    }

    // Swipe-down on queue panel to close (only when content is scrolled to top)
    const queuePanelEl = $('#queue-panel');
    if (queuePanelEl) {
      let _qTouchStart = 0;
      let _qScrollAtStart = 0;
      queuePanelEl.addEventListener('touchstart', (e) => {
        _qTouchStart = e.touches[0].clientY;
        const activeView = queuePanelEl.querySelector('#queue-view:not([style*="display: none"]), #history-view:not([style*="display: none"])');
        _qScrollAtStart = activeView ? activeView.scrollTop : 0;
      }, { passive: true });
      queuePanelEl.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - _qTouchStart;
        if (dy > 80 && _qScrollAtStart < 5) {
          queuePanelEl.classList.add('hidden');
          queuePanelEl.classList.remove('visible');
        }
      }, { passive: true });
    }

    // Swipe-down on lyrics panel to close
    const lyricsPanelEl = $('#lyrics-panel');
    if (lyricsPanelEl) {
      let _lTouchStart = 0;
      lyricsPanelEl.addEventListener('touchstart', (e) => {
        _lTouchStart = e.touches[0].clientY;
      }, { passive: true });
      lyricsPanelEl.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - _lTouchStart;
        if (dy > 80) {
          closeLyricsPanel();
        }
      }, { passive: true });
    }
  }

  init();
