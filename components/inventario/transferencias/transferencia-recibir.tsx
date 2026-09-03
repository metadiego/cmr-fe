"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getTransferencia,
  recibirTransferencia,
  rechazarTransferencia,
  getDestinosTransferencia,
  type TransferenciaDetalle,
  type DestinoTransferencia,
} from "@/lib/api/transferencias";
import { listProductos, type Producto } from "@/lib/api/inventario";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useMe, isAdmin } from "@/hooks/use-me";
import { getActiveCentro } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageContainer, PageHeader } from "@/components/ui/page";

const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

const ESTADO_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pendiente: "secondary",
  recibida: "default",
  recibida_parcial: "default",
  rechazada: "destructive",
  cancelada: "outline",
};

// Pantalla clave: Recibir/Aprobar con aprobación PARCIAL por línea + política de remanente.
// Solo el centro DESTINO puede recibir (BE 403 si no) → gate en el FE.
export function TransferenciaRecibir({ id }: { id: string }) {
  const t = useTranslations("transferencias");
  const tc = useTranslations("common");
  const router = useRouter();

  const { state, reload } = useResource<TransferenciaDetalle>(
    () => getTransferencia(id),
    [id],
  );
  const prodRes = useResource<Producto[]>(() => listProductos({}));
  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  // Los OTROS centros (con nombre) para poder resolver el ORIGEN: no está en `me/centros` del usuario
  // destino, pero sí en el endpoint de destinos. Unión → origen y destino resuelven. Handoff transferencia-boton-recibir.
  const destinosRes = useResource<DestinoTransferencia[]>(() => getDestinosTransferencia());
  const me = useMe();

  const prodName = React.useMemo(() => {
    const m = new Map<string, string>();
    if (prodRes.state.kind === "ok") prodRes.state.data.forEach((p) => m.set(p.id, p.nombre));
    return m;
  }, [prodRes.state]);
  const centroNames = React.useMemo(() => {
    const m = new Map<string, string>();
    if (centrosRes.state.kind === "ok") centrosRes.state.data.forEach((c) => m.set(c.id, c.nombre));
    if (destinosRes.state.kind === "ok") destinosRes.state.data.forEach((d) => m.set(d.clinicId, d.nombre));
    return m;
  }, [centrosRes.state, destinosRes.state]);
  const centroName = (cid: string) => centroNames.get(cid) ?? cid;

  const detalle = state.kind === "ok" ? state.data : null;
  const transfer = detalle?.transferencia ?? null;
  const items = detalle?.items ?? [];

  // Recibido por línea (default = enviado). Se inicializa cuando llega el detalle.
  const [recibido, setRecibido] = React.useState<Record<string, string>>({});
  const [politica, setPolitica] = React.useState<"devolver_origen" | "merma">("devolver_origen");
  const [prevKey, setPrevKey] = React.useState<string | null>(null);
  const key = detalle ? `${id}:${items.length}` : null;
  if (key && key !== prevKey) {
    setPrevKey(key);
    const init: Record<string, string> = {};
    items.forEach((it) => {
      init[it.id] = String(num(it.cantidad));
    });
    setRecibido(init);
  }

  const [busy, setBusy] = React.useState(false);
  const [confirmAprobar, setConfirmAprobar] = React.useState(false);
  const [rechazando, setRechazando] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");

  const activeCentro = getActiveCentro();
  const esDestino = !!transfer && activeCentro === transfer.clinicDestinoId;
  const puedeRecibir =
    !!transfer &&
    transfer.estado === "pendiente" &&
    (esDestino || (me.kind === "ok" && isAdmin(me.me)));

  // Validación por línea: 0 ≤ recibida ≤ enviada.
  const lineError = (it: (typeof items)[number]) => {
    const r = Number(recibido[it.id]);
    if (recibido[it.id] === "" || Number.isNaN(r)) return t("err.required");
    if (r < 0) return t("err.negativo");
    if (r > num(it.cantidad)) return t("err.excede");
    return null;
  };
  const hayErrores = items.some((it) => lineError(it) !== null);

  async function aprobar() {
    if (!transfer || hayErrores || busy) return;
    setBusy(true);
    try {
      await recibirTransferencia(id, {
        items: items.map((it) => ({ itemId: it.id, cantidadRecibida: Number(recibido[it.id]) })),
        politicaRemanente: politica,
      });
      toast.success(t("recibidaOk"));
      setConfirmAprobar(false);
      router.push("/inventory/transfers");
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setBusy(false);
    }
  }

  async function rechazar() {
    if (!transfer || !motivo.trim() || busy) return;
    setBusy(true);
    try {
      await rechazarTransferencia(id, { motivo: motivo.trim() });
      toast.success(t("rechazadaOk"));
      setRechazando(false);
      router.push("/inventory/transfers");
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setBusy(false);
    }
  }

  if (state.kind === "loading") {
    return <PageContainer className="text-sm text-muted-foreground">{tc("loading")}</PageContainer>;
  }
  if (state.kind === "fail" || !transfer) {
    return (
      <PageContainer className="text-center">
        <p className="text-sm text-muted-foreground">{tc("error")}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={reload}>{tc("retry")}</Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <button type="button" onClick={() => router.push("/inventory/transfers")} className="mb-4 text-sm text-muted-foreground hover:text-foreground">
        ← {t("backToList")}
      </button>

      {/* Cabecera */}
      <div className="mb-6 rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <PageHeader
          title={`${centroName(transfer.clinicOrigenId)} → ${centroName(transfer.clinicDestinoId)}`}
          description={transfer.motivo}
          actions={<Badge variant={ESTADO_VARIANT[transfer.estado] ?? "outline"}>{t(`estado.${transfer.estado}`)}</Badge>}
        />
        {!esDestino && transfer.estado === "pendiente" && (
          <p className="mt-3 rounded-md border border-warning/40 bg-warning px-3 py-2 text-sm text-warning-foreground">
            {t("soloDestino", { centro: centroName(transfer.clinicDestinoId) })}
          </p>
        )}
      </div>

      {/* Líneas */}
      <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{t("col.producto")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.enviado")}</th>
              {puedeRecibir && <th className="px-3 py-2 font-semibold">{t("col.recibido")}</th>}
              <th className="px-3 py-2 font-semibold">{t("col.remanente")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((it) => {
              const enviado = num(it.cantidad);
              const rec = puedeRecibir ? Number(recibido[it.id] || 0) : num(it.cantidadRecibida);
              const remanente = Math.max(0, enviado - (Number.isNaN(rec) ? 0 : rec));
              const err = puedeRecibir ? lineError(it) : null;
              return (
                <tr key={it.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{it.productoNombre ?? prodName.get(it.productoId) ?? it.productoId}</td>
                  <td className="px-3 py-2 tabular-nums">{enviado}</td>
                  {puedeRecibir && (
                    <td className="px-3 py-2">
                      <Input
                        inputMode="decimal"
                        value={recibido[it.id] ?? ""}
                        onChange={(e) => setRecibido((p) => ({ ...p, [it.id]: e.target.value }))}
                        className={"h-8 w-24 " + (err ? "border-destructive" : "")}
                      />
                      {err && <span className="mt-0.5 block text-[11px] text-destructive">{err}</span>}
                    </td>
                  )}
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{remanente}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {puedeRecibir ? (
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("politicaRemanente")}</span>
            <Select value={politica} onValueChange={(v) => setPolitica(v as "devolver_origen" | "merma")}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="devolver_origen">{t("pol.devolver")}</SelectItem>
                <SelectItem value="merma">{t("pol.merma")}</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setRechazando(true)}>
              {t("rechazar")}
            </Button>
            <Button disabled={busy || hayErrores} onClick={() => setConfirmAprobar(true)}>
              {t("aprobar")}
            </Button>
          </div>
        </div>
      ) : (
        transfer.estado === "pendiente" && (
          <p className="mt-5 text-sm text-muted-foreground">{t("readonlyEnEspera")}</p>
        )
      )}

      {/* Confirmar aprobación */}
      <AlertDialog open={confirmAprobar} onOpenChange={(o) => !busy && setConfirmAprobar(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmAprobarTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmAprobarBody", { politica: politica === "merma" ? t("pol.merma") : t("pol.devolver") })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={aprobar} disabled={busy}>{t("aprobar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rechazar (motivo) */}
      <AlertDialog open={rechazando} onOpenChange={(o) => !busy && setRechazando(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rechazarTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("rechazarBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("motivoPlaceholder")} rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={rechazar} disabled={busy || !motivo.trim()}>{t("rechazar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
