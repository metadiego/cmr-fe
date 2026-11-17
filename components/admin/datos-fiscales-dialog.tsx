"use client";

import { useTranslations } from "next-intl";

import {
  updateDatosFiscales,
  updateCenter,
  type Centro,
  type DatosFiscalesPayload,
} from "@/lib/api/centers";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { useDialogForm } from "@/components/kit/use-dialog-form";

// The 10 editable fields (1:1 with UpdateDatosFiscalesDto).
type Form = {
  legalName: string;
  tradeName: string;
  taxRegistration: string;
  taxRegistrationLabel: string;
  phone: string;
  taxAddress: string;
  zipCode: string;
  website: string;
  invoiceFooter: string;
  logoUrl: string;
  frontdeskAutoPresent: boolean;
};

function fromCentro(c: Centro): Form {
  return {
    legalName: c.legalName ?? "",
    tradeName: c.tradeName ?? "",
    taxRegistration: c.taxRegistration ?? "",
    taxRegistrationLabel: c.taxRegistrationLabel ?? "",
    phone: c.phone ?? "",
    taxAddress: c.taxAddress ?? "",
    zipCode: c.zipCode ?? "",
    website: c.website ?? "",
    invoiceFooter: c.invoiceFooter ?? "",
    logoUrl: c.logoUrl ?? "",
    // Defaults to true when the BE does not return it yet (the hook's factory behaviour).
    frontdeskAutoPresent: c.frontdeskAutoPresent ?? true,
  };
}

const EMPTY_FORM: Form = {
  legalName: "",
  tradeName: "",
  taxRegistration: "",
  taxRegistrationLabel: "",
  phone: "",
  taxAddress: "",
  zipCode: "",
  website: "",
  invoiceFooter: "",
  logoUrl: "",
  frontdeskAutoPresent: true,
};

// Per-center tax details (company definition): what prints on the invoice — legal name, tax
// registration, address, footer, logo, etc. RBAC is gated by the caller (centro.fiscal.write). Partial PUT.
export function DatosFiscalesDialog({
  centro,
  open,
  onOpenChange,
  onSaved,
}: {
  centro: Centro | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("admin.fiscal");
  const tc = useTranslations("admin");
  // Re-seeded whenever the dialog opens or the target center changes. Every field is optional
  // (partial PUT: an empty field is left untouched), so nothing is ever missing.
  const [form, update] = useDialogForm<Form>(
    () => (centro ? fromCentro(centro) : EMPTY_FORM),
    open,
    centro?.id,
  );

  const { submitting, submit } = useSubmit(
    async () => {
      // Unreachable: the caller opens the dialog only with a center.
      if (!centro) throw new Error("no center");
      // Send only string fields with content, trimmed. (Partial patch: empty fields are left alone.)
      // The LOGO does not go here: /tax-details does not accept it (that is why the letterhead came out
      // empty). It goes through PUT /centers/:id (updateCenter), below. See hojas-de-impresion-membrete-y-formatos.
      const payload: DatosFiscalesPayload = {};
      (Object.keys(form) as (keyof Form)[]).forEach((k) => {
        if (k === "logoUrl") return; // the logo goes through updateCenter, not tax details
        const val = form[k];
        if (typeof val !== "string") return; // the boolean is handled separately
        const v = val.trim();
        if (v) (payload as Record<string, string>)[k] = v;
      });
      // Frontdesk auto-present hook (boolean): its explicit state is always sent.
      (payload as Record<string, unknown>).frontdeskAutoPresent = form.frontdeskAutoPresent;
      await updateDatosFiscales(centro.id, payload);
      // Letterhead logo: only when it changed (sending "" clears it → sheets with no graphic letterhead).
      const logo = form.logoUrl.trim();
      if (logo !== (centro.logoUrl ?? "").trim()) {
        await updateCenter(centro.id, { logoUrl: logo });
      }
    },
    {
      successMessage: t("saved"),
      onSuccess: () => {
        onOpenChange(false);
        onSaved?.();
      },
    },
  );

  // Text fields only (the auto-present boolean is drawn separately with a Switch).
  type StrKey = Exclude<keyof Form, "frontdeskAutoPresent">;
  const FIELDS: { key: StrKey; area?: boolean }[] = [
    { key: "legalName" },
    { key: "tradeName" },
    { key: "taxRegistration" },
    { key: "taxRegistrationLabel" },
    { key: "phone" },
    { key: "taxAddress" },
    { key: "zipCode" },
    { key: "website" },
    { key: "logoUrl" },
    { key: "invoiceFooter", area: true },
  ];

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t("title", { name: centro?.name ?? "" })}
      description={t("description")}
      onSubmit={() => submit()}
      submitting={submitting}
      submitLabel={t("save")}
      submittingLabel={t("saving")}
      cancelLabel={tc("cancel")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(({ key, area }) => {
          const id = `tax-details-${key}`;
          return (
            <Field
              key={key}
              label={t(`field.${key}`)}
              htmlFor={id}
              className={area ? "sm:col-span-2" : undefined}
            >
              {area ? (
                <Textarea
                  id={id}
                  value={form[key]}
                  onChange={(e) => update({ [key]: e.target.value } as Partial<Form>)}
                  rows={3}
                />
              ) : (
                <Input
                  id={id}
                  value={form[key]}
                  onChange={(e) => update({ [key]: e.target.value } as Partial<Form>)}
                />
              )}
            </Field>
          );
        })}
      </div>

      <div className="flex items-start justify-between gap-4 rounded-md bg-card p-3 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
        <div className="space-y-0.5">
          <Label htmlFor="frontdesk-autopresente">{t("autopresenteLabel")}</Label>
          <p className="text-xs text-muted-foreground">{t("autopresenteHelp")}</p>
        </div>
        <Switch
          id="frontdesk-autopresente"
          checked={form.frontdeskAutoPresent}
          onCheckedChange={(v) => update({ frontdeskAutoPresent: v })}
        />
      </div>
    </FormDialog>
  );
}
