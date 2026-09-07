import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { levelDBService } from "@renderer/services/leveldb.service";
import type { DownloadSource } from "@types";
import { useAppDispatch } from "./redux";
import { setGenres, setTags } from "@renderer/features";

const SUPPORTED_STEAM_METADATA_LANGUAGES = new Set(["en", "es", "pt", "ru", "fr"]);

async function getLocalizedSteamMetadata<T>(endpoint: string, locale: string) {
  const language = locale?.split("-")[0] || "en";
  const requestLanguage = SUPPORTED_STEAM_METADATA_LANGUAGES.has(language)
    ? language
    : "en";
  const languages = requestLanguage === "en" ? ["en"] : ["en", requestLanguage];

  const entries = await Promise.all(
    languages.map(async (currentLanguage) => {
      const data = await window.electron.hydraApi.get<T>(endpoint, {
        params: { language: currentLanguage },
        needsAuth: false,
      });
      return [currentLanguage, data] as const;
    })
  );

  const metadata = Object.fromEntries(entries) as Record<string, T>;
  metadata[language] ??= metadata[requestLanguage];
  return metadata;
}

export function useCatalogue() {
  const dispatch = useAppDispatch();
  const { i18n } = useTranslation();

  const [steamPublishers, setSteamPublishers] = useState<string[]>([]);
  const [steamDevelopers, setSteamDevelopers] = useState<string[]>([]);
  const [downloadSources, setDownloadSources] = useState<DownloadSource[]>([]);

  const getSteamFilters = useCallback(async () => {
    try {
      const [tags, genres] = await Promise.all([
        getLocalizedSteamMetadata<Record<string, number>>(
          "/catalogue/steam/tags",
          i18n.language
        ),
        getLocalizedSteamMetadata<string[]>(
          "/catalogue/steam/genres",
          i18n.language
        ),
      ]);

      // Shape validation on the renderer side too: a bad payload must never
      // poison the reducer (the catalogue page assumes these shapes).
      if (
        tags &&
        typeof tags === "object" &&
        !Array.isArray(tags) &&
        Object.values(tags).every(
          (value) => value && typeof value === "object" && !Array.isArray(value)
        )
      ) {
        dispatch(setTags(tags));
      }

      if (
        genres &&
        typeof genres === "object" &&
        !Array.isArray(genres) &&
        Object.values(genres).every(
          (value) =>
            Array.isArray(value) &&
            value.every((genre) => typeof genre === "string")
        )
      ) {
        dispatch(setGenres(genres));
      }
    } catch {
      // Offline or API unavailable — the catalogue stays usable with empty
      // filter lists.
    }
  }, [dispatch, i18n.language]);

  const getSteamPublishers = useCallback(() => {
    window.electron.hydraApi
      .get<unknown[]>("/catalogue/steam/publishers", { needsAuth: false })
      .then((data) => {
        if (Array.isArray(data)) {
          setSteamPublishers(data.filter((item) => typeof item === "string"));
        }
      })
      .catch(() => undefined);
  }, []);

  const getSteamDevelopers = useCallback(() => {
    window.electron.hydraApi
      .get<unknown[]>("/catalogue/steam/developers", { needsAuth: false })
      .then((data) => {
        if (Array.isArray(data)) {
          setSteamDevelopers(data.filter((item) => typeof item === "string"));
        }
      })
      .catch(() => undefined);
  }, []);

  const getDownloadSources = useCallback(() => {
    levelDBService
      .values("downloadSources")
      .then((results) => {
        if (!Array.isArray(results)) return;
        const sources = results as DownloadSource[];
        setDownloadSources(sources.filter((source) => !!source.fingerprint));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    getSteamFilters();
    getSteamPublishers();
    getSteamDevelopers();
    getDownloadSources();
  }, [getSteamFilters, getSteamPublishers, getSteamDevelopers, getDownloadSources]);

  return { steamPublishers, downloadSources, steamDevelopers };
}
