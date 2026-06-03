import React from "react";
import ReactDOM from "react-dom/client";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { Provider } from "react-redux";
import LanguageDetector from "i18next-browser-languagedetector";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";

import "react-loading-skeleton/dist/skeleton.css";
import "react-tooltip/dist/react-tooltip.css";

import { App } from "./app";
import appIconUrl from "./assets/icon.png";

import { store } from "./store";

import resources from "@locales";

import { logger } from "./logger";
import { addCookieInterceptor } from "./cookies";
import * as Sentry from "@sentry/react";
import { levelDBService } from "./services/leveldb.service";
import Catalogue from "./pages/catalogue/catalogue";
import Downloads from "./pages/downloads/downloads";
import GameDetails from "./pages/game-details/game-details";
import Settings from "./pages/settings/settings";
import Achievements from "./pages/achievements/achievements";
import ThemeEditor from "./pages/theme-editor/theme-editor";
import Library from "./pages/library/library";
import Notifications from "./pages/notifications/notifications";
import { AchievementNotification } from "./pages/achievements/notification/achievement-notification";
import GameLauncher from "./pages/game-launcher/game-launcher";
import { useAppSelector } from "./hooks";

console.log = logger.log;
const PLAYHOARD_ICON_VERSION = "phicon-20260531";
const playhoardIconUrl = `${appIconUrl}${appIconUrl.includes("?") ? "&" : "?"}v=${PLAYHOARD_ICON_VERSION}`;

function setFavicon(href: string) {
  const existing = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  const link = existing ?? document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.href = href;
  if (!existing) document.head.appendChild(link);
}

setFavicon(playhoardIconUrl);

function DefaultRoute() {
  const userPreferences = useAppSelector((state) => state.userPreferences.value);
  return (
    <Navigate
      to={userPreferences?.launchToLibraryPage ? "/library" : "/catalogue"}
      replace
    />
  );
}

Sentry.init({
  dsn: import.meta.env.RENDERER_VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.5,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  release: "playhoard@" + (await globalThis.electron.getVersion()),
});

const isStaging = await globalThis.electron.isStaging();
addCookieInterceptor(isStaging);

const syncDocumentLanguage = (language: string) => {
  document.documentElement.lang = language;
  document.documentElement.dir = i18n.dir(language);
};

await i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });

const userPreferences = (await levelDBService.get(
  "userPreferences",
  null,
  "json"
)) as { language?: string } | null;

if (userPreferences?.language) {
  await i18n.changeLanguage(userPreferences.language);
} else {
  globalThis.electron.updateUserPreferences({ language: i18n.language });
}

syncDocumentLanguage(i18n.language);
i18n.on("languageChanged", syncDocumentLanguage);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <HashRouter>
        <Routes>
          <Route element={<App />}>
            <Route path="/" element={<DefaultRoute />} />
            <Route path="/catalogue" element={<Catalogue />} />
            <Route path="/library" element={<Library />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/game/:shop/:objectId" element={<GameDetails />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile/:userId" element={<Navigate to="/settings?tab=account_privacy" replace />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>

          <Route path="/theme-editor" element={<ThemeEditor />} />
          <Route
            path="/achievement-notification"
            element={<AchievementNotification />}
          />
          <Route path="/game-launcher" element={<GameLauncher />} />
        </Routes>
      </HashRouter>
    </Provider>
  </React.StrictMode>
);
