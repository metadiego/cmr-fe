"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserSwitchIcon } from "@hugeicons/core-free-icons";

import { getReopenCheck, changeInvoicePatient, type ReopenCheck } from "@/lib/api/invoice-reopen";
import { buscarPaciente, type FacturaConItems, type PacienteBusqueda } from "@/lib/api/facturas";
import { apiErrorLabel } from "@/lib/api/errors";
import { changePatientMissing } from "@/lib/facturacion/change-patient-missing";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DialogRowsSkeleton } from "@/components/facturacion/invoice-detail-skeleton";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { FormError } from "@/components/kit/field";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";

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
  // Re-initialised every time the dialog opens (search, pick, reason and the last error).
  const [form, setForm] = useDialogForm(
    () => ({ elegido: null as PacienteBusqueda | null, q: "", debounced: "", reason: "", error: null as string | null }),
    open,
  );
  const { elegido, q, debounced, reason, error } = form;

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
    const h = setTimeout(() => setForm({ debounced: q }), 250);
    return () => clearTimeout(h);
  }, [q, setForm]);
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

  const labels = { patient: t("patient"), reason: t("reasonLabel") } as const;
  const missing = changePatientMissing({ patientId: elegido ? String(elegido.id) : null, reason }).map((f) => labels[f]);

  const { submitting, submit } = useSubmit(
    async () => {
      if (!elegido) throw new Error(t("patient"));
      setForm({ error: null });
      return changeInvoicePatient(invoiceId, elegido.id, reason.trim(), centerId);
    },
    {
      onSuccess: (r) => {
        r.warnings.forEach((w) => toast.warning(w.labelKey ? tRoot(w.labelKey) : (w.message ?? w.code)));
        toast.success(t("done"));
        setOpen(false);
        onChanged(r.invoice);
      },
      // The error stays inside the dialog, as before (no toast).
      onError: (err) => {
        setForm({ error: apiErrorLabel(err, tRoot) });
        return true;
      },
    },
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="no-print"
        disabled={!check || blocked}
        title={blocked ? why : t("hint")}
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={UserSwitchIcon} className="size-4" />
        {t("action")}
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title={t("title")}
        description={t("description")}
        onSubmit={() => submit()}
        submitLabel={t("confirm")}
        submitting={submitting}
        missing={missing}
      >
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
        <Field label={t("patient")} htmlFor={elegido ? undefined : "change-patient-search"} required>
          {elegido ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-accent/40 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{nombre(elegido)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {elegido.medicalRecordNumber ? `#${elegido.medicalRecordNumber}` : ""} {elegido.documentId ? `· ID ${elegido.documentId}` : ""}
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setForm({ elegido: null })}>
                {t("changeSelection")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input id="change-patient-search" autoFocus value={q} onChange={(e) => setForm({ q: e.target.value })} placeholder={t("searchPlaceholder")} />
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
                      onClick={() => setForm({ elegido: p })}
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
        </Field>
        <Field label={t("reasonLabel")} htmlFor="change-patient-reason" required>
          <Textarea
            id="change-patient-reason"
            value={reason}
            onChange={(e) => setForm({ reason: e.target.value })}
            placeholder={t("reasonPlaceholder")}
            rows={3}
          />
        </Field>
        <FormError message={error} />
      </FormDialog>
    </>
  );
}
