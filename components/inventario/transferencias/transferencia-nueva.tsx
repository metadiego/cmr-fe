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
import { getActiveCentro } from "@/lib/tenant";
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
import { PageContainer, PageHeader } from "@/components/ui/page";

type Linea = { key: string; productoId: string; cantidad: string };
let seq = 0;
const nuevaLinea = (): Linea => ({ key: `l${seq++}`, productoId: "", cantidad: "" });

// Crear transferencia entre centros (patrón "transfer order"): cabecera + líneas.
// Origen = centro activo; destino = otro centro. Reusa ProductoPicker (no duplica).
export function TransferenciaNueva() {
  const t = useTranslations("transferencias");
  const router = useRouter();

  const activeCentro = getActiveCentro();
  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const origenId = activeCentro ?? "";
  const centroName = (cid: string) => centros.find((c) => c.id === cid)?.nombre ?? cid;

  const [destinoId, setDestinoId] = React.useState("");
  const [almacenOrigenId, setAlmacenOrigenId] = React.useState("");
  const [almacenDestinoId, setAlmacenDestinoId] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const [lineas, setLineas] = React.useState<Linea[]>([nuevaLinea()]);
  const [busy, setBusy] = React.useState(false);

  // Almacenes del ORIGEN (centro activo) por su tenant.
  const almOrigenRes = useResource<Almacen[]>(() => listAlmacenes(), []);
  const almOrigen = almOrigenRes.state.kind === "ok" ? almOrigenRes.state.data : [];

  // DESTINOS: endpoint propio (otros centros activos con SUS almacenes DENTRO). No `me/centros`, y los
  // almacenes del destino salen del mismo payload → sin otra llamada. Handoff transferencia-destinos.
  const destinosRes = useResource<DestinoTransferencia[]>(() => getDestinosTransferencia(), []);
  const destinos = destinosRes.state.kind === "ok" ? destinosRes.state.data : [];
  const destinoSel = destinos.find((d) => d.clinicId === destinoId) ?? null;
  const almDestino = destinoSel?.almacenes ?? [];
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
  const canSubmit =
    !!origenId && !!destinoId && !!almacenOrigenId && !!almacenDestinoId &&
    lineasValidas.length > 0 && !busy;

  function setLinea(key: string, patch: Partial<Linea>) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const payload: CrearTransferenciaPayload = {
        clinicOrigenId: origenId,
        clinicDestinoId: destinoId,
        almacenOrigenId,
        almacenDestinoId,
        items: lineasValidas.map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad) })),
        ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
      };
      await crearTransferencia(payload);
      toast.success(t("creadaOk"));
      router.push("/inventario/transferencias");
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <PageContainer>
      <button type="button" onClick={() => router.push("/inventario/transferencias")} className="mb-4 text-sm text-muted-foreground hover:text-foreground">
        ← {t("backToList")}
      </button>
      <PageHeader title={t("newTitle")} description={t("newHelp")} />

      {/* Cabecera */}
      <div className="grid gap-4 rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] sm:grid-cols-2">
        <Field label={t("field.origen")}>
          <Input value={centroName(origenId)} disabled />
        </Field>
        <Field label={t("field.destino")}>
          <Select value={destinoId} onValueChange={(v) => { setDestinoId(v); setAlmacenDestinoId(""); setAutoAlmD(null); }}>
            <SelectTrigger className="w-full"><SelectValue placeholder={t("field.selectCentro")} /></SelectTrigger>
            <SelectContent>
              {destinos.map((d) => (<SelectItem key={d.clinicId} value={d.clinicId}>{d.nombre}</SelectItem>))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("field.almacenOrigen")}>
          <Select value={almacenOrigenId} onValueChange={setAlmacenOrigenId}>
            <SelectTrigger className="w-full"><SelectValue placeholder={t("field.selectAlmacen")} /></SelectTrigger>
            <SelectContent>
              {almOrigen.map((a) => (<SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("field.almacenDestino")}>
          <Select value={almacenDestinoId} onValueChange={setAlmacenDestinoId} disabled={!destinoId || destinoSinAlmacen}>
            <SelectTrigger className="w-full"><SelectValue placeholder={t("field.selectAlmacen")} /></SelectTrigger>
            <SelectContent>
              {almDestino.map((a) => (<SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>))}
            </SelectContent>
          </Select>
          {/* Destino sin almacén: se avisa (no se esconde) para que no busquen el centro en vano. */}
          {destinoSinAlmacen && (
            <span className="mt-1 text-xs text-warning-foreground">{t("field.destinoSinAlmacen")}</span>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("field.motivo")}>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
          </Field>
        </div>
      </div>

      {/* Líneas */}
      <div className="mt-5 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("lineas")}</span>
          <Button variant="outline" size="sm" onClick={() => setLineas((p) => [...p, nuevaLinea()])}>
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />{t("addLinea")}
          </Button>
        </div>
        <div className="divide-y">
          {lineas.map((l) => (
            <div key={l.key} className="flex flex-wrap items-end gap-3 px-4 py-3">
              <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{t("col.producto")}</span>
                <ProductoPicker value={l.productoId} onChange={(id) => setLinea(l.key, { productoId: id })} placeholder={t("field.selectProducto")} />
              </label>
              <label className="flex w-28 flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{t("col.cantidad")}</span>
                <Input inputMode="decimal" value={l.cantidad} onChange={(e) => setLinea(l.key, { cantidad: e.target.value })} placeholder="0" />
              </label>
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

      <div className="mt-5 flex justify-end">
        <Button onClick={onSubmit} disabled={!canSubmit}>{busy ? t("creando") : t("crear")}</Button>
      </div>
    </PageContainer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
