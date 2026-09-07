import http from "node:http";
import { spawn } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = 3000;
const HEALTH_PATH = "/";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const probeServer = () =>
  new Promise((resolve) => {
    const request = http.get(
      {
        host: HOST,
        port: PORT,
        path: HEALTH_PATH,
        timeout: 2000,
      },
      (response) => {
        response.resume();
        resolve({
          ok: true,
          statusCode: response.statusCode ?? null,
          poweredBy: response.headers["x-powered-by"] ?? null,
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });

    request.on("error", () => {
      resolve({ ok: false, statusCode: null, poweredBy: null });
    });
  });

const keepAliveOnExistingServer = async () => {
  console.log(`[desktop-dev] Reusing existing dev server at http://${HOST}:${PORT}`);

  const interval = setInterval(() => {}, 60_000);

  const shutdown = () => {
    clearInterval(interval);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

const startNextDevServer = async () => {
  console.log(`[desktop-dev] Starting Next dev server at http://${HOST}:${PORT}`);

  const child = spawn(
    "cmd.exe",
    [
      "/d",
      "/s",
      "/c",
      "set NODE_OPTIONS=--max-old-space-size=8192&& next dev --webpack --hostname 127.0.0.1 --port 3000",
    ],
    {
      stdio: "inherit",
      shell: false,
    },
  );

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await probeServer();
    if (result.ok) {
      return;
    }

    await wait(1000);
  }

  console.error(`[desktop-dev] Timed out waiting for Next dev server on ${HOST}:${PORT}.`);
  child.kill("SIGTERM");
  process.exit(1);
};

const main = async () => {
  const existing = await probeServer();

  if (existing.ok) {
    await keepAliveOnExistingServer();
    return;
  }

  await startNextDevServer();
};

await main();
