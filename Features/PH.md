# PlayHoard

Forked from https://github.com/vanhauser-thc/thc-hydra
---
## Tech Stack

| Category | Technology |
|---|---|
| **Desktop Framework** | Electron 39 + electron-vite 4 + Vite 6 |
| **Frontend** | React 18, TypeScript 5, SCSS |
| **State Management** | Redux Toolkit + Zustand |
| **Routing** | React Router DOM 6 (HashRouter) |
| **Persistence** | LevelDB (classic-level) |
| **Icons** | Phosphor Icons, Primer Octicons, Lucide React |
| **UI Primitives** | Radix UI (dropdown-menu, slot) |
| **Forms** | React Hook Form + Yup |
| **Drag & Drop** | React DnD + Atlassian Pragmatic DnD |
| **Animations** | Framer Motion 12 |
| **Code Editor** | Monaco Editor (theme editing) |
| **Charts** | Recharts |
| **i18n** | i18next + react-i18next, 30+ languages |
| **Error Tracking** | Sentry (browser tracing + replay) |
| **Native Addon** | Rust (hydra-native) |
| **Packaging** | electron-builder (NSIS, DMG, AppImage, snap, deb, rpm) |

## Main Features

### Game Library Management
- Add games from Steam store browsing or custom executables
- Browse, search, filter, manage game library
- Organize into collections, favorites, pinned games

### Game Catalogue & Discovery
- Rich catalogue with filtering by genre, tags, publishers, developers
- ProtonDB compatibility badges, Steam Deck filtering
- Sort by popularity, review score, release date, Hydra score
- Random game discovery

### Game Downloading
- **Multi-source download engine:**
  - Torrent (via Python RPC + libtorrent)
  - Debrid services: Real-Debrid, Premiumize, AllDebrid, TorBox
  - File hosters: Gofile, PixelDrain, Mediafire, Datanodes, Buzzheavier, FuckingFast, VikingFile, Rootz
  - Hydra's own Nimbus CDN
- Download queue with reorder, pause, resume, cancel
- Automatic extraction after download (7z/rar/zip via bundled 7z)
- Seeding management for torrents

### Game Launching & Execution
- Launch games directly from launcher
- **Proton support:** GE-Proton, Steam Proton versions
- **Wine prefix management**
- **MangoHud** and **GameMode** integration (Linux)
- **UMU** (Unified Linux Wine/Proton Launcher)
- Steam shortcut creation

### Cloud Save (Hydra Cloud)
- Upload/download game saves to cloud
- Automatic sync toggle per game
- Backup versioning with artifact labels
- Subscription-based service

### Achievements
- Achievement unlocking, tracking, and comparison with friends
- Notification system with customizable position
- Points system, rare/platinum achievements
- Sound effects on unlock

### Profiles & Social
- User profiles with display name, avatar, bio, background
- Friend system (requests, accept/refuse)
- Presence sharing (show current game)
- Profile visibility settings (public/private/friends)
- User stats (playtime, library count, achievements)

### Settings
- **General:** Language, downloads path, system start
- **Account & Privacy:** Profile management, sign in/out
- **Downloads:** Speed limits, queue, extraction preferences
- **Debrid Services:** Multi-service authentication
- **Download Sources:** Repack source URLs, auto-sync
- **Appearance:** Custom CSS themes with Monaco editor, theme store
- **Behavior:** Launch options, minimize to tray
- **Notifications:** Local notification preferences
- **Integrations:** Discord presence, Steam shortcuts
- **Compatibility:** Proton/Wine version management

### Theme System
- Full custom CSS theming stored in LevelDB
- Theme editor with live Monaco editor
- Theme import/export, web store (hydrathemes.shop)
- Profile-specific theme switching via ContentHoard interop

## Architecture

```
PlayHoard/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry + window creation
│   │   ├── services/            # 30+ focused services
│   │   │   ├── download/        # Download implementations
│   │   │   ├── hosters/         # File hoster APIs
│   │   │   ├── user/            # User data & sync
│   │   │   └── ...
│   │   └── events/              # IPC handlers by domain
│   ├── preload/
│   │   └── index.ts             # contextBridge (899 lines)
│   ├── renderer/
│   │   └── src/
│   │       ├── main.tsx         # Entry point + routing
│   │       ├── app.tsx          # Root layout
│   │       ├── store.ts         # Redux store
│   │       ├── features/        # Redux slices (10)
│   │       ├── hooks/           # Custom hooks (18)
│   │       ├── components/      # Reusable components (26+)
│   │       ├── context/         # React Context providers (4)
│   │       ├── pages/           # Route pages (12+)
│   │       └── services/
│   ├── shared/                  # Shared code (main + renderer)
│   ├── types/                   # TypeScript definitions
│   └── locales/                 # 30+ language translations
├── hydra-native/                # Rust native addon
├── python_rpc/                  # Python RPC (torrenting)
├── proto/                       # Protobuf definitions
└── electron.vite.config.ts
```

## Notable Patterns

- **Multi-process download engine:** Python RPC for torrents, JS for HTTP, debrid service clients
- **Service-oriented main process:** 30+ focused services with single responsibility
- **Comprehensive error enumeration:** Structured `DownloadError` enum with i18n strings
- **Theme system with CSS injection:** Custom themes stored in LevelDB, applied via runtime CSS injection
- **ContentHoard interop:** Shared state for themes/profiles, environment variable-driven embedded mode
- **Deep links:** `playhoard://` and `hydralauncher://` protocol handlers
- **Linux gaming focus:** Proton, Wine, MangoHud, GameMode, UMU, Steam Deck plugin support
- **Ludusavi integration:** Save game backup/restore via bundled Ludusavi binary
