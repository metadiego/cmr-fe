"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  listCompuestos,
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
import { cn } from "@/lib/utils";
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

// Recetas de compuestos (§1 roadmap): un derivado (tipo=compuesto) consume N componentes
// (base|unico) en cantidad+unidad. Editor bill-of-materials. Editar re-publica la regla
// versionada en el BE (nada extra). El GET trae IDs → resolvemos nombres con catálogos.
export function RecetasAdmin() {
  const t = useTranslations("inventario.recetas");
  const tc = useTranslations("common");

  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  const compRes = useResource<Producto[]>(() => listCompuestos(debounced), [debounced]);
  const compuestos = compRes.state.kind === "ok" ? compRes.state.data : [];

  // Mapa id→nombre de TODOS los productos (para nombrar los componentes) + unidades.
  const prodRes = useResource<Producto[]>(() => listProductos({}));
  const unidadRes = useResource<Unidad[]>(() => listUnidades());
  const prodName = React.useMemo(() => {
    const m = new Map<string, string>();
    if (prodRes.state.kind === "ok") prodRes.state.data.forEach((p) => m.set(p.id, p.nombre));
    return m;
  }, [prodRes.state]);
  const unidades = unidadRes.state.kind === "ok" ? unidadRes.state.data : [];
  const unidadName = (id: string | null) =>
    id ? (unidades.find((u) => u.id === id)?.nombre ?? "") : "";

  // (b) Deep-link desde el producto: ?compuestoId= preselecciona el compuesto. Un solo
  // editor, alcanzable standalone Y desde Productos → sin duplicar el editor de receta.
  const searchParams = useSearchParams();
  const [selId, setSelId] = React.useState<string | null>(
    () => searchParams.get("compuestoId") ?? null,
  );
  const selected = compuestos.find((p) => p.id === selId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        {/* Lista de compuestos */}
        <div className="space-y-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchCompuesto")} />
          <div className="overflow-hidden rounded-xl border">
            {compRes.state.kind === "loading" && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{tc("loading")}</p>
            )}
            {compRes.state.kind === "ok" && compuestos.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("noCompuestos")}</p>
            )}
            <ul className="max-h-[60vh] divide-y overflow-y-auto">
              {compuestos.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelId(p.id)}
                    className={cn(
                      "flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent/50",
                      selId === p.id && "bg-accent",
                    )}
                  >
                    <span className="font-medium">{p.nombre}</span>
                    {p.sku && <span className="font-mono text-[11px] text-muted-foreground">{p.sku}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Editor de receta */}
        <div>
          {!selected ? (
            <div className="rounded-xl border border-dashed px-4 py-16 text-center text-sm text-muted-foreground">
              {t("pickCompuesto")}
            </div>
          ) : (
            <RecetaEditor
              key={selected.id}
              compuesto={selected}
              prodName={prodName}
              unidades={unidades}
              unidadName={unidadName}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RecetaEditor({
  compuesto,
  prodName,
  unidades,
  unidadName,
}: {
  compuesto: Producto;
  prodName: Map<string, string>;
  unidades: Unidad[];
  unidadName: (id: string | null) => string;
}) {
  const t = useTranslations("inventario.recetas");
  const tc = useTranslations("common");
  const { state, reload } = useResource<ProductoComponente[]>(
    () => listComponentes(compuesto.id),
    [compuesto.id],
  );
  // El GET devuelve también las dadas de baja (DELETE = baja lógica, activo:false, y el
  // BE no aplica ?activo=true) → filtramos activas en el cliente.
  const items = (state.kind === "ok" ? state.data : []).filter((c) => c.activo !== false);

  // Alta de un componente nuevo.
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
        productoCompuestoId: compuesto.id,
        componenteId: nuevoId,
        cantidad: cant,
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
      <div>
        <h2 className="text-lg font-semibold">{compuesto.nombre}</h2>
        <p className="text-xs text-muted-foreground">{t("recipeOf")}</p>
      </div>

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
              <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{t("emptyRecipe")}</td></tr>
            )}
            {items.map((c) => (
              <RecetaRow
                key={c.id}
                comp={c}
                nombre={prodName.get(c.componenteId) ?? c.componenteId}
                unidades={unidades}
                unidadName={unidadName}
                onSaved={reload}
                onRemove={() => quitar(c.id)}
                disabled={busy}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Agregar componente */}
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

function RecetaRow({
  comp,
  nombre,
  unidades,
  unidadName,
  onSaved,
  onRemove,
  disabled,
}: {
  comp: ProductoComponente;
  nombre: string;
  unidades: Unidad[];
  unidadName: (id: string | null) => string;
  onSaved: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const t = useTranslations("inventario.recetas");
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
