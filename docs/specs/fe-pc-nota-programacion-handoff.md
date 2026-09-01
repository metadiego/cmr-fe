# Handoff FE — Nota de programación por componente (PC / protocolo)

**BE listo (PR #100, prod).** Un solo campo nuevo: `producto_componentes.nota`.

## 1. En el recibo / hoja de protocolo (`GET /facturas/:id`)
Cada componente del "Incluye:" ahora trae `nota`:
```jsonc
"contenido": [
  { "productoId":"…","sku":"ONDCH01","nombre":"Ondas de choque","cantidad":3,"precio":150,
    "nota":"Ondas de choque — visitas 1, 7 y 10; realizar primero" },
  { "sku":"TD01","nombre":"…MLS","cantidad":12,"precio":50,"nota":"MLS — una sesión en cada visita" },
  …
]
```
Pintar la `nota` bajo/junto al componente (fuente menor, indentada) cuando exista; si es `null`, omitir.
La **duración del protocolo en visitas** está en `producto.diasTratamiento` (ej. 12) — mostrarla como
"Protocolo de N visitas" si aplica.

## 2. En el CRUD del producto compuesto (Configuración)
Al editar la receta de un kit/compuesto, cada componente gana un campo **Nota / Programación**
(texto libre): `POST/PUT /api/v1/inventario/componentes` → `nota?`. RBAC `inventario.create/update`.
Es opcional: un PC simple lo deja vacío; un protocolo (Rodilla) lo llena.

## Qué NO cambió (ya estaba)
- Opcional que altera el precio (incluir/quitar): `opcional + precioIncremental + incluidoPorDefecto`.
- PC dentro de PC (anidado), opcional vendible solo, precio por componente (`contenido[].precio`).
- El total lo fija el precio del kit + Σ precioIncremental de opcionales incluidos.

## UI (layout moderno)
En el CRUD de receta: tabla editable (componente · categoría · cantidad · condición Base/Opcional ·
precio incremental · **nota**) — patrón data-grid moderno (shadcn/ui + TanStack Table). Labels i18n.
En el recibo: la nota como línea secundaria del componente (ver preview del "Incluye:").

## Aceptación
- Poner una nota a un componente y facturar el kit → la nota sale en `contenido[].nota` del recibo.
- Componente sin nota → no se muestra. No afecta precio ni total.
