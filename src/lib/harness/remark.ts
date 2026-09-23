import fs from 'node:fs';
import path from 'node:path';
import { VENDOR } from './paths.ts';
import { isExternalHref, resolveRelative, routeForRepoPath } from './links.ts';

// Minimal mdast typing so these plugins carry no dependency of their own. The
// plugins take `unknown` and cast, which keeps them assignable to Astro's
// RemarkPlugin type without importing mdast.
export interface MdNode { type: string; value?: string; url?: string; depth?: number; children?: MdNode[] }
interface VFileLike { path?: string; data: { astro?: { frontmatter?: Record<string, unknown> } } }

type Transformer = (tree: unknown, file: unknown) => void;

/** Depth-first walk; a visitor may replace `parent.children[index]` in place or return 'skip'. */
function walk(node: MdNode, fn: (node: MdNode, parent: MdNode | null, index: number) => void | 'skip', parent: MdNode | null = null, index = 0): void {
  if (fn(node, parent, index) === 'skip' || !node.children) return;
  [...node.children].forEach((child, i) => walk(child, fn, node, i));
}

export function toText(node: MdNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(toText).join('');
}

const HTML_ALLOW = new Set(['a', 'abbr', 'b', 'br', 'code', 'details', 'div', 'em', 'hr', 'i', 'img', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul']);

/**
 * The harness writes placeholders like `<pref>` and `<v>` in running text. Markdown
 * parses them as raw HTML, and a browser drops unknown tags, so the word vanishes.
 * Turn any lone `<word>` that is not a real HTML element back into text.
 */
export function remarkEscapeAngle(): Transformer {
  return (tree) => {
    walk(tree as MdNode, (node) => {
      if (node.type !== 'html' || typeof node.value !== 'string') return;
      const m = node.value.trim().match(/^<\/?([A-Za-z][\w-]*)\s*\/?>$/);
      if (!m || HTML_ALLOW.has(m[1].toLowerCase())) return;
      node.type = 'text';
    });
  };
}

/**
 * Lift the document's first H1 into frontmatter.title and drop it from the body,
 * so a page renders its title once, in its own header.
 */
export function remarkLiftTitle(): Transformer {
  return (tree, file) => {
    const root = tree as MdNode;
    const f = file as VFileLike;
    const children = root.children ?? [];
    const i = children.findIndex((n) => n.type === 'heading' && n.depth === 1);
    if (i === -1) return;
    const title = toText(children[i]).trim();
    children.splice(i, 1);
    f.data.astro ??= {};
    f.data.astro.frontmatter ??= {};
    f.data.astro.frontmatter.title ??= title;
  };
}

function repoPathOf(file: VFileLike): string | null {
  if (!file.path) return null;
  const rel = path.relative(VENDOR, file.path);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

function readVersion(): string {
  try {
    return fs.readFileSync(path.join(VENDOR, 'VERSION'), 'utf8').trim();
  } catch {
    return 'main';
  }
}

const existsInVendor = (rel: string) => fs.existsSync(path.join(VENDOR, rel));

export interface LinkOptions { version?: string; exists?: (rel: string) => boolean; repoPath?: string }

/**
 * Rewrite relative links written for GitHub (`docs/how-it-works.md`, `../rules/x.md`)
 * to this site's routes, or to the file on GitHub when the site has no page for it.
 * A link to a file the harness does not carry (a quoted README's `TAGS.md`, say) has
 * nowhere to go, so it renders as its text.
 */
export function remarkHarnessLinks(options: LinkOptions = {}): Transformer {
  const exists = options.exists ?? existsInVendor;
  return (tree, file) => {
    const from = options.repoPath ?? repoPathOf(file as VFileLike);
    if (!from) return;
    const version = options.version ?? readVersion();
    walk(tree as MdNode, (node) => {
      if (node.type !== 'link' || typeof node.url !== 'string' || isExternalHref(node.url)) return;
      const resolved = resolveRelative(from, node.url);
      if (!resolved) return;
      const route = routeForRepoPath(resolved.rel, version, exists);
      if (route) {
        node.url = route + (route.includes('#') ? '' : resolved.suffix);
        return;
      }
      node.value = toText(node);
      node.type = 'text';
      delete node.url;
      delete node.children;
    });
  };
}

/**
 * Inline code that names a harness file (`docs/usage.md`, `claude/rules/secrets.md`)
 * becomes a link when the site has a page for it. Placeholders like `<pref>` and
 * paths that do not exist stay plain code.
 */
export function remarkCodeLinks(options: LinkOptions = {}): Transformer {
  const exists = options.exists ?? existsInVendor;
  return (tree) => {
    const version = options.version ?? readVersion();
    walk(tree as MdNode, (node, parent, index) => {
      if (node.type !== 'inlineCode' || !parent || typeof node.value !== 'string') return;
      if (parent.type === 'link' || parent.type === 'heading') return;
      const value = node.value;
      if (!/^(docs|claude)\/[\w./-]+$/.test(value)) return;
      if (!exists(value.replace(/\/$/, ''))) return;
      const route = routeForRepoPath(value, version, exists);
      if (!route) return;
      parent.children![index] = { type: 'link', url: route, children: [{ type: 'inlineCode', value }] };
      return 'skip';
    });
  };
}
