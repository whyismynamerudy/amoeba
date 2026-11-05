import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasHooksFile, loadHooks } from './hooks'
import { readIssueCommand, writeIssueCommand } from './issue-command-file'

vi.mock('./git/check-ignored-paths', () => ({
  checkIgnoredPaths: vi.fn().mockResolvedValue([])
}))

describe('Amoeba ignores Orca project files in the same repo', () => {
  let repo: string

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'amoeba-orca-isolation-'))
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('reads amoeba.yaml and never a lone orca.yaml', () => {
    writeFileSync(join(repo, 'orca.yaml'), 'scripts:\n  setup: orca-setup\n')
    expect(hasHooksFile(repo)).toBe(false)
    expect(loadHooks(repo)).toBeNull()

    writeFileSync(join(repo, 'amoeba.yaml'), 'scripts:\n  setup: amoeba-setup\n')
    expect(hasHooksFile(repo)).toBe(true)
    expect(loadHooks(repo)?.scripts.setup).toBe('amoeba-setup')
  })

  it("ignores Orca's issue-command override and keeps its .gitignore line", async () => {
    mkdirSync(join(repo, '.orca'))
    writeFileSync(join(repo, '.orca', 'issue-command'), 'orca command\n')
    writeFileSync(join(repo, '.gitignore'), '.orca\n')
    expect(readIssueCommand(repo).localContent).toBeNull()

    await writeIssueCommand(repo, 'amoeba command')

    expect(readIssueCommand(repo).localContent).toBe('amoeba command')
    expect(readFileSync(join(repo, '.gitignore'), 'utf8')).toBe('.orca\n.amoeba\n')

    await writeIssueCommand(repo, '')

    expect(readIssueCommand(repo).localContent).toBeNull()
    expect(readFileSync(join(repo, '.orca', 'issue-command'), 'utf8')).toBe('orca command\n')
  })
})
