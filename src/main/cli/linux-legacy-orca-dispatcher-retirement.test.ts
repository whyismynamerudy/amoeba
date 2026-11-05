import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { retireLinuxBareOrcaDispatcher } from './linux-legacy-orca-dispatcher-retirement'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function makeHome(): Promise<{ homePath: string; dispatcherPath: string }> {
  const homePath = await mkdtemp(join(tmpdir(), 'amoeba-dispatcher-retirement-'))
  roots.push(homePath)
  await mkdir(join(homePath, '.local', 'bin'), { recursive: true })
  return { homePath, dispatcherPath: join(homePath, '.local', 'bin', 'orca') }
}

describe.skipIf(process.platform === 'win32')('retireLinuxBareOrcaDispatcher', () => {
  it('removes the marked dispatcher earlier serve builds published', async () => {
    const { homePath, dispatcherPath } = await makeHome()
    await writeFile(
      dispatcherPath,
      '#!/usr/bin/env bash\n# orca-serve-bare-orca-dispatcher\nexec \'/opt/Amoeba/resources/bin/orca-ide\' "$@"\n',
      { mode: 0o755 }
    )

    await expect(retireLinuxBareOrcaDispatcher(homePath)).resolves.toBe(true)
    expect(existsSync(dispatcherPath)).toBe(false)
  })

  it('keeps an unmarked orca command, such as the GNOME screen reader shim', async () => {
    const { homePath, dispatcherPath } = await makeHome()
    await writeFile(dispatcherPath, '#!/bin/sh\nexec /usr/bin/orca "$@"\n', { mode: 0o755 })

    await expect(retireLinuxBareOrcaDispatcher(homePath)).resolves.toBe(false)
    expect(await readFile(dispatcherPath, 'utf8')).toContain('/usr/bin/orca')
  })

  it('keeps a symlink even when it targets a marked file', async () => {
    const { homePath, dispatcherPath } = await makeHome()
    const target = join(homePath, 'marked')
    await writeFile(target, '#!/usr/bin/env bash\n# orca-serve-bare-orca-dispatcher\n', {
      mode: 0o755
    })
    await symlink(target, dispatcherPath)

    await expect(retireLinuxBareOrcaDispatcher(homePath)).resolves.toBe(false)
    expect(existsSync(dispatcherPath)).toBe(true)
  })
})
