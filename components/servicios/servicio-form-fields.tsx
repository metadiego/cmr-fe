"use client";

import * as React from "react";
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

// Field/Toggle/GrupoSelect: piezas genéricas del formulario de servicio, extraídas de
// servicios-admin.tsx (que vive en su ceiling de DEBT) para hacerle lugar a un campo nuevo sin
// subir ese número. Sin lógica propia del dominio — puro layout de formulario.

// Selector de grupo de facturación (catálogo del BE, data-driven). "" = sin grupo.
export function GrupoSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const t = useTranslations("servicios");
  const tRoot = useTranslations();
  const { state } = useResource<GrupoFacturacion[]>(() => getGruposFacturacion(), []);
  const grupos = (state.kind === "ok" ? state.data : []).filter((g) => g.active !== false);
  const NONE = "__none__";
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="w-full"><SelectValue placeholder={t("field.grupoNone")} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("field.grupoNone")}</SelectItem>
        {grupos.map((g) => (
          <SelectItem key={g.id} value={g.id}>{tRoot(g.labelKey)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
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
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-16 cursor-pointer rounded border bg-transparent" />
    </Field>
  );
}

// Minutes between the start times the service offers and accepts (BE #525, `startStepMinutes`): 60 =
// on the hour only, like the call-center sheet for Láser / IV / Vit C. Empty = every slot. It does not
// change how long the session takes.
export function StartStepField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("servicios");
  return (
    <Field label={t("field.startStep")} hint={t("field.startStepHint")}>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        placeholder={t("field.startStepAny")}
        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
      />
    </Field>
  );
}
