import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { parseSiteConfig } from "./config.js";
import { normalizeBasePath } from "./paths.js";
import type { SiteConfig } from "./types.js";

export interface SiteProfile {
  name: string;
  configPath: string;
  vault: string;
  build: {
    out: string;
    base?: string;
    allowWarnings: boolean;
  };
  overrides: SiteConfig;
  publish?: {
    type: "ssh-release";
    host: string;
    root: string;
  };
}

export function profileFingerprint(profile: SiteProfile): string {
  return createHash("sha256").update(JSON.stringify({
    vault: profile.vault,
    basePath: normalizeBasePath(profile.build.base),
    overrides: profile.overrides,
  })).digest("hex");
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function knownKeys(value: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`${label}: unknown field ${key}`);
  }
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function localPath(value: string, projectRoot: string): string {
  const expanded = value === "~" ? os.homedir() : value.startsWith("~/")
    ? path.join(os.homedir(), value.slice(2))
    : value;
  return path.resolve(projectRoot, expanded);
}

export async function loadSiteProfile(name: string, projectRoot = process.cwd()): Promise<SiteProfile> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error(`Invalid site name: ${name}`);
  }
  const configPath = path.join(projectRoot, "sites", `${name}.json`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(configPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Site config does not exist: ${configPath}`);
    }
    if (error instanceof SyntaxError) throw new Error(`${configPath}: invalid JSON: ${error.message}`);
    throw error;
  }

  const config = object(parsed, configPath);
  knownKeys(config, ["vault", "build", "overrides", "publish"], configPath);
  const build = object(config.build, `${configPath}: build`);
  knownKeys(build, ["out", "base", "allowWarnings"], `${configPath}: build`);
  const vault = localPath(nonEmptyString(config.vault, `${configPath}: vault`), projectRoot);
  const out = localPath(nonEmptyString(build.out, `${configPath}: build.out`), projectRoot);
  const base = build.base === undefined ? undefined : nonEmptyString(build.base, `${configPath}: build.base`);
  if (build.allowWarnings !== undefined && typeof build.allowWarnings !== "boolean") {
    throw new Error(`${configPath}: build.allowWarnings must be a boolean`);
  }

  let overrides: SiteConfig = {};
  if (config.overrides !== undefined) {
    const value = object(config.overrides, `${configPath}: overrides`);
    knownKeys(value, ["title", "welcome", "navigation"], `${configPath}: overrides`);
    overrides = parseSiteConfig(value, `${configPath}: overrides`);
  }

  let publish: SiteProfile["publish"];
  if (config.publish !== undefined) {
    const value = object(config.publish, `${configPath}: publish`);
    knownKeys(value, ["type", "host", "root"], `${configPath}: publish`);
    if (value.type !== "ssh-release") {
      throw new Error(`${configPath}: publish.type must be ssh-release`);
    }
    const host = nonEmptyString(value.host, `${configPath}: publish.host`);
    const root = nonEmptyString(value.root, `${configPath}: publish.root`);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._@-]*$/.test(host)) {
      throw new Error(`${configPath}: publish.host contains unsupported characters`);
    }
    if (path.posix.isAbsolute(root) || !root.split("/").every((part) => /^[a-zA-Z0-9_.-]+$/.test(part) && part !== "." && part !== "..")) {
      throw new Error(`${configPath}: publish.root must be a relative path without spaces or parent segments`);
    }
    publish = { type: "ssh-release", host, root };
  }

  return { name, configPath, vault, build: { out, base, allowWarnings: build.allowWarnings === true }, overrides, publish };
}
