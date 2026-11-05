import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUNDLED_SKILL_SOURCES } from './bundled-skill-sources'
import { bundledSkillTextDigest } from './classify'

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..')

describe('embedded bundled skill sources', () => {
  it('carry exactly the repo’s skills/*/SKILL.md, LF-normalised', async () => {
    const names = (await readdir(join(REPO_ROOT, 'skills'), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    expect(BUNDLED_SKILL_SOURCES.map((source) => source.name)).toEqual(names)
    for (const source of BUNDLED_SKILL_SOURCES) {
      const onDisk = await readFile(join(REPO_ROOT, 'skills', source.name, 'SKILL.md'), 'utf8')
      expect(source.text).toBe(onDisk.replace(/\r\n?/gu, '\n'))
    }
  })

  it('list this build’s digest and agree with the released ledger', async () => {
    const readLedger = async (file: string) =>
      JSON.parse(await readFile(join(REPO_ROOT, 'resources', 'skills', file), 'utf8'))
    const ledger = await readLedger('released-digests.json')
    const formerNameLedger = await readLedger('former-name-digests.json')
    for (const source of BUNDLED_SKILL_SOURCES) {
      expect(source.releasedDigests).toContain(bundledSkillTextDigest(Buffer.from(source.text)))
      const formerDigests = (source.formerNames ?? []).flatMap(
        (name) => formerNameLedger.skills[name] ?? []
      )
      expect(source.releasedDigests).toEqual(
        [...new Set([...ledger.skills[source.name], ...formerDigests])].sort()
      )
    }
  })
})
