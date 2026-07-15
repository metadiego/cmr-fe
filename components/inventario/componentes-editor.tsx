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
  // Opcionales de kit solo aplican a la receta real (no a insumos estimados).
  const allowOpcional = !estimado;

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
  const [nuevoOpcional, setNuevoOpcional] = React.useState(false);
  const [nuevoPrecioIncr, setNuevoPrecioIncr] = React.useState("");
  const [nuevoIncluido, setNuevoIncluido] = React.useState(false);
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
        ...(allowOpcional && nuevoOpcional
          ? { opcional: true, precioIncremental: Number(nuevoPrecioIncr) || 0, incluidoPorDefecto: nuevoIncluido }
          : {}),
      });
      toast.success(t("added"));
      setNuevoId("");
      setNuevaCant("");
      setNuevaUnidad("");
      setNuevoOpcional(false);
      setNuevoPrecioIncr("");
      setNuevoIncluido(false);
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
              {allowOpcional && <th className="px-3 py-2 font-semibold">{t("col.opcional")}</th>}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {state.kind === "loading" && (
              <tr><td colSpan={allowOpcional ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground">{tc("loading")}</td></tr>
            )}
            {state.kind === "ok" && items.length === 0 && (
              <tr><td colSpan={allowOpcional ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground">{t("empty")}</td></tr>
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
                allowOpcional={allowOpcional}
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
        {allowOpcional && (
          <div className="flex w-full flex-wrap items-end gap-3 rounded-lg border border-dashed p-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={nuevoOpcional} onChange={(e) => setNuevoOpcional(e.target.checked)} />
              {t("opcional")}
            </label>
            {nuevoOpcional && (
              <>
                <label className="flex w-32 flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{t("precioIncremental")}</span>
                  <Input inputMode="decimal" value={nuevoPrecioIncr} onChange={(e) => setNuevoPrecioIncr(e.target.value)} placeholder="0.00" />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={nuevoIncluido} onChange={(e) => setNuevoIncluido(e.target.checked)} />
                  {t("incluidoPorDefecto")}
                </label>
              </>
            )}
          </div>
        )}
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
  allowOpcional,
  labelNs,
}: {
  comp: ProductoComponente;
  nombre: string;
  unidades: Unidad[];
  unidadName: (id: string | null) => string;
  onSaved: () => void;
  onRemove: () => void;
  disabled: boolean;
  allowOpcional: boolean;
  labelNs: string;
}) {
  const t = useTranslations(labelNs);
  const tc = useTranslations("common");
  const [editing, setEditing] = React.useState(false);
  const [cant, setCant] = React.useState(String(comp.cantidad));
  const [unidad, setUnidad] = React.useState(comp.unidadId ?? NONE);
  const [opcional, setOpcional] = React.useState(!!comp.opcional);
  const [precioIncr, setPrecioIncr] = React.useState(String(comp.precioIncremental ?? ""));
  const [incluido, setIncluido] = React.useState(!!comp.incluidoPorDefecto);
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
        ...(allowOpcional
          ? { opcional, precioIncremental: opcional ? Number(precioIncr) || 0 : 0, incluidoPorDefecto: opcional ? incluido : false }
          : {}),
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

  const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;

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
      {allowOpcional && (
        <td className="px-3 py-2 text-xs">
          {editing ? (
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={opcional} onChange={(e) => setOpcional(e.target.checked)} />
                {t("opcional")}
              </label>
              {opcional && (
                <>
                  <Input inputMode="decimal" value={precioIncr} onChange={(e) => setPrecioIncr(e.target.value)} className="h-7 w-24" placeholder={t("precioIncremental")} />
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={incluido} onChange={(e) => setIncluido(e.target.checked)} />
                    {t("incluidoPorDefecto")}
                  </label>
                </>
              )}
            </div>
          ) : comp.opcional ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400">
              {t("opcional")} +{money(comp.precioIncremental)}{comp.incluidoPorDefecto ? ` · ${t("porDefecto")}` : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}
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
