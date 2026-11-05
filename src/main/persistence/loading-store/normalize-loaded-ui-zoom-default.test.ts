import { homedir } from 'node:os'
import { expect, it, vi } from 'vitest'
import { getDefaultPersistedState } from '../../../shared/constants'
import type { PersistedState } from '../../../shared/persisted-state-types'
import { DEFAULT_UI_ZOOM_LEVEL } from '../../../shared/ui-zoom-level'
import { normalizeLoadedUiState } from './normalize-loaded-ui-state'

function loadUi(ui: Record<string, unknown>) {
  const defaults = getDefaultPersistedState(homedir())
  const parsed: PersistedState = JSON.parse(
    JSON.stringify({ ...defaults, ui: { ...defaults.ui, ...ui } })
  )
  return normalizeLoadedUiState(parsed, defaults, defaults.onboarding!, false, false, vi.fn())
}

it('moves a profile on the old 100% zoom to the new default once, and keeps chosen zooms', () => {
  expect(loadUi({ uiZoomLevel: 0, _uiZoomDefaultRaised: undefined }).uiZoomLevel).toBe(
    DEFAULT_UI_ZOOM_LEVEL
  )
  expect(loadUi({ uiZoomLevel: 1.5, _uiZoomDefaultRaised: undefined }).uiZoomLevel).toBe(1.5)
  expect(loadUi({ uiZoomLevel: 0, _uiZoomDefaultRaised: true }).uiZoomLevel).toBe(0)
})
