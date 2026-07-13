"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import {
  listTransferenciasPendientes,
  type Transferencia,
} from "@/lib/api/transferencias";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { useResource } from "@/hooks/use-resource";
import { getActiveCentro } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ESTADO_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pendiente: "secondary",
  recibida: "default",
  recibida_parcial: "default",
  rechazada: "destructive",
  cancelada: "outline",
};

// Lista de transferencias pendientes del centro activo (como origen o destino).
export function TransferenciasList() {
  const t = useTranslations("transferencias");
  const tc = useTranslations("common");
  const { state, reload } = useResource<Transferencia[]>(() => listTransferenciasPendientes());
  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const rows = state.kind === "ok" ? state.data : [];
  const centroName = (cid: string) =>
    (centrosRes.state.kind === "ok" ? centrosRes.state.data : []).find((c) => c.id === cid)?.nombre ?? cid;
  const activeCentro = getActiveCentro();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button size="sm" asChild>
          <Link href="/inventario/transferencias/nueva">
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            {t("new")}
          </Link>
        </Button>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{t("col.ruta")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.estado")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.motivo")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {state.kind === "loading" && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">{tc("loading")}</td></tr>
            )}
            {state.kind === "fail" && (
              <tr><td colSpan={4} className="px-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">{tc("error")}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={reload}>{tc("retry")}</Button>
              </td></tr>
            )}
            {state.kind === "ok" && rows.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">{t("empty")}</td></tr>
            )}
            {rows.map((tr) => {
              const porRecibir = tr.estado === "pendiente" && activeCentro === tr.clinicDestinoId;
              return (
                <tr key={tr.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    {centroName(tr.clinicOrigenId)} → {centroName(tr.clinicDestinoId)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={ESTADO_VARIANT[tr.estado] ?? "outline"}>{t(`estado.${tr.estado}`)}</Badge>
                      {porRecibir && <Badge variant="destructive">{t("porRecibir")}</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{tr.motivo ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/inventario/transferencias/${tr.id}`}>
                        {porRecibir ? t("recibirAprobar") : tc("view")}
                      </Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
