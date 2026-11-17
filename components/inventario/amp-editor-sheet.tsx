"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  createPresentacionProveedor,
  updatePresentacionProveedor,
  type PresentacionProveedor,
  type Proveedor,
  type Unidad,
  type Clasificacion,
  type CreatePresentacionProveedorPayload,
} from "@/lib/api/inventario";
import { apiErrorMessage } from "@/lib/api/errors";
import { Input } from "@/components/ui/input";
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

// AMP (supplier presentation) editor — §2 of the hand-off. A side sheet, not inline: more friction
// means fewer mistakes in sensitive data. Supplier + content/unit on top; concentration, brand,
// manufacturer, SKU and barcode in a collapsible advanced section.
export function AmpEditorSheet({
  open,
  productoId,
  productoNombre,
  amp,
  proveedores,
  unidades,
  marcas,
  fabricantes,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  productoId: string;
  productoNombre: string;
  amp: PresentacionProveedor | null;
  proveedores: Proveedor[];
  unidades: Unidad[];
  marcas: Clasificacion[];
  fabricantes: Clasificacion[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("inventario.amp");
  const isEdit = !!amp;

  // Re-initialised when the sheet opens or the edited AMP changes.
  const [form, update] = useDialogForm(
    () => ({
      proveedorId: amp?.supplierId ?? "",
      nombre: amp?.name ?? "",
      nombreTouched: !!amp,
      contenido: amp?.contentPerPackage != null ? String(amp.contentPerPackage) : "",
      unidadContenidoId: amp?.contentUnitId ?? "",
      concentracion: amp?.concentration != null ? String(amp.concentration) : "",
      unidadConcentracionId: amp?.concentrationUnitId ?? "",
      marcaId: amp?.brandId ?? "",
      fabricanteId: amp?.manufacturerId ?? "",
      sku: amp?.sku ?? "",
      barcode: amp?.barcode ?? "",
      advanced: false,
    }),
    open,
    amp?.id ?? `new:${productoId}`,
  );
  const {
    proveedorId,
    nombre,
    nombreTouched,
    contenido,
    unidadContenidoId,
    concentracion,
    unidadConcentracionId,
    marcaId,
    fabricanteId,
    sku,
    barcode,
    advanced,
  } = form;

  const activos = proveedores.filter((p) => p.active);
  const unidadNombre = (id: string) => unidades.find((u) => u.id === id)?.name ?? "";

  // Autogenera el nombre "{producto} — {cantidad} {unidad}" mientras no se edite a mano.
  const autoNombre =
    contenido && unidadContenidoId
      ? `${productoNombre} — ${contenido} ${unidadNombre(unidadContenidoId)}`.trim()
      : productoNombre;
  const effectiveNombre = nombreTouched ? nombre : autoNombre;

  const missing = missingFields([
    [t("field.proveedor"), !!proveedorId],
    [t("field.nombre"), effectiveNombre.trim().length > 0],
  ]);

  const { submitting, submit } = useSubmit(
    async () => {
      const num = (s: string) => (s.trim() ? Number(s) : undefined);
      const id = (s: string) => (s && s !== NONE ? s : undefined);
      const txt = (s: string) => (s.trim() ? s.trim() : undefined);
      const body = {
        supplierId: proveedorId,
        name: effectiveNombre.trim(),
        contentPerPackage: num(contenido),
        contentUnitId: id(unidadContenidoId),
        concentration: num(concentracion),
        concentrationUnitId: id(unidadConcentracionId),
        brandId: id(marcaId),
        manufacturerId: id(fabricanteId),
        sku: txt(sku),
        barcode: txt(barcode),
      };
      if (isEdit && amp) {
        await updatePresentacionProveedor(amp.id, body);
      } else {
        await createPresentacionProveedor({
          productId: productoId,
          ...body,
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
      description={productoNombre}
      onSubmit={() => submit()}
      submitting={submitting}
      missing={missing}
    >
      <Field label={t("field.proveedor")} htmlFor="amp-proveedor" required>
        <Select value={proveedorId} onValueChange={(v) => update({ proveedorId: v })}>
          <SelectTrigger id="amp-proveedor" className="w-full">
            <SelectValue placeholder={t("field.selectProveedor")} />
          </SelectTrigger>
          <SelectContent>
            {activos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("field.contenido")} htmlFor="amp-contenido">
          <Input
            id="amp-contenido"
            inputMode="decimal"
            value={contenido}
            onChange={(e) => update({ contenido: e.target.value })}
            placeholder="300"
          />
        </Field>
        <Field label={t("field.unidad")} htmlFor="amp-unidad">
          <Select
            value={unidadContenidoId || NONE}
            onValueChange={(v) => update({ unidadContenidoId: v === NONE ? "" : v })}
          >
            <SelectTrigger id="amp-unidad" className="w-full">
              <SelectValue placeholder={t("field.none")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("field.none")}</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label={t("field.nombre")} htmlFor="amp-nombre" required>
        <Input
          id="amp-nombre"
          value={effectiveNombre}
          onChange={(e) => update({ nombreTouched: true, nombre: e.target.value })}
        />
      </Field>

      <button
        type="button"
        onClick={() => update((s) => ({ ...s, advanced: !s.advanced }))}
        className="text-left text-xs font-medium text-primary hover:underline"
      >
        {advanced ? t("hideAdvanced") : t("showAdvanced")}
      </button>

      {advanced && (
        <div className="grid gap-4 rounded-md bg-card p-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.concentracion")} htmlFor="amp-concentracion">
              <Input
                id="amp-concentracion"
                inputMode="decimal"
                value={concentracion}
                onChange={(e) => update({ concentracion: e.target.value })}
              />
            </Field>
            <Field label={t("field.unidadConc")} htmlFor="amp-unidad-conc">
              <Select
                value={unidadConcentracionId || NONE}
                onValueChange={(v) => update({ unidadConcentracionId: v === NONE ? "" : v })}
              >
                <SelectTrigger id="amp-unidad-conc" className="w-full">
                  <SelectValue placeholder={t("field.none")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("field.none")}</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.marca")} htmlFor="amp-marca">
              <ClasSelect id="amp-marca" value={marcaId} onChange={(v) => update({ marcaId: v })} options={marcas} noneLabel={t("field.none")} />
            </Field>
            <Field label={t("field.fabricante")} htmlFor="amp-fabricante">
              <ClasSelect id="amp-fabricante" value={fabricanteId} onChange={(v) => update({ fabricanteId: v })} options={fabricantes} noneLabel={t("field.none")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.sku")} htmlFor="amp-sku">
              <Input id="amp-sku" value={sku} onChange={(e) => update({ sku: e.target.value })} />
            </Field>
            <Field label={t("field.barcode")} htmlFor="amp-barcode">
              <Input id="amp-barcode" value={barcode} onChange={(e) => update({ barcode: e.target.value })} />
            </Field>
          </div>
        </div>
      )}
    </FormSheet>
  );
}

function ClasSelect({
  id,
  value,
  onChange,
  options,
  noneLabel,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: Clasificacion[];
  noneLabel: string;
}) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
