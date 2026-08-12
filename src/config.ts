import fs from "node:fs/promises";
import path from "node:path";
import { normalizeLookupPath, regularRouteForMarkdown } from "./paths.js";
import type {
  NavigationConfigEntry,
  SiteConfig,
  Vault,
} from "./types.js";

export const CONFIG_FILENAME = "mdpublish.config.json";

function parseNavigationEntry(
  value: unknown,
  index: number,
): NavigationConfigEntry {
  if (typeof value === "string" && value.trim()) {
    return { path: value.trim() };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      `${CONFIG_FILENAME}: navigation[${index}] must be a path string or an object with a path`,
    );
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.path !== "string" || !candidate.path.trim()) {
    throw new Error(`${CONFIG_FILENAME}: navigation[${index}].path must be a string`);
  }
  if (candidate.label !== undefined && typeof candidate.label !== "string") {
    throw new Error(`${CONFIG_FILENAME}: navigation[${index}].label must be a string`);
  }
  return {
    path: candidate.path.trim(),
    ...(candidate.label?.trim() ? { label: candidate.label.trim() } : {}),
  };
}

export async function loadSiteConfig(inputDir: string): Promise<SiteConfig> {
  const configPath = path.join(inputDir, CONFIG_FILENAME);
  const raw = await fs.readFile(configPath, "utf8").catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  });
  if (raw === undefined) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `${CONFIG_FILENAME} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${CONFIG_FILENAME} must contain a JSON object`);
  }
  const candidate = parsed as Record<string, unknown>;
  if (candidate.title !== undefined && typeof candidate.title !== "string") {
    throw new Error(`${CONFIG_FILENAME}: title must be a string`);
  }
  if (typeof candidate.title === "string" && !candidate.title.trim()) {
    throw new Error(`${CONFIG_FILENAME}: title cannot be empty`);
  }
  if (candidate.welcome !== undefined && typeof candidate.welcome !== "string") {
    throw new Error(`${CONFIG_FILENAME}: welcome must be a page path string`);
  }
  if (typeof candidate.welcome === "string" && !candidate.welcome.trim()) {
    throw new Error(`${CONFIG_FILENAME}: welcome cannot be empty`);
  }
  if (candidate.navigation !== undefined && !Array.isArray(candidate.navigation)) {
    throw new Error(`${CONFIG_FILENAME}: navigation must be an array`);
  }
  return {
    ...(Array.isArray(candidate.navigation)
      ? { navigation: candidate.navigation.map(parseNavigationEntry) }
      : {}),
    ...(typeof candidate.welcome === "string"
      ? { welcome: candidate.welcome.trim() }
      : {}),
    ...(typeof candidate.title === "string"
      ? { title: candidate.title.trim() }
      : {}),
  };
}

export function applyWelcomePage(vault: Vault, configuredPath: string): void {
  const welcomePage = vault.pageByPath.get(normalizeLookupPath(configuredPath));
  if (!welcomePage) {
    throw new Error(
      `${CONFIG_FILENAME}: welcome page does not exist or is not publishable: ${configuredPath}`,
    );
  }
  if (welcomePage.route === "") return;

  const existingWelcome = vault.pages.find((page) => page.route === "");
  if (existingWelcome) {
    existingWelcome.route = regularRouteForMarkdown(existingWelcome.relativePath);
  }
  welcomePage.route = "";

  const routeOwners = new Map<string, string>();
  for (const page of vault.pages) {
    const owner = routeOwners.get(page.route);
    if (owner) {
      throw new Error(
        `${CONFIG_FILENAME}: welcome creates a route collision between ${owner} and ${page.relativePath}`,
      );
    }
    routeOwners.set(page.route, page.relativePath);
  }
}
