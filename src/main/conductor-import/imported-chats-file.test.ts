import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ConductorImportedChat } from '../../shared/conductor-import-types'
import { ImportedChatsFile } from './imported-chats-file'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function userData(): string {
  const root = mkdtempSync(join(tmpdir(), 'amoeba-imported-chats-'))
  roots.push(root)
  return root
}

function chat(id: string, title: string): ConductorImportedChat {
  return {
    id,
    workspacePath: '/w',
    agent: 'claude',
    providerSessionId: `s-${id}`,
    title,
    updatedAt: 1
  }
}

describe('ImportedChatsFile', () => {
  it('refreshes pending chats on re-import but never brings back one already opened', () => {
    const file = new ImportedChatsFile(userData())
    file.save([chat('a', 'A'), chat('b', 'B')])
    file.forget('a')

    expect(file.save([chat('a', 'A again'), chat('b', 'B renamed'), chat('c', 'C')])).toEqual([
      chat('b', 'B renamed'),
      chat('c', 'C')
    ])
  })

  it('remembers an opened chat’s original activity under its new Amoeba session', () => {
    const file = new ImportedChatsFile(userData())
    file.save([{ ...chat('a', 'A'), updatedAt: 42 }])
    file.forget('a', { sessionId: 'claude_1' })

    expect(file.openedTimes()).toEqual({ claude_1: 42 })
  })

  it('reads the bare array earlier builds wrote', () => {
    const root = userData()
    writeFileSync(join(root, 'conductor-imported-chats.json'), JSON.stringify([chat('a', 'A')]))

    expect(new ImportedChatsFile(root).list()).toEqual([chat('a', 'A')])
  })
})
