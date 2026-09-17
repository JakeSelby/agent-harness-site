# agent-harness-site

Public reference site for the agent-harness repository, at
**https://agent-harness.jakeselby.com**. Astro 6, static, no client framework, hand-written CSS
carrying the jakeselby.com paper palette with an amber accent.

Nothing about the harness is authored here. `vendor/agent-harness` is a git submodule pinned to
a release tag; `src/content.config.ts` globs its markdown and `src/lib/harness/registry.ts`
reads its structure. A page cannot drift from the file it describes.

## Commands

```bash
git submodule update --init   # once, after cloning
npm ci
npm test            # vitest over src/lib/harness, including the pipeline over every harness .md
npm run dev         # localhost:4321; search needs one prior build
npm run build       # astro build + Pagefind
npm run smoke       # one page per manifest route, 404, search index, submodule at the tag
npm run check       # astro check
```

## Gate

```sh
npm test
npm run build
node scripts/smoke.mjs
```

## Rules

- Conventional Commits for every commit.
- Work in a worktree branched off `main`; push to `main` directly. CI deploys every push.
- Run the gate on `HEAD` in the exact checkout before pushing.
- Every colour comes from the tokens at the top of `src/styles/global.css`; no hex elsewhere.
- **`AGENTS.md` is a symlink to this file.** Edit `CLAUDE.md`.

## Things that will bite you

- **The submodule is the content.** A fresh clone without `git submodule update --init` builds
  zero harness pages; `deploy.sh` and the smoke test both refuse that. Bump it only to a tag.
- **`glob()` in `src/content.config.ts` reads outside `src/`.** `base` resolves against the
  project root, so `./vendor/agent-harness/claude/skills` is fine. It skips `.py` files with a
  warning, which is why hooks come from `src/lib/harness/hooks.ts` instead.
- **Bare `<placeholder>` tokens in harness prose.** Markdown parses `<pref>` as HTML and a
  browser drops it. `remarkEscapeAngle` runs first in `astro.config.mjs` and turns them back
  into text; `remark.test.ts` checks every file in the submodule for lost placeholders.
- **The H1 is lifted out of every body** into `remarkPluginFrontmatter.title`; pages render it
  themselves. Do not add a second H1 in a template.
- **Search is a build artifact.** `astro-pagefind` indexes `dist/` after the build and serves
  that index in dev. No build, no results.
- **Astro is pinned to 6.4.5.** 6.4.8 resolves Vite 8; keep `overrides.vite` at 7.3.5, the same
  pin as jakeselby-com and sovereign-library.
- **The routing CloudFront Function rewrites clean URLs to `index.html`.** `trailingSlash` is
  `always`, so every internal link ends in `/`; the smoke test checks each one resolves.

## Deploying

1. First time only, from a Mac: `cd infra && npx cdk deploy AgentHarnessSite`. ACM validation
   sits for two or three minutes; that is normal. Copy the `DeployRoleArn` output into the
   repository variable `AWS_DEPLOY_ROLE_ARN` on GitHub.
2. Every push to `main` after that: `.github/workflows/deploy.yml` builds, smoke-tests and syncs.
3. Infrastructure changes and manual syncs: `./scripts/deploy.sh` (guards: clean tree, `main`,
   submodule at the recorded commit, tests, build, smoke).
