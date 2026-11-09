import { describe, expect, it } from 'vitest'
import { getDefaultSettings } from '../../../shared/constants'
import { DEFAULT_NATIVE_CHAT_FONT_SIZE } from '../../../shared/native-chat-appearance-settings'
import { mergeSettings } from './preload-api/web-preference-normalization'

describe('browser-local chat appearance settings', () => {
  it('normalizes writes and old stored values, and preserves unrelated settings', () => {
    const base = getDefaultSettings('/tmp')
    const saved = mergeSettings(base, {
      nativeChatAppearance: { fontSize: 99, codeFontSize: 1, width: 'wide' }
    })
    expect(saved.nativeChatAppearance).toEqual({ fontSize: 20, codeFontSize: 10, width: 'wide' })
    expect(mergeSettings(saved, { theme: 'light' }).nativeChatAppearance).toEqual(
      saved.nativeChatAppearance
    )
    expect(
      mergeSettings(saved, { nativeChatAppearance: undefined }).nativeChatAppearance
    ).toBeUndefined()
    expect(
      mergeSettings(saved, {
        nativeChatAppearance: {
          fontSize: DEFAULT_NATIVE_CHAT_FONT_SIZE,
          codeFontSize: 12,
          width: 'comfortable'
        }
      }).nativeChatAppearance
    ).toBeUndefined()
  })
})
