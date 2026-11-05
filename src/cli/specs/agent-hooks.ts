import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const AGENT_HOOK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['agent', 'hooks', 'prepare-codex'],
    summary: "Prepare a WSL pane's Amoeba-managed Codex home before a shell launch",
    usage: 'amoeba agent hooks prepare-codex',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['agent', 'hooks', 'status'],
    summary: 'Show whether Amoeba-managed agent status hooks are enabled',
    usage: 'amoeba agent hooks status [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['amoeba agent hooks status', 'amoeba agent hooks status --json']
  },
  {
    path: ['agent', 'hooks', 'off'],
    summary: 'Disable Amoeba-managed agent status hooks and remove local hook entries',
    usage: 'amoeba agent hooks off [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['amoeba agent hooks off']
  },
  {
    path: ['agent', 'hooks', 'on'],
    summary: 'Enable Amoeba-managed agent status hooks',
    usage: 'amoeba agent hooks on [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['amoeba agent hooks on']
  }
]
