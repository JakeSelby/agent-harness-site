import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { docLink, routeForDocPath, sourceRoutes } from './links.ts';
import { getRegistry, siteRoutes } from './registry.ts';
import type { Product } from './paths.ts';

/** The capability copy as it stands in the harness, ahead of the pin the site vendors. */
const fixture = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__/product.capabilities.json'), 'utf8'),
) as Product;

const docs = [
  ...(fixture.capabilities ?? []).flatMap((group) => group.features.map((f) => f.doc)),
  ...(fixture.on_the_way ?? []).map((item) => item.doc),
].filter((d): d is string => typeof d === 'string');

describe('routeForDocPath', () => {
  it('maps both the shared and the claude spelling of every kind', () => {
    expect(routeForDocPath('primitives/rules/secrets.md')).toBe('/rules/secrets/');
    expect(routeForDocPath('claude/rules/secrets.md')).toBe('/rules/secrets/');
    expect(routeForDocPath('primitives/skills/plan-authoring')).toBe('/skills/plan-authoring/');
    expect(routeForDocPath('claude/skills/plan-authoring/SKILL.md')).toBe('/skills/plan-authoring/');
    expect(routeForDocPath('primitives/stances/cost')).toBe('/stances/cost/');
    expect(routeForDocPath('primitives/stances/cost/balanced.md')).toBe('/stances/cost/balanced/');
    expect(routeForDocPath('primitives/stances')).toBe('/stances/');
    expect(routeForDocPath('primitives/workflows')).toBe('/commands/');
    expect(routeForDocPath('primitives/workflows/build.md')).toBe('/commands/build/');
    expect(routeForDocPath('primitives/roles/reviewer.md')).toBe('/agents/reviewer/');
    expect(routeForDocPath('claude/agents/reviewer.md')).toBe('/agents/reviewer/');
    expect(routeForDocPath('claude/agents')).toBe('/agents/');
    expect(routeForDocPath('claude/hooks/stop-gate.py')).toBe('/hooks/stop-gate/');
    expect(routeForDocPath('policy/hooks/stop-gate.py')).toBe('/hooks/stop-gate/');
    expect(routeForDocPath('claude/output-styles/scannable.md')).toBe('/output-styles/scannable/');
    expect(routeForDocPath('primitives/presentation/scannable.md')).toBe('/output-styles/scannable/');
    expect(routeForDocPath('docs/usage.md')).toBe('/docs/usage/');
    expect(routeForDocPath('docs')).toBe('/docs/');
  });

  it('returns null for anything no kind owns', () => {
    expect(routeForDocPath('bin/harness')).toBeNull();
    expect(routeForDocPath('README.md')).toBeNull();
    expect(routeForDocPath('../elsewhere/x.md')).toBeNull();
    expect(routeForDocPath('docs/diagrams/layers/x.md')).toBeNull();
    expect(routeForDocPath('')).toBeNull();
  });
});

describe('the capability copy', () => {
  const routes = siteRoutes();
  const bySource = sourceRoutes(getRegistry().hooks);

  it('gives every feature and planned item a doc path the mapping understands', () => {
    expect(docs.length).toBeGreaterThan(20);
    for (const doc of docs) expect(routeForDocPath(doc), doc).not.toBeNull();
  });

  it('resolves every doc path to a page the site builds', () => {
    expect(docs.filter((doc) => docLink(doc, routes, bySource) === null)).toEqual([]);
  });

  it('never links a route the site does not build', () => {
    for (const doc of docs) {
      const href = docLink(doc, routes, bySource);
      if (href !== null) expect(routes.has(href), doc).toBe(true);
    }
    expect(docLink(undefined, routes, bySource)).toBeNull();
    expect(docLink('bin/harness', routes, bySource)).toBeNull();
  });
});
