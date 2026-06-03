# MediaHoard

## Tech Stack

| Category | Technology |
|---|---|
| **Desktop Framework** | Electron 38 + electron-builder |
| **Frontend** | Next.js 16 (standalone), React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 4, shadcn/ui, Base UI, Framer Motion 12 |
| **Icons** | Lucide React, Material Symbols |
| **State Management** | React Context (no external library) |
| **Persistence** | localStorage + IndexedDB (profile-scoped) |
| **Native Player** | mpv (JSON-over-socket IPC) |
| **Media Probing** | ffmpeg-static, ffprobe-static |
| **Build Targets** | Linux AppImage, Windows NSIS |

## Main Features

### Addon-Powered Content Discovery (Stremio-compatible)
- Install Stremio/Nuvio-compatible addons via manifest URL
- Discover catalogs, metadata, streams, and subtitles through addon ecosystem
- Built-in recommended addons: MHAddons, AIOMetadata, AIOStreams

### Multi-Page Content Browsing
- **Home:** Lazy-loading catalog sections with IntersectionObserver
- **Browse:** Full catalog browser with genre/year filters and infinite scroll
- **Movies / TV:** Domain-specific catalog sections
- **Library:** Personal local media library with drag-and-drop folder management

### Media Detail & Playback
- Rich detail pages with metadata, posters, episode/season navigation
- Stream source selection from addons with subtitle support
- Multiple playback modes:
  - **Native (mpv):** "Goblin Player" — full-screen transparent window
  - **External Player:** Launch VLC/mpv with playback URL
  - **Web-based:** Through web protocols
  - **Goblin Deep Link:** `goblin://` protocol handler

### Personal Media Library
- Import local video files and directories (File System Access API / native dialogs)
- Folder-based organization with drag-and-drop
- Video thumbnail extraction, file name parsing for metadata
- TMDB metadata enrichment (configurable API key)

### Multi-Profile System
- Named profiles with colors and icons (Material Symbols or custom images)
- Isolated storage per profile (themes, preferences, addons, library)
- Syncs to ContentHoard hub for cross-app consistency

### Visual Customization (Theme Engine)
- 40+ CSS custom properties for full visual control
- Live theme editor with colors, glass effects, glow, typography, branding
- Save/load/overwrite custom themes
- Profile-scoped themes with global saved themes

### Lists Management
- Each addon catalog can be shown/hidden per page (Home, Browse, Movies, TV)
- Custom naming and drag-and-drop reordering per page
- `ListPreference` objects with per-page visibility settings

## Architecture

```
MediaHoard/
├── electron/              # Electron main process
│   ├── main.cjs           # App entry, IPC handlers, server orchestration
│   ├── preload.cjs        # Context bridge
│   ├── dev.cjs            # Dev launcher
│   ├── mpv-controller.cjs # mpv IPC manager
│   └── resources/         # mpv binaries, server, runtime
├── player/                # Shared player module (Goblin Player)
├── src/
│   ├── app/               # Next.js App Router pages
│   ├── components/        # React components
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities
│   ├── providers/         # React Context providers
│   └── types/             # TypeScript declarations
└── next.config.ts
```

## Notable Patterns

- **Dual-mode:** Runs as Next.js web app or Electron desktop app with full native features
- **Bridge pattern:** `lib/desktop-player.ts` and `lib/electron-desktop.ts` abstract Electron API behind feature detection
- **Profile-scoped storage:** All data keyed by `p_{profileId}_` prefix
- **ContentHoard integration:** Shared JSON state file + environment variables + HTTP focus signals
- **Deep link protocol:** `goblin://` protocol handler for external playback requests
