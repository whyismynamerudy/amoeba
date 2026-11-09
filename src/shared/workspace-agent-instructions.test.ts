import { describe, expect, it } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from './constants'
import {
  buildWorkspaceAgentInstructions,
  resolveWorkspaceAgentInstructionsTarget
} from './workspace-agent-instructions'

const LINKED = 'repo-1::/work/repo-wt'

describe('resolveWorkspaceAgentInstructionsTarget', () => {
  it('classifies worktrees, main checkouts and folders; floating chats get none', () => {
    expect(
      resolveWorkspaceAgentInstructionsTarget({
        workspaceId: LINKED,
        path: '/work/repo-wt',
        isMainCheckout: false,
        baseRef: ' origin/main '
      })
    ).toEqual({ kind: 'worktree', path: '/work/repo-wt', baseRef: 'origin/main' })
    expect(
      resolveWorkspaceAgentInstructionsTarget({
        workspaceId: 'repo-1::/work/repo',
        path: '/work/repo',
        isMainCheckout: true
      })
    ).toEqual({ kind: 'main-checkout', path: '/work/repo' })
    expect(
      resolveWorkspaceAgentInstructionsTarget({
        workspaceId: 'folder:abc',
        path: '/work/notes',
        isMainCheckout: false,
        baseRef: 'origin/main'
      })
    ).toEqual({ kind: 'folder', path: '/work/notes' })
    expect(
      resolveWorkspaceAgentInstructionsTarget({
        workspaceId: FLOATING_TERMINAL_WORKTREE_ID,
        path: '/home/me',
        isMainCheckout: false
      })
    ).toBeNull()
  })
})

describe('buildWorkspaceAgentInstructions', () => {
  it('gives a linked worktree chat its branch, PR and chat-surface lines', () => {
    expect(
      buildWorkspaceAgentInstructions(
        { kind: 'worktree', path: '/work/repo-wt', baseRef: 'refs/remotes/origin/main' },
        'chat'
      )
    ).toMatchInlineSnapshot(`
      "You are working inside Amoeba, a Mac app that lets the user run many coding agents in parallel.
      Your work should take place in the /work/repo-wt directory (unless otherwise directed), which has been set up for you to work in.
      This workspace has a .context directory (gitignored) where you can save files to collaborate with other agents.
      The target branch for this workspace is origin/main. Use this for actions like diffing (git diff origin/main...) or creating PRs (gh pr create --base main).
      Do not rename the current branch unless the user explicitly tells you to do so. Amoeba may replace a placeholder branch name after your first turn.
      Amoeba shows the PR for whichever branch is checked out. After you open a PR from a different branch, or a PR stack, check out that PR's branch (for a stack, the top-most branch) so Amoeba shows it.
      By default, the user will only see the last message that you send before stopping. Include all essential information in the last message. The intermediate messages will be collapsed and accessible by the user but not displayed by default.
      Save screenshots under .context/ and embed them inline in the final response using Markdown image syntax, for example ![Screenshot](</work/repo-wt/.context/screenshot.png>).
      The \`amoeba\` CLI can drive Amoeba's built-in browser and terminals; see the amoeba-cli skill for how to use it.
      If the user asks you to work on several unrelated tasks, you can suggest they start new tasks in Amoeba.
      Sometimes the user might send you a message they meant to send in a different task or chat. If something doesn't make sense in the context of your work, just ask.
      Earlier messages in this conversation may describe Conductor or another app; you are now running in Amoeba, and these instructions apply.
      If the user asks for help with Amoeba, point them to https://github.com/whyismynamerudy/amoeba/issues."
    `)
  })

  it('marks Local tasks as shared and leaves branch rules to worktrees', () => {
    const local = buildWorkspaceAgentInstructions({ kind: 'main-checkout', path: '/r' }, 'chat')
    expect(local).toContain("This is the user's main project folder")
    expect(local).toContain('.context directory (gitignored)')
    expect(local).not.toContain('target branch')
    expect(local).not.toContain('rename the current branch')
  })

  it('drops git lines for folders and chat-only lines for terminals', () => {
    const folder = buildWorkspaceAgentInstructions({ kind: 'folder', path: '/notes' }, 'terminal')
    expect(folder).toContain("This is the user's main project folder")
    expect(folder).toContain('has a .context directory where')
    expect(folder).not.toMatch(/gitignored|PR|branch/)
    expect(folder).not.toContain('only see the last message')
    expect(folder).toContain('Save screenshots under .context/.')
  })
})
