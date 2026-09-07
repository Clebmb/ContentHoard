const http = require("node:http");
const { spawn } = require("node:child_process");

const host = "127.0.0.1";
const port = 3000;
const url = `http://${host}:${port}`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const probe = () => new Promise((resolve) => {
  const request = http.get(url, (response) => {
    response.resume();
    resolve(true);
  });
  request.setTimeout(1500, () => {
    request.destroy();
    resolve(false);
  });
  request.on("error", () => resolve(false));
});

const spawnCommand = (command, args, options = {}) => spawn(command, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  ...options,
});

(async () => {
  let nextProcess = null;
  if (!await probe()) {
    nextProcess = spawnCommand("npm", ["run", "dev:desktop-web"], {
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" },
    });
  }

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await probe()) break;
    await wait(1000);
    if (attempt === 119) {
      nextProcess?.kill();
      throw new Error("Timed out waiting for Next dev server.");
    }
  }

  const electronProcess = spawnCommand(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["electron", "."],
    { env: { ...process.env, MEDIAHOARD_DESKTOP_URL: url } },
  );

  const shutdown = () => {
    electronProcess.kill();
    nextProcess?.kill();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  electronProcess.on("exit", (code) => {
    nextProcess?.kill();
    process.exit(code ?? 0);
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
