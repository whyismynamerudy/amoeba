import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseAmoebaLatestRelease, type AmoebaRelease } from './amoeba-release-check'
import {
  AmoebaUpdateIntegrityError,
  amoebaDmgPath,
  downloadAmoebaDmg
} from './amoeba-update-download'

const PAYLOAD = Buffer.from('pretend this is a disk image')
const PAYLOAD_SHA = createHash('sha256').update(PAYLOAD).digest('hex')

function release(sha256: string): AmoebaRelease {
  return {
    version: '0.1.3',
    releaseUrl: 'https://github.com/whyismynamerudy/amoeba/releases/tag/v0.1.3',
    dmgUrl: 'https://example.invalid/orca-macos-arm64.dmg',
    dmgSize: PAYLOAD.byteLength,
    sha256
  }
}

describe('parseAmoebaLatestRelease', () => {
  const asset = {
    name: 'orca-macos-arm64.dmg',
    browser_download_url: 'https://example.invalid/orca-macos-arm64.dmg',
    size: 10,
    digest: `sha256:${PAYLOAD_SHA.toUpperCase()}`
  }

  it('reads the DMG asset and normalizes its digest', () => {
    expect(parseAmoebaLatestRelease({ tag_name: 'v0.1.3', assets: [asset] })).toMatchObject({
      version: '0.1.3',
      sha256: PAYLOAD_SHA
    })
  })

  it('skips drafts and prereleases, and rejects an unverifiable asset', () => {
    expect(
      parseAmoebaLatestRelease({ tag_name: 'v0.1.3', prerelease: true, assets: [asset] })
    ).toBe(null)
    expect(parseAmoebaLatestRelease({ tag_name: 'v0.1.4-rc.1', assets: [asset] })).toBe(null)
    expect(() =>
      parseAmoebaLatestRelease({ tag_name: 'v0.1.3', assets: [{ ...asset, digest: null }] })
    ).toThrow(/checksum/)
  })
})

describe('downloadAmoebaDmg', () => {
  let cacheDir: string

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'amoeba-download-test-'))
  })

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true })
  })

  const fetchPayload = vi.fn(async () => new Response(PAYLOAD))

  it('keeps the download only when its SHA-256 matches the published digest', async () => {
    const onProgress = vi.fn()
    const path = await downloadAmoebaDmg({
      release: release(PAYLOAD_SHA),
      cacheDir,
      fetchImpl: fetchPayload,
      onProgress
    })
    expect(await readFile(path)).toEqual(PAYLOAD)
    expect(onProgress).toHaveBeenLastCalledWith(1)
  })

  it('discards a mismatched download', async () => {
    await expect(
      downloadAmoebaDmg({
        release: release('0'.repeat(64)),
        cacheDir,
        fetchImpl: fetchPayload,
        onProgress: () => {}
      })
    ).rejects.toBeInstanceOf(AmoebaUpdateIntegrityError)
    expect(await readdir(cacheDir)).toEqual([])
  })

  it('replaces a corrupt cached file instead of trusting it', async () => {
    const cached = amoebaDmgPath(cacheDir, '0.1.3')
    await writeFile(cached, 'tampered')
    const fetchImpl = vi.fn(async () => new Response(PAYLOAD))
    await downloadAmoebaDmg({
      release: release(PAYLOAD_SHA),
      cacheDir,
      fetchImpl,
      onProgress: () => {}
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(await readFile(cached)).toEqual(PAYLOAD)
  })
})
