"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon, Alert02Icon } from "@hugeicons/core-free-icons";

import { getPendientesEntrega, type PendienteEntrega } from "@/lib/api/frontdesk";
import { aplicarCambioProtocolo, type CambioProtocaloNuevo } from "@/lib/api/protocol-change";
import { getCatalogoFacturacion, type Producto } from "@/lib/api/facturas";
import { listMedicos, type MedicoOpcion } from "@/lib/api/facturacion-config";
import { pendingAreas, toggleSealedUnits } from "@/lib/pacientes/protocol-change-origin";
import { originPrices, priceInvalid, priceOf } from "@/lib/pacientes/protocol-change-simulation";
import { ProtocolChangeSimulation } from "@/components/clientes/protocol-change-simulation";
import { isUsableLine, protocolChangeInvalid, protocolChangeMissing } from "@/lib/pacientes/protocol-change-missing";
import { callIfPermitted } from "@/lib/rbac/call-if-permitted";
import { useResource } from "@/hooks/use-resource";
import { useMe } from "@/hooks/use-me";
import { Field } from "@/components/kit/field";
import { FormFooter } from "@/components/kit/form-footer";
import { RequiredLegend, RequiredMark } from "@/components/kit/required-mark";
import { useSubmit } from "@/components/kit/use-submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ControlSkeleton, LoadingRegion } from "@/components/kit/skeletons";

// Formulario de CAMBIO DE PROTOCOLO para UN paciente ya conocido (sin buscador): el médico deja sin efecto
// sesiones pendientes y las reemplaza por otras. Pieza reutilizable montada en la pestaña de la ficha y en la
// ruta suelta (el buscador vive fuera). Todo-o-nada; el BE avisa si las cantidades se alejan, no bloquea.
// Permiso tratamiento.cambio_protocolo (lo gatea el contenedor). Handoff cambio-de-protocolo-a-la-ficha.

type NuevaLinea = { key: number; productoId: string; sesiones: string; cantidad: string; areas: string; dosis: string };
let _k = 0;
const nuevaLinea = (): NuevaLinea => ({ key: ++_k, productoId: "", sesiones: "", cantidad: "", areas: "", dosis: "" });

export function CambioProtocoloForm({
  pacienteId,
  centro,
  onApplied,
}: {
  pacienteId: string;
  centro?: string;
  onApplied?: () => void;
}) {
  const t = useTranslations("pacientes.cambioProtocolo");
  const tc = useTranslations("common");
  const tRoot = useTranslations();

  const me = useMe();
  const permissions = me.kind === "ok" ? me.me.permissions : [];
  const pendRes = useResource<PendienteEntrega[]>(
    () =>
      pacienteId
        // invoice.read: sin él, el BE 403 cada llamada (handoff-ruido-403-auditoria.md).
        ? callIfPermitted(permissions, "invoice.read", () => getPendientesEntrega(pacienteId, centro), [])
        : Promise.resolve([]),
    [pacienteId, centro, permissions.join(",")],
  );
  const pendientes = (pendRes.state.kind === "ok" ? pendRes.state.data : []).filter((p) => (p.pendiente ?? 0) > 0 || (p.totalSessions ?? 0) > 0);

  const catRes = useResource<Producto[]>(() => (centro ? getCatalogoFacturacion(centro) : Promise.resolve([])), [centro]);
  const catalogo = catRes.state.kind === "ok" ? catRes.state.data : [];
  const medRes = useResource<MedicoOpcion[]>(() => listMedicos(centro ?? undefined), [centro]);
  const medicos = medRes.state.kind === "ok" ? medRes.state.data : [];

  const [origenSel, setOrigenSel] = React.useState<Set<string>>(new Set());
  const [lineas, setLineas] = React.useState<NuevaLinea[]>([nuevaLinea()]);
  const [medicoId, setMedicoId] = React.useState<string>("");
  const [motivo, setMotivo] = React.useState<string>("");
  const [reintegros, setReintegros] = React.useState<Record<string, string>>({});
  // Agreed prices per unit for the simulation (cmr-be #691): by package id (closes) and by line key (creates).
  const [closePrices, setClosePrices] = React.useState<Record<string, string>>({});
  const [createPrices, setCreatePrices] = React.useState<Record<number, string>>({});

  function resetForm() {
    setOrigenSel(new Set());
    setLineas([nuevaLinea()]);
    setMedicoId("");
    setMotivo("");
    setReintegros({});
    setClosePrices({});
    setCreatePrices({});
  }

  // Al cambiar de paciente, limpiar la selección/borrador.
  const [prevPid, setPrevPid] = React.useState(pacienteId);
  if (pacienteId !== prevPid) {
    setPrevPid(pacienteId);
    resetForm();
  }

  function toggleOrigen(id: string, pendiente: number | null | undefined) {
    const checked = !origenSel.has(id);
    setOrigenSel((s) => { const n = new Set(s); if (checked) n.add(id); else n.delete(id); return n; });
    // Ticked → the sealed units start at the whole pending count, selected; unticked → cleared.
    setReintegros((r) => toggleSealedUnits(r, id, checked, pendiente));
  }
  function setLinea(key: number, patch: Partial<NuevaLinea>) {
    setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const usableLines = lineas.filter(isUsableLine);
  const nuevosValidos: CambioProtocaloNuevo[] = usableLines
    .map((l) => ({
      productId: l.productoId,
      totalSessions: Math.max(1, Math.floor(Number(l.sesiones) || 0)),
      ...(l.cantidad.trim() ? { quantity: Number(l.cantidad) } : {}),
      ...(l.areas.trim() ? { areas: Number(l.areas) } : {}),
      ...(l.dosis.trim() ? { dose: Number(l.dosis) } : {}),
      ...(priceOf(createPrices[l.key]) !== undefined ? { precioUnitario: priceOf(createPrices[l.key]) } : {}),
    }));
  const ticked = [...origenSel];
  const preciosOrigen = originPrices(ticked, closePrices);
  const priceBad =
    ticked.some((id) => priceInvalid(closePrices[id])) || usableLines.some((l) => priceInvalid(createPrices[l.key]));
  // The simulation body: the same as apply's, without the reason. Null until both sides exist.
  const simBody =
    ticked.length > 0 && nuevosValidos.length > 0 && !priceBad
      ? { paqueteOrigenIds: ticked, newOnes: nuevosValidos, ...(preciosOrigen.length ? { preciosOrigen } : {}) }
      : null;

  const missingLabel = { origin: t("paso1"), product: t("producto"), sessions: t("sesiones"), reason: t("motivo") };
  const missing = protocolChangeMissing({ originCount: origenSel.size, lines: lineas, reason: motivo }).map((k) => missingLabel[k]);
  const invalid = protocolChangeInvalid(lineas) ?? (priceBad ? "priceInvalid" : null);

  const { submitting, submit } = useSubmit(
    async () => {
      // Unreachable from the screen (the container always passes the patient); never "succeed" without saving.
      if (!pacienteId) throw new Error(t("paciente"));
      const reint = Object.entries(reintegros)
        .map(([paqueteId, v]) => ({ paqueteId, n: Math.floor(Number(v) || 0) }))
        .filter((r) => r.n > 0)
        .map((r) => {
          const p = pendientes.find((x) => x.id === r.paqueteId);
          return p ? { productId: p.productId, unidadesSelladas: r.n } : null;
        })
        .filter(Boolean) as { productId: string; unidadesSelladas: number }[];
      return aplicarCambioProtocolo(
        pacienteId,
        {
          paqueteOrigenIds: ticked,
          newOnes: nuevosValidos,
          ...(preciosOrigen.length ? { preciosOrigen } : {}),
          reason: motivo.trim(),
          ...(medicoId ? { doctorId: medicoId } : {}),
          ...(reint.length ? { reintegros: reint } : {}),
        },
        centro,
      );
    },
    {
      successMessage: t("aplicado"),
      onSuccess: (res) => {
        (res.avisos ?? []).forEach((a) => toast.warning(a.labelKey && tRoot.has(a.labelKey) ? tRoot(a.labelKey) : (a.message ?? "")));
        resetForm();
        pendRes.refresh(); // silent: the list updates in place, no skeleton after applying
        onApplied?.();
      },
    },
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Paso 1: qué se reemplaza */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("paso1")}<RequiredMark /></h2>
        {pendRes.state.kind === "loading" && (
          <LoadingRegion>
            <ul className="space-y-2">
              {["w-40", "w-52", "w-36"].map((w) => (
                <li key={w} className="flex items-start gap-2 rounded-md px-3 py-2 ring-1 ring-foreground/10">
                  <Skeleton className="mt-0.5 size-4 shrink-0 rounded-[4px]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex h-5 items-center"><Skeleton className={"h-3.5 " + w} /></span>
                    <span className="flex h-4 items-center"><Skeleton className="h-3 w-28" /></span>
                  </span>
                </li>
              ))}
            </ul>
          </LoadingRegion>
        )}
        {pendRes.state.kind === "ok" && pendientes.length === 0 && (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{t("sinPendientes")}</p>
        )}
        <ul className="space-y-2">
          {pendientes.map((p) => {
            const marcado = origenSel.has(p.id);
            const areas = pendingAreas(p);
            return (
              <li key={p.id} className={"rounded-md ring-1 ring-foreground/10 px-3 py-2 " + (marcado ? "border-primary bg-primary/5" : "")}>
                <label className="flex items-start gap-2">
                  <Checkbox checked={marcado} onCheckedChange={() => toggleOrigen(p.id, p.pendiente)} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{p.productoNombre ?? p.sku ?? "—"}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {t("pendientesN", { n: p.pendiente ?? 0, total: p.totalSessions ?? 0 })}
                    </span>
                    {areas && (
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {t("areasPending", { perSession: areas.perSession, pending: areas.pending })}
                      </span>
                    )}
                  </span>
                </label>
                {marcado && (
                  <div className="mt-2 flex items-center gap-2 pl-6">
                    <Label className="text-[11px] text-muted-foreground">{t("reintegro")}</Label>
                    <Input
                      value={reintegros[p.id] ?? ""}
                      onChange={(e) => setReintegros((r) => ({ ...r, [p.id]: e.target.value }))}
                      onFocus={(e) => e.currentTarget.select()}
                      autoFocus
                      inputMode="numeric"
                      className="h-7 w-20 text-right tabular-nums"
                      placeholder="0"
                    />
                    <span className="text-[11px] text-muted-foreground">{t("reintegroAyuda")}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Paso 2: por qué / con qué se reemplaza */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("paso2")}</h2>
        <div className="space-y-2">
          {lineas.map((l) => (
            <div key={l.key} className="rounded-md bg-card p-2 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("producto")}<RequiredMark /></span>
              <div className="flex items-center gap-2">
                {catRes.state.kind === "loading" ? (
                  <ControlSkeleton className="w-auto flex-1" />
                ) : (
                  <Select value={l.productoId} onValueChange={(v) => setLinea(l.key, { productoId: v })}>
                    <SelectTrigger className="h-9 flex-1" aria-label={t("producto")} aria-required><SelectValue placeholder={t("producto")} /></SelectTrigger>
                    <SelectContent>
                      {catalogo.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {lineas.length > 1 && (
                  <button type="button" onClick={() => setLineas((ls) => ls.filter((x) => x.key !== l.key))} aria-label={tc("remove")} className="text-destructive hover:opacity-70">
                    <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                  </button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                <Campo label={t("sesiones")} value={l.sesiones} onChange={(v) => setLinea(l.key, { sesiones: v })} req />
                <Campo label={t("cantidad")} value={l.cantidad} onChange={(v) => setLinea(l.key, { cantidad: v })} />
                <Campo label={t("areas")} value={l.areas} onChange={(v) => setLinea(l.key, { areas: v })} />
                <Campo label={t("dosis")} value={l.dosis} onChange={(v) => setLinea(l.key, { dosis: v })} />
              </div>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => setLineas((ls) => [...ls, nuevaLinea()])}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" /> {t("agregarLinea")}
          </Button>
        </div>

        <div className="space-y-1">
          <Label>{t("medico")}</Label>
          {medRes.state.kind === "loading" ? (
            <ControlSkeleton className="w-48" />
          ) : (
            <Select value={medicoId || undefined} onValueChange={setMedicoId}>
              <SelectTrigger className="h-9"><SelectValue placeholder={t("medicoPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {medicos.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <Field label={t("motivo")} required>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("motivoPlaceholder")} />
        </Field>

        <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning px-3 py-2 text-xs text-warning-foreground">
          <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" />
          {t("aviso")}
        </p>
      </section>

      {/* Simulacro, then apply or discard (owner, 24-nov-2026): full width under both steps. */}
      <div className="space-y-4 lg:col-span-2">
        <ProtocolChangeSimulation
          pacienteId={pacienteId ?? ""}
          centro={centro}
          body={pacienteId ? simBody : null}
          closePrices={closePrices}
          onClosePrice={(id, v) => setClosePrices((m) => ({ ...m, [id]: v }))}
          createKeys={usableLines.map((l) => l.key)}
          createPrices={createPrices}
          onCreatePrice={(k, v) => setCreatePrices((m) => ({ ...m, [k]: v }))}
        />
        <FormFooter
          primary={{ label: t("aplicar"), onClick: () => submit() }}
          missing={missing}
          reason={invalid ? t(invalid) : null}
          blocked={!!invalid}
          submitting={submitting}
          onCancel={resetForm}
          cancelLabel={t("descartar")}
          extra={<RequiredLegend className="text-xs text-muted-foreground sm:mr-auto" />}
        />
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, req }: { label: string; value: string; onChange: (v: string) => void; req?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}{req && <RequiredMark />}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="numeric" className="h-8 text-right tabular-nums" placeholder="—" />
    </label>
  );
}
