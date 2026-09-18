import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compatibility, product, sourceDir } from './paths.ts';
import { routeForRepoPath } from './links.ts';
const temporary: string[] = [];
const fixture = () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-site-')); temporary.push(root); return root; };
afterEach(() => temporary.splice(0).forEach((root) => fs.rmSync(root, { recursive: true })));

describe('release surfaces', () => {
  it('prefers shared authority and retains legacy readers', () => {
    const root = fixture();
    expect(sourceDir('agents', root)).toBe('claude/agents');
    fs.mkdirSync(path.join(root, 'primitives/roles'), { recursive: true });
    expect(sourceDir('agents', root)).toBe('primitives/roles');
    expect(routeForRepoPath('primitives/roles/reviewer.md', '1.0.0', () => true)).toBe('/agents/reviewer/');
    expect(routeForRepoPath('primitives/stances/feedback/direct.md', '1.0.0', () => true)).toBe('/stances/feedback/direct/');
  });
  it('loads positioning from the release and rejects mismatched support data', () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, 'product.json'), JSON.stringify({ headline: 'Fixture headline' }));
    expect(product(root).headline).toBe('Fixture headline');
    expect(compatibility(root).clients).toEqual([]);
    fs.mkdirSync(path.join(root, 'compatibility'));
    fs.writeFileSync(path.join(root, 'VERSION'), '1.0.0');
    fs.writeFileSync(path.join(root, 'compatibility/catalog.json'), JSON.stringify({ schema_version: 1, harness_version: '0.9.0', clients: [] }));
    expect(() => compatibility(root)).toThrow('disagree');
  });
});
