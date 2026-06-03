# ContentHoard

## Tech Stack

| Category | Technology |
|---|---|
| **Desktop Framework** | Electron 39 + electron-vite 4 + Vite 6 |
| **Frontend** | React 18, TypeScript 5 |
| **Icons** | Lucide React, Material Symbols |
| **State Management** | React hooks (no external library) |
| **Persistence** | electron-store |
| **Packaging** | electron-builder (Linux AppImage, Windows NSIS, macOS DMG/ZIP) |

## Main Features

### App Launcher & Process Management
- Launches sibling apps (MediaHoard, AudioHoard, PlayHoard) via `child_process.spawn`
- Monitors running PIDs, persists to `~/.contenthoard/running-pids.json`
- Restores status on startup, broadcasts real-time status updates to renderer
- Platform-aware process killing (SIGTERM on POSIX, `taskkill` on Windows)

### Profile Management
- Create, edit, delete user profiles with name, icon (Material icons or custom image/URL), and color
- Default profile created automatically
- Profiles shared to all sibling apps via shared state file

### Full Theme Editor
Four-tab visual theme customization:
- **Colors:** Background, accent, nav, header, dropdown, menu, streams (RGBA alpha sliders)
- **Typography:** 6 font families, per-section font and color selection
- **Effects:** Glass blur, transparency, card glow (blur/opacity/glow sliders, 4 presets)
- **Branding:** Per-app logos, header text, fonts/colors for ContentHoard + MediaHoard + AudioHoard + PlayHoard

Themes can be saved, loaded, overwritten, and reset to default.

### Cross-App State Sharing
- Writes `shared-state.json` to `~/.contenthoard/`
- Injects environment variables on child app launch (theme, profile, shared state path)
- Lightweight HTTP focus server on `127.0.0.1:18334` for inter-process focus signaling

### Single-Instance Lock
- `app.requestSingleInstanceLock()` enforcement
- Second-instance attempts show/raise/focus the existing window

## Architecture

```
ContentHoard/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # App entry, window creation, IPC, focus server
│   │   ├── app-registry.ts     # Sibling app definitions
│   │   ├── process-manager.ts  # Child process lifecycle
│   │   └── state.ts            # electron-store + shared state IO
│   ├── preload/
│   │   └── index.ts    # contextBridge API surface
│   └── renderer/
│       └── src/
│           ├── main.tsx         # Single-page React UI (~750 lines)
│           ├── global.d.ts      # Type declarations
│           └── styles.css       # Glassmorphism stylesheet
├── electron.vite.config.ts
└── package.json
```

## Notable Patterns

- **IPC:** invoke/handle for request/response; `webContents.send` for push-based status updates
- **Security:** contextIsolation: true, nodeIntegration: false
- **Hidden title bar** on non-Linux (`titleBarStyle: "hidden"`)
- **Glassmorphism** design language with CSS custom properties
