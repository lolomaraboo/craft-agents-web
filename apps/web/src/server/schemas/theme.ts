import { Type } from '@sinclair/typebox'
import type { Static } from '@sinclair/typebox'

// Theme overrides (matches ThemeOverrides from @config/theme)
export const ThemeOverridesSchema = Type.Object({
  background: Type.Optional(Type.String()),
  foreground: Type.Optional(Type.String()),
  accent: Type.Optional(Type.String()),
  info: Type.Optional(Type.String()),
  success: Type.Optional(Type.String()),
  destructive: Type.Optional(Type.String()),
  backgroundImage: Type.Optional(Type.String()),
  dark: Type.Optional(Type.Object({
    background: Type.Optional(Type.String()),
    foreground: Type.Optional(Type.String()),
    accent: Type.Optional(Type.String()),
    info: Type.Optional(Type.String()),
    success: Type.Optional(Type.String()),
    destructive: Type.Optional(Type.String()),
  })),
})

export type ThemeOverrides = Static<typeof ThemeOverridesSchema>

// Color theme selection
export const ColorThemeSchema = Type.Object({
  themeId: Type.String(),
})

export type ColorTheme = Static<typeof ColorThemeSchema>
