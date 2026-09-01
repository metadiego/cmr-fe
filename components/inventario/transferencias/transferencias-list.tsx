"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import {
  listTransferenciasPendientes,
  listTransferencias,
  getDestinosTransferencia,
  type Transferencia,
  type TransferenciaHistorial,
  type DestinoTransferencia,
} from "@/lib/api/transferencias";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { useResource } from "@/hooks/use-resource";
import { getActiveCentro } from "@/lib/tenant";
import { formatFechaSolo } from "@/lib/format/fecha";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ESTADO_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pendiente: "secondary",
  recibida: "default",
  recibida_parcial: "default",
  rechazada: "destructive",
  cancelada: "outline",
};
const ESTADOS = ["pendiente", "recibida", "recibida_parcial", "rechazada", "cancelada"];
const TODOS = "__todos__";

// Transferencias del centro: bandeja de PENDIENTES (accionable) arriba + HISTORIAL con filtros abajo.
export function TransferenciasList() {
  const t = useTranslations("transferencias");
  const tc = useTranslations("common");
  const activeCentro = getActiveCentro();

  const pendRes = useResource<Transferencia[]>(() => listTransferenciasPendientes());
  const pendientes = pendRes.state.kind === "ok" ? pendRes.state.data : [];

  // Nombres de centro: me/centros (propio) ∪ destinos (los ajenos) → origen y destino resuelven.
  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const destinosRes = useResource<DestinoTransferencia[]>(() => getDestinosTransferencia());
  const centroNames = React.useMemo(() => {
    const m = new Map<string, string>();
    if (centrosRes.state.kind === "ok") centrosRes.state.data.forEach((c) => m.set(c.id, c.nombre));
    if (destinosRes.state.kind === "ok") destinosRes.state.data.forEach((d) => m.set(d.clinicId, d.nombre));
    return m;
  }, [centrosRes.state, destinosRes.state]);
  const centroName = (cid: string) => centroNames.get(cid) ?? cid;

  // Filtros del historial.
  const [estado, setEstado] = React.useState<string>(TODOS);
  const [direccion, setDireccion] = React.useState<"todas" | "enviadas" | "recibidas">("todas");
  const histRes = useResource<TransferenciaHistorial[]>(
    () =>
      listTransferencias({
        estado: estado === TODOS ? undefined : estado,
        direccion: direccion === "todas" ? undefined : direccion,
      }),
    [estado, direccion],
  );
  const historial = histRes.state.kind === "ok" ? histRes.state.data : [];

  return (
    <div className="w-full px-6 py-8">
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

      {/* PENDIENTES (bandeja de trabajo) */}
      <h2 className="mb-2 text-sm font-semibold">{t("pendientesTitulo")}</h2>
      <div className="mb-8 overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
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
            {pendRes.state.kind === "loading" && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">{tc("loading")}</td></tr>
            )}
            {pendRes.state.kind === "fail" && (
              <tr><td colSpan={4} className="px-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">{tc("error")}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={pendRes.reload}>{tc("retry")}</Button>
              </td></tr>
            )}
            {pendRes.state.kind === "ok" && pendientes.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">{t("empty")}</td></tr>
            )}
            {pendientes.map((tr) => {
              const porRecibir = tr.estado === "pendiente" && activeCentro === tr.clinicDestinoId;
              return (
                <tr key={tr.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{centroName(tr.clinicOrigenId)} → {centroName(tr.clinicDestinoId)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={ESTADO_VARIANT[tr.estado] ?? "outline"}>{t(`estado.${tr.estado}`)}</Badge>
                      {porRecibir && <Badge variant="destructive">{t("porRecibir")}</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{tr.motivo ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/inventario/transferencias/${tr.id}`}>{porRecibir ? t("recibirAprobar") : tc("view")}</Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* HISTORIAL con filtros */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold">{t("historialTitulo")}</h2>
        <div className="ml-auto flex items-center gap-2">
          {/* Dirección: enviadas / recibidas / todas */}
          <div className="inline-flex rounded-md border p-0.5 text-xs">
            {(["todas", "enviadas", "recibidas"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDireccion(d)}
                className={
                  "rounded px-2.5 py-1 font-medium transition-colors " +
                  (direccion === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
                }
              >
                {t(`dir.${d}`)}
              </button>
            ))}
          </div>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>{t("estadoTodos")}</SelectItem>
              {ESTADOS.map((e) => <SelectItem key={e} value={e}>{t(`estado.${e}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{t("col.fecha")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.ruta")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.estado")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.motivo")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {histRes.state.kind === "loading" && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{tc("loading")}</td></tr>
            )}
            {histRes.state.kind === "fail" && (
              <tr><td colSpan={5} className="px-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">{tc("error")}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={histRes.reload}>{tc("retry")}</Button>
              </td></tr>
            )}
            {histRes.state.kind === "ok" && historial.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{t("historialVacio")}</td></tr>
            )}
            {historial.map((tr) => (
              <tr key={tr.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{tr.createdAt ? formatFechaSolo(tr.createdAt.slice(0, 10)) : "—"}</td>
                <td className="px-3 py-2 font-medium">
                  {(tr.origenNombre ?? centroName(tr.clinicOrigenId))} → {(tr.destinoNombre ?? centroName(tr.clinicDestinoId))}
                </td>
                <td className="px-3 py-2"><Badge variant={ESTADO_VARIANT[tr.estado] ?? "outline"}>{t(`estado.${tr.estado}`)}</Badge></td>
                <td className="px-3 py-2 text-muted-foreground">{tr.motivo ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/inventario/transferencias/${tr.id}`}>{tc("view")}</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
