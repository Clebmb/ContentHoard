import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const standaloneDir = path.join(projectRoot, ".next", "standalone");
const staticDir = path.join(projectRoot, ".next", "static");
const publicDir = path.join(projectRoot, "public");
const electronResourceDir = path.join(projectRoot, "electron", "resources");
const runtimeDir = path.join(electronResourceDir, "runtime");
const serverDir = path.join(electronResourceDir, "server");
const mpvDir = path.join(electronResourceDir, "mpv", "bin");

const copyDir = async (source, destination) => {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDir(sourcePath, destinationPath);
      continue;
    }

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
  }
};

const ensureExists = async (targetPath, label) => {
  try {
    await fs.access(targetPath);
  } catch {
    throw new Error(`${label} not found at ${targetPath}. Run npm run build first.`);
  }
};

const findExecutableOnPath = async (name) => {
  const entries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const entry of entries) {
    const candidate = path.join(entry, name);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }

  return null;
};

const prepareMpvRuntime = async () => {
  await fs.mkdir(mpvDir, { recursive: true });
  const executableName = process.platform === "win32" ? "mpv.exe" : "mpv";
  const configuredSource = process.env.ELECTRON_MPV_SOURCE || process.env.MEDIAHOARD_MPV_PATH || "";
  const source = configuredSource || await findExecutableOnPath(executableName);

  if (!source) {
    throw new Error(
      `mpv executable not found. Install mpv or set ELECTRON_MPV_SOURCE to the ${executableName} path before running desktop:prepare.`
    );
  }

  const target = path.join(mpvDir, executableName);
  await fs.copyFile(source, target);
  if (process.platform !== "win32") {
    await fs.chmod(target, 0o755);
  }

  await fs.writeFile(
    path.join(electronResourceDir, "mpv", "runtime.json"),
    JSON.stringify({ preparedAt: new Date().toISOString(), source, target }, null, 2),
  );
};

const main = async () => {
  await ensureExists(standaloneDir, "Next standalone output");

  await fs.rm(electronResourceDir, { recursive: true, force: true });
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(serverDir, { recursive: true });

  await copyDir(standaloneDir, serverDir);

  try {
    await copyDir(staticDir, path.join(serverDir, ".next", "static"));
  } catch {}

  try {
    await copyDir(publicDir, path.join(serverDir, "public"));
  } catch {}

  const ffmpegPackageDir = path.join(projectRoot, "node_modules", "ffmpeg-static");
  const ffprobePackageDir = path.join(projectRoot, "node_modules", "ffprobe-static");
  await copyDir(ffmpegPackageDir, path.join(serverDir, "node_modules", "ffmpeg-static"));
  await copyDir(ffprobePackageDir, path.join(serverDir, "node_modules", "ffprobe-static"));

  const nodeSource = process.execPath;
  const nodeTarget = path.join(runtimeDir, process.platform === "win32" ? "node.exe" : "node");
  await fs.copyFile(nodeSource, nodeTarget);

  const marker = {
    preparedAt: new Date().toISOString(),
    nodeSource,
    standaloneDir,
  };
  await fs.writeFile(path.join(electronResourceDir, "runtime.json"), JSON.stringify(marker, null, 2));
  await prepareMpvRuntime();
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
