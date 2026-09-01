"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon } from "@hugeicons/core-free-icons";

import { getReporteDia, type ReporteDia } from "@/lib/api/caja";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Cuadre general: ventas del día por DIVISIÓN (General = productos+suero+láser; Consulta) desglosadas por
// forma de pago, más un TOTAL GENERAL que las suma. Todo sale del reporte del día del BE (una llamada por
// división); el FE solo suma las dos divisiones para el total. Réplica del legacy cma/cuadregeneral.
// Regla: NO recalcular montos individuales — vienen calzados del BE.
function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const money = (v: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v ?? 0));

type Metodo = { key: string; label: string; monto: number };
type Desglose = { efectivo: number; tarjetas: Metodo[]; otros: Metodo[]; totalTarjetas: number; total: number };

function desgloseDe(r: ReporteDia | null | undefined): Desglose {
  const det = r?.detalle;
  return {
    efectivo: Number(det?.efectivo?.monto ?? 0),
    tarjetas: (det?.tarjetas ?? []).map((t) => ({ key: t.clave, label: t.nombre, monto: Number(t.monto ?? 0) })),
    otros: (det?.otros ?? []).map((t) => ({ key: t.clave, label: t.nombre, monto: Number(t.monto ?? 0) })),
    totalTarjetas: Number(det?.totalTarjetas ?? 0),
    total: Number(det?.total ?? 0),
  };
}

// Suma dos divisiones por método (union por key). El total y el total-tarjetas se suman de los del BE.
function sumar(a: Desglose, b: Desglose): Desglose {
  const merge = (xa: Metodo[], xb: Metodo[]): Metodo[] => {
    const m = new Map<string, Metodo>();
    for (const x of [...xa, ...xb]) {
      const prev = m.get(x.key);
      m.set(x.key, { key: x.key, label: x.label, monto: (prev?.monto ?? 0) + x.monto });
    }
    return [...m.values()];
  };
  return {
    efectivo: a.efectivo + b.efectivo,
    tarjetas: merge(a.tarjetas, b.tarjetas),
    otros: merge(a.otros, b.otros),
    totalTarjetas: a.totalTarjetas + b.totalTarjetas,
    total: a.total + b.total,
  };
}

export default function CuadreGeneralPage() {
  const t = useTranslations("caja.cuadreGeneral");
  const tc = useTranslations("common");
  useSearchParams(); // el centro activo (tenant) lo resuelve el cliente, como el resto de caja

  const hoy = new Date();
  const [fecha, setFecha] = React.useState(isoDay(hoy));
  const [query, setQuery] = React.useState(isoDay(hoy));
  // Filtro «Quién facturó»: al elegir un cajero, TODA la hoja (ambas divisiones) se recarga acotada a él
  // (el BE lo aplica en las dos llamadas). null = totalizado de todos. Handoff cuadre-quien-facturo-por-cajero.
  const [usuarioId, setUsuarioId] = React.useState<string | null>(null);

  const { state } = useResource<{ general: ReporteDia; consulta: ReporteDia }>(
    async () => {
      const [general, consulta] = await Promise.all([
        getReporteDia(query, "general", usuarioId),
        getReporteDia(query, "consulta", usuarioId),
      ]);
      return { general, consulta };
    },
    [query, usuarioId],
  );

  const general = desgloseDe(state.kind === "ok" ? state.data.general : null);
  const consulta = desgloseDe(state.kind === "ok" ? state.data.consulta : null);
  const total = sumar(general, consulta);

  // «Quién facturó» de las DOS divisiones: unión por usuarioId (Σ debe dar el total del día). El nombre
  // lo resuelve el BE; ordenado de mayor a menor.
  const porCajero = React.useMemo(() => {
    if (state.kind !== "ok") return [] as Array<{ usuarioId: string | null; nombre: string | null; total: number }>;
    const m = new Map<string, { usuarioId: string | null; nombre: string | null; total: number }>();
    for (const c of [...(state.data.general.porCajero ?? []), ...(state.data.consulta.porCajero ?? [])]) {
      const k = c.usuarioId ?? "sin";
      const prev = m.get(k);
      m.set(k, { usuarioId: c.usuarioId, nombre: c.nombre ?? prev?.nombre ?? null, total: (prev?.total ?? 0) + Number(c.total ?? 0) });
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [state]);
  const cajeroActivo = usuarioId ? (porCajero.find((c) => c.usuarioId === usuarioId)?.nombre ?? usuarioId.slice(0, 8)) : null;

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("help")}
        actions={
          <div className="flex items-end gap-2 no-print">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("fecha")}</span>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-9 w-[160px]" />
            </label>
            <Button className="h-9" onClick={() => setQuery(fecha)}>{t("buscar")}</Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => window.print()} disabled={state.kind !== "ok"}>
              <HugeiconsIcon icon={PrinterIcon} className="size-4" /> {tc("print")}
            </Button>
          </div>
        }
      />

      {state.kind === "loading" && <p className="mt-6 text-sm text-muted-foreground">{tc("loading")}</p>}
      {state.kind === "fail" && (
        <p className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      )}

      {state.kind === "ok" && (
        <>
          {cajeroActivo && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-info/40 bg-info px-4 py-2.5 text-sm">
              <span className="font-medium text-info-foreground">
                {t("who.acotado", { cajero: cajeroActivo })}
              </span>
              <Button variant="outline" size="sm" className="h-8 no-print" onClick={() => setUsuarioId(null)}>
                {t("who.volver")}
              </Button>
            </div>
          )}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <CuadreCard title={t("general")} tono="general" d={general} totalLabel={t("totalDivision", { division: t("general") })} t={t} />
            <CuadreCard title={t("consulta")} tono="consulta" d={consulta} totalLabel={t("totalDivision", { division: t("consulta") })} t={t} />
          </div>
          <div className="mt-4 max-w-xl">
            <CuadreCard title={t("totalGeneral")} tono="total" d={total} totalLabel={t("totalGeneralRow")} t={t} destacado />
          </div>
          <div className="mt-4 max-w-xl">
            <WhoBilled cajeros={porCajero} total={total.total} activeUsuarioId={usuarioId} onPick={setUsuarioId} t={t} />
          </div>
        </>
      )}
    </PageContainer>
  );
}

function CuadreCard({
  title,
  tono,
  d,
  totalLabel,
  t,
  destacado,
}: {
  title: string;
  tono: "general" | "consulta" | "total";
  d: Desglose;
  totalLabel: string;
  t: ReturnType<typeof useTranslations>;
  destacado?: boolean;
}) {
  const head =
    tono === "total"
      ? "bg-primary text-primary-foreground"
      : tono === "general"
        ? "bg-emerald-500/90 text-white"
        : "bg-teal-500/90 text-white";
  const body = tono === "total" ? "bg-primary/90 text-primary-foreground" : tono === "general" ? "bg-emerald-500/15" : "bg-teal-500/15";
  const filas: Metodo[] = [
    { key: "__efectivo__", label: t("efectivo"), monto: d.efectivo },
    ...d.tarjetas,
    ...d.otros,
  ];
  const rowText = tono === "total" ? "text-white" : "";
  return (
    <div className="overflow-hidden rounded-md ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className={"px-4 py-2.5 text-center text-sm font-bold uppercase tracking-wide " + head}>{title}</div>
      <div className={body}>
        {filas.map((f) => (
          <Row key={f.key} label={f.label} value={money(f.monto)} className={rowText} />
        ))}
        <Row label={t("totalTarjetas")} value={money(d.totalTarjetas)} className={rowText} strong />
        <Row label={totalLabel} value={money(d.total)} className={rowText} strong grande />
      </div>
    </div>
  );
}

// Tabla «Quién facturó»: una fila por facturador (nombre + total, mayor a menor) y un pie con la Σ que
// debe coincidir con el total del día. Clic en una fila acota toda la hoja a ese cajero. §1 del handoff.
function WhoBilled({
  cajeros,
  total,
  activeUsuarioId,
  onPick,
  t,
}: {
  cajeros: Array<{ usuarioId: string | null; nombre: string | null; total: number }>;
  total: number;
  activeUsuarioId: string | null;
  onPick: (usuarioId: string | null) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const suma = cajeros.reduce((s, c) => s + Number(c.total ?? 0), 0);
  // Aviso honesto si la Σ por cajero NO da el total del día: es defecto del BE, no se maquilla.
  const descuadre = Math.abs(suma - total) > 0.005;
  return (
    <div className="overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className="bg-muted/60 px-4 py-2.5 text-sm font-bold uppercase tracking-wide">{t("who.title")}</div>
      {cajeros.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">{t("who.empty")}</p>
      ) : (
        <div className="divide-y">
          {cajeros.map((c) => {
            const activo = c.usuarioId === activeUsuarioId;
            const label = c.nombre ?? (c.usuarioId ?? "—").slice(0, 8);
            return (
              <button
                key={c.usuarioId ?? "sin"}
                type="button"
                onClick={() => onPick(c.usuarioId)}
                className={"flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-accent/40 " + (activo ? "bg-accent/60" : "")}
              >
                <span className="font-medium">{label}</span>
                <span className="tabular-nums">{money(c.total)}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-sm font-bold">
        <span>{t("who.total")}</span>
        <span className="tabular-nums">{money(suma)}</span>
      </div>
      {descuadre && (
        <p className="border-t bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">
          {t("who.descuadre", { total: money(total) })}
        </p>
      )}
    </div>
  );
}

function Row({ label, value, className, strong, grande }: { label: string; value: string; className?: string; strong?: boolean; grande?: boolean }) {
  return (
    <div className={"flex items-center justify-between gap-3 border-b border-black/5 px-4 py-2 last:border-0 " + (className ?? "")}>
      <span className={strong ? "text-sm font-bold" : "text-sm font-medium"}>{label}</span>
      <span className={"tabular-nums " + (grande ? "text-base font-bold" : strong ? "text-sm font-bold" : "text-sm")}>{value}</span>
    </div>
  );
}
