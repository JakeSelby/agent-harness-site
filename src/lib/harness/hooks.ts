import fs from 'node:fs';
import path from 'node:path';
import { VENDOR } from './paths.ts';

export interface Hook {
  id: string;
  file: string; // claude/hooks/<name>.py
  event: string;
  matcher: string | null;
  timeout: number | null;
  statusMessage: string | null;
  always: boolean;
  stance: string | null;
  variant: string | null;
  summary: string;
  docstring: string;
  source: string;
  lines: number;
  helper: string | null;
}

interface SettingsHook { command?: string; timeout?: number; statusMessage?: string }
interface SettingsEntry { matcher?: string; hooks?: SettingsHook[] }
interface Ownership { claude?: { hook_ids?: Record<string, { event?: string; always?: boolean; stance?: string; variant?: string }> } }

const EVENT_ORDER = ['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop', 'SessionEnd'];

function docstringOf(source: string): string {
  const m = source.match(/"""([\s\S]*?)"""/);
  return m ? m[1].trim() : '';
}

/**
 * The hooks are Python, not markdown, so they are joined by hand: settings.template.json
 * says which script runs on which event (each command ends in `# harness:<id>`),
 * OWNERSHIP.json says whether the hook is always on or gated by a stance, and the
 * script's own docstring is the summary.
 */
export function listHooks(root = VENDOR): Hook[] {
  const settings = JSON.parse(fs.readFileSync(path.join(root, 'claude/settings.template.json'), 'utf8')) as { hooks?: Record<string, SettingsEntry[]> };
  const ownership = JSON.parse(fs.readFileSync(path.join(root, 'claude/OWNERSHIP.json'), 'utf8')) as Ownership;
  const ids = ownership.claude?.hook_ids ?? {};
  const out: Hook[] = [];

  for (const [event, entries] of Object.entries(settings.hooks ?? {})) {
    for (const entry of entries) {
      for (const h of entry.hooks ?? []) {
        const cmd = h.command ?? '';
        const id = cmd.match(/#\s*harness:([\w-]+)/)?.[1];
        const script = cmd.match(/hooks\/harness\/([\w-]+\.py)/)?.[1];
        if (!id || !script) continue;
        const file = `claude/hooks/${script}`;
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        const docstring = docstringOf(source);
        const own = ids[id] ?? {};
        out.push({
          id,
          file,
          event: own.event ?? event,
          matcher: entry.matcher ?? null,
          timeout: h.timeout ?? null,
          statusMessage: h.statusMessage ?? null,
          always: own.always === true,
          stance: own.stance ?? null,
          variant: own.variant ?? null,
          summary: docstring.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim(),
          docstring,
          source,
          lines: source.split('\n').length,
          helper: id === 'filter-output' && fs.existsSync(path.join(root, 'claude/hooks/filter-lines.py')) ? 'claude/hooks/filter-lines.py' : null,
        });
      }
    }
  }

  out.sort((a, b) => EVENT_ORDER.indexOf(a.event) - EVENT_ORDER.indexOf(b.event) || a.id.localeCompare(b.id));
  return out;
}
