# Handoff FE — Catálogo de Inventario: 4 categorías data-driven (Físicos/Insumos/Compuestos/Servicios)

> **De:** BE (cmr-be). **En prod (PR #88).** El BE ya sirve las clases como DATO. Falta que el FE pinte las
> 4 pestañas desde el endpoint (hoy tiene 2 quemadas) y filtre por `?clase=`. Sin hardcode, i18n.

## Problema actual
`components/inventario/productos-admin.tsx` tiene el filtro con **2 valores hardcodeados**
(`tipoFiltro: "fisicos" | "compuestos"`, líneas ~71 y ~176-177) y consulta con `soloFisicos`. Por eso
**no aparecen Insumos ni Servicios** — aunque el BE ya los tiene. Los servicios (láser/suero/consulta)
quedaron sin pestaña donde mostrarse.

## Contrato BE (ya en prod, verificado)
1. **Clases (para las pestañas, data-driven + i18n):**
   `GET /inventario/productos/clases` → `[{ clase, labelKey }]`:
   ```json
   [{"clase":"fisico","labelKey":"inventario.clase.fisico"},
    {"clase":"insumo","labelKey":"inventario.clase.insumo"},
    {"clase":"compuesto","labelKey":"inventario.clase.compuesto"},
    {"clase":"servicio","labelKey":"inventario.clase.servicio"}]
   ```
2. **Lista filtrada por clase:**
   `GET /inventario/productos?clase=fisico|insumo|compuesto|servicio&q=&page=&limit=&conProveedores=true`
   - `clase` omitido = todos. 1:1 con `producto.tipo`: fisico=unico · insumo=base · compuesto=compuesto · servicio=servicio.

## Cambios FE (mínimos, sin hardcode)

### 1) `lib/api/inventario.ts`
- Agregar `clase?` al `listProductosPaged` (whitelist del BE ya lo acepta):
  ```ts
  export function listProductosPaged(opts: {
    soloFisicos?: boolean; clase?: "fisico"|"insumo"|"compuesto"|"servicio";
    conProveedores?: boolean; q?: string; incluirInactivos?: boolean; page?: number; limit?: number;
  }) {
    const sp = new URLSearchParams();
    if (opts.clase) sp.set("clase", opts.clase);
    if (opts.soloFisicos) sp.set("soloFisicos", "true");
    // …resto igual…
  }
  ```
- Agregar `listClasesProducto(): Promise<{clase:string;labelKey:string}[]>` → `GET /inventario/productos/clases`.

### 2) `components/inventario/productos-admin.tsx`
- Estado: `const [clase, setClase] = useState<string>("fisico")` (reemplaza `tipoFiltro`).
- Cargar las clases una vez: `const clases = useResource(() => listClasesProducto(), [])` (o el helper que usen).
- Fetch de la tabla (reemplaza el `tipoFiltro === "compuestos" ? listCompuestos … : listProductosPaged({soloFisicos})`):
  ```ts
  listProductosPaged({ clase, conProveedores: true, q: debounced, page, limit: PAGE_SIZE })
  ```
  (ya NO hace falta el caso especial `listCompuestos`; `clase="compuesto"` lo cubre.)
- Pestañas **data-driven** (reemplaza los 2 `<SelectItem>` quemados):
  ```tsx
  {clases.map((c) => (
    <SelectItem key={c.clase} value={c.clase}>{t(c.labelKey)}</SelectItem>
  ))}
  ```
  (traducir el `labelKey` COMPLETO: `useTranslations()` sin namespace + `t(c.labelKey)`, o mapear.)

### 3) i18n — `messages/es.json` y `messages/en.json`
```json
"inventario": { "clase": {
  "fisico": "Físicos",        // en: "Physical"
  "insumo": "Insumos",        // en: "Supplies"
  "compuesto": "Compuestos",  // en: "Bundles"
  "servicio": "Servicios"     // en: "Services"
}}
```

## Contexto de datos (ya hecho por el BE, local + prod)
- Reclasificados a su tipo correcto (autoridad legacy `Minventario.Prod_serv`): TERAPIA MAG, TRANSCRANIAL
  LASER, AVACEN, suero (apex) → **servicio**; cánula/catéter → **insumo** (base).
- **Ambiguos, aún SIN clasificar (el dueño decide):** `NPT Stem Cells` y `MARIPOSA`. Aparecerán donde su
  `tipo` actual los ponga hasta que se definan.
- El catálogo de inventario es de GESTIÓN → SÍ muestra Consulta/Seguimiento (servicio). El NO-MEZCLAR es
  solo del POS de facturación, no de este catálogo.

## UI (buscar layout moderno)
Filtro por pestañas/segmented-control (shadcn Tabs o Select), data-driven; contador por clase opcional.
Nada hardcodeado: las categorías, sus labels y el filtro salen del BE.

## Modelo (recordatorio, 1:1)
físico=`unico` · insumo=`base` (no se vende solo, lo consumen compuestos/servicios) · compuesto=`compuesto`
(se forma de físicos+servicios+insumos) · servicio=`servicio` (no inventariable: láser/suero/consulta).
