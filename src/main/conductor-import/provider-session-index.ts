import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const SESSION_UUID =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl(?:\.zst)?$/i

function listDirectory(path: string): string[] {
  try {
    return readdirSync(path)
  } catch {
    return []
  }
}

function collectCodexThreadIds(directory: string, into: Set<string>, depth: number): void {
  for (const entry of listDirectory(directory)) {
    const match = SESSION_UUID.exec(entry)
    if (match?.[1]) {
      into.add(match[1].toLowerCase())
    } else if (depth > 0 && !entry.includes('.')) {
      collectCodexThreadIds(join(directory, entry), into, depth - 1)
    }
  }
}

/** Sessions the agents can still resume: Claude prunes old transcripts, and only stored threads reopen. */
export function indexResumableProviderSessions(
  homePath: string,
  env: NodeJS.ProcessEnv = process.env
): { claude: ReadonlySet<string>; codex: ReadonlySet<string> } {
  const claude = new Set<string>()
  const projects = join(env.CLAUDE_CONFIG_DIR || join(homePath, '.claude'), 'projects')
  for (const project of listDirectory(projects)) {
    for (const file of listDirectory(join(projects, project))) {
      if (file.endsWith('.jsonl')) {
        claude.add(file.slice(0, -'.jsonl'.length).toLowerCase())
      }
    }
  }
  const codex = new Set<string>()
  // Codex nests rollouts as sessions/YYYY/MM/DD/rollout-<time>-<thread id>.jsonl[.zst].
  collectCodexThreadIds(join(env.CODEX_HOME || join(homePath, '.codex'), 'sessions'), codex, 3)
  return { claude, codex }
}
