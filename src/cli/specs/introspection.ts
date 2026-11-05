import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const INTROSPECTION_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['agent-context'],
    summary: 'Print the machine-readable command schema for agents',
    usage: 'amoeba agent-context [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Pure local read of the command registry — works without a running Amoeba app, so it is safe over SSH and in headless contexts.'
    ],
    examples: ['amoeba agent-context --json']
  }
]
