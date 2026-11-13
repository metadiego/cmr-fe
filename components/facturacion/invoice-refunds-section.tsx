"use client";

import * as React from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { listDevolucionesDeFactura, getReciboDevolucion, type Devolucion, type ReciboDevolucion } from "@/lib/api/facturas";
import { cantidadDevuelta } from "@/lib/factura/build-recibo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;

interface Props {
  invoiceId: string;
  centerId?: string;
}

// «Devoluciones» de la factura: qué se devolvió (líneas) de cada una, no solo el monto — así, al ver
// 3 y 3 vendidos arriba, se ve al lado que se devolvieron 2. Renders nothing for an invoice never
// refunded. Handoff .personal/handoff-ver-devolucion.md.
export function InvoiceRefundsSection({ invoiceId, centerId }: Props) {
  const t = useTranslations("devoluciones");
  const tEstado = useTranslations("devoluciones.estado");
  const format = useFormatter();
  const [rows, setRows] = React.useState<Array<Devolucion & { recibo: ReciboDevolucion | null }>>([]);

  React.useEffect(() => {
    let active = true;
    listDevolucionesDeFactura(invoiceId, centerId)
      .then((heads) =>
        Promise.all(
          heads.map((h) =>
            getReciboDevolucion(invoiceId, h.id, centerId)
              .then((recibo) => ({ ...h, recibo }))
              .catch(() => ({ ...h, recibo: null })),
          ),
        ),
      )
      .then((r) => active && setRows(r))
      .catch(() => active && setRows([]));
    return () => {
      active = false;
    };
  }, [invoiceId, centerId]);

  if (rows.length === 0) return null;

  return (
    <Card className="no-print">
      <CardHeader>
        <CardTitle>{t("sectionTitle", { count: rows.length })}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {rows.map((d) => (
            <li key={d.id} className="border-l-2 border-primary/30 pl-3">
              <Link
                href={`/billing/invoices/${invoiceId}/returns/${d.id}${centerId ? `?centro=${centerId}` : ""}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {d.displayNumber ?? "—"}
              </Link>
              <span className="ml-2 text-sm text-muted-foreground tabular-nums">
                {d.date ? format.dateTime(new Date(d.date), "dayShort") : "—"}
              </span>
              <Badge variant={d.status === "anulada" ? "destructive" : "success"} className="ml-2">
                {tEstado.has(String(d.status)) ? tEstado(String(d.status)) : String(d.status ?? "—")}
              </Badge>
              <span className="ml-2 text-sm font-semibold tabular-nums">{money(d.refundedAmount)}</span>
              {d.recibo && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {d.recibo.items
                    .map((it) => `${cantidadDevuelta(it)} × ${(it as { description?: string | null }).description ?? "—"}`)
                    .join(" · ") || "—"}
                </p>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
