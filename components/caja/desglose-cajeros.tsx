"use client";

import { useTranslations } from "next-intl";

import { money } from "@/lib/caja/totales";
import { cn } from "@/lib/utils";

// Resumen por CAJERO de la división: cada usuario que facturó + su total de ventas (de
// `reportes/dia.porCajero`, con NOMBRE resuelto por el BE). El consolidado = Σ por-cajero.
// Clic en una fila = ver ese cajero (drill-in). Solo tokens.
export function DesgloseCajeros({
  cajeros,
  meId,
  activeUsuarioId,
  onPick,
}: {
  cajeros: Array<{ usuarioId: string | null; nombre: string | null; total: number }>;
  meId: string | null;
  activeUsuarioId: string | null;
  onPick: (usuarioId: string | null) => void;
}) {
  const t = useTranslations("caja.cashiers");

  if (cajeros.length === 0) {
    return (
      <div className="rounded-xl border p-4">
        <h3 className="mb-1 text-sm font-semibold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  const total = cajeros.reduce((s, c) => s + c.total, 0);

  return (
    <div className="rounded-xl border">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <span className="text-xs text-muted-foreground">{t("sales")}</span>
      </div>
      <div className="divide-y">
        {cajeros.map((c) => {
          const activo = c.usuarioId === activeUsuarioId;
          const label =
            c.nombre ??
            (c.usuarioId === meId ? t("cashier") : (c.usuarioId ?? "—").slice(0, 8));
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
      <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm font-semibold">
        <span>{t("consolidated")}</span>
        <span className="tabular-nums">{money(total)}</span>
      </div>
    </div>
  );
}
