# Handoff BE — Resumen gerencial del kardex con el formato del dueño

Fecha: 2026-11-18 · Pedido: el dueño, con la hoja de la Vitamina C de Caguas (oct–nov 2026) como
modelo · FE: cmr-fe

## Lo que pide el dueño (hoja de ejemplo, octubre → 31-oct)

| Renglón | Cantidad |
|---|---|
| INVENTARIO INICIAL | 158 |
| ENTRADA AL ALMACÉN EL 10/02/2026 · VITAMINAS LABORATORIO NEW ERA · TRANSFERENCIA # t3912923CV | 100 |
| … una línea por entrada: fecha, proveedor, nº de transferencia | … |
| VITA C RICHARD TORRES · AJUSTE # 6066 | 1 |
| VITA C JEAN CARLOS MARTINEZ · AJUSTE # 6075 | 1 |
| APLICADAS AL 10/31/2026 | 383 |
| **INVENTARIO FINAL AL 10/31/2026** | **133** |
| Observaciones: Nueva Era 133 unidades · La Receta 0 unidades | |

La cuenta cierra así: 158 + 360 − 2 − 383 = 133.

**Qué es un «ajuste» para el dueño.** Es una salida registrada a mano, que **no** pasó por facturación
ni por el tablero de pacientes (`/boards/patient-…`), y por eso no se descargó desde allí. Va con el
nombre del paciente y el número de ajuste.

Lo que **no** es un ajuste:
- las reversas de entregas del mostrador;
- las correcciones que se anulan entre sí;
- el traslado del inicial.

Eso es aplicadas en neto o ruido de carga.

## Verificado hoy: lo que devuelve `kardex-summary` (Vitamina C, Caguas, 1–18 nov)

Abre en 133, `applied` = 232, cierra en 211. Las líneas, agrupadas por `kind` / `reason` / `documentType`:

| kind | reason | documentType | líneas | suma |
|---|---|---|---|---|
| inbound | transferencia | ajuste | 3 | +300 |
| adjustment | devolucion | entrega | 10 | +260 |
| adjustment | correccion | ajuste | 3 | −533 |
| adjustment | conteo_fisico | ajuste | 1 | +133 |
| adjustment | devolucion | devolucion | 1 | +150 |

El dueño ve 15 renglones «Ajuste · Devolución · Reversa entrega frontdesk sesión <uuid>» que para él
no son ajustes: es confuso (captura del 18-nov).

## Pedido: un bloque `ownerFormat` en `kardex-summary`, o un endpoint hermano

Que sea el BE quien clasifique; el FE solo pinta, como en el resto del kardex.

```
ownerFormat: {
  opening: number,                       // inventario inicial al `from`
  inbound: [{ date, supplier, documentNumber, quantity, notes }],
  manualOutputs: [{ date, patient: { name, medicalRecordNumber } | null, adjustmentNumber, quantity, notes }],
  appliedNet: number,                    // entregas del mostrador/facturación − sus reversas, en viales
  appliedProportion: number | null,
  closing: number,
  closingBySupplier: [{ supplier, quantity }]   // «Observaciones»
}
```

1. **`inbound`**: cada entrada con su fecha, el **nombre del proveedor** y el **número de
   transferencia u orden de compra**.
   - En las cargadas del legado, ese número hoy solo está en `notes` (t2556112cY).
   - El FE no debe sacarlo de un texto.
2. **`manualOutputs`**: solo las salidas que no vienen de una entrega del mostrador ni de una factura.
   Cada una con su paciente, si lo tiene, y su número de ajuste.
3. **`appliedNet`**: las aplicadas en neto.
   - Una reversa de entrega (`devolucion` / `entrega`) resta de aplicadas, no suma a ajustes.
   - Las correcciones de carga que se anulan entre sí (inicial trasladado y la corrección de las 10
     reversas) no salen como renglón.
   - Si una corrección debe verse, que vaya con un motivo legible.
4. **`closingBySupplier`**: lo que queda al cierre, por proveedor (Nueva Era / La Receta), a partir de
   los lotes.
5. Swagger, MCP, comentarios y tests. La cuenta tiene que cerrar:
   `opening + Σinbound − Σ|manualOutputs| − appliedNet = closing`.

## Envío por email (mismo patrón para Imprimir, CSV y Email)

El dueño quiere que todos los reportes tengan los mismos tres botones. Hoy solo la factura y el cuadre
tienen endpoint de email. Pedido:

- `POST /reports/email`, con `{ to?: string[], subject, html, csv?: { filename, content } }`.
- Sin `to`, usa la lista por defecto del centro, como `caja.emailRecipients`.
- Permiso: el del reporte que se envía. Se valida un permiso «reportes.email».
- El FE manda el mismo HTML que imprime.

## FE (cuando esté)

- Pestaña «Resumen gerencial» con el formato de la hoja: renglones, cantidades a la derecha, final
  resaltado y observaciones.
- La vista actual queda como «Detalle de movimientos».
- Barra común Imprimir / CSV / Email para todos los reportes, con la misma ventana de impresión y
  membrete.
