import { pageUrl } from "./paths.js";
import type { Heading, NavigationItem, Page } from "./types.js";

interface PageTemplateOptions {
  siteTitle: string;
  basePath: string;
  pages: Page[];
  navigation: NavigationItem[];
  page?: Page;
  content: string;
  headings?: Heading[];
  liveReload?: boolean;
  usesMermaid?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderNavigation(
  items: NavigationItem[],
  activePage: Page | undefined,
  basePath: string,
  isRoot = false,
): string {
  const containsActivePage = (item: NavigationItem): boolean =>
    item.type === "page"
      ? item.page === activePage
      : item.children.some(containsActivePage);
  const content = items
    .map((item) => {
      if (item.type === "page") {
        return `<li><a href="${pageUrl(item.page.route, basePath)}"${item.page === activePage ? ' aria-current="page"' : ""}>${escapeHtml(item.label)}</a></li>`;
      }
      const open = containsActivePage(item) ? " open" : "";
      return `<li><details${open}><summary>${escapeHtml(item.label)}</summary>${renderNavigation(item.children, activePage, basePath)}</details></li>`;
    })
    .join("");
  return `<ul${isRoot ? ' class="navigation-root"' : ""}>${content}</ul>`;
}

function renderTableOfContents(headings: Heading[]): string {
  if (!headings.length) return "";
  return `<aside class="page-toc" aria-label="On this page">
    <p class="page-toc-title">On this page</p>
    <ol>${headings
      .map(
        (heading) =>
          `<li class="level-${heading.level}"><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a></li>`,
      )
      .join("")}</ol>
  </aside>`;
}

export function renderPageTemplate(options: PageTemplateOptions): string {
  const {
    siteTitle,
    basePath,
    pages,
    navigation,
    page,
    content,
    headings = [],
    liveReload = false,
    usesMermaid = false,
  } = options;
  const documentTitle = page ? `${page.title} · ${siteTitle}` : siteTitle;
  const homePage = pages.find((candidate) => candidate.route === "");
  const homeUrl = pageUrl(homePage?.route ?? "", basePath);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="mdpublish">
  <title>${escapeHtml(documentTitle)}</title>
  <link rel="stylesheet" href="${basePath}/assets/mdpublish.css">
  <link rel="stylesheet" href="${basePath}/assets/katex.min.css">
</head>
<body>
  <button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false" data-navigation-toggle>☰</button>
  <aside class="site-sidebar">
    <a class="site-name" href="${homeUrl}">${escapeHtml(siteTitle)}</a>
    <nav class="site-nav" aria-label="Site navigation">${renderNavigation(navigation, page, basePath, true)}</nav>
  </aside>
  <main class="layout">
    <div class="content-grid">
      <article class="page">${content}</article>
      ${renderTableOfContents(headings)}
    </div>
  </main>
  ${usesMermaid ? `<script src="${basePath}/assets/mermaid.min.js" defer></script>` : ""}
  <script src="${basePath}/assets/mdpublish.js" defer></script>
  ${liveReload ? '<script src="/__mdpublish/reload.js" defer></script>' : ""}
</body>
</html>`;
}

function navigationPages(items: NavigationItem[]): Array<{ page: Page; label: string }> {
  return items.flatMap((item) =>
    item.type === "page" ? [{ page: item.page, label: item.label }] : navigationPages(item.children),
  );
}

export function renderGeneratedLanding(
  navigation: NavigationItem[],
  basePath: string,
): string {
  return `<h1>Pages</h1>
<p>Select a page to start reading.</p>
<ul class="page-list">${navigationPages(navigation)
    .map(
      ({ page, label }) =>
        `<li><a href="${pageUrl(page.route, basePath)}">${escapeHtml(label)}</a></li>`,
    )
    .join("")}</ul>`;
}
