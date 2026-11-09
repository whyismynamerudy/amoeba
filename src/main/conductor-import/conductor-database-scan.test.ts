import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import SyncDatabase from '../sqlite/sync-database'
import { scanConductorDatabase } from './conductor-database-scan'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function conductorFixture(): { databasePath: string; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'amoeba-conductor-import-'))
  roots.push(root)
  mkdirSync(join(root, 'repo'))
  mkdirSync(join(root, 'workspaces', 'repo', 'tokyo'), { recursive: true })
  const databasePath = join(root, 'conductor.db')
  const db = new SyncDatabase(databasePath)
  db.exec(`
    CREATE TABLE repos (id TEXT, name TEXT, root_path TEXT, hidden INTEGER);
    CREATE TABLE workspaces (id TEXT, repository_id TEXT, workspace_path TEXT, branch TEXT,
      workspace_name TEXT, directory_name TEXT, state TEXT);
    CREATE TABLE sessions (id TEXT, workspace_id TEXT, agent_type TEXT, claude_session_id TEXT,
      title TEXT, updated_at TEXT, is_hidden INTEGER);
  `)
  db.prepare('INSERT INTO repos VALUES (?, ?, ?, 0)').run('r1', 'repo', join(root, 'repo'))
  const workspace = db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)')
  workspace.run(
    'w1',
    'r1',
    join(root, 'workspaces', 'repo', 'tokyo'),
    'feat/x',
    null,
    'tokyo',
    'ready'
  )
  // Archived, and a live row whose folder is gone: neither can be opened.
  workspace.run(
    'w2',
    'r1',
    join(root, 'workspaces', 'repo', 'oslo'),
    'old',
    null,
    'oslo',
    'archived'
  )
  workspace.run('w3', 'r1', join(root, 'workspaces', 'repo', 'lima'), 'gone', null, 'lima', 'ready')
  const session = db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?)')
  session.run('s1', 'w1', 'claude', 'CLAUDE-1', 'Fix login', '2026-09-03 21:24:16', 0)
  session.run('s2', 'w1', 'codex', 'codex-1', '', '2026-09-04 08:00:00', 0)
  session.run('s3', 'w1', 'claude', 'claude-pruned', 'Old chat', '2026-08-01 00:00:00', 0)
  session.run('s4', 'w1', 'claude', 'claude-hidden', 'Hidden', '2026-09-05 00:00:00', 1)
  session.run('s5', 'w2', 'claude', 'claude-archived', 'Archived', '2026-09-05 00:00:00', 0)
  db.close()
  return { databasePath, root }
}

describe('scanConductorDatabase', () => {
  it('returns live workspaces and only the chats their agents can still resume', () => {
    const { databasePath, root } = conductorFixture()
    const scan = scanConductorDatabase(databasePath, {
      claude: new Set(['claude-1']),
      codex: new Set(['codex-1'])
    })

    expect(scan).toMatchObject({
      status: 'ready',
      workspacesRoot: join(root, 'workspaces'),
      repos: [{ id: 'r1', name: 'repo' }],
      workspaces: [{ id: 'w1', name: 'tokyo', branch: 'feat/x' }],
      unresumableChatCount: 1
    })
    expect(scan.status === 'ready' ? scan.chats : []).toEqual([
      expect.objectContaining({
        id: 's1',
        agent: 'claude',
        title: 'Fix login',
        updatedAt: Date.UTC(2026, 8, 3, 21, 24, 16)
      }),
      expect.objectContaining({ id: 's2', agent: 'codex', title: 'Conductor chat' })
    ])
  })

  it('maps Conductor workflow statuses and keeps names the user typed', () => {
    const { databasePath } = conductorFixture()
    const db = new SyncDatabase(databasePath)
    db.exec(`
      ALTER TABLE workspaces ADD COLUMN manual_status TEXT;
      ALTER TABLE workspaces ADD COLUMN derived_status TEXT DEFAULT 'in-progress';
      ALTER TABLE workspaces ADD COLUMN user_set_workspace_name INTEGER;
      UPDATE workspaces SET derived_status = 'in-review', manual_status = 'done',
        workspace_name = 'Login fix', user_set_workspace_name = 1 WHERE id = 'w1';
    `)
    db.close()

    const scan = scanConductorDatabase(databasePath, { claude: new Set(), codex: new Set() })

    expect(scan.status === 'ready' ? scan.workspaces : []).toEqual([
      expect.objectContaining({ name: 'Login fix', nameChosenByUser: true, status: 'completed' })
    ])
  })

  it('reports a missing database as nothing to import', () => {
    expect(
      scanConductorDatabase(join(tmpdir(), 'no-conductor.db'), {
        claude: new Set(),
        codex: new Set()
      })
    ).toEqual({ status: 'not-found' })
  })
})
