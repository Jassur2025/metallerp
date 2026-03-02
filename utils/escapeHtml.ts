/**
 * HTML escape utility — prevents stored XSS in innerHTML contexts
 * (e.g., PDF/receipt generation via html2canvas).
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape a string for safe insertion into innerHTML.
 * Replaces &, <, >, ", ' with their HTML entity equivalents.
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
}
