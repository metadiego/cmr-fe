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
  name: string;
  manufacturerId: string;
  brandId: string;
  concentration: string;
  concentrationUnitId: string;
  contentPerPackage: string;
  contentUnitId: string;
  baseConversionFactor: string;
  sku: string;
  barcode: string;
  validFrom: string;
  validUntil: string;
  active: boolean;
};

const EMPTY: FormState = {
  name: "",
  manufacturerId: "",
  brandId: "",
  concentration: "",
  concentrationUnitId: "",
  contentPerPackage: "",
  contentUnitId: "",
  baseConversionFactor: "",
  sku: "",
  barcode: "",
  validFrom: "",
  validUntil: "",
  active: true,
};

function fromEntity(p: PresentacionProveedor): FormState {
  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    name: p.name ?? "",
    manufacturerId: p.manufacturerId ?? "",
    brandId: p.brandId ?? "",
    concentration: s(p.concentration),
    concentrationUnitId: p.concentrationUnitId ?? "",
    contentPerPackage: s(p.contentPerPackage),
    contentUnitId: p.contentUnitId ?? "",
    baseConversionFactor: s(p.baseConversionFactor),
    sku: p.sku ?? "",
    barcode: p.barcode ?? "",
    validFrom: p.validFrom?.slice(0, 10) ?? "",
    validUntil: p.validUntil?.slice(0, 10) ?? "",
    active: p.active ?? true,
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

  const canSubmit = form.name.trim().length > 0 && !submitting;

  async function onSubmit() {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const num = (s: string) => {
        const n = Number(s);
        return s.trim() && !Number.isNaN(n) ? n : undefined;
      };
      const txt = (s: string) => (s.trim() ? s.trim() : undefined);
      const id = (s: string) => (s && s !== NONE ? s : undefined);
      const base = {
        name: form.name.trim(),
        manufacturerId: id(form.manufacturerId),
        brandId: id(form.brandId),
        concentration: num(form.concentration),
        concentrationUnitId: id(form.concentrationUnitId),
        contentPerPackage: num(form.contentPerPackage),
        contentUnitId: id(form.contentUnitId),
        baseConversionFactor: num(form.baseConversionFactor),
        sku: txt(form.sku),
        barcode: txt(form.barcode),
        validFrom: txt(form.validFrom),
        validUntil: txt(form.validUntil),
      };
      if (isEdit && presentacion) {
        await updatePresentacionProveedor(presentacion.id, {
          ...base,
          active: form.active,
        });
      } else {
        await createPresentacionProveedor({
          productId: productoId,
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
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>

          {/* factorABase — la pieza clave: se resalta. */}
          <div className="rounded-md bg-primary/5 p-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            <Field label={t("field.factorABase")} hint={t("field.factorABaseHint")}>
              <Input
                inputMode="decimal"
                value={form.baseConversionFactor}
                onChange={(e) => set("baseConversionFactor", e.target.value)}
                placeholder="60"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.fabricante")}>
              <CatalogSelect
                value={form.manufacturerId}
                onChange={(v) => set("manufacturerId", v)}
                options={fabricantes.map((c) => ({ id: c.id, nombre: c.name }))}
                placeholder={t("field.none")}
              />
            </Field>
            <Field label={t("field.marca")}>
              <CatalogSelect
                value={form.brandId}
                onChange={(v) => set("brandId", v)}
                options={marcas.map((c) => ({ id: c.id, nombre: c.name }))}
                placeholder={t("field.none")}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.concentracion")}>
              <Input
                inputMode="decimal"
                value={form.concentration}
                onChange={(e) => set("concentration", e.target.value)}
              />
            </Field>
            <Field label={t("field.unidadConcentracion")}>
              <CatalogSelect
                value={form.concentrationUnitId}
                onChange={(v) => set("concentrationUnitId", v)}
                options={unidades.map((u) => ({ id: u.id, nombre: u.name }))}
                placeholder={t("field.none")}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.contenido")}>
              <Input
                inputMode="decimal"
                value={form.contentPerPackage}
                onChange={(e) => set("contentPerPackage", e.target.value)}
              />
            </Field>
            <Field label={t("field.unidadContenido")}>
              <CatalogSelect
                value={form.contentUnitId}
                onChange={(v) => set("contentUnitId", v)}
                options={unidades.map((u) => ({ id: u.id, nombre: u.name }))}
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
                value={form.validFrom}
                onChange={(e) => set("validFrom", e.target.value)}
              />
            </Field>
            <Field label={t("field.vigenciaHasta")}>
              <Input
                type="date"
                value={form.validUntil}
                onChange={(e) => set("validUntil", e.target.value)}
              />
            </Field>
          </div>

          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm">{t("field.activo")}</span>
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
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
