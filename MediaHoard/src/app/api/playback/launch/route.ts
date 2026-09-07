import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
    defaultPlaybackPreferences,
    normalizePlaybackPreferences,
    playbackPreferencesStorageKey,
    type PlaybackMode,
    type PlaybackPreferences,
} from "@/lib/playback-preferences-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const storageDir = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "MediaHoard-EX")
    : path.join(os.homedir(), ".mediahoard-ex");
const storageFile = path.join(storageDir, "app-storage.json");

const windowsGoblinCandidates = [
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Goblin Player", "Goblin Player.exe"),
    path.join(process.env.PROGRAMFILES || "", "Goblin Player", "Goblin Player.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Goblin Player", "Goblin Player.exe"),
];

const unixGoblinCandidates = [
    path.join(os.homedir(), "Applications", "Goblin Player.app"),
    "/Applications/Goblin Player.app",
    "/usr/local/bin/goblin-player",
    "/usr/bin/goblin-player",
];

const readStorage = async (): Promise<Record<string, string>> => {
    try {
        const raw = await fs.readFile(storageFile, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        return typeof parsed === "object" && parsed !== null ? parsed as Record<string, string> : {};
    } catch {
        return {};
    }
};

const loadPlaybackPreferences = async (): Promise<PlaybackPreferences> => {
    const storage = await readStorage();
    const raw = storage[playbackPreferencesStorageKey];

    if (!raw) {
        return defaultPlaybackPreferences();
    }

    try {
        return normalizePlaybackPreferences(JSON.parse(raw) as Partial<PlaybackPreferences>);
    } catch {
        return defaultPlaybackPreferences();
    }
};

const fileExists = async (targetPath: string | null | undefined) => {
    if (!targetPath) return false;

    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
};

const resolveGoblinPlayerPath = async (manualPath: string | null) => {
    if (manualPath && await fileExists(manualPath)) {
        return manualPath;
    }

    const candidates = process.platform === "win32"
        ? windowsGoblinCandidates
        : unixGoblinCandidates;

    for (const candidate of candidates) {
        if (!candidate) continue;
        if (await fileExists(candidate)) {
            return candidate;
        }
    }

    return null;
};

const launchExecutable = async (executablePath: string, playbackUrl: string) => new Promise<void>((resolve, reject) => {
    const child = spawn(executablePath, [playbackUrl], {
        detached: true,
        stdio: "ignore",
    });

    child.once("error", reject);
    child.once("spawn", () => {
        child.unref();
        resolve();
    });
});

export async function POST(request: Request) {
    const body = await request.json().catch(() => null) as {
        mode?: PlaybackMode;
        playbackUrl?: string;
    } | null;

    if (!body?.mode || !body.playbackUrl) {
        return Response.json({ error: "Missing launch payload" }, { status: 400 });
    }

    const preferences = await loadPlaybackPreferences();
    const executablePath = body.mode === "goblin"
        ? await resolveGoblinPlayerPath(preferences.web.goblinExecutablePath)
        : preferences.web.externalPlayerPath;

    if (!executablePath) {
        return Response.json({ error: "No executable configured for this playback mode." }, { status: 400 });
    }

    if (!await fileExists(executablePath)) {
        return Response.json({ error: "Configured player executable could not be found." }, { status: 400 });
    }

    try {
        await launchExecutable(executablePath, body.playbackUrl);
        return Response.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to launch external player.";
        return Response.json({ error: message }, { status: 500 });
    }
}
