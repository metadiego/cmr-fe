"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import {
  getPublicPreferences,
  getMyPreferences,
} from "@/lib/api/preferences";
import { configToCssVars } from "@/lib/theme/config";

// Paints the effective theme (config por capas #51) by setting CSS custom
// properties on <html>. The BE resolves precedence (override → user → center →
// system); we only apply `effective`. If anything fails we keep the globals.css
// defaults. next-themes still owns light/dark.
//
// Note: this fetches client-side, so a custom theme applies just after mount
// (no flash for default themes, since effective == globals.css). Server-side
// injection is a future optimization.
export function PresentationProvider({ children }: { children: React.ReactNode }) {
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

        // Ancho del recibo por centro EN IMPRESIÓN: Chrome no acepta var() en `@page size`, así que el
        // default va literal (72mm) en globals.css y aquí SOLO inyectamos una regla @page cuando el
        // centro define otro ancho (rollo de 58mm → 48). Sin clave, no se toca nada (queda el default).
        const ancho = Number(res?.effective?.recibo?.anchoMm);
        const styleId = "recibo-page-size";
        const prev = document.getElementById(styleId);
        if (Number.isFinite(ancho) && ancho > 0 && ancho !== 72) {
          const style = prev ?? document.createElement("style");
          style.id = styleId;
          style.textContent = `@media print{@page{size:${ancho}mm auto;margin:0}}`;
          if (!prev) document.head.appendChild(style);
        } else if (prev) {
          prev.remove();
        }
      } catch {
        // No preferences / not reachable → keep globals.css defaults.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return <>{children}</>;
}
