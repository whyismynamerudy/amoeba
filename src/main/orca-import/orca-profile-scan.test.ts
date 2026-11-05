import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import SyncDatabase from '../sqlite/sync-database'
import { scanOrcaProfile } from './orca-profile-scan'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function chatRecord(
  sessionId: string,
  workspaceId: string,
  handle: { provider: 'claude' | 'codex' } & Record<string, string>
): string {
  return JSON.stringify({
    sessionId,
    provider: handle.provider,
    location: { executionHostId: 'local', workspaceId },
    providerHandleChain: [{ handle: { provider: 'claude', sessionId: 'stale' } }, { handle }],
    conversationName: `Chat ${sessionId}`,
    updatedAt: 5
  })
}

function orcaFixture(): { orcaPath: string; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'amoeba-orca-import-'))
  roots.push(root)
  const orcaPath = join(root, 'orca')
  const repoPath = join(root, 'repo')
  const worktreePath = join(root, 'orca-workspaces', 'repo', 'feature')
  mkdirSync(worktreePath, { recursive: true })
  mkdirSync(repoPath)
  mkdirSync(join(orcaPath, 'profiles', 'local-default'), { recursive: true })

  const profile = new SyncDatabase(join(orcaPath, 'profiles', 'local-default', 'profile-state.db'))
  profile.exec('CREATE TABLE profile_state_documents (domain TEXT PRIMARY KEY, payload TEXT)')
  const document = profile.prepare('INSERT INTO profile_state_documents VALUES (?, ?)')
  document.run(
    'repos',
    JSON.stringify([
      { id: 'r1', path: repoPath, displayName: 'repo', kind: 'git' },
      { id: 'r2', path: '/home/u/remote', kind: 'git', connectionId: 'ssh-1' }
    ])
  )
  document.run(
    'worktreeMeta',
    JSON.stringify({
      [`r1::${worktreePath}`]: { displayName: 'Login fix' },
      [`r1::${join(root, 'gone')}`]: { displayName: 'Deleted' }
    })
  )
  document.run('settings', JSON.stringify({ workspaceDir: join(root, 'orca-workspaces') }))
  profile.close()

  const journal = new SyncDatabase(join(orcaPath, 'agent-session-journal.db'))
  journal.exec('CREATE TABLE agent_session_records (session_id TEXT PRIMARY KEY, record_json TEXT)')
  const record = journal.prepare('INSERT INTO agent_session_records VALUES (?, ?)')
  record.run('a', chatRecord('a', `r1::${worktreePath}`, { provider: 'claude', sessionId: 'S-1' }))
  record.run('b', chatRecord('b', `r1::${repoPath}`, { provider: 'codex', threadId: 't-2' }))
  journal.close()
  return { orcaPath, root }
}

describe('scanOrcaProfile', () => {
  it('reads local projects, named worktrees and the newest handle of each resumable chat', () => {
    const { orcaPath, root } = orcaFixture()

    const scan = scanOrcaProfile(orcaPath, { claude: new Set(['s-1']), codex: new Set() })

    expect(scan).toMatchObject({
      status: 'ready',
      workspacesRoot: join(root, 'orca-workspaces'),
      repos: [{ id: 'r1', name: 'repo', kind: 'git' }],
      workspaces: [{ path: join(root, 'orca-workspaces', 'repo', 'feature'), name: 'Login fix' }],
      chats: [{ id: 'orca:a', agent: 'claude', providerSessionId: 'S-1', title: 'Chat a' }],
      unresumableChatCount: 1
    })
  })

  it('reports nothing to import when Orca has never run here', () => {
    expect(
      scanOrcaProfile(join(tmpdir(), 'no-such-orca'), { claude: new Set(), codex: new Set() })
    ).toEqual({ status: 'not-found' })
  })
})
