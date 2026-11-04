import { describe, expect, it } from 'vitest'
import { ensureWorktreeHasInitialTerminal } from './worktree-initial-terminal-seeding'
import {
  createMockStore,
  registerWorktreeActivationReset
} from './worktree-activation.test-fixture'
import { classicShellSettings } from './classic-shell-settings.test-fixture'

registerWorktreeActivationReset()

const WT = 'wt-1'

function seededTabs(projectTasksSidebar: boolean, startup?: { command: string }): number {
  const store = createMockStore({
    tabsByWorktree: { [WT]: [] },
    settings: { ...classicShellSettings(''), projectTasksSidebar }
  })
  ensureWorktreeHasInitialTerminal(store, WT, startup, undefined, undefined, undefined, {
    reseedEmptiedWorkspace: true,
    seedUserDefaultSurface: true
  })
  return store.createTab.mock.calls.length
}

describe('empty workspace seeding under the task shell', () => {
  it('leaves an empty workspace to the task composer instead of seeding a shell', () => {
    expect(seededTabs(true)).toBe(0)
    expect(seededTabs(false)).toBe(1)
  })

  it('still opens a terminal for explicit startup work', () => {
    expect(seededTabs(true, { command: 'npm test' })).toBe(1)
  })
})
