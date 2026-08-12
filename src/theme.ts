export const THEME_CSS = `
:root {
  color-scheme: light dark;
  --background: #fbfaf7;
  --sidebar: #f2f0e9;
  --surface: #ffffff;
  --text: #292821;
  --muted: #716f65;
  --border: #dedbd0;
  --accent: #6d4aff;
  --accent-soft: #eee9ff;
  --code: #f0eee7;
  --content-width: 760px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--background); color: var(--text); line-height: 1.65; }
a { color: var(--accent); text-decoration-thickness: .08em; text-underline-offset: .18em; }
a:hover { text-decoration-thickness: .14em; }

.site-sidebar {
  position: fixed; inset: 0 auto 0 0; width: 280px; overflow-y: auto;
  padding: 28px 20px; background: var(--sidebar); border-right: 1px solid var(--border);
}
.site-name { display: block; margin: 0 8px 24px; color: var(--text); font-size: 1.05rem; font-weight: 750; text-decoration: none; }
.site-nav ul { margin: 0; padding: 0; list-style: none; }
.site-nav ul ul { margin: 4px 0 10px 12px; padding-left: 11px; border-left: 1px solid var(--border); }
.site-nav a { display: block; padding: 5px 8px; border-radius: 7px; color: var(--muted); font-size: .92rem; text-decoration: none; }
.site-nav a:hover { color: var(--text); background: color-mix(in srgb, var(--surface) 70%, transparent); }
.site-nav a[aria-current="page"] { color: var(--accent); background: var(--accent-soft); font-weight: 650; }
.site-nav details > summary { padding: 5px 8px; color: var(--muted); cursor: pointer; font-size: .8rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }

.layout { min-height: 100vh; margin-left: 280px; padding: 56px clamp(28px, 5vw, 80px) 96px; }
.content-grid { display: grid; grid-template-columns: minmax(0, var(--content-width)) 190px; justify-content: center; gap: clamp(42px, 6vw, 80px); }
.page { min-width: 0; }
.page-header { margin-bottom: 2.5rem; }
.page .page-title { margin: 0; font-size: clamp(1.65rem, 3.5vw, 2.35rem); line-height: 1.12; letter-spacing: -.025em; }
.page h1:not(.page-title), .page h2, .page h3, .page h4 { margin-bottom: .6em; padding-bottom: .28em; scroll-margin-top: 28px; border-bottom: 1px solid var(--border); line-height: 1.25; letter-spacing: -.018em; }
.page h1:not(.page-title) { margin: 1.55em 0 .6em; font-size: 1.9rem; }
.page h2 { margin-top: 1.55em; font-size: 1.65rem; }
.page h3 { margin-top: 1.4em; font-size: 1.25rem; }
.page h4 { margin-top: 1.4em; }
.page p, .page ul, .page ol, .page blockquote { margin: 1.1em 0; }
.page li > ul, .page li > ol { margin-top: 0; margin-bottom: 0; }
.page img { display: block; max-width: 100%; height: auto; margin: 1.6rem 0; border-radius: 10px; }
.page blockquote { margin-left: 0; padding: .15rem 1rem; color: var(--muted); border-left: 3px solid var(--accent); }
.page pre { overflow-x: auto; padding: 18px; border-radius: 10px; background: var(--code); line-height: 1.5; }
.page code { padding: .15em .34em; border-radius: 4px; background: var(--code); font: .88em ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.page pre code { padding: 0; background: transparent; }
.page table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
.page th, .page td { padding: .28rem .5rem; border: 1px solid var(--border); }
.page hr { margin: 3rem 0; border: 0; border-top: 1px solid var(--border); }
.broken-link, .broken-embed { color: #b83232; text-decoration-style: wavy; }
.broken-embed { display: inline-block; padding: .2rem .5rem; border: 1px dashed currentColor; border-radius: 5px; }

.callout { --callout-color: #4f75c7; margin: 1.5rem 0; overflow: hidden; border: 1px solid color-mix(in srgb, var(--callout-color) 48%, var(--border)); border-left: 4px solid var(--callout-color); border-radius: 9px; background: color-mix(in srgb, var(--callout-color) 9%, var(--surface)); }
.callout-title { display: flex; align-items: center; gap: 9px; padding: 10px 14px; color: var(--callout-color); font-size: .9rem; font-weight: 750; background: color-mix(in srgb, var(--callout-color) 10%, transparent); }
.callout-title-only { background: transparent; }
.callout-icon { display: inline-grid; flex: 0 0 20px; place-items: center; width: 20px; height: 20px; border: 1.5px solid currentColor; border-radius: 50%; font-size: .72rem; line-height: 1; }
.callout-content { padding: 3px 14px 8px; }
.callout-content > :first-child { margin-top: .65rem; }
.callout-content > :last-child { margin-bottom: .65rem; }
.callout-tip, .callout-hint, .callout-important { --callout-color: #7a55d9; }
.callout-success, .callout-check, .callout-done { --callout-color: #27845b; }
.callout-question, .callout-help, .callout-faq, .callout-warning, .callout-caution, .callout-attention { --callout-color: #b77918; }
.callout-failure, .callout-fail, .callout-missing, .callout-danger, .callout-error, .callout-bug { --callout-color: #c54444; }
.callout-example { --callout-color: #7c58b3; }
.callout-quote, .callout-cite { --callout-color: var(--muted); }

.hljs { color: #24292f; }
.hljs-comment, .hljs-quote { color: #6e7781; font-style: italic; }
.hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-type { color: #cf222e; }
.hljs-string, .hljs-regexp, .hljs-attribute { color: #0a3069; }
.hljs-title, .hljs-title.function_, .hljs-section { color: #8250df; }
.hljs-number, .hljs-symbol, .hljs-variable, .hljs-template-variable { color: #0550ae; }
.hljs-built_in, .hljs-meta { color: #953800; }
.hljs-addition { color: #116329; background: #dafbe1; }
.hljs-deletion { color: #82071e; background: #ffebe9; }

.math-inline { white-space: nowrap; }
.math-block { max-width: 100%; margin: 1.7rem 0; overflow-x: auto; overflow-y: hidden; padding: .5rem 0; text-align: center; }
.mermaid { max-width: 100%; margin: 1.8rem auto; overflow-x: auto; text-align: center; }
.mermaid svg { max-width: 100%; height: auto; }

.page-toc { position: sticky; top: 32px; align-self: start; max-height: calc(100vh - 64px); overflow-y: auto; }
.page-toc-title { margin: 0 0 10px; color: var(--muted); font-size: .72rem; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.page-toc ol { margin: 0; padding: 0; list-style: none; }
.page-toc a { display: block; padding: 3px 0; color: var(--muted); font-size: .78rem; line-height: 1.35; text-decoration: none; }
.page-toc a:hover { color: var(--accent); }
.page-toc .level-2 { padding-left: 12px; }
.page-toc .level-3 { padding-left: 24px; }
.page-toc .level-4 { padding-left: 36px; }
.page-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; padding: 0; list-style: none; }
.page-list a { display: block; height: 100%; padding: 16px 18px; color: var(--text); font-weight: 650; text-decoration: none; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
.page-list a:hover { border-color: var(--accent); }
.nav-toggle { display: none; }

@media (prefers-color-scheme: dark) {
  :root { --background: #171715; --sidebar: #1e1e1b; --surface: #23231f; --text: #eeece4; --muted: #aaa79d; --border: #363630; --accent: #ad9aff; --accent-soft: #302951; --code: #262621; }
  .hljs { color: #c9d1d9; }
  .hljs-comment, .hljs-quote { color: #8b949e; }
  .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-type { color: #ff7b72; }
  .hljs-string, .hljs-regexp, .hljs-attribute { color: #a5d6ff; }
  .hljs-title, .hljs-title.function_, .hljs-section { color: #d2a8ff; }
  .hljs-number, .hljs-symbol, .hljs-variable, .hljs-template-variable { color: #79c0ff; }
  .hljs-built_in, .hljs-meta { color: #ffa657; }
  .hljs-addition { color: #aff5b4; background: #033a16; }
  .hljs-deletion { color: #ffdcd7; background: #67060c; }
}

@media (max-width: 1000px) {
  .site-sidebar { z-index: 10; width: min(86vw, 320px); transform: translateX(-105%); transition: transform .2s ease; box-shadow: 10px 0 35px rgba(0,0,0,.18); }
  body.navigation-open .site-sidebar { transform: translateX(0); }
  .layout { margin-left: 0; padding: 82px 32px 96px; }
  .content-grid { grid-template-columns: minmax(0, var(--content-width)) minmax(150px, 190px); gap: clamp(28px, 5vw, 54px); }
  .nav-toggle { display: grid; position: fixed; z-index: 20; top: 16px; left: 16px; place-items: center; width: 42px; height: 42px; padding: 0; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 9px; box-shadow: 0 5px 20px rgba(0,0,0,.09); font-size: 1.2rem; cursor: pointer; }
}

@media (max-width: 720px) {
  .layout { padding: 82px 22px 64px; }
  .content-grid { grid-template-columns: minmax(0, var(--content-width)); gap: 28px; }
  .page-toc { position: static; order: -1; max-height: none; padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 9px; }
  .page-toc ol { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); column-gap: 18px; }
}
`;

export const CLIENT_JS = `
globalThis.mermaid?.initialize({
  startOnLoad: true,
  securityLevel: 'strict',
  theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default'
});
const toggle = document.querySelector('[data-navigation-toggle]');
toggle?.addEventListener('click', () => {
  const open = document.body.classList.toggle('navigation-open');
  toggle.setAttribute('aria-expanded', String(open));
});
document.querySelector('.site-nav a[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
`;

export const LIVE_RELOAD_JS = `
const events = new EventSource('/__mdpublish/events');
events.addEventListener('reload', () => location.reload());
`;
