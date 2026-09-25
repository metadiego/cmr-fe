"use client";

import * as React from "react";

// Whether <html> currently has the `dark` class — watched directly via MutationObserver instead of
// trusting next-themes' own `resolvedTheme` to propagate to every consumer in the exact same tick.
// Found necessary live (2026-09-25): components/theme/theme-editor.tsx's brand-accent preview
// (lib/theme/brand.ts's deriveBrandVars reads this same class at call time) stayed stuck on the
// light-mode tint after toggling the theme via the user menu, even with `resolvedTheme` in the
// effect's deps — this hook re-renders on the actual DOM mutation, so it can't miss the change.
export function useIsDark(): boolean {
  const [isDark, setIsDark] = React.useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );

  React.useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(el.classList.contains("dark"));
    });
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
