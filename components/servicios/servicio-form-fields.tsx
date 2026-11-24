"use client";

import { useTranslations } from "next-intl";

import { getGruposFacturacion, type GrupoFacturacion } from "@/lib/api/servicios";
import { useResource } from "@/hooks/use-resource";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/kit/field";

// Toggle/GrupoSelect/…: generic pieces of the service form, moved out of servicios-admin.tsx (which
// lives at its DEBT ceiling). No domain logic — form layout only. Labels use the kit Field; every
// control takes the `id` its Field points at.

// Selector de grupo de facturación (catálogo del BE, data-driven). "" = sin grupo.
export function GrupoSelect({ id, value, onChange }: { id?: string; value: string; onChange: (id: string) => void }) {
  const t = useTranslations("servicios");
  const tRoot = useTranslations();
  const { state } = useResource<GrupoFacturacion[]>(() => getGruposFacturacion(), []);
  const grupos = (state.kind === "ok" ? state.data : []).filter((g) => g.active !== false);
  const NONE = "__none__";
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder={t("field.grupoNone")} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("field.grupoNone")}</SelectItem>
        {grupos.map((g) => (
          <SelectItem key={g.id} value={g.id}>{tRoot(g.labelKey)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Cómo numerar la visita cuando el servicio consume más de un paquete a la vez (BE #598, p. ej.
// láser: MLS + HILT juntos). "row" = cada paquete cuenta su propio renglón (default histórico);
// "most_delivered" = el paquete con más entregas numera la visita.
export function PrimaryPackageRuleSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: "row" | "most_delivered";
  onChange: (v: "row" | "most_delivered") => void;
}) {
  const t = useTranslations("servicios");
  return (
    <Field label={t("field.primaryPackageRule")} htmlFor={id} hint={t("field.primaryPackageRuleHint")}>
      <Select value={value} onValueChange={(v) => onChange(v as "row" | "most_delivered")}>
        <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="row">{t("primaryPackageRuleRow")}</SelectItem>
          <SelectItem value="most_delivered">{t("primaryPackageRuleMostDelivered")}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

// What one package session is (cmr-be #700): a visit (default) or a vial, where the dose of each visit
// decides — opening a vial spends a session, using the patient's remnant spends none.
export function SessionUnitSelect({ id, value, onChange }: { id?: string; value: "visit" | "vial"; onChange: (v: "visit" | "vial") => void }) {
  const t = useTranslations("servicios");
  return (
    <Field label={t("field.sessionUnit")} htmlFor={id} hint={t("field.sessionUnitHint")}>
      <Select value={value} onValueChange={(v) => onChange(v as "visit" | "vial")}>
        <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="visit">{t("sessionUnitVisit")}</SelectItem>
          <SelectItem value="vial">{t("sessionUnitVial")}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-card px-3 py-2 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className="min-w-0">
        <span className="text-sm">{label}</span>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// The service colour (calendar / board accent).
export function ColorField({ id, label, value, onChange }: { id?: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label} htmlFor={id}>
      <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-16 cursor-pointer rounded border bg-transparent" />
    </Field>
  );
}

// Minutes between the start times the service offers and accepts (BE #525, `startStepMinutes`): 60 =
// on the hour only, like the call-center sheet for Láser / IV / Vit C. Empty = every slot. It does not
// change how long the session takes.
export function StartStepField({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  const t = useTranslations("servicios");
  return (
    <Field label={t("field.startStep")} htmlFor={id} hint={t("field.startStepHint")}>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        placeholder={t("field.startStepAny")}
        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
      />
    </Field>
  );
}
