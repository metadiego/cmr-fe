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
import { getCentrosDondePuedo, getMyCentros, type Centro } from "@/lib/api/centers";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useMe, isAdmin } from "@/hooks/use-me";
import { canReceiveTransfer, transferClinicName } from "@/lib/inventario/transfer-clinics";
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
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useConfirm } from "@/components/kit/confirm-host";
import { useSubmit } from "@/components/kit/use-submit";
import { missingFields } from "@/lib/forms/missing";
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
  // Clinics where the person can receive (inventario.recibir): the BE receives in the transfer's
  // DESTINATION clinic whatever the active one is (clinic-read-scope).
  const receivableRes = useResource<Centro[]>(() => getCentrosDondePuedo("inventario.recibir"));
  const receivable = receivableRes.state.kind === "ok" ? receivableRes.state.data.map((c) => c.id) : [];

  const prodName = React.useMemo(() => {
    const m = new Map<string, string>();
    if (prodRes.state.kind === "ok") prodRes.state.data.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [prodRes.state]);
  const centroNames = React.useMemo(() => {
    const m = new Map<string, string>();
    if (centrosRes.state.kind === "ok") centrosRes.state.data.forEach((c) => m.set(c.id, c.name));
    if (destinosRes.state.kind === "ok") destinosRes.state.data.forEach((d) => m.set(d.clinicId, d.name));
    return m;
  }, [centrosRes.state, destinosRes.state]);
  const centroName = (resolved: string | null | undefined, cid: string) =>
    transferClinicName(resolved, cid, (id) => centroNames.get(id)) ?? "—";

  const detalle = state.kind === "ok" ? state.data : null;
  const transfer = detalle?.transfer ?? null;
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
      init[it.id] = String(num(it.quantity));
    });
    setRecibido(init);
  }

  const confirm = useConfirm();
  const [rechazando, setRechazando] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  // Set once a receive/reject succeeded: the page is navigating away, so nothing may be sent twice.
  const [done, setDone] = React.useState(false);
  // Same flag as a ref, readable after an await (the state value in that closure is stale).
  const doneRef = React.useRef(false);
  // `asking` stops a second click / Enter auto-repeat from queueing a second confirm prompt.
  const asking = React.useRef(false);

  const esDestino = !!transfer && receivable.includes(transfer.destinationClinicId);
  const puedeRecibir =
    !!transfer &&
    (canReceiveTransfer(transfer, receivable) ||
      (transfer.status === "pendiente" && me.kind === "ok" && isAdmin(me.me)));

  // Validación por línea: 0 ≤ recibida ≤ enviada.
  const lineError = (it: (typeof items)[number]) => {
    const r = Number(recibido[it.id]);
    if (recibido[it.id] === "" || Number.isNaN(r)) return t("err.required");
    if (r < 0) return t("err.negativo");
    if (r > num(it.quantity)) return t("err.excede");
    return null;
  };
  const hayErrores = items.some((it) => lineError(it) !== null);

  const leave = (msg: string) => {
    doneRef.current = true;
    setDone(true);
    toast.success(msg);
    router.push("/inventory/transfers");
  };
  const onError = (err: unknown) => {
    toast.error(apiErrorMessage(err));
    return true;
  };

  const aprobar = useSubmit(
    async () => {
      // Backstop only: the button is disabled while a line is invalid.
      if (!transfer || hayErrores) throw new Error(tc("errorTitle"));
      await recibirTransferencia(id, {
        items: items.map((it) => ({ itemId: it.id, receivedQuantity: Number(recibido[it.id]) })),
        politicaRemanente: politica,
      });
    },
    { onSuccess: () => leave(t("recibidaOk")), onError },
  );

  const rechazar = useSubmit(
    async () => {
      // Backstop only: the button is disabled until the reason is filled.
      if (!transfer || !motivo.trim()) throw new Error(tc("errorTitle"));
      await rechazarTransferencia(id, { reason: motivo.trim() });
    },
    {
      onSuccess: () => {
        setRechazando(false);
        leave(t("rechazadaOk"));
      },
      onError,
    },
  );
  const motivoMissing = missingFields([[t("field.motivo"), motivo.trim().length > 0]]);

  const busy = aprobar.submitting || rechazar.submitting || done;

  // Receiving moves stock between clinics: it always goes through the confirm (which focuses Cancel).
  async function onAprobar() {
    if (asking.current || doneRef.current) return;
    asking.current = true;
    const ok = await confirm({
      title: t("confirmAprobarTitle"),
      description: t("confirmAprobarBody", { politica: politica === "merma" ? t("pol.merma") : t("pol.devolver") }),
      confirmLabel: t("aprobar"),
    }).finally(() => (asking.current = false));
    if (!ok || doneRef.current) return;
    await aprobar.submit();
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
          title={`${centroName(transfer.originName, transfer.sourceClinicId)} → ${centroName(transfer.destinationName, transfer.destinationClinicId)}`}
          description={transfer.reason}
          actions={<Badge variant={ESTADO_VARIANT[transfer.status] ?? "outline"}>{t(`estado.${transfer.status}`)}</Badge>}
        />
        {!esDestino && transfer.status === "pendiente" && (
          <p className="mt-3 rounded-md border border-warning/40 bg-warning px-3 py-2 text-sm text-warning-foreground">
            {t("soloDestino", { centro: centroName(transfer.destinationName, transfer.destinationClinicId) })}
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
              const enviado = num(it.quantity);
              const rec = puedeRecibir ? Number(recibido[it.id] || 0) : num(it.receivedQuantity);
              const remanente = Math.max(0, enviado - (Number.isNaN(rec) ? 0 : rec));
              const err = puedeRecibir ? lineError(it) : null;
              return (
                <tr key={it.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{it.productoNombre ?? prodName.get(it.productId) ?? it.productId}</td>
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
            <Button disabled={busy || hayErrores} onClick={() => void onAprobar()}>
              {t("aprobar")}
            </Button>
          </div>
        </div>
      ) : (
        transfer.status === "pendiente" && (
          <p className="mt-5 text-sm text-muted-foreground">{t("readonlyEnEspera")}</p>
        )
      )}

      {/* Reject (reason). Enter never sends it: only the button does (an outward, irreversible action). */}
      <FormDialog
        open={rechazando}
        onOpenChange={setRechazando}
        size="md"
        title={t("rechazarTitle")}
        description={t("rechazarBody")}
        onSubmit={() => {}}
        actions={[{ label: t("rechazar"), onClick: () => rechazar.submit() }]}
        submitting={rechazar.submitting}
        missing={motivoMissing}
      >
        <Field label={t("field.motivo")} htmlFor="transfer-reject-reason" required>
          <Textarea
            id="transfer-reject-reason"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={t("motivoPlaceholder")}
            rows={3}
          />
        </Field>
      </FormDialog>
    </PageContainer>
  );
}
