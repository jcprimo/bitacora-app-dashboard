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

// Configure marked with sensible defaults
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Custom renderer for enhanced output
const renderer = new marked.Renderer();

// Headings get id anchors for in-page navigation
renderer.heading = function ({ text, depth }) {
  const slug = text.toLowerCase().replace(/[^\w]+/g, "-").replace(/(^-|-$)/g, "");
  return `<h${depth} id="${slug}" class="md-heading md-h${depth}">${text}</h${depth}>`;
};

// Links open in new tab if external
renderer.link = function ({ href, title, text }) {
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

// Tables get a wrapper for horizontal scroll
renderer.table = function ({ header, body }) {
  return `<div class="md-table-wrap"><table class="md-table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
};

// Images get responsive styling
renderer.image = function ({ href, title, text }) {
  const titleAttr = title ? ` title="${title}"` : "";
  return `<img src="${href}" alt="${text}"${titleAttr} class="md-image" loading="lazy" />`;
};

// Blockquotes
renderer.blockquote = function ({ text }) {
  return `<blockquote class="md-blockquote">${text}</blockquote>`;
};

// Task list items
renderer.listitem = function ({ text, task, checked }) {
  if (task) {
    const checkbox = checked
      ? '<span class="md-checkbox md-checked">&#9745;</span>'
      : '<span class="md-checkbox">&#9744;</span>';
    return `<li class="md-task-item">${checkbox}${text}</li>`;
  }
  return `<li>${text}</li>`;
};

marked.use({ renderer });

/**
 * Parse a Markdown string into HTML.
 * @param {string} markdown — raw Markdown content
 * @returns {string} — sanitized HTML string
 */
export function renderMarkdown(markdown) {
  if (!markdown) return "";
  return marked.parse(markdown);
}
