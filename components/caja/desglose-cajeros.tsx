"use client";

import { useTranslations } from "next-intl";

import { money } from "@/lib/caja/totales";
import { cn } from "@/lib/utils";

// Desglose por CAJERO de la división (solo gerencia): cada usuario que facturó + su total neto
// (de `reportes/dia.porCajero`). El consolidado = Σ por-cajero. Clic en una fila = ver ese cajero.
export function DesgloseCajeros({
  cajeros,
  meId,
  activeUsuarioId,
  onPick,
}: {
  cajeros: Array<{ usuarioId: string | null; total: number }>;
  meId: string | null;
  activeUsuarioId: string | null;
  onPick: (usuarioId: string | null) => void;
}) {
  const t = useTranslations("caja.cashiers");

  if (cajeros.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  const total = cajeros.reduce((s, c) => s + c.total, 0);

  return (
    <div className="rounded-xl border">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
      </div>
      <div className="divide-y">
        {cajeros.map((c) => {
          const activo = c.usuarioId === activeUsuarioId;
          const label =
            c.usuarioId === meId
              ? t("cashier") + " · " + shortId(c.usuarioId)
              : shortId(c.usuarioId);
          return (
            <button
              key={c.usuarioId ?? "sin"}
              type="button"
              onClick={() => onPick(c.usuarioId)}
              className={cn(
                "flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-accent/40",
                activo && "bg-accent/60",
              )}
            >
              <span className="font-medium">{label}</span>
              <span className="tabular-nums">{money(c.total)}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t px-4 py-3 text-sm font-semibold">
        <span>{t("consolidated")}</span>
        <span className="tabular-nums">{money(total)}</span>
      </div>
    </div>
  );
}

// El desglose viene con `usuarioId` (id de auth), sin nombre resoluble de forma fiable en el FE
// (id de auth ≠ perfilId). Se muestra un id corto legible; la resolución a nombre es mejora futura.
function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : "—";
}
