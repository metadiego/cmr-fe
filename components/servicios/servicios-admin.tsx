"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  getServicios,
  createServicio,
  updateServicio,
  type Servicio,
  type CreateServicioPayload,
} from "@/lib/api/servicios";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProductoPicker } from "@/components/inventario/producto-picker";

// slug estable para la clave (= clave del tablero/pestaña).
function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Servicios (config = pestañas de frontdesk). Cada servicio = una pestaña data-driven.
// productoId = Eje 2: con producto → la sesión descarga stock; null = servicio puro
// (solo cuenta, p.ej. Shock Wave). Al crear, el BE siembra columnas: el FE NO las compone.
// `embedded` = se incrusta en otra pantalla (p. ej. Configuración → Frontdesk → tab Servicios):
// sin contenedor de página ni título grande, misma funcionalidad. Reuso, no duplicar.
export function ServiciosAdmin({ embedded }: { embedded?: boolean } = {}) {
  const t = useTranslations("servicios");
  const tc = useTranslations("common");

  // Regla del dueño (2026-07-22): el servicio se CREA EN TODOS los centros y luego se DESHABILITA por
  // centro donde no se ofrezca (cada centro tiene su propia fila → toggle Activo por centro).
  const centrosRes = useResource<Centro[]>(() => getMyCentros(), []);
  const centros = React.useMemo(
    () => (centrosRes.state.kind === "ok" ? centrosRes.state.data : []),
    [centrosRes.state],
  );
  const [centroSel, setCentroSel] = React.useState("");
  const centro = centroSel || centros[0]?.id || "";

  const { state, reload } = useResource<Servicio[]>(
    () => (centro ? getServicios(centro) : Promise.resolve([])),
    [centro],
  );
  const servicios = state.kind === "ok" ? state.data : [];

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Servicio | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Deshabilitar/rehabilitar el servicio EN ESTE CENTRO (1 clic, sin abrir el editor).
  async function toggleActivo(s: Servicio) {
    setBusyId(s.id);
    try {
      await updateServicio(s.id, { activo: !s.activo }, centro);
      toast.success(s.activo ? t("deshabilitadoEn", { centro: centroNombre }) : t("habilitadoEn", { centro: centroNombre }));
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }
  const centroNombre = centros.find((c) => c.id === centro)?.nombre ?? "";

  return (
    <div className={embedded ? "" : "mx-auto max-w-5xl px-6 py-10"}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        {!embedded && <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>}
        <div className={"flex items-center gap-2 " + (embedded ? "w-full justify-between" : "")}>
          {centros.length > 1 && (
            <Select value={centro} onValueChange={setCentroSel}>
              <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            {t("new")}
          </Button>
        </div>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{t("helpMultiCentro")}</p>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{t("col.nombre")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.tipo")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.requisitos")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.estado")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {state.kind === "loading" && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{tc("loading")}</td></tr>
            )}
            {state.kind === "fail" && (
              <tr><td colSpan={5} className="px-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">{tc("error")}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={reload}>{tc("retry")}</Button>
              </td></tr>
            )}
            {state.kind === "ok" && servicios.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{t("empty")}</td></tr>
            )}
            {servicios.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? "#94a3b8" }} />
                    {s.nombre}
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{s.clave}</span>
                </td>
                <td className="px-3 py-2">
                  {s.productoId ? (
                    <Badge variant="secondary">{t("tipoInventariable")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("tipoPuro")}</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {[s.requiereTecnico && t("tecnico"), s.requiereEnfermera && t("enfermera")]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="px-3 py-2">
                  {/* Activo POR CENTRO: apagar aquí = este centro no ofrece el servicio (no borra nada). */}
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <Switch
                      checked={s.activo}
                      disabled={busyId === s.id}
                      onCheckedChange={() => toggleActivo(s)}
                      aria-label={t("field.activo")}
                    />
                    <span className={"text-xs " + (s.activo ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                      {s.activo ? t("active") : t("inactive")}
                    </span>
                  </label>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setOpen(true); }}>
                    {tc("edit")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ServicioForm open={open} servicio={editing} centro={centro} centros={centros} onOpenChange={setOpen} onSaved={reload} />
    </div>
  );
}

type FormState = {
  clave: string;
  nombre: string;
  color: string;
  orden: string;
  productoId: string;
  requiereTecnico: boolean;
  requiereEnfermera: boolean;
  badge: boolean;
  activo: boolean;
};
const EMPTY: FormState = {
  clave: "",
  nombre: "",
  color: "#3b82f6",
  orden: "",
  productoId: "",
  requiereTecnico: false,
  requiereEnfermera: false,
  badge: true,
  activo: true,
};

function ServicioForm({
  open,
  servicio,
  centro,
  centros,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  servicio: Servicio | null;
  centro: string; // centro seleccionado (para editar SU fila)
  centros: Centro[]; // alta = crear en TODOS los centros
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("servicios");
  const tc = useTranslations("common");
  const isEdit = !!servicio;

  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [claveTouched, setClaveTouched] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [prevId, setPrevId] = React.useState<string | undefined>(undefined);
  if (open && servicio?.id !== prevId) {
    setPrevId(servicio?.id);
    setClaveTouched(!!servicio);
    setForm(
      servicio
        ? {
            clave: servicio.clave,
            nombre: servicio.nombre,
            color: servicio.color ?? "#3b82f6",
            orden: servicio.orden != null ? String(servicio.orden) : "",
            productoId: servicio.productoId ?? "",
            requiereTecnico: servicio.requiereTecnico,
            requiereEnfermera: servicio.requiereEnfermera,
            badge: servicio.badge,
            activo: servicio.activo,
          }
        : EMPTY,
    );
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  // clave autogenerada del nombre mientras no se edite a mano (solo en alta).
  const claveEff = isEdit || claveTouched ? form.clave : slugify(form.nombre);
  const canSubmit = form.nombre.trim().length > 0 && claveEff.trim().length > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (isEdit && servicio) {
        // Editar toca SOLO la fila de este centro (nombre/color/etc. del centro seleccionado).
        await updateServicio(servicio.id, {
          nombre: form.nombre.trim(),
          color: form.color,
          orden: form.orden.trim() ? Number(form.orden) : undefined,
          productoId: form.productoId || undefined,
          requiereTecnico: form.requiereTecnico,
          requiereEnfermera: form.requiereEnfermera,
          badge: form.badge,
          activo: form.activo,
        }, centro);
        toast.success(t("updated"));
      } else {
        // Alta: se crea EN TODOS los centros (regla del dueño); luego se deshabilita por centro donde no
        // aplique. El BE siembra las columnas por defecto → NO componemos columnas aquí.
        const payload = {
          clave: claveEff.trim(),
          nombre: form.nombre.trim(),
          color: form.color,
          orden: form.orden.trim() ? Number(form.orden) : undefined,
          productoId: form.productoId || undefined,
          requiereTecnico: form.requiereTecnico,
          requiereEnfermera: form.requiereEnfermera,
          badge: form.badge,
        } as CreateServicioPayload;
        const destinos = centros.length ? centros : [{ id: centro, nombre: "" } as Centro];
        const resultados = await Promise.allSettled(
          destinos.map((c) => createServicio(payload, c.id)),
        );
        const fallos = resultados
          .map((r, i) => (r.status === "rejected" ? destinos[i].nombre : null))
          .filter(Boolean);
        if (fallos.length === destinos.length) {
          // Nada se creó (p. ej. clave duplicada en todos) → error real.
          const primero = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
          throw primero.reason;
        }
        if (fallos.length > 0) {
          toast.warning(t("createdParcial", { centros: fallos.join(", ") }));
        } else {
          toast.success(t("createdTodos", { n: destinos.length }));
        }
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? t("editTitle") : t("newTitle")}</SheetTitle>
          <SheetDescription>{isEdit ? t("formHelp") : t("formHelpAlta")}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4">
          <Field label={t("field.nombre")}>
            <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.clave")}>
              <Input
                value={claveEff}
                onChange={(e) => { setClaveTouched(true); set("clave", e.target.value); }}
                disabled={isEdit}
                className="font-mono"
              />
            </Field>
            <Field label={t("field.orden")}>
              <Input inputMode="numeric" value={form.orden} onChange={(e) => set("orden", e.target.value)} placeholder="0" />
            </Field>
          </div>
          <Field label={t("field.color")}>
            <input
              type="color"
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
              className="h-9 w-16 cursor-pointer rounded border bg-transparent"
            />
          </Field>

          {/* Eje 2 — producto vinculado (descarga por sesión) o servicio puro */}
          <Field label={t("field.producto")} hint={t("field.productoHint")}>
            <ProductoPicker value={form.productoId} onChange={(id) => set("productoId", id)} placeholder={t("field.productoNone")} />
          </Field>

          <Toggle label={t("field.requiereTecnico")} checked={form.requiereTecnico} onChange={(v) => set("requiereTecnico", v)} />
          <Toggle label={t("field.requiereEnfermera")} checked={form.requiereEnfermera} onChange={(v) => set("requiereEnfermera", v)} />
          <Toggle label={t("field.badge")} checked={form.badge} onChange={(v) => set("badge", v)} />
          {isEdit && <Toggle label={t("field.activo")} checked={form.activo} onChange={(v) => set("activo", v)} />}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>{submitting ? tc("saving") : tc("save")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
