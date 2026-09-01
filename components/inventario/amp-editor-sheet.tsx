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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Editor de AMP (presentación de proveedor) — §2 del hand-off. Side-sheet (no inline):
// más fricción = menos errores en datos sensibles. Proveedor + Cantidad/Unidad arriba;
// concentración/marca/fabricante/sku/barcode en avanzado colapsable.
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
  const tc = useTranslations("common");
  const isEdit = !!amp;

  const [proveedorId, setProveedorId] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [nombreTouched, setNombreTouched] = React.useState(false);
  const [contenido, setContenido] = React.useState("");
  const [unidadContenidoId, setUnidadContenidoId] = React.useState("");
  const [concentracion, setConcentracion] = React.useState("");
  const [unidadConcentracionId, setUnidadConcentracionId] = React.useState("");
  const [marcaId, setMarcaId] = React.useState("");
  const [fabricanteId, setFabricanteId] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [barcode, setBarcode] = React.useState("");
  const [advanced, setAdvanced] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Rehidrata el form cuando cambia el AMP editado (o al abrir para crear).
  const [prevKey, setPrevKey] = React.useState<string | null>(null);
  const key = open ? (amp?.id ?? `new:${productoId}`) : null;
  if (key !== prevKey) {
    setPrevKey(key);
    setProveedorId(amp?.proveedorId ?? "");
    setNombre(amp?.nombre ?? "");
    setNombreTouched(!!amp);
    setContenido(amp?.contenidoPorEmpaque != null ? String(amp.contenidoPorEmpaque) : "");
    setUnidadContenidoId(amp?.unidadContenidoId ?? "");
    setConcentracion(amp?.concentracion != null ? String(amp.concentracion) : "");
    setUnidadConcentracionId(amp?.unidadConcentracionId ?? "");
    setMarcaId(amp?.marcaId ?? "");
    setFabricanteId(amp?.fabricanteId ?? "");
    setSku(amp?.sku ?? "");
    setBarcode(amp?.barcode ?? "");
    setAdvanced(false);
  }

  const activos = proveedores.filter((p) => p.activo);
  const unidadNombre = (id: string) => unidades.find((u) => u.id === id)?.nombre ?? "";

  // Autogenera el nombre "{producto} — {cantidad} {unidad}" mientras no se edite a mano.
  const autoNombre =
    contenido && unidadContenidoId
      ? `${productoNombre} — ${contenido} ${unidadNombre(unidadContenidoId)}`.trim()
      : productoNombre;
  const effectiveNombre = nombreTouched ? nombre : autoNombre;

  const canSubmit = !!proveedorId && effectiveNombre.trim().length > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const num = (s: string) => (s.trim() ? Number(s) : undefined);
      const id = (s: string) => (s && s !== NONE ? s : undefined);
      const txt = (s: string) => (s.trim() ? s.trim() : undefined);
      const body = {
        proveedorId,
        nombre: effectiveNombre.trim(),
        contenidoPorEmpaque: num(contenido),
        unidadContenidoId: id(unidadContenidoId),
        concentracion: num(concentracion),
        unidadConcentracionId: id(unidadConcentracionId),
        marcaId: id(marcaId),
        fabricanteId: id(fabricanteId),
        sku: txt(sku),
        barcode: txt(barcode),
      };
      if (isEdit && amp) {
        await updatePresentacionProveedor(amp.id, body);
      } else {
        await createPresentacionProveedor({
          productoId,
          ...body,
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
          <SheetDescription>{productoNombre}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4">
          <Field label={t("field.proveedor")} required>
            <Select value={proveedorId} onValueChange={setProveedorId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("field.selectProveedor")} />
              </SelectTrigger>
              <SelectContent>
                {activos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.contenido")}>
              <Input
                inputMode="decimal"
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                placeholder="300"
              />
            </Field>
            <Field label={t("field.unidad")}>
              <Select
                value={unidadContenidoId || NONE}
                onValueChange={(v) => setUnidadContenidoId(v === NONE ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("field.none")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("field.none")}</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label={t("field.nombre")}>
            <Input
              value={effectiveNombre}
              onChange={(e) => {
                setNombreTouched(true);
                setNombre(e.target.value);
              }}
            />
          </Field>

          <button
            type="button"
            onClick={() => setAdvanced((a) => !a)}
            className="text-left text-xs font-medium text-primary hover:underline"
          >
            {advanced ? t("hideAdvanced") : t("showAdvanced")}
          </button>

          {advanced && (
            <div className="grid gap-4 rounded-md bg-card p-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("field.concentracion")}>
                  <Input
                    inputMode="decimal"
                    value={concentracion}
                    onChange={(e) => setConcentracion(e.target.value)}
                  />
                </Field>
                <Field label={t("field.unidadConc")}>
                  <Select
                    value={unidadConcentracionId || NONE}
                    onValueChange={(v) => setUnidadConcentracionId(v === NONE ? "" : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("field.none")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t("field.none")}</SelectItem>
                      {unidades.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("field.marca")}>
                  <ClasSelect value={marcaId} onChange={setMarcaId} options={marcas} noneLabel={t("field.none")} />
                </Field>
                <Field label={t("field.fabricante")}>
                  <ClasSelect value={fabricanteId} onChange={setFabricanteId} options={fabricantes} noneLabel={t("field.none")} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("field.sku")}>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} />
                </Field>
                <Field label={t("field.barcode")}>
                  <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
                </Field>
              </div>
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
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

function ClasSelect({
  value,
  onChange,
  options,
  noneLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Clasificacion[];
  noneLabel: string;
}) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
