"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShoppingCart01Icon } from "@hugeicons/core-free-icons";

import { getComprasPaciente, type ComprasPaciente, type CompraLinea } from "@/lib/api/frontdesk";
import { formatFechaSolo } from "@/lib/format/fecha";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Modal "compras del paciente" (extraído de fila-sesion.tsx para no amontonar un solo archivo
// gigante): compras del día + historial + totales. Disparado desde la columna fd_compras.
export function ComprasModal({
  open,
  onOpenChange,
  pacienteId,
  pacienteNombre,
  servicioId,
  servicioNombre,
  fecha,
  centro,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pacienteId: string;
  pacienteNombre: string;
  servicioId?: string;
  servicioNombre?: string;
  fecha: string;
  centro?: string;
}) {
  const t = useTranslations("frontdesk");
  const tc = useTranslations("common");
  // Moneda del negocio (USA/PR = USD). Formateador local (no hay uno compartido en el FE).
  const money = React.useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }), []);
  // Estado atado a la petición (key): evita setState síncrono en el efecto (solo en el async).
  const key = open ? `${pacienteId}|${servicioId ?? ""}|${fecha}|${centro ?? ""}` : "";
  const [data, setData] = React.useState<{ key: string; c: ComprasPaciente } | null>(null);
  const [failKey, setFailKey] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    let cancel = false;
    getComprasPaciente(pacienteId, servicioId, fecha, centro)
      .then((c) => { if (!cancel) setData({ key, c }); })
      .catch(() => { if (!cancel) setFailKey(key); });
    return () => { cancel = true; };
  }, [open, pacienteId, servicioId, fecha, centro, key]);

  const c = data && data.key === key ? data.c : null;
  const fallo = failKey === key && key !== "";
  const items = c?.delDia?.items ?? [];
  const historial = c?.historial ?? [];
  const tot = c?.totals ?? {};
  const num = (x: number | null | undefined) => (x == null ? "—" : String(x));
  const importe = (x: number | null | undefined) => (x == null ? "—" : money.format(x));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-muted/40 px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={ShoppingCart01Icon} className="size-5" />
            {t("compras.titulo")}
          </DialogTitle>
          <DialogDescription>
            {pacienteNombre}{servicioNombre ? ` · ${servicioNombre}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto">
          {c == null && !fallo && <p className="px-5 py-10 text-center text-sm text-muted-foreground">{tc("loading")}</p>}
          {fallo && <p className="px-5 py-10 text-center text-sm text-destructive">{tc("error")}</p>}
          {c != null && (
            <div className="space-y-5 px-5 py-4">
              {/* Totales: cuánto compró y —lo clave— cuánto le queda (pendientes destacado). */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ComprasStat label={t("compras.totCompras")} value={num(tot.compras)} />
                <ComprasStat label={t("compras.totComprado")} value={num(tot.sesionesCompradas)} />
                <ComprasStat label={t("compras.totEntregadas")} value={num(tot.deliveredSessions)} />
                <ComprasStat
                  label={t("compras.pendientes")}
                  value={num(tot.sesionesPendientes)}
                  highlight={(tot.sesionesPendientes ?? 0) > 0}
                />
              </div>

              {/* Bloque 1: comprado el DÍA DEL TABLERO. */}
              <section>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("compras.delDia")}{c.delDia?.date ? ` · ${formatFechaSolo(c.delDia.date)}` : ""}
                </h3>
                {items.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                    {t("compras.sinCompras")}
                  </p>
                ) : (
                  <ComprasTabla filas={items} t={t} num={num} importe={importe} />
                )}
              </section>

              {/* Bloque 2: historial completo (más reciente primero). */}
              <section>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("compras.historial")}
                </h3>
                {historial.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                    {t("compras.sinCompras")}
                  </p>
                ) : (
                  <ComprasTabla filas={historial} t={t} num={num} importe={importe} conFecha />
                )}
              </section>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Stat compacto para la tira de totales del modal de compras.
function ComprasStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={
        "rounded-md px-3 py-2 shadow-sm shadow-[rgba(16,32,64,0.06)] " +
        (highlight ? "bg-warning ring-1 ring-warning/40" : "bg-card ring-1 ring-foreground/10")
      }
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"text-lg font-bold tabular-nums " + (highlight ? "text-warning-foreground" : "")}>{value}</div>
    </div>
  );
}

// Tabla de líneas de compra reusable (bloque "del día" y "historial"). `conFecha` antepone la fecha.
function ComprasTabla({
  filas,
  t,
  num,
  importe,
  conFecha,
}: {
  filas: CompraLinea[];
  t: (k: string) => string;
  num: (x: number | null | undefined) => string;
  importe: (x: number | null | undefined) => string;
  conFecha?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {conFecha && <th className="px-3 py-2 font-semibold">{t("compras.fecha")}</th>}
            <th className="px-3 py-2 font-semibold">{t("compras.producto")}</th>
            <th className="px-3 py-2 font-semibold">{t("compras.factura")}</th>
            <th className="px-3 py-2 text-right font-semibold">{t("compras.sesiones")}</th>
            <th className="px-3 py-2 text-right font-semibold">{t("compras.entregadas")}</th>
            <th className="px-3 py-2 text-right font-semibold">{t("compras.pendientes")}</th>
            <th className="px-3 py-2 text-right font-semibold">{t("compras.importe")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {filas.map((f, i) => (
            <tr key={f.id ?? i} className="hover:bg-muted/30">
              {conFecha && <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatFechaSolo(f.date ?? "") || "—"}</td>}
              <td className="px-3 py-2">
                <span className="font-medium">{f.product ?? f.sku ?? "—"}</span>
                {f.product && f.sku && <span className="block text-xs text-muted-foreground">{f.sku}</span>}
              </td>
              <td className="px-3 py-2 tabular-nums text-muted-foreground">{f.invoiceNumber ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{num(f.sessions)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{num(f.entregadas)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {(f.pendientes ?? 0) > 0 ? (
                  <span className="font-semibold text-warning-foreground">{num(f.pendientes)}</span>
                ) : (
                  <span className="text-muted-foreground">{num(f.pendientes)}</span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{importe(f.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
