import { Avatar, Button, TextField } from "@renderer/components";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  MEDIAHOARD_PROFILE_COLORS,
  MEDIAHOARD_PROFILE_ICONS,
  useToast,
  useUserDetails,
} from "@renderer/hooks";
import { useEffect, useState } from "react";
import { resolveImageUrl } from "@renderer/helpers";
import {
  DeviceCameraIcon,
  ImageIcon,
  PersonIcon,
  TrashIcon,
} from "@primer/octicons-react";
import { Edit3, Trash2, Upload, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./settings-account.scss";

interface FormValues {
  displayName: string;
  profileImageUrl?: string | null;
  backgroundImageUrl?: string | null;
  profileColor?: string | null;
  profileIcon?: string | null;
}

type ProfileDraft = {
  displayName: string;
  profileColor: string;
  avatar: string;
};

function isImageAvatar(value = "") {
  return value.startsWith("data:") || value.includes("://");
}

export function SettingsAccount() {
  const { t } = useTranslation("settings");
  const { showSuccessToast, showErrorToast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    userDetails,
    profiles,
    hasActiveSubscription,
    patchUser,
    fetchUserDetails,
    createProfile,
    updateProfile,
    switchProfile,
    deleteProfile,
  } = useUserDetails();

  const {
    register,
    formState: { isSubmitting },
    setValue,
    handleSubmit,
    watch,
  } = useForm<FormValues>();

  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(
    null
  );
  const [backgroundImagePreview, setBackgroundImagePreview] = useState<
    string | null
  >(null);
  const displayNamePreview = watch("displayName") || userDetails?.displayName;
  const profileColorPreview =
    watch("profileColor") ||
    userDetails?.profileColor ||
    MEDIAHOARD_PROFILE_COLORS[0];
  const profileIconPreview =
    watch("profileIcon") || userDetails?.profileIcon || "person";
  const requestedProfileId = searchParams.get("profileId");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    displayName: "",
    profileColor: MEDIAHOARD_PROFILE_COLORS[0],
    avatar: "",
  });

  useEffect(() => {
    if (!userDetails) return;

    setValue("displayName", userDetails.displayName);
    setValue("profileImageUrl", userDetails.profileImageUrl);
    setValue("backgroundImageUrl", userDetails.backgroundImageUrl);
    setValue(
      "profileColor",
      userDetails.profileColor || MEDIAHOARD_PROFILE_COLORS[0]
    );
    setValue("profileIcon", userDetails.profileIcon || "person");
    setProfileImagePreview(resolveImageUrl(userDetails.profileImageUrl));
    setBackgroundImagePreview(resolveImageUrl(userDetails.backgroundImageUrl));
  }, [userDetails, setValue]);

  useEffect(() => {
    if (!requestedProfileId || requestedProfileId === userDetails?.id) return;
    if (!profiles.some((profile) => profile.id === requestedProfileId)) return;

    switchProfile(requestedProfileId);
  }, [profiles, requestedProfileId, switchProfile, userDetails?.id]);

  const chooseImage = async () => {
    const { filePaths } = await window.electron.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Image",
          extensions: ["jpg", "jpeg", "png", "gif", "webp"],
        },
      ],
    });

    return filePaths?.[0] ?? null;
  };

  const handleChooseProfileImage = async () => {
    const path = await chooseImage();
    if (!path) return;

    if (!hasActiveSubscription) {
      const { imagePath } = await window.electron
        .processProfileImage(path)
        .catch(() => {
          showErrorToast(t("image_process_failure", { ns: "user_profile" }));
          return { imagePath: null };
        });

      setValue("profileImageUrl", imagePath);
      setValue("profileIcon", null);
      setProfileImagePreview(resolveImageUrl(imagePath));
      return;
    }

    setValue("profileImageUrl", path);
    setValue("profileIcon", null);
    setProfileImagePreview(resolveImageUrl(path));
  };

  const handleChooseBackgroundImage = async () => {
    const path = await chooseImage();
    if (!path) return;

    setValue("backgroundImageUrl", path);
    setBackgroundImagePreview(resolveImageUrl(path));
  };

  const handleSwitchProfile = async (profileId: string) => {
    await switchProfile(profileId);
    navigate(`/settings?tab=account_privacy&profileId=${profileId}`, {
      replace: true,
    });
  };

  const openProfileModal = (profile?: typeof profiles[number]) => {
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
      if (editingProfileId === userDetails?.id) {
        setValue("displayName", profileValues.displayName);
        setValue("profileColor", profileValues.profileColor);
        setValue("profileImageUrl", profileValues.profileImageUrl);
        setValue("profileIcon", profileValues.profileIcon);
        setProfileImagePreview(resolveImageUrl(profileValues.profileImageUrl));
      }
    } else {
      await createProfile(profileValues);
    }
    await fetchUserDetails();
    closeProfileModal();
    showSuccessToast(t("changes_saved"));
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

  const onSubmit = async (values: FormValues) => {
    await patchUser(values);
    await fetchUserDetails();
    showSuccessToast(t("changes_saved"));
  };

  if (!userDetails) return null;

  return (
    <form className="settings-account__form" onSubmit={handleSubmit(onSubmit)}>
      <section className="settings-account__hero">
        {backgroundImagePreview ? (
          <img
            className="settings-account__hero-background"
            src={backgroundImagePreview}
            alt=""
          />
        ) : null}

        <div className="settings-account__hero-overlay">
          <button
            type="button"
            className="settings-account__avatar-button"
            onClick={handleChooseProfileImage}
            style={{ backgroundColor: profileColorPreview }}
          >
            <Avatar
              size={96}
              src={profileImagePreview}
              icon={profileIconPreview}
              color={profileColorPreview}
              alt={userDetails.displayName}
            />
            <span className="settings-account__avatar-overlay">
              <DeviceCameraIcon size={28} />
            </span>
          </button>

          <div className="settings-account__hero-copy">
            <span className="settings-account__eyebrow">Local profile</span>
            <h3>{displayNamePreview}</h3>
            <p>No account required · {userDetails.id}</p>
          </div>

          <div className="settings-account__hero-actions">
            <Button
              type="button"
              theme="outline"
              onClick={handleChooseBackgroundImage}
            >
              <ImageIcon />
              Banner
            </Button>

            {backgroundImagePreview && (
              <Button
                type="button"
                theme="outline"
                onClick={() => {
                  setValue("backgroundImageUrl", null);
                  setBackgroundImagePreview(null);
                }}
              >
                <TrashIcon />
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="settings-account__panel">
        <div className="settings-account__panel-heading">
          <h3>Profiles</h3>
        </div>

        <div className="settings-account__profiles">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={
                profile.id === userDetails.id
                  ? "settings-account__profile-row settings-account__profile-row--active"
                  : "settings-account__profile-row"
              }
            >
              <button
                type="button"
                onClick={() => handleSwitchProfile(profile.id)}
                disabled={profile.id === userDetails.id}
              >
                <Avatar
                  size={40}
                  src={profile.profileImageUrl}
                  icon={profile.profileIcon}
                  color={profile.profileColor}
                  alt={profile.displayName}
                />
                <span>{profile.displayName}</span>
              </button>
              <button
                type="button"
                className="settings-account__profile-delete"
                onClick={() => deleteProfile(profile.id)}
                disabled={profiles.length <= 1}
                title="Delete profile"
              >
                <Trash2 size={16} />
              </button>
              <button
                type="button"
                className="settings-account__profile-edit"
                onClick={() => openProfileModal(profile)}
                title="Edit profile"
              >
                <Edit3 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="settings-account__color-picker">
          <span>Profile Color</span>
          <div className="settings-account__color-swatches">
            {MEDIAHOARD_PROFILE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={
                  profileColorPreview === color
                    ? "settings-account__color-swatch settings-account__color-swatch--active"
                    : "settings-account__color-swatch"
                }
                style={{ backgroundColor: color }}
                onClick={() => setValue("profileColor", color)}
              />
            ))}
            <label className="settings-account__custom-color">
              <span className="material-symbols-outlined">colorize</span>
              <input
                type="color"
                value={profileColorPreview}
                onChange={(event) =>
                  setValue("profileColor", event.target.value)
                }
                title="Custom profile color"
              />
            </label>
          </div>
        </div>

        <div className="settings-account__icon-picker">
          <div className="settings-account__icon-picker-heading">
            <span>Profile Icon</span>
            <Button
              type="button"
              theme="outline"
              onClick={handleChooseProfileImage}
              title="Upload profile icon"
              className="settings-account__icon-upload-button"
            >
              {profileImagePreview ? (
                <DeviceCameraIcon size={16} />
              ) : (
                <Upload size={16} />
              )}
            </Button>
          </div>
          <div>
            {MEDIAHOARD_PROFILE_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={
                  profileIconPreview === icon && !profileImagePreview
                    ? "settings-account__icon-button settings-account__icon-button--active"
                    : "settings-account__icon-button"
                }
                onClick={() => {
                  setValue("profileIcon", icon);
                  setValue("profileImageUrl", null);
                  setProfileImagePreview(null);
                }}
                title={icon}
              >
                <span className="material-symbols-outlined">{icon}</span>
              </button>
            ))}
          </div>
          <label className="settings-account__direct-url">
            <span>Direct URL</span>
            <input
              type="text"
              value={
                profileImagePreview && profileImagePreview.includes("://")
                  ? profileImagePreview
                  : ""
              }
              placeholder="https://..."
              onChange={(event) => {
                const url = event.target.value.trim();
                setValue("profileImageUrl", url || null);
                setValue("profileIcon", url ? null : "person");
                setProfileImagePreview(url ? resolveImageUrl(url) : null);
              }}
            />
          </label>
        </div>

        <div className="settings-account__fields">
          <TextField
            {...register("displayName")}
            label={t("display_name", { ns: "user_profile" })}
            minLength={3}
            maxLength={50}
            theme="dark"
          />
        </div>

        <div className="settings-account__actions">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("saving", { ns: "user_profile" }) : t("save")}
          </Button>

          <Button
            type="button"
            theme="outline"
            onClick={() => openProfileModal()}
          >
            <PersonIcon />
            New profile
          </Button>
        </div>
      </section>

      {isProfileModalOpen && createPortal(
        <div className="settings-account__profile-modal">
          <button
            type="button"
            className="settings-account__profile-modal-backdrop"
            onClick={closeProfileModal}
            aria-label="Close"
          />
          <section className="settings-account__profile-modal-card" role="dialog" aria-modal="true">
            <button
              type="button"
              className="settings-account__profile-modal-close"
              onClick={closeProfileModal}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="settings-account__profile-modal-title">
              <h2>{editingProfileId ? "Edit Profile" : "New Profile"}</h2>
              <p>Customize your environment.</p>
            </div>
            <div className="settings-account__modal-avatar-wrap">
              <button
                type="button"
                className="settings-account__modal-avatar"
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
                <span>
                  <DeviceCameraIcon size={30} />
                </span>
              </button>
            </div>
            <div className="settings-account__modal-swatches">
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
            <label className="settings-account__modal-field">
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
            <div className="settings-account__modal-actions">
              {editingProfileId && (
                <button
                  type="button"
                  className="settings-account__modal-delete"
                  disabled={profiles.length <= 1}
                  onClick={async () => {
                    await deleteProfile(editingProfileId);
                    closeProfileModal();
                  }}
                >
                  <Trash2 size={20} />
                </button>
              )}
              <button type="button" onClick={closeProfileModal}>
                Cancel
              </button>
              <button type="button" onClick={saveProfileModal}>
                {editingProfileId ? "Save Changes" : "Create Profile"}
              </button>
            </div>
          </section>
        </div>,
        document.body
      )}

      {isIconPickerOpen && createPortal(
        <div className="settings-account__icon-dialog">
          <button
            type="button"
            className="settings-account__profile-modal-backdrop"
            onClick={() => setIsIconPickerOpen(false)}
            aria-label="Close avatar picker"
          />
          <section className="settings-account__icon-dialog-card" role="dialog" aria-modal="true">
            <div className="settings-account__profile-modal-title">
              <h3>Profile Avatar</h3>
              <p>Source selection</p>
            </div>
            <div className="settings-account__icon-section">
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
            <label className="settings-account__icon-source">
              <span className="material-symbols-outlined">upload</span>
              <span><strong>Upload from Device</strong><small>Local file</small></span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleAvatarFile(event.target.files?.[0])}
              />
            </label>
            <div className="settings-account__icon-url">
              <div className="settings-account__icon-source settings-account__icon-source--static">
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
                className="settings-account__icon-default"
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
              className="settings-account__icon-close"
              onClick={() => setIsIconPickerOpen(false)}
            >
              Close
            </button>
          </section>
        </div>,
        document.body
      )}
    </form>
  );
}
