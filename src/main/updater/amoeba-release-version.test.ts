import { describe, expect, it } from 'vitest'
import { shouldOfferAmoebaRelease } from './amoeba-release-version'

describe('shouldOfferAmoebaRelease', () => {
  it('offers only strictly newer stable releases to stable installs', () => {
    expect(shouldOfferAmoebaRelease('0.1.2', '0.1.3', false)).toBe(true)
    expect(shouldOfferAmoebaRelease('0.1.2', '0.2.0', false)).toBe(true)
    expect(shouldOfferAmoebaRelease('0.1.2', '0.1.2', true)).toBe(false)
    expect(shouldOfferAmoebaRelease('0.1.10', '0.1.9', true)).toBe(false)
  })

  it('never auto-prompts local builds but lets a manual check reach the published release', () => {
    expect(shouldOfferAmoebaRelease('0.1.1-local.7.abc1234', '0.1.2', false)).toBe(false)
    expect(shouldOfferAmoebaRelease('0.1.1-local.7.abc1234', '0.1.2', true)).toBe(true)
    // A local build of the same core version predates its release.
    expect(shouldOfferAmoebaRelease('0.1.2-local.3.def5678', '0.1.2', true)).toBe(true)
    // A manual check must not downgrade a local build ahead of the latest release.
    expect(shouldOfferAmoebaRelease('0.1.3-local.1.fff0000', '0.1.2', true)).toBe(false)
  })

  it('refuses versions it cannot parse', () => {
    expect(shouldOfferAmoebaRelease('dev', '0.1.3', true)).toBe(false)
    expect(shouldOfferAmoebaRelease('0.1.2', 'latest', true)).toBe(false)
  })
})
