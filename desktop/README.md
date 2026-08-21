# ForgeDeck Desktop (Windows)

This package creates a Windows installer that bundles:

- Electron/Chromium for a dedicated ForgeDeck window;
- a frozen FastAPI sidecar (`ForgeDeckServer.exe`);
- the Vite production build.

The released installer does not require Node.js or Python on the end-user
machine. User data, the SQLite database, audio uploads, and `backend.log` are
stored below Electron's per-user application-data directory.

## Build on Windows

Use a 64-bit CPython 3.12 build environment:

```bat
cd desktop
py -3.12-64 -m pip install -r requirements-build.txt
npm install
npm run package:win
```

The NSIS installer is written to `desktop/release/`. Code signing is
intentionally not configured here: production releases must provide the
organization's signing certificate through protected CI secrets rather than
placing it in the repository.
