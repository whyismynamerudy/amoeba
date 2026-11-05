import { useNativeChatAppearanceStyle } from './native-chat-appearance-style'

const ORCA_14PX_SETTINGS = { nativeChatAppearance: { fontSize: 14 } }

/** Scroll and windowing scenarios whose pixel expectations were measured at Orca's 14px chat text. */
export function useNativeChatStoreAppearanceStyle(measuredColumnWidthPx?: number | null) {
  return useNativeChatAppearanceStyle(ORCA_14PX_SETTINGS, measuredColumnWidthPx)
}
