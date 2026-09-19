import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Absolute path of the agent-harness submodule checkout. */
export const VENDOR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../vendor/agent-harness');

export const REPO_URL = 'https://github.com/JakeSelby/agent-harness';

/** Repo-relative path → its file on disk. */
export function vendorFile(rel: string): string {
  return path.join(VENDOR, rel);
}

/** Read the shared catalog when present; retain readers for older immutable release pins. */
export function sourceDir(kind: string, root = VENDOR): string {
  const shared: Record<string, string> = {
    rules: 'primitives/rules', stances: 'primitives/stances', skills: 'primitives/skills',
    agents: 'primitives/roles', commands: 'primitives/workflows',
    'output-styles': 'primitives/presentation', hooks: 'policy/hooks', docs: 'docs',
  };
  const next = shared[kind];
  return next && fs.existsSync(path.join(root, next)) ? next : kind === 'docs' ? 'docs' : `claude/${kind}`;
}

export function product(root = VENDOR) {
  const file = path.join(root, 'product.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {
    headline: 'Agent Harness reference',
    description: 'Reference for the pinned harness release. Inspect its configuration and compatibility before choosing an agent runtime.',
    stances: 'Choose explicit working preferences through personal stances.',
  };
}

export function compatibility(root = VENDOR) {
  const file = path.join(root, 'compatibility/catalog.json');
  if (!fs.existsSync(file)) return { schema_version: 0, clients: [], limitations: ['This legacy release has no native qualification catalog.'] };
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
  if (data.schema_version !== 1 || data.harness_version !== version) throw new Error('Compatibility catalog and release version disagree');
  return data;
}
