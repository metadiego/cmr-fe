"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  crearTransferencia,
  getDestinosTransferencia,
  type CrearTransferenciaPayload,
  type DestinoTransferencia,
} from "@/lib/api/transferencias";
import { listAlmacenes, type Almacen } from "@/lib/api/inventario";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { getActiveCentro, isClinicViewAll } from "@/lib/tenant";
import { useCreateClinic } from "@/hooks/use-create-clinic";
import { CreateClinicField } from "@/components/kit/create-clinic-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductoPicker } from "@/components/inventario/producto-picker";
import { Field } from "@/components/kit/field";
import { FormFooter } from "@/components/kit/form-footer";
import { RequiredLegend, RequiredMark } from "@/components/kit/required-mark";
import { useSubmit } from "@/components/kit/use-submit";
import { missingFields } from "@/lib/forms/missing";
import { PageContainer, PageHeader } from "@/components/ui/page";

type Linea = { key: string; productoId: string; cantidad: string };
let seq = 0;
const nuevaLinea = (): Linea => ({ key: `l${seq++}`, productoId: "", cantidad: "" });

// Crear transferencia entre centros (patrón "transfer order"): cabecera + líneas.
// Origen = centro activo; destino = otro centro. Reusa ProductoPicker (no duplica).
export function TransferenciaNueva() {
  const t = useTranslations("transferencias");
  const tClinic = useTranslations("createClinic");
  const router = useRouter();

  const activeCentro = getActiveCentro();
  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  // Origin = the top bar's clinic. On «Ambos» the top bar names none: the person picks the origin among
  // the clinics where they may transfer (docs/specs/selector-de-centros-arriba.md).
  const viewAll = isClinicViewAll();
  const origenes = useCreateClinic("inventario.transferir", null);
  const [origenSel, setOrigenSel] = React.useState("");
  const origenId = viewAll ? origenSel || origenes.defaultClinicId : (activeCentro ?? "");
  const centroName = (cid: string) => centros.find((c) => c.id === cid)?.name ?? cid;

  const [destinoId, setDestinoId] = React.useState("");
  const [almacenOrigenId, setAlmacenOrigenId] = React.useState("");
  const [almacenDestinoId, setAlmacenDestinoId] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const [lineas, setLineas] = React.useState<Linea[]>([nuevaLinea()]);
  // Set once the transfer was created: the page is navigating away, so it may not be sent twice.
  const [done, setDone] = React.useState(false);

  // The ORIGIN's warehouses, by its tenant (never every clinic's, which is what «Ambos» would read).
  const almOrigenRes = useResource<Almacen[]>(
    () => (viewAll && !origenId ? Promise.resolve([]) : listAlmacenes(viewAll ? origenId : undefined)),
    [viewAll, origenId],
  );
  const almOrigen = almOrigenRes.state.kind === "ok" ? almOrigenRes.state.data : [];

  // DESTINOS: endpoint propio (otros centros activos con SUS almacenes DENTRO). No `me/centros`, y los
  // almacenes del destino salen del mismo payload → sin otra llamada. Handoff transferencia-destinos.
  const destinosRes = useResource<DestinoTransferencia[]>(
    () => (viewAll && !origenId ? Promise.resolve([]) : getDestinosTransferencia(viewAll ? origenId : undefined)),
    [viewAll, origenId],
  );
  const destinos = (destinosRes.state.kind === "ok" ? destinosRes.state.data : []).filter((d) => d.clinicId !== origenId);
  const destinoSel = destinos.find((d) => d.clinicId === destinoId) ?? null;
  const almDestino = destinoSel?.warehouses ?? [];
  const destinoSinAlmacen = !!destinoSel && almDestino.length === 0;

  // Preselección del único almacén (caso común: 1 por centro). Guard con estado (no ref
  // en render): auto-selecciona una vez por carga de datos.
  const [autoAlmO, setAutoAlmO] = React.useState<string | null>(null);
  if (almOrigen.length === 1 && almOrigen[0].id !== autoAlmO) {
    setAutoAlmO(almOrigen[0].id);
    setAlmacenOrigenId(almOrigen[0].id);
  }
  const [autoAlmD, setAutoAlmD] = React.useState<string | null>(null);
  if (almDestino.length === 1 && almDestino[0].id !== autoAlmD) {
    setAutoAlmD(almDestino[0].id);
    setAlmacenDestinoId(almDestino[0].id);
  }

  const lineasValidas = lineas.filter((l) => l.productoId && Number(l.cantidad) > 0);
  // A chosen product whose quantity is typed but not > 0: filled, not missing (it explains, not lists).
  const cantidadInvalida = lineas.some(
    (l) => l.productoId && l.cantidad.trim() !== "" && !(Number(l.cantidad) > 0),
  );
  const sinLineas = lineasValidas.length === 0;
  const missing = missingFields([
    [viewAll ? tClinic("label") : t("field.origen"), !!origenId],
    [t("field.destino"), !!destinoId],
    [t("field.almacenOrigen"), !!almacenOrigenId],
    [t("field.almacenDestino"), !!almacenDestinoId],
    [t("lineas"), !sinLineas || cantidadInvalida],
  ]);
  const blocked = sinLineas && cantidadInvalida;
  // A chosen product with a blank / non-positive quantity is left out of the payload when another line
  // is valid: say so (text only; `reason` never disables, `blocked` stays as above).
  const lineaDescartada =
    !sinLineas && lineas.some((l) => l.productoId && !(Number(l.cantidad) > 0));
  const avisoCantidad = cantidadInvalida || lineaDescartada;

  function setLinea(key: string, patch: Partial<Linea>) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  // Sending a transfer moves stock: there is no form here, so only the button sends it (never Enter).
  const { submitting, submit } = useSubmit(
    async () => {
      // Backstop only: the button is disabled while something is missing or blocked.
      if (missing.length > 0 || blocked) throw new Error(missing.join(", ") || t("lineQuantityInvalid"));
      const payload: CrearTransferenciaPayload = {
        sourceClinicId: origenId,
        destinationClinicId: destinoId,
        sourceWarehouseId: almacenOrigenId,
        destinationWarehouseId: almacenDestinoId,
        items: lineasValidas.map((l) => ({ productId: l.productoId, quantity: Number(l.cantidad) })),
        ...(motivo.trim() ? { reason: motivo.trim() } : {}),
      };
      await crearTransferencia(payload);
    },
    {
      onSuccess: () => {
        setDone(true);
        toast.success(t("creadaOk"));
        router.push("/inventory/transfers");
      },
      onError: (err) => {
        toast.error(apiErrorMessage(err));
        return true;
      },
    },
  );

  return (
    <PageContainer>
      <button type="button" onClick={() => router.push("/inventory/transfers")} className="mb-4 text-sm text-muted-foreground hover:text-foreground">
        ← {t("backToList")}
      </button>
      <PageHeader title={t("newTitle")} description={t("newHelp")} />

      {/* Cabecera */}
      <div className="grid gap-4 rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] sm:grid-cols-2">
        {viewAll ? (
          <CreateClinicField
            centers={origenes.centers}
            value={origenId}
            show
            required
            onChange={(v) => {
              setOrigenSel(v); setAlmacenOrigenId(""); setAutoAlmO(null);
              setDestinoId(""); setAlmacenDestinoId(""); setAutoAlmD(null);
            }}
          />
        ) : (
          <Field label={t("field.origen")} htmlFor="transfer-origin">
            <Input id="transfer-origin" value={centroName(origenId)} disabled />
          </Field>
        )}
        <Field label={t("field.destino")} htmlFor="transfer-destination" required>
          <Select value={destinoId} onValueChange={(v) => { setDestinoId(v); setAlmacenDestinoId(""); setAutoAlmD(null); }}>
            <SelectTrigger id="transfer-destination" className="w-full"><SelectValue placeholder={t("field.selectCentro")} /></SelectTrigger>
            <SelectContent>
              {destinos.map((d) => (<SelectItem key={d.clinicId} value={d.clinicId}>{d.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("field.almacenOrigen")} htmlFor="transfer-origin-warehouse" required>
          <Select value={almacenOrigenId} onValueChange={setAlmacenOrigenId}>
            <SelectTrigger id="transfer-origin-warehouse" className="w-full"><SelectValue placeholder={t("field.selectAlmacen")} /></SelectTrigger>
            <SelectContent>
              {almOrigen.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("field.almacenDestino")} htmlFor="transfer-destination-warehouse" required>
          <Select value={almacenDestinoId} onValueChange={setAlmacenDestinoId} disabled={!destinoId || destinoSinAlmacen}>
            <SelectTrigger id="transfer-destination-warehouse" className="w-full"><SelectValue placeholder={t("field.selectAlmacen")} /></SelectTrigger>
            <SelectContent>
              {almDestino.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
            </SelectContent>
          </Select>
          {/* Destino sin almacén: se avisa (no se esconde) para que no busquen el centro en vano. */}
          {destinoSinAlmacen && (
            <span className="block text-xs text-warning-foreground">{t("field.destinoSinAlmacen")}</span>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("field.motivo")} htmlFor="transfer-reason">
            <Textarea id="transfer-reason" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
          </Field>
        </div>
      </div>

      {/* Líneas */}
      <div className="mt-5 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("lineas")}
            <RequiredMark />
          </span>
          <Button variant="outline" size="sm" onClick={() => setLineas((p) => [...p, nuevaLinea()])}>
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />{t("addLinea")}
          </Button>
        </div>
        <div className="divide-y">
          {lineas.map((l) => (
            <div key={l.key} className="flex flex-wrap items-end gap-3 px-4 py-3">
              <Field label={t("col.producto")} htmlFor={`transfer-${l.key}-product`} className="min-w-[220px] flex-1">
                <ProductoPicker id={`transfer-${l.key}-product`} value={l.productoId} onChange={(id) => setLinea(l.key, { productoId: id })} placeholder={t("field.selectProducto")} />
              </Field>
              <Field label={t("col.cantidad")} htmlFor={`transfer-${l.key}-quantity`} className="w-28">
                <Input id={`transfer-${l.key}-quantity`} inputMode="decimal" value={l.cantidad} onChange={(e) => setLinea(l.key, { cantidad: e.target.value })} placeholder="0" />
              </Field>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                disabled={lineas.length === 1}
                onClick={() => setLineas((p) => p.filter((x) => x.key !== l.key))}
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:items-end">
        <RequiredLegend />
        <FormFooter
          className="w-full"
          primary={{ label: t("crear"), onClick: () => submit() }}
          submittingLabel={t("creando")}
          submitting={submitting || done}
          missing={missing}
          blocked={blocked}
          reason={avisoCantidad ? t("lineQuantityInvalid") : null}
        />
      </div>
    </PageContainer>
  );
}
