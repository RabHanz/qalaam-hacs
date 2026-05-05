/**
 * Minimal allowlist HTML sanitizer for trusted-source-but-formatted text
 * (tafsirs, translations with footnotes). No DOM dependency — runs the
 * same in SSR and CSR. Allows a small whitelist of inline + block tags
 * common in scholarly tafsir; strips everything else, including event
 * handlers, javascript: URLs, scripts, iframes, etc.
 *
 * For richer needs, swap to DOMPurify. For tafsirs from QUL/Quran.com
 * (curated, public-domain or licensed) the allowlist is sufficient.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'span',
  'div',
  'em',
  'i',
  'strong',
  'b',
  'u',
  'sub',
  'sup',
  'small',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'q',
  'cite',
  'mark',
  'h3',
  'h4',
  'h5',
]);

// Attributes we keep — direction/lang are critical for Arabic/RTL,
// class is needed for `qpc-hafs` Quran-text span styling, href on <a>
// is allowed but http(s)/mailto only.
const ALLOWED_ATTRS = new Set(['class', 'dir', 'lang', 'href', 'title', 'data-verse', 'data-ayah']);

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('http:') ||
    trimmed.startsWith('https:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#')
  );
}

/**
 * Strip disallowed tags + attributes. Operates on the raw HTML string
 * via regex — fine for our tafsir source; not a general-purpose
 * sanitizer.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  // Drop script/style blocks entirely (inc. their content).
  let s = input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  // Drop iframe/object/embed/link/meta tags entirely.
  s = s.replace(/<\/?(iframe|object|embed|link|meta|form|input|button|svg|math)\b[^>]*>/gi, '');
  // Tag-by-tag walk.
  s = s.replace(
    /<(\/?)([a-zA-Z0-9-]+)([^>]*)>/g,
    (_match, slash: string, name: string, attrs: string) => {
      const tag = name.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        return ''; // strip the tag, keep inner text
      }
      if (slash === '/') return `</${tag}>`;
      // Sanitize attributes.
      const cleaned: string[] = [];
      const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let m: RegExpExecArray | null;
      while ((m = attrRe.exec(attrs)) !== null) {
        const attrName = m[1]?.toLowerCase() ?? '';
        const value = m[2] ?? m[3] ?? m[4] ?? '';
        // Block ALL on* event handlers and style.
        if (attrName.startsWith('on') || attrName === 'style') continue;
        if (!ALLOWED_ATTRS.has(attrName)) continue;
        if (attrName === 'href' && !isSafeUrl(value)) continue;
        // Re-emit, escape quotes in value.
        const escaped = value.replace(/"/g, '&quot;');
        cleaned.push(`${attrName}="${escaped}"`);
      }
      return `<${tag}${cleaned.length > 0 ? ' ' + cleaned.join(' ') : ''}>`;
    },
  );
  return s;
}
