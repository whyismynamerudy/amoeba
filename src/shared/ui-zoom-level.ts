/** Chromium's zoom-level base: one level step multiplies rendered size by this. */
export const UI_ZOOM_BASE = 1.2

export const UI_ZOOM_STEP = 0.5
export const UI_ZOOM_MIN = -3
export const UI_ZOOM_MAX = 5

/** Amoeba's "100%": one step above Chromium's base, so the chrome reads about 110% of Orca's size. */
export const DEFAULT_UI_ZOOM_LEVEL = UI_ZOOM_STEP

export type UIZoomDirection = 'in' | 'out' | 'reset'

export function stepUIZoomLevel(current: number, direction: UIZoomDirection): number {
  if (direction === 'reset') {
    return DEFAULT_UI_ZOOM_LEVEL
  }
  const next = direction === 'in' ? current + UI_ZOOM_STEP : current - UI_ZOOM_STEP
  return Math.max(UI_ZOOM_MIN, Math.min(UI_ZOOM_MAX, next))
}

/** CSS pixels × zoom factor = window DIP; convert for traffic lights, OS cursor positions and guest viewports. */
export function uiZoomFactorFromLevel(level: number): number {
  return UI_ZOOM_BASE ** level
}

/** Zoom as people see it: 100% at Amoeba's default level, not at Chromium's. */
export function uiZoomPercentFromLevel(level: number): number {
  return Math.round(100 * uiZoomFactorFromLevel(level - DEFAULT_UI_ZOOM_LEVEL))
}

/** Chats undo the default zoom step so messages keep their size while the chrome around them grows. */
export const CHAT_ZOOM_COMPENSATION = uiZoomFactorFromLevel(DEFAULT_UI_ZOOM_LEVEL)
