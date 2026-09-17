import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the agent-harness submodule checkout. */
export const VENDOR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../vendor/agent-harness');

export const REPO_URL = 'https://github.com/JakeSelby/agent-harness';

/** Repo-relative path → its file on disk. */
export function vendorFile(rel: string): string {
  return path.join(VENDOR, rel);
}
