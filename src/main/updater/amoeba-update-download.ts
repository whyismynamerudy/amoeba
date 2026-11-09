import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { AmoebaRelease } from './amoeba-release-check'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

export class AmoebaUpdateIntegrityError extends Error {
  constructor(version: string) {
    super(
      `The downloaded Amoeba ${version} did not match its published checksum and was discarded.`
    )
    this.name = 'AmoebaUpdateIntegrityError'
  }
}

export function amoebaDmgPath(cacheDir: string, version: string): string {
  return join(cacheDir, `Amoeba-${version}.dmg`)
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}

async function fileExists(path: string): Promise<boolean> {
  return stat(path).then(
    (info) => info.isFile(),
    () => false
  )
}

/** Hashes the bytes as written; a mismatch deletes them so they can never be staged. */
export async function downloadAmoebaDmg({
  release,
  cacheDir,
  fetchImpl,
  onProgress
}: {
  release: AmoebaRelease
  cacheDir: string
  fetchImpl: Fetch
  onProgress: (fraction: number) => void
}): Promise<string> {
  await mkdir(cacheDir, { recursive: true })
  const finalPath = amoebaDmgPath(cacheDir, release.version)
  if (await fileExists(finalPath)) {
    // A verified earlier download is reused; a corrupt one is discarded and fetched again.
    if ((await sha256File(finalPath)) === release.sha256) {
      onProgress(1)
      return finalPath
    }
    await rm(finalPath, { force: true })
  }

  const partialPath = `${finalPath}.partial`
  const response = await fetchImpl(release.dmgUrl)
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    throw new Error(`Could not download Amoeba ${release.version} (HTTP ${response.status}).`)
  }
  const total = Number(response.headers.get('content-length')) || release.dmgSize
  const hash = createHash('sha256')
  const file = await open(partialPath, 'w')
  let received = 0
  try {
    const reader = response.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      hash.update(value)
      await file.write(value)
      received += value.byteLength
      if (total > 0) {
        onProgress(Math.min(1, received / total))
      }
    }
  } catch (error) {
    await file.close()
    await rm(partialPath, { force: true })
    throw error
  }
  await file.close()

  if (hash.digest('hex') !== release.sha256) {
    await rm(partialPath, { force: true })
    throw new AmoebaUpdateIntegrityError(release.version)
  }
  await rename(partialPath, finalPath)
  onProgress(1)
  return finalPath
}
