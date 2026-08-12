import path from "node:path";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import {
  highlightCode,
  installCallouts,
  installMath,
  installMermaid,
  installTableLineBreaks,
} from "./markdown-extensions.js";
import {
  assetUrl,
  basenameWithoutExtension,
  normalizeLookupPath,
  pageUrl,
  safeDecodeUri,
  slugify,
} from "./paths.js";
import type { Heading, Page, Vault, VaultAsset } from "./types.js";

export interface RenderedMarkdown {
  html: string;
  headings: Heading[];
  usesMermaid: boolean;
}

interface RenderEnvironment {
  page: Page;
  vault: Vault;
  basePath: string;
  warn: (message: string) => void;
}

type Resolution<T> =
  | { item: T; ambiguous?: false }
  | { ambiguous: true; candidates: string[] }
  | undefined;

function isExternalUrl(value: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value);
}

function splitFragment(value: string): { target: string; fragment: string } {
  const index = value.indexOf("#");
  if (index < 0) return { target: value, fragment: "" };
  return { target: value.slice(0, index), fragment: value.slice(index + 1) };
}

function fragmentUrl(fragment: string): string {
  return fragment ? `#${encodeURIComponent(slugify(safeDecodeUri(fragment)))}` : "";
}

function resolvePage(target: string, current: Page, vault: Vault): Resolution<Page> {
  const decoded = safeDecodeUri(target).replace(/^\/+/, "");
  if (!decoded) return { item: current };
  const withExtension = /\.md$/i.test(decoded) ? decoded : `${decoded}.md`;
  const relative = path.posix.normalize(
    path.posix.join(current.sourceDirectory, withExtension),
  );
  const candidates = decoded.includes("/")
    ? [withExtension, relative]
    : [relative, withExtension];

  for (const candidate of candidates) {
    const page = vault.pageByPath.get(normalizeLookupPath(candidate));
    if (page) return { item: page };
  }

  const basename = basenameWithoutExtension(decoded).toLocaleLowerCase();
  const basenameMatches = vault.pagesByBasename.get(basename) ?? [];
  if (basenameMatches.length === 1) return { item: basenameMatches[0]! };
  if (basenameMatches.length > 1) {
    return {
      ambiguous: true,
      candidates: basenameMatches.map((page) => page.relativePath),
    };
  }
  return undefined;
}

function resolveAsset(
  target: string,
  current: Page,
  vault: Vault,
): Resolution<VaultAsset> {
  const decoded = safeDecodeUri(target).replace(/^\/+/, "");
  const relative = path.posix.normalize(
    path.posix.join(current.sourceDirectory, decoded),
  );
  const candidates = decoded.includes("/") ? [decoded, relative] : [relative, decoded];
  for (const candidate of candidates) {
    const asset = vault.assetByPath.get(normalizeLookupPath(candidate));
    if (asset) return { item: asset };
  }

  const matches =
    vault.assetsByBasename.get(path.posix.basename(decoded).toLocaleLowerCase()) ?? [];
  if (matches.length === 1) return { item: matches[0]! };
  if (matches.length > 1) {
    return {
      ambiguous: true,
      candidates: matches.map((asset) => asset.relativePath),
    };
  }
  return undefined;
}

function describeFailure<T>(
  kind: string,
  target: string,
  result: Resolution<T>,
): string {
  if (result && "ambiguous" in result && result.ambiguous) {
    return `Ambiguous ${kind} “${target}”; matches ${result.candidates.join(", ")}`;
  }
  return `Missing ${kind} “${target}”`;
}

function defaultWikiLabel(target: string): string {
  const { target: pageTarget, fragment } = splitFragment(target);
  if (!pageTarget && fragment) return fragment;
  return basenameWithoutExtension(pageTarget || target);
}

function installWikiLinks(markdown: MarkdownIt): void {
  markdown.inline.ruler.before("link", "obsidian-wikilink", (state, silent) => {
    const isEmbed = state.src.startsWith("![[", state.pos);
    const isLink = state.src.startsWith("[[", state.pos);
    if (!isEmbed && !isLink) return false;

    const openingLength = isEmbed ? 3 : 2;
    const end = state.src.indexOf("]]", state.pos + openingLength);
    if (end < 0 || end >= state.posMax) return false;
    if (silent) return true;

    const raw = state.src.slice(state.pos + openingLength, end).trim();
    const separator = raw.indexOf("|");
    const target = (separator < 0 ? raw : raw.slice(0, separator)).trim();
    const label = separator < 0 ? "" : raw.slice(separator + 1).trim();
    const token = state.push(isEmbed ? "obsidian_embed" : "obsidian_link", "", 0);
    token.meta = { target, label };
    state.pos = end + 2;
    return true;
  });

  markdown.renderer.rules.obsidian_link = (tokens, index, _options, rawEnv) => {
    const env = rawEnv as RenderEnvironment;
    const { target, label } = tokens[index]!.meta as {
      target: string;
      label: string;
    };
    const { target: pageTarget, fragment } = splitFragment(target);
    const resolution = resolvePage(pageTarget, env.page, env.vault);
    const text = markdown.utils.escapeHtml(label || defaultWikiLabel(target));
    if (!resolution || ("ambiguous" in resolution && resolution.ambiguous)) {
      env.warn(describeFailure("page link", target, resolution));
      return `<a class="broken-link" href="#" title="Unresolved link">${text}</a>`;
    }
    const href = `${pageUrl(resolution.item.route, env.basePath)}${fragmentUrl(fragment)}`;
    return `<a href="${markdown.utils.escapeHtml(href)}">${text}</a>`;
  };

  markdown.renderer.rules.obsidian_embed = (tokens, index, _options, rawEnv) => {
    const env = rawEnv as RenderEnvironment;
    const { target, label } = tokens[index]!.meta as {
      target: string;
      label: string;
    };
    const resolution = resolveAsset(target, env.page, env.vault);
    if (!resolution || ("ambiguous" in resolution && resolution.ambiguous)) {
      env.warn(describeFailure("image", target, resolution));
      return `<span class="broken-embed">Missing image: ${markdown.utils.escapeHtml(target)}</span>`;
    }
    const size = label.match(/^(\d+)(?:x(\d+))?$/);
    const dimensions = size
      ? ` width="${size[1]}"${size[2] ? ` height="${size[2]}"` : ""}`
      : "";
    return `<img src="${markdown.utils.escapeHtml(assetUrl(resolution.item.relativePath, env.basePath))}" alt="${markdown.utils.escapeHtml(path.posix.basename(target))}" loading="lazy"${dimensions}>`;
  };
}

function installStandardLinkResolution(markdown: MarkdownIt): void {
  const defaultImageRenderer = markdown.renderer.rules.image;
  markdown.renderer.rules.link_open = (tokens, index, options, rawEnv, self) => {
    const env = rawEnv as RenderEnvironment;
    const token = tokens[index]!;
    const href = token.attrGet("href");
    if (!href || isExternalUrl(href)) {
      return self.renderToken(tokens, index, options);
    }
    if (href.startsWith("#")) {
      token.attrSet("href", fragmentUrl(href.slice(1)) || "#");
      return self.renderToken(tokens, index, options);
    }

    const { target, fragment } = splitFragment(href);
    if (/\.md$/i.test(target)) {
      const resolution = resolvePage(target, env.page, env.vault);
      if (!resolution || ("ambiguous" in resolution && resolution.ambiguous)) {
        env.warn(describeFailure("page link", href, resolution));
        token.attrJoin("class", "broken-link");
      } else {
        token.attrSet(
          "href",
          `${pageUrl(resolution.item.route, env.basePath)}${fragmentUrl(fragment)}`,
        );
      }
    } else {
      const resolution = resolveAsset(target, env.page, env.vault);
      if (resolution && !("ambiguous" in resolution && resolution.ambiguous)) {
        token.attrSet("href", assetUrl(resolution.item.relativePath, env.basePath));
      }
    }
    return self.renderToken(tokens, index, options);
  };

  markdown.renderer.rules.image = (tokens, index, options, rawEnv, self) => {
    const env = rawEnv as RenderEnvironment;
    const token = tokens[index]!;
    const source = token.attrGet("src");
    if (source && !source.startsWith("data:") && !isExternalUrl(source)) {
      const resolution = resolveAsset(source, env.page, env.vault);
      if (!resolution || ("ambiguous" in resolution && resolution.ambiguous)) {
        env.warn(describeFailure("image", source, resolution));
        token.attrJoin("class", "broken-image");
      } else {
        token.attrSet("src", assetUrl(resolution.item.relativePath, env.basePath));
      }
    }
    token.attrSet("loading", "lazy");
    return defaultImageRenderer
      ? defaultImageRenderer(tokens, index, options, rawEnv, self)
      : self.renderToken(tokens, index, options);
  };
}

function prepareHeadings(tokens: Token[]): {
  headings: Heading[];
} {
  const headings: Heading[] = [];
  const used = new Map<string, number>();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (token.type !== "heading_open") continue;
    const level = Number(token.tag.slice(1));
    const inline = tokens[index + 1];
    const text = inline?.type === "inline" ? inline.content.trim() : "";
    const baseId = slugify(text);
    const count = used.get(baseId) ?? 0;
    used.set(baseId, count + 1);
    const id = count ? `${baseId}-${count + 1}` : baseId;
    token.attrSet("id", id);
    if (level >= 1 && level <= 4) headings.push({ level, text, id });
  }
  return { headings };
}

export function createMarkdownRenderer(): MarkdownIt {
  const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    highlight: highlightCode,
  });
  installWikiLinks(markdown);
  installStandardLinkResolution(markdown);
  installCallouts(markdown);
  installMath(markdown);
  installMermaid(markdown);
  installTableLineBreaks(markdown);
  return markdown;
}

export function renderMarkdown(
  markdown: MarkdownIt,
  page: Page,
  vault: Vault,
  basePath: string,
  warn: (message: string) => void,
): RenderedMarkdown {
  const environment: RenderEnvironment = { page, vault, basePath, warn };
  const tokens = markdown.parse(page.markdown, environment);
  const { headings } = prepareHeadings(tokens);
  return {
    html: markdown.renderer.render(tokens, markdown.options, environment),
    headings,
    usesMermaid: tokens.some(
      (token) =>
        token.type === "fence" &&
        token.info.trim().split(/\s+/)[0]?.toLocaleLowerCase() === "mermaid",
    ),
  };
}
