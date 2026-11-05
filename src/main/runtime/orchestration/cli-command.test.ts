import { describe, expect, it } from 'vitest'
import { resolveTerminalOrchestrationCliCommand } from './cli-command'

describe('resolveTerminalOrchestrationCliCommand', () => {
  it('tells local, WSL and SSH panes to run `amoeba`', () => {
    expect(resolveTerminalOrchestrationCliCommand({ connectionId: null })).toBe('amoeba')
    expect(resolveTerminalOrchestrationCliCommand({ connectionId: 'ssh-1' })).toBe('amoeba')
  })

  it('uses the runtime-provided command locally but never leaks it to SSH', () => {
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: null,
        runtimeCliCommand: 'amoeba-dev'
      })
    ).toBe('amoeba-dev')
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: 'ssh-1',
        runtimeCliCommand: 'amoeba-dev'
      })
    ).toBe('amoeba')
  })
})
