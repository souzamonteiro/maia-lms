import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

function escapeText(text: string): string {
  return text.replace(
    /[&<>"']/g,
    ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );
}
// Raw HTML is literal text, even if it is an otherwise allowed HTML tag.
const markdown = new Marked({
  gfm: true,
  async: false,
  renderer: { html: token => escapeText(token.text) },
});
export function renderContent(body: string, format: 'plain' | 'markdown'): string {
  if (format === 'plain') return `<div class="plain-content">${escapeText(body)}</div>`;
  return sanitizeHtml(markdown.parse(body, { async: false }), {
    allowedTags: [
      'p',
      'br',
      'hr',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'strong',
      'em',
      'del',
      'blockquote',
      'ul',
      'ol',
      'li',
      'pre',
      'code',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title', 'loading'],
      ol: ['start'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    transformTags: { img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }) },
    // Only same-origin images: no tracking or arbitrary remote requests in lessons.
    exclusiveFilter: frame =>
      frame.tag === 'img' &&
      (!frame.attribs.src?.startsWith('/') ||
        frame.attribs.src.startsWith('//') ||
        frame.attribs.src.includes('\\')),
  });
}
