import { describe, expect, it } from 'vitest'
import {
  withInstructionsInLaunchPrompt,
  withTerminalInstructionArgs
} from './workspace-agent-instructions-delivery'

const INSTRUCTIONS = "Work in /r.\nDon't rename the branch."
const FLAT = "Work in /r. Don't rename the branch."

describe('workspace instruction delivery', () => {
  it('gives Claude and Codex their channel by env reference, and never also the prompt', () => {
    expect(
      withTerminalInstructionArgs({
        command: "claude --model opus 'fix it'",
        agent: 'claude',
        instructions: INSTRUCTIONS,
        shell: 'posix'
      })
    ).toEqual({
      command: `claude --append-system-prompt "$ORCA_AGENT_INSTRUCTIONS" --model opus 'fix it'`,
      env: { ORCA_AGENT_INSTRUCTIONS: FLAT }
    })
    expect(
      withTerminalInstructionArgs({
        command: '/opt/bin/codex resume abc',
        agent: 'codex',
        instructions: INSTRUCTIONS,
        shell: 'powershell'
      })?.command
    ).toBe(
      `/opt/bin/codex -c "developer_instructions='''$env:ORCA_AGENT_INSTRUCTIONS'''" resume abc`
    )
    expect(
      withTerminalInstructionArgs({
        command: 'claude',
        agent: 'claude',
        instructions: INSTRUCTIONS,
        shell: 'cmd'
      })?.command
    ).toBe('claude --append-system-prompt "%ORCA_AGENT_INSTRUCTIONS%"')
    for (const agent of ['claude', 'codex'] as const) {
      expect(withInstructionsInLaunchPrompt({ agent, prompt: 'fix it', instructions: FLAT })).toBe(
        'fix it'
      )
    }
  })

  it('falls back to the launch prompt for agents without a channel', () => {
    expect(
      withTerminalInstructionArgs({
        command: 'opencode',
        agent: 'opencode',
        instructions: INSTRUCTIONS,
        shell: 'posix'
      })
    ).toBeNull()
    expect(
      withInstructionsInLaunchPrompt({
        agent: 'opencode',
        prompt: 'fix it',
        instructions: INSTRUCTIONS
      })
    ).toBe(`<amoeba_instructions>${FLAT}</amoeba_instructions> fix it`)
    // No prompt from Amoeba means nothing to carry them.
    expect(
      withInstructionsInLaunchPrompt({ agent: 'opencode', prompt: '', instructions: INSTRUCTIONS })
    ).toBe('')
  })

  it('leaves wrappers, other binaries, and user-filled channels alone', () => {
    for (const command of ['npx claude', "claude --append-system-prompt 'mine'"]) {
      expect(
        withTerminalInstructionArgs({
          command,
          agent: 'claude',
          instructions: INSTRUCTIONS,
          shell: 'posix'
        })
      ).toBeNull()
    }
  })
})
