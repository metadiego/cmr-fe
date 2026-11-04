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
import { getCentrosDondePuedo, getMyCentros, type Centro } from "@/lib/api/centers";
import { useResource } from "@/hooks/use-resource";
import { useClinicFilter } from "@/hooks/use-clinic-filter";
import { canReceiveTransfer, transferClinicName } from "@/lib/inventario/transfer-clinics";
import { CenterFilter } from "@/components/kit/center-filter";
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
import { PageContainer, PageHeader } from "@/components/ui/page";

const ESTADO_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pendiente: "secondary",
  recibida: "default",
  recibida_parcial: "default",
  rechazada: "destructive",
  cancelada: "outline",
};
const ESTADOS = ["pendiente", "recibida", "recibida_parcial", "rechazada", "cancelada"];
const TODOS = "__todos__";

// Transfers with either end in a clinic the person reads (inventario.read, clinic filter on top): the
// PENDING inbox (actionable) first, then the HISTORY with its own filters.
export function TransferenciasList() {
  const t = useTranslations("transferencias");
  const tc = useTranslations("common");
  const clinics = useClinicFilter("inventario.read");
  // Clinics where the person can receive: "to receive" follows the transfer's destination, not the
  // active clinic (the BE receives in the destination clinic, inventario.recibir checked there).
  const receivableRes = useResource<Centro[]>(() => getCentrosDondePuedo("inventario.recibir"));
  const receivable = React.useMemo(
    () => (receivableRes.state.kind === "ok" ? receivableRes.state.data.map((c) => c.id) : []),
    [receivableRes.state],
  );

  const pendRes = useResource<Transferencia[]>(
    () => listTransferenciasPendientes(clinics.choice),
    [clinics.choiceKey],
  );
  const pendientes = pendRes.state.kind === "ok" ? pendRes.state.data : [];

  // Nombres de centro: me/centros (propio) ∪ destinos (los ajenos) → origen y destino resuelven.
  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const destinosRes = useResource<DestinoTransferencia[]>(() => getDestinosTransferencia());
  const centroNames = React.useMemo(() => {
    const m = new Map<string, string>();
    if (centrosRes.state.kind === "ok") centrosRes.state.data.forEach((c) => m.set(c.id, c.name));
    if (destinosRes.state.kind === "ok") destinosRes.state.data.forEach((d) => m.set(d.clinicId, d.name));
    return m;
  }, [centrosRes.state, destinosRes.state]);
  const centroName = (resolved: string | null | undefined, cid: string) =>
    transferClinicName(resolved, cid, (id) => centroNames.get(id), clinics.nameOf) ?? "—";

  // Filtros del historial.
  const [estado, setEstado] = React.useState<string>(TODOS);
  const [direccion, setDireccion] = React.useState<"todas" | "enviadas" | "recibidas">("todas");
  const histRes = useResource<TransferenciaHistorial[]>(
    () =>
      listTransferencias({
        status: estado === TODOS ? undefined : estado,
        address: direccion === "todas" ? undefined : direccion,
      }, clinics.choice),
    [estado, direccion, clinics.choiceKey],
  );
  const historial = histRes.state.kind === "ok" ? histRes.state.data : [];

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("help")}
        actions={
          <>
            {clinics.showFilter && (
              <CenterFilter centers={clinics.centers} selected={clinics.selected} onChange={clinics.setSelected} />
            )}
            <Button size="sm" asChild>
              <Link href="/inventory/transfers/new">
                <HugeiconsIcon icon={Add01Icon} className="size-4" />
                {t("new")}
              </Link>
            </Button>
          </>
        }
      />

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
              const porRecibir = canReceiveTransfer(tr, receivable);
              return (
                <tr key={tr.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{centroName(null, tr.sourceClinicId)} → {centroName(null, tr.destinationClinicId)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={ESTADO_VARIANT[tr.status] ?? "outline"}>{t(`estado.${tr.status}`)}</Badge>
                      {porRecibir && <Badge variant="destructive">{t("porRecibir")}</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{tr.reason ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/inventory/transfers/${tr.id}`}>{porRecibir ? t("recibirAprobar") : tc("view")}</Link>
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
                  {centroName(tr.originName, tr.sourceClinicId)} → {centroName(tr.destinationName, tr.destinationClinicId)}
                </td>
                <td className="px-3 py-2"><Badge variant={ESTADO_VARIANT[tr.status] ?? "outline"}>{t(`estado.${tr.status}`)}</Badge></td>
                <td className="px-3 py-2 text-muted-foreground">{tr.reason ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/inventory/transfers/${tr.id}`}>{tc("view")}</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
