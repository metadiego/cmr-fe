"use client";

import { useTranslations } from "next-intl";

import { money } from "@/lib/caja/totales";
import { cn } from "@/lib/utils";

// Resumen por CAJERO de la división: cada usuario que facturó, su CONTEO de efectivo (de su cuadre)
// y sus VENTAS (de `reportes/dia.porCajero`, con nombre del BE). El TOTAL es la UNIÓN (Σ) de todos
// los cajeros = la vista consolidada. Clic en una fila = ver ese cajero (drill-in). Solo tokens.
export function DesgloseCajeros({
  cajeros,
  conteoPorCajero = {},
  meId,
  activeUsuarioId,
  onPick,
  showCash = true,
}: {
  cajeros: Array<{ usuarioId: string | null; nombre: string | null; total: number }>;
  conteoPorCajero?: Record<string, number>;
  meId: string | null;
  activeUsuarioId: string | null;
  onPick: (usuarioId: string | null) => void;
  // El cuadre TOTAL del día (handoff cuadre-unico-del-dia) no tiene un conteo de EFECTIVO por cajero
  // (solo el conteo único/suma del día entero) — mostrar esa columna en $0.00 sería engañoso, así que
  // se oculta en vez de fabricar un dato que no existe.
  showCash?: boolean;
}) {
  const t = useTranslations("caja.cashiers");
  const cols = showCash ? "grid-cols-[1fr_7rem_7rem]" : "grid-cols-[1fr_7rem]";

  if (cajeros.length === 0) {
    return (
      <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4">
        <h3 className="mb-1 text-sm font-semibold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  const totalVentas = cajeros.reduce((s, c) => s + c.total, 0);
  const totalConteo = cajeros.reduce(
    (s, c) => s + (c.usuarioId ? (conteoPorCajero[c.usuarioId] ?? 0) : 0),
    0,
  );

  return (
    <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className={cn("grid gap-x-3 border-b px-4 py-2.5 text-xs font-medium text-muted-foreground", cols)}>
        <span className="text-sm font-semibold text-foreground">{t("title")}</span>
        {showCash && <span className="text-right">{t("cash")}</span>}
        <span className="text-right">{t("sales")}</span>
      </div>
      <div className="divide-y">
        {cajeros.map((c) => {
          const activo = c.usuarioId === activeUsuarioId;
          const label =
            c.nombre ??
            (c.usuarioId === meId ? t("cashier") : (c.usuarioId ?? "—").slice(0, 8));
          const conteo = c.usuarioId ? (conteoPorCajero[c.usuarioId] ?? 0) : 0;
          return (
            <button
              key={c.usuarioId ?? "sin"}
              type="button"
              onClick={() => onPick(c.usuarioId)}
              className={cn(
                "grid w-full gap-x-3 px-4 py-2 text-left text-sm transition-colors hover:bg-accent/40",
                cols,
                activo && "bg-accent/60",
              )}
            >
              <span className="font-medium">{label}</span>
              {showCash && <span className="text-right tabular-nums">{money(conteo)}</span>}
              <span className="text-right tabular-nums">{money(c.total)}</span>
            </button>
          );
        })}
      </div>
      <div className={cn("grid gap-x-3 border-t px-4 py-2.5 text-sm font-semibold", cols)}>
        <span>{t("consolidated")}</span>
        {showCash && <span className="text-right tabular-nums">{money(totalConteo)}</span>}
        <span className="text-right tabular-nums">{money(totalVentas)}</span>
      </div>
    </div>
  );
}
