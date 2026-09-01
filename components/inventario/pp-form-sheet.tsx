"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  createPresentacionProveedor,
  updatePresentacionProveedor,
  type PresentacionProveedor,
  type CreatePresentacionProveedorPayload,
  type Clasificacion,
  type Unidad,
} from "@/lib/api/inventario";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const NONE = "__none__";

type FormState = {
  nombre: string;
  fabricanteId: string;
  marcaId: string;
  concentracion: string;
  unidadConcentracionId: string;
  contenidoPorEmpaque: string;
  unidadContenidoId: string;
  factorABase: string;
  sku: string;
  barcode: string;
  vigenciaDesde: string;
  vigenciaHasta: string;
  activo: boolean;
};

const EMPTY: FormState = {
  nombre: "",
  fabricanteId: "",
  marcaId: "",
  concentracion: "",
  unidadConcentracionId: "",
  contenidoPorEmpaque: "",
  unidadContenidoId: "",
  factorABase: "",
  sku: "",
  barcode: "",
  vigenciaDesde: "",
  vigenciaHasta: "",
  activo: true,
};

function fromEntity(p: PresentacionProveedor): FormState {
  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    nombre: p.nombre ?? "",
    fabricanteId: p.fabricanteId ?? "",
    marcaId: p.marcaId ?? "",
    concentracion: s(p.concentracion),
    unidadConcentracionId: p.unidadConcentracionId ?? "",
    contenidoPorEmpaque: s(p.contenidoPorEmpaque),
    unidadContenidoId: p.unidadContenidoId ?? "",
    factorABase: s(p.factorABase),
    sku: p.sku ?? "",
    barcode: p.barcode ?? "",
    vigenciaDesde: p.vigenciaDesde?.slice(0, 10) ?? "",
    vigenciaHasta: p.vigenciaHasta?.slice(0, 10) ?? "",
    activo: p.activo ?? true,
  };
}

// Alta/edición de una presentación de proveedor (AMP). Aquí vive TODO lo que cambia
// cuando cambia el proveedor/presentación — el producto base no se toca. La pieza
// clave es `factorABase` (unidades base por empaque): el BE la usa para convertir la
// compra a la unidad base del producto.
export function PPFormSheet({
  open,
  productoId,
  presentacion,
  fabricantes,
  marcas,
  unidades,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  productoId: string;
  presentacion?: PresentacionProveedor | null;
  fabricantes: Clasificacion[];
  marcas: Clasificacion[];
  unidades: Unidad[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("inventario.pp");
  const tc = useTranslations("common");
  const isEdit = !!presentacion;

  const [form, setForm] = React.useState<FormState>(
    presentacion ? fromEntity(presentacion) : EMPTY,
  );
  const [submitting, setSubmitting] = React.useState(false);

  const [prevId, setPrevId] = React.useState(presentacion?.id);
  const targetId = presentacion?.id;
  if (targetId !== prevId) {
    setPrevId(targetId);
    setForm(presentacion ? fromEntity(presentacion) : EMPTY);
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  const canSubmit = form.nombre.trim().length > 0 && !submitting;

  async function onSubmit() {
    if (!form.nombre.trim()) return;
    setSubmitting(true);
    try {
      const num = (s: string) => {
        const n = Number(s);
        return s.trim() && !Number.isNaN(n) ? n : undefined;
      };
      const txt = (s: string) => (s.trim() ? s.trim() : undefined);
      const id = (s: string) => (s && s !== NONE ? s : undefined);
      const base = {
        nombre: form.nombre.trim(),
        fabricanteId: id(form.fabricanteId),
        marcaId: id(form.marcaId),
        concentracion: num(form.concentracion),
        unidadConcentracionId: id(form.unidadConcentracionId),
        contenidoPorEmpaque: num(form.contenidoPorEmpaque),
        unidadContenidoId: id(form.unidadContenidoId),
        factorABase: num(form.factorABase),
        sku: txt(form.sku),
        barcode: txt(form.barcode),
        vigenciaDesde: txt(form.vigenciaDesde),
        vigenciaHasta: txt(form.vigenciaHasta),
      };
      if (isEdit && presentacion) {
        await updatePresentacionProveedor(presentacion.id, {
          ...base,
          activo: form.activo,
        });
      } else {
        await createPresentacionProveedor({
          productoId,
          ...base,
        } as CreatePresentacionProveedorPayload);
      }
      toast.success(isEdit ? t("updated") : t("created"));
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
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4">
          <Field label={t("field.nombre")}>
            <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </Field>

          {/* factorABase — la pieza clave: se resalta. */}
          <div className="rounded-md bg-primary/5 p-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            <Field label={t("field.factorABase")} hint={t("field.factorABaseHint")}>
              <Input
                inputMode="decimal"
                value={form.factorABase}
                onChange={(e) => set("factorABase", e.target.value)}
                placeholder="60"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.fabricante")}>
              <CatalogSelect
                value={form.fabricanteId}
                onChange={(v) => set("fabricanteId", v)}
                options={fabricantes.map((c) => ({ id: c.id, nombre: c.nombre }))}
                placeholder={t("field.none")}
              />
            </Field>
            <Field label={t("field.marca")}>
              <CatalogSelect
                value={form.marcaId}
                onChange={(v) => set("marcaId", v)}
                options={marcas.map((c) => ({ id: c.id, nombre: c.nombre }))}
                placeholder={t("field.none")}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.concentracion")}>
              <Input
                inputMode="decimal"
                value={form.concentracion}
                onChange={(e) => set("concentracion", e.target.value)}
              />
            </Field>
            <Field label={t("field.unidadConcentracion")}>
              <CatalogSelect
                value={form.unidadConcentracionId}
                onChange={(v) => set("unidadConcentracionId", v)}
                options={unidades.map((u) => ({ id: u.id, nombre: u.nombre }))}
                placeholder={t("field.none")}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.contenido")}>
              <Input
                inputMode="decimal"
                value={form.contenidoPorEmpaque}
                onChange={(e) => set("contenidoPorEmpaque", e.target.value)}
              />
            </Field>
            <Field label={t("field.unidadContenido")}>
              <CatalogSelect
                value={form.unidadContenidoId}
                onChange={(v) => set("unidadContenidoId", v)}
                options={unidades.map((u) => ({ id: u.id, nombre: u.nombre }))}
                placeholder={t("field.none")}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.sku")}>
              <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} />
            </Field>
            <Field label={t("field.barcode")}>
              <Input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.vigenciaDesde")}>
              <Input
                type="date"
                value={form.vigenciaDesde}
                onChange={(e) => set("vigenciaDesde", e.target.value)}
              />
            </Field>
            <Field label={t("field.vigenciaHasta")}>
              <Input
                type="date"
                value={form.vigenciaHasta}
                onChange={(e) => set("vigenciaHasta", e.target.value)}
              />
            </Field>
          </div>

          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm">{t("field.activo")}</span>
              <Switch checked={form.activo} onCheckedChange={(v) => set("activo", v)} />
            </div>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {submitting ? tc("saving") : tc("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function CatalogSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; nombre: string }[];
  placeholder: string;
}) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
