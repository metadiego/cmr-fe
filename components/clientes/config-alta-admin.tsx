"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getConfigAltaPacientes,
  updateConfigAltaPacientes,
} from "@/lib/api/pacientes";
import { getActiveCentro } from "@/lib/tenant";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useMe, isAdmin } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Campos que el alta puede exigir (además de `nombres`, que es SIEMPRE obligatorio). Son las claves
// del CreatePacienteDto que el formulario de alta captura; la etiqueta sale de patients.form.* (i18n).
const CAMPOS = [
  "apellidos",
  "docId",
  "sexo",
  "fechaNacimiento",
  "nacionalidad",
  "telefono",
  "whatsapp",
  "email",
  "direccion",
  "zipcode",
  "record",
  "aseguradora",
] as const;

export function ConfigAltaAdmin() {
  const t = useTranslations("configAlta");
  const tf = useTranslations("patients.form");
  const tRoot = useTranslations();
  const centro = getActiveCentro() ?? undefined;
  const me = useMe();
  const admin = me.kind === "ok" && isAdmin(me.me);

  const { state, reload } = useResource(() => getConfigAltaPacientes(centro), [centro]);
  const [sel, setSel] = React.useState<Set<string> | null>(null);
  const [alcance, setAlcance] = React.useState<"centro" | "todos">("centro");
  const [saving, setSaving] = React.useState(false);

  // Sembrar la selección desde la config del BE la primera vez que carga. Ajuste de estado EN RENDER
  // (patrón guardado de React), NO setState-en-effect (que el linter prohíbe).
  if (state.kind === "ok" && sel === null) {
    setSel(new Set(state.data.camposObligatorios));
  }

  const requerido = (campo: string) => sel?.has(campo) ?? false;
  function toggle(campo: string) {
    setSel((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(campo)) next.delete(campo);
      else next.add(campo);
      return next;
    });
  }

  async function guardar() {
    if (!sel) return;
    setSaving(true);
    try {
      const res = await updateConfigAltaPacientes(
        { camposObligatorios: [...sel], alcance },
        centro,
      );
      toast.success(
        alcance === "todos"
          ? t("guardadoTodos", { n: res.centros?.length ?? 0 })
          : t("guardado"),
      );
      reload();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setSaving(false);
    }
  }

  if (state.kind === "fail") {
    return (
      <div className="text-sm">
        <p className="text-muted-foreground">{tRoot("common.error")}</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={reload}>
          {tRoot("common.retry")}
        </Button>
      </div>
    );
  }
  if (state.kind === "loading" || sel === null) {
    return <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
          <span className="text-sm font-medium">{tf("nombres")}</span>
          <span className="text-xs text-muted-foreground">{t("siempre")}</span>
        </div>
        {CAMPOS.map((campo) => (
          <div key={campo} className="flex items-center justify-between border-b px-4 py-2.5 last:border-b-0">
            <Label htmlFor={`req-${campo}`} className="text-sm font-normal">
              {tf.has(campo) ? tf(campo) : campo}
            </Label>
            <Switch id={`req-${campo}`} checked={requerido(campo)} onCheckedChange={() => toggle(campo)} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("alcance")}</span>
          <Select value={alcance} onValueChange={(v) => setAlcance(v as "centro" | "todos")}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="centro">{t("alcanceCentro")}</SelectItem>
              {admin ? <SelectItem value="todos">{t("alcanceTodos")}</SelectItem> : null}
            </SelectContent>
          </Select>
        </label>
        <div className="ml-auto">
          <Button onClick={guardar} disabled={saving || !sel}>
            {saving ? tRoot("common.saving") : tRoot("common.save")}
          </Button>
        </div>
      </div>
      {alcance === "todos" ? (
        <p className="rounded-md border border-warning/40 bg-warning px-3 py-2 text-xs text-warning-foreground">
          {t("alcanceAviso")}
        </p>
      ) : null}
    </div>
  );
}
