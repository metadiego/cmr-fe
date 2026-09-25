"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { useIsDark } from "@/hooks/use-is-dark";
import { createClient } from "@/lib/supabase/client";
import {
  getPublicPreferences,
  getMyPreferences,
  type PublicPreferences,
  type MyPreferences,
} from "@/lib/api/preferences";
import { configToCssVars, type ThemeConfig } from "@/lib/theme/config";

// Whether AppShell's <main> (and anything else opaque) should back off to let the personal/center
// background show through the gaps. false by default: nobody's screen changes unless they (or their
// center) actually set one. Owner's request, 2026-09-25 — see .personal/
// apariencia-personal-restaurar-y-bloqueo-de-centro-handoff.md for why this couldn't just be CSS:
// every surface in this app (cards, header, sidebar) is deliberately opaque, and touching that
// opacity everywhere would be a real readability risk on billing/frontdesk — so it's opt-in, and
// only <main>'s own canvas (never the cards on top of it) responds.
const BackgroundContext = React.createContext(false);
export function useHasCustomBackground(): boolean {
  return React.useContext(BackgroundContext);
}

// Paints the effective theme (config por capas #51) by setting CSS custom
// properties on <html>. The BE resolves precedence (override → user → center →
// system); we only apply `effective`. If anything fails we keep the globals.css
// defaults. next-themes still owns light/dark — but a brand color's derived
// --accent tint DOES depend on which one is active (lib/theme/brand.ts), so this
// re-applies whenever the `dark` class flips, not just once at mount (2026-09-25
// review of #69: toggling the theme was leaving a stale, wrong-mode accent tint
// stuck until a hard reload — next-themes' own `resolvedTheme` wasn't reliably
// propagating to this consumer in time, `useIsDark`'s MutationObserver is). The
// fetch itself stays a one-time thing — only the CSS-var application re-runs on a
// theme flip, not another network round trip.
export function PresentationProvider({ children }: { children: React.ReactNode }) {
  const isDark = useIsDark();
  const { setTheme } = useTheme();
  const [effective, setEffective] = React.useState<ThemeConfig | null>(null);
  const [hasBackground, setHasBackground] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        const {
          data: { session },
        } = await createClient().auth.getSession();
        const res: PublicPreferences | MyPreferences = session
          ? await getMyPreferences()
          : await getPublicPreferences();
        if (!active) return;
        setEffective(res?.effective ?? null);
        const bg = res?.effective?.background;
        setHasBackground(!!(bg?.imageUrl || bg?.videoUrl));
        // El tema vive en el PERFIL, no en el navegador: se aplica el que resuelve el BE (claro por
        // defecto; oscuro solo si el usuario lo eligió), IGNORANDO lo que hubiera en localStorage — eso
        // es justo lo que antes dejaba el oscuro pegado en un Chrome. Handoff be-el-tema-arranca-en-claro.
        if (session) {
          const tema = (res as MyPreferences)?.tema;
          setTheme(tema === "oscuro" ? "dark" : "light");
        }
      } catch {
        // No preferences / not reachable → keep globals.css defaults.
      }
    })();

    return () => {
      active = false;
    };
    // setTheme de next-themes es estable; se incluye para satisfacer exhaustive-deps sin re-fetch.
  }, [setTheme]);

  React.useEffect(() => {
    if (!effective) return;
    const vars = configToCssVars(effective);
    const el = document.documentElement;
    for (const [name, value] of Object.entries(vars)) {
      el.style.setProperty(name, value);
    }
    // El ancho del recibo por centro se aplica por la variable --recibo-ancho (la escribe
    // configToCssVars desde effective.recibo.anchoMm) que usa `.recibo-print` como ancho del
    // CONTENIDO. No inyectamos `@page size`: `<medida> auto` es inválido y romper la página a
    // Letter; el papel lo define el media térmico elegido en el driver.
  }, [effective, isDark]);

  const videoUrl = effective?.background?.videoUrl ?? null;

  return (
    <BackgroundContext.Provider value={hasBackground}>
      {videoUrl && (
        <video
          key={videoUrl}
          src={videoUrl}
          className="fixed inset-0 -z-10 size-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
        />
      )}
      {children}
    </BackgroundContext.Provider>
  );
}
