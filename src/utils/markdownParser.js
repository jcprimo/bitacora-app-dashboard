// ─── utils/markdownParser.js — Markdown Rendering Engine ─────────
// Wraps `marked` with custom options for clean, safe rendering.
// Produces sanitized HTML from Markdown strings.
//
// Features:
//   - GFM (tables, task lists, strikethrough)
//   - External links open in new tabs
//   - Code blocks with language labels
//   - Heading anchors for navigation
//   - No raw HTML pass-through (XSS safe)

import { marked } from "marked";
import DOMPurify from "dompurify";

// Configure marked with sensible defaults
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Custom renderer for enhanced output
const renderer = new marked.Renderer();

// Headings get id anchors for in-page navigation
renderer.heading = function ({ tokens, depth }) {
  const rendered = this.parser.parseInline(tokens);
  // Strip HTML tags for the slug
  const plain = rendered.replace(/<[^>]+>/g, "");
  const slug = plain.toLowerCase().replace(/[^\w]+/g, "-").replace(/(^-|-$)/g, "");
  return `<h${depth} id="${slug}" class="md-heading md-h${depth}">${rendered}</h${depth}>`;
};

// Links open in new tab if external
renderer.link = function ({ href, title, tokens }) {
  const text = this.parser.parseInline(tokens);
  const isExternal = href && (href.startsWith("http://") || href.startsWith("https://"));
  const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
  const titleAttr = title ? ` title="${title}"` : "";
  return `<a href="${href}"${titleAttr}${attrs} class="md-link">${text}</a>`;
};

// Code blocks get a language label
renderer.code = function ({ text, lang }) {
  const language = lang || "";
  const label = language ? `<span class="md-code-lang">${language}</span>` : "";
  const escaped = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div class="md-code-block">${label}<pre><code class="language-${language}">${escaped}</code></pre></div>`;
};

// Inline code
renderer.codespan = function ({ text }) {
  return `<code class="md-inline-code">${text}</code>`;
};

// Table: header and rows are arrays of token objects — iterate them
renderer.table = function (token) {
  // Render header row
  let headerHtml = "<tr>";
  for (const cell of token.header) {
    const align = cell.align ? ` style="text-align:${cell.align}"` : "";
    const content = this.parser.parseInline(cell.tokens);
    headerHtml += `<th${align}>${content}</th>`;
  }
  headerHtml += "</tr>";

  // Render body rows
  let bodyHtml = "";
  for (const row of token.rows) {
    bodyHtml += "<tr>";
    for (const cell of row) {
      const align = cell.align ? ` style="text-align:${cell.align}"` : "";
      const content = this.parser.parseInline(cell.tokens);
      bodyHtml += `<td${align}>${content}</td>`;
    }
    bodyHtml += "</tr>";
  }

  return `<div class="md-table-wrap"><table class="md-table"><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table></div>`;
};

// Images get responsive styling
renderer.image = function ({ href, title, text }) {
  const titleAttr = title ? ` title="${title}"` : "";
  return `<img src="${href}" alt="${text}"${titleAttr} class="md-image" loading="lazy" />`;
};

// Blockquotes
renderer.blockquote = function ({ tokens }) {
  const body = this.parser.parse(tokens);
  return `<blockquote class="md-blockquote">${body}</blockquote>`;
};

// Task list items
renderer.listitem = function ({ tokens, task, checked }) {
  const content = this.parser.parse(tokens);
  if (task) {
    const checkbox = checked
      ? '<span class="md-checkbox md-checked">&#9745;</span>'
      : '<span class="md-checkbox">&#9744;</span>';
    return `<li class="md-task-item">${checkbox}${content}</li>`;
  }
  return `<li>${content}</li>`;
};

marked.use({ renderer });

/**
 * Parse a Markdown string into HTML.
 * @param {string} markdown — raw Markdown content
 * @returns {string} — sanitized HTML string
 */
export function renderMarkdown(markdown) {
  if (!markdown) return "";
  const raw = marked.parse(markdown);
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    // Allow heading id anchors and the custom classes we set on elements
    ADD_ATTR: ["id", "target", "rel", "loading"],
  });
}
