#!/usr/bin/env node
// Prints the newest release tag published by the vendored harness repository.
//
// The repin workflow compares this to the tag the submodule is pinned at. Only
// `v<major>.<minor>.<patch>` is a release tag here; anything else on the remote
// (release candidates, moving branch-like refs, peeled `^{}` entries) is not a
// pin target and is dropped.

import { execFileSync } from 'node:child_process';

const SEMVER_REF = /^v(\d+)\.(\d+)\.(\d+)$/;

/**
 * Highest release tag in a list of `git ls-remote --tags` output lines, or null
 * when the list holds none. Pure: the caller supplies the lines.
 *
 * @param {string[]} lines
 * @returns {string | null}
 */
export function latestTag(lines) {
  let best = null;
  let bestParts = null;
  for (const line of lines) {
    const ref = String(line).trim().split(/\s+/)[1];
    if (!ref) continue;
    const name = ref.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, '');
    const match = SEMVER_REF.exec(name);
    if (!match) continue;
    const parts = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (bestParts === null || compare(parts, bestParts) > 0) {
      best = name;
      bestParts = parts;
    }
  }
  return best;
}

function compare(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** Reads the remote tag list for the vendored submodule. */
export function remoteRefLines(submodule = 'vendor/agent-harness') {
  const out = execFileSync('git', ['-C', submodule, 'ls-remote', '--tags', 'origin'], {
    encoding: 'utf8',
  });
  return out.split('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tag = latestTag(remoteRefLines(process.argv[2]));
  if (!tag) {
    console.error('no v<major>.<minor>.<patch> tag on the remote');
    process.exit(1);
  }
  console.log(tag);
}
