# ContentHoard 🎮🎵🎬

<img width="224" height="224" alt="chicon" src="https://github.com/user-attachments/assets/68c9ecfb-8147-4927-a426-698891981efd" />



> **Unified dashboard & launcher** for a suite of self-hosted media applications. Launch, theme, and manage profiles across MediaHoard, AudioHoard, PlayHoard, and future Hoard apps — all from a single hub.

---

## 📦 Apps

| App | Directory | Description | Stack |
|---|---|---|---|
| **ContentHoard** | `./ContentHoard` | Central dashboard, app launcher, theme editor, profile manager | Electron + React 18 + Vite |
| **MediaHoard** | `./MediaHoard` | Movie & TV streaming with Stremio addons | Next.js 16 + React 19 + mpv |
| **AudioHoard** | `./AudioHoard` | Spotify-like music player (YouTube Music streaming) | Electron + Vanilla JS + Capacitor (Android) |
| **PlayHoard** | `./PlayHoard` | Game launcher & download manager | Electron + React 18 + Redux + Rust native |Game launcher & download manager | Electron + React 18 + Redux + Rust native + |

**PlayHoard** is a fork of https://github.com/hydralauncher/hydra

**AudioHoard** is a fork of https://github.com/nyakuoff/Snowify

---

## 🏗 Architecture

```
ContentHoard  ─── shared-state.json ───┐
    │                                    │
    ├── launches ──► MediaHoard          │
    ├── launches ──► AudioHoard          ├── All apps read/write
    └── launches ──► PlayHoard           │    shared state
                                         │
    .contenthoard/                       │
    ├── shared-state.json ◄──────────────┘
    ├── running-pids.json
    └── [electron-store data]
```

### How Cross-App Sync Works

1. **ContentHoard** writes a `shared-state.json` to `~/.contenthoard/` containing profiles, active theme, and saved themes.
2. When ContentHoard launches a sibling app, it injects environment variables (`CONTENTHOARD`, `CONTENTHOARD_PROFILE`, `CONTENTHOARD_THEME`, etc.) so the child starts with the same profile and theme.
3. Each child app runs a **file watcher** (2-second polling) that detects changes to `shared-state.json` and applies theme/profile updates in real-time.
4. **Profiles** are seeded from ContentHoard at launch time only. Once launched, each child app manages profiles independently.
5. **Themes & saved themes** sync bidirectionally in real-time across all apps.
6. **Profile deletion** in ContentHoard propagates to child apps (tracked via ContentHoard-originated profile IDs).

---

## 🚀 Getting Started

### Prerequisites

- **[Node.js](https://nodejs.org/)** >= 18 (for MediaHoard: >= 20)
- **[Yarn](https://yarnpkg.com/)** 1.x (required for PlayHoard)
- **npm** (comes with Node.js; used by ContentHoard, AudioHoard, MediaHoard)

### 1. ContentHoard (Dashboard)

```bash
cd ContentHoard
npm install
npm run dev
```

### 2. AudioHoard (Music Player)

```bash
cd AudioHoard
npm install
npm run dev
```

### 3. MediaHoard (Movies & TV)

```bash
cd MediaHoard
npm install
# Desktop mode (with mpv player):
npm run desktop:dev
# Web-only mode:
npm run dev
```

### 4. PlayHoard (Game Launcher)

```bash
cd PlayHoard
yarn install
yarn run postinstall
yarn dev
```

---

## 🧩 Large Dependencies per App

These are **not** included in the repository but are required at runtime. They are either downloaded via package managers or bundled during build/packaging.

### ContentHoard

| Dependency | Type | Size | Notes |
|---|---|---|---|
| `node_modules/` | npm packages | ~713 MB | Installed via `npm install` |
| `out/`, `build/`, `release/` | Build outputs | ~2 MB | Produced by `npm run build` / `npm run dist` |

### AudioHoard

| Dependency | Type | Size | Notes |
|---|---|---|---|
| `node_modules/` | npm packages | ~732 MB | Installed via `npm install` |
| `bin/` | yt-dlp binary | ~35 MB | Bundled per-platform binary for YouTube streaming |
| `dist/` | Electron build | ~575 MB | Produced by `npm run build` (includes Electron runtime) |
| `android/` | Android SDK artifacts | ~688 KB (config) | Full Android SDK setup required for APK builds (several GB) |
| `flatpak/` | Flatpak build cache | ~592 KB (config) | Full Flatpak SDK required for Flatpak builds |
| `plugins/` | Runtime plugins | ~104 KB | Downloaded from plugin marketplace at runtime |

### MediaHoard

| Dependency | Type | Size | Notes |
|---|---|---|---|
| `node_modules/` | npm packages | ~1.8 GB | Installed via `npm install` |
| `.next/` | Next.js build cache | ~199 MB | Produced by `next build` or `npm run dev` |
| `electron/resources/mpv/` | mpv media player | ~3.6 MB | Bundled per-platform mpv binary for native playback |
| `electron/resources/runtime/` | Node.js runtime | ~28 KB | Bundled Node.js for packaged desktop app |
| `electron/resources/server/` | Next.js server | ~470 MB | Standalone Next.js server for packaged desktop app |
| `release/` | Electron builds | ~1.5 GB | Produced by `npm run desktop:build` |

### PlayHoard

| Dependency | Type | Size | Notes |
|---|---|---|---|
| `node_modules/` | npm packages | ~1.4 GB | Installed via `yarn install` |
| `native/` | Rust native addon | ~164 MB | Built by `npm run build:native` / `yarn postinstall` |
| `dist/` | Vite/Electron build | ~769 MB | Produced by `yarn build` / `yarn dev` |
| `out/` | electron-vite output | ~25 MB | Produced by `yarn dev` |
| `binaries/` | UMU runner, 7zz | ~13 MB | Bundled per-platform tools for game launching |
| `ludusavi/` | Save game backup tool | ~29 MB | Bundled Ludusavi binary (config only in repo) |
| `python_rpc/` | Python torrent engine | ~52 KB (code) | Requires Python 3 + libtorrent runtime (~100+ MB) |
| `build/`, `release/` | Electron builds | ~2.4 MB + varies | Produced by `yarn build:linux` / `yarn build:win` |

---

## ✨ Feature Highlights

### ContentHoard

<img width="1110" height="878" alt="ch" src="https://github.com/user-attachments/assets/652da254-bea6-4e2f-8a3c-ea0d68b016d4" />

- **App Launcher** — Launch MediaHoard, AudioHoard, PlayHoard from a unified dashboard
- **Full Theme Editor** — 4-tab visual editor: Colors, Typography, Effects, Branding
- **Per-App Branding** — Custom logos, header text, fonts/colors for each sibling app
- **Profile Management** — Create/edit/delete profiles with custom icons, colors, names
- **Cross-App State Sync** — Shared JSON state file + real-time watchers

### MediaHoard

<img width="1420" height="921" alt="mh" src="https://github.com/user-attachments/assets/5ad758a1-080c-4c1d-ae2a-98b0105e5581" />

- **Stremio Addon Support** — Install addons via manifest URL for catalogs, metadata, streams
- **Native mpv Player** — Full-screen transparent "Goblin Player" with hardware acceleration
- **Personal Media Library** — Import local video files with thumbnail extraction
- **Multi-Profile System** — Isolated storage per profile for themes, addons, library
- **TMDB Metadata** — Automatic metadata enrichment for local media

### AudioHoard

<img width="1492" height="786" alt="ah" src="https://github.com/user-attachments/assets/046049a4-e29f-4623-892a-318434d620d8" />

- **YouTube Music Streaming** — Search and stream songs, albums, playlists, artists
- **Dual-<audio> Engine** — Gapless playback with configurable crossfade (0-12s)
- **LUFS Loudness Normalization** — AudioWorklet-based (ITU-R BS.1770 / EBU R128)
- **Plugin System** — Marketplace-fed plugins for song sources and metadata
- **AudioHoard Wrapped** — Yearly listening stats with animated full-screen slideshow
- **Mobile (Android)** — Capacitor-based Android app with ExoPlayer
- **Synced Lyrics** — Karaoke-style with real-time sync
- **12 Languages** — Built-in internationalization

### PlayHoard

<img width="1351" height="1018" alt="ph" src="https://github.com/user-attachments/assets/2284af0e-1c57-4565-b612-215ec0950c96" />

- **Game Download Engine** — Multi-source: Torrent, Debrid services, File hosters, CDN
- **Game Library Management** — Browse, search, collections, favorites
- **Linux Gaming** — Proton, Wine, MangoHud, GameMode, UMU support
- **Cloud Saves** — Hydra Cloud for upload/download game saves
- **Achievements** — Unlock tracking, notifications, sound effects, leaderboards
- **Custom CSS Themes** — Live Monaco editor, theme store (hydrathemes.shop)
- **30+ Languages** — Comprehensive internationalization

---

## 📁 Repository Structure

```
ContentHoard/
├── .gitignore                  # Root gitignore
├── ContentHoard/               # Dashboard & launcher (Electron + React)
│   ├── src/main/               #   Main process (app, IPC, process manager, state)
│   ├── src/preload/            #   Context bridge
│   └── src/renderer/           #   React UI (theme editor, profile manager, launcher)
├── AudioHoard/                 # Music player (Electron + Vanilla JS)
│   ├── src/main/               #   Main process modules
│   └── src/renderer/           #   SPA with 23 feature modules
├── MediaHoard/                 # Movie/TV player (Next.js + Electron)
│   ├── electron/               #   Electron main process + mpv controller
│   ├── src/                    #   Next.js App Router pages & components
│   └── player/                 #   Shared Goblin Player module
├── PlayHoard/                  # Game launcher (Electron + React + Redux)
│   ├── src/main/               #   Main process with 30+ services
│   ├── src/renderer/           #   React app with 12+ pages
│   ├── hydra-native/           #   Rust native addon
│   └── python_rpc/             #   Python torrent engine
└── Features/                   # Per-app feature documentation
    ├── CH.md, MH.md, AH.md, PH.md
```

---

## 🛠 Development

### Running All Apps Together

1. Start **ContentHoard** — it launches sibling apps via the dashboard UI
2. Or run each app independently in its own terminal:

```bash
# Terminal 1: ContentHoard
cd ContentHoard && npm run dev

# Terminal 2: AudioHoard
cd AudioHoard && npm run dev

# Terminal 3: MediaHoard
cd MediaHoard && npm run desktop:dev

# Terminal 4: PlayHoard
cd PlayHoard && yarn dev
```

### Type Checking

```bash
# ContentHoard
cd ContentHoard && npx tsc --noEmit

# MediaHoard
cd MediaHoard && npx tsc --noEmit

# PlayHoard
cd PlayHoard && yarn typecheck
```

### Building for Distribution

```bash
# ContentHoard
cd ContentHoard && npm run dist

# AudioHoard
cd AudioHoard && npm run build

# MediaHoard
cd MediaHoard && npm run desktop:build

# PlayHoard
cd PlayHoard && yarn build:linux   # or build:win / build:mac
```

---

## 📄 License

Each sub-project is licensed under its own terms. See the respective `LICENSE` files:
- `ContentHoard/LICENSE`
- `AudioHoard/LICENSE`
- `MediaHoard/LICENSE`
- `PlayHoard/LICENSE`
