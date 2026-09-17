import type { APIRoute } from 'astro';
import { manifest } from '../lib/harness/registry.ts';

// The machine-readable index of the site: every route with its kind, title and
// source path in the harness, plus the counts and the version rendered. The
// smoke test reads it after a build; anyone else may too.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(manifest(), null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
