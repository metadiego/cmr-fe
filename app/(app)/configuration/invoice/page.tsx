"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getMyCentros, updateDatosFiscales, type Centro, type DatosFiscalesPayload } from "@/lib/api/centers";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { apiErrorMessage } from "@/lib/api/errors";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Configuración → Factura: header/footer fiscal POR CENTRO. Lee del Centro (getMyCentros trae los
// campos crudos direccionFiscal+zip) y guarda con PUT /centros/:id/datos-fiscales (RBAC
// centro.fiscal.write). Handoff fe-config-header-footer-factura. Multi-centro: cada sucursal el suyo.
export default function ConfigFacturaPage() {
  const t = useTranslations("configFactura");
  const tc = useTranslations("common");
  const centrosRes = useResource<Centro[]>(() => getMyCentros(), []);
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const [centroId, setCentroId] = React.useState<string>("");
  const selected = centros.find((c) => c.id === centroId) ?? centros[0] ?? null;

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />

      {centrosRes.state.kind === "loading" ? (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      ) : centros.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noCentros")}</p>
      ) : (
        <>
          <label className="mb-6 flex max-w-xs flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("centro")}</span>
            <Select value={selected?.id ?? ""} onValueChange={setCentroId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>

          {selected && (
            <FiscalForm key={selected.id} centro={selected} onSaved={centrosRes.reload} />
          )}
        </>
      )}
    </PageContainer>
  );
}

type FormState = {
  logoUrl: string;
  nombreLegal: string;
  nombreComercial: string;
  registroFiscal: string;
  registroFiscalLabel: string;
  telefono: string;
  direccionFiscal: string;
  zip: string;
  web: string;
  pieFactura: string;
  frontdeskAutopresente: boolean;
};

function seed(c: Centro): FormState {
  return {
    logoUrl: c.logoUrl ?? "",
    nombreLegal: c.legalName ?? "",
    nombreComercial: c.tradeName ?? "",
    registroFiscal: c.taxRegistration ?? "",
    registroFiscalLabel: c.taxRegistrationLabel ?? "",
    telefono: c.phone ?? "",
    direccionFiscal: c.taxAddress ?? "",
    zip: c.zipCode ?? "",
    web: c.website ?? "",
    pieFactura: c.invoiceFooter ?? "",
    // Enganche facturación↔frontdesk (auto-presente al saldar). Default true si el BE aún no lo trae.
    frontdeskAutopresente: c.frontdeskAutoPresent ?? true,
  };
}

function FiscalForm({ centro, onSaved }: { centro: Centro; onSaved: () => void }) {
  const t = useTranslations("configFactura");
  const tc = useTranslations("common");
  const { can } = useCan();
  const canWrite = can("centro.fiscal.write");
  // Sembrado por `key={centro.id}` en el padre → initializer fresco al cambiar de centro (sin effect).
  const [form, setForm] = React.useState<FormState>(() => seed(centro));
  const [saving, setSaving] = React.useState(false);
  const set = <K extends keyof FormState>(k: K, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function guardar() {
    setSaving(true);
    // Patch parcial: todos los campos que gestiona el form (string vacío = limpiar).
    const payload: DatosFiscalesPayload = {
      logoUrl: form.logoUrl.trim(),
      legalName: form.nombreLegal.trim(),
      tradeName: form.nombreComercial.trim(),
      taxRegistration: form.registroFiscal.trim(),
      taxRegistrationLabel: form.registroFiscalLabel.trim(),
      phone: form.telefono.trim(),
      taxAddress: form.direccionFiscal.trim(),
      zipCode: form.zip.trim(),
      website: form.web.trim(),
      invoiceFooter: form.pieFactura,
      frontdeskAutoPresent: form.frontdeskAutopresente,
    };
    try {
      await updateDatosFiscales(centro.id, payload);
      toast.success(t("saved"));
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        {/* Encabezado */}
        <section className="space-y-4 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-5">
          <h2 className="text-sm font-semibold">{t("headerTitle")}</h2>
          <Field label={t("f.logoUrl")} hint={t("f.logoUrlHint")}>
            <Input value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("f.nombreLegal")}><Input value={form.nombreLegal} onChange={(e) => set("nombreLegal", e.target.value)} /></Field>
            <Field label={t("f.nombreComercial")}><Input value={form.nombreComercial} onChange={(e) => set("nombreComercial", e.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <Field label={t("f.registroFiscal")}><Input value={form.registroFiscal} onChange={(e) => set("registroFiscal", e.target.value)} /></Field>
            <Field label={t("f.registroFiscalLabel")}><Input value={form.registroFiscalLabel} onChange={(e) => set("registroFiscalLabel", e.target.value)} placeholder="MN" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("f.telefono")}><Input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} /></Field>
            <Field label={t("f.web")}><Input value={form.web} onChange={(e) => set("web", e.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <Field label={t("f.direccionFiscal")}><Input value={form.direccionFiscal} onChange={(e) => set("direccionFiscal", e.target.value)} /></Field>
            <Field label={t("f.zip")}><Input value={form.zip} onChange={(e) => set("zip", e.target.value)} /></Field>
          </div>
        </section>

        {/* Pie */}
        <section className="space-y-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-5">
          <h2 className="text-sm font-semibold">{t("footerTitle")}</h2>
          <Field label={t("f.pieFactura")} hint={t("f.pieFacturaHint")}>
            <Textarea rows={4} value={form.pieFactura} onChange={(e) => set("pieFactura", e.target.value)} />
          </Field>
        </section>

        {/* Enganche facturación ↔ frontdesk */}
        <section className="space-y-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-5">
          <h2 className="text-sm font-semibold">{t("autopresenteTitle")}</h2>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-sm font-medium">{t("autopresenteLabel")}</span>
              <p className="text-xs text-muted-foreground">{t("autopresenteHelp")}</p>
            </div>
            <Switch
              checked={form.frontdeskAutopresente}
              disabled={!canWrite}
              onCheckedChange={(v) => setForm((p) => ({ ...p, frontdeskAutopresente: v }))}
            />
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button onClick={guardar} disabled={saving || !canWrite}>{saving ? tc("saving") : tc("save")}</Button>
          {!canWrite && <span className="text-xs text-muted-foreground">{t("noPermiso")}</span>}
        </div>
      </div>

      {/* Vista previa (branding del recibo, en vivo) */}
      <aside className="lg:sticky lg:top-6 h-fit rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("preview")}</span>
        <div className="mt-3 space-y-1 rounded-lg bg-background p-4 text-center text-xs">
          {form.logoUrl.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logoUrl} alt="logo" className="mx-auto mb-2 max-h-16 object-contain" />
          ) : null}
          {form.nombreLegal && <div className="text-sm font-bold uppercase">{form.nombreLegal}</div>}
          {form.nombreComercial && <div className="font-medium">{form.nombreComercial}</div>}
          <div className="font-medium">{centro.name}</div>
          {form.registroFiscal && <div>{(form.registroFiscalLabel || "MN")}: {form.registroFiscal}</div>}
          {(form.direccionFiscal || form.zip) && <div>{[form.direccionFiscal, form.zip].filter(Boolean).join(", ")}</div>}
          {form.telefono && <div>{form.telefono}</div>}
          {form.web && <div>{form.web}</div>}
          {form.pieFactura && (
            <div className="mt-3 whitespace-pre-line border-t pt-2 text-left text-[10px] text-muted-foreground">{form.pieFactura}</div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground/80">{hint}</span>}
    </label>
  );
}
