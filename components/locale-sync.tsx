"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

import { useMe } from "@/hooks/use-me";
import { setLocale } from "@/i18n/locale-actions";
import { isLocale } from "@/i18n/config";

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
  // Evita re-disparar mientras el refresh está en vuelo (la cookie aún no cambió).
  const synced = React.useRef<string | null>(null);
  const idioma = me.kind === "ok" ? me.me.language : undefined;

  React.useEffect(() => {
    if (!idioma || !isLocale(idioma)) return;
    if (idioma === current) return;
    if (synced.current === idioma) return;
    synced.current = idioma;
    void setLocale(idioma).then(() => router.refresh());
  }, [idioma, current, router]);

  return null;
}
