const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizePropertyValue = (value) => {
  if (value === "yes") return true;
  if (value === "no") return false;
  return value;
};

class MpvSession {
  constructor({ label, mpvPath, emit }) {
    this.label = label;
    this.mpvPath = mpvPath;
    this.emit = emit;
    this.process = null;
    this.socket = null;
    this.buffer = "";
    this.nextRequestId = 1;
    this.pending = new Map();
    this.observedProperties = new Map();
    this.ipcPath = process.platform === "win32"
      ? `\\\\.\\pipe\\mediahoard-${process.pid}-${label}`
      : path.join(os.tmpdir(), `mediahoard-${process.pid}-${label}.sock`);
  }

  async start({ requestHeaders = null, forceReinitialize = false } = {}) {
    if (forceReinitialize) {
      await this.stop();
    }

    if (this.process && this.socket) {
      return;
    }

    if (process.platform !== "win32") {
      fs.rmSync(this.ipcPath, { force: true });
    }

    const args = [
      "--idle=yes",
      "--force-window=yes",
      "--keep-open=yes",
      "--no-terminal",
      "--input-ipc-server=" + this.ipcPath,
      "--title=Goblin Player",
    ];

    if (requestHeaders && typeof requestHeaders === "object") {
      const headerFields = Object.entries(requestHeaders)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => `${key}: ${value}`);
      if (headerFields.length > 0) {
        args.push("--http-header-fields=" + headerFields.join(","));
      }
    }

    this.process = spawn(this.mpvPath, args, {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: false,
    });

    this.process.stderr.on("data", (chunk) => {
      this.emit("log", { label: this.label, message: chunk.toString("utf8") });
    });

    this.process.once("exit", (code, signal) => {
      this.emit("event", { label: this.label, event: { event: "shutdown", code, signal } });
      this.cleanupSocket();
      this.process = null;
      for (const { reject } of this.pending.values()) {
        reject(new Error("mpv exited before responding."));
      }
      this.pending.clear();
    });

    await this.connectSocket();
  }

  async connectSocket() {
    let lastError = null;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        await new Promise((resolve, reject) => {
          const socket = net.createConnection(this.ipcPath);
          socket.once("connect", () => {
            this.socket = socket;
            socket.on("data", (chunk) => this.handleData(chunk));
            socket.on("error", (error) => this.emit("log", {
              label: this.label,
              message: error.message,
            }));
            socket.on("close", () => {
              if (this.socket === socket) {
                this.socket = null;
              }
            });
            resolve();
          });
          socket.once("error", reject);
        });
        return;
      } catch (error) {
        lastError = error;
        await wait(100);
      }
    }

    throw lastError || new Error("Timed out connecting to mpv IPC.");
  }

  handleData(chunk) {
    this.buffer += chunk.toString("utf8");

    while (this.buffer.includes("\n")) {
      const newlineIndex = this.buffer.indexOf("\n");
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }

      if (message.request_id && this.pending.has(message.request_id)) {
        const pending = this.pending.get(message.request_id);
        this.pending.delete(message.request_id);
        if (message.error && message.error !== "success") {
          pending.reject(new Error(message.error));
        } else {
          pending.resolve(normalizePropertyValue(message.data));
        }
        continue;
      }

      if (message.event === "property-change") {
        this.emit("property", {
          label: this.label,
          property: {
            name: message.name,
            data: normalizePropertyValue(message.data),
          },
        });
        continue;
      }

      this.emit("event", { label: this.label, event: message });
    }
  }

  send(command) {
    if (!this.socket) {
      return Promise.reject(new Error("mpv IPC is not connected."));
    }

    const requestId = this.nextRequestId;
    this.nextRequestId += 1;

    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.socket.write(JSON.stringify({ command, request_id: requestId }) + "\n", (error) => {
        if (error) {
          this.pending.delete(requestId);
          reject(error);
        }
      });
    });
  }

  async command(name, args = []) {
    return this.send([name, ...args]);
  }

  async getProperty(name) {
    return this.send(["get_property", name]);
  }

  async setProperty(name, value) {
    return this.send(["set_property", name, value]);
  }

  async observeProperties(properties) {
    for (const [name] of properties) {
      if (this.observedProperties.has(name)) continue;
      const observerId = this.observedProperties.size + 1;
      this.observedProperties.set(name, observerId);
      await this.send(["observe_property", observerId, name]);
    }
  }

  async snapshot() {
    const take = async (name) => this.getProperty(name).catch(() => null);
    return {
      pause: await take("pause"),
      timePos: await take("time-pos"),
      duration: await take("duration"),
      aid: await take("aid"),
      sid: await take("sid"),
      vid: await take("vid"),
      trackList: await take("track-list"),
      mediaTitle: await take("media-title"),
    };
  }

  cleanupSocket() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    if (process.platform !== "win32") {
      fs.rmSync(this.ipcPath, { force: true });
    }
  }

  async stop() {
    if (this.socket) {
      await this.command("quit", []).catch(() => undefined);
    }
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.cleanupSocket();
    this.process = null;
    this.observedProperties.clear();
  }
}

class MpvController {
  constructor({ resolveMpvPath, emit }) {
    this.resolveMpvPath = resolveMpvPath;
    this.emit = emit;
    this.sessions = new Map();
  }

  getSession(label) {
    const normalizedLabel = label || "goblin-player";
    const existing = this.sessions.get(normalizedLabel);
    if (existing) return existing;

    const session = new MpvSession({
      label: normalizedLabel,
      mpvPath: this.resolveMpvPath(),
      emit: this.emit,
    });
    this.sessions.set(normalizedLabel, session);
    return session;
  }

  async bootstrap({ windowLabel, requestHeaders = null, forceReinitialize = false }) {
    await this.getSession(windowLabel).start({ requestHeaders, forceReinitialize });
  }

  async destroy(windowLabel) {
    const session = this.sessions.get(windowLabel);
    if (!session) return;
    await session.stop();
    this.sessions.delete(windowLabel);
  }

  async destroyAll() {
    await Promise.all([...this.sessions.values()].map((session) => session.stop()));
    this.sessions.clear();
  }
}

module.exports = { MpvController };
