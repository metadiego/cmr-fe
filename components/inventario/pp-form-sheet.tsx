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
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSheet } from "@/components/kit/form-sheet";
import { Field } from "@/components/kit/field";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import { missingFields } from "@/lib/forms/missing";

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

// Create/edit a supplier presentation (AMP). Everything that changes when the supplier or its
// presentation changes lives here; the base product is untouched. The key piece is
// `baseConversionFactor` (base units per package): the BE uses it to convert a purchase to the
// product's base unit.
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
  const isEdit = !!presentacion;

  // Re-initialised when the sheet opens or another presentation is loaded.
  const [form, update] = useDialogForm<FormState>(
    () => (presentacion ? fromEntity(presentacion) : EMPTY),
    open,
    presentacion?.id,
  );

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    update({ [k]: v } as Partial<FormState>);
  }

  const missing = missingFields([[t("field.nombre"), form.name.trim().length > 0]]);

  const { submitting, submit } = useSubmit(
    async () => {
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
    },
    {
      successMessage: isEdit ? t("updated") : t("created"),
      onSuccess: () => {
        onOpenChange(false);
        onSaved();
      },
      onError: (err) => {
        toast.error(apiErrorMessage(err));
        return true;
      },
    },
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={isEdit ? t("editTitle") : t("newTitle")}
      description={t("description")}
      onSubmit={() => submit()}
      submitting={submitting}
      missing={missing}
    >
      <Field label={t("field.nombre")} htmlFor="pp-name" required>
        <Input id="pp-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>

      {/* baseConversionFactor, the key piece: highlighted. */}
      <div className="rounded-md bg-primary/5 p-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <Field label={t("field.factorABase")} htmlFor="pp-factor" hint={t("field.factorABaseHint")}>
          <Input
            id="pp-factor"
            inputMode="decimal"
            value={form.baseConversionFactor}
            onChange={(e) => set("baseConversionFactor", e.target.value)}
            placeholder="60"
            aria-describedby="pp-factor-hint"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("field.fabricante")} htmlFor="pp-manufacturer">
          <CatalogSelect
            id="pp-manufacturer"
            value={form.manufacturerId}
            onChange={(v) => set("manufacturerId", v)}
            options={fabricantes.map((c) => ({ id: c.id, nombre: c.name }))}
            placeholder={t("field.none")}
          />
        </Field>
        <Field label={t("field.marca")} htmlFor="pp-brand">
          <CatalogSelect
            id="pp-brand"
            value={form.brandId}
            onChange={(v) => set("brandId", v)}
            options={marcas.map((c) => ({ id: c.id, nombre: c.name }))}
            placeholder={t("field.none")}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("field.concentracion")} htmlFor="pp-concentration">
          <Input
            id="pp-concentration"
            inputMode="decimal"
            value={form.concentration}
            onChange={(e) => set("concentration", e.target.value)}
          />
        </Field>
        <Field label={t("field.unidadConcentracion")} htmlFor="pp-concentration-unit">
          <CatalogSelect
            id="pp-concentration-unit"
            value={form.concentrationUnitId}
            onChange={(v) => set("concentrationUnitId", v)}
            options={unidades.map((u) => ({ id: u.id, nombre: u.name }))}
            placeholder={t("field.none")}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("field.contenido")} htmlFor="pp-content">
          <Input
            id="pp-content"
            inputMode="decimal"
            value={form.contentPerPackage}
            onChange={(e) => set("contentPerPackage", e.target.value)}
          />
        </Field>
        <Field label={t("field.unidadContenido")} htmlFor="pp-content-unit">
          <CatalogSelect
            id="pp-content-unit"
            value={form.contentUnitId}
            onChange={(v) => set("contentUnitId", v)}
            options={unidades.map((u) => ({ id: u.id, nombre: u.name }))}
            placeholder={t("field.none")}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("field.sku")} htmlFor="pp-sku">
          <Input id="pp-sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
        </Field>
        <Field label={t("field.barcode")} htmlFor="pp-barcode">
          <Input id="pp-barcode" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("field.vigenciaDesde")} htmlFor="pp-valid-from">
          <DatePicker id="pp-valid-from" value={form.validFrom} onChange={(v) => set("validFrom", v)} clearable />
        </Field>
        <Field label={t("field.vigenciaHasta")} htmlFor="pp-valid-until">
          <DatePicker id="pp-valid-until" value={form.validUntil} onChange={(v) => set("validUntil", v)} clearable />
        </Field>
      </div>

      {isEdit && (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <span className="text-sm">{t("field.activo")}</span>
          <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
        </div>
      )}
    </FormSheet>
  );
}

function CatalogSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; nombre: string }[];
  placeholder: string;
}) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id} className="w-full">
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
