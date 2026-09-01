"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { getPreparacionLegado, type PreparacionLegado, type PreparacionFila } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Preparación del legado: pacientes con cita próxima a quienes falta cargar disponibilidad heredada. El
// `estado` colorea la fila; `pendiente` es lo accionable (botón cargar). `omitidos`>0 = hay más que el
// tope (se dice). Permiso factura.retroactivo (lo aplica el BE). Handoff rol-multicentro-y-preparacion-legado.
function toneDe(estado: string): string {
  switch (estado) {
    case "pendiente": return "bg-warning text-warning-foreground";
    case "al_dia": return "bg-success text-success-foreground";
    case "record_ambiguo": return "bg-info text-info-foreground";
    case "sin_record": return "bg-muted text-muted-foreground";
    case "error": return "bg-destructive/10 text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function PreparacionLegadoPage() {
  const t = useTranslations("pacientes.preparacionLegado");
  const tc = useTranslations("common");
  const centro = useSearchParams().get("centro") ?? undefined;

  const [dias, setDias] = React.useState("7");
  const [query, setQuery] = React.useState({ dias: 7, limite: 100 });

  const { state } = useResource<PreparacionLegado>(
    () => getPreparacionLegado(query, centro),
    [query.dias, query.limite, centro],
  );
  const data = state.kind === "ok" ? state.data : null;
  const filas = data?.filas ?? [];

  function buscar() {
    const d = Math.max(1, Math.floor(Number(dias) || 7));
    setQuery({ dias: d, limite: 100 });
  }

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-md bg-card p-4 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10 no-print">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("dias")}</span>
          <Input value={dias} onChange={(e) => setDias(e.target.value)} inputMode="numeric" className="h-9 w-[120px]" />
        </label>
        <Button onClick={buscar} className="h-9">{t("buscar")}</Button>
      </div>

      {state.kind === "loading" && <p className="mt-6 text-sm text-muted-foreground">{tc("loading")}</p>}
      {state.kind === "fail" && (
        <p className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      )}

      {data && (
        <>
          {data.omitidos > 0 && (
            <div className="mt-4 rounded-md border border-warning/40 bg-warning px-3 py-2 text-sm text-warning-foreground">
              {t("omitidos", { mostrados: filas.length, total: data.total })}
            </div>
          )}
          <div className="mt-4 overflow-x-auto rounded-md bg-card shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">{t("col.paciente")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.record")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.proximaCita")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.estado")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.detalle")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.accion")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filas.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">{t("empty")}</td></tr>
                )}
                {filas.map((f) => <Row key={f.pacienteId} f={f} t={t} centro={centro} />)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageContainer>
  );
}

function Row({ f, t, centro }: { f: PreparacionFila; t: ReturnType<typeof useTranslations>; centro?: string }) {
  const detalle =
    f.estado === "error" ? (f.motivo || t("estado.error"))
    : f.estado === "record_ambiguo" ? t("nCandidatos", { n: f.candidatos?.length ?? 0 })
    : f.estado === "pendiente" ? t("nItems", { n: f.items?.length ?? 0 })
    : "—";
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-2 font-medium">{f.nombre || t("sinNombre")}</td>
      <td className="px-3 py-2 tabular-nums text-muted-foreground">{f.record || "—"}</td>
      <td className="px-3 py-2 tabular-nums">{f.proximaCita ? String(f.proximaCita).slice(0, 10) : "—"}</td>
      <td className="px-3 py-2">
        <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + toneDe(f.estado)}>
          {t.has(`estado.${f.estado}`) ? t(`estado.${f.estado}`) : f.estado}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{detalle}</td>
      <td className="px-3 py-2 text-right">
        {(f.estado === "pendiente" || f.estado === "record_ambiguo") && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/pacientes/disponibilidad-legado${centro ? `?centro=${centro}` : ""}`}>{t("cargar")}</Link>
          </Button>
        )}
      </td>
    </tr>
  );
}
