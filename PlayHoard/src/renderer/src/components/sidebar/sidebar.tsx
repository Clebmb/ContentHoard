import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Tooltip } from "react-tooltip";

import { ConfirmationModal } from "@renderer/components";
import {
  getPlayhoardThemeSettings,
  PLAYHOARD_THEME_UPDATED_EVENT,
  resolveImageUrl,
} from "@renderer/helpers";
import { useToast, useUserDetails } from "@renderer/hooks";
import {
  BellIcon,
  CommentDiscussionIcon,
  PlusIcon,
} from "@primer/octicons-react";
import appIconUrl from "@renderer/assets/icon.png";
import deckyIcon from "@renderer/assets/icons/decky.png";
import cn from "classnames";

import { routes } from "./routes";
import { SidebarAddingCustomGameModal } from "./sidebar-adding-custom-game-modal";
import { SidebarProfile } from "./sidebar-profile";

import "./sidebar.scss";

const PLAYHOARD_ICON_VERSION = "phicon-20260531";
const playhoardIconUrl = `${appIconUrl}${appIconUrl.includes("?") ? "&" : "?"}v=${PLAYHOARD_ICON_VERSION}`;

export function Sidebar() {
  const { t } = useTranslation("sidebar");
  const navigate = useNavigate();
  const location = useLocation();
  const { hasActiveSubscription } = useUserDetails();
  const { showSuccessToast, showErrorToast } = useToast();

  const [deckyPluginInfo, setDeckyPluginInfo] = useState<{
    installed: boolean;
    version: string | null;
    outdated: boolean;
  }>({ installed: false, version: null, outdated: false });
  const [homebrewFolderExists, setHomebrewFolderExists] = useState(false);
  const [showDeckyConfirmModal, setShowDeckyConfirmModal] = useState(false);
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [brandTheme, setBrandTheme] = useState(getPlayhoardThemeSettings);
  const navRef = useRef<HTMLElement>(null);

  const loadDeckyPluginInfo = useCallback(async () => {
    if (window.electron.platform !== "linux") return;

    try {
      const [info, folderExists] = await Promise.all([
        window.electron.getHydraDeckyPluginInfo(),
        window.electron.checkHomebrewFolderExists(),
      ]);

      setDeckyPluginInfo({
        installed: info.installed,
        version: info.version,
        outdated: info.outdated,
      });
      setHomebrewFolderExists(folderExists);
    } catch (error) {
      console.error("Failed to load Decky plugin info:", error);
    }
  }, []);

  useEffect(() => {
    loadDeckyPluginInfo();
  }, [loadDeckyPluginInfo]);

  useEffect(() => {
    const updateBrandTheme = () => setBrandTheme(getPlayhoardThemeSettings());
    window.addEventListener(PLAYHOARD_THEME_UPDATED_EVENT, updateBrandTheme);

    return () => {
      window.removeEventListener(
        PLAYHOARD_THEME_UPDATED_EVENT,
        updateBrandTheme
      );
    };
  }, []);

  const handleSidebarItemClick = (path: string) => {
    if (path !== location.pathname) {
      navigate(path);
    }
  };

  const handleInstallHydraDeckyPlugin = () => {
    if (deckyPluginInfo.installed && !deckyPluginInfo.outdated) {
      return;
    }
    setShowDeckyConfirmModal(true);
  };

  const handleConfirmDeckyInstallation = async () => {
    setShowDeckyConfirmModal(false);

    try {
      const result = await window.electron.installHydraDeckyPlugin();

      if (result.success) {
        showSuccessToast(
          t("decky_plugin_installed", {
            version: result.currentVersion,
          })
        );
        await loadDeckyPluginInfo();
      } else {
        showErrorToast(
          t("decky_plugin_installation_failed", {
            error: result.error || "Unknown error",
          })
        );
      }
    } catch (error) {
      showErrorToast(
        t("decky_plugin_installation_error", { error: String(error) })
      );
    }
  };

  const deckyTitle = useMemo(() => {
    if (deckyPluginInfo.installed && !deckyPluginInfo.outdated) {
      return t("decky_plugin_installed_version", {
        version: deckyPluginInfo.version,
      });
    }

    return deckyPluginInfo.installed && deckyPluginInfo.outdated
      ? t("update_decky_plugin")
      : t("install_decky_plugin");
  }, [deckyPluginInfo, t]);

  return (
    <>
      <aside
        ref={navRef}
        className={cn("sidebar", {
          "sidebar--darwin": window.electron.platform === "darwin",
        })}
      >
        <div className="sidebar__brand-group">
          {window.electron.contentHoard?.open && (
            <div className="sidebar__contenthoard-switcher">
              <button
                type="button"
                className="sidebar__icon-button"
                onClick={() => window.electron.contentHoard?.open()}
                title="Open ContentHoard"
                aria-label="Open ContentHoard"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"/></svg>
              </button>
            </div>
          )}
          <button
            type="button"
            className="sidebar__brand"
            onClick={() => handleSidebarItemClick("/catalogue")}
            aria-label="PlayHoard"
          >
          {brandTheme.logoUrl ? (
            <span className="sidebar__brand-logo">
              <img src={resolveImageUrl(brandTheme.logoUrl) ?? ""} alt="" />
            </span>
          ) : (
            <span className="sidebar__brand-logo">
              <img src={playhoardIconUrl} alt="" />
            </span>
          )}
          <span className="sidebar__brand-copy">
            {brandTheme.headerText || "PlayHoard"}
          </span>
        </button>
        </div>

        <nav className="sidebar__menu" aria-label="Primary">
          {routes.map(({ nameKey, path, render }) => (
            <button
              key={nameKey}
              type="button"
              className={cn("sidebar__menu-item", {
                "sidebar__menu-item--active":
                  location.pathname === path ||
                  (path !== "/" && location.pathname.startsWith(path)),
              })}
              onClick={() => handleSidebarItemClick(path)}
              title={t(nameKey)}
            >
              {render()}
              <span>{t(nameKey)}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__actions">
          <button
            type="button"
            className="sidebar__icon-button"
            onClick={() => setShowAddGameModal(true)}
            data-tooltip-id="add-custom-game-tooltip"
            data-tooltip-content={t("add_custom_game_tooltip")}
            data-tooltip-place="bottom"
            aria-label={t("add_custom_game_tooltip")}
          >
            <PlusIcon size={16} />
          </button>

          {window.electron.platform === "linux" && homebrewFolderExists && (
            <button
              type="button"
              className="sidebar__icon-button sidebar__icon-button--decky"
              onClick={handleInstallHydraDeckyPlugin}
              title={deckyTitle}
            >
              <img src={deckyIcon} alt="" />
            </button>
          )}

          {hasActiveSubscription && (
            <button
              type="button"
              className="sidebar__icon-button"
              data-open-support-chat
              title={t("need_help")}
            >
              <CommentDiscussionIcon size={16} />
            </button>
          )}

          <button
            type="button"
            className="sidebar__icon-button"
            onClick={() => navigate("/notifications")}
            title={t("notifications")}
          >
            <BellIcon size={16} />
          </button>

          <SidebarProfile />
        </div>
      </aside>

      <SidebarAddingCustomGameModal
        visible={showAddGameModal}
        onClose={() => setShowAddGameModal(false)}
      />

      <ConfirmationModal
        visible={showDeckyConfirmModal}
        title={
          deckyPluginInfo.installed && deckyPluginInfo.outdated
            ? t("update_decky_plugin_title")
            : t("install_decky_plugin_title")
        }
        descriptionText={
          deckyPluginInfo.installed && deckyPluginInfo.outdated
            ? t("update_decky_plugin_message")
            : t("install_decky_plugin_message")
        }
        onClose={() => setShowDeckyConfirmModal(false)}
        onConfirm={handleConfirmDeckyInstallation}
        cancelButtonLabel={t("cancel")}
        confirmButtonLabel={t("confirm")}
      />

      <Tooltip id="add-custom-game-tooltip" />
    </>
  );
}
