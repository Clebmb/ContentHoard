/**
 * profiles.js
 * MediaHoard-style profile dropdown, profile creation/editing, preset icons,
 * custom image upload, URL avatars, and color selection.
 */

import state from './state.js';
import { callbacks } from './callbacks.js';
import { showToast, escapeHtml } from './utils.js';
import {
  captureActiveProfileData,
  applyActiveProfileData,
  initializeProfileDataForProfile,
} from './profile-data.js';

const DEFAULT_COLOR = '#39E079';
const DEFAULT_COLORS = ['#39E079', '#E03939', '#397EE0', '#E0A339', '#9C39E0', '#39E0DC', '#FFFFFF'];
const DEFAULT_ICONS = [
  'face', 'face_6', 'face_5', 'face_3', 'face_4',
  'face_2', 'child_care', 'comedy_mask', 'family_restroom', 'groups',
  'person', 'pets', 'emoticon', 'rocket_launch', 'celebration'
];

const $ = (sel, ctx = document) => ctx.querySelector(sel);

let root;
let trigger;
let menu;
let modal;
let iconDialog;
let editingProfileId = null;
let onboardingActive = false;
let setupData = { name: '', color: DEFAULT_COLOR, icon: '' };
let initialized = false;

function t(key) {
  return window.I18n?.t?.(key) || key;
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'profile-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

function normalizeProfiles() {
  if (!Array.isArray(state.profiles)) state.profiles = [];
  state.profiles = state.profiles
    .filter(p => p && typeof p === 'object')
    .map(p => ({
      id: String(p.id || makeId()),
      name: String(p.name || t('profiles.defaultName')),
      icon: String(p.icon || ''),
      color: String(p.color || DEFAULT_COLOR),
      createdAt: Number(p.createdAt || Date.now()),
    }));
  if (state.activeProfileId && !state.profiles.some(p => p.id === state.activeProfileId)) {
    state.activeProfileId = state.profiles[0]?.id || null;
  }
}

function getActiveProfile() {
  return state.profiles.find(p => p.id === state.activeProfileId) || null;
}

function isImageIcon(icon) {
  return typeof icon === 'string' && (icon.startsWith('data:') || icon.includes('://'));
}

function iconHtml(profile, className = '') {
  const icon = profile?.icon || '';
  const label = escapeHtml(profile?.name || t('profiles.profile'));
  if (isImageIcon(icon)) {
    return `<img class="${className}" src="${escapeHtml(icon)}" alt="${label}" draggable="false" />`;
  }
  return `<span class="material-symbols-outlined ${className}" aria-hidden="true">${escapeHtml(icon || (profile ? 'person' : 'account_circle'))}</span>`;
}

function saveProfiles({ deletedId = null, reload = false } = {}) {
  callbacks.saveState();
  window.__snowifySaveState?.();
  syncContentHoardProfiles(deletedId ? [deletedId] : []);
  renderProfiles();
  if (reload) setTimeout(() => window.location.reload(), 80);
}

async function syncContentHoardProfiles(deletedProfileIds) {
  // Publish AudioHoard's profile list to ContentHoard's shared state.
  // ContentHoard stays the owner of profiles it created; profiles created
  // or deleted here are adopted/removed there via ingestChildSync.
  const bridge = window.snowify?.contentHoard;
  if (!bridge?.enabled || typeof bridge.writeSharedState !== 'function') return;
  try {
    const shared = (await bridge.readSharedState?.()) || {};
    await bridge.writeSharedState({
      ...shared,
      profiles: state.profiles.map(function (p) {
        return {
          id: String(p.id),
          name: String(p.name || 'Profile'),
          icon: String(p.icon || 'person'),
          color: String(p.color || '#39E079'),
          createdAt: Number(p.createdAt || Date.now()),
        };
      }),
      activeProfileId: state.activeProfileId ? String(state.activeProfileId) : shared.activeProfileId,
      deletedProfileIds: Array.isArray(deletedProfileIds) ? deletedProfileIds.map(String) : [],
      lastStateUpdateSource: 'child',
    });
  } catch (e) {
    console.warn('ContentHoard profile sync failed:', e);
  }
}

function createProfile(name, icon = '', color = DEFAULT_COLOR) {
  const isFirstProfile = !state.profiles.length && !state.activeProfileId;
  const profile = {
    id: makeId(),
    name: String(name || t('profiles.defaultName')).trim() || t('profiles.defaultName'),
    icon,
    color: color || DEFAULT_COLOR,
    createdAt: Date.now(),
  };
  state.profiles.push(profile);
  initializeProfileDataForProfile(profile.id, { inheritCurrent: isFirstProfile });
  if (!state.activeProfileId) state.activeProfileId = profile.id;
  onboardingActive = false;
  saveProfiles();
  showToast(t('profiles.created'));
  return profile;
}

function updateProfile(id, updates) {
  state.profiles = state.profiles.map(p => p.id === id ? { ...p, ...updates } : p);
  saveProfiles();
  showToast(t('profiles.updated'));
}

function switchProfile(id) {
  if (!id || state.activeProfileId === id) return;
  captureActiveProfileData();
  state.activeProfileId = id;
  applyActiveProfileData();
  callbacks.saveState();
  window.__snowifySaveState?.();
  syncContentHoardProfiles([]);
  window.location.reload();
}

function deleteProfile(id) {
  const wasActive = state.activeProfileId === id;
  const remaining = state.profiles.filter(p => p.id !== id);
  if (remaining.length === state.profiles.length) return; // nothing deleted
  state.profiles = remaining;
  if (state.profileData) delete state.profileData[id];
  if (wasActive) {
    state.activeProfileId = state.profiles[0]?.id || null;
    applyActiveProfileData();
  }
  saveProfiles({ deletedId: id, reload: wasActive });
  showToast(t('profiles.deleted'));
}

function renderProfiles() {
  const active = getActiveProfile();
  if (!root || !trigger || !menu) return;
  trigger.style.backgroundColor = active?.color || 'rgba(255,255,255,0.10)';
  trigger.innerHTML = iconHtml(active, 'profile-trigger-icon');
  trigger.setAttribute('aria-label', t('profiles.open'));

  const rows = state.profiles.map(p => {
    const activeClass = p.id === state.activeProfileId ? ' active' : '';
    return `
      <div class="profile-menu-row" data-profile-id="${escapeHtml(p.id)}">
        <button class="profile-menu-profile${activeClass}" type="button" data-profile-switch="${escapeHtml(p.id)}">
          <span class="profile-menu-avatar" style="background-color:${escapeHtml(p.color || DEFAULT_COLOR)}">${iconHtml(p, 'profile-menu-icon')}</span>
          <span class="profile-menu-name">${escapeHtml(p.name)}</span>
        </button>
        <button class="profile-menu-edit" type="button" data-profile-edit="${escapeHtml(p.id)}" aria-label="${escapeHtml(t('profiles.edit'))}" title="${escapeHtml(t('profiles.edit'))}">
          <span class="material-symbols-outlined" aria-hidden="true">edit</span>
        </button>
      </div>`;
  }).join('');

  menu.innerHTML = `
    <div class="profile-menu-heading">${escapeHtml(t('profiles.title'))}</div>
    <div class="profile-menu-list">${rows || `<div class="profile-menu-empty">${escapeHtml(t('profiles.empty'))}</div>`}</div>
    <div class="profile-menu-footer">
      <button class="profile-menu-action" type="button" data-profile-appearance>
        <span class="profile-menu-action-icon material-symbols-outlined" aria-hidden="true">palette</span>
        <span>${escapeHtml(t('profiles.appearance'))}</span>
      </button>
      <button class="profile-menu-action" type="button" data-profile-add>
        <span class="profile-menu-action-icon material-symbols-outlined" aria-hidden="true">add</span>
        <span>${escapeHtml(t('profiles.add'))}</span>
      </button>
    </div>`;
}

function closeMenu() {
  menu?.classList.add('hidden');
  trigger?.setAttribute('aria-expanded', 'false');
}

function toggleMenu() {
  const isHidden = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !isHidden);
  trigger.setAttribute('aria-expanded', String(isHidden));
}

function openSetup(profile = null) {
  editingProfileId = profile?.id || null;
  onboardingActive = false;
  setupData = {
    name: profile?.name || '',
    color: profile?.color || DEFAULT_COLOR,
    icon: profile?.icon || '',
  };
  closeMenu();
  renderSetupModal();
  modal.classList.remove('hidden');
  setTimeout(() => $('#app-profile-name-input', modal)?.focus(), 30);
}

function openOnboarding() {
  editingProfileId = null;
  onboardingActive = true;
  setupData = { name: '', color: DEFAULT_COLOR, icon: '' };
  closeMenu();
  renderSetupModal();
  modal.classList.remove('hidden');
  setTimeout(() => $('#app-profile-name-input', modal)?.focus(), 30);
}

function closeSetup() {
  if (onboardingActive && !state.profiles.length) return;
  modal?.classList.add('hidden');
  editingProfileId = null;
  onboardingActive = false;
}

function captureSetupDataFromDom() {
  const nameInput = $('#app-profile-name-input', modal);
  if (nameInput) setupData.name = nameInput.value;
}

function getSetupProfileName() {
  captureSetupDataFromDom();
  return String(setupData.name || '').trim() || t('profiles.defaultName');
}

function renderPreview() {
  const preview = $('#profile-avatar-preview', modal);
  if (!preview) return;
  preview.style.backgroundColor = setupData.color || DEFAULT_COLOR;
  preview.innerHTML = isImageIcon(setupData.icon)
    ? `<img src="${escapeHtml(setupData.icon)}" alt="" draggable="false" />`
    : `<span class="material-symbols-outlined" aria-hidden="true">${escapeHtml(setupData.icon || 'person')}</span>`;
}

function renderSetupModal() {
  const isEditing = !!editingProfileId;
  const isOnboarding = onboardingActive && !isEditing;
  const title = isEditing
    ? t('profiles.editProfile')
    : isOnboarding
      ? t('profiles.onboardingTitle')
      : t('profiles.newProfile');
  modal.innerHTML = `
    <div class="profile-modal-backdrop"${isOnboarding ? '' : ' data-profile-close'}></div>
    <section class="profile-modal-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="profile-modal-title">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(isOnboarding ? t('profiles.onboardingDescription') : t('profiles.customize'))}</p>
      </div>
      <div class="profile-avatar-editor">
        <button id="profile-avatar-preview" class="profile-avatar-preview" type="button" data-profile-pick-icon aria-label="${escapeHtml(t('profiles.avatar'))}"></button>
        <button class="profile-avatar-camera" type="button" data-profile-pick-icon aria-label="${escapeHtml(t('profiles.avatar'))}">
          <span class="material-symbols-outlined" aria-hidden="true">photo_camera</span>
        </button>
      </div>
      <div class="profile-color-row">
        ${DEFAULT_COLORS.map(c => `<button class="profile-color-dot${setupData.color === c ? ' active' : ''}" type="button" data-profile-color="${c}" aria-label="${escapeHtml(c)}" style="background-color:${c}"></button>`).join('')}
      </div>
      <label class="profile-name-field">
        <span>${escapeHtml(t('profiles.profileName'))}</span>
        <input id="app-profile-name-input" name="profileName" type="text" value="${escapeHtml(setupData.name)}" placeholder="${escapeHtml(t('profiles.namePlaceholder'))}" autocomplete="off" />
      </label>
      <div class="profile-modal-actions">
        ${isEditing ? `<button class="profile-delete-btn" type="button" data-profile-delete aria-label="${escapeHtml(t('profiles.delete'))}"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>` : ''}
        ${isOnboarding ? '' : `<button class="profile-cancel-btn" type="button" data-profile-close>${escapeHtml(t('common.cancel'))}</button>`}
        <button class="profile-save-btn" type="button" data-profile-save>${escapeHtml(isEditing ? t('profiles.saveChanges') : t('profiles.createProfile'))}</button>
      </div>
    </section>`;
  renderPreview();
}

function openIconDialog() {
  iconDialog.innerHTML = `
    <div class="profile-modal-backdrop" data-icon-close></div>
    <section class="profile-icon-dialog-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(t('profiles.avatar'))}">
      <div class="profile-icon-title">
        <h3>${escapeHtml(t('profiles.avatar'))}</h3>
        <p>${escapeHtml(t('profiles.sourceSelection'))}</p>
      </div>
      <div class="profile-icon-dialog-scroll">
        <div class="profile-icon-section">
          <div class="profile-icon-section-title">${escapeHtml(t('profiles.builtInIcons'))}</div>
          <div class="profile-icon-grid">
            ${DEFAULT_ICONS.map(icon => `<button class="profile-preset-icon" type="button" data-icon-preset="${escapeHtml(icon)}" title="${escapeHtml(icon)}"><span class="material-symbols-outlined" aria-hidden="true">${escapeHtml(icon)}</span></button>`).join('')}
          </div>
        </div>
        <label class="profile-source-option">
          <span class="profile-source-icon material-symbols-outlined" aria-hidden="true">upload</span>
          <span><strong>${escapeHtml(t('profiles.upload'))}</strong><small>${escapeHtml(t('profiles.localFile'))}</small></span>
          <input type="file" accept="image/*" data-icon-upload hidden />
        </label>
        <div class="profile-url-option">
          <div class="profile-source-option static">
            <span class="profile-source-icon material-symbols-outlined" aria-hidden="true">link</span>
            <span><strong>${escapeHtml(t('profiles.directUrl'))}</strong><small>${escapeHtml(t('profiles.remoteLink'))}</small></span>
          </div>
          <div class="profile-url-row">
            <input type="text" data-icon-url placeholder="https://..." value="${isImageIcon(setupData.icon) ? escapeHtml(setupData.icon) : ''}" />
            <button type="button" data-icon-url-set>${escapeHtml(t('profiles.set'))}</button>
          </div>
        </div>
        ${setupData.icon ? `<button class="profile-clear-icon" type="button" data-icon-default><span class="material-symbols-outlined" aria-hidden="true">close</span><span><strong>${escapeHtml(t('profiles.useDefault'))}</strong><small>${escapeHtml(t('profiles.clearIcon'))}</small></span></button>` : ''}
      </div>
      <button class="profile-icon-close-btn" type="button" data-icon-close>${escapeHtml(t('common.close'))}</button>
    </section>`;
  iconDialog.classList.remove('hidden');
}

function closeIconDialog() {
  iconDialog?.classList.add('hidden');
}

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 512;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function bindEvents() {
  trigger.addEventListener('click', toggleMenu);
  document.addEventListener('click', (event) => {
    if (!root.contains(event.target) && !menu.classList.contains('hidden')) closeMenu();
  });

  menu.addEventListener('click', (event) => {
    const switchBtn = event.target.closest('[data-profile-switch]');
    const editBtn = event.target.closest('[data-profile-edit]');
    if (switchBtn) switchProfile(switchBtn.dataset.profileSwitch);
    if (editBtn) {
      const profile = state.profiles.find(p => p.id === editBtn.dataset.profileEdit);
      if (profile) openSetup(profile);
    }
    if (event.target.closest('[data-profile-add]')) openSetup();
    if (event.target.closest('[data-profile-appearance]')) {
      closeMenu();
      try { sessionStorage.setItem('settings-tab', 'appearance'); } catch {}
      callbacks.switchView('settings');
    }
  });

  modal.addEventListener('input', (event) => {
    if (event.target.matches('#app-profile-name-input')) setupData.name = event.target.value;
  });

  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-profile-close]')) closeSetup();
    const colorBtn = event.target.closest('[data-profile-color]');
    if (colorBtn) {
      captureSetupDataFromDom();
      setupData.color = colorBtn.dataset.profileColor;
      renderSetupModal();
    }
    if (event.target.closest('[data-profile-pick-icon]')) {
      captureSetupDataFromDom();
      openIconDialog();
    }
    if (event.target.closest('[data-profile-save]')) {
      const name = getSetupProfileName();
      if (editingProfileId) updateProfile(editingProfileId, { name, icon: setupData.icon, color: setupData.color || DEFAULT_COLOR });
      else createProfile(name, setupData.icon, setupData.color || DEFAULT_COLOR);
      closeSetup();
    }
    if (event.target.closest('[data-profile-delete]') && editingProfileId) {
      if (confirm(t('profiles.confirmDelete'))) {
        const id = editingProfileId;
        closeSetup();
        deleteProfile(id);
      }
    }
  });

  iconDialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-icon-close]')) closeIconDialog();
    const preset = event.target.closest('[data-icon-preset]');
    if (preset) {
      setupData.icon = preset.dataset.iconPreset;
      closeIconDialog();
      renderSetupModal();
    }
    if (event.target.closest('[data-icon-url-set]')) {
      const url = $('[data-icon-url]', iconDialog)?.value.trim();
      if (url) {
        setupData.icon = url;
        closeIconDialog();
        renderSetupModal();
      }
    }
    if (event.target.closest('[data-icon-default]')) {
      setupData.icon = '';
      closeIconDialog();
      renderSetupModal();
    }
  });

  iconDialog.addEventListener('change', async (event) => {
    if (!event.target.matches('[data-icon-upload]')) return;
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setupData.icon = await resizeImageFile(file);
      closeIconDialog();
      renderSetupModal();
    } catch {
      showToast(t('profiles.uploadFailed'));
    }
  });
}

function mount() {
  root = document.createElement('div');
  root.id = 'profile-shell';
  root.className = 'profile-shell';
  root.innerHTML = `
    <button id="profile-trigger" class="profile-trigger" type="button" aria-haspopup="menu" aria-expanded="false"></button>
    <div id="profile-menu" class="profile-menu hidden" role="menu"></div>`;
  document.body.appendChild(root);
  modal = document.createElement('div');
  modal.id = 'profile-modal';
  modal.className = 'profile-modal hidden';
  document.body.appendChild(modal);
  iconDialog = document.createElement('div');
  iconDialog.id = 'profile-icon-dialog';
  iconDialog.className = 'profile-icon-dialog hidden';
  document.body.appendChild(iconDialog);
  trigger = $('#profile-trigger');
  menu = $('#profile-menu');
}

export function initProfiles() {
  if (initialized) return;
  initialized = true;
  normalizeProfiles();
  mount();
  bindEvents();
  renderProfiles();
  // Expose for ContentHoard shared state deletion sync
  window.__renderProfiles = renderProfiles;
  window.__switchProfile = switchProfile;
  if (!state.profiles.length) setTimeout(openOnboarding, 80);
}
