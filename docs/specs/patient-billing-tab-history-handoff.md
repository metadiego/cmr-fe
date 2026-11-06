# Ficha del paciente, pestaña «Facturación»: el histórico completo — handoff BE → FE

**Fecha:** 6-nov-2026 · **Pedido por:** el dueño · **Prioridad:** alta.

## Qué pasa

En la ficha del récord 67594 (Caguas, TORRES GINES EDWIN) la pestaña «Facturación» muestra una sola
factura: la 001080 de hoy. El dueño preguntó: «si migramos toda la facturación desde 2021, ¿por qué no
veo el historial?».

## Causa (verificada)

La pestaña se arma con el endpoint equivocado.

- `FichaFacturacion` (`components/clientes/ficha-tabs.tsx:191`) llama a
  `getResumenPaciente` → `GET /invoices/patient-summary`.
- Ese endpoint es la suma **de hoy** que usa el cajero para no cobrar con calculadora:
  - sin fechas, devuelve solo el día de hoy;
  - solo trae facturación general, sin consultas;
  - como máximo abarca 31 días. Si se le pide más, el BE responde
    `factura.resumen_rango_amplio`: «para el histórico está el listado de facturas».

Los datos están migrados. En producción, `GET /api/v2/invoices?patientId=2da7bbca-7e8c-423f-9986-1aa694d2ebf8&limit=100`
devuelve las 9 facturas del paciente:

| Factura | Fecha | Total |
|---|---|---|
| C011417 | 2023-03-24 | $20.00 |
| C039665 | 2026-09-11 | $10.00 |
| S039667 | 2026-09-11 | $10,200.00 |
| S039668 | 2026-09-11 | $5,000.00 |
| P0010364 | 2026-09-11 | $879.68 |
| L007062 | 2026-09-11 | $920.32 |
| C039979 | 2026-09-28 | $0.00 |
| C040344 | 2026-10-16 | $0.00 |
| 001080 | 2026-11-06 | $0.00 |

Esas cifras son del legado. Coinciden con `cma_MFactura`, `MFactura` y `MSSMFact` de Caguas.

## Qué se pide

1. **La tabla de la pestaña** sale de `GET /invoices?patientId=<id>`, paginada (`page`, `limit`), con
   `centerIds` opcional igual que el resto. Se ordena de la más reciente a la más antigua y abarca
   todos los departamentos: consulta y general.
   Columnas, con los nombres reales de v2:
   - `number`;
   - `date`;
   - `context` (consulta / general);
   - `legacyOrigin` (`consulta`, `laser`, `suero`, `productos`, o null si nació en el sistema nuevo);
   - `status`;
   - `total`;
   - `paidAmount`.

   Al hacer clic en una fila se abre la factura.
2. **El origen se muestra:** por ejemplo, una etiqueta «Legado · Suero» cuando `legacyOrigin` no es
   null, mediante `labelKey` (i18n).
3. **Los KPI de arriba** (Total, Cobrado, Pendiente, Devuelto): el BE los va a servir para todo el
   histórico. Es una entrega aparte y se avisará con su contrato. Mientras tanto, no se muestran sumas
   de una sola página como si fueran el total del paciente: o se ocultan, o se rotulan «en esta página».
4. **`fac.grupo.producto`** sale en pantalla sin traducir en la columna «Concepto». Falta esa clave en
   `messages/es.json` y `en.json`.

## Verificación

- Abrir `/patients/2da7bbca-7e8c-423f-9986-1aa694d2ebf8/billing` con la sesión de un usuario de Caguas.
  Tienen que aparecer las 9 facturas, de C011417 (2023) a 001080 (hoy).
- Probar un paciente de Bayamón con histórico desde 2007.
