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
