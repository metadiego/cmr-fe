"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { ReporteDia } from "@/lib/api/caja";
import { getPaciente } from "@/lib/api/pacientes";
import { money } from "@/lib/caja/totales";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Pendiente = ReporteDia["pendientes"][number];

// Bloque "Facturas Pendientes de Pago" del cuadre. Resuelve el nombre del cliente por id
// (best-effort; fail-soft al id si el fetch falla). Solo tokens.
export function FacturasPendientes({
  pendientes,
  centroId,
}: {
  pendientes: Pendiente[];
  centroId?: string;
}) {
  const t = useTranslations("caja.pending");
  const [nombres, setNombres] = React.useState<Record<string, string>>({});

  const ids = React.useMemo(
    () => Array.from(new Set(pendientes.map((p) => p.patientId).filter(Boolean))),
    [pendientes],
  );

  React.useEffect(() => {
    let activo = true;
    if (ids.length === 0) return;
    Promise.all(
      ids.map((id) =>
        getPaciente(id, centroId)
          .then((p) => [id, (p.displayName || [p.firstName, p.lastName].filter(Boolean).join(" ")).trim()] as const)
          .catch(() => [id, ""] as const),
      ),
    ).then((pares) => {
      if (!activo) return;
      const m: Record<string, string> = {};
      for (const [id, nombre] of pares) if (nombre) m[id] = nombre;
      setNombres(m);
    });
    return () => {
      activo = false;
    };
  }, [ids, centroId]);

  return (
    <div className="overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className="border-b px-4 py-2.5">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
      </div>
      {pendientes.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoice")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("client")}</TableHead>
                <TableHead className="text-right">{t("total")}</TableHead>
                <TableHead className="text-right">{t("paid")}</TableHead>
                <TableHead className="text-right">{t("pending")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendientes.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.number ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.date ?? "—"}</TableCell>
                  <TableCell>
                    {nombres[p.patientId] ?? p.patientId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.paidAmount)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-destructive">
                    {money(p.pendiente)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
