# AudioHoard

Forked from https://github.com/nyakuoff/Snowify
---

## Tech Stack

| Category | Technology |
|---|---|
| **Desktop Framework** | Electron 33 + electron-builder + electron-updater |
| **Mobile** | Capacitor 8 (Android) |
| **Frontend** | Vanilla JS (no framework), ES modules |
| **Audio Engine** | Custom DualAudioEngine (crossfade, gapless, prefetch) |
| **Loudness** | AudioWorklet-based LUFS (ITU-R BS.1770 / EBU R128) |
| **Data Sources** | youtubei.js, ytmusic-api, yt-dlp |
| **Lyrics** | @stef-0012/synclyrics (Musixmatch, LrcLib, Netease) |
| **Icons** | Material Symbols (Google Fonts) |
| **i18n** | Custom I18n global, 12 languages |
| **Plugin System** | Custom marketplace (GitHub-based) |
| **State Management** | Mutable singleton (`state.js`) |
| **Persistence** | localStorage, optional Firebase cloud sync |
| **Build Tooling** | esbuild (mobile bridge), Biome (lint) |
| **Build Targets** | Linux AppImage, Windows NSIS, macOS DMG/ZIP, Android APK |

## Main Features

### Core Playback
- Search and stream from YouTube Music (songs, artists, albums, playlists, videos)
- Play/pause, seek, skip, volume, shuffle, repeat (one/all/off)
- **Crossfade** (0-12s) and **gapless playback** via dual-`<audio>` engine
- **Smart Queue:** Auto-fills with similar songs when queue empties
- **Prefetching:** Pre-buffers upcoming tracks for instant playback
- **Loudness normalization:** AudioWorklet-based LUFS with configurable target (-14 LUFS default)
- **Keyboard shortcuts:** Space, arrows, Ctrl+arrows, `/`

### Library & Playlists
- Create, rename, delete playlists with custom or auto-generated covers
- Add/remove tracks, drag-and-drop into sidebar playlists
- **Liked Songs** (heart any track)
- **Following Artists** with new release notifications
- **Local audio files:** Import individual files or entire folders
- **CSV export/import** (including Spotify CSV import)

### Visual Features
- **Now Playing screen:** Maximized view with album art, dominant color background gradient
- **Synced Lyrics:** Karaoke-style with real-time sync via `requestAnimationFrame`
- **Music Videos:** In-app video overlay with draggable mini-player
- **"AudioHoard Wrapped":** Yearly listening stats with animated full-screen slideshow
- **7 built-in themes** + **theme builder** (full CSS variable customization) + community themes

### Discovery
- **Home:** Recently played, quick picks, new releases, recommendations
- **Explore:** New albums, charts/trending, top artists, music videos, mood/genre browsing
- **Artist pages:** Top songs, discography, "fans also like", live performances
- **Album pages:** Full track listing with release info
- **Search:** Autocomplete suggestions, search history, multi-category results

### Social & Cloud
- **Discord Rich Presence** (shows now-playing on profile)
- **Cloud Sync:** Firebase auth + Firestore for cross-device library sync
- **Deep links:** `audiohoard://` single-instance protocol handler

### Platform Features
- Windows thumbnail toolbar (prev/play-pause/next)
- System tray with minimize-to-tray
- Launch on startup option
- macOS yt-dlp auto-install
- Android via Capacitor with native ExoPlayer

### Profiles
- Multi-profile support with custom icons, colors, and names
- ContentHoard cross-app profile sync

### Plugin System
- Marketplace-fed plugins (official + community)
- Plugin types: song sources, metadata handlers
- Injected as `<script>` tags with full DOM/IPC access

## Architecture

```
AudioHoard/
├── src/
│   ├── main.js              # Electron entry point
│   ├── preload.js           # contextBridge (~40 methods)
│   ├── main/                # Main process modules
│   │   ├── window.js        # BrowserWindow creation
│   │   ├── ytmusic.js       # YouTube Music IPC handlers
│   │   ├── ytdlp.js         # Stream URL extraction
│   │   ├── lyrics.js        # Lyrics fetch + cache
│   │   ├── discord.js       # Discord RPC
│   │   ├── plugins.js       # Plugin filesystem management
│   │   ├── themes.js        # Theme CSS file management
│   │   ├── media.js         # ContentHoard integration
│   │   └── ...
│   └── renderer/
│       ├── index.html       # SPA shell
│       ├── app.js           # Renderer entry + boot
│       ├── styles.css       # All application CSS
│       ├── modules/         # 23 feature modules
│       │   ├── state.js     # Global mutable state
│       │   ├── player.js    # Playback controls
│       │   ├── queue.js     # Queue management
│       │   ├── library.js   # Playlists
│       │   ├── profiles.js  # Profile management
│       │   ├── theme.js     # Theme system
│       │   ├── settings.js  # Settings page
│       │   ├── plugins.js   # Plugin marketplace
│       │   └── ...
│       ├── locales/         # 12 JSON translation files
│       └── i18n.js          # Client-side I18n
├── src/mobile/              # Capacitor bridge
└── package.json
```

## Notable Patterns

- **Dependency-inversion via `callbacks.js`:** Prevents circular imports between modules
- **Mutable state singleton:** Direct property mutation with `callbacks.saveState()` after changes
- **Dual audio element engine:** Two `<audio>` elements enable gapless crossfade + prefetch
- **Main process as API gateway:** All data fetching via IPC (renderer is sandboxed)
- **Mobile parity:** Capacitor bridge mirrors the full preload API for Android
- **ContentHoard integration:** Shared state JSON file + HTTP focus signaling
