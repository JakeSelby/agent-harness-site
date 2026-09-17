import path from 'node:path';

/**
 * Map a repo-relative path inside agent-harness to a route on this site, or to the
 * file on GitHub when the site has no page for it. Returns null for paths that
 * resolve outside the repository, which the caller leaves untouched.
 */
export function routeForRepoPath(
  rel: string,
  version: string,
  exists: (rel: string) => boolean,
  repoUrl = 'https://github.com/JakeSelby/agent-harness',
): string | null {
  const p = rel.replace(/\\/g, '/').replace(/^\.\//, '');
  if (p.startsWith('../') || p === '..' || p === '') return null;

  let m: RegExpMatchArray | null;
  if ((m = p.match(/^docs\/([\w.-]+)\.md$/))) return `/docs/${m[1]}/`;
  if ((m = p.match(/^claude\/skills\/([\w-]+)\/SKILL\.md$/))) return `/skills/${m[1]}/`;
  if ((m = p.match(/^claude\/skills\/([\w-]+)\/?$/))) return `/skills/${m[1]}/`;
  if ((m = p.match(/^claude\/rules\/([\w-]+)\.md$/))) return `/rules/${m[1]}/`;
  if ((m = p.match(/^claude\/stances\/([\w-]+)\/([\w-]+)\.md$/))) return `/stances/${m[1]}/${m[2]}/`;
  if ((m = p.match(/^claude\/stances\/([\w-]+)\/?$/))) return `/stances/${m[1]}/`;
  if ((m = p.match(/^claude\/agents\/([\w-]+)\.md$/))) return `/agents/${m[1]}/`;
  if ((m = p.match(/^claude\/commands\/([\w-]+)\.md$/))) return `/commands/${m[1]}/`;
  if ((m = p.match(/^claude\/output-styles\/([\w-]+)\.md$/))) return `/output-styles/${m[1]}/`;
  if ((m = p.match(/^claude\/hooks\/([\w-]+)\.py$/))) return `/hooks/#${m[1]}`;
  if (p === 'CHANGELOG.md') return '/changelog/';
  if (p === 'CONTRIBUTING.md') return '/contributing/';
  if (p === 'README.md') return '/';
  if (p === 'claude/rules' || p === 'claude/rules/') return '/rules/';
  if (p === 'claude/skills' || p === 'claude/skills/') return '/skills/';
  if (p === 'claude/agents' || p === 'claude/agents/') return '/agents/';
  if (p === 'claude/commands' || p === 'claude/commands/') return '/commands/';
  if (p === 'claude/hooks' || p === 'claude/hooks/') return '/hooks/';
  if (p === 'claude/stances' || p === 'claude/stances/') return '/stances/';
  if (p === 'docs' || p === 'docs/') return '/docs/';

  if (exists(p)) return `${repoUrl}/blob/v${version}/${p}`;
  return null;
}

/**
 * Resolve an href written in a markdown file at `fromRepoPath` to a repo-relative path.
 * Strips the fragment and query; returns null when the target escapes the repo.
 */
export function resolveRelative(fromRepoPath: string, href: string): { rel: string; suffix: string } | null {
  const hashAt = href.search(/[#?]/);
  const target = hashAt === -1 ? href : href.slice(0, hashAt);
  const suffix = hashAt === -1 ? '' : href.slice(hashAt);
  if (target === '') return null;
  const dir = path.posix.dirname(fromRepoPath.replace(/\\/g, '/'));
  const joined = path.posix.normalize(path.posix.join(dir, target));
  if (joined.startsWith('..')) return null;
  return { rel: joined === '.' ? '' : joined, suffix };
}

/** True for hrefs the rewriter must leave alone: absolute URLs, anchors, site-absolute paths. */
export function isExternalHref(href: string): boolean {
  return /^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href);
}
