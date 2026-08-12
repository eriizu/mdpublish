import path from "node:path";
import { normalizeLookupPath, toPosix } from "./paths.js";
import type {
  NavigationConfigEntry,
  NavigationItem,
  Page,
  Vault,
} from "./types.js";

interface FolderNode {
  name: string;
  folders: Map<string, FolderNode>;
  pages: Page[];
}

function comparePages(left: Page, right: Page): number {
  return left.order - right.order || left.title.localeCompare(right.title);
}

function buildFolderNode(pages: Page[], baseFolder = ""): FolderNode {
  const root: FolderNode = { name: "", folders: new Map(), pages: [] };
  for (const page of pages) {
    const relative = baseFolder
      ? page.relativePath.slice(baseFolder.length).replace(/^\/+/, "")
      : page.relativePath;
    const folders = relative.split("/").slice(0, -1);
    let node = root;
    for (const name of folders) {
      let child = node.folders.get(name);
      if (!child) {
        child = { name, folders: new Map(), pages: [] };
        node.folders.set(name, child);
      }
      node = child;
    }
    node.pages.push(page);
  }
  return root;
}

function nodeToNavigation(node: FolderNode): NavigationItem[] {
  const pages: NavigationItem[] = [...node.pages]
    .sort(comparePages)
    .map((page) => ({ type: "page", page, label: page.title }));
  const folders: NavigationItem[] = [...node.folders.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((folder) => ({
      type: "folder",
      label: folder.name,
      children: nodeToNavigation(folder),
    }));
  return [...pages, ...folders];
}

export function buildDefaultNavigation(pages: Page[]): NavigationItem[] {
  return nodeToNavigation(buildFolderNode(pages.filter((page) => page.showInNavigation)));
}

function normalizeConfiguredPath(value: string): string {
  return toPosix(value).replace(/^\.\//, "").replace(/^\/+|\/+$/g, "");
}

function findConfiguredPage(entryPath: string, vault: Vault): Page | undefined {
  return vault.pageByPath.get(normalizeLookupPath(entryPath));
}

export function buildConfiguredNavigation(
  vault: Vault,
  entries: NavigationConfigEntry[],
  warn: (message: string) => void,
): NavigationItem[] {
  const navigation: NavigationItem[] = [];
  const includedPages = new Set<Page>();

  for (const entry of entries) {
    const forceFolder = /[\\/]$/.test(entry.path);
    const configuredPath = normalizeConfiguredPath(entry.path);
    const page = forceFolder ? undefined : findConfiguredPage(configuredPath, vault);
    if (page) {
      if (includedPages.has(page)) {
        warn(`Navigation entry “${entry.path}” includes ${page.relativePath} more than once`);
        continue;
      }
      includedPages.add(page);
      navigation.push({ type: "page", page, label: entry.label || page.title });
      continue;
    }

    const folderPrefix = configuredPath ? `${configuredPath}/` : "";
    const folderPages = vault.pages.filter(
      (candidate) =>
        candidate.showInNavigation &&
        normalizeLookupPath(candidate.relativePath).startsWith(
          normalizeLookupPath(folderPrefix),
        ) &&
        !includedPages.has(candidate),
    );
    if (!folderPages.length) {
      warn(`Navigation entry “${entry.path}” does not match a page or non-empty folder`);
      continue;
    }
    for (const folderPage of folderPages) includedPages.add(folderPage);
    const defaultLabel = path.posix.basename(configuredPath) || "Pages";
    navigation.push({
      type: "folder",
      label: entry.label || defaultLabel,
      children: nodeToNavigation(buildFolderNode(folderPages, configuredPath)),
    });
  }
  return navigation;
}
