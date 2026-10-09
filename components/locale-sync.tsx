"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

import { useMe } from "@/hooks/use-me";
import { setLocale } from "@/i18n/locale-actions";
import { isLocale, type Locale } from "@/i18n/config";

// Aplica al ARRANCAR el idioma que el BE resolvió para la persona (/auth/me → `idioma`).
// next-intl pinta el primer render desde la cookie NEXT_LOCALE; si esa cookie no coincide
// con la preferencia del usuario (primer login en este navegador, o un cambio hecho en otro
// equipo), sincronizamos la cookie y refrescamos UNA vez para que la pantalla salga en su
// idioma. Para quien ya eligió aquí (cookie == preferencia) no hace nada. No pinta nada.
// Handoff idioma-por-usuario.
export function LocaleSync() {
  const me = useMe();
  const current = useLocale();
  const router = useRouter();
  // The last saved language this component has already reconciled against.
  const synced = React.useRef<string | null>(null);
  const idioma = me.kind === "ok" ? me.me.language : undefined;
  // Applying reads the CURRENT locale without the locale being an effect dependency. It used to be
  // one: picking a language in the user menu flipped the cookie (and the locale) while /auth/me
  // still carried the OLD saved language, so the effect re-ran and wrote the old one straight
  // back — the "language switches back" bug. Only a NEW saved language from the BE should sync.
  const apply = React.useEffectEvent((saved: Locale) => {
    if (saved === current) return;
    void setLocale(saved).then(() => router.refresh());
  });

  React.useEffect(() => {
    if (!idioma || !isLocale(idioma)) return;
    if (synced.current === idioma) return;
    synced.current = idioma;
    apply(idioma);
  }, [idioma]);

  return null;
}
