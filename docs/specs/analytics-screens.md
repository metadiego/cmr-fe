# Handoff FE — Analítica: ventas y asistencia combinables, y pacientes

Estado: listo para construir · 2026-11-10 · BE: `cmr-be` ramas `feat/reporting-breakdowns` (#546) y
`feat/analytics-cube` (spec `cmr-be/docs/specs/analytics-cube.md`). Todo está también en Claude (MCP).
Permiso `estadisticas.read`. Todas aceptan `centerIds` (selector de centros como el resto de reportes).

## 1. Ventas — `GET /api/v2/statistics/sales-breakdown?from&to&by[&contexto][&doctorIds][&sellerIds][&productIds][&patientId][&limit]`

`by` = 1 a 3 cortes separados por coma: `clinic, day, month, weekday, hour, doctor, seller, product,
patient, source, paymentMethod, division`. `hour`/`paymentMethod` = dinero COBRADO (pagos) y no se
combinan con `product` (400 con `labelKey: statistics.product_with_payment_cut`).

```jsonc
{ "by": ["seller","month"],
  "rows": [ { "group": { "seller": "<id>", "month": "2026-11" },
              "labels": { "seller": "Ana Caja", "month": null },
              "invoices": 2, "patients": 2, "gross": 150, "refunds": 0, "net": 150 /* , "quantity" con product */ } ],
  "total": { "group": {}, "invoices": 3, "patients": 3, "gross": 350, "refunds": 0, "net": 350 },
  "truncated": 0 }
```

- Mostrar `labels[d] ?? group[d]`. `weekday`: 1 = lunes … 7 = domingo (label en inglés: traducir con i18n).
- `group[d] = null` = «Sin médico / Sin vendedor / …» (el dinero no se pierde).
- No sumar filas para `invoices`/`patients` (son distintos); usar `total`.

## 2. Asistencia — `GET /api/v2/statistics/attendance?from&to&by[&limit]`

`by` = 1 a 3 de `clinic, day, month, weekday, hour, kind, service, doctor, technician, visitType,
channel, status, patient`. Filas: `events, attended, noShows, cancelled, scheduled` (por venir; un
rango futuro = «quién vendrá»), `unrecorded` (pendientes de días pasados sin marcar), `patients`,
`attendedPatients`. Misma forma `group`/`labels`/`total`/`truncated`.

## 3. Ficha de asistencia — `GET /api/v2/statistics/patients/:id/attendance`

`firstVisit, lastVisit, visits {total, appointments, therapies, days}, noShows, cancelled,
unrecorded, avgDaysBetweenVisits, therapies[{service, serviceName, sessions, first, last}],
visitsByMonth[{month, visits}] (12), upcoming[{date, time, kind, clinicName, serviceName, doctorName}],
packages[{productName, total, delivered, returned, transferred, remaining}], spend{invoices, gross,
refunds, net}`. Encaja como pestaña «Asistencia» en la ficha del paciente.

## 4. Pacientes — `GET /api/v2/statistics/patients?from&to[&minVisits][&lapsedDays][&newOnly][&sort][&limit]`

Filas `{patient, label, visits, therapies, firstVisit, lastVisit, nextVisit, avgDaysBetweenVisits,
spend, isNew}`, más `distribution {"1","2","3-5","6-10","11+"}`, `patients`, `truncated`.
`lapsedDays` = sin visita en N días y nada agendado (lista para llamar).

## 5. Tasa de retorno — `GET /api/v2/statistics/return-rate?from&to[&withinDays][&cohort][&by]`

`total` y `rows` (si `by` = `clinic | month | service | doctor | kind`): `cohort, returned,
notReturned, pending, rate (0-1, null si no hay decididos), avgDaysToReturn`. `pending` = ventana
aún abierta: no entra en la tasa; mostrarlo aparte.

## 6. Flujo de pacientes — `GET /api/v2/statistics/patient-flow?from&to[&by]` (sin cambios)

## Pantallas sugeridas (Estadísticas › Analítica)

- **Ventas** y **Asistencia**: rango, centros, hasta 3 «Cortar por» (chips) y filtros; tabla dinámica
  (filas = 1er corte, columnas = 2º si lo hay) + gráfico (barras/serie de tiempo). Exportar CSV.
- **Pacientes**: tabla con filtros rápidos (Frecuentes ≥ N, Perdidos > N días, Nuevos), histograma de
  `distribution`, enlace a la ficha.
- **Retorno**: tarjetas (tasa, días medios, pendientes) + tabla por corte; selector 30/60/90 días.
- Todo con i18n (es/en) y formato de dinero de la app; usar toda la pantalla; menú bajo Estadísticas
  con `estadisticas.read`.
