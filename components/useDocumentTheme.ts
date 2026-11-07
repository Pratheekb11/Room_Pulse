"use client";

import { useEffect } from "react";
import { DEFAULT_THEME, themeStyle } from "@/lib/themes";

/**
 * Puts a presentation's slide design on the whole page (<html>), so the background, the footer
 * and every component follow it. Undone when the page leaves.
 */
export function useDocumentTheme(theme: string | undefined) {
  useEffect(() => {
    if (!theme || theme === DEFAULT_THEME) return;
    const root = document.documentElement;
    const style = themeStyle(theme);
    for (const [k, v] of Object.entries(style)) {
      if (k === "colorScheme") root.style.colorScheme = v;
      else root.style.setProperty(k, v);
    }
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const before = meta?.content;
    if (meta) meta.content = style["--color-canvas"];
    return () => {
      for (const k of Object.keys(style)) if (k !== "colorScheme") root.style.removeProperty(k);
      root.style.colorScheme = "";
      if (meta && before) meta.content = before;
    };
  }, [theme]);
}
