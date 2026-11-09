import type { TuiAgent } from './tui-agent'
import { tokenizeStartupCommand, type AgentStartupShell } from './tui-agent-startup-shell'
import { flattenWorkspaceAgentInstructions } from './workspace-agent-instructions'

/** Carries the instructions to the launch line by reference: typed lines over ~512 bytes get truncated. */
export const AGENT_INSTRUCTIONS_ENV = 'ORCA_AGENT_INSTRUCTIONS'

/** One shell word holding `prefix + $ORCA_AGENT_INSTRUCTIONS + suffix`; the value never re-parses. */
function instructionsWord(shell: AgentStartupShell, prefix = '', suffix = ''): string {
  const reference =
    shell === 'powershell'
      ? `$env:${AGENT_INSTRUCTIONS_ENV}`
      : shell === 'cmd'
        ? `%${AGENT_INSTRUCTIONS_ENV}%`
        : `$${AGENT_INSTRUCTIONS_ENV}`
  return `"${prefix}${reference}${suffix}"`
}

type InstructionChannel = {
  /** Only the agent's own binary is known to take these flags; wrappers and overrides fall through. */
  executable: RegExp
  /** The user's own Arguments already fill the channel; a later flag would override ours anyway. */
  userOwned: (arg: string) => boolean
  args: (shell: AgentStartupShell) => string
}

/** Terminal agents whose CLI takes instructions out of band; others get them in their launch prompt. */
const TERMINAL_INSTRUCTION_CHANNELS: Partial<Record<TuiAgent, InstructionChannel>> = {
  claude: {
    executable: /^claude(\.(exe|cmd|bat|ps1))?$/i,
    userOwned: (arg) => arg.startsWith('--append-system-prompt'),
    args: (shell) => `--append-system-prompt ${instructionsWord(shell)}`
  },
  codex: {
    executable: /^codex(\.(exe|cmd|bat|ps1))?$/i,
    userOwned: (arg) => arg.startsWith('developer_instructions='),
    // -c parses its value as TOML; a ''' literal string needs no double quotes inside the shell word.
    args: (shell) => `-c ${instructionsWord(shell, "developer_instructions='''", "'''")}`
  }
}

export function hasTerminalInstructionChannel(agent: TuiAgent): boolean {
  return TERMINAL_INSTRUCTION_CHANNELS[agent] !== undefined
}

/** Insert the agent's instruction flags after its executable, with the text in the PTY env.
 *  Null when the command is not that binary or the user's Arguments already fill the channel. */
export function withTerminalInstructionArgs(args: {
  command: string
  agent: TuiAgent
  instructions: string
  shell: AgentStartupShell
}): { command: string; env: Record<string, string> } | null {
  const channel = TERMINAL_INSTRUCTION_CHANNELS[args.agent]
  const instructions = flattenWorkspaceAgentInstructions(args.instructions)
  // Text cmd's expansion or a TOML literal string cannot hold verbatim (only an odd workspace path).
  if (!channel || /"|'''/.test(instructions) || instructions.endsWith("'")) {
    return null
  }
  const parsed = tokenizeStartupCommand(args.command, args.shell)
  const span = parsed.ok ? parsed.spans[0] : undefined
  const executable = parsed.ok ? parsed.tokens[0] : undefined
  const basename = executable?.split(/[\\/]/).pop() ?? ''
  if (
    !span ||
    span.divergesFromShell ||
    !channel.executable.test(basename) ||
    (parsed.ok && parsed.tokens.some(channel.userOwned))
  ) {
    return null
  }
  return {
    command: `${args.command.slice(0, span.end)} ${channel.args(args.shell)}${args.command.slice(span.end)}`,
    env: { [AGENT_INSTRUCTIONS_ENV]: instructions }
  }
}

/** Fallback for agents without a channel: one line, so typed delivery cannot submit early. */
export function withInstructionsInLaunchPrompt(args: {
  agent: TuiAgent
  prompt: string
  instructions: string | null | undefined
}): string {
  if (!args.instructions || !args.prompt.trim() || hasTerminalInstructionChannel(args.agent)) {
    return args.prompt
  }
  const instructions = flattenWorkspaceAgentInstructions(args.instructions)
  return `<amoeba_instructions>${instructions}</amoeba_instructions> ${args.prompt}`
}
