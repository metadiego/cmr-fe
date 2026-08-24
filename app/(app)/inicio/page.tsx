"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { getInicio } from "@/lib/api/preferences";
import { Button } from "@/components/ui/button";

// Aterrizaje al entrar: NO es una pantalla, es un resolver. Pregunta al BE a dónde va esta persona
// (GET /me/inicio, ya calculado por su menú y con el orden del trabajo diario) y la lleva ahí, sin dejar
// a todo el mundo en «Tu sesión». path null = no tiene ninguna pantalla → se lo decimos, no la dejamos
// mirando en blanco. Handoff al-entrar-cada-uno-a-su-trabajo.
type Estado =
  | { kind: "loading" }
  | { kind: "vacio" } // no tiene ninguna pantalla asignada
  | { kind: "fail"; message: string };

export default function InicioPage() {
  const router = useRouter();
  const t = useTranslations("inicio");
  const [estado, setEstado] = React.useState<Estado>({ kind: "loading" });

  React.useEffect(() => {
    let active = true;
    getInicio()
      .then((r) => {
        if (!active) return;
        if (r.path) router.replace(r.path);
        else setEstado({ kind: "vacio" });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setEstado({ kind: "fail", message: err instanceof Error ? err.message : String(err) });
      });
    return () => { active = false; };
  }, [router]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      {estado.kind === "loading" && (
        <>
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
          <p className="text-sm text-muted-foreground">{t("llevando")}</p>
        </>
      )}
      {estado.kind === "vacio" && (
        <>
          <h1 className="text-lg font-semibold">{t("sinPantalla.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("sinPantalla.desc")}</p>
          <Button variant="outline" size="sm" asChild className="mt-2"><Link href="/dashboard">{t("sinPantalla.aAjustes")}</Link></Button>
        </>
      )}
      {estado.kind === "fail" && (
        <>
          <p className="text-sm text-destructive">{estado.message}</p>
          <Button variant="outline" size="sm" asChild className="mt-2"><Link href="/dashboard">{t("sinPantalla.aAjustes")}</Link></Button>
        </>
      )}
    </div>
  );
}
