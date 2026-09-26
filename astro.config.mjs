// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import pagefind from 'astro-pagefind';
import {
  remarkEscapeAngle,
  remarkLiftTitle,
  remarkHarnessLinks,
  remarkCodeLinks,
} from './src/lib/harness/remark.ts';

// The harness checkout is a submodule under vendor/; the collections in
// src/content.config.ts read it directly, so this site never copies a rule or a
// skill by hand. See README.md for the bump procedure.
export default defineConfig({
  site: 'https://model-citizen.dev',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap(), pagefind()],
  markdown: {
    // Order matters: bare <placeholder> tokens must become text before anything
    // else looks at the tree, and the H1 is lifted into frontmatter so pages
    // render their own title once.
    processor: unified({
      remarkPlugins: [remarkEscapeAngle, remarkLiftTitle, remarkHarnessLinks, remarkCodeLinks],
    }),
    shikiConfig: { theme: 'github-dark-default' },
  },
});
