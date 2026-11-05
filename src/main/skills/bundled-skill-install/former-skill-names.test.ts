import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { BundledSkillSource } from './bundled-skill-sources'
import {
  NEW_SOURCE,
  NEW_TEXT,
  linkDirectory,
  makeSkillHome,
  previewAndInstall,
  removeSkillHomes,
  serviceInput,
  snapshot,
  writeCopy
} from './skill-home.test-support'

afterEach(removeSkillHomes)

const FORMER = 'old-skill'
const FORMER_TEXT = `---\nname: ${FORMER}\ndescription: Old\n---\n\nOld body\n`
const RENAMED_SOURCE: BundledSkillSource = {
  ...NEW_SOURCE,
  releasedDigests: [
    ...NEW_SOURCE.releasedDigests,
    createHash('sha256').update(FORMER_TEXT).digest('hex')
  ],
  formerNames: [FORMER]
}

function formerPath(newPath: string): string {
  return join(dirname(newPath), FORMER)
}

describe('renamed bundled skills', () => {
  it('moves untouched former-name copies and their links to the new name', async () => {
    const home = await makeSkillHome()
    await writeCopy(formerPath(home.shared), FORMER_TEXT)
    await mkdir(dirname(home.claude), { recursive: true })
    await linkDirectory(formerPath(home.shared), formerPath(home.claude))
    const input = { ...serviceInput(home, { installedOnly: true }), sources: [RENAMED_SOURCE] }

    await previewAndInstall(input)

    expect(await readFile(join(home.shared, 'SKILL.md'), 'utf8')).toBe(NEW_TEXT)
    expect(await realpath(home.claude)).toBe(home.shared)
    expect(await snapshot(formerPath(home.shared))).toBe('missing')
    expect(await snapshot(formerPath(home.claude))).toBe('missing')
  })

  it('accepts a former name and leaves a former-name copy Amoeba did not ship alone', async () => {
    const home = await makeSkillHome()
    const edited = `${FORMER_TEXT}\ninstalled by another app\n`
    await writeCopy(formerPath(home.claude), edited)
    const input = {
      ...serviceInput(home, { agents: ['claude'] }),
      sources: [RENAMED_SOURCE],
      names: [FORMER]
    }

    const { plan } = await previewAndInstall(input)

    expect(plan.skills.map((skill) => skill.name)).toEqual([NEW_SOURCE.name])
    expect(await readFile(join(home.shared, 'SKILL.md'), 'utf8')).toBe(NEW_TEXT)
    expect(await readFile(join(formerPath(home.claude), 'SKILL.md'), 'utf8')).toBe(edited)
  })
})
