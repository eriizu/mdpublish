import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import {
  applyWelcomePage,
  CONFIG_FILENAME,
  loadSiteConfig,
} from "./config.js";
import { createMarkdownRenderer, renderMarkdown } from "./markdown.js";
import {
  buildConfiguredNavigation,
  buildDefaultNavigation,
} from "./navigation.js";
import { normalizeBasePath } from "./paths.js";
import { renderGeneratedLanding, renderPageTemplate } from "./template.js";
import { CLIENT_JS, LIVE_RELOAD_JS, THEME_CSS } from "./theme.js";
import type { BuildOptions, BuildResult } from "./types.js";
import { loadVault } from "./vault.js";

const OUTPUT_MARKER = ".mdpublish-output";
const runtimeRequire = createRequire(import.meta.url);

async function copyRendererAssets(outputAssets: string): Promise<void> {
  const katexDist = path.dirname(runtimeRequire.resolve("katex"));
  const mermaidDist = path.dirname(runtimeRequire.resolve("mermaid"));
  await Promise.all([
    fs.copyFile(
      path.join(katexDist, "katex.min.css"),
      path.join(outputAssets, "katex.min.css"),
    ),
    fs.cp(path.join(katexDist, "fonts"), path.join(outputAssets, "fonts"), {
      recursive: true,
    }),
    fs.copyFile(
      path.join(mermaidDist, "mermaid.min.js"),
      path.join(outputAssets, "mermaid.min.js"),
    ),
  ]);
}

async function prepareOutputDirectory(outputDir: string, inputDir: string): Promise<void> {
  const output = path.resolve(outputDir);
  const input = path.resolve(inputDir);
  const filesystemRoot = path.parse(output).root;
  if (output === filesystemRoot || output === input || input.startsWith(`${output}${path.sep}`)) {
    throw new Error(`Refusing unsafe output folder: ${output}`);
  }

  const entries = await fs.readdir(output).catch(() => undefined);
  if (entries?.length) {
    const markerExists = await fs
      .stat(path.join(output, OUTPUT_MARKER))
      .then((stats) => stats.isFile())
      .catch(() => false);
    if (!markerExists) {
      throw new Error(
        `Output folder is not empty and was not created by mdpublish: ${output}`,
      );
    }
    await fs.rm(output, { recursive: true, force: true });
  }
  await fs.mkdir(output, { recursive: true });
}

export async function buildSite(options: BuildOptions): Promise<BuildResult> {
  const inputDir = path.resolve(options.inputDir);
  const outputDir = path.resolve(options.outputDir);
  const basePath = normalizeBasePath(options.basePath);
  const config = await loadSiteConfig(inputDir);
  const vault = await loadVault(inputDir, outputDir);
  if (!vault.pages.length) throw new Error(`No publishable Markdown files found in ${inputDir}`);
  if (config.welcome) applyWelcomePage(vault, config.welcome);

  await prepareOutputDirectory(outputDir, inputDir);
  const siteTitle = options.title?.trim() || config.title || path.basename(inputDir);
  const warningSet = new Set<string>();
  const navigation = config.navigation
    ? buildConfiguredNavigation(vault, config.navigation, (warning) =>
        warningSet.add(`${CONFIG_FILENAME}: ${warning}`),
      )
    : buildDefaultNavigation(vault.pages);
  const markdown = createMarkdownRenderer();

  for (const page of vault.pages) {
    const rendered = renderMarkdown(markdown, page, vault, basePath, (warning) => {
      warningSet.add(`${page.relativePath}: ${warning}`);
    });
    const title = `<header class="page-header"><h1 class="page-title">${markdown.utils.escapeHtml(page.title)}</h1></header>`;
    const document = renderPageTemplate({
      siteTitle,
      basePath,
      pages: vault.pages,
      navigation,
      page,
      content: `${title}${rendered.html}`,
      headings: rendered.headings,
      liveReload: options.liveReload,
      usesMermaid: rendered.usesMermaid,
    });
    const destination = path.join(outputDir, ...page.route.split("/"), "index.html");
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, document);
  }

  if (!vault.pages.some((page) => page.route === "")) {
    const landing = renderPageTemplate({
      siteTitle,
      basePath,
      pages: vault.pages,
      navigation,
      content: renderGeneratedLanding(navigation, basePath),
      liveReload: options.liveReload,
    });
    await fs.writeFile(path.join(outputDir, "index.html"), landing);
  }

  for (const asset of vault.assets) {
    const destination = path.join(outputDir, "assets", "content", asset.relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(asset.sourcePath, destination);
  }

  const staticAssets = path.join(outputDir, "assets");
  await fs.mkdir(staticAssets, { recursive: true });
  await Promise.all([
    copyRendererAssets(staticAssets),
    fs.writeFile(path.join(staticAssets, "mdpublish.css"), THEME_CSS.trimStart()),
    fs.writeFile(path.join(staticAssets, "mdpublish.js"), CLIENT_JS.trimStart()),
    ...(options.liveReload
      ? [fs.writeFile(path.join(staticAssets, "reload.js"), LIVE_RELOAD_JS.trimStart())]
      : []),
  ]);
  await fs.writeFile(
    path.join(outputDir, OUTPUT_MARKER),
    JSON.stringify({ generatedAt: new Date().toISOString(), source: inputDir }, null, 2),
  );

  return {
    pages: vault.pages.length,
    assets: vault.assets.length,
    warnings: [...warningSet].sort(),
    outputDir,
  };
}
