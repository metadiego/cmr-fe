"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { personalizarKit, type FacturaItem } from "@/lib/api/facturas";
import { listComponentes, listProductos, type ProductoComponente, type Producto as ProductoInv } from "@/lib/api/inventario";
import { listColumnasFacturacion, type ColumnaFacturacion } from "@/lib/api/facturacion-config";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { toastError } from "@/lib/api/errors";
import { ProductoPicker } from "@/components/inventario/producto-picker";
import { Lbl } from "@/components/facturacion/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogRowsSkeleton } from "@/components/facturacion/invoice-detail-skeleton";

// Personalizar el KIT de una línea: quitar / cambiar cantidad / AGREGAR componentes, SOLO en esta factura
// (no toca la receta general). Lo que quede es lo que el paciente recibe en el frontdesk (menos sesiones =
// menos disponibilidad). Overlay sin setState-en-effect: partimos de la receta (o de la personalización ya
// guardada) y guardamos removidos/cantidades/agregados encima; al guardar mandamos la LISTA FINAL completa.
// Extraído de app/(app)/billing/invoices/[id]/page.tsx (techo de tamaño, DEBT en eslint.config.mjs).
type KitRow = { productoId: string; cantidad: number; nombre: string; isAdded?: boolean; multiplicadores?: Record<string, number> };

export function PersonalizarKitDialog({
  open,
  onOpenChange,
  facturaId,
  item,
  centro,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  facturaId: string;
  item: FacturaItem;
  centro?: string;
  onSaved: () => void;
}) {
  const t = useTranslations("facturacion");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can } = useCan();
  const puedeAgregar = can("factura.kit_agregar");

  // Receta base del compuesto (BOM) + nombres de producto. Autocontenido, como ComponentesEditor.
  const recetaRes = useResource<ProductoComponente[]>(() => listComponentes(String(item.productId)), [item.productId]);
  const prodRes = useResource<ProductoInv[]>(() => listProductos({}), []);
  const prodName = React.useMemo(() => {
    const m = new Map<string, string>();
    if (prodRes.state.kind === "ok") prodRes.state.data.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [prodRes.state]);

  // Base = personalización ya guardada (si la hay) o la receta real (activa, no estimada). Los insumos
  // ESTIMADOS no se descargan ni entran a frontdesk → fuera de aquí.
  const perso = (
    item.customization as { componentes?: { productId: string; quantity: number; multipliers?: Record<string, number> }[] } | null
  )?.componentes;
  const base: KitRow[] = React.useMemo(() => {
    if (Array.isArray(perso)) {
      return perso.map((c) => ({
        productoId: c.productId,
        cantidad: Number(c.quantity) || 0,
        nombre: prodName.get(c.productId) ?? c.productId,
        ...(c.multipliers && Object.keys(c.multipliers).length ? { multiplicadores: c.multipliers } : {}),
      }));
    }
    const receta = recetaRes.state.kind === "ok" ? recetaRes.state.data : [];
    return receta
      .filter((c) => c.active !== false && !c.estimated)
      .map((c) => ({ productoId: c.componentId, cantidad: Number(c.quantity) || 0, nombre: prodName.get(c.componentId) ?? c.componentId }));
  }, [perso, recetaRes.state, prodName]);

  const [removed, setRemoved] = React.useState<Record<string, boolean>>({});
  const [qty, setQty] = React.useState<Record<string, string>>({});
  const [added, setAdded] = React.useState<KitRow[]>([]);
  // Valores tecleados de áreas/días por componente (solo para los que tienen columnas multiplicador).
  const [mult, setMult] = React.useState<Record<string, Record<string, string>>>({});
  const [nuevoId, setNuevoId] = React.useState("");
  const [nuevoNombre, setNuevoNombre] = React.useState("");
  const [nuevaCant, setNuevaCant] = React.useState("1");
  const [saving, setSaving] = React.useState(false);

  // Columnas de FACTURACIÓN por componente (role "multiplicador" = áreas/días, igual que la línea
  // suelta de láser): un componente cuyo grupo las tiene muestra un input por columna, con la
  // CANTIDAD BLOQUEADA = producto de los valores (handoff areas-y-dias-en-el-kit).
  const idsComponentes = React.useMemo(
    () => Array.from(new Set([...base, ...added].map((r) => r.productoId))),
    [base, added],
  );
  const columnasRes = useResource<Record<string, ColumnaFacturacion[]>>(async () => {
    const entries = await Promise.all(
      idsComponentes.map(async (id) => [id, await listColumnasFacturacion(id, centro)] as const),
    );
    return Object.fromEntries(entries);
  }, [idsComponentes, centro]);
  const multColsDe = React.useCallback(
    (id: string): ColumnaFacturacion[] =>
      columnasRes.state.kind === "ok" ? (columnasRes.state.data[id] ?? []).filter((c) => c.role === "multiplicador") : [],
    [columnasRes.state],
  );

  const cargando = recetaRes.state.kind === "loading" || prodRes.state.kind === "loading";
  // Valores efectivos de las columnas multiplicador de un componente: lo tecleado, o el default —
  // "un área por kit" (la columna que CUENTA SESIONES arranca en la cantidad actual, el resto en 1).
  const multValoresDe = React.useCallback(
    (r: KitRow, cols: ColumnaFacturacion[]): Record<string, string> => {
      const guardado = mult[r.productoId];
      if (guardado) return guardado;
      if (r.multiplicadores) return Object.fromEntries(cols.map((c) => [c.slug, String(r.multiplicadores![c.slug] ?? 1)]));
      return Object.fromEntries(cols.map((c) => [c.slug, c.countsSessions ? String(Math.max(1, r.cantidad || 1)) : "1"]));
    },
    [mult],
  );
  const cantDe = (r: KitRow) => {
    const cols = multColsDe(r.productoId);
    if (cols.length > 0) {
      const vals = multValoresDe(r, cols);
      return cols.reduce((p, c) => p * Math.max(1, Math.floor(Number(vals[c.slug]) || 1)), 1);
    }
    return qty[r.productoId] !== undefined ? Math.max(0, Number(qty[r.productoId]) || 0) : r.cantidad;
  };
  const multiplicadoresDe = (r: KitRow): Record<string, number> | undefined => {
    const cols = multColsDe(r.productoId);
    if (cols.length === 0) return undefined;
    const vals = multValoresDe(r, cols);
    return Object.fromEntries(cols.map((c) => [c.slug, Math.max(1, Math.floor(Number(vals[c.slug]) || 1))]));
  };
  // Lista final que se manda: base viva (no removida) + agregados, con la cantidad efectiva.
  const finalRows: KitRow[] = [
    ...base.filter((r) => !removed[r.productoId]).map((r) => ({ ...r, cantidad: cantDe(r), multiplicadores: multiplicadoresDe(r) })),
    ...added.map((r) => ({ ...r, cantidad: cantDe(r), multiplicadores: multiplicadoresDe(r) })),
  ].filter((r) => r.cantidad > 0);

  function agregar() {
    const c = Math.max(1, Math.floor(Number(nuevaCant) || 0));
    if (!nuevoId || c <= 0) return;
    // Si ya está en base y estaba removido, reponerlo en vez de duplicar.
    if (base.some((b) => b.productoId === nuevoId)) {
      setRemoved((m) => ({ ...m, [nuevoId]: false }));
      setQty((m) => ({ ...m, [nuevoId]: String(c) }));
    } else {
      setAdded((a) => (a.some((x) => x.productoId === nuevoId) ? a : [...a, { productoId: nuevoId, cantidad: c, nombre: nuevoNombre || nuevoId, isAdded: true }]));
    }
    setNuevoId("");
    setNuevoNombre("");
    setNuevaCant("1");
  }

  async function guardar() {
    setSaving(true);
    try {
      await personalizarKit(
        facturaId,
        item.id,
        finalRows.map((r) => ({
          productId: r.productoId,
          quantity: r.cantidad,
          ...(r.multiplicadores ? { multipliers: r.multiplicadores } : {}),
        })),
        centro,
      );
      onSaved();
    } catch (err) {
      toastError(err, tRoot);
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("kit.titulo", { nombre: item.description ?? "" })}</DialogTitle>
        </DialogHeader>

        {cargando ? (
          <DialogRowsSkeleton trailing="w-16" />
        ) : (
          <div className="space-y-3">
            {base.length === 0 && added.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("kit.vacio")}</p>
            )}

            <ul className="space-y-2">
              {base.map((r) => {
                const quitado = !!removed[r.productoId];
                const cols = multColsDe(r.productoId);
                return (
                  <li key={r.productoId} className={"flex items-center justify-between gap-3 rounded-lg border px-3 py-2 " + (quitado ? "opacity-50" : "")}>
                    <span className={"min-w-0 flex-1 truncate text-sm font-medium " + (quitado ? "line-through" : "")}>{r.nombre}</span>
                    {quitado ? (
                      <Button variant="ghost" size="sm" onClick={() => setRemoved((m) => ({ ...m, [r.productoId]: false }))}>{t("kit.reponer")}</Button>
                    ) : cols.length > 0 ? (
                      <>
                        <MultiplicadoresKit
                          cols={cols}
                          valores={multValoresDe(r, cols)}
                          onChange={(slug, val) => setMult((m) => ({ ...m, [r.productoId]: { ...multValoresDe(r, cols), [slug]: val } }))}
                          cantidad={cantDe(r)}
                        />
                        <button type="button" onClick={() => setRemoved((m) => ({ ...m, [r.productoId]: true }))} aria-label={t("kit.quitar")} className="text-destructive hover:opacity-70">×</button>
                      </>
                    ) : (
                      <>
                        <Input
                          value={qty[r.productoId] ?? String(r.cantidad)}
                          onChange={(e) => setQty((m) => ({ ...m, [r.productoId]: e.target.value }))}
                          inputMode="numeric"
                          className="h-8 w-16 text-right tabular-nums"
                          aria-label={t("kit.cantidad")}
                        />
                        <button type="button" onClick={() => setRemoved((m) => ({ ...m, [r.productoId]: true }))} aria-label={t("kit.quitar")} className="text-destructive hover:opacity-70">×</button>
                      </>
                    )}
                  </li>
                );
              })}
              {added.map((r) => {
                const cols = multColsDe(r.productoId);
                return (
                  <li key={r.productoId} className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.nombre}<span className="ml-2 text-[11px] text-primary">{t("kit.agregado")}</span></span>
                    {cols.length > 0 ? (
                      <MultiplicadoresKit
                        cols={cols}
                        valores={multValoresDe(r, cols)}
                        onChange={(slug, val) => setMult((m) => ({ ...m, [r.productoId]: { ...multValoresDe(r, cols), [slug]: val } }))}
                        cantidad={cantDe(r)}
                      />
                    ) : (
                      <span className="tabular-nums text-sm">×{r.cantidad}</span>
                    )}
                    <button type="button" onClick={() => setAdded((a) => a.filter((x) => x.productoId !== r.productoId))} aria-label={t("kit.quitar")} className="text-destructive hover:opacity-70">×</button>
                  </li>
                );
              })}
            </ul>

            {/* Agregar componente: solo con permiso fino (el BE lo exige; no mostramos la puerta si no se abre). */}
            {puedeAgregar && (
              <div className="flex items-end gap-2 rounded-md border border-dashed p-3">
                <div className="min-w-0 flex-1">
                  <Lbl>{t("kit.agregarComponente")}</Lbl>
                  <ProductoPicker
                    value={nuevoId}
                    soloFisicos={false}
                    onChange={(id, p) => { setNuevoId(id); setNuevoNombre(p?.name ?? ""); }}
                    placeholder={t("kit.buscarProducto")}
                  />
                </div>
                <Input value={nuevaCant} onChange={(e) => setNuevaCant(e.target.value)} inputMode="numeric" className="h-9 w-16 text-right tabular-nums" aria-label={t("kit.cantidad")} />
                <Button size="sm" onClick={agregar} disabled={!nuevoId}>{tc("add")}</Button>
              </div>
            )}

            {/* Qué implica: la duda de todos la primera vez. */}
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{t("kit.avisoFrontdesk")}</p>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>{tc("cancel")}</Button>
              <Button size="sm" onClick={guardar} disabled={saving}>{tc("save")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Un input por columna multiplicador (áreas/días) de un componente del kit + la cantidad resultante,
// bloqueada = producto de los valores. Labels data-driven (fac.col.<slug>), igual que el recibo.
function MultiplicadoresKit({
  cols,
  valores,
  onChange,
  cantidad,
}: {
  cols: ColumnaFacturacion[];
  valores: Record<string, string>;
  onChange: (slug: string, valor: string) => void;
  cantidad: number;
}) {
  const tRoot = useTranslations();
  return (
    <div className="flex items-center gap-2">
      {cols.map((c) => (
        <label key={c.slug} className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] text-muted-foreground">{tRoot.has(`fac.col.${c.slug}`) ? tRoot(`fac.col.${c.slug}`) : c.slug}</span>
          <Input
            value={valores[c.slug] ?? ""}
            onChange={(e) => onChange(c.slug, e.target.value)}
            inputMode="numeric"
            className="h-8 w-14 text-right tabular-nums"
            aria-label={tRoot.has(`fac.col.${c.slug}`) ? tRoot(`fac.col.${c.slug}`) : c.slug}
          />
        </label>
      ))}
      <span className="shrink-0 tabular-nums text-sm text-muted-foreground">= ×{cantidad}</span>
    </div>
  );
}
