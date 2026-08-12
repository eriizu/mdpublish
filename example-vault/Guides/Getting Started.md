---
order: 1
---

# Getting Started

Run the builder against a folder containing Markdown files.

```sh
mdpublish build ./notes --out ./site
```

```ts
const output = await buildSite({ inputDir: "notes", outputDir: "site" });
```

## Linking notes

Use `[[Publishing]]` or a normal [Markdown link](Publishing.md). Both point to
the generated page.

## Images

Normal Markdown images are copied and rewritten:

![A folder becoming a website](../attachments/diagram.svg)

[Back home](../Home.md)
