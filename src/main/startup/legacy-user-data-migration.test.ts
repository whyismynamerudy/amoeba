import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolvePackagedUserDataPath } from '../../shared/app-user-data-dir'
import { migrateLegacyUserDataFolder } from './legacy-user-data-migration'

const roots: string[] = []

function appDataRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'amoeba-user-data-'))
  roots.push(root)
  return root
}

function writeProfile(userData: string, marker: string): void {
  mkdirSync(join(userData, 'profiles'), { recursive: true })
  writeFileSync(join(userData, 'marker.txt'), marker)
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('migrateLegacyUserDataFolder', () => {
  it('moves the Orca folder over an empty Amoeba folder Electron left behind', () => {
    const root = appDataRoot()
    writeProfile(join(root, 'orca'), 'orca')
    mkdirSync(join(root, 'amoeba'))

    migrateLegacyUserDataFolder(root)

    expect(existsSync(join(root, 'orca'))).toBe(false)
    expect(readFileSync(join(root, 'amoeba', 'marker.txt'), 'utf8')).toBe('orca')
    expect(resolvePackagedUserDataPath(root)).toBe(join(root, 'amoeba'))
  })

  it('carries entries into a non-empty Amoeba folder without overwriting', () => {
    const root = appDataRoot()
    writeProfile(join(root, 'orca'), 'orca')
    mkdirSync(join(root, 'amoeba'))
    writeFileSync(join(root, 'amoeba', 'marker.txt'), 'amoeba')

    migrateLegacyUserDataFolder(root)

    expect(existsSync(join(root, 'amoeba', 'profiles'))).toBe(true)
    expect(readFileSync(join(root, 'amoeba', 'marker.txt'), 'utf8')).toBe('amoeba')
  })

  it('leaves both folders alone once Amoeba has its own profile', () => {
    const root = appDataRoot()
    writeProfile(join(root, 'orca'), 'orca')
    writeProfile(join(root, 'amoeba'), 'amoeba')

    migrateLegacyUserDataFolder(root)

    expect(readFileSync(join(root, 'orca', 'marker.txt'), 'utf8')).toBe('orca')
    expect(readFileSync(join(root, 'amoeba', 'marker.txt'), 'utf8')).toBe('amoeba')
  })
})
