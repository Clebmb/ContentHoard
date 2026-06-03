import { useContext, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { DeviceCameraIcon } from "@primer/octicons-react";
import { Avatar, Button, Modal, ModalProps, TextField } from "@renderer/components";
import {
  MEDIAHOARD_PROFILE_COLORS,
  MEDIAHOARD_PROFILE_ICONS,
  useToast,
  useUserDetails,
} from "@renderer/hooks";
import { resolveImageUrl } from "@renderer/helpers";

import { yupResolver } from "@hookform/resolvers/yup";

import * as yup from "yup";

import { userProfileContext } from "@renderer/context";
import "./edit-profile-modal.scss";

interface FormValues {
  profileImageUrl?: string | null;
  profileColor?: string | null;
  profileIcon?: string | null;
  displayName: string;
}

export function EditProfileModal(
  props: Omit<ModalProps, "children" | "title">
) {
  const { t } = useTranslation("user_profile");

  const schema = yup.object({
    displayName: yup
      .string()
      .required(t("required_field"))
      .min(3, t("displayname_min_length"))
      .max(50, t("displayname_max_length")),
  });

  const {
    register,
    control,
    setValue,
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
  });

  const { getUserProfile } = useContext(userProfileContext);

  const { userDetails, fetchUserDetails, hasActiveSubscription } =
    useUserDetails();

  useEffect(() => {
    if (userDetails) {
      setValue("displayName", userDetails.displayName);
      setValue("profileImageUrl", userDetails.profileImageUrl);
      setValue("profileColor", userDetails.profileColor || "#FFFFFF");
      setValue("profileIcon", userDetails.profileIcon || "person");
    }
  }, [setValue, userDetails]);

  const { patchUser } = useUserDetails();

  const { showSuccessToast, showErrorToast } = useToast();
  const profileColorPreview =
    watch("profileColor") || userDetails?.profileColor || "#FFFFFF";
  const profileIconPreview =
    watch("profileIcon") || userDetails?.profileIcon || "person";
  const profileImagePreview = watch("profileImageUrl");

  const onSubmit = async (values: FormValues) => {
    return patchUser(values)
      .then(async () => {
        await Promise.allSettled([fetchUserDetails(), getUserProfile()]);
        props.onClose();
        showSuccessToast(t("saved_successfully"));
      })
      .catch(() => {
        showErrorToast(t("try_again"));
      });
  };

  return (
    <Modal {...props} title={t("edit_profile")} clickOutsideToClose={false}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="edit-profile-modal__form"
      >
        <div className="edit-profile-modal__content">
          <Controller
            control={control}
            name="profileImageUrl"
            render={({ field: { value, onChange } }) => {
              const handleChangeProfileAvatar = async () => {
                const { filePaths } = await window.electron.showOpenDialog({
                  properties: ["openFile"],
                  filters: [
                    {
                      name: "Image",
                      extensions: ["jpg", "jpeg", "png", "gif", "webp"],
                    },
                  ],
                });

                if (filePaths && filePaths.length > 0) {
                  const path = filePaths[0];

                  if (!hasActiveSubscription) {
                    const { imagePath } = await window.electron
                      .processProfileImage(path)
                      .catch(() => {
                        showErrorToast(t("image_process_failure"));
                        return { imagePath: null };
                      });

                    onChange(imagePath);
                  } else {
                    onChange(path);
                  }

                  setValue("profileIcon", null);
                }
              };

              const getImageUrl = () => {
                if (value) {
                  return resolveImageUrl(value);
                }
                if (userDetails?.profileImageUrl)
                  return resolveImageUrl(userDetails.profileImageUrl);

                return null;
              };

              const imageUrl = getImageUrl();

              return (
                <button
                  type="button"
                  className="edit-profile-modal__avatar-container"
                  onClick={handleChangeProfileAvatar}
                  style={{ backgroundColor: profileColorPreview }}
                >
                  <Avatar
                    size={128}
                    src={imageUrl}
                    icon={profileIconPreview}
                    color={profileColorPreview}
                    alt={userDetails?.displayName}
                  />

                  <div className="edit-profile-modal__avatar-overlay">
                    <DeviceCameraIcon size={38} />
                  </div>
                </button>
              );
            }}
          />

          <div className="edit-profile-modal__color-picker">
            {MEDIAHOARD_PROFILE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={
                  profileColorPreview === color
                    ? "edit-profile-modal__color-swatch edit-profile-modal__color-swatch--active"
                    : "edit-profile-modal__color-swatch"
                }
                style={{ backgroundColor: color }}
                onClick={() => setValue("profileColor", color)}
                title={color}
              />
            ))}
          </div>

          <div className="edit-profile-modal__icon-picker">
            {MEDIAHOARD_PROFILE_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={
                  profileIconPreview === icon && !profileImagePreview
                    ? "edit-profile-modal__icon-button edit-profile-modal__icon-button--active"
                    : "edit-profile-modal__icon-button"
                }
                onClick={() => {
                  setValue("profileIcon", icon);
                  setValue("profileImageUrl", null);
                }}
                title={icon}
              >
                <span className="material-symbols-outlined">{icon}</span>
              </button>
            ))}
          </div>

          <TextField
            {...register("displayName")}
            label={t("display_name")}
            minLength={3}
            maxLength={50}
            containerProps={{ style: { width: "100%" } }}
            error={errors.displayName?.message}
          />
        </div>

        <Button
          disabled={isSubmitting}
          className="edit-profile-modal__submit"
          type="submit"
        >
          {isSubmitting ? t("saving") : t("save")}
        </Button>
      </form>
    </Modal>
  );
}
