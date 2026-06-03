import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const storageDir = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "MediaHoard-EX")
    : path.join(os.homedir(), ".mediahoard-ex");
const storageFile = path.join(storageDir, "app-storage.json");

type StorageMap = Record<string, string>;

type TmdbSettings = {
    apiKey?: string;
};

type TmdbLogoImage = {
    file_path?: string;
    iso_639_1?: string | null;
    vote_average?: number;
    width?: number;
};

type TmdbFindResponse = {
    movie_results?: Array<{ id: number }>;
    tv_results?: Array<{ id: number }>;
};

type TmdbSearchResponse = {
    results?: Array<{ id: number }>;
};

type TmdbImageResponse = {
    logos?: TmdbLogoImage[];
};

const tmdbImageBaseUrl = "https://image.tmdb.org/t/p/original";

const readStorage = async (): Promise<StorageMap> => {
    try {
        const raw = await fs.readFile(storageFile, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        return typeof parsed === "object" && parsed !== null ? parsed as StorageMap : {};
    } catch {
        return {};
    }
};

const loadTmdbApiKey = async () => {
    const storage = await readStorage();
    const activeProfileId = storage.mediahoard_active_profile_id;
    const storageKey = activeProfileId
        ? `p_${activeProfileId}_mediahoard_tmdb_settings`
        : "mediahoard_tmdb_settings";
    const raw = storage[storageKey];

    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as TmdbSettings;
        return parsed.apiKey?.trim() || null;
    } catch {
        return null;
    }
};

const parseTmdbId = (value: string | null) => {
    if (!value) return null;
    const match = value.match(/(?:tmdb[:.])(\d+)/i);
    return match ? Number(match[1]) : null;
};

const fetchTmdbJson = async <T>(apiKey: string, url: URL): Promise<T | null> => {
    url.searchParams.set("api_key", apiKey);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
        return null;
    }

    return response.json() as Promise<T>;
};

const pickBestLogo = (logos: TmdbLogoImage[] | undefined) => {
    if (!logos?.length) {
        return null;
    }

    return [...logos]
        .filter((logo) => Boolean(logo.file_path))
        .sort((left, right) => {
            const languageScore = (logo: TmdbLogoImage) =>
                logo.iso_639_1 === "en" ? 3 : logo.iso_639_1 === null ? 2 : 1;
            const voteScore = (logo: TmdbLogoImage) => logo.vote_average || 0;
            const widthScore = (logo: TmdbLogoImage) => logo.width || 0;

            return (
                languageScore(right) - languageScore(left)
                || voteScore(right) - voteScore(left)
                || widthScore(right) - widthScore(left)
            );
        })[0]?.file_path || null;
};

const resolveTmdbEntityId = async (
    apiKey: string,
    type: string,
    id: string | null,
    imdbId: string | null,
    title: string | null,
    year: string | null,
) => {
    const directId = parseTmdbId(id);
    if (directId) {
        return directId;
    }

    const normalizedImdbId = imdbId?.trim() || (id?.startsWith("tt") ? id : null);
    if (normalizedImdbId) {
        const findUrl = new URL(`https://api.themoviedb.org/3/find/${encodeURIComponent(normalizedImdbId)}`);
        findUrl.searchParams.set("external_source", "imdb_id");
        const findResult = await fetchTmdbJson<TmdbFindResponse>(apiKey, findUrl);
        const matched = type === "series"
            ? findResult?.tv_results?.[0]?.id
            : findResult?.movie_results?.[0]?.id;

        if (matched) {
            return matched;
        }
    }

    if (!title) {
        return null;
    }

    const searchPath = type === "series" ? "tv" : "movie";
    const searchUrl = new URL(`https://api.themoviedb.org/3/search/${searchPath}`);
    searchUrl.searchParams.set("query", title);
    if (year) {
        searchUrl.searchParams.set(type === "series" ? "first_air_date_year" : "year", year);
    }

    const searchResult = await fetchTmdbJson<TmdbSearchResponse>(apiKey, searchUrl);
    return searchResult?.results?.[0]?.id || null;
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "movie";
    const id = searchParams.get("id");
    const imdbId = searchParams.get("imdbId");
    const title = searchParams.get("title");
    const year = searchParams.get("year");

    const apiKey = await loadTmdbApiKey();
    if (!apiKey) {
        return Response.json({ logoUrl: null, reason: "tmdb-not-configured" });
    }

    const entityId = await resolveTmdbEntityId(apiKey, type, id, imdbId, title, year);
    if (!entityId) {
        return Response.json({ logoUrl: null, reason: "tmdb-id-not-found" });
    }

    const imagePath = type === "series"
        ? `https://api.themoviedb.org/3/tv/${entityId}/images`
        : `https://api.themoviedb.org/3/movie/${entityId}/images`;
    const imageUrl = new URL(imagePath);
    imageUrl.searchParams.set("include_image_language", "en,null");

    const imageResult = await fetchTmdbJson<TmdbImageResponse>(apiKey, imageUrl);
    const bestLogo = pickBestLogo(imageResult?.logos);

    return Response.json({
        logoUrl: bestLogo ? `${tmdbImageBaseUrl}${bestLogo}` : null,
    });
}
