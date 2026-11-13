"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";

import {
  simulateRefundEdit,
  saveRefundEdit,
  type RefundDetail,
  type RefundEditBody,
  type RefundEditLine,
  type RefundEditResponse,
  type RefundEditWarning,
} from "@/lib/api/refund-detail";
import type { FormaPago } from "@/lib/api/facturas";
import type { Perfil } from "@/lib/api/profiles";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefundLinesEditor, lineKey, type LineState } from "@/components/facturacion/refund-lines-editor";
import { RefundReimbursementsEditor, type ReimbursementLine } from "@/components/facturacion/refund-reimbursements-editor";

const n = (v: unknown) => Number(v ?? 0);
const money = (v: unknown) => `$${n(v).toFixed(2)}`;

// El editor EN SU SITIO (BE PR #580, handoff .personal/handoff-editar-devolucion-completa.md): el
// dueño pidió que fuera «abierto» — todo editable, los avisos NUNCA bloquean salvo que el centro
// configuró una regla para que bloquee (entonces `simular` trae `blocks` no vacío y el botón Guardar
// se apaga). Cada cambio llama a `simular` (debounce 500ms, no escribe nada) y pinta el efecto real
// antes de guardar.
export function RefundEditorBody({
  detail,
  formas,
  perfiles,
  invoiceId,
  devId,
  centro,
  onSaved,
}: {
  detail: RefundDetail;
  formas: FormaPago[];
  perfiles: Perfil[];
  invoiceId: string;
  devId: string;
  centro?: string;
  onSaved: () => void;
}) {
  const t = useTranslations("devoluciones");
  const te = useTranslations("devoluciones.editor");
  const tRoot = useTranslations();

  const [date, setDate] = React.useState(detail.date ?? "");
  const [reason, setReason] = React.useState(detail.reason ?? "");
  const [notes, setNotes] = React.useState(detail.notes ?? "");
  const [userId, setUserId] = React.useState(detail.userId ?? "");
  const [changeReason, setChangeReason] = React.useState("");

  const [lineState, setLineState] = React.useState<Record<string, LineState>>(() => {
    const m: Record<string, LineState> = {};
    (detail.balances ?? []).forEach((b) => {
      const key = lineKey(b.invoiceItemId, b.invoiceItemComponentId);
      const item = detail.items.find((it) => it.invoiceItemId === b.invoiceItemId);
      m[key] = { quantity: String(b.inThisRefund), amount: item ? String(item.amount) : "" };
    });
    return m;
  });
  function onLineChange(key: string, patch: Partial<LineState>) {
    setLineState((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  }

  const [reimb, setReimb] = React.useState<ReimbursementLine[]>(() => {
    const active = detail.reimbursements.filter((r) => r.status === "activo");
    return active.length
      ? active.map((r) => ({ paymentMethodId: r.paymentMethodId, amount: String(r.amount) }))
      : [{ paymentMethodId: "", amount: String(detail.refundedAmount) }];
  });

  function buildBody(): RefundEditBody {
    const lines: RefundEditLine[] = Object.entries(lineState)
      .filter(([, st]) => n(st.quantity) > 0)
      .map(([key, st]) => {
        const [invoiceItemId, componentId] = key.split("::");
        return {
          invoiceItemId,
          ...(componentId ? { invoiceItemComponentId: componentId } : {}),
          quantity: n(st.quantity),
          ...(st.amount.trim() ? { amount: n(st.amount) } : {}),
        };
      });
    return {
      lines,
      ...(date ? { date } : {}),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(userId ? { userId } : {}),
      reimbursements: reimb.filter((r) => r.paymentMethodId && n(r.amount) > 0).map((r) => ({ paymentMethodId: r.paymentMethodId, amount: n(r.amount) })),
    };
  }

  const [sim, setSim] = React.useState<RefundEditResponse | null>(null);
  const [simBusy, setSimBusy] = React.useState(false);
  const bodyKey = JSON.stringify(buildBody());
  // "Calculando…" shows the instant the body changes, not only once the debounced fetch actually
  // starts — adjusted in render (comparing against the previous key), not synchronously inside the
  // effect below, which only owns the actual (debounced) fetch.
  const [simBodyKey, setSimBodyKey] = React.useState(bodyKey);
  if (bodyKey !== simBodyKey) {
    setSimBodyKey(bodyKey);
    setSimBusy(true);
  }
  React.useEffect(() => {
    let active = true;
    const h = setTimeout(() => {
      simulateRefundEdit(invoiceId, devId, buildBody(), centro)
        .then((r) => active && setSim(r))
        .catch(() => active && setSim(null))
        .finally(() => active && setSimBusy(false));
    }, 500);
    return () => {
      active = false;
      clearTimeout(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyKey, invoiceId, devId, centro]);

  const warningsByLine = React.useMemo(() => {
    const m: Record<string, RefundEditWarning[]> = {};
    (sim?.warnings ?? []).forEach((w) => {
      if (!w.invoiceItemId) return;
      (m[w.invoiceItemId] ??= []).push(w);
    });
    return m;
  }, [sim]);

  const preview = sim?.result;
  const blocked = (preview?.blocks?.length ?? 0) > 0;
  const target = preview?.refundedAmount ?? detail.refundedAmount;

  const [busy, setBusy] = React.useState(false);

  async function guardar() {
    if (blocked || busy) return;
    setBusy(true);
    try {
      await saveRefundEdit(invoiceId, devId, { ...buildBody(), ...(changeReason.trim() ? { changeReason: changeReason.trim() } : {}) }, centro);
      toast.success(te("savedOk"));
      onSaved();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">{te("headerTitle")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>{t("col.fecha")}</Label>
            <DatePicker value={date} onChange={setDate} className="h-8 w-full" />
          </div>
          <div className="space-y-1">
            <Label>{t("atendidoPor")}</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger size="sm" className="w-full"><SelectValue placeholder={t("atendidoPor")} /></SelectTrigger>
              <SelectContent>
                {perfiles.map((p) => <SelectItem key={p.id} value={p.id}>{[p.name, p.lastName].filter(Boolean).join(" ") || p.email || p.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-1">
            <Label>{t("col.motivo")}</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <Label>{t("notas")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">{te("linesTitle")}</CardTitle></CardHeader>
        <CardContent>
          <RefundLinesEditor balances={detail.balances ?? []} lineState={lineState} onLineChange={onLineChange} warningsByLine={warningsByLine} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("formaReembolso")}</CardTitle></CardHeader>
        <CardContent>
          <RefundReimbursementsEditor
            lines={reimb}
            onChange={setReimb}
            formas={formas}
            target={target}
            voided={detail.reimbursements.filter((r) => r.status === "anulado")}
          />
        </CardContent>
      </Card>

      {preview && (
        <Card className="bg-muted/30">
          <CardHeader><CardTitle className="text-sm">{te("previewTitle")}{simBusy && <span className="ml-2 font-normal text-muted-foreground">{te("previewCalculating")}</span>}</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <Row label={t("col.monto")} value={money(preview.refundedAmount)} />
            <Row label={te("invoiceStatus")} value={tRoot.has(`facturacionList.estado.${preview.invoiceStatus}`) ? tRoot(`facturacionList.estado.${preview.invoiceStatus}`) : preview.invoiceStatus} />
            {preview.packages.length > 0 && (
              <div className="sm:col-span-2 text-xs text-muted-foreground">
                {preview.packages.map((p, i) => <p key={i}>{te("packageEffect", { sessions: p.refundedSessions, status: p.status })}</p>)}
              </div>
            )}
            {preview.inventory.length > 0 && (
              <div className="sm:col-span-2 text-xs text-muted-foreground">
                {preview.inventory.map((inv, i) => <p key={i}>{te("inventoryEffect", { delta: inv.delta })}</p>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {blocked && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-start gap-1.5">
            <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" />
            <span>{preview?.blocks.map((b, i) => <span key={i} className="block">{tRoot.has(b.labelKey ?? "") ? tRoot(b.labelKey!, b.params as Record<string, string | number>) : b.code}</span>)}</span>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-3 pt-6">
          <div className="flex-1 space-y-1">
            <Label>{te("changeReason")}</Label>
            <Input value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder={te("changeReasonPlaceholder")} className="max-w-md" />
          </div>
          <div className="flex gap-2">
            <Button onClick={guardar} disabled={busy || blocked || detail.status !== "activa"}>{busy ? tRoot("common.loading") : tRoot("common.save")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
