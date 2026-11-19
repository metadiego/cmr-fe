"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons";

import { getReopenCheck, listReopenings, reopenInvoice, type InvoiceReopening, type ReopenCheck } from "@/lib/api/invoice-reopen";
import type { FacturaConItems } from "@/lib/api/facturas";
import { apiErrorLabel } from "@/lib/api/errors";
import { reopeningChanges, type DiffInvoice, type InvoiceChange } from "@/lib/factura/reopen-diff";
import { reopenMissing } from "@/lib/facturacion/reopen-missing";
import { money } from "@/lib/caja/totales";
import { formatFechaSolo } from "@/lib/format/fecha";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { FormError } from "@/components/kit/field";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";

interface ButtonProps {
  invoiceId: string;
  centerId?: string;
  // Called with the invoice the BE returns (now a draft, same number) so the screen goes to edit mode.
  onReopened: (invoice: FacturaConItems) => void;
}

// «Reabrir» on an issued invoice. Whether it can is the BE's call (GET …/reopen/check): the button
// asks first and, when it cannot, stays disabled and says why — no rules duplicated here.
export function ReopenInvoiceButton({ invoiceId, centerId, onReopened }: ButtonProps) {
  const t = useTranslations("invoiceReopen");
  const tRoot = useTranslations();
  const [check, setCheck] = React.useState<ReopenCheck | null>(null);
  const [open, setOpen] = React.useState(false);
  const [{ reason, error }, setForm] = useDialogForm(() => ({ reason: "", error: null as string | null }), open);

  React.useEffect(() => {
    let active = true;
    getReopenCheck(invoiceId, centerId)
      .then((c) => active && setCheck(c))
      .catch(() => active && setCheck(null));
    return () => {
      active = false;
    };
  }, [invoiceId, centerId]);

  const reasons = check?.reasons ?? [];
  const warnings = check?.warnings ?? [];
  const blocked = !!check && !check.canReopen;
  const why = reasons.map((r) => tRoot(r.labelKey)).join(" · ");
  const missing = reopenMissing({ reason }).map(() => t("reasonLabel"));

  const { submitting, submit } = useSubmit(
    () => {
      setForm({ error: null });
      return reopenInvoice(invoiceId, reason.trim(), centerId);
    },
    {
      onSuccess: (r) => {
        r.warnings.forEach((w) => toast.warning(w.labelKey ? tRoot(w.labelKey) : (w.message ?? w.code)));
        toast.success(t("done"));
        setOpen(false);
        onReopened(r.invoice);
      },
      // The BE's refusal is shown inside the dialog, not as a toast.
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
        <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-4" />
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
        submittingLabel={tRoot("common.loading")}
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
        {/* A textarea: Enter adds a line and never submits, so reopening needs the button. */}
        <Field label={t("reasonLabel")} htmlFor="reopen-reason" required>
          <Textarea
            id="reopen-reason"
            value={reason}
            onChange={(e) => setForm({ reason: e.target.value })}
            placeholder={t("reasonPlaceholder")}
            rows={3}
            autoFocus
          />
        </Field>
        <FormError message={error} />
      </FormDialog>
    </>
  );
}

interface HistoryProps {
  invoiceId: string;
  centerId?: string;
  invoice: FacturaConItems;
}

// «Reaperturas»: who, when, why, and what each correction changed (the issued snapshot against what
// came after it). Renders nothing for an invoice never reopened.
export function InvoiceReopenings({ invoiceId, centerId, invoice }: HistoryProps) {
  const t = useTranslations("invoiceReopen");
  const format = useFormatter();
  const [rows, setRows] = React.useState<InvoiceReopening[]>([]);

  // Reloaded whenever the invoice changes (reopened, edited, re-issued).
  const version = String(invoice.updatedAt ?? "");
  React.useEffect(() => {
    let active = true;
    listReopenings(invoiceId, centerId)
      .then((r) => active && setRows(r ?? []))
      .catch(() => active && setRows([]));
    return () => {
      active = false;
    };
  }, [invoiceId, centerId, version]);

  if (rows.length === 0) return null;
  const changes = reopeningChanges(
    rows.map((r) => r.snapshot as DiffInvoice),
    invoice as unknown as DiffInvoice,
  );
  // MM/DD/YYYY always (business standard, independent of the language picker).
  const day = (v: unknown) => formatFechaSolo(v) || "—";

  function describe(c: InvoiceChange): string {
    switch (c.kind) {
      case "header":
        if (c.field === "date") return t("change.date", { before: day(c.before), after: day(c.after) });
        if (c.field === "exempt") return c.after ? t("change.exemptOn") : t("change.exemptOff");
        return t(`change.${c.field}`, { before: money(Number(c.before)), after: money(Number(c.after)) });
      case "lineAdded":
        return t("change.lineAdded", { description: c.description, quantity: c.quantity, total: money(c.total) });
      case "lineRemoved":
        return t("change.lineRemoved", { description: c.description, quantity: c.quantity, total: money(c.total) });
      case "lineChanged":
        return t("change.lineChanged", {
          description: c.description,
          before: `${c.before.quantity} × ${money(c.before.unitPrice)}`,
          after: `${c.after.quantity} × ${money(c.after.unitPrice)}`,
        });
      case "paymentAdded":
        return t("change.paymentAdded", { method: c.method || "—", amount: money(c.amount) });
      case "paymentRemoved":
        return t("change.paymentRemoved", { method: c.method || "—", amount: money(c.amount) });
    }
  }

  return (
    <Card className="no-print">
      <CardHeader>
        <CardTitle>{t("historyTitle", { count: rows.length })}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {rows.map((r, i) => {
            const by = r.reopenedBy?.name;
            return (
              <li key={r.id} className="border-l-2 border-warning-foreground/40 pl-3">
                <p className="text-sm">
                  <span className="font-medium tabular-nums">{format.dateTime(new Date(r.createdAt), "dateAndTime")}</span>
                  {by && <span className="text-muted-foreground"> · {by}</span>}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">{t("reasonShort")}: </span>
                  {r.reason}
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">{i === 0 && invoice.status === "borrador" ? t("changesSoFar") : t("changes")}</p>
                {changes[i].length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("noChanges")}</p>
                ) : (
                  <ul className="list-disc pl-5 text-xs">
                    {changes[i].map((c, j) => (
                      <li key={j}>{describe(c)}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
