import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const PORTS_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['ports'],
    summary: 'List the listening ports Amoeba detected for a workspace',
    usage: 'amoeba ports [--worktree <selector>] [--all] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree', 'all'],
    notes: [
      'Defaults to the Amoeba workspace that contains the current directory.',
      'Scans the host the workspace runs on and lists the ports Amoeba tied to it, by process working directory (match=cwd) or command line (match=command).',
      '--all lists every listener found on that host, including other workspaces and processes Amoeba could not tie to one. A native folder workspace needs --all, because Amoeba does not tie ports to folders.',
      'url is the address the dev server printed in an Amoeba terminal; it is missing when Amoeba did not see one.'
    ],
    examples: [
      'amoeba ports',
      'amoeba ports --worktree branch:feature/login --json',
      'amoeba ports --all',
      "amoeba ports --json | jq -r '.result.ports[0].advertisedUrl'"
    ]
  }
]
