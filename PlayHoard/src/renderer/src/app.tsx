import { BottomPanel, Header, Sidebar, Toast } from "@renderer/components";
import {
  useAppDispatch,
  useAppSelector,
  useDownload,
  useLibrary,
  useToast,
  useUserDetails,
} from "@renderer/hooks";
import { useDownloadOptionsListener } from "@renderer/hooks/use-download-options-listener";
import i18n from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { WorkWonders } from "workwonders-sdk";

import {
  clearExtraction,
  closeToast,
  setExtractionProgress,
  setGameRunning,
  setProfileBackground,
  setUserDetails,
  setUserPreferences,
  toggleDraggingDisabled,
} from "@renderer/features";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSubscription } from "./hooks/use-subscription";
import { ArchiveDeletionModal } from "./pages/downloads/archive-deletion-error-modal";
import { HydraCloudModal } from "./pages/shared-modals/hydra-cloud/hydra-cloud-modal";

import type { UserPreferences } from "@types";
import "./app.scss";
import {
  getAchievementSoundUrl,
  getAchievementSoundVolume,
  getPlayhoardThemeSettings,
  injectCustomCss,
  PLAYHOARD_THEME_UPDATED_EVENT,
  PLAYHOARD_PROFILE_SWITCHED_EVENT,
  PLAYHOARD_CONTENTHOARD_STATE_UPDATED_EVENT,
  applyPlayhoardTheme,
  removeCustomCss,
} from "./helpers";
import type { PlayhoardThemeSettings } from "./helpers";
import { levelDBService } from "./services/leveldb.service";

const CONTENTHOARD_PROFILE_IDS_KEY = "playhoard-contenthoard-profile-ids";
const CONTENTHOARD_CACHED_ACTIVE_KEY = "playhoard-contenthoard-cached-activeProfileId";

const usernameFromDisplayName = (displayName?: string) => {
  const username = displayName
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return username || "player";
};

type ContentHoardSharedProfile = {
  id: string;
  name?: string;
  icon?: string;
  color?: string;
  createdAt?: number;
};

const contentHoardProfileToStoredProfile = (
  shared: ContentHoardSharedProfile
): Record<string, unknown> => {
  const displayName = String(shared.name || "ContentHoard");
  return {
    id: String(shared.id),
    username: usernameFromDisplayName(displayName),
    email: null,
    displayName,
    profileImageUrl: null,
    backgroundImageUrl: null,
    profileColor: String(shared.color || "#FFFFFF"),
    profileIcon: String(shared.icon || "person"),
    profileVisibility: "PUBLIC",
    bio: "",
    workwondersJwt: "",
    subscription: null,
    karma: 0,
    quirks: { backupsPerGameLimit: 0 },
  };
};

export interface AppProps {
  children: React.ReactNode;
}

type WorkWondersWithKnowledge = WorkWonders & {
  knowledge?: {
    initKnowledgeWidget?: () => void;
    showArticle?: (articleId: number) => void;
  };
};

export function App() {
  const contentRef = useRef<HTMLDivElement>(null);
  const { updateLibrary, library } = useLibrary();

  // Listen for new download options updates
  useDownloadOptionsListener();

  const { t } = useTranslation("app");

  const { clearDownload, setLastPacket, lastPacket } = useDownload();

  const workwondersRef = useRef<WorkWonders | null>(null);

  const {
    hasActiveSubscription,
    fetchUserDetails,
    updateUserDetails,
    switchProfile,
  } = useUserDetails();

  // Keep a live reference so the ContentHoard shared-state handler always
  // calls the latest profile switcher without re-subscribing listeners.
  const switchProfileRef = useRef(switchProfile);
  useEffect(() => {
    switchProfileRef.current = switchProfile;
  }, [switchProfile]);

  const { hideHydraCloudModal, isHydraCloudModalVisible, hydraCloudFeature } =
    useSubscription();

  const dispatch = useAppDispatch();

  const navigate = useNavigate();
  const location = useLocation();

  const draggingDisabled = useAppSelector(
    (state) => state.window.draggingDisabled
  );

  const toast = useAppSelector((state) => state.toast);

  const { showSuccessToast, showErrorToast } = useToast();

  const [showArchiveDeletionModal, setShowArchiveDeletionModal] =
    useState(false);
  const [archivePaths, setArchivePaths] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      levelDBService.get("userPreferences", null, "json"),
      updateLibrary(),
    ]).then(([preferences]) => {
      dispatch(setUserPreferences(preferences as UserPreferences | null));
    });
  }, [navigate, location.pathname, dispatch, updateLibrary]);

  useEffect(() => {
    const unsubscribe = window.electron.onUserPreferencesUpdated(
      (preferences) => {
        if (!preferences) {
          dispatch(setUserPreferences(null));
          return;
        }

        if (preferences.language && preferences.language !== i18n.language) {
          void i18n.changeLanguage(preferences.language);
        }

        dispatch(setUserPreferences(preferences));
      }
    );

    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  useEffect(() => {
    const unsubscribe = window.electron.onDownloadProgress(
      (downloadProgress) => {
        if (
          downloadProgress?.progress === 1 &&
          !downloadProgress.isCheckingFiles &&
          !downloadProgress.isDownloadingMetadata
        ) {
          clearDownload();
          updateLibrary();
          return;
        }

        setLastPacket(downloadProgress);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [clearDownload, setLastPacket, updateLibrary]);

  useEffect(() => {
    const unsubscribe = window.electron.onHardDelete(() => {
      updateLibrary();
    });

    return () => unsubscribe();
  }, [updateLibrary]);

  useEffect(() => {
    if (!lastPacket?.gameId) return;

    const activeGame = library.find((game) => game.id === lastPacket.gameId);

    if (!activeGame || activeGame.download?.status !== "active") {
      clearDownload();
    }
  }, [clearDownload, lastPacket?.gameId, library]);

  const setupWorkWonders = useCallback(
    async (token?: string, locale?: string) => {
      if (workwondersRef.current) return;

      workwondersRef.current = new WorkWonders();

      const possibleLocales = ["en", "pt", "ru"];

      const parsedLocale =
        possibleLocales.find((l) => l === locale?.slice(0, 2)) ?? "en";

      await workwondersRef.current.init({
        organization: "hydra",
        token,
        locale: parsedLocale,
      });

      workwondersRef.current.changelog.initChangelogWidget();
      workwondersRef.current.changelog.initChangelogWidgetMini();
      const workWondersWithKnowledge =
        workwondersRef.current as WorkWondersWithKnowledge;
      workWondersWithKnowledge.knowledge?.initKnowledgeWidget?.();

      if (token) {
        workwondersRef.current.feedback.initFeedbackWidget();
      }
    },
    [workwondersRef]
  );

  useEffect(() => {
    const onClick = async (event: MouseEvent) => {
      const userPreferences = await window.electron.getUserPreferences();
      const language = userPreferences?.language ?? "en";

      const articleMapping = {
        pt: {
          "cannot-write-directory": 1429,
          seeding: 1442,
          "peers-and-seeds": 1449,
          "steam-achievements": 1412,
        },
        en: {
          "cannot-write-directory": 4122,
          seeding: 4116,
          "peers-and-seeds": 4119,
          "steam-achievements": 4140,
        },
      };

      const $helpCenterTarget = (event.target as HTMLElement).closest(
        "[data-open-article]"
      );

      if ($helpCenterTarget) {
        const article = $helpCenterTarget.getAttribute("data-open-article");
        const articleId =
          articleMapping[language.slice(0, 2)]?.[
            article as keyof typeof articleMapping
          ] ?? articleMapping["en"]?.[article as keyof typeof articleMapping];

        if (articleId) {
          const workWondersWithKnowledge =
            workwondersRef.current as WorkWondersWithKnowledge | null;
          workWondersWithKnowledge?.knowledge?.showArticle?.(articleId);
        }
      }
    };

    window.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("click", onClick);
    };
  }, []);

  const setupExternalResources = useCallback(async () => {
    const cachedUserDetails = window.localStorage.getItem("userDetails");

    if (cachedUserDetails) {
      const { profileBackground, ...userDetails } =
        JSON.parse(cachedUserDetails);

      dispatch(setUserDetails(userDetails));
      dispatch(setProfileBackground(profileBackground));
    }

    const userPreferences = await window.electron.getUserPreferences();
    const userDetails = await fetchUserDetails().catch(() => null);

    if (userDetails) {
      updateUserDetails(userDetails);
    }

    setupWorkWonders(userDetails?.workwondersJwt, userPreferences?.language);

    const externalResourcesUrl = import.meta.env.RENDERER_VITE_EXTERNAL_RESOURCES_URL;
    if (externalResourcesUrl && !document.getElementById("external-resources")) {
      const $script = document.createElement("script");
      $script.id = "external-resources";
      $script.src = `${externalResourcesUrl}/bundle.js?t=${Date.now()}`;
      document.head.appendChild($script);
    }
  }, [fetchUserDetails, updateUserDetails, dispatch, setupWorkWonders]);

  useEffect(() => {
    setupExternalResources();
  }, [setupExternalResources]);

  useEffect(() => {
    const applySavedTheme = () => {
      applyPlayhoardTheme(getPlayhoardThemeSettings());
    };

    applySavedTheme();
    window.addEventListener(PLAYHOARD_THEME_UPDATED_EVENT, applySavedTheme);
    window.addEventListener(PLAYHOARD_PROFILE_SWITCHED_EVENT, applySavedTheme);

    return () => {
      window.removeEventListener(PLAYHOARD_THEME_UPDATED_EVENT, applySavedTheme);
      window.removeEventListener(
        PLAYHOARD_PROFILE_SWITCHED_EVENT,
        applySavedTheme
      );
    };
  }, []);

  const debounceSharedState = useCallback((shared: unknown) => {
    const s = shared as Record<string, unknown>;
    console.debug("[contenthoard] debounceSharedState received:", s);    if (s.profiles && Array.isArray(s.profiles)) {
      const sharedProfiles = s.profiles as ContentHoardSharedProfile[];
      const sharedActiveId = s.activeProfileId ? String(s.activeProfileId) : "";
      const previousActiveId =
        localStorage.getItem(CONTENTHOARD_CACHED_ACTIVE_KEY) || "";
      localStorage.setItem(
        "playhoard-contenthoard-cached-profiles",
        JSON.stringify(s.profiles)
      );
      if (sharedActiveId) {
        localStorage.setItem(CONTENTHOARD_CACHED_ACTIVE_KEY, sharedActiveId);
      }

      const chIds = new Set(sharedProfiles.map((p) => String(p.id)));
      let trackedIds: string[] = [];
      const trackedIdsStr = localStorage.getItem(CONTENTHOARD_PROFILE_IDS_KEY);
      if (trackedIdsStr) {
        try {
          const parsed = JSON.parse(trackedIdsStr) as string[];
          if (Array.isArray(parsed)) trackedIds = parsed.map(String);
        } catch {
          /* ignore parse error */
        }
      }

      const profilesStr = localStorage.getItem("playhoardProfiles");
      if (profilesStr) {
        try {
          const profiles = JSON.parse(profilesStr) as Array<
            Record<string, unknown>
          >;
          let mutated = false;

          // Sync deletions: if a profile that originated from ContentHoard
          // is no longer in ContentHoard's list, remove it locally.
          const toRemove = trackedIds.filter((id) => !chIds.has(id));
          if (toRemove.length) {
            const filtered = profiles.filter(
              (p) => !toRemove.includes(String(p.id))
            );
            if (filtered.length !== profiles.length) {
              profiles.length = 0;
              profiles.push(...filtered);
              mutated = true;
              // If the active profile was deleted, reset to first available
              const activeId = localStorage.getItem("playhoardActiveProfileId");
              if (activeId && toRemove.includes(activeId)) {
                const nextId = filtered[0]?.id || null;
                if (nextId) {
                  localStorage.setItem("playhoardActiveProfileId", String(nextId));
                } else {
                  localStorage.removeItem("playhoardActiveProfileId");
                }
              }
            }
            trackedIds = trackedIds.filter((id) => chIds.has(id));
          }

          // Live upsert: mirror the full ContentHoard profile list so profiles
          // created in any Hoard app (via ContentHoard) reach this one too.
          for (const sharedProfile of sharedProfiles) {
            const id = String(sharedProfile.id);
            if (!id) continue;
            const index = profiles.findIndex((p) => String(p.id) === id);
            if (index >= 0) {
              const local = profiles[index];
              const displayName = String(
                sharedProfile.name || local.displayName || "ContentHoard"
              );
              const profileColor = String(
                sharedProfile.color || local.profileColor || "#FFFFFF"
              );
              const profileIcon = String(
                sharedProfile.icon || local.profileIcon || "person"
              );
              if (
                local.displayName !== displayName ||
                local.profileColor !== profileColor ||
                local.profileIcon !== profileIcon
              ) {
                profiles[index] = {
                  ...local,
                  displayName,
                  username: usernameFromDisplayName(displayName),
                  profileColor,
                  profileIcon,
                };
                mutated = true;
              }
            } else {
              profiles.push(contentHoardProfileToStoredProfile(sharedProfile));
              mutated = true;
            }
            if (!trackedIds.includes(id)) trackedIds.push(id);
          }

          if (mutated) {
            localStorage.setItem("playhoardProfiles", JSON.stringify(profiles));
            // Notify the UI to refresh
            window.dispatchEvent(
              new CustomEvent(PLAYHOARD_CONTENTHOARD_STATE_UPDATED_EVENT)
            );
          }
        } catch {
          /* ignore parse error */
        }
      }
      if (trackedIds.length) {
        localStorage.setItem(CONTENTHOARD_PROFILE_IDS_KEY, JSON.stringify(trackedIds));
      }

      // Follow ContentHoard's active profile when it changes. Skip the very
      // first event so first contact never hijacks the locally active profile.
      if (
        sharedActiveId &&
        previousActiveId &&
        sharedActiveId !== previousActiveId
      ) {
        let known = false;
        try {
          const stored = JSON.parse(
            localStorage.getItem("playhoardProfiles") || "[]"
          ) as Array<Record<string, unknown>>;
          known = stored.some((p) => String(p.id) === sharedActiveId);
        } catch {
          /* ignore parse error */
        }
        const activeId = localStorage.getItem("playhoardActiveProfileId");
        if (known && activeId !== sharedActiveId) {
          void switchProfileRef.current?.(sharedActiveId)?.catch?.(() => undefined);
        }
      }
    }
    if (s.theme && typeof s.theme === "object") {
      const t = s.theme as Record<string, string>;
      localStorage.setItem("playhoard-contenthoard-cached-theme", JSON.stringify(t));

      const promoted: Record<string, string> = { ...t };
      if (t.playhoardHeaderText) promoted.headerText = t.playhoardHeaderText;
      if (t.playhoardLogoUrl) promoted.logoUrl = t.playhoardLogoUrl;
      applyPlayhoardTheme(promoted as PlayhoardThemeSettings);
      const chTheme = window.electron.contentHoard?.theme;
      if (chTheme && typeof chTheme === "object") {
        Object.assign(chTheme, t);
        const chThemeRecord = chTheme as Record<string, string>;
        if (t.playhoardHeaderText) chThemeRecord.headerText = t.playhoardHeaderText;
        if (t.playhoardLogoUrl) chThemeRecord.logoUrl = t.playhoardLogoUrl;
      }
      window.dispatchEvent(new CustomEvent(PLAYHOARD_THEME_UPDATED_EVENT));
      window.dispatchEvent(new CustomEvent(PLAYHOARD_CONTENTHOARD_STATE_UPDATED_EVENT));
    }
    if (s.savedThemes && Array.isArray(s.savedThemes)) {
      localStorage.setItem("playhoard-contenthoard-saved-themes", JSON.stringify(s.savedThemes));
      window.dispatchEvent(new CustomEvent(PLAYHOARD_CONTENTHOARD_STATE_UPDATED_EVENT));
    }
  }, []);

  useEffect(() => {
    if (window.electron.contentHoard?.enabled && window.electron.contentHoard.readSharedState) {
      window.electron.contentHoard.readSharedState().then((shared) => {
        if (shared && typeof shared === "object") {
          debounceSharedState(shared);
        }
      }).catch(() => undefined);
    }
  }, [debounceSharedState]);

  const onSignIn = useCallback(() => {
    fetchUserDetails().then((response) => {
      if (response) {
        updateUserDetails(response);
        showSuccessToast(t("successfully_signed_in"));
      }
    });
  }, [fetchUserDetails, t, showSuccessToast, updateUserDetails]);

  useEffect(() => {
    const unsubscribe = window.electron.onGamesRunning((gamesRunning) => {
      if (gamesRunning.length) {
        const lastGame = gamesRunning[gamesRunning.length - 1];
        const libraryGame = library.find(
          (library) => library.id === lastGame.id
        );

        if (libraryGame) {
          dispatch(
            setGameRunning({
              ...libraryGame,
              sessionDurationInMillis: lastGame.sessionDurationInMillis,
            })
          );
          return;
        }
      }
      dispatch(setGameRunning(null));
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch, library]);

  useEffect(() => {
    const listeners = [
      window.electron.onSignIn(onSignIn),
      window.electron.onLibraryBatchComplete(() => {
        updateLibrary();
      }),
      window.electron.onDownloadsUpdated(() => {
        updateLibrary();
      }),
      window.electron.onSignOut(() => {
        fetchUserDetails();
      }),
      window.electron.onExtractionProgress((shop, objectId, progress) => {
        dispatch(setExtractionProgress({ shop, objectId, progress }));
      }),
      window.electron.onExtractionComplete(() => {
        dispatch(clearExtraction());
        updateLibrary();
      }),
      window.electron.onExtractionFailed(() => {
        dispatch(clearExtraction());
        updateLibrary();
        showErrorToast(
          t("extraction_failed_title", { ns: "downloads" }),
          t("extraction_failed_description", { ns: "downloads" })
        );
      }),
      window.electron.onArchiveDeletionPrompt((paths) => {
        setArchivePaths(paths);
        setShowArchiveDeletionModal(true);
      }),
      window.electron.contentHoard?.onSharedStateUpdated?.(debounceSharedState),
    ];

    return () => {
      listeners.forEach((unsubscribe) => unsubscribe());
    };
  }, [onSignIn, updateLibrary, fetchUserDetails, dispatch, showErrorToast, t]);

  useEffect(() => {
    const asyncScrollAndNotify = async () => {
      if (contentRef.current) contentRef.current.scrollTop = 0;
      await workwondersRef.current?.notifyUrlChange?.();
    };
    asyncScrollAndNotify();
  }, [location.pathname, location.search]);

  useEffect(() => {
    new MutationObserver(() => {
      const modal = document.body.querySelector("[data-hydra-dialog]");

      dispatch(toggleDraggingDisabled(Boolean(modal)));
    }).observe(document.body, {
      attributes: false,
      childList: true,
    });
  }, [dispatch, draggingDisabled]);

  const loadAndApplyTheme = useCallback(async () => {
    const allThemes = (await levelDBService.values("themes")) as {
      isActive?: boolean;
      code?: string;
    }[];
    const activeTheme = allThemes.find((theme) => theme.isActive);
    if (activeTheme?.code) {
      injectCustomCss(activeTheme.code);
    } else {
      removeCustomCss();
    }
  }, []);

  useEffect(() => {
    loadAndApplyTheme();
  }, [loadAndApplyTheme]);

  useEffect(() => {
    const unsubscribe = window.electron.onCustomThemeUpdated(() => {
      loadAndApplyTheme();
    });

    return () => unsubscribe();
  }, [loadAndApplyTheme]);

  const playAudio = useCallback(async () => {
    const soundUrl = await getAchievementSoundUrl();
    const volume = await getAchievementSoundVolume();
    const audio = new Audio(soundUrl);
    audio.volume = volume;
    audio.play();
  }, []);

  useEffect(() => {
    const unsubscribe = window.electron.onAchievementUnlocked(() => {
      playAudio();
    });

    return () => {
      unsubscribe();
    };
  }, [playAudio]);

  const handleToastClose = useCallback(() => {
    dispatch(closeToast());
  }, [dispatch]);

  return (
    <>
      {window.electron.platform === "win32" && (
        <div className="title-bar">
          <h4>
            PlayHoard
            {hasActiveSubscription && (
              <span className="title-bar__cloud-text"> Cloud</span>
            )}
          </h4>
        </div>
      )}

      <Toast
        visible={toast.visible}
        title={toast.title}
        message={toast.message}
        type={toast.type}
        onClose={handleToastClose}
        duration={toast.duration}
      />

      <HydraCloudModal
        visible={isHydraCloudModalVisible}
        onClose={hideHydraCloudModal}
        feature={hydraCloudFeature}
      />

      <ArchiveDeletionModal
        visible={showArchiveDeletionModal}
        archivePaths={archivePaths}
        onClose={() => setShowArchiveDeletionModal(false)}
      />

      <main>
        <div
          className={`app-navigation ${
            window.electron.platform === "darwin" ? "app-navigation--darwin" : ""
          } ${
            window.electron.platform === "win32" ? "app-navigation--windows" : ""
          }`}
        >
          <Sidebar />
          <Header />
        </div>

        <article className="container">
          <section
            ref={contentRef}
            id="scrollableDiv"
            className="container__content"
          >
            <Outlet />
          </section>
        </article>
      </main>

      <BottomPanel />
    </>
  );
}
