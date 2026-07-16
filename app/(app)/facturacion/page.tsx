"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

import { getFacturasTablero, type FacturaTablero } from "@/lib/api/facturas";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListToolbar } from "@/components/kit/list-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";
const ESTADOS = ["borrador", "emitida", "anulada", "devuelta_parcial", "devuelta_total"];
const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;

function fmtFecha(v: unknown, locale: string): string {
  if (v == null || v === "") return "—";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime())
    ? String(v)
    : new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-PR", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        timeZone: "America/Puerto_Rico",
      }).format(d);
}

function EstadoBadge({ estado }: { estado: string }) {
  const t = useTranslations("facturacionList.estado");
  const tone =
    estado === "borrador"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : estado === "anulada" || estado.startsWith("devuelta")
        ? "bg-destructive/15 text-destructive"
        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  return (
    <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + tone}>
      {t.has(estado) ? t(estado) : estado || "—"}
    </span>
  );
}

export default function FacturasListPage() {
  const t = useTranslations("facturacionList");
  const tRoot = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const params = useSearchParams();

  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [estado, setEstado] = React.useState(params.get("estado") ?? "");
  const [desde, setDesde] = React.useState(params.get("desde") ?? "");
  const [hasta, setHasta] = React.useState(params.get("hasta") ?? "");

  React.useEffect(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (estado) sp.set("estado", estado);
    if (desde) sp.set("desde", desde);
    if (hasta) sp.set("hasta", hasta);
    const qs = sp.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [q, estado, desde, hasta, router]);

  // Gate de centro (multi-tenant) → X-Tenant-ID. Lista metadata-driven del BE con columnas RESUELTAS
  // (incluye Cliente/Médico). contexto=general excluye las facturas de consulta médica.
  const gate = useCentroGate();
  const { state } = useResource<FacturaTablero>(
    () =>
      gate.centro
        ? getFacturasTablero({ q, estado, desde, hasta, contexto: "general" }, gate.centro)
        : Promise.resolve({ columnas: [], filas: [] }),
    [q, estado, desde, hasta, gate.centro],
  );

  const tablero = state.kind === "ok" ? state.data : null;
  // fac_acciones se reemplaza por nuestra celda de acciones (Ver → detalle).
  const columnas = (tablero?.columnas ?? []).filter((c) => c.clave !== "fac_acciones");
  const filas = tablero?.filas ?? [];

  function cell(clave: string, value: unknown) {
    if (clave === "fac_estado") return <EstadoBadge estado={String(value ?? "")} />;
    if (clave === "fac_total") return <span className="font-medium tabular-nums">{money(value)}</span>;
    if (clave === "fac_fecha") return <span className="tabular-nums">{fmtFecha(value, locale)}</span>;
    if (clave === "fac_numero")
      return <span className="font-mono tabular-nums">{value != null && value !== "" ? String(value) : t("draft")}</span>;
    return <span>{value == null || value === "" ? "—" : String(value)}</span>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/facturacion/reportes/consumo-insumos">{t("consumoInsumos")}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/facturacion/general">{t("nuevaVenta")}</Link>
          </Button>
        </div>
      </div>

      {gate.cargando ? (
        <p className="mt-8 text-sm text-muted-foreground">{tRoot("common.loading")}</p>
      ) : gate.necesitaPicker ? (
        <div className="mt-8 max-w-xl">
          <CentroPicker centros={gate.centros} onPick={gate.pick} />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {gate.puedeCambiar && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {tRoot("facturacion.general.centroLabel")} <span className="font-medium text-foreground">{gate.centroNombre}</span>
              </span>
              <button type="button" onClick={gate.cambiarCentro} className="text-xs font-medium text-primary hover:underline">
                {tRoot("facturacion.general.cambiarCentro")}
              </button>
            </div>
          )}

          <ListToolbar search={q} onSearchChange={setQ} searchPlaceholder={t("searchPlaceholder")}>
            <Select value={estado || ALL} onValueChange={(v) => setEstado(v === ALL ? "" : v)}>
              <SelectTrigger size="sm" className="w-[170px]"><SelectValue placeholder={t("allStates")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allStates")}</SelectItem>
                {ESTADOS.map((e) => <SelectItem key={e} value={e}>{t(`estado.${e}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label={t("from")} className="h-8 w-[150px]" />
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label={t("to")} className="h-8 w-[150px]" />
          </ListToolbar>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  {columnas.map((c) => (
                    <th key={c.clave} className="px-3 py-2 font-semibold">{tRoot(c.labelKey)}</th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold">{tRoot("fac.col.acciones")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {state.kind === "loading" && (
                  <tr><td colSpan={columnas.length + 1} className="px-3 py-8 text-center text-muted-foreground">{tRoot("common.loading")}</td></tr>
                )}
                {state.kind === "fail" && (
                  <tr><td colSpan={columnas.length + 1} className="px-3 py-8 text-center text-destructive">{tRoot("common.error")}</td></tr>
                )}
                {state.kind === "ok" && filas.length === 0 && (
                  <tr><td colSpan={columnas.length + 1} className="px-3 py-8 text-center text-muted-foreground">{t("empty")}</td></tr>
                )}
                {filas.map((f) => (
                  <tr
                    key={f.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => router.push(`/facturacion/${f.id}${gate.centro ? `?centro=${gate.centro}` : ""}`)}
                  >
                    {columnas.map((c) => (
                      <td key={c.clave} className="px-3 py-2">{cell(c.clave, f[c.clave])}</td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); router.push(`/facturacion/${f.id}${gate.centro ? `?centro=${gate.centro}` : ""}`); }}
                      >
                        {t("ver")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
