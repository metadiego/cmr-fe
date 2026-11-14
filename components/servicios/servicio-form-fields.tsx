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

// Cómo numerar la visita cuando el servicio consume más de un paquete a la vez (BE #598, p. ej.
// láser: MLS + HILT juntos). "row" = cada paquete cuenta su propio renglón (default histórico);
// "most_delivered" = el paquete con más entregas numera la visita.
export function PrimaryPackageRuleSelect({
  value,
  onChange,
}: {
  value: "row" | "most_delivered";
  onChange: (v: "row" | "most_delivered") => void;
}) {
  const t = useTranslations("servicios");
  return (
    <Field label={t("field.primaryPackageRule")} hint={t("field.primaryPackageRuleHint")}>
      <Select value={value} onValueChange={(v) => onChange(v as "row" | "most_delivered")}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="row">{t("primaryPackageRuleRow")}</SelectItem>
          <SelectItem value="most_delivered">{t("primaryPackageRuleMostDelivered")}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

// Confirmación de edición multicentro: deja claro a cuántos/qué centros aplica, antes de tocarlos.
export function MultiConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel,
  submitting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  submitting: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={submitting}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
