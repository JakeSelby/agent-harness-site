import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Loader } from 'astro/loaders';
import { VENDOR } from './paths.ts';
import { parseFrontmatter } from './registry.ts';

export interface HarnessLoaderOptions {
  /** Repo-relative paths to load, listed at load time. */
  files: () => string[];
  /** The entry id for a repo-relative path. */
  id: (rel: string) => string;
}

/**
 * Why not Astro's `glob()` loader: the harness's frontmatter is the flat `key: value`
 * form Claude Code reads, and a description with a colon in it (`Returns a fixed
 * report: worktree, …`) is not valid YAML. js-yaml rejects it; Claude Code does not.
 * This loader parses the frontmatter the way the harness means it, then hands the
 * body to Astro's own markdown pipeline so `render(entry)` works as usual.
 */
export function harnessLoader(name: string, opts: HarnessLoaderOptions): Loader {
  return {
    name: `harness-${name}`,
    async load({ store, parseData, renderMarkdown, generateDigest, config }) {
      store.clear();
      const root = fileURLToPath(config.root);
      for (const rel of opts.files()) {
        const abs = path.join(VENDOR, rel);
        const text = fs.readFileSync(abs, 'utf8');
        const { data: raw, body } = parseFrontmatter(text);
        const id = opts.id(rel);
        const data = await parseData({ id, data: raw, filePath: abs });
        const rendered = await renderMarkdown(body, { fileURL: pathToFileURL(abs) });
        store.set({
          id,
          data,
          body,
          filePath: path.relative(root, abs),
          digest: generateDigest(text),
          rendered,
        });
      }
    },
  };
}
