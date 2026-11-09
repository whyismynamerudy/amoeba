/** A rename with text pins the label; empty text returns it to automatic (branch-derived). */
export function displayNameUpdatePinsLabel(displayName: string | undefined): boolean {
  return Boolean(displayName?.trim())
}

/** Provenance stamped on every rename; only a pinned label can count as the user's own. */
export function displayNameUpdateProvenance(update: {
  displayName?: string
  displayNameChosenByUser?: boolean
}): { displayNameIsPinned: boolean; displayNameChosenByUser: boolean } {
  const pinned = displayNameUpdatePinsLabel(update.displayName)
  return {
    displayNameIsPinned: pinned,
    displayNameChosenByUser: pinned && update.displayNameChosenByUser === true
  }
}
