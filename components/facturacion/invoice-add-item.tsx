"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { type Producto } from "@/lib/api/facturas";
import { listCatalogoPrecios } from "@/lib/api/precios";
import { listColumnasFacturacion, type ColumnaFacturacion } from "@/lib/api/facturacion-config";
import { useResource } from "@/hooks/use-resource";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductOptionsSkeleton } from "@/components/facturacion/invoice-detail-skeleton";
import { Lbl } from "@/components/facturacion/field-label";

// Extracted from app/(app)/billing/invoices/[id]/page.tsx (its line ceiling only goes down).

// Combobox de línea CON BÚSQUEDA server-side (SKU y nombre) — antes era un Select que solo ofrecía 100
// artículos y no buscaba, dejando fuera lo que no cayera en esos 100 (imposible de facturar en pantalla).
// Vacío = «lo más usado» (la carga inicial); al teclear (250 ms) busca en /precios/catalogo. Autocontenido
// (sin cmdk/popover), como ProductoPicker. Handoff selector-de-linea-sin-buscador.
function CatalogoCombobox({
  catalogoInicial, selected, tipoPrecioId, tenant, disabled, onPick,
}: {
  catalogoInicial: Producto[];
  selected: Producto | null;
  tipoPrecioId?: string | null;
  tenant?: string | null;
  disabled?: boolean;
  onPick: (p: Producto) => void;
}) {
  const t = useTranslations("facturacion");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(id);
  }, [query]);
  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const q = debounced.trim();
  // Buscar por SKU y por nombre en el catálogo de precios (alcanza TODO, no solo los 100). El precio
  // definitivo lo resuelve AddItem; aquí solo se necesita id/sku/nombre para elegir.
  const searchRes = useResource<Producto[]>(
    () =>
      q.length >= 1
        ? listCatalogoPrecios(tipoPrecioId ? { q, priceTypeId: tipoPrecioId, limit: 50 } : { q, limit: 50 }, tenant ?? undefined)
            .then((r) => r.items.map((row) => ({ id: row.productId, name: row.name, sku: row.sku } as unknown as Producto)))
        : Promise.resolve([]),
    [q, tipoPrecioId, tenant],
  );
  const buscando = q.length >= 1 && searchRes.state.kind === "loading";
  const resultados = q.length >= 1 ? (searchRes.state.kind === "ok" ? searchRes.state.data : []) : catalogoInicial;

  const etiqueta = selected ? (selected.sku ? `${selected.sku} — ${selected.name}` : selected.name) : "";

  return (
    <div ref={rootRef} className="relative">
      <Input
        value={open ? query : etiqueta}
        onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={t("selectProduct")}
        disabled={disabled}
        className="h-9 w-full"
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {buscando && <ProductOptionsSkeleton />}
          {!buscando && resultados.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">{q ? t("noMatches") : t("selectProduct")}</p>
          )}
          {!buscando && resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onPick(p); setOpen(false); setQuery(""); setDebounced(""); }}
              className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              {p.sku && <span className="shrink-0 font-mono text-xs text-muted-foreground">{p.sku}</span>}
              <span className="min-w-0">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AddItem({ catalogo, showIvu, tipoPrecioId, tenant, disabled, onAdd }: { catalogo: Producto[]; showIvu?: boolean; tipoPrecioId?: string | null; tenant?: string | null; disabled?: boolean; onAdd: (p: { productId: string; description: string; quantity: number; unitPrice?: number; taxable?: boolean; meta?: Record<string, number | string> }) => void }) {
  const t = useTranslations("facturacion");
  const tRoot = useTranslations();
  const [prodId, setProdId] = React.useState("");
  const [cant, setCant] = React.useState("1");
  const [precio, setPrecio] = React.useState(""); // override manual (vacío = precio de la lista de la factura)
  const [gravadoOverride, setGravadoOverride] = React.useState<boolean | null>(null); // null = default del producto
  const [metaVals, setMetaVals] = React.useState<Record<string, string>>({}); // valores de columnas multiplicador/informativo
  // Productos elegidos por BÚSQUEDA que no están en la carga inicial de 100 (p. ej. CMALA01): se recuerdan
  // aquí para que toda la lógica (precio, columnas, línea) los resuelva igual. Handoff selector-de-linea-sin-buscador.
  const [extra, setExtra] = React.useState<Producto[]>([]);
  const resolve = (pid: string) => extra.find((p) => p.id === pid) ?? catalogo.find((p) => p.id === pid);
  const prod = resolve(prodId);

  // IVU (§2): el default nace del producto (gravado), NO fijo en ON. El cajero puede sobreescribir.
  const gravadoEff = gravadoOverride ?? !!(prod as { taxable?: boolean } | undefined)?.taxable;

  // Columnas dinámicas por producto: días/áreas/sesiones/dosis. multiplicador→total, informativo→muestra.
  const colsRes = useResource<ColumnaFacturacion[]>(
    () => (prodId ? listColumnasFacturacion(prodId, tenant ?? undefined) : Promise.resolve([])),
    [prodId, tenant],
  );
  const capturables = (colsRes.state.kind === "ok" ? colsRes.state.data : []).filter(
    (c) => c.role === "multiplicador" || c.role === "informativo",
  );
  // Opciones INLINE de un select de captura (nuevo: `render.opciones` en la propia columna; antes los
  // select sacaban sus opciones de un catálogo). Sirve para cualquier select así declarado (p. ej. la ZONA
  // del Protocolo Articular: rodilla|codo|cadera|hombro). Contrato: HANDOFF-zona-protocolo-articular.
  const opcionesDe = (c: ColumnaFacturacion): { value: string; labelKey?: string }[] => {
    const r = c.render as { opciones?: { value: string; labelKey?: string }[] } | null;
    return Array.isArray(r?.opciones) ? r!.opciones : [];
  };
  const esSelectCaptura = (c: ColumnaFacturacion) => c.type === "select" && opcionesDe(c).length > 0;

  // Autocálculo Dosis→Cantidad (potes/frascos): al cambiar la Dosis, Cantidad = ceil(dosis×días/unidadesPorEnvase).
  // unidadesPorEnvase (de NTPRODUCTOS.CapsulasXUni) y diasTratamiento vienen del catálogo (BE, en prod);
  // si faltan → cantidad manual, sin autocálculo.
  const capsUnit = prod?.unitsPerContainer ?? null;
  const diasTrat = prod?.treatmentDays ?? 30; // fallback si el producto no tiene el dato
  const dosisClave = capturables.find((c) => /dosis/i.test(c.slug))?.slug ?? null;
  const sugeridoClave = capturables.find((c) => /sugerid/i.test(c.slug))?.slug ?? null;

  // Defaults por columna (modelo del dueño): áreas = 1; días = cantidad (mismas visitas); resto vacío.
  // El valor mostrado = override del usuario (metaVals) ?? default → sin efectos ni setState en render.
  const isArea = (c: string) => /[aá]rea/i.test(c);
  const isDias = (c: string) => /d[ií]a/i.test(c) && !/dosis/i.test(c);
  // áreas = preset del producto (areasDefault ?? 1); días = cantidad (mismas visitas). Data-driven (PR #158).
  const areasDefault = (prod as { defaultAreas?: number | null } | undefined)?.defaultAreas ?? 1;
  const defMeta = (c: string) => (isArea(c) ? String(areasDefault) : isDias(c) ? cant : "");
  const metaShown = (c: string) => metaVals[c] ?? defMeta(c);

  // Flujo con Enter: cantidad → columnas (áreas, días…) → Enter en la última confirma la línea. La
  // navegación se resuelve por DOM DENTRO del handler (marca `data-flow`), sin refs leídos en render.
  const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();
  const onFlowKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const cont = e.currentTarget.closest("[data-addline]");
    const inputs = cont ? Array.from(cont.querySelectorAll<HTMLInputElement>("[data-flow]")) : [];
    const next = inputs[inputs.indexOf(e.currentTarget) + 1];
    if (next) {
      next.focus();
      next.select();
    } else {
      add();
    }
  };

  function onMetaChange(clave: string, value: string) {
    const dosis = Number(value);
    const sugerida =
      clave === dosisClave && capsUnit && capsUnit > 0 && diasTrat > 0 && dosis > 0
        ? Math.ceil((dosis * diasTrat) / capsUnit)
        : null;
    setMetaVals((m) => {
      const next = { ...m, [clave]: value };
      if (sugerida != null && sugeridoClave) next[sugeridoClave] = String(sugerida);
      return next;
    });
    if (sugerida != null) setCant(String(sugerida)); // pre-llena Cantidad, queda editable
  }

  // PREVIEW DEL PRECIO (por lista de la factura, centro de la factura; fallback efectivo).
  const precioRes = useResource<number | null>(
    () => {
      const p = resolve(prodId);
      if (!p) return Promise.resolve(null);
      const q = p.sku ?? p.name;
      const opts = tipoPrecioId ? { priceTypeId: tipoPrecioId, q, limit: 50 } : { q, limit: 50 };
      return listCatalogoPrecios(opts, tenant ?? undefined).then(async (res) => {
        let row = res.items.find((r) => r.productId === p.id) ?? null;
        if (!row || row.price == null) {
          const eff = await listCatalogoPrecios({ q, limit: 50 }, tenant ?? undefined);
          row = eff.items.find((r) => r.productId === p.id) ?? row;
        }
        return row?.price ?? null;
      });
    },
    [prodId, tipoPrecioId, tenant],
  );
  const buscando = precioRes.state.kind === "loading" && !!prodId;
  const precioLista = precioRes.state.kind === "ok" ? precioRes.state.data : null;
  const precioMostrado = precio !== "" ? precio : precioLista != null ? String(precioLista) : "";
  // Requeridos SIN llenar (p. ej. zona): bloquean agregar la línea → el aviso se ve ANTES de guardar.
  const faltanRequeridos = capturables.filter((c) => c.required && String(metaShown(c.slug)).trim() === "");
  const canAdd = !!prodId && !disabled && !buscando && faltanRequeridos.length === 0;

  function pick(p: Producto) {
    // Recordar el producto si vino de la búsqueda (no está en los 100 iniciales) → resolve() lo encuentra.
    setExtra((prev) =>
      prev.some((x) => x.id === p.id) || catalogo.some((x) => x.id === p.id) ? prev : [...prev, p],
    );
    setProdId(p.id);
    setGravadoOverride(null); // vuelve al default del nuevo producto
    setMetaVals({});
    setPrecio("");
    // Cantidad = diasTratamiento del pack (TD12→12…). Si el producto no lo trae → campo VACÍO (no 1).
    const dt = (p as { treatmentDays?: number | null }).treatmentDays;
    setCant(dt != null ? String(dt) : "");
  }

  function add() {
    if (!prod) return;
    // Solo mandamos `gravado` cuando lo SABEMOS (el producto lo trae) o el cajero lo tocó; si un producto
    // de búsqueda no trae el dato, se OMITE y el BE aplica el default del producto (no forzar «exento»).
    const prodGravado = (prod as { taxable?: boolean | null }).taxable;
    const gravadoKnown = prodGravado != null || gravadoOverride != null;
    const g = gravadoOverride ?? !!prodGravado;
    // Enviar SIEMPRE el precioUnitario resuelto (override del cajero ?? precio del catálogo por-sesión).
    // Si no se envía, el compuesto cae al precio-base (TD12=70) en vez del combo (50) → BE PR láser/precio.
    const precioOverride = precio.trim() === "" ? undefined : Math.max(0, Number(precio) || 0);
    const precioUnitarioEff = precioOverride ?? (precioLista != null ? precioLista : undefined);
    // meta = valores de las columnas de captura (por su clave). Número para multiplicador/informativo
    // (áreas, días…, el server calcula el total) y STRING para los select (p. ej. zona=rodilla).
    const meta: Record<string, number | string> = {};
    capturables.forEach((c) => {
      const raw = metaShown(c.slug); // override del usuario o el default (áreas=1, días=cantidad)
      if (raw == null || raw.trim() === "") return;
      if (esSelectCaptura(c)) { meta[c.slug] = raw; return; } // valor de opción (string)
      if (!Number.isNaN(Number(raw))) meta[c.slug] = Number(raw);
    });
    onAdd({
      productId: prod.id,
      description: prod.name,
      quantity: Math.max(1, Math.floor(Number(cant) || 1)),
      ...(precioUnitarioEff !== undefined ? { unitPrice: precioUnitarioEff } : {}),
      // Solo el flag gravado (cuando se conoce): NO se manda impuestoId — el servidor resuelve el impuesto
      // por la cascada del precio (desglose Estatal+Municipal completo). Handoff IVU compuesto.
      ...(gravadoKnown ? { taxable: g } : {}),
      ...(Object.keys(meta).length ? { meta } : {}),
    });
    setProdId(""); setCant("1"); setPrecio(""); setGravadoOverride(null); setMetaVals({});
  }

  return (
    <div data-addline className="grid grid-cols-2 items-end gap-3 rounded-md border border-dashed p-3 md:flex md:flex-wrap">
      <label className="col-span-2 flex min-w-0 flex-1 flex-col gap-1">
        <Lbl>{t("addItem")}</Lbl>
        <CatalogoCombobox
          catalogoInicial={catalogo}
          selected={prod ?? null}
          tipoPrecioId={tipoPrecioId}
          tenant={tenant}
          disabled={disabled}
          onPick={pick}
        />
      </label>
      {/* Columnas dinámicas del producto (áreas/días/sesiones/dosis) + selects declarados (p. ej. ZONA).
          Van ANTES de Cantidad: primero áreas y días (así se lee «áreas × días»), Cantidad después. El
          Enter fluye producto → áreas → días → Cantidad → Agregar. Handoff descuento-… (posición). */}
      {capturables.map((c) => {
        const requeridoVacio = c.required && String(metaShown(c.slug)).trim() === "";
        if (esSelectCaptura(c)) {
          return (
            <label key={c.slug} className="flex w-32 flex-col gap-1">
              <Lbl>{tRoot(c.labelKey)}{c.required && <span className="text-destructive"> *</span>}</Lbl>
              <Select value={metaShown(c.slug) || undefined} onValueChange={(v) => setMetaVals((m) => ({ ...m, [c.slug]: v }))}>
                <SelectTrigger className={"h-9 w-full " + (requeridoVacio ? "border-destructive" : "")}>
                  <SelectValue placeholder={t("selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {opcionesDe(c).map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.labelKey && tRoot.has(o.labelKey) ? tRoot(o.labelKey) : o.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          );
        }
        return (
          <label key={c.slug} className="flex w-24 flex-col gap-1">
            <Lbl>{tRoot(c.labelKey)}</Lbl>
            <Input
              data-flow={c.slug === sugeridoClave ? undefined : true}
              value={metaShown(c.slug)}
              onChange={(e) => onMetaChange(c.slug, e.target.value)}
              onFocus={selectOnFocus}
              onKeyDown={onFlowKey}
              readOnly={c.slug === sugeridoClave}
              className={"h-9 text-right tabular-nums " + (c.role === "informativo" ? "opacity-80 " : "") + (c.slug === sugeridoClave ? "bg-muted" : "")}
              inputMode="decimal"
              placeholder={c.role === "multiplicador" ? "×" : ""}
            />
          </label>
        );
      })}
      {/* Cantidad DESPUÉS de áreas/días. Con dosis, ya viene pre-calculada; queda editable. */}
      <label className="flex w-20 flex-col gap-1">
        <Lbl>{t("qty")}</Lbl>
        <Input
          data-flow
          value={cant}
          onChange={(e) => setCant(e.target.value)}
          onFocus={selectOnFocus}
          onKeyDown={onFlowKey}
          className="h-9 text-right tabular-nums"
          inputMode="numeric"
        />
      </label>
      <label className="flex w-28 flex-col gap-1">
        <Lbl>{t("price")}</Lbl>
        <Input value={precioMostrado} onChange={(e) => setPrecio(e.target.value)} placeholder={buscando ? "…" : t("priceAuto")} title={t("priceAutoHint")} className="h-9 text-right tabular-nums" inputMode="decimal" />
      </label>
      {showIvu && (
        <label className="flex flex-col gap-1">
          <Lbl>{t("ivu")}</Lbl>
          <button
            type="button"
            onClick={() => setGravadoOverride(!gravadoEff)}
            className={"h-9 rounded-md border px-3 text-[11px] font-medium " + (gravadoEff ? "bg-info/15 text-info-foreground" : "text-muted-foreground")}
            title={t("ivuToggleHint")}
          >
            {gravadoEff ? t("ivuGravado") : t("ivuExento")}
          </button>
        </label>
      )}
      <Button type="button" size="sm" className="col-span-2 h-9 md:col-span-1" disabled={!canAdd} onClick={add}>
        {t("add")}
      </Button>
    </div>
  );
}
