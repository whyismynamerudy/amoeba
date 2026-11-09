import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { withSpawnWorkspaceInstructions } from './spawn-workspace-instructions'

let workspace: string

beforeEach(() => {
  workspace = realpathSync(mkdtempSync(join(tmpdir(), 'spawn-instructions-')))
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

function spawnInput(overrides: Partial<Parameters<typeof withSpawnWorkspaceInstructions>[0]>) {
  return {
    command: 'claude',
    launchAgent: 'claude' as const,
    worktreeId: `repo-1::${workspace}`,
    connectionId: undefined,
    isFreshLaunch: true,
    shellOverride: undefined,
    wslDistro: null,
    store: {
      getFolderWorkspace: () => undefined,
      getRepo: () => ({ path: '/elsewhere' }),
      getWorktreeMeta: () => ({ baseRef: 'origin/main' })
    },
    ...overrides
  }
}

describe('withSpawnWorkspaceInstructions', () => {
  it('prepares .context and passes Claude its system prompt flag on a fresh local launch', async () => {
    const launch = withSpawnWorkspaceInstructions(spawnInput({}))

    await vi.waitFor(() => expect(existsSync(join(workspace, '.context'))).toBe(true))
    expect(launch?.command).toBe('claude --append-system-prompt "$ORCA_AGENT_INSTRUCTIONS"')
    expect(launch?.env.ORCA_AGENT_INSTRUCTIONS).toContain(
      `take place in the ${workspace} directory`
    )
    expect(launch?.env.ORCA_AGENT_INSTRUCTIONS).toContain('git diff origin/main...')
  })

  it('prepares .context but leaves the command of an agent without a channel alone', async () => {
    const command = withSpawnWorkspaceInstructions(
      spawnInput({ command: 'opencode', launchAgent: 'opencode' })
    )

    await vi.waitFor(() => expect(existsSync(join(workspace, '.context'))).toBe(true))
    expect(command).toBeNull()
  })

  it('does nothing for SSH relays, reattaches, and floating terminals', () => {
    expect(withSpawnWorkspaceInstructions(spawnInput({ connectionId: 'ssh-1' }))).toBeNull()
    expect(withSpawnWorkspaceInstructions(spawnInput({ isFreshLaunch: false }))).toBeNull()
    expect(
      withSpawnWorkspaceInstructions(spawnInput({ worktreeId: FLOATING_TERMINAL_WORKTREE_ID }))
    ).toBeNull()
    expect(existsSync(join(workspace, '.context'))).toBe(false)
  })
})
