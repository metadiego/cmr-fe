"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { getRefundHistory, type RefundHistoryEntry } from "@/lib/api/refund-detail";
import { useResource } from "@/hooks/use-resource";
import { Card, CardContent } from "@/components/ui/card";

// Pestaña «Historial» (BE PR #580): quién, cuándo, qué campo cambió — antes → después.
export function RefundHistory({ invoiceId, devId, centerId }: { invoiceId: string; devId: string; centerId?: string }) {
  const t = useTranslations("devoluciones.editor");
  const format = useFormatter();
  const { state } = useResource<RefundHistoryEntry[]>(() => getRefundHistory(invoiceId, devId, centerId), [invoiceId, devId, centerId]);

  if (state.kind === "loading") return <p className="text-sm text-muted-foreground">{t("historyLoading")}</p>;
  // Fallo del servidor ≠ "sin cambios": decirlo tal cual, no disfrazar un 500 de "no hay historial".
  if (state.kind === "fail") return <p className="text-sm text-destructive">{state.message}</p>;
  const rows = state.data;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>;

  return (
    <Card>
      <CardContent className="pt-6">
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={i} className="border-l-2 border-primary/30 pl-3 text-sm">
              <p className="font-medium">
                {format.dateTime(new Date(r.createdAt), "dateAndTime")}
                {r.actorName && <span className="font-normal text-muted-foreground"> · {r.actorName}</span>}
              </p>
              <p className="text-xs text-muted-foreground">{r.entityType} · {r.action}</p>
              {r.changedFields && typeof r.changedFields === "object" && (
                <ul className="mt-1 space-y-0.5 text-xs">
                  {Object.entries(r.changedFields as Record<string, { before?: unknown; after?: unknown }>).map(([field, ch]) => (
                    <li key={field}>
                      <span className="font-medium">{field}</span>: {String(ch?.before ?? "—")} → {String(ch?.after ?? "—")}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
