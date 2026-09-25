"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import {
  getPublicPreferences,
  getMyPreferences,
} from "@/lib/api/preferences";
import { configToCssVars } from "@/lib/theme/config";

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
// defaults. next-themes still owns light/dark.
//
// Note: this fetches client-side, so a custom theme applies just after mount
// (no flash for default themes, since effective == globals.css). Server-side
// injection is a future optimization.
export function PresentationProvider({ children }: { children: React.ReactNode }) {
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [hasBackground, setHasBackground] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        const {
          data: { session },
        } = await createClient().auth.getSession();
        const res = session
          ? await getMyPreferences()
          : await getPublicPreferences();
        if (!active) return;

        const vars = configToCssVars(res?.effective);
        const el = document.documentElement;
        for (const [name, value] of Object.entries(vars)) {
          el.style.setProperty(name, value);
        }
        // El ancho del recibo por centro se aplica por la variable --recibo-ancho (la escribe
        // configToCssVars desde effective.recibo.anchoMm) que usa `.recibo-print` como ancho del
        // CONTENIDO. No inyectamos `@page size`: `<medida> auto` es inválido y romper la página a
        // Letter; el papel lo define el media térmico elegido en el driver.

        // Imagen: --app-bg-image ya la pinta configToCssVars y globals.css la aplica en <body>
        // (background-image/size/position/attachment) — nada más que hacer aquí. Video: no hay
        // forma de hacer loop de un <video> por CSS puro, así que se monta un elemento real, fijo,
        // detrás de todo. Mutuamente excluyentes (ThemeEditor nunca guarda ambos a la vez).
        const bg = res?.effective?.background;
        setVideoUrl(bg?.videoUrl ?? null);
        setHasBackground(!!(bg?.imageUrl || bg?.videoUrl));
      } catch {
        // No preferences / not reachable → keep globals.css defaults.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

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
