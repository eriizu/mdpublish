---
title: Field Notes
order: 1
---

# Welcome to the vault

This small vault demonstrates links, attachments, and generated navigation.

Start with [[Guides/Getting Started|the getting-started guide]], then see the
[[Guides/Publishing]].

## An embedded image

The image below uses Obsidian's embed syntax and a width hint.

![[diagram.svg|640]]

## Ordinary Markdown

An [ordinary Markdown link](Guides/Publishing.md) is rewritten too.

## Callouts

> [!tip] Keep notes connected
> Wikilinks are resolved before the site is generated.

> [!success]
> This note was turned into a static page.

## Math and diagrams

Inline math such as $E = mc^2$ and display equations are rendered with KaTeX:

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

Mermaid code fences become diagrams:

```mermaid
flowchart LR
  Vault[Markdown vault] --> Build[mdpublish]
  Build --> Site[Static site]
```
