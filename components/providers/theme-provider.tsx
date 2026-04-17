"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof NextThemesProvider>;

/**
 * Wraps next-themes ThemeProvider with GastroBridge defaults:
 *  - attribute="class" → writes `.dark` on <html>
 *  - defaultTheme="light"
 *  - enableSystem → respect prefers-color-scheme on first load
 *  - disableTransitionOnChange → no flash on theme swap
 *
 * Paired with `suppressHydrationWarning` on <html> to avoid SSR mismatch.
 */
export function ThemeProvider({ children, ...props }: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
