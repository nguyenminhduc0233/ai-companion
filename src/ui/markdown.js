// Markdown rendering for the Text output mode (code, tables, checklists,
// markdown) — sanitized before insertion.
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

marked.setOptions({ breaks: true, gfm: true });

export function renderMarkdown(text) {
  const raw = marked.parse(text || '');
  return DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] });
}

export function highlightWithin(node) {
  node.querySelectorAll('pre code').forEach((block) => {
    try { hljs.highlightElement(block); } catch (_) {}
  });
  // External links open safely.
  node.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
}
