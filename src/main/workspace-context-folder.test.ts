import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitExecFileAsync } from './git/runner'
import { ensureWorkspaceContextFolder } from './workspace-context-folder'

let root: string

async function git(args: string[], cwd: string): Promise<void> {
  await gitExecFileAsync(args, { cwd })
}

function excludeLines(repo: string): string[] {
  return readFileSync(join(repo, '.git', 'info', 'exclude'), 'utf8')
    .split('\n')
    .filter((line) => line.includes('.context'))
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'workspace-context-')))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('ensureWorkspaceContextFolder', () => {
  it('excludes .context once for a main checkout and its linked worktrees', async () => {
    const repo = join(root, 'repo')
    mkdirSync(repo)
    await git(['init', '-q'], repo)
    await git(
      ['-c', 'user.email=a@b.c', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'x'],
      repo
    )
    const linked = join(root, 'linked')
    await git(['worktree', 'add', '-q', '-b', 'feature', linked], repo)

    await Promise.all([ensureWorkspaceContextFolder(repo), ensureWorkspaceContextFolder(linked)])
    await ensureWorkspaceContextFolder(linked)

    expect(existsSync(join(repo, '.context'))).toBe(true)
    expect(existsSync(join(linked, '.context'))).toBe(true)
    // Linked worktrees share the common dir's exclude, so one root-anchored line covers both.
    expect(excludeLines(repo)).toEqual(['/.context/'])
    const { stdout } = await gitExecFileAsync(['status', '--porcelain'], { cwd: linked })
    expect(stdout).not.toContain('.context')
  })

  it('anchors the pattern for a folder nested inside a repository', async () => {
    const repo = join(root, 'repo')
    const nested = join(repo, 'packages', 'app')
    mkdirSync(nested, { recursive: true })
    await git(['init', '-q'], repo)

    await ensureWorkspaceContextFolder(nested)

    expect(excludeLines(repo)).toEqual(['/packages/app/.context/'])
  })

  it('creates the folder without git outside a repository', async () => {
    const folder = join(root, 'plain')
    mkdirSync(folder)

    await ensureWorkspaceContextFolder(folder, async () => {
      throw new Error('fatal: not a git repository')
    })

    expect(existsSync(join(folder, '.context'))).toBe(true)
  })
})
