import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { CONFIG_FILENAME } from "./config.js";
import {
  basenameWithoutExtension,
  normalizeLookupPath,
  routeForMarkdown,
  toPosix,
} from "./paths.js";
import type { Page, Vault, VaultAsset } from "./types.js";

const IGNORED_DIRECTORIES = new Set([".git", ".obsidian", "node_modules"]);

async function collectFiles(
  directory: string,
  ignoredAbsolutePath?: string,
): Promise<string[]> {
  const result: string[] = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".") || IGNORED_DIRECTORIES.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (ignoredAbsolutePath && path.resolve(absolutePath) === ignoredAbsolutePath) continue;
    if (entry.isDirectory()) {
      result.push(...(await collectFiles(absolutePath, ignoredAbsolutePath)));
    } else if (entry.isFile()) {
      result.push(absolutePath);
    }
  }
  return result;
}

function addToMultiMap<T>(map: Map<string, T[]>, key: string, item: T): void {
  const existing = map.get(key) ?? [];
  existing.push(item);
  map.set(key, existing);
}

export async function loadVault(
  inputDir: string,
  outputDir?: string,
): Promise<Vault> {
  const root = path.resolve(inputDir);
  const rootStats = await fs.stat(root).catch(() => undefined);
  if (!rootStats?.isDirectory()) {
    throw new Error(`Input folder does not exist: ${root}`);
  }

  const resolvedOutput = outputDir ? path.resolve(outputDir) : undefined;
  const ignoredOutput =
    resolvedOutput && resolvedOutput.startsWith(`${root}${path.sep}`)
      ? resolvedOutput
      : undefined;
  const files = await collectFiles(root, ignoredOutput);
  const pages: Page[] = [];
  const assets: VaultAsset[] = [];

  for (const sourcePath of files) {
    const relativePath = toPosix(path.relative(root, sourcePath));
    if (relativePath === CONFIG_FILENAME) continue;
    if (!relativePath.toLocaleLowerCase().endsWith(".md")) {
      assets.push({ sourcePath, relativePath });
      continue;
    }

    const raw = await fs.readFile(sourcePath, "utf8");
    const parsed = matter(raw);
    if (parsed.data.draft === true || parsed.data.publish === false) continue;
    const fallback = basenameWithoutExtension(relativePath);
    pages.push({
      sourcePath,
      relativePath,
      sourceDirectory: path.posix.dirname(relativePath),
      route: routeForMarkdown(relativePath),
      title: String(parsed.data.title ?? fallback),
      order: Number.isFinite(Number(parsed.data.order))
        ? Number(parsed.data.order)
        : Number.MAX_SAFE_INTEGER,
      showInNavigation: parsed.data.nav !== false,
      markdown: parsed.content,
    });
  }

  const routeOwners = new Map<string, Page>();
  for (const page of pages) {
    const owner = routeOwners.get(page.route);
    if (owner) {
      throw new Error(
        `Route collision: ${owner.relativePath} and ${page.relativePath} both publish to /${page.route}`,
      );
    }
    routeOwners.set(page.route, page);
  }

  const pageByPath = new Map<string, Page>();
  const pagesByBasename = new Map<string, Page[]>();
  for (const page of pages) {
    pageByPath.set(normalizeLookupPath(page.relativePath), page);
    pageByPath.set(
      normalizeLookupPath(page.relativePath.replace(/\.md$/i, "")),
      page,
    );
    addToMultiMap(
      pagesByBasename,
      basenameWithoutExtension(page.relativePath).toLocaleLowerCase(),
      page,
    );
  }

  const assetByPath = new Map<string, VaultAsset>();
  const assetsByBasename = new Map<string, VaultAsset[]>();
  for (const asset of assets) {
    assetByPath.set(normalizeLookupPath(asset.relativePath), asset);
    addToMultiMap(
      assetsByBasename,
      path.posix.basename(asset.relativePath).toLocaleLowerCase(),
      asset,
    );
  }

  return {
    root,
    pages,
    assets,
    pageByPath,
    pagesByBasename,
    assetByPath,
    assetsByBasename,
  };
}
