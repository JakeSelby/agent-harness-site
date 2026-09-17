import fs from 'node:fs';
import path from 'node:path';
import { defineCollection, z } from 'astro:content';
import { harnessLoader } from './lib/harness/loader.ts';
import { vendorFile } from './lib/harness/paths.ts';

// Every collection reads the agent-harness submodule directly. The registry in
// src/lib/harness reads the same files for structure and metadata; these
// collections exist so Astro renders the markdown bodies with its pipeline.
const mdIn = (dir: string) => () =>
  fs.readdirSync(vendorFile(dir)).filter((f) => f.endsWith('.md')).sort().map((f) => `${dir}/${f}`);
const stem = (rel: string) => path.basename(rel, '.md');
const loose = z.object({}).passthrough();

export const collections = {
  rules: defineCollection({ loader: harnessLoader('rules', { files: mdIn('claude/rules'), id: stem }), schema: loose }),
  stances: defineCollection({
    loader: harnessLoader('stances', {
      files: () =>
        fs
          .readdirSync(vendorFile('claude/stances'))
          .filter((d) => fs.statSync(vendorFile(`claude/stances/${d}`)).isDirectory())
          .sort()
          .flatMap((d) => mdIn(`claude/stances/${d}`)()),
      id: (rel) => rel.replace(/^claude\/stances\//, '').replace(/\.md$/, ''),
    }),
    schema: loose,
  }),
  skills: defineCollection({
    loader: harnessLoader('skills', {
      files: () =>
        fs
          .readdirSync(vendorFile('claude/skills'))
          .filter((d) => fs.existsSync(vendorFile(`claude/skills/${d}/SKILL.md`)))
          .sort()
          .map((d) => `claude/skills/${d}/SKILL.md`),
      id: (rel) => rel.split('/')[2],
    }),
    schema: z.object({ name: z.string(), description: z.string() }).passthrough(),
  }),
  agents: defineCollection({
    loader: harnessLoader('agents', { files: mdIn('claude/agents'), id: stem }),
    schema: z
      .object({
        name: z.string(),
        description: z.string(),
        model: z.string().optional(),
        effort: z.string().optional(),
        tools: z.union([z.string(), z.array(z.string())]).optional(),
      })
      .passthrough(),
  }),
  commands: defineCollection({
    loader: harnessLoader('commands', { files: mdIn('claude/commands'), id: stem }),
    schema: z.object({ description: z.string().optional(), 'argument-hint': z.string().optional() }).passthrough(),
  }),
  outputStyles: defineCollection({
    loader: harnessLoader('output-styles', { files: mdIn('claude/output-styles'), id: stem }),
    schema: z.object({ name: z.string().optional(), description: z.string().optional() }).passthrough(),
  }),
  docs: defineCollection({ loader: harnessLoader('docs', { files: mdIn('docs'), id: stem }), schema: loose }),
  meta: defineCollection({
    loader: harnessLoader('meta', {
      files: () => ['CHANGELOG.md', 'CONTRIBUTING.md'].filter((f) => fs.existsSync(vendorFile(f))),
      id: (rel) => stem(rel).toLowerCase(),
    }),
    schema: loose,
  }),
};
