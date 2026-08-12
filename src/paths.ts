import path from "node:path";

export function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

export function normalizeLookupPath(value: string): string {
  return toPosix(value)
    .replace(/^\.\//, "")
    .replace(/^\//, "")
    .normalize("NFC")
    .toLocaleLowerCase();
}

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "page";
}

export function routeForMarkdown(relativePath: string): string {
  const parsed = path.posix.parse(toPosix(relativePath));
  const directory = parsed.dir
    .split("/")
    .filter(Boolean)
    .map(slugify);
  const isLandingPage = ["home", "index", "readme"].includes(
    parsed.name.toLocaleLowerCase(),
  );
  return [...directory, ...(isLandingPage ? [] : [slugify(parsed.name)])].join("/");
}

export function regularRouteForMarkdown(relativePath: string): string {
  const parsed = path.posix.parse(toPosix(relativePath));
  return [
    ...parsed.dir.split("/").filter(Boolean).map(slugify),
    slugify(parsed.name),
  ].join("/");
}

export function normalizeBasePath(value = "/"): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

export function encodeUrlPath(value: string): string {
  return value
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function pageUrl(route: string, basePath = ""): string {
  const encodedRoute = encodeUrlPath(route);
  return `${basePath}/${encodedRoute}${encodedRoute ? "/" : ""}`;
}

export function assetUrl(relativePath: string, basePath = ""): string {
  return `${basePath}/assets/content/${encodeUrlPath(toPosix(relativePath))}`;
}

export function stripMarkdownExtension(value: string): string {
  return value.replace(/\.md$/i, "");
}

export function basenameWithoutExtension(value: string): string {
  return path.posix.basename(stripMarkdownExtension(toPosix(value)));
}

export function safeDecodeUri(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}
