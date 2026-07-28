"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";

import {
  getServicios,
  updateServicio,
  getRequeridosBindings,
  type Servicio,
  type ServicioCampo,
  type ServicioFormAcciones,
  type RequeridoBinding,
} from "@/lib/api/servicios";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NO_BINDING = "__form__"; // "En el formulario" = sin binding (se captura en el modal de acciones)
const TIPOS = ["texto", "numero", "fecha", "bool", "select"];
const ACCIONES = ["presente", "en_terapia", "asistido"]; // dónde se exige (en); hoy se usa asistido

// Configura los CAMPOS REQUERIDOS de un servicio (formAcciones.campos). Data-driven: cada campo declara
// si es requerido, en qué acción, y DÓNDE vive su valor (binding a la entidad/paquete, o el formulario).
// El BE es la autoridad (rechaza binding fuera del catálogo). Multi-tenant por centro.
export function RequeridosConfig({ centro }: { centro?: string }) {
  const t = useTranslations("requeridos");
  const tRoot = useTranslations();

  const servRes = useResource<Servicio[]>(() => getServicios(centro, { includeInactive: true }), [centro]);
  const servicios = React.useMemo(
    () => (servRes.state.kind === "ok" ? servRes.state.data : []).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre)),
    [servRes.state],
  );
  const bindRes = useResource<RequeridoBinding[]>(() => getRequeridosBindings(centro), [centro]);
  const bindings = bindRes.state.kind === "ok" ? bindRes.state.data : [];

  const [servId, setServId] = React.useState("");
  const servicio = servicios.find((s) => s.id === servId) ?? servicios[0] ?? null;

  return (
    <div className="space-y-5">
      <label className="flex max-w-xs flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t("servicio")}</span>
        <Select value={servicio?.id ?? ""} onValueChange={setServId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {servicios.map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      {servRes.state.kind === "loading" && <p className="text-sm text-muted-foreground">…</p>}
      {servicio && (
        <CamposEditor
          key={servicio.id}
          servicio={servicio}
          bindings={bindings}
          centro={centro}
          onSaved={servRes.reload}
          t={t}
          tRoot={tRoot}
        />
      )}
    </div>
  );
}

type TFn = ReturnType<typeof useTranslations>;

function CamposEditor({
  servicio,
  bindings,
  centro,
  onSaved,
  t,
  tRoot,
}: {
  servicio: Servicio;
  bindings: RequeridoBinding[];
  centro?: string;
  onSaved: () => void;
  t: TFn;
  tRoot: TFn;
}) {
  const fa = (servicio.formAcciones ?? {}) as ServicioFormAcciones;
  const [rows, setRows] = React.useState<ServicioCampo[]>(() => (fa.campos ?? []).map((c) => ({ ...c })));
  const [saving, setSaving] = React.useState(false);

  const set = (i: number, patch: Partial<ServicioCampo>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => setRows((rs) => [...rs, { clave: "", tipo: "texto", requerido: true, en: "asistido" }]);
  const del = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  // Agrupa el catálogo de bindings por grupo para el desplegable.
  const porGrupo = bindings.reduce<Record<string, RequeridoBinding[]>>((acc, b) => { (acc[b.grupo] ??= []).push(b); return acc; }, {});

  async function guardar() {
    setSaving(true);
    try {
      const campos = rows.filter((r) => r.clave.trim()).map((r) => {
        const c: ServicioCampo = { clave: r.clave.trim(), tipo: r.tipo, requerido: !!r.requerido, en: r.en || "asistido" };
        if (r.labelKey) c.labelKey = r.labelKey;
        if (r.binding) c.binding = r.binding; // ausente = se captura en el formulario
        return c;
      });
      await updateServicio(servicio.id, { formAcciones: ({ ...fa, campos } as unknown) as Record<string, never> }, centro);
      toast.success(t("guardado"));
      onSaved();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t("etiqueta")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("clave")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("tipo")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("requerido")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("en")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("dondeVive")}</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">{t("sinCampos")}</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-1.5"><Input className="h-8 w-40" value={r.labelKey ?? ""} placeholder="fd.col.dosis" onChange={(e) => set(i, { labelKey: e.target.value })} /></td>
                <td className="px-3 py-1.5"><Input className="h-8 w-32" value={r.clave} onChange={(e) => set(i, { clave: e.target.value })} /></td>
                <td className="px-3 py-1.5">
                  <Select value={r.tipo ?? "texto"} onValueChange={(v) => set(i, { tipo: v })}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS.map((tp) => <SelectItem key={tp} value={tp}>{t(`tipos.${tp}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-1.5"><Switch checked={!!r.requerido} onCheckedChange={(v) => set(i, { requerido: v })} /></td>
                <td className="px-3 py-1.5">
                  <Select value={r.en ?? "asistido"} onValueChange={(v) => set(i, { en: v })}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{ACCIONES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-1.5">
                  <Select value={r.binding ?? NO_BINDING} onValueChange={(v) => set(i, { binding: v === NO_BINDING ? undefined : v })}>
                    <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_BINDING}>{t("enFormulario")}</SelectItem>
                      {Object.entries(porGrupo).map(([grupo, items]) => (
                        <React.Fragment key={grupo}>
                          {items.map((b) => (
                            <SelectItem key={b.binding} value={b.binding}>
                              {tRoot.has(b.labelKey) ? tRoot(b.labelKey) : b.binding}
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button type="button" onClick={() => del(i)} className="text-muted-foreground hover:text-destructive" aria-label={t("quitar")}>
                    <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t("ayudaBinding")}</p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <HugeiconsIcon icon={Add01Icon} className="size-4" /> {t("agregarCampo")}
        </Button>
        <div className="ml-auto"><Button type="button" onClick={guardar} disabled={saving}>{saving ? t("guardando") : t("guardar")}</Button></div>
      </div>
    </div>
  );
}
