import { useCallback, useContext, useMemo, useState } from "react";
import { userProfileContext } from "@renderer/context";
import { PencilIcon, PersonIcon } from "@primer/octicons-react";
import { buildGameDetailsPath, resolveImageUrl } from "@renderer/helpers";
import { Avatar, Button, FullscreenMediaModal, Link } from "@renderer/components";
import { useTranslation } from "react-i18next";
import { useAppSelector, useDate, useToast, useUserDetails } from "@renderer/hooks";
import { addSeconds } from "date-fns";
import { useNavigate } from "react-router-dom";

import Skeleton from "react-loading-skeleton";
import { UploadBackgroundImageButton } from "../upload-background-image-button/upload-background-image-button";
import "./profile-hero.scss";

export function ProfileHero() {
  const [showFullscreenAvatar, setShowFullscreenAvatar] = useState(false);
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  const { isMe, userProfile, heroBackground, backgroundImage } =
    useContext(userProfileContext);
  const { profiles, createProfile, switchProfile, deleteProfile } =
    useUserDetails();

  const { gameRunning } = useAppSelector((state) => state.gameRunning);

  const { t } = useTranslation("user_profile");
  const { formatDistance } = useDate();
  const { showSuccessToast } = useToast();
  const navigate = useNavigate();

  const openProfileSettings = useCallback(() => {
    if (!userProfile) return;
    navigate(`/settings?tab=account_privacy&profileId=${userProfile.id}`);
  }, [navigate, userProfile]);

  const handleCreateProfile = useCallback(async () => {
    setIsPerformingAction(true);

    try {
      const profile = await createProfile({ displayName: "New Profile" });
      showSuccessToast("Created a new local profile");
      navigate(`/profile/${profile.id}`);
    } finally {
      setIsPerformingAction(false);
    }
  }, [createProfile, navigate, showSuccessToast]);

  const profileActions = useMemo(() => {
    if (!userProfile || !isMe) return null;

    return (
      <>
        <Button
          theme="outline"
          onClick={openProfileSettings}
          disabled={isPerformingAction}
          className="profile-hero__button--outline"
        >
          <PencilIcon />
          {t("edit_profile")}
        </Button>

        <Button
          theme="outline"
          onClick={handleCreateProfile}
          disabled={isPerformingAction}
        >
          <PersonIcon />
          New profile
        </Button>

        {profiles.length > 1 && (
          <Button
            theme="danger"
            onClick={async () => {
              const nextProfile = await deleteProfile(userProfile.id);
              if (nextProfile) navigate(`/profile/${nextProfile.id}`);
            }}
            disabled={isPerformingAction}
          >
            Delete profile
          </Button>
        )}
      </>
    );
  }, [
    deleteProfile,
    handleCreateProfile,
    isMe,
    isPerformingAction,
    navigate,
    openProfileSettings,
    profiles.length,
    t,
    userProfile,
  ]);

  const handleAvatarClick = useCallback(() => {
    if (userProfile?.profileImageUrl) {
      setShowFullscreenAvatar(true);
    } else if (isMe) {
      openProfileSettings();
    }
  }, [isMe, openProfileSettings, userProfile?.profileImageUrl]);

  const currentGame = useMemo(() => {
    if (isMe) {
      if (gameRunning)
        return {
          ...gameRunning,
          objectId: gameRunning.objectId,
          sessionDurationInSeconds: gameRunning.sessionDurationInMillis / 1000,
        };

      return null;
    }
    return userProfile?.currentGame;
  }, [isMe, userProfile, gameRunning]);

  const profileImageUrl = resolveImageUrl(userProfile?.profileImageUrl);
  const backgroundImageUrl = resolveImageUrl(backgroundImage);

  return (
    <>
      <FullscreenMediaModal
        visible={showFullscreenAvatar}
        onClose={() => setShowFullscreenAvatar(false)}
        src={profileImageUrl}
        alt={userProfile?.displayName}
      />

      <section
        className="profile-hero__content-box"
        style={{ background: !backgroundImageUrl ? heroBackground : undefined }}
      >
        {backgroundImageUrl && (
          <img
            src={backgroundImageUrl}
            alt=""
            className="profile-hero__background-image"
          />
        )}

        <div
          className={`profile-hero__background-overlay ${
            !backgroundImageUrl
              ? "profile-hero__background-overlay--transparent"
              : ""
          }`}
        >
          <div className="profile-hero__user-information">
            <button
              type="button"
              className="profile-hero__avatar-button"
              onClick={handleAvatarClick}
              style={{ backgroundColor: userProfile?.profileColor ?? undefined }}
            >
              <Avatar
                size={96}
                alt={userProfile?.displayName}
                src={profileImageUrl}
                icon={userProfile?.profileIcon}
                color={userProfile?.profileColor}
              />
            </button>

            <div className="profile-hero__information">
              {userProfile ? (
                <div className="profile-hero__display-name-container">
                  <h2 className="profile-hero__display-name">
                    {userProfile?.displayName}
                  </h2>
                </div>
              ) : (
                <Skeleton width={150} height={28} />
              )}

              {currentGame && (
                <div className="profile-hero__current-game-wrapper">
                  <div className="profile-hero__current-game-details">
                    <Link
                      to={buildGameDetailsPath({
                        ...currentGame,
                        objectId: currentGame.objectId,
                      })}
                    >
                      {currentGame.title}
                    </Link>
                  </div>

                  <small>
                    {t("playing_for", {
                      amount: formatDistance(
                        addSeconds(
                          new Date(),
                          -currentGame.sessionDurationInSeconds
                        ),
                        new Date()
                      ),
                    })}
                  </small>
                </div>
              )}
            </div>

            <UploadBackgroundImageButton />
          </div>
        </div>

        {isMe && profiles.length > 1 && (
          <div className="profile-hero__profile-switcher">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={
                  profile.id === userProfile?.id
                    ? "profile-hero__profile-chip profile-hero__profile-chip--active"
                    : "profile-hero__profile-chip"
                }
                onClick={async () => {
                  await switchProfile(profile.id);
                  navigate(`/profile/${profile.id}`);
                }}
              >
                <Avatar
                  size={28}
                  src={profile.profileImageUrl}
                  icon={profile.profileIcon}
                  color={profile.profileColor}
                  alt={profile.displayName}
                />
                <span>{profile.displayName}</span>
              </button>
            ))}
          </div>
        )}

        <div
          className={`profile-hero__hero-panel ${
            !backgroundImageUrl ? "profile-hero__hero-panel--transparent" : ""
          }`}
          style={{
            background: !backgroundImageUrl ? heroBackground : undefined,
          }}
        >
          <div className="profile-hero__actions">{profileActions}</div>
        </div>
      </section>
    </>
  );
}
