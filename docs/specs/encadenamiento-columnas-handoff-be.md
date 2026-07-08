# Encadenamiento de columnas POR TABLERO — estado y handoff

**Fecha:** 2026-07-08 · Handoff autoritativo para BE: **`cmr-be/docs/specs/encadenamiento-columnas-por-tablero-fe-request.md`**.

## Conclusión (tras revisar el código de BE)
- ❌ **Descartado** pedir campos `grupo`/`grupoOrden` nuevos en la composición: **innecesarios**.
- ✅ **BE ya tiene override de `render` POR-TABLERO** en la composición (`tablero_columna.render`, se fusiona
  `catálogo → composición → usuario`). → Encadenar por-tablero ya es posible HOY escribiendo
  `POST /tablero/composicion { render:{ group:"flujo_atencion" }, orden }`. La misma columna puede estar
  encadenada en `atencion` y suelta en otro tablero. **Cero BE** para esto.
- 🔴 **Único pedido a BE:** implementar el **CRUD de `tablero_estados` + `tablero_transiciones`** (ya
  especificado en `tableros-admin-crud.md`, aún sin implementar) + dispatch genérico `corregir`. Es lo que
  permite **crear eslabones nuevos** (N pasos). Detalle completo en el doc de cmr-be citado arriba.

## FE (sin BE, con endpoints existentes)
1. Migrar `render.group` de las 3 columnas del **catálogo** → a la **composición** de `atencion`.
2. Campo **"Cadena"** en el editor (grupo + orden; crear cadenas).
3. **Mover en bloque** + mantener contiguo al reordenar.
4. Arreglar `buildRender` (hoy borra `group`/`postAccion` al editar una columna → hacer merge).
5. Generalizar `FlujoAtencion` a **N** eslabones.

Detenido en (2)-(5) hasta priorizar; (1) puede adelantarse. El bloqueo real para "crear N" es el CRUD de BE.
