import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const storageDir = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "MediaHoard-EX")
    : path.join(os.homedir(), ".mediahoard-ex");
const storageFile = path.join(storageDir, "app-storage.json");

type StorageMap = Record<string, string>;
type ContentHoardSharedState = {
    activeProfileId?: string;
    profiles?: Array<{
        id?: string;
        name?: string;
        icon?: string;
        color?: string;
        createdAt?: number;
    }>;
    theme?: {
        backgroundColor?: string;
        surfaceColor?: string;
        elevatedColor?: string;
        accentColor?: string;
        textColor?: string;
        secondaryTextColor?: string;
        navBackgroundColor?: string;
        glassBlur?: number;
        glassOpacity?: number;
        isGlassy?: boolean;
        isTransparent?: boolean;
        headerFont?: string;
        headerText?: string;
        logoUrl?: string;
        mediahoardHeaderText?: string;
        mediahoardLogoUrl?: string;
    };
};

const parseContentHoardJson = <T,>(value: string | undefined): T | null => {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
};

const getContentHoardSeed = (): StorageMap => {
    if (process.env.CONTENTHOARD !== "1") return {};

    const profile = parseContentHoardJson<{
        id?: string;
        name?: string;
        icon?: string;
        color?: string;
        createdAt?: number;
    }>(process.env.CONTENTHOARD_PROFILE);
    const theme = parseContentHoardJson<{
        backgroundColor?: string;
        surfaceColor?: string;
        elevatedColor?: string;
        accentColor?: string;
        textColor?: string;
        secondaryTextColor?: string;
        navBackgroundColor?: string;
        glassBlur?: number;
        glassOpacity?: number;
        isGlassy?: boolean;
        isTransparent?: boolean;
        headerFont?: string;
    }>(process.env.CONTENTHOARD_THEME);

    let fileSharedState: ContentHoardSharedState | null = null;
    if (process.env.CONTENTHOARD_SHARED_STATE_PATH) {
        try {
            fileSharedState = JSON.parse(fsSync.readFileSync(process.env.CONTENTHOARD_SHARED_STATE_PATH, "utf8"));
        } catch {}
    }

    const sharedProfiles = fileSharedState?.profiles || [];
    const activeSharedProfile = sharedProfiles.find(p => p.id === fileSharedState?.activeProfileId) || sharedProfiles[0];
    const sourceProfile = activeSharedProfile || profile;
    const sourceTheme = fileSharedState?.theme || theme;

    if (!sourceProfile) return {};

    const mediaProfile = {
        id: String(sourceProfile.id || "contenthoard"),
        name: String(sourceProfile.name || "ContentHoard"),
        icon: String(sourceProfile.icon || "person"),
        color: String(sourceProfile.color || "#39E079"),
        createdAt: Number(sourceProfile.createdAt || Date.now()),
    };
    const seed: StorageMap = {
        mediahoard_profiles_list: JSON.stringify(sharedProfiles.length ? sharedProfiles : [mediaProfile]),
        mediahoard_active_profile_id: mediaProfile.id,
    };

    if (sourceTheme) {
        seed[`p_${mediaProfile.id}_mediahoard-theme`] = JSON.stringify({
            backgroundColor: sourceTheme.backgroundColor || "#000000",
            accentColor: sourceTheme.accentColor || "#FFFFFF",
            textColor: sourceTheme.textColor || "#ffffff",
            cardGlowColor: "rgba(255, 255, 255, 0.15)",
            navBackgroundColor: sourceTheme.navBackgroundColor || "rgba(255, 255, 255, 0.1)",
            navTextColorUnselected: sourceTheme.secondaryTextColor || "rgba(255, 255, 255, 0.6)",
            navTextColorSelected: "#000000",
            headerBackgroundColor: sourceTheme.surfaceColor || "#1a1a1a",
            dropdownBackgroundColor: sourceTheme.elevatedColor || "rgba(26, 26, 26, 0.9)",
            dropdownTextColor: sourceTheme.textColor || "#ffffff",
            menuBackgroundColor: sourceTheme.elevatedColor || "rgba(26, 26, 26, 0.95)",
            menuTextColor: sourceTheme.textColor || "#ffffff",
            streamsBackgroundColor: sourceTheme.surfaceColor || "rgba(26, 26, 26, 0.6)",
            streamsTextColor: sourceTheme.textColor || "#ffffff",
            isGlassy: sourceTheme.isGlassy ?? true,
            isTransparent: sourceTheme.isTransparent ?? true,
            glassBlur: sourceTheme.glassBlur ?? 24,
            glassOpacity: sourceTheme.glassOpacity ?? 0.1,
            isGlowEnabled: true,
            glowIntensity: 1,
            isSoundEnabled: true,
            globalVolume: 0.5,
            metadataLanguage: "English",
            preferredQuality: "1080p",
            logoUrl: sourceTheme.mediahoardLogoUrl || sourceTheme.logoUrl || "/mediahoard.png",
            headerText: sourceTheme.mediahoardHeaderText || sourceTheme.headerText || "MediaHoard",
            headerFont: sourceTheme.headerFont || "var(--font-spline-sans)",
            headerTextColor: sourceTheme.textColor || "#ffffff",
            navFont: sourceTheme.headerFont || "var(--font-spline-sans)",
            titleFont: sourceTheme.headerFont || "var(--font-spline-sans)",
            titleTextColor: sourceTheme.textColor || "#ffffff",
            dropdownFont: sourceTheme.headerFont || "var(--font-spline-sans)",
            menuFont: sourceTheme.headerFont || "var(--font-spline-sans)",
            streamsFont: sourceTheme.headerFont || "var(--font-spline-sans)",
        });
    }

    return seed;
};

const ensureStorageDir = async () => {
    await fs.mkdir(storageDir, { recursive: true });
};

const readStorage = async (): Promise<StorageMap> => {
    await ensureStorageDir();

    try {
        const raw = await fs.readFile(storageFile, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        return typeof parsed === "object" && parsed !== null ? parsed as StorageMap : {};
    } catch {
        // On first launch (file doesn't exist), seed with ContentHoard's profile/theme.
        return getContentHoardSeed();
    }
};

const writeStorage = async (data: StorageMap) => {
    await ensureStorageDir();
    await fs.writeFile(storageFile, JSON.stringify(data, null, 2), "utf8");
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
        return Response.json({ error: "Missing storage key" }, { status: 400 });
    }

    const storage = await readStorage();
    return Response.json({ value: storage[key] ?? null });
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => null) as {
        key?: string;
        value?: string;
    } | null;

    if (!body?.key || typeof body.value !== "string") {
        return Response.json({ error: "Missing storage payload" }, { status: 400 });
    }

    const storage = await readStorage();
    storage[body.key] = body.value;
    await writeStorage(storage);

    return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
        return Response.json({ error: "Missing storage key" }, { status: 400 });
    }

    const storage = await readStorage();
    delete storage[key];
    await writeStorage(storage);

    return Response.json({ ok: true });
}
