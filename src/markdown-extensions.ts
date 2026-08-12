import hljs from "highlight.js";
import katex from "katex";
import type MarkdownIt from "markdown-it";
import Token from "markdown-it/lib/token.mjs";

interface CalloutMeta {
  type: string;
  title: string;
  icon: string;
  hasContent: boolean;
}

const CALLOUT_ICONS: Record<string, string> = {
  note: "✎",
  abstract: "≡",
  summary: "≡",
  tldr: "≡",
  info: "i",
  todo: "☐",
  tip: "◆",
  hint: "◆",
  important: "◆",
  success: "✓",
  check: "✓",
  done: "✓",
  question: "?",
  help: "?",
  faq: "?",
  warning: "!",
  caution: "!",
  attention: "!",
  failure: "×",
  fail: "×",
  missing: "×",
  danger: "!",
  error: "!",
  bug: "♟",
  example: "◇",
  quote: "“",
  cite: "“",
};

function defaultCalloutTitle(type: string): string {
  return type.charAt(0).toLocaleUpperCase() + type.slice(1).replaceAll("-", " ");
}

export function installCallouts(markdown: MarkdownIt): void {
  markdown.core.ruler.after("block", "obsidian-callouts", (state) => {
    const tokens = state.tokens;
    for (let index = 0; index < tokens.length; index += 1) {
      const opening = tokens[index]!;
      if (opening.type !== "blockquote_open") continue;

      let depth = 0;
      let closingIndex = -1;
      let inlineIndex = -1;
      for (let cursor = index; cursor < tokens.length; cursor += 1) {
        const token = tokens[cursor]!;
        if (token.type === "blockquote_open") depth += 1;
        if (depth === 1 && inlineIndex < 0 && token.type === "inline") inlineIndex = cursor;
        if (token.type === "blockquote_close") {
          depth -= 1;
          if (depth === 0) {
            closingIndex = cursor;
            break;
          }
        }
      }
      if (inlineIndex < 0 || closingIndex < 0) continue;

      const inline = tokens[inlineIndex]!;
      const marker = inline.content.match(/^\[!([a-z][a-z\d-]*)\](?:[+-])?(?:[ \t]+([^\n]*))?(?:\n|$)/i);
      if (!marker) continue;
      const type = marker[1]!.toLocaleLowerCase();
      const meta: CalloutMeta = {
        type,
        title: marker[2]?.trim() || defaultCalloutTitle(type),
        icon: CALLOUT_ICONS[type] ?? "•",
        hasContent: false,
      };
      inline.content = inline.content.slice(marker[0].length);
      inline.children = [];

      const contentTokenTypes = new Set([
        "blockquote_open",
        "bullet_list_open",
        "code_block",
        "fence",
        "hr",
        "math_block",
        "ordered_list_open",
        "table_open",
      ]);
      meta.hasContent =
        inline.content.trim().length > 0 ||
        tokens.slice(inlineIndex + 1, closingIndex).some(
          (token) =>
            (token.type === "inline" && token.content.trim().length > 0) ||
            contentTokenTypes.has(token.type),
        );

      if (!inline.content.trim()) {
        inline.hidden = true;
        if (tokens[inlineIndex - 1]?.type === "paragraph_open") {
          tokens[inlineIndex - 1]!.hidden = true;
        }
        if (tokens[inlineIndex + 1]?.type === "paragraph_close") {
          tokens[inlineIndex + 1]!.hidden = true;
        }
      }
      opening.meta = { ...(opening.meta ?? {}), callout: meta };
      tokens[closingIndex]!.meta = {
        ...(tokens[closingIndex]!.meta ?? {}),
        callout: meta,
      };
    }
  });

  const defaultOpen = markdown.renderer.rules.blockquote_open;
  const defaultClose = markdown.renderer.rules.blockquote_close;
  markdown.renderer.rules.blockquote_open = (tokens, index, options, env, self) => {
    const callout = (tokens[index]!.meta as { callout?: CalloutMeta } | null)?.callout;
    if (!callout) {
      return defaultOpen
        ? defaultOpen(tokens, index, options, env, self)
        : self.renderToken(tokens, index, options);
    }
    const contentClass = callout.hasContent ? " callout-has-content" : " callout-title-only";
    const contentOpening = callout.hasContent ? '<div class="callout-content">' : "";
    return `<aside class="callout callout-${markdown.utils.escapeHtml(callout.type)}${contentClass}"><div class="callout-title"><span class="callout-icon" aria-hidden="true">${markdown.utils.escapeHtml(callout.icon)}</span><span>${markdown.utils.escapeHtml(callout.title)}</span></div>${contentOpening}`;
  };
  markdown.renderer.rules.blockquote_close = (tokens, index, options, env, self) => {
    const callout = (tokens[index]!.meta as { callout?: CalloutMeta } | null)?.callout;
    if (callout) return `${callout.hasContent ? "</div>" : ""}</aside>\n`;
    return defaultClose
      ? defaultClose(tokens, index, options, env, self)
      : self.renderToken(tokens, index, options);
  };
}

export function highlightCode(source: string, language: string): string {
  const requestedLanguage = language.trim().split(/\s+/)[0]?.toLocaleLowerCase() ?? "";
  let highlighted: string;
  if (requestedLanguage && hljs.getLanguage(requestedLanguage)) {
    highlighted = hljs.highlight(source, {
      language: requestedLanguage,
      ignoreIllegals: true,
    }).value;
  } else {
    highlighted = hljs.highlightAuto(source).value;
  }
  const languageClass = requestedLanguage
    ? ` language-${requestedLanguage.replace(/[^a-z\d_-]/g, "")}`
    : "";
  return `<pre><code class="hljs${languageClass}">${highlighted}</code></pre>`;
}

function renderMath(source: string, displayMode: boolean): string {
  return katex.renderToString(source, {
    displayMode,
    throwOnError: false,
    trust: false,
    strict: "warn",
  });
}

export function installMath(markdown: MarkdownIt): void {
  markdown.inline.ruler.after("escape", "math-inline", (state, silent) => {
    if (state.src[state.pos] !== "$" || state.src[state.pos + 1] === "$") return false;
    if (/\s/.test(state.src[state.pos + 1] ?? "")) return false;
    let end = state.pos + 1;
    while ((end = state.src.indexOf("$", end)) >= 0) {
      if (state.src[end - 1] !== "\\") break;
      end += 1;
    }
    if (end < 0 || end >= state.posMax || /\s/.test(state.src[end - 1] ?? "")) return false;
    if (!silent) {
      const token = state.push("math_inline", "math", 0);
      token.content = state.src.slice(state.pos + 1, end).replace(/\\\$/g, "$");
      token.markup = "$";
    }
    state.pos = end + 1;
    return true;
  });

  markdown.block.ruler.before("fence", "math-block", (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine]! + state.tShift[startLine]!;
    const end = state.eMarks[startLine]!;
    const openingLine = state.src.slice(start, end);
    if (!openingLine.startsWith("$$")) return false;

    const firstContent = openingLine.slice(2);
    const sameLineEnd = firstContent.indexOf("$$");
    let content = "";
    let nextLine = startLine + 1;
    if (sameLineEnd >= 0) {
      content = firstContent.slice(0, sameLineEnd);
    } else {
      const lines = [firstContent];
      let foundClosing = false;
      for (; nextLine < endLine; nextLine += 1) {
        const lineStart = state.bMarks[nextLine]! + state.tShift[nextLine]!;
        const lineEnd = state.eMarks[nextLine]!;
        const line = state.src.slice(lineStart, lineEnd);
        const closing = line.indexOf("$$");
        if (closing >= 0) {
          lines.push(line.slice(0, closing));
          foundClosing = true;
          nextLine += 1;
          break;
        }
        lines.push(line);
      }
      if (!foundClosing) return false;
      content = lines.join("\n");
    }
    if (silent) return true;
    const token = state.push("math_block", "math", 0);
    token.block = true;
    token.content = content.trim();
    token.map = [startLine, nextLine];
    token.markup = "$$";
    state.line = nextLine;
    return true;
  });

  markdown.renderer.rules.math_inline = (tokens, index) =>
    `<span class="math-inline">${renderMath(tokens[index]!.content, false)}</span>`;
  markdown.renderer.rules.math_block = (tokens, index) =>
    `<div class="math-block">${renderMath(tokens[index]!.content, true)}</div>\n`;
}

export function installMermaid(markdown: MarkdownIt): void {
  const defaultFence = markdown.renderer.rules.fence;
  markdown.renderer.rules.fence = (tokens, index, options, env, self) => {
    const token = tokens[index]!;
    const language = token.info.trim().split(/\s+/)[0]?.toLocaleLowerCase();
    if (language === "mermaid") {
      return `<div class="mermaid">${markdown.utils.escapeHtml(token.content)}</div>\n`;
    }
    return defaultFence
      ? defaultFence(tokens, index, options, env, self)
      : self.renderToken(tokens, index, options);
  };
}

export function installTableLineBreaks(markdown: MarkdownIt): void {
  markdown.core.ruler.after("inline", "table-line-breaks", (state) => {
    let tableDepth = 0;
    for (const token of state.tokens) {
      if (token.type === "table_open") tableDepth += 1;
      if (token.type === "table_close") {
        tableDepth -= 1;
        continue;
      }
      if (!tableDepth || token.type !== "inline" || !token.children) continue;

      const children: Token[] = [];
      for (const child of token.children) {
        if (child.type !== "text" || !/<br\s*\/?>/i.test(child.content)) {
          children.push(child);
          continue;
        }
        const parts = child.content.split(/(<br\s*\/?>)/gi);
        for (const part of parts) {
          if (!part) continue;
          if (/^<br\s*\/?>$/i.test(part)) {
            const lineBreak = new Token("hardbreak", "br", 0);
            lineBreak.level = child.level;
            children.push(lineBreak);
          } else {
            const text = new Token("text", "", 0);
            text.content = part;
            text.level = child.level;
            children.push(text);
          }
        }
      }
      token.children = children;
    }
  });
}
