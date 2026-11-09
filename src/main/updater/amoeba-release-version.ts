import { compareAppVersions, isValidAppVersion } from '../../shared/app-version'

/** Dev installs from build-mac-local report `x.y.z-local.<n>.<sha>`. */
export function isLocalAmoebaBuild(version: string): boolean {
  return /-local\./.test(version)
}

/** Local builds track unreleased work, so only an explicit check offers them the published release. */
export function shouldOfferAmoebaRelease(
  currentVersion: string,
  releaseVersion: string,
  userInitiated: boolean
): boolean {
  if (!isValidAppVersion(currentVersion) || !isValidAppVersion(releaseVersion)) {
    return false
  }
  if (isLocalAmoebaBuild(currentVersion) && !userInitiated) {
    return false
  }
  return compareAppVersions(releaseVersion, currentVersion) > 0
}
