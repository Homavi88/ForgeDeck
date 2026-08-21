import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

let backend;
let quitting = false;
const desktopDir = path.dirname(fileURLToPath(import.meta.url));

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function bundledServerPath() {
  if (process.env.FORGEDECK_SERVER_PATH) return process.env.FORGEDECK_SERVER_PATH;
  return path.join(process.resourcesPath, "server", "ForgeDeckServer.exe");
}

function bundledUiPath() {
  if (process.env.FORGEDECK_UI_DIR) return process.env.FORGEDECK_UI_DIR;
  return path.join(process.resourcesPath, "ui");
}

function startBackend(port) {
  const executable = bundledServerPath();
  const uiDir = bundledUiPath();
  if (!existsSync(executable)) {
    throw new Error(`ForgeDeck server was not found: ${executable}`);
  }
  if (!existsSync(path.join(uiDir, "index.html"))) {
    throw new Error(`ForgeDeck interface was not found: ${uiDir}`);
  }

  const dataDir = path.join(app.getPath("userData"), "data");
  mkdirSync(dataDir, { recursive: true });
  const log = createWriteStream(path.join(app.getPath("userData"), "backend.log"), { flags: "a" });
  backend = spawn(executable, [], {
    cwd: dataDir,
    env: {
      ...process.env,
      APP_ENV: "desktop",
      DEBUG: "false",
      FORGEDECK_HOST: "127.0.0.1",
      FORGEDECK_PORT: String(port),
      DESKTOP_UI_DIR: uiDir,
      DATABASE_URL: "sqlite:///./forgedeck.db",
      STORAGE_DIR: "./storage/audio",
      USE_CELERY: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  backend.stdout.pipe(log);
  backend.stderr.pipe(log);
  backend.once("exit", (code) => {
    if (!quitting && code !== 0) {
      dialog.showErrorBox(
        "ForgeDeck server stopped",
        `The local audio/project server exited with code ${code}. See backend.log in ${app.getPath("userData")}.`,
      );
    }
  });
}

async function waitForBackend(port) {
  const endpoint = `http://127.0.0.1:${port}/api/health`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return;
    } catch {
      // The sidecar is still starting.
    }
    await wait(250);
  }
  throw new Error("The local ForgeDeck server did not become ready in 20 seconds.");
}

function createWindow(port) {
  const window = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#101116",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(desktopDir, "preload.mjs"),
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1:")) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });
  return window.loadURL(`http://127.0.0.1:${port}`);
}

app.on("before-quit", () => {
  quitting = true;
  if (backend && !backend.killed) backend.kill();
});

ipcMain.handle("forgedeck:quit", () => {
  app.quit();
});

app.whenReady().then(async () => {
  try {
    const port = await availablePort();
    startBackend(port);
    await waitForBackend(port);
    await createWindow(port);
  } catch (error) {
    dialog.showErrorBox("ForgeDeck could not start", error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
