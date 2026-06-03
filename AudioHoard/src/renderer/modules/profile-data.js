/**
 * profile-data.js
 * Helpers for per-profile personal library/search state.
 */

import state from './state.js';

export const PROFILE_DATA_KEYS = [
  'playlists',
  'likedSongs',
  'recentTracks',
  'followedArtists',
  'searchHistory',
];

const PROFILE_ARRAY_KEYS = PROFILE_DATA_KEYS;
const PROFILE_VALUE_KEYS = [
  'theme',
];

function clone(value) {
  if (value == null) return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

export function createEmptyProfileData() {
  return {
    playlists: [],
    likedSongs: [],
    recentTracks: [],
    followedArtists: [],
    searchHistory: [],
    theme: state.theme || 'dark',
  };
}

export function createCurrentProfileData() {
  const data = createEmptyProfileData();
  PROFILE_ARRAY_KEYS.forEach(key => {
    data[key] = clone(state[key]) || [];
  });
  data.theme = state.theme || 'dark';
  return data;
}

export function normalizeProfileDataMap(profileData = {}) {
  const normalized = {};
  if (!profileData || typeof profileData !== 'object' || Array.isArray(profileData)) return normalized;
  Object.entries(profileData).forEach(([id, data]) => {
    if (!id || !data || typeof data !== 'object' || Array.isArray(data)) return;
    normalized[id] = createEmptyProfileData();
    PROFILE_ARRAY_KEYS.forEach(key => {
      normalized[id][key] = Array.isArray(data[key]) ? data[key] : [];
    });
    PROFILE_VALUE_KEYS.forEach(key => {
      if (data[key] != null) normalized[id][key] = data[key];
    });
  });
  return normalized;
}

export function ensureProfileDataMap() {
  state.profileData = normalizeProfileDataMap(state.profileData);
  return state.profileData;
}

export function getActiveProfileDataKey() {
  return state.activeProfileId || null;
}

export function captureActiveProfileData() {
  const id = getActiveProfileDataKey();
  if (!id) return;
  const map = ensureProfileDataMap();
  map[id] = createCurrentProfileData();
}

export function initializeProfileDataForProfile(id, { inheritCurrent = false } = {}) {
  if (!id) return;
  const map = ensureProfileDataMap();
  if (!map[id]) map[id] = inheritCurrent ? createCurrentProfileData() : createEmptyProfileData();
}

export function applyActiveProfileData({ fallback = null } = {}) {
  const id = getActiveProfileDataKey();
  if (!id) return;
  const map = ensureProfileDataMap();
  if (!map[id]) {
    map[id] = fallback ? normalizeProfileDataMap({ [id]: fallback })[id] : createEmptyProfileData();
  }
  PROFILE_ARRAY_KEYS.forEach(key => {
    state[key] = clone(map[id][key]) || [];
  });
  PROFILE_VALUE_KEYS.forEach(key => {
    if (map[id][key] != null) state[key] = map[id][key];
  });
}
