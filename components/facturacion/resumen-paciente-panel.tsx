"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";

import { getResumenPaciente, type ResumenPaciente } from "@/lib/api/facturas";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// «Lo que suma el paciente hoy»: panel PLEGABLE (cerrado por defecto) dentro de la factura, para cobrar
// varias facturas del mismo paciente sin calculadora. La SUMA la hace el BE (por `neto`, ya sin lo
// devuelto): aquí NO se suman `total` a mano. Handoff resumen-de-facturas-del-paciente.
const money = (v: number) => `$${(Number(v) || 0).toFixed(2)}`;

export function ResumenPacientePanel({
  pacienteId,
  facturaActualId,
  centro,
}: {
  pacienteId: string;
  facturaActualId: string;
  centro?: string;
}) {
  const t = useTranslations("resumenPaciente");
  const tRoot = useTranslations();
  const [open, setOpen] = React.useState(false);
  // Solo se pide al ABRIR (cerrado por defecto: quien no lo necesita no lo carga). Sin desde/hasta = hoy.
  const res = useResource<ResumenPaciente>(
    () => (open ? getResumenPaciente(pacienteId, undefined, centro) : Promise.resolve(null as unknown as ResumenPaciente)),
    [open, pacienteId, centro],
  );

  // conceptoLabelKeys son CLAVES i18n; si falta la traducción, mostrar el último segmento en cristiano.
  const concepto = (keys: string[]): string =>
    (keys ?? [])
      .map((k) => (tRoot.has(k) ? tRoot(k) : k.split(".").pop() ?? k))
      .join(", ");

  const data = res.state.kind === "ok" ? res.state.data : null;

  return (
    <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-sm font-semibold">{t("title")}</span>
        <HugeiconsIcon icon={open ? ArrowDown01Icon : ArrowRight01Icon} className="size-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="border-t px-2 pb-2">
          {res.state.kind === "loading" && (
            <p className="px-2 py-3 text-sm text-muted-foreground">{tRoot("common.loading")}</p>
          )}
          {res.state.kind === "fail" && (
            <p className="m-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {res.state.message}
            </p>
          )}

          {data && (
            <>
              {data.facturas.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">{t("vacio")}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr className="text-left">
                      <th className="px-2 py-1.5 font-semibold">{t("col.referencia")}</th>
                      <th className="px-2 py-1.5 font-semibold">{t("col.concepto")}</th>
                      <th className="px-2 py-1.5 text-right font-semibold">{t("col.importe")}</th>
                      <th className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.facturas.map((f) => {
                      const actual = f.id === facturaActualId;
                      return (
                        <tr
                          key={f.id}
                          className={cn(
                            actual && "bg-primary/5",
                            !f.cuenta && "opacity-50",
                          )}
                        >
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-2">
                              {actual && <span className="size-1.5 rounded-full bg-primary" aria-label={t("actual")} />}
                              <span className="font-medium">{f.referencia}</span>
                              <Badge variant="outline" className="text-[10px]">{f.estado}</Badge>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">{concepto(f.conceptoLabelKeys)}</td>
                          <td className={cn("px-2 py-1.5 text-right tabular-nums", !f.cuenta && "line-through")}>
                            {money(f.neto)}
                            {f.devuelto > 0 && (
                              <span className="ml-1 text-[10px] text-muted-foreground">({t("devuelto")} {money(f.devuelto)})</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {!actual && (
                              <Link
                                href={centro ? `/facturacion/${f.id}?centro=${centro}` : `/facturacion/${f.id}`}
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                {t("abrir")}
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2">
                    <tr className="font-semibold">
                      <td className="px-2 py-2" colSpan={2}>{t("totalGeneral")}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{money(data.totalGeneral)}</td>
                      <td />
                    </tr>
                    <tr className="text-xs text-muted-foreground">
                      <td className="px-2 pb-2" colSpan={2}>
                        {t("cobrado")} {money(data.totalCobrado)} · {t("pendiente")} {money(data.totalPendiente)}
                        {data.totalDevuelto > 0 && <> · {t("devueltoTotal")} {money(data.totalDevuelto)}</>}
                      </td>
                      <td className="px-2 pb-2 text-right" colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              )}
              {data.anuladasExcluidas > 0 && (
                <p className="px-2 py-1.5 text-[11px] text-muted-foreground">{t("anuladas", { n: data.anuladasExcluidas })}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
