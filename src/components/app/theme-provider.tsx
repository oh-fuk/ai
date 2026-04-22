"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // `ThemeProviderProps` uses `forcedTheme` as the prop name; use that instead of `theme`.
  return <NextThemesProvider {...props} forcedTheme={(props as any).forcedTheme}>{children}</NextThemesProvider>
}
