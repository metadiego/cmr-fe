"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserSwitchIcon } from "@hugeicons/core-free-icons";

import { getReopenCheck, changeInvoicePatient, type ReopenCheck } from "@/lib/api/invoice-reopen";
import { buscarPaciente, type FacturaConItems, type PacienteBusqueda } from "@/lib/api/facturas";
import { apiErrorLabel } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogRowsSkeleton } from "@/components/facturacion/invoice-detail-skeleton";

interface Props {
  invoiceId: string;
  centerId?: string;
  currentPatientId?: string;
  currentPatientName?: string;
  // Called with the invoice the BE returns (still issued, same number/total, new patient).
  onChanged: (invoice: FacturaConItems) => void;
}

// «Cambiar paciente» on an issued invoice (caso 001103: facturada a 16034, era 680). Reuses the same
// gate as «Reabrir» (GET …/reopen/check — already accounts for invoice_reopen.any_date): same-day
// only for whoever billed it, any date for management/admin. Handoff
// cambiar-el-paciente-de-una-factura.
export function ChangeInvoicePatientButton({ invoiceId, centerId, currentPatientId, currentPatientName, onChanged }: Props) {
  const t = useTranslations("invoiceChangePatient");
  const tRoot = useTranslations();
  const [check, setCheck] = React.useState<ReopenCheck | null>(null);
  const [open, setOpen] = React.useState(false);
  const [elegido, setElegido] = React.useState<PacienteBusqueda | null>(null);
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    getReopenCheck(invoiceId, centerId)
      .then((c) => active && setCheck(c))
      .catch(() => active && setCheck(null));
    return () => {
      active = false;
    };
  }, [invoiceId, centerId]);

  React.useEffect(() => {
    const h = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(h);
  }, [q]);
  const term = debounced.trim();
  const res = useResource<PacienteBusqueda[]>(
    () => (term.length >= 2 ? buscarPaciente(term, centerId) : Promise.resolve([])),
    [term, centerId],
  );
  const shown = term.length >= 2 && res.state.kind === "ok" ? res.state.data : [];
  const loading = res.state.kind === "loading" && term.length >= 2;
  const nombre = (p: PacienteBusqueda) => (p.displayName || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()) || "—";

  const reasons = check?.reasons ?? [];
  const warnings = check?.warnings ?? [];
  const blocked = !!check && !check.canReopen;
  const why = reasons.map((r) => tRoot(r.labelKey)).join(" · ");

  function reset() {
    setElegido(null);
    setQ("");
    setDebounced("");
    setReason("");
    setError(null);
  }

  async function confirmar() {
    if (!elegido) return;
    setBusy(true);
    setError(null);
    try {
      const r = await changeInvoicePatient(invoiceId, elegido.id, reason.trim(), centerId);
      r.warnings.forEach((w) => toast.warning(w.labelKey ? tRoot(w.labelKey) : (w.message ?? w.code)));
      toast.success(t("done"));
      setOpen(false);
      onChanged(r.invoice);
    } catch (err) {
      setError(apiErrorLabel(err, tRoot));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="no-print"
        disabled={!check || blocked}
        title={blocked ? why : t("hint")}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <HugeiconsIcon icon={UserSwitchIcon} className="size-4" />
        {t("action")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          {warnings.length > 0 && (
            <Alert variant="warning">
              <AlertDescription>
                {warnings.map((w) => (
                  <p key={w.labelKey}>{tRoot(w.labelKey)}</p>
                ))}
              </AlertDescription>
            </Alert>
          )}
          {currentPatientName && (
            <p className="text-sm text-muted-foreground">
              {t("currentPatient")}: <span className="font-medium text-foreground">{currentPatientName}</span>
            </p>
          )}
          {elegido ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-accent/40 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{nombre(elegido)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {elegido.medicalRecordNumber ? `#${elegido.medicalRecordNumber}` : ""} {elegido.documentId ? `· ID ${elegido.documentId}` : ""}
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setElegido(null)}>
                {t("changeSelection")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} />
              <div className="max-h-60 space-y-1 overflow-y-auto">
                {term.length < 2 && <p className="py-4 text-center text-sm text-muted-foreground">{t("searchHint")}</p>}
                {loading && <DialogRowsSkeleton sub trailing={null} />}
                {term.length >= 2 && !loading && shown.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">{tRoot("common.noResults")}</p>
                )}
                {shown.map((p) => {
                  const esActual = String(p.id) === String(currentPatientId ?? "");
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={esActual}
                      onClick={() => setElegido(p)}
                      className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{nombre(p)}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.medicalRecordNumber ? `#${p.medicalRecordNumber}` : ""} {p.documentId ? `· ID ${p.documentId}` : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="change-patient-reason">{t("reasonLabel")}</Label>
            <Textarea
              id="change-patient-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {tRoot("common.cancel")}
            </Button>
            <Button onClick={confirmar} disabled={busy || !elegido || !reason.trim()}>
              {busy ? tRoot("common.loading") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
