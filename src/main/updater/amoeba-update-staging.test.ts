import { cp, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProcessResult, ProcessSpec } from '@orca/process-host/process-spec'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { stageAmoebaBundle, type StagingProcessRunner } from './amoeba-update-staging'

function result(code: number, stdout = '', stderr = ''): ProcessResult {
  return { code, signal: null, stdout, stderr, timedOut: false }
}

/** Stands in for hdiutil/ditto/PlistBuddy/codesign; `attach` mounts a fake bundle. */
function fakeTools(overrides: { version?: string; codesignCode?: number } = {}) {
  const calls: string[] = []
  const run: StagingProcessRunner = async (spec: ProcessSpec) => {
    const args = spec.args ?? []
    const tool = spec.program.split('/').pop() ?? spec.program
    calls.push(tool === 'hdiutil' ? `hdiutil ${args[0]}` : tool)
    if (tool === 'hdiutil' && args[0] === 'attach') {
      await mkdir(join(args.at(-2) ?? '', 'Amoeba.app', 'Contents'), { recursive: true })
      return result(0)
    }
    if (tool === 'hdiutil') {
      // Unmounting empties the mountpoint.
      await rm(join(args.at(-1) ?? '', 'Amoeba.app'), { recursive: true, force: true })
      return result(0)
    }
    if (tool === 'ditto') {
      await cp(args[0], args[1], { recursive: true })
      return result(0)
    }
    if (tool === 'PlistBuddy') {
      return result(0, `${overrides.version ?? '0.1.3'}\n`)
    }
    return result(overrides.codesignCode ?? 0, '', 'code object is not signed at all')
  }
  return { run, calls }
}

describe('stageAmoebaBundle', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'amoeba-staging-test-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  const stage = (run: StagingProcessRunner) =>
    stageAmoebaBundle({
      dmgPath: join(root, 'update.dmg'),
      stagingDir: join(root, 'staged'),
      expectedVersion: '0.1.3',
      run,
      mountParent: root
    })

  it('copies the bundle out, detaches, and verifies version and signature', async () => {
    const { run, calls } = fakeTools()
    const staged = await stage(run)
    expect(staged).toBe(join(root, 'staged', 'Amoeba.app'))
    expect((await stat(staged)).isDirectory()).toBe(true)
    expect(calls).toEqual(['hdiutil attach', 'ditto', 'hdiutil detach', 'PlistBuddy', 'codesign'])
    // The temporary mountpoint is gone after a clean detach.
    expect((await readdir(root)).sort()).toEqual(['staged'])
  })

  it('rejects a bundle whose version differs from the release and removes it', async () => {
    const { run } = fakeTools({ version: '0.1.2' })
    await expect(stage(run)).rejects.toThrow(/version 0\.1\.2, expected 0\.1\.3/)
    expect(await readdir(root)).toEqual([])
  })

  it('rejects a bundle that fails codesign verification', async () => {
    const { run } = fakeTools({ codesignCode: 1 })
    await expect(stage(run)).rejects.toThrow(/signature verification.*not signed/)
    expect(await readdir(root)).toEqual([])
  })
})
