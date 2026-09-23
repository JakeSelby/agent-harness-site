import fs from 'node:fs';
import path from 'node:path';
import { VENDOR } from './paths.ts';

export interface CliCommand { name: string; help: string }

/**
 * The CLI's subcommands come straight out of bin/harness: every top-level argparse
 * `add_parser("name", ..., help="...")`, in source order. The first `add_subparsers`
 * holds the top level; later ones hold nested actions (`remote-control install`,
 * `worktree create`), which would otherwise list twice under a bare name.
 */
export function listCli(root = VENDOR): CliCommand[] {
  const src = fs.readFileSync(path.join(root, 'bin/harness'), 'utf8');
  const out: CliCommand[] = [];
  const top = src.match(/(\w+)\s*=\s*\w+\.add_subparsers\(/)?.[1];
  if (!top) return out;
  const re = new RegExp(`\\b${top}\\.add_parser\\(\\s*"([a-z][\\w-]*)"[^)]*?help="([^"]*)"`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push({ name: m[1], help: m[2] });
  return out;
}

export interface Honesty {
  cap: number | null;
  tests: number;
  testFiles: number;
  ci: boolean;
}

/** The facts the overview's "keeps itself honest" strip states, read from the checkout. */
export function honesty(root = VENDOR): Honesty {
  const src = fs.readFileSync(path.join(root, 'bin/harness'), 'utf8');
  const cap = src.match(/^ALWAYS_LOADED_CAP\s*=\s*(\d+)/m);
  const testsDir = path.join(root, 'tests');
  const files = fs.existsSync(testsDir) ? fs.readdirSync(testsDir).filter((f) => f.startsWith('test_') && f.endsWith('.py')) : [];
  let tests = 0;
  for (const f of files) {
    const body = fs.readFileSync(path.join(testsDir, f), 'utf8');
    tests += (body.match(/^\s*def test_/gm) ?? []).length;
  }
  return {
    cap: cap ? Number(cap[1]) : null,
    tests,
    testFiles: files.length,
    ci: fs.existsSync(path.join(root, '.github/workflows/ci.yml')),
  };
}
