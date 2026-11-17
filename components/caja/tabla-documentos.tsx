"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { money } from "@/lib/caja/totales";

// Una tabla de documentos (handoff documentos-del-dia-por-division): con `titulo`, es una de las dos
// mitades del cuadre total (Venta general / Consultas); sin él, la lista única de una división o un
// cajero. Siempre con su total al pie — el que pasa el llamador (BE, nunca recalculado aquí dentro).
// Extraído de cuadre-detalle.tsx (ceiling).
export function TablaDocumentos({
  titulo,
  documentos,
  totalLabel,
  total,
  labels: td,
}: {
  titulo?: string;
  documentos: Array<{
    id: string;
    number: string | null;
    patient: string | null;
    medicalRecordNumber: string | null;
    formaPago: string | null;
    total: number;
    user?: { id: string; name: string | null } | null;
  }>;
  totalLabel: string;
  total: number;
  labels: ReturnType<typeof useTranslations>;
}) {
  return (
    <div>
      {titulo && (
        <h4 className="bg-muted/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </h4>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-semibold">{td("colNumero")}</th>
              <th className="px-4 py-2 text-left font-semibold">{td("colRecord")}</th>
              <th className="px-4 py-2 text-left font-semibold">{td("colPaciente")}</th>
              <th className="px-4 py-2 text-left font-semibold">{td("colFacturo")}</th>
              <th className="px-4 py-2 text-left font-semibold">{td("colFormaPago")}</th>
              <th className="px-4 py-2 text-right font-semibold">{td("colTotal")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {documentos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-sm text-muted-foreground">{td("sinDocumentos")}</td>
              </tr>
            ) : (
              documentos.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2 font-mono tabular-nums">{d.number || "—"}</td>
                  {/* Sin récord = celda vacía (no "null" ni guion raro). */}
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{d.medicalRecordNumber || ""}</td>
                  <td className="px-4 py-2">{d.patient || "—"}</td>
                  {/* Quién facturó: usuario.nombre; null (o nombre null = llave) → "—", nunca el id. */}
                  <td className="px-4 py-2">{d.user?.name || "—"}</td>
                  {/* Forma de pago YA resuelta en siglas: pintar tal cual. */}
                  <td className="px-4 py-2 font-mono text-xs">{d.formaPago || "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(d.total)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/20 font-semibold">
              <td colSpan={5} className="px-4 py-2 text-right text-xs uppercase tracking-wide text-muted-foreground">
                {totalLabel}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{money(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
