# HANDOFF FE → BE — Columna «Récord» en la lista de facturas

**De:** FE · **Pedido por:** el dueño, 05-nov-2026, viendo
`/billing/invoices?desde=2026-11-05&hasta=2026-11-05`.

## Qué pide

Agregar el **número de récord** del paciente como columna en la lista de facturas (General y
Consultas — es la misma pantalla, mismo motor: `components/facturacion/facturas-list-view.tsx`).

## Por qué esto es del BE, no del FE

Esa pantalla es **100% metadata-driven**: pinta exactamente lo que devuelve
`GET /api/v2/invoices/board?from&to&context&...` — `columns` (catálogo de columnas con su
`binding`) y `rows` (valores YA resueltos por clave de columna). El FE no decide qué columnas
existen; solo las renderiza en el orden que el BE manda (ver el comentario en
`lib/api/facturas.ts:118-123`).

**Verificado en vivo** (curl contra prod, Bayamón, hoy): ninguna columna actual trae el récord, y
ninguna fila tiene la clave en sus datos:

```
columnas de hoy: fac_numero | fac_fecha | fac_paciente | fac_medico | fac_estado | fac_usuario |
                 fac_total | fac_medio | fac_acciones

fila real: { "id": "...", "fac_numero": null, "fac_fecha": "2026-11-05",
             "fac_paciente": "ARCILES I., LISANDRO J.", "fac_medico": "...", "fac_estado": "borrador",
             "fac_usuario": "Larciles", "fac_total": 9680, "fac_medio": null, "fac_acciones": null,
             "clinicId": "...", "clinicName": "CMR Bayamon" }
```

No es un dato que el FE ya tenga y no esté mostrando — el `/invoices/board` de hoy no lo proyecta.

## Lo que se pide, concreto

Una columna nueva en el catálogo que devuelve `GET /invoices/board`, con el mismo patrón que las
demás (`fac_numero`, `fac_paciente`, …):

```json
{
  "clave": "fac_record",
  "labelKey": "fac.col.record",
  "tipo": "texto",
  "binding": "paciente.medicalRecordNumber",
  "editable": false,
  "render": null,
  "orden": <entre fac_paciente y fac_medico, a elegir>,
  "fijo": false
}
```

y en cada fila, la clave resuelta: `"fac_record": "<récord o null>"`.

**El dato ya existe en el sistema** — es el mismo `medicalRecordNumber` que ya proyecta
`GET /invoices/:id` (`patient.medicalRecordNumber`, usado en el detalle de factura) y que
`caja-reportes.service.ts` ya pone en `documentos[].medicalRecordNumber` del reporte del día
(`cuadre-caja.tsx`/`cuadre-total.tsx` ya lo pintan ahí). Es sumarlo también al proyector de
`/invoices/board`, no un dato nuevo que calcular.

**Sin récord** (paciente sin número asignado): `null`, igual que ya se hace en `documentos[]` del
reporte del día — el FE ya sabe pintar eso como celda vacía, no "null" ni guion raro.

## Qué hace el FE en cuanto llegue

- Nada que cambiar en el motor: `facturas-list-view.tsx` ya pinta cualquier columna del catálogo
  genéricamente (`columnas.map(c => <TableHead>{tRoot(c.labelKey)}</TableHead>)` / `renderCelda`).
  Solo falta:
  1. Agregar `fac.col.record`: es "Récord" / en "Record" a `messages/es.json` y `messages/en.json`.
  2. Verificar en vivo que la celda se pinta bien (vacía cuando `fac_record` es `null`) y que el
     orden de columnas queda razonable.
- Si el orden/posición que manda el BE no queda bien visualmente, se ajusta en el propio catálogo
  del BE (`orden`), no hardcodeado en el FE — mismo criterio que las demás columnas.

Avisar cuando esté en prod para hacer la verificación en vivo y el commit del lado del FE.
