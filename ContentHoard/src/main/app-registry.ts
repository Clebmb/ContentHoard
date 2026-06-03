import path from "node:path";

export type HoardApp = {
  id: string;
  name: string;
  shortName: string;
  domain: string;
  description: string;
  accent: string;
  icon: string;
  path: string;
  windowCommand: string;
  windowArgs: string[];
};

const workspaceRoot = path.resolve(__dirname, "..", "..", "..");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const corepackCommand = process.platform === "win32" ? "corepack.cmd" : "corepack";

export const hoardApps: HoardApp[] = [
  {
    id: "mediahoard",
    name: "MediaHoard",
    shortName: "Media",
    domain: "Movies and TV",
    description: "Browse, organize, and play video libraries from the unified shell.",
    accent: "#39E079",
    icon: "play_circle",
    path: path.join(workspaceRoot, "MediaHoard"),
    windowCommand: npmCommand,
    windowArgs: ["run", "desktop:dev"]
  },
  {
    id: "audiohoard",
    name: "AudioHoard",
    shortName: "Audio",
    domain: "Music",
    description: "Stream, queue, and manage music without leaving ContentHoard.",
    accent: "#4CC9F0",
    icon: "music_cast",
    path: path.join(workspaceRoot, "AudioHoard"),
    windowCommand: npmCommand,
    windowArgs: ["run", "dev"]
  },
  {
    id: "playhoard",
    name: "PlayHoard",
    shortName: "Play",
    domain: "Games",
    description: "Launch, manage, and track games from the shared Hoard profile.",
    accent: "#F7B267",
    icon: "gamepad",
    path: path.join(workspaceRoot, "PlayHoard"),
    windowCommand: corepackCommand,
    windowArgs: ["yarn", "dev"]
  }
];

export const getAppDefinition = (appId: string) => hoardApps.find((app) => app.id === appId);
