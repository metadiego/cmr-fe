# Handoff BE — Número de devolución con correlativo PROPIO (distinto al de factura)

## Problema (UX confirmado por el dueño)
En la lista de **Devoluciones** la fila se identifica hoy con el **número de la factura** (`facturaNumero`,
p. ej. `000001`) bajo la columna "Nº Factura". Eso confunde: parece una factura, no una devolución.

## Requerimiento
La **devolución debe tener su propio número correlativo**, con una **secuencia INDEPENDIENTE** de la de
facturación (no comparte el consecutivo de facturas). Ej.: devoluciones `D-000001`, `D-000002`… corriendo
aparte, aunque provengan de facturas con otra numeración.

## Qué necesita el FE del BE
1. **Secuencia/correlativo propio de devoluciones** (por centro/tenant, como el de facturas), atómico y sin
   huecos, configurable en prefijo/formato si aplica (evitar hardcode).
2. Exponer en `DevolucionEntity` (y en `GET /facturacion/devoluciones` + en la proyección de la factura y
   en el detalle de la devolución) un campo nuevo, p. ej.:
   - `numero` (correlativo interno, entero) y `numeroDisplay` (string formateado, p. ej. `D-000001`).
3. Mantener `facturaNumero`/`facturaId` como **referencia de origen** (el FE lo mostrará en segundo plano:
   "de la factura 000001"), pero la identidad principal de la fila pasa a ser el `numeroDisplay` de la devolución.
4. Backfill de las devoluciones existentes con su nuevo correlativo (o definir desde cuándo aplica).

## Notas
- Comentarios en DB/campos (norma), multi-tenant (secuencia por centro), configurable, sin hardcode.
- El FE ya tiene la lista lista para renderizar: en cuanto llegue `numeroDisplay`, cambia la columna
  "Nº Factura" → "Nº Devolución" y baja la factura de origen como referencia secundaria.

## 5) Recibo de DEVOLUCIÓN (documento propio)
El dueño pide que el **recibo diga "Devolución", no "Factura"**. Eso es un **recibo propio de la
devolución** (no el de la factura): encabezado `Devolución #<numeroDisplay de la devolución>`, ítems
devueltos, monto reembolsado y forma de reembolso. Depende del mismo `numeroDisplay` correlativo de arriba.
- Idealmente el BE expone la proyección de la devolución para el recibo (ítems devueltos + reembolso +
  emisor/fecha), igual que hace con la factura, para que el FE lo imprima con `ReciboTermico`.

**FE detenido en este punto hasta que el BE entregue el correlativo + la proyección de la devolución.**
(norma BE = handoff + parar). Interino posible sin BE: en una factura totalmente devuelta el FE puede
cambiar la palabra del encabezado a "Devolución", pero seguiría mostrando el nº de factura hasta que llegue
el correlativo — media tinta, mejor esperar el número real.

---

## ✅ ENTREGADO POR EL BE (correlativo + recibo) — listo para el FE

**Modelo/DB (migración `DevolucionCorrelativoPropio`)**
- Tabla nueva `secuencias_devolucion` (secuencia INDEPENDIENTE de facturas, **por centro**): `serie`
  (default `'default'`), `prefijo` (default `'D-'`), `padding` (default `6`), `proximo`. Configurable, sin
  hardcode. Todo con `COMMENT`.
- `devoluciones.numero` (int) + `devoluciones.serie` (text). El correlativo se asigna atómico al crear la
  devolución (incrementa `proximo`). Existentes **backfilled** en orden de creación por centro.

**Dónde llega el número (ya expuesto)**
- `GET /facturacion/devoluciones` (lista global): cada fila trae **`numero`** (int) y **`numeroDisplay`**
  (string, p. ej. `D-000001`). Sigue trayendo `facturaNumero`/`facturaId` como **referencia de origen**.
- `POST /facturas/:id/devolver` (respuesta): incluye `numeroDisplay`.
- El detalle/proyección de la devolución también resuelve `numeroDisplay`.

→ FE: cambia la columna **"Nº Factura" → "Nº Devolución"** usando `numeroDisplay`; baja `facturaNumero`
  a referencia secundaria ("de la factura 000001").

**Recibo de devolución (documento propio)** — proyección lista, imprimible con `ReciboTermico`:
- `GET /facturas/:id/devoluciones/:devolucionId/recibo` — permiso `factura.read`.
- MCP: tool `recibo_devolucion` (params `facturaId`, `devolucionId`), mismo RBAC.
- Devuelve:
  ```jsonc
  {
    "tipoDocumento": "devolucion",
    "numeroDisplay": "D-000001",      // encabezado: "Devolución #D-000001"
    "facturaNumero": "000123",         // referencia de origen (secundaria)
    "fecha": "2026-07-18",
    "estado": "activa",                // o "anulada"
    "montoDevuelto": 100.00,
    "impuestoDevuelto": 0,
    "formaReembolso": "Cheque",        // forma del reembolso (del ledger de pagos)
    "motivo": "…",
    "items": [ /* ítems devueltos: productoId, cantidad, sesiones, monto, montoImpuesto */ ],
    "paciente": { … },                 // reusa la cabecera de la factura de origen
    "empresa":  { … },                 // centro/emisor fiscal
    "emisor":   { … }
  }
  ```

Suite BE: 1005 tests verdes; drift-clean; migración aplica sola en el deploy (`migrationsRun`).
