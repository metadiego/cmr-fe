"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  listProductos,
  listUnidades,
  listComponentes,
  createComponente,
  updateComponente,
  deleteComponente,
  type Producto,
  type Unidad,
  type ProductoComponente,
} from "@/lib/api/inventario";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductoPicker } from "@/components/inventario/producto-picker";

const NONE = "__none__";

// Editor de componentes reusable (bill-of-materials). Autocontenido: trae unidades + nombres de
// producto por su cuenta, así lo usan tanto la receta de kit (estimado=false, descarga real) como
// los INSUMOS estimados de consumo de cualquier producto (estimado=true, no bloqueante, solo reporte).
// El GET lista TODOS los componentes del producto → filtramos por `estimado` para no mezclar receta e insumos.
export function ComponentesEditor({ productoId, estimado }: { productoId: string; estimado: boolean }) {
  // Namespace i18n según el modo (mismas claves en ambos).
  const t = useTranslations(estimado ? "inventario.insumos" : "inventario.recetas");
  const tc = useTranslations("common");

  const { state, reload } = useResource<ProductoComponente[]>(
    () => listComponentes(productoId),
    [productoId],
  );
  const unidadRes = useResource<Unidad[]>(() => listUnidades());
  const prodRes = useResource<Producto[]>(() => listProductos({}));
  const unidades = unidadRes.state.kind === "ok" ? unidadRes.state.data : [];
  const prodName = React.useMemo(() => {
    const m = new Map<string, string>();
    if (prodRes.state.kind === "ok") prodRes.state.data.forEach((p) => m.set(p.id, p.nombre));
    return m;
  }, [prodRes.state]);
  const unidadName = (id: string | null) => (id ? (unidades.find((u) => u.id === id)?.nombre ?? "") : "");

  // Activas y del modo pedido (DELETE = baja lógica; el BE no filtra ?activo).
  const items = (state.kind === "ok" ? state.data : [])
    .filter((c) => c.activo !== false)
    .filter((c) => !!c.estimado === estimado);

  const [nuevoId, setNuevoId] = React.useState("");
  const [nuevaCant, setNuevaCant] = React.useState("");
  const [nuevaUnidad, setNuevaUnidad] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function agregar() {
    const cant = Number(nuevaCant);
    if (!nuevoId || !nuevaCant.trim() || Number.isNaN(cant) || cant <= 0) {
      toast.error(t("invalidComponente"));
      return;
    }
    setBusy(true);
    try {
      await createComponente({
        productoCompuestoId: productoId,
        componenteId: nuevoId,
        cantidad: cant,
        estimado,
        ...(nuevaUnidad && nuevaUnidad !== NONE ? { unidadId: nuevaUnidad } : {}),
      });
      toast.success(t("added"));
      setNuevoId("");
      setNuevaCant("");
      setNuevaUnidad("");
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function quitar(id: string) {
    setBusy(true);
    try {
      await deleteComponente(id);
      toast.success(t("removed"));
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{t("col.componente")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.cantidad")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.unidad")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {state.kind === "loading" && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{tc("loading")}</td></tr>
            )}
            {state.kind === "ok" && items.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{t("empty")}</td></tr>
            )}
            {items.map((c) => (
              <ComponenteRow
                key={c.id}
                comp={c}
                nombre={prodName.get(c.componenteId) ?? c.componenteId}
                unidades={unidades}
                unidadName={unidadName}
                onSaved={reload}
                onRemove={() => quitar(c.id)}
                disabled={busy}
                labelNs={estimado ? "inventario.insumos" : "inventario.recetas"}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Agregar componente/insumo */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("addComponente")}</span>
          <ProductoPicker value={nuevoId} onChange={(id) => setNuevoId(id)} placeholder={t("selectComponente")} />
        </label>
        <label className="flex w-28 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("col.cantidad")}</span>
          <Input inputMode="decimal" value={nuevaCant} onChange={(e) => setNuevaCant(e.target.value)} placeholder="0" />
        </label>
        <label className="flex w-40 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("col.unidad")}</span>
          <Select value={nuevaUnidad || NONE} onValueChange={(v) => setNuevaUnidad(v === NONE ? "" : v)}>
            <SelectTrigger className="w-full"><SelectValue placeholder={t("unidadDefault")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("unidadDefault")}</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <Button onClick={agregar} disabled={busy || !nuevoId}>
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          {t("add")}
        </Button>
      </div>
    </div>
  );
}

function ComponenteRow({
  comp,
  nombre,
  unidades,
  unidadName,
  onSaved,
  onRemove,
  disabled,
  labelNs,
}: {
  comp: ProductoComponente;
  nombre: string;
  unidades: Unidad[];
  unidadName: (id: string | null) => string;
  onSaved: () => void;
  onRemove: () => void;
  disabled: boolean;
  labelNs: string;
}) {
  const t = useTranslations(labelNs);
  const tc = useTranslations("common");
  const [editing, setEditing] = React.useState(false);
  const [cant, setCant] = React.useState(String(comp.cantidad));
  const [unidad, setUnidad] = React.useState(comp.unidadId ?? NONE);
  const [saving, setSaving] = React.useState(false);

  async function save() {
    const v = Number(cant);
    if (Number.isNaN(v) || v <= 0) {
      toast.error(t("invalidComponente"));
      return;
    }
    setSaving(true);
    try {
      await updateComponente(comp.id, {
        cantidad: v,
        ...(unidad && unidad !== NONE ? { unidadId: unidad } : {}),
      });
      toast.success(t("updated"));
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-2 font-medium">{nombre}</td>
      <td className="px-3 py-2 tabular-nums">
        {editing ? (
          <Input inputMode="decimal" value={cant} onChange={(e) => setCant(e.target.value)} className="h-7 w-24" />
        ) : (
          comp.cantidad
        )}
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {editing ? (
          <Select value={unidad} onValueChange={setUnidad}>
            <SelectTrigger className="h-7 w-36"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          unidadName(comp.unidadId) || "—"
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          {editing ? (
            <>
              <Button size="sm" variant="ghost" disabled={saving} onClick={save}>{tc("save")}</Button>
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>{tc("cancel")}</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>{tc("edit")}</Button>
              <Button size="icon" variant="ghost" disabled={disabled} className="text-destructive hover:text-destructive" onClick={onRemove}>
                <HugeiconsIcon icon={Delete02Icon} className="size-4" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
