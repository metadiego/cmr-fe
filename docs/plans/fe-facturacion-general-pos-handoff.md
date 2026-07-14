# Handoff FE — POS de Facturación GENERAL (una pantalla, un solo select)

> **De:** BE (cmr-be). **Para:** cmr-fe. **Fecha:** 2026-07-14. **BE en prod y funcional.**
> Decisiones del dueño: **comisiones FUERA**; clasificaciones (producto/láser/suero) **INTERNAS** (nunca pestañas);
> **UNA pantalla, UN solo `select`** con todo junto; **General ≠ Consultas** (mismo motor, no se mezclan).
> Reglas: `response.data`+`meta.pagination`; `Bearer`+`X-Tenant-ID`; whitelist estricto (param no doc = 400); i18n
> `labelKey`; `can()` por permiso; estados loading/vacío/error; **NO duplicar** (reusar `lib/api/*` y el editor de
> factura que YA existe en `/facturacion/[id]`).

## Estado BE (verificado 2026-07-14)
- **`GET /facturas/catalogo`** (sin `contexto`) = el "un solo select": devuelve TODOS los productos de división
  `general` (los de consulta quedan fuera). Gate RBAC `factura.division.general`.
- `GET /facturas/catalogo?contexto=consulta` = solo Consulta/Seguimiento (pantalla aparte; NO mezclar).
- Todo el flujo POS existe: crear→líneas(+kit)→descuentos→IVU/exento por ítem→emitir(descarga inventario)→pagos→anular/devolver.

## Contrato (endpoints reales, base `/api/v1/facturas`)
- Buscar paciente: `GET /facturas/buscar-paciente?...`
- Crear borrador: `POST /facturas` `{ pacienteId, medicoId?, ... }`
- Catálogo (el select): `GET /facturas/catalogo?q=` (sin `contexto` = general).
- Líneas: `POST /facturas/:id/items` `{ productoId, cantidad, ... }` · `PUT /facturas/:id/items/:itemId` ·
  `DELETE .../items/:itemId` · `PUT .../items/:itemId/kit` (editar receta del kit en la línea).
- **Columnas de captura por producto**: `GET /facturas/columnas?productoId=` → si el producto tiene multiplicadores
  (áreas/días/sesiones/dosis) el server los declara; el FE pinta esos campos y los manda en el item. Hoy la mayoría
  no tiene → solo cantidad×precio. (Se agregan como dato cuando entren láser/suero; el FE ya debe leerlas genéricas.)
- Descuentos: `PUT /facturas/:id/descuento-global` · `.../descuentos-grupo` · `.../exento` (3 niveles).
- **Emitir** (aquí descarga inventario): `POST /facturas/:id/emitir`.
- Pagos: `POST /facturas/:id/pagos` (+ `/multiple`) · `GET .../pagos/resumen`. Anular/devolver: `.../anular`,
  `.../devolver`, `.../devoluciones`.

## Pantalla (buscar layout POS moderno; refs abajo)
Patrón shadcn/POS de una sola vista, sin pestañas por tipo:
1. **Cabecera**: buscar/seleccionar paciente + médico (opcional).
2. **Select único de catálogo** (`/facturas/catalogo`, buscador `q`): al elegir un producto → agrega línea. Un solo
   selector para TODO (clasificación interna no se muestra como filtro obligatorio; a lo sumo un filtro opcional).
3. **Grilla de líneas** (cart): columnas alineadas Concepto · Cant · (multiplicadores si aplican, data-driven desde
   `/facturas/columnas`) · Precio · Desc · IVU/Exento (toggle por ítem) · Total. Una fila por cargo, decimales alineados.
4. **Totales sticky** (Subtotal · Descuento · Impuesto · Total) + descuento global/exento de cabecera.
5. **Panel de pago single-pane** (efectivo/tarjeta/mixto; cambio; últimos-4) → emitir → cobrar.
6. Acciones: anular, devolver (total/parcial). Imprimir/recibo (contrato de impresión ya existe).

## IVU / exento
Por **ítem** (toggle `gravado`) + global (`factura.exento`), con herencia del server. El FE solo expone los toggles;
el server calcula. (Los productos hoy no traen `gravado` fijo → el cajero decide por ítem.)

## Fuera de alcance
- Pestañas/filtros por tipo de producto. Comisiones. Cargar productos faltantes (lo hace el BE "al final").
- La pantalla de Consultas es aparte (ya tiene su contrato: `?contexto=consulta` + `POST /facturas/cita/:citaId`).

## Refs de UI moderna
- [shadcn/ui POS templates 2026](https://adminlte.io/blog/shadcn-ui-pos-templates/) · [POS payment UX (Bright)](https://brightinventions.pl/blog/payment-point-of-sale-design-ui-ux/) · [POS UX tactics (dev.pro)](https://dev.pro/insights/designing-a-pos-system-ten-user-experience-tactics-that-improve-usability/) · [Shopify POS UI](https://www.shopify.com/blog/pos-ui)

## Nota
El editor `/facturacion/[id]` ya existe (se usa para consulta). Evalúa **reusarlo** para General (mismo motor,
distinto catálogo) en vez de duplicar; el "un solo select" es el cambio principal. Si algo falta, mini-handoff al BE.
