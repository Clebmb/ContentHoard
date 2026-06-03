import { useLocation, useNavigate } from "react-router-dom";
import { useAppSelector, useUserDetails, MEDIAHOARD_PROFILE_COLORS, MEDIAHOARD_PROFILE_ICONS } from "@renderer/hooks";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { PencilIcon, DeviceCameraIcon } from "@primer/octicons-react";
import { createPortal } from "react-dom";
import SteamLogo from "@renderer/assets/steam-logo.svg?react";
import { Avatar } from "../avatar/avatar";
import { logger } from "@renderer/logger";
import type { NotificationCountResponse } from "@types";
import "./sidebar-profile.scss";

type ProfileDraft = {
  displayName: string;
  profileColor: string;
  avatar: string;
};

function isImageAvatar(value = "") {
  return value.startsWith("data:") || value.includes("://");
}

export function SidebarProfile() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    userDetails,
    profiles,
    fetchUserDetails,
    switchProfile,
    createProfile,
    updateProfile,
    deleteProfile,
  } = useUserDetails();

  const { gameRunning } = useAppSelector((state) => state.gameRunning);

  const [notificationCount, setNotificationCount] = useState(0);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const apiNotificationCountRef = useRef(0);
  const hasFetchedInitialCount = useRef(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    displayName: "",
    profileColor: MEDIAHOARD_PROFILE_COLORS[0],
    avatar: "",
  });

  const fetchLocalNotificationCount = useCallback(async () => {
    try {
      const localCount = await window.electron.getLocalNotificationsCount();
      setNotificationCount(localCount + apiNotificationCountRef.current);
    } catch (error) {
      logger.error("Failed to fetch local notification count", error);
    }
  }, []);

  const fetchApiNotificationCount = useCallback(async () => {
    try {
      const response =
        await window.electron.hydraApi.get<NotificationCountResponse>(
          "/profile/notifications/count",
          { needsAuth: true }
        );
      apiNotificationCountRef.current = response.count;
    } catch {
    }
    fetchLocalNotificationCount();
  }, [fetchLocalNotificationCount]);

  useEffect(() => {
    fetchLocalNotificationCount();
  }, [fetchLocalNotificationCount]);

  useEffect(() => {
    if (userDetails && !hasFetchedInitialCount.current) {
      hasFetchedInitialCount.current = true;
      fetchApiNotificationCount();
    } else if (!userDetails) {
      hasFetchedInitialCount.current = false;
      apiNotificationCountRef.current = 0;
      fetchLocalNotificationCount();
    }
  }, [userDetails, fetchApiNotificationCount, fetchLocalNotificationCount]);

  useEffect(() => {
    const unsubscribe = window.electron.onLocalNotificationCreated(() => {
      fetchLocalNotificationCount();
    });

    return () => unsubscribe();
  }, [fetchLocalNotificationCount]);

  useEffect(() => {
    const handleNotificationsChange = () => {
      fetchLocalNotificationCount();
    };

    window.addEventListener("notificationsChanged", handleNotificationsChange);
    return () => {
      window.removeEventListener(
        "notificationsChanged",
        handleNotificationsChange
      );
    };
  }, [fetchLocalNotificationCount]);

  useEffect(() => {
    const unsubscribe = window.electron.onSyncNotificationCount(
      (notification) => {
        apiNotificationCountRef.current = notification.notificationCount;
        fetchLocalNotificationCount();
      }
    );

    return () => unsubscribe();
  }, [fetchLocalNotificationCount]);

  const handleProfileClick = async () => {
    await fetchUserDetails();
    setIsProfileMenuOpen((isOpen) => !isOpen);
  };

  const handleSwitchProfile = async (profileId: string) => {
    await switchProfile(profileId);
    setIsProfileMenuOpen(false);

    const searchParams = new URLSearchParams(location.search);
    if (
      location.pathname === "/settings" &&
      searchParams.get("tab") === "account_privacy"
    ) {
      navigate(`/settings?tab=account_privacy&profileId=${profileId}`, {
        replace: true,
      });
    }
  };

  const openProfileModal = (profile?: typeof profiles[number]) => {
    setIsProfileMenuOpen(false);
    setEditingProfileId(profile?.id ?? null);
    setProfileDraft({
      displayName: profile?.displayName ?? "",
      profileColor: profile?.profileColor || MEDIAHOARD_PROFILE_COLORS[0],
      avatar: profile?.profileImageUrl || profile?.profileIcon || "person",
    });
    setIsProfileModalOpen(true);
  };

  const closeProfileModal = () => {
    setIsProfileModalOpen(false);
    setEditingProfileId(null);
    setIsIconPickerOpen(false);
  };

  const saveProfileModal = async () => {
    const profileValues = {
      displayName: profileDraft.displayName.trim() || "New Profile",
      profileColor: profileDraft.profileColor || MEDIAHOARD_PROFILE_COLORS[0],
      profileImageUrl: isImageAvatar(profileDraft.avatar) ? profileDraft.avatar : null,
      profileIcon: isImageAvatar(profileDraft.avatar)
        ? null
        : profileDraft.avatar || "person",
    };

    if (editingProfileId) {
      await updateProfile(editingProfileId, profileValues);
    } else {
      await createProfile(profileValues);
    }
    await fetchUserDetails();
    closeProfileModal();
  };

  const handleAvatarFile = (file: File | null | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setProfileDraft((current) => ({ ...current, avatar: result }));
        setIsIconPickerOpen(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const notificationsButton = useMemo(() => {
    if (notificationCount < 1) return null;

    return (
      <small className="sidebar-profile__notification-button-badge">
        {notificationCount > 99 ? "99+" : notificationCount}
      </small>
    );
  }, [notificationCount]);

  const gameRunningDetails = () => {
    if (!userDetails || !gameRunning) return null;

    if (gameRunning.iconUrl) {
      return (
        <img
          className="sidebar-profile__game-running-icon"
          alt={gameRunning.title}
          width={24}
          src={gameRunning.iconUrl}
        />
      );
    }

    return <SteamLogo />;
  };

  return (
    <div className="sidebar-profile">
      <button
        type="button"
        className="sidebar-profile__button"
        onClick={handleProfileClick}
      >
        {notificationsButton}

        <div className="sidebar-profile__button-content">
          <Avatar
            size={35}
            src={userDetails?.profileImageUrl}
            icon={userDetails?.profileIcon}
            color={userDetails?.profileColor}
            alt={userDetails?.displayName}
          />

          <div className="sidebar-profile__button-information">
            <p className="sidebar-profile__button-title">
              {userDetails ? userDetails.displayName : "Create profile"}
            </p>

            {userDetails && gameRunning && (
              <div className="sidebar-profile__button-game-running-title">
                <small>{gameRunning.title}</small>
              </div>
            )}
          </div>

          {gameRunningDetails()}
        </div>
      </button>

      {isProfileMenuOpen && (
        <div className="sidebar-profile__menu">
          <div className="sidebar-profile__menu-list">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className={
                  profile.id === userDetails?.id
                    ? "sidebar-profile__menu-profile sidebar-profile__menu-profile--active"
                    : "sidebar-profile__menu-profile"
                }
              >
                <button
                  type="button"
                  onClick={() => handleSwitchProfile(profile.id)}
                  disabled={profile.id === userDetails?.id}
                >
                  <Avatar
                    size={32}
                    src={profile.profileImageUrl}
                    icon={profile.profileIcon}
                    color={profile.profileColor}
                    alt={profile.displayName}
                  />
                  <span>{profile.displayName}</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteProfile(profile.id);
                    setIsProfileMenuOpen(false);
                  }}
                  disabled={profiles.length <= 1}
                  title="Delete profile"
                >
                  ×
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    openProfileModal(profile);
                  }}
                  title="Edit profile"
                >
                  <PencilIcon size={15} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="sidebar-profile__menu-action"
            onClick={() => openProfileModal()}
          >
            New profile
          </button>
        </div>
      )}

      {isProfileModalOpen && createPortal(
        <div className="sidebar-profile__modal-backdrop" onClick={closeProfileModal}>
          <div
            className="sidebar-profile__modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{editingProfileId ? "Edit Profile" : "New Profile"}</h2>

            <div className="sidebar-profile__modal-avatar-wrap">
              <button
                type="button"
                className="sidebar-profile__modal-avatar"
                style={{ backgroundColor: profileDraft.profileColor }}
                onClick={() => setIsIconPickerOpen(true)}
              >
                {isImageAvatar(profileDraft.avatar) ? (
                  <img src={profileDraft.avatar} alt="" />
                ) : (
                  <span className="material-symbols-outlined">
                    {profileDraft.avatar || "person"}
                  </span>
                )}
                <span className="sidebar-profile__modal-avatar-overlay">
                  <DeviceCameraIcon size={24} />
                </span>
              </button>
            </div>

            <div className="sidebar-profile__modal-swatches">
              {MEDIAHOARD_PROFILE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={profileDraft.profileColor === color ? "active" : ""}
                  style={{ backgroundColor: color }}
                  onClick={() =>
                    setProfileDraft((current) => ({ ...current, profileColor: color }))
                  }
                />
              ))}
            </div>

            <label className="sidebar-profile__modal-field">
              <span>Profile Name</span>
              <input
                type="text"
                value={profileDraft.displayName}
                placeholder="Enter name..."
                autoFocus
                onChange={(event) =>
                  setProfileDraft((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
              />
            </label>

            <div className="sidebar-profile__modal-actions">
              {editingProfileId && (
                <button
                  type="button"
                  className="sidebar-profile__modal-delete"
                  disabled={profiles.length <= 1}
                  onClick={async () => {
                    await deleteProfile(editingProfileId);
                    closeProfileModal();
                    await fetchUserDetails();
                  }}
                >
                  Delete
                </button>
              )}
              <button type="button" onClick={closeProfileModal}>
                Cancel
              </button>
              <button type="button" onClick={saveProfileModal}>
                {editingProfileId ? "Save Changes" : "Create Profile"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isIconPickerOpen && createPortal(
        <div className="sidebar-profile__modal-backdrop" onClick={() => setIsIconPickerOpen(false)}>
          <div
            className="sidebar-profile__icon-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Profile Avatar</h3>

            <div className="sidebar-profile__icon-section">
              <span>Built-in Icons</span>
              <div>
                {MEDIAHOARD_PROFILE_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    title={icon}
                    onClick={() => {
                      setProfileDraft((current) => ({ ...current, avatar: icon }));
                      setIsIconPickerOpen(false);
                    }}
                  >
                    <span className="material-symbols-outlined">{icon}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="sidebar-profile__icon-source">
              <span className="material-symbols-outlined">upload</span>
              <span><strong>Upload from Device</strong><small>Local file</small></span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleAvatarFile(e.target.files?.[0])}
              />
            </label>

            <div className="sidebar-profile__icon-url">
              <div className="sidebar-profile__icon-source sidebar-profile__icon-source--static">
                <span className="material-symbols-outlined">link</span>
                <span><strong>Direct Image URL</strong><small>Remote link</small></span>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="https://..."
                  value={isImageAvatar(profileDraft.avatar) ? profileDraft.avatar : ""}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      avatar: event.target.value,
                    }))
                  }
                />
                <button type="button" onClick={() => setIsIconPickerOpen(false)}>
                  Set
                </button>
              </div>
            </div>

            {profileDraft.avatar && (
              <button
                type="button"
                className="sidebar-profile__icon-default"
                onClick={() => {
                  setProfileDraft((current) => ({ ...current, avatar: "" }));
                  setIsIconPickerOpen(false);
                }}
              >
                <span className="material-symbols-outlined">close</span>
                <span><strong>Use Default</strong><small>Clear custom icon</small></span>
              </button>
            )}

            <button
              type="button"
              className="sidebar-profile__icon-close"
              onClick={() => setIsIconPickerOpen(false)}
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
