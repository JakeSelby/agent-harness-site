/** Escape a plain-text docstring paragraph for HTML, then honour its backtick spans as <code>. */
export function inlineCode(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}
