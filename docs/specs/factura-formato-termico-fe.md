# FE — Formato de factura/recibo térmico 80mm (impresión por navegador)

**Fecha:** 2026-07-09 · **Alcance inicial:** factura de **consultas** (la más simple; ya construida el
editor POS-lite en `app/(app)/facturacion/[id]/page.tsx`). Luego se reusa para productos/servicios.
**Decisiones aprobadas:** impresión por navegador `window.print()` @page 80mm (Epson TM como impresora del
sistema, sin ESC/POS); datos fiscales por sucursal desde el BE (migra tabla `Empresa`, ver
`factura-datos-impresion-handoff-be.md`).

## Objetivo
Un **recibo imprimible** (80mm térmico) que muestre TODO lo que se construyó en la factura, con estética
moderna y limpia, reusable para todas las líneas (consulta/productos/servicios) porque se alimenta del
mismo contrato dinámico. Logo en todo documento generado.

## Investigación de layout (web, jul 2026)
- 80mm ≈ 72mm imprimible @203 DPI ≈ **48 caracteres/línea**. Monocromo. Fuente monoespaciada legible.
- Secciones estándar: **header (logo + empresa + id fiscal + sucursal) → doc (# + fecha) → paciente →
  items → impuestos → totales → pagos → footer (política + web + timestamp)**.
- Montos alineados a la derecha; separadores punteados; márgenes 2–3mm.
- Logo ≥1280px, alta resolución, monocromo (nuestro `logo_cmr.png` es 5433×2413 → reducir en print CSS).

## Referencia legacy (a replicar/mejorar)
`public/temp/factura_0007774.html` (contenido) + `app/Views/cierrefacturacion/recibo.php` (patrón ticket
80mm monospace con dashed + dots) + `public/css/impresion-facturas.css` (`@page size 72mm auto`, `.logo
max-width 50mm`, marca de agua `.anulada`).

## Componentes FE (nuevos)
- `components/facturacion/recibo-termico.tsx` — **presentacional puro**, recibe un objecto `Recibo` y pinta
  el ticket. Sin fetch. Reusable (consulta/productos/servicios).
- `components/facturacion/recibo-print.css` (o estilos scoped) — `@media print` + `@page { size: 80mm auto;
  margin: 2mm }`, oculta `.no-print`, fuerza monocromo, reduce el logo.
- Botón **"Imprimir"** en `facturacion/[id]/page.tsx` → abre el recibo en un contenedor imprimible y llama
  `window.print()` (o abre ruta `/facturacion/[id]/recibo?print=true` dedicada solo-impresión).
- `lib/factura/build-recibo.ts` — mapea `FacturaConItems` + datos fiscales del centro → el modelo `Recibo`
  (un solo lugar que arma el layout desde el contrato; nada hardcodeado).

## Modelo `Recibo` (lo que consume el componente)
```ts
type Recibo = {
  empresa: { nombreLegal; registroFiscal; registroFiscalLabel; telefono; direccion; sucursal; web; pieFactura } | null;
  numeroDisplay: string; fecha: string; estado: string; anulada: boolean;
  paciente: { nombre; record?; docId? };
  items: { cantidad; descripcion; precioUnitario; descuento; total }[];
  impuestos: { nombre; monto }[];
  subtotal; descuento; total; montoAbonado; saldo: number;
  pagos: { formaPagoNombre; monto; referencia? }[];
  atendidoPor?: string;   // médico o emisor
};
```

## Degradación elegante (no romper con datos parciales)
- `empresa === null` (BE aún no entrega el bloque fiscal) → header muestra solo marca + logo; NO crashea.
- `pagos` vacío → se omite el bloque de pagos. `atendidoPor` ausente → se omite.
- Consulta: `impuestos` vacío / `impuesto = 0` → no imprime línea de impuesto.

## i18n
Claves nuevas `receipt.*` (es/en): rótulo bilingüe del paciente ya es bilingüe por diseño legal; labels
`subtotal/discount/tax/total/paid/balance/attendedBy/thanks/returnPolicy`. El label del id fiscal viene del
BE (`registroFiscalLabel`), no se traduce.

## Cumplimiento
API-First (datos del BE) · configurable (formato/pie/label fiscal del BE, no hardcode) · multi-tenant (bloque
fiscal por centro) · RBAC (imprimir gateado por `factura.read`/permiso de facturación) · i18n · sin secretos ·
componente presentacional testeable (TDD: snapshot del `Recibo` → HTML esperado).

## Plan por fases
1. **F1 (FE, ahora):** `recibo-termico.tsx` + print CSS + `build-recibo.ts` + botón Imprimir, consumiendo lo
   que YA viaja (paciente/items/totales) + logo. Bloque fiscal/pagos con degradación (pendiente BE).
2. **F2 (tras BE 1–4):** cablear bloque fiscal por centro + `pagos[]` + emisor + `numeroDisplay`. `gen:api`.
3. **F3:** reusar el mismo recibo para productos/servicios (ya es dinámico) + marca ANULADA + devoluciones.
