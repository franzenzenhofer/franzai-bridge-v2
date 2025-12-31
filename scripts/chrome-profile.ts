import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type ProfileMode = "temp" | "clone" | "live";

export type ProfileChoice = {
  userDataDir: string;
  mode: ProfileMode;
  source?: string;
};

const expandHome = (value: string) =>
  value.startsWith("~") ? path.join(os.homedir(), value.slice(1)) : value;

const baseDirForPlatform = () => {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library/Application Support/Google/Chrome");
  }
  if (process.platform === "linux") {
    return path.join(os.homedir(), ".config/google-chrome");
  }
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA;
    if (!local) return null;
    return path.join(local, "Google/Chrome/User Data");
  }
  return null;
};

export const resolveChromeProfileSource = (): string | null => {
  const dirEnv = process.env.BRIDGE_CHROME_PROFILE_DIR;
  if (dirEnv) {
    const expanded = expandHome(dirEnv);
    if (!fs.existsSync(expanded)) {
      throw new Error(`BRIDGE_CHROME_PROFILE_DIR points to missing path: ${expanded}`);
    }
    return expanded;
  }
  const name = process.env.BRIDGE_CHROME_PROFILE_NAME;
  if (!name) return null;
  const base = baseDirForPlatform();
  if (!base) {
    throw new Error("Unsupported platform: set BRIDGE_CHROME_PROFILE_DIR instead");
  }
  const direct = path.join(base, name);
  if (fs.existsSync(direct)) return direct;
  const fromLabel = resolveProfileByLabel(base, name);
  if (fromLabel) return fromLabel;
  throw new Error(
    `Chrome profile "${name}" not found. Use chrome://version to copy the folder name.`
  );
};

const resolveProfileByLabel = (base: string, label: string) => {
  const localStatePath = path.join(base, "Local State");
  if (!fs.existsSync(localStatePath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(localStatePath, "utf8")) as {
      profile?: { info_cache?: Record<string, { name?: string }> };
    };
    const cache = raw.profile?.info_cache || {};
    for (const [dir, meta] of Object.entries(cache)) {
      if (meta?.name === label) {
        const folder = dir === "Default" ? "Default" : dir;
        const target = path.join(base, folder);
        if (fs.existsSync(target)) return target;
      }
    }
  } catch (err) {
    console.warn(`[chrome-profile] Failed to read Local State for label ${label}:`, err);
  }
  return null;
};

export const prepareProfileDir = (): ProfileChoice => {
  const source = resolveChromeProfileSource();
  const keepLive = process.env.BRIDGE_CHROME_PROFILE_MODE === "live";
  if (source) {
    if (keepLive) return { userDataDir: source, mode: "live", source };
    const clone = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-profile-"));
    fs.cpSync(source, clone, { recursive: true });
    return { userDataDir: clone, mode: "clone", source };
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-profile-"));
  return { userDataDir: tempDir, mode: "temp" };
};

export const cleanupProfileDir = (choice: ProfileChoice) => {
  if (choice.mode === "live") return;
  if (process.env.BRIDGE_CHROME_PROFILE_KEEP === "1") return;
  fs.rmSync(choice.userDataDir, { recursive: true, force: true });
};

export const describeProfileChoice = (choice: ProfileChoice) => {
  if (choice.mode === "temp") return "temporary profile";
  if (choice.mode === "clone") return `clone of ${choice.source}`;
  return `live profile ${choice.source}`;
};
