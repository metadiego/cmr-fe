"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { personalizarKit, type FacturaItem } from "@/lib/api/facturas";
import { getProducto, listComponentes, listProductos, type ProductoComponente, type Producto as ProductoInv } from "@/lib/api/inventario";
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
  // Names of the components the first page of products does not carry (the list stops at 100).
  const [extraNames, setExtraNames] = React.useState<Record<string, string>>({});
  const prodName = React.useMemo(() => {
    const m = new Map<string, string>(Object.entries(extraNames));
    if (prodRes.state.kind === "ok") prodRes.state.data.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [prodRes.state, extraNames]);

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

  const missingIds = React.useMemo(
    () => (prodRes.state.kind === "ok" ? base.map((r) => r.productoId).filter((id) => !prodName.has(id)) : []),
    [base, prodName, prodRes.state.kind],
  );
  React.useEffect(() => {
    if (missingIds.length === 0) return;
    let alive = true;
    Promise.all(missingIds.map((id) => getProducto(id).then((p) => [id, p.name] as const).catch(() => [id, ""] as const))).then((pairs) => {
      if (alive) setExtraNames((m) => ({ ...m, ...Object.fromEntries(pairs.filter(([, n]) => n)) }));
    });
    return () => {
      alive = false;
    };
  }, [missingIds]);

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

  // The product about to be added: if its group bills by áreas × días, the add row asks for those (with
  // their labels) instead of a bare, unlabelled quantity.
  const nuevoColsRes = useResource<ColumnaFacturacion[]>(
    () => (nuevoId ? listColumnasFacturacion(nuevoId, centro) : Promise.resolve([])),
    [nuevoId, centro],
  );
  const nuevoCols = nuevoColsRes.state.kind === "ok" ? nuevoColsRes.state.data.filter((c) => c.role === "multiplicador") : [];
  const [nuevoMult, setNuevoMult] = React.useState<Record<string, string>>({});
  const nuevoMultVals = Object.fromEntries(nuevoCols.map((c) => [c.slug, nuevoMult[c.slug] ?? "1"]));
  const nuevoMultCant = nuevoCols.reduce((p, c) => p * Math.max(1, Math.floor(Number(nuevoMultVals[c.slug]) || 1)), 1);

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
    const c = nuevoCols.length > 0 ? nuevoMultCant : Math.max(1, Math.floor(Number(nuevaCant) || 0));
    if (!nuevoId || c <= 0) return;
    if (nuevoCols.length > 0) setMult((m) => ({ ...m, [nuevoId]: nuevoMultVals }));
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
    setNuevoMult({});
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

  const quitarBtn = (onClick: () => void) => (
    <Button type="button" variant="ghost" size="icon" onClick={onClick} aria-label={t("kit.quitar")} className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
      ×
    </Button>
  );
  const qtyInput = (value: string, onChange: (v: string) => void) => (
    <label className="flex flex-col items-end gap-0.5">
      <span className="text-[11px] text-muted-foreground">{t("kit.cantidad")}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="numeric" className="h-9 w-20 text-right tabular-nums" aria-label={t("kit.cantidad")} />
    </label>
  );
  // One grid for every row: name (wraps, never cut) | controls | remove. Same columns for base, added
  // and the add row, so nothing slides out of the dialog (7-nov-2026: inputs and «Reponer» were cut off).
  const ROW = "grid grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-3 rounded-lg border px-3 py-2";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
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

            <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {base.map((r) => {
                const quitado = !!removed[r.productoId];
                const cols = multColsDe(r.productoId);
                return (
                  <li key={r.productoId} className={ROW + (quitado ? " bg-muted/40" : "")}>
                    <span className={"text-sm font-medium break-words " + (quitado ? "text-muted-foreground line-through" : "")}>{r.nombre}</span>
                    {quitado ? (
                      <Button variant="outline" size="sm" onClick={() => setRemoved((m) => ({ ...m, [r.productoId]: false }))}>{t("kit.reponer")}</Button>
                    ) : cols.length > 0 ? (
                      <MultiplicadoresKit
                        cols={cols}
                        valores={multValoresDe(r, cols)}
                        onChange={(slug, val) => setMult((m) => ({ ...m, [r.productoId]: { ...multValoresDe(r, cols), [slug]: val } }))}
                        cantidad={cantDe(r)}
                      />
                    ) : (
                      qtyInput(qty[r.productoId] ?? String(r.cantidad), (v) => setQty((m) => ({ ...m, [r.productoId]: v })))
                    )}
                    {quitado ? <span /> : quitarBtn(() => setRemoved((m) => ({ ...m, [r.productoId]: true })))}
                  </li>
                );
              })}
              {added.map((r) => {
                const cols = multColsDe(r.productoId);
                return (
                  <li key={r.productoId} className={ROW + " border-primary/40 bg-primary/5"}>
                    <span className="text-sm font-medium break-words">
                      {r.nombre}
                      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">{t("kit.agregado")}</span>
                    </span>
                    {cols.length > 0 ? (
                      <MultiplicadoresKit
                        cols={cols}
                        valores={multValoresDe(r, cols)}
                        onChange={(slug, val) => setMult((m) => ({ ...m, [r.productoId]: { ...multValoresDe(r, cols), [slug]: val } }))}
                        cantidad={cantDe(r)}
                      />
                    ) : (
                      <span className="text-sm tabular-nums">×{r.cantidad}</span>
                    )}
                    {quitarBtn(() => setAdded((a) => a.filter((x) => x.productoId !== r.productoId)))}
                  </li>
                );
              })}
            </ul>

            {/* Add a component (fine-grained permission; the BE enforces it). A product billed by áreas × días
                asks for them right here, labelled — not an unlabelled number that only made sense after adding. */}
            {puedeAgregar && (
              <div className="space-y-2 rounded-lg border border-dashed p-3">
                <Lbl>{t("kit.agregarComponente")}</Lbl>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-3">
                  <ProductoPicker
                    value={nuevoId}
                    soloFisicos={false}
                    onChange={(id, p) => { setNuevoId(id); setNuevoNombre(p?.name ?? ""); setNuevoMult({}); }}
                    placeholder={t("kit.buscarProducto")}
                  />
                  {nuevoCols.length > 0 ? (
                    <MultiplicadoresKit
                      cols={nuevoCols}
                      valores={nuevoMultVals}
                      onChange={(slug, val) => setNuevoMult((m) => ({ ...m, [slug]: val }))}
                      cantidad={nuevoMultCant}
                    />
                  ) : (
                    qtyInput(nuevaCant, setNuevaCant)
                  )}
                  <Button size="sm" className="h-9" onClick={agregar} disabled={!nuevoId}>{tc("add")}</Button>
                </div>
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

// One labelled input per multiplier column (Áreas, Días) + the resulting quantity, locked = their product.
// Labels data-driven (fac.col.<slug>), same as the receipt.
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
  const t = useTranslations("facturacion");
  const tRoot = useTranslations();
  const name = (slug: string) => (tRoot.has(`fac.col.${slug}`) ? tRoot(`fac.col.${slug}`) : slug);
  return (
    <div className="flex items-end gap-2">
      {cols.map((c, i) => (
        <React.Fragment key={c.slug}>
          {i > 0 && <span className="pb-2 text-sm text-muted-foreground">×</span>}
          <label className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] text-muted-foreground">{name(c.slug)}</span>
            <Input value={valores[c.slug] ?? ""} onChange={(e) => onChange(c.slug, e.target.value)} inputMode="numeric" className="h-9 w-16 text-center tabular-nums" aria-label={name(c.slug)} />
          </label>
        </React.Fragment>
      ))}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[11px] text-muted-foreground">{t("kit.terapias")}</span>
        <span className="flex h-9 min-w-12 items-center justify-center rounded-md bg-muted px-2 text-sm font-semibold tabular-nums">{cantidad}</span>
      </div>
    </div>
  );
}
