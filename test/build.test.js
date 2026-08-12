import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildSite } from "../dist/builder.js";

async function temporaryVault() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mdpublish-test-"));
  const input = path.join(root, "vault");
  const output = path.join(root, "site");
  await fs.mkdir(path.join(input, "Guides"), { recursive: true });
  await fs.mkdir(path.join(input, "attachments"), { recursive: true });
  await fs.writeFile(
    path.join(input, "Home.md"),
    [
      "---",
      "title: Test Home",
      "---",
      "",
      "# Article introduction",
      "",
      "Read [[Guides/Start|the guide]].",
      "",
      "> [!success] It works",
      "> The build passed.",
      "",
      "> [!tip] Title only",
      "",
      "Inline math: $E = mc^2$",
      "",
      "$$",
      "\\int_0^1 x^2 \\, dx = \\frac{1}{3}",
      "$$",
      "",
      "```js",
      "const published = true;",
      "```",
      "",
      "```mermaid",
      "flowchart LR",
      "  A --> B",
      "```",
      "",
      "| Item | Details |",
      "| --- | --- |",
      "| First | one<br>two |",
      "",
      "Outside<br>HTML",
      "",
      "- Parent item",
      "  - Nested item",
      "- Sibling item",
      "",
      "![[picture.svg|320]]",
      "",
    ].join("\n"),
  );
  await fs.writeFile(
    path.join(input, "Guides", "Start.md"),
    "# Start\n\n## Install it\n\n[Jump](#Install%20it) · [Home](../Home.md)\n\n![Picture](../attachments/picture.svg)\n",
  );
  await fs.writeFile(path.join(input, "attachments", "picture.svg"), "<svg/>");
  return { root, input, output };
}

test("builds pages, navigation, wikilinks, headings, and images", async (context) => {
  const fixture = await temporaryVault();
  context.after(() => fs.rm(fixture.root, { recursive: true, force: true }));

  const result = await buildSite({
    inputDir: fixture.input,
    outputDir: fixture.output,
    title: "Test Notes",
    basePath: "/notes/",
  });
  assert.equal(result.pages, 2);
  assert.equal(result.assets, 1);
  assert.deepEqual(result.warnings, []);

  const home = await fs.readFile(path.join(fixture.output, "index.html"), "utf8");
  const guide = await fs.readFile(
    path.join(fixture.output, "guides", "start", "index.html"),
    "utf8",
  );
  assert.match(home, /href="\/notes\/guides\/start\/">the guide<\/a>/);
  assert.match(home, /src="\/notes\/assets\/content\/attachments\/picture\.svg"/);
  assert.match(home, /<h1 class="page-title">Test Home<\/h1>/);
  assert.match(home, /<h1 id="article-introduction">Article introduction<\/h1>/);
  assert.match(home, /class="callout callout-success callout-has-content"/);
  assert.match(home, /<span>It works<\/span>/);
  assert.match(home, /The build passed/);
  assert.equal(home.match(/The build passed/g)?.length, 1);
  assert.match(
    home,
    /class="callout callout-tip callout-title-only"[^]*?<span>Title only<\/span><\/div><\/aside>/,
  );
  assert.match(home, /class="hljs language-js"/);
  assert.match(home, /class="hljs-keyword">const<\/span>/);
  assert.match(home, /class="katex"/);
  assert.match(home, /<div class="mermaid">flowchart LR/);
  assert.match(home, /src="\/notes\/assets\/mermaid\.min\.js"/);
  assert.match(home, /<td>one<br>\s*two<\/td>/);
  assert.match(home, /Outside&lt;br&gt;HTML/);
  assert.match(guide, /href="#install-it">Install it<\/a>/);
  assert.match(guide, /href="#install-it">Jump<\/a>/);
  assert.match(guide, /id="install-it"/);
  assert.match(guide, /<h1 class="page-title">Start<\/h1>/);
  assert.match(guide, /href="\/notes\/"/);
  assert.match(guide, /alt="Picture"/);
  assert.doesNotMatch(guide, /mermaid\.min\.js/);
  await fs.access(path.join(fixture.output, "assets", "content", "attachments", "picture.svg"));
  await fs.access(path.join(fixture.output, "assets", "katex.min.css"));
  await fs.access(path.join(fixture.output, "assets", "fonts", "KaTeX_Main-Regular.woff2"));
  await fs.access(path.join(fixture.output, "assets", "mermaid.min.js"));
  const stylesheet = await fs.readFile(
    path.join(fixture.output, "assets", "mdpublish.css"),
    "utf8",
  );
  assert.match(stylesheet, /@media \(max-width: 1000px\)[^]*?\.site-sidebar[^]*?translateX\(-105%\)/);
  assert.match(stylesheet, /@media \(max-width: 720px\)[^]*?\.page-toc[^]*?order: -1/);
  assert.doesNotMatch(stylesheet, /\.page-toc\s*\{\s*display:\s*none/);
  assert.match(
    stylesheet,
    /\.page li > ul, \.page li > ol \{ margin-top: 0; margin-bottom: 0; \}/,
  );
  assert.match(
    stylesheet,
    /\.page h1:not\(\.page-title\), \.page h2, \.page h3, \.page h4 \{[^}]*border-bottom: 1px solid var\(--border\)/,
  );
});

test("reports unresolved and ambiguous wikilinks", async (context) => {
  const fixture = await temporaryVault();
  context.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  await fs.mkdir(path.join(fixture.input, "Other"));
  await fs.writeFile(path.join(fixture.input, "Other", "Start.md"), "# Another start\n");
  await fs.appendFile(path.join(fixture.input, "Home.md"), "\n[[Start]] and [[Missing]]\n");

  const result = await buildSite({ inputDir: fixture.input, outputDir: fixture.output });
  assert.equal(result.warnings.length, 2);
  assert.ok(result.warnings.some((warning) => warning.includes("Ambiguous page link")));
  assert.ok(result.warnings.some((warning) => warning.includes("Missing page link")));
});

test("builds navigation from configured pages and folders", async (context) => {
  const fixture = await temporaryVault();
  context.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  await fs.writeFile(path.join(fixture.input, "Outside.md"), "# Outside Page\n");
  await fs.writeFile(
    path.join(fixture.input, "Guides", "Internal.md"),
    "---\nnav: false\n---\n\n# Internal Page\n",
  );
  await fs.mkdir(path.join(fixture.input, "Guides", "Nested"));
  await fs.writeFile(
    path.join(fixture.input, "Guides", "Nested", "Deep.md"),
    "# Deep Page\n",
  );
  await fs.writeFile(
    path.join(fixture.input, "mdpublish.config.json"),
    JSON.stringify({
      navigation: [
        { path: "Guides/", label: "Manual" },
        { path: "Home.md", label: "Start here" },
        "Missing",
      ],
    }),
  );

  const result = await buildSite({ inputDir: fixture.input, outputDir: fixture.output });
  assert.equal(result.pages, 5);
  assert.equal(result.assets, 1);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Navigation entry “Missing”/);

  const home = await fs.readFile(path.join(fixture.output, "index.html"), "utf8");
  assert.match(home, /<summary>Manual<\/summary>/);
  assert.match(home, /<details><summary>Manual<\/summary>/);
  assert.match(home, /<details><summary>Nested<\/summary>/);
  assert.match(home, />Start here<\/a>/);
  assert.doesNotMatch(home, />Outside Page<\/a>/);
  assert.doesNotMatch(home, />Internal Page<\/a>/);
  assert.ok(home.indexOf("<summary>Manual") < home.indexOf(">Start here"));
  await fs.access(path.join(fixture.output, "outside", "index.html"));
  await assert.rejects(fs.access(path.join(fixture.output, "assets", "content", "mdpublish.config.json")));

  const deep = await fs.readFile(
    path.join(fixture.output, "guides", "nested", "deep", "index.html"),
    "utf8",
  );
  assert.match(deep, /<details open><summary>Manual<\/summary>/);
  assert.match(deep, /<details open><summary>Nested<\/summary>/);
});

test("uses a configured page as the welcome page", async (context) => {
  const fixture = await temporaryVault();
  context.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  await fs.writeFile(
    path.join(fixture.input, "mdpublish.config.json"),
    JSON.stringify({
      title: "Configured Notes",
      welcome: "Guides/Start.md",
    }),
  );

  const result = await buildSite({ inputDir: fixture.input, outputDir: fixture.output });
  assert.deepEqual(result.warnings, []);
  const welcome = await fs.readFile(path.join(fixture.output, "index.html"), "utf8");
  const formerHome = await fs.readFile(
    path.join(fixture.output, "home", "index.html"),
    "utf8",
  );
  assert.match(welcome, /<h1 class="page-title">Start<\/h1>/);
  assert.match(welcome, /<title>Start · Configured Notes<\/title>/);
  assert.match(welcome, />Configured Notes<\/a>/);
  assert.match(welcome, /href="\/home\/">Home<\/a>/);
  assert.match(formerHome, /<h1 class="page-title">Test Home<\/h1>/);
  assert.match(formerHome, /href="\/">the guide<\/a>/);
  await assert.rejects(
    fs.access(path.join(fixture.output, "guides", "start", "index.html")),
  );
});
