import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { copyWorkingChanges } from './worktree-working-changes-copy'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' })
}

describe('copyWorkingChanges', () => {
  it('brings staged, unstaged and untracked work into a worktree branched from HEAD', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'amoeba-fork-copy-')))
    roots.push(root)
    const source = join(root, 'source')
    const fork = join(root, 'fork')
    execFileSync('git', ['init', '-q', source])
    git(source, 'config', 'user.email', 'test@example.com')
    git(source, 'config', 'user.name', 'Test')
    writeFileSync(join(source, 'a.txt'), 'one\n')
    writeFileSync(join(source, 'b.txt'), 'two\n')
    git(source, 'add', '.')
    git(source, 'commit', '-qm', 'base')
    git(source, 'worktree', 'add', '-q', '-b', 'fork', fork)

    writeFileSync(join(source, 'a.txt'), 'one edited\n')
    writeFileSync(join(source, 'b.txt'), 'two staged\n')
    git(source, 'add', 'b.txt')
    writeFileSync(join(source, 'new.txt'), 'brand new\n')
    writeFileSync(join(source, '.gitignore'), 'ignored.log\n')
    writeFileSync(join(source, 'ignored.log'), 'noise\n')

    const result = await copyWorkingChanges(source, fork)

    expect(result).toEqual({ appliedDiff: true, copiedFiles: 2 })
    expect(readFileSync(join(fork, 'a.txt'), 'utf8')).toBe('one edited\n')
    expect(readFileSync(join(fork, 'b.txt'), 'utf8')).toBe('two staged\n')
    expect(readFileSync(join(fork, 'new.txt'), 'utf8')).toBe('brand new\n')
    expect(existsSync(join(fork, 'ignored.log'))).toBe(false)
  })
})
