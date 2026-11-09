import { isPrereleaseAppVersion, isValidAppVersion } from '../../shared/app-version'

export const AMOEBA_RELEASE_REPO = 'whyismynamerudy/amoeba'
export const AMOEBA_DMG_ASSET_NAME = 'orca-macos-arm64.dmg'
const LATEST_RELEASE_URL = `https://api.github.com/repos/${AMOEBA_RELEASE_REPO}/releases/latest`
const FETCH_TIMEOUT_MS = 15_000

export type AmoebaRelease = {
  version: string
  releaseUrl: string
  dmgUrl: string
  dmgSize: number
  /** Lowercase hex SHA-256 from GitHub's asset digest. */
  sha256: string
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

/** GitHub reports asset digests as `sha256:<hex>`; anything else cannot be verified. */
export function parseSha256Digest(digest: unknown): string | null {
  if (typeof digest !== 'string') {
    return null
  }
  const match = /^sha256:([0-9a-f]{64})$/i.exec(digest.trim())
  return match ? match[1].toLowerCase() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Returns null when the release is not an installable stable build for this updater. */
export function parseAmoebaLatestRelease(json: unknown): AmoebaRelease | null {
  if (!isRecord(json) || json.draft === true || json.prerelease === true) {
    return null
  }
  const tag = typeof json.tag_name === 'string' ? json.tag_name : ''
  const version = tag.replace(/^v/i, '')
  if (!isValidAppVersion(version) || isPrereleaseAppVersion(version)) {
    return null
  }
  const assets = Array.isArray(json.assets) ? json.assets : []
  const dmg = assets.find(
    (asset): asset is Record<string, unknown> =>
      isRecord(asset) && asset.name === AMOEBA_DMG_ASSET_NAME
  )
  if (!dmg || typeof dmg.browser_download_url !== 'string') {
    return null
  }
  const sha256 = parseSha256Digest(dmg.digest)
  if (!sha256) {
    throw new Error(`Amoeba ${version} has no checksum for its download, so it cannot be verified.`)
  }
  return {
    version,
    releaseUrl:
      typeof json.html_url === 'string'
        ? json.html_url
        : `https://github.com/${AMOEBA_RELEASE_REPO}/releases/tag/${tag}`,
    dmgUrl: dmg.browser_download_url,
    dmgSize: typeof dmg.size === 'number' ? dmg.size : 0,
    sha256
  }
}

export async function fetchLatestAmoebaRelease(fetchImpl: Fetch): Promise<AmoebaRelease | null> {
  const response = await fetchImpl(LATEST_RELEASE_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  })
  if (response.status === 404) {
    // GitHub answers 404 until the first stable release exists.
    await response.body?.cancel()
    return null
  }
  if (!response.ok) {
    await response.body?.cancel()
    const rateLimited =
      response.status === 429 ||
      (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')
    throw new Error(
      rateLimited
        ? 'GitHub rate-limited the update check. Try again later.'
        : `The update check failed (HTTP ${response.status}).`
    )
  }
  return parseAmoebaLatestRelease(await response.json())
}
