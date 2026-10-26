export function canUseUpstreamReleaseFeed(appName: string): boolean {
  // Amoeba must not replace itself with an upstream build while its release feed is unset.
  return !/^amoeba\b/i.test(appName)
}
