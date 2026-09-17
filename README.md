# agent-harness-site

The reference site for [agent-harness](https://github.com/JakeSelby/agent-harness), at
**https://agent-harness.jakeselby.com**. An overview of the system, then one page per rule,
stance variant, skill, agent, command, hook and doc, with search and a link from every page to
its source file at the tagged release.

Nothing here is written by hand about the harness. The checkout is a git submodule under
`vendor/agent-harness`, pinned to a release tag; Astro content collections read its markdown
and a small registry reads its structure, so the site cannot drift from the code it describes.

## Commands

```bash
npm ci               # after cloning: git submodule update --init first
npm test             # vitest: registry, links, the markdown pipeline over every harness file
npm run dev          # localhost:4321 (search works after one build)
npm run build        # astro build, then Pagefind indexes dist/
npm run smoke        # one page per manifest route, search index, 404, submodule at the tag
npm run check        # astro check
npm run infra:diff   # cdk diff for the AgentHarnessSite stack
```

## Updating to a new harness release

```bash
git -C vendor/agent-harness fetch --tags
git -C vendor/agent-harness checkout v0.3.0
git add vendor/agent-harness
npm test && npm run build && npm run smoke
git commit -m "chore(vendor): agent-harness v0.3.0"
```

Push to `main` and CI deploys. The smoke test refuses a submodule commit that is not the tag
named by the harness's own `VERSION` file.

## Deploying

CI (`.github/workflows/deploy.yml`) syncs the site on every push to `main` through an OIDC
role that can only write the bucket and invalidate the distribution. Infrastructure changes
and the first deploy are `./scripts/deploy.sh` from a Mac with the `your-profile` profile.

## Licence

MIT. The harness itself is MIT too; its text is rendered here under that licence.
