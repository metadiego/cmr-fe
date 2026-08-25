"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";

// Guarda cliente para pantallas de configuración DELICADA: se ocultan del menú, pero la URL directa
// entraba igual. Muestra un aviso en vez de una pantalla que falla al guardar (el BE es la autoridad y
// responde 403). Handoff configuracion-delicada-solo-admin.
export function ConfigGuard({ permiso, children }: { permiso: string; children: React.ReactNode }) {
  const t = useTranslations("configGuard");
  const { can, ready } = useCan();
  if (ready && !can(permiso)) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-16">
        <p className="rounded-xl border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          {t("sinPermiso")}
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
