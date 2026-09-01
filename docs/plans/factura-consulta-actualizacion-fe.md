# FE — Actualización de la factura de consulta (BE ya shippeó todo)

> El BE ya desplegó (2026-07-09/11) el payload enriquecido de factura + datos fiscales + filtros de listado.
> El FE ya tiene el **recibo térmico** y el **detalle**; solo falta **conectar los campos reales** (hoy los lee
> como "pending BE") y **crear el listado**. Todo es delta, aditivo. Empezar por `gen:api`.

## Paso 0 — Regenerar tipos
```bash
npm run gen:api   # trae empresa, pagos[], emisor, medico, emitidaEn, numeroDisplay en FacturaConItems
                  # + GET /centros/:id/datos-fiscales + GET /facturas ?desde&hasta&q
```

## Paso 1 — `lib/factura/build-recibo.ts`: usar los campos reales (quitar fallbacks "pending BE (F2)")
Ya existen en el payload de `GET /facturas/:id`:
- **`empresa`** (bloque fiscal, embebido en la factura) → leer **`f.empresa`** en vez de esperarlo por `opts.empresa`
  (líneas ~61, ~84). Campos: `nombreLegal, registroFiscal, registroFiscalLabel, telefono, direccion, sucursal,
  pieFactura, web, logoUrl`.
- **`numeroDisplay`** (línea ~51-52) → usar `f.numeroDisplay` directo (mantener fallback solo para facturas sin número).
- **`pagos[]`** (línea ~84-89) → `f.pagos` = `{ formaPagoNombre, monto, referencia, tipo, fecha }` (ya resuelto).
- **`emisor`** (línea ~90) → `f.emisor?.nombre` ("Atendido por").
- **`emitidaEn`** → `f.emitidaEn` (fecha real de emisión, no createdAt).
- **`medico`** → `f.medico?.nombre`.
→ Quitar los comentarios/lecturas "pending BE (F2)"; ya no son pending.

## Paso 2 — `app/(app)/facturacion/[id]/page.tsx` (detalle/recibo)
- El recibo ya no necesita fetch aparte de datos-fiscales: viene en `f.empresa`. (Si en algún flujo se quiere
  editar los datos del centro, usar `GET /centros/:id/datos-fiscales` — opcional.)
- Logo: `f.empresa.logoUrl ?? asset por defecto` (`logo_cmr.png`).

## Paso 3 — `lib/api/facturas.ts`: agregar el listado
```ts
export function listFacturas(params: {
  page?: number; limit?: number; estado?: string; pacienteId?: string;
  desde?: string; hasta?: string; q?: string;   // q = nº factura O paciente (nombre/record)
}, centroId?: string): Promise<Paginated<FacturaConItems>> { /* GET /facturas?<params> */ }
```

## Paso 4 — Página de LISTADO `app/(app)/facturacion/page.tsx` (nueva; era el único hueco del plan)
- TanStack Table v8 + shadcn `data-table`, **server-side** (paginación), **search global** (`q`) + **rango de
  fechas** (`desde/hasta`) + filtro `estado`, estado en URL.
- Acciones por fila (RBAC `can()`): consultar/re-imprimir (→ `[id]`), anular, devolver, editar (borrador).
- i18n, tokens-only, móvil. Buscar patrón moderno de data-table (shadcn) para el estilo.

## No incluye
- El **toggle-testimonio** (columna del tablero, no de la factura) — hand-off aparte:
  `cmr-be/docs/specs/tablero-columna-testimonio.md`.

## Checklist
- [ ] `gen:api`
- [ ] build-recibo lee `f.empresa/pagos/emisor/emitidaEn/medico/numeroDisplay` (sin fallbacks pending)
- [ ] `listFacturas` en `lib/api/facturas.ts`
- [ ] página de listado con filtros + acciones RBAC
- [ ] `npm run build` / typecheck verde
