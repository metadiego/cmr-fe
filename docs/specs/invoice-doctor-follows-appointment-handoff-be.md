# La factura de consulta toma el médico que se asigna DESPUÉS — handoff FE → BE

**Fecha:** 2026-11-05 · **Urgente:** el dueño, molesto. Es un tema que «se trabajó desde hace mucho».

## Qué pasa

En Atención, el mostrador factura la consulta y después asigna el médico en el tablero. La factura
se queda **sin médico** y hay que ponérselo a mano en la cabecera.

## Evidencia (prod, Caguas, auditoría)

| Factura | Factura creada (AST) | Médico asignado después (AST) | Médico de la cita hoy |
|---|---|---|---|
| 001045 | 05-nov 08:13 | 08:32 `CitasController.update` + 08:45 `board/cell` | 47162082 |
| 001044 | 05-nov 08:08 | 08:45 `CitasController.update` + 09:03 `board/cell` | 8529abcf |
| 001038 | 04-nov 13:12 | 13:22 `CitasController.update` + 13:29 `board/cell` | 47162082 |
| 001033 | 04-nov 10:04 | 10:19 `board/cell` | 8529abcf |

Las otras 18 facturas de consulta de esos dos días se hicieron con el médico ya asignado y lo tienen.
`POST /invoices/appointment/:id` copia `cita.doctorId` **solo en el momento de crear** el borrador.
Es idempotente: si la factura ya existe, la devuelve tal cual, también sin médico.

## Lo que se pide (BE, un solo punto para la UI, la API y el MCP)

1. Cuando cambia el médico de una cita, por `PUT /appointments/:id` o por `board/cell` con el
   binding del médico, **propagarlo a su factura** si la factura no tiene médico (`doctorId` nulo).
   Vale en borrador y también **emitida**: el médico es dato de cabecera, no toca importes. Que quede
   en la auditoría.
2. Si la factura ya tiene **otro** médico, no pisarlo en silencio. Propuesta: no cambiar nada y
   avisar con un evento o un log. Si el dueño prefiere que el médico de la cita mande siempre, se
   decide aparte.
3. `POST /invoices/appointment/:id` sobre una factura existente sin médico: rellenarlo desde la cita.
4. Reparar las 4 facturas de arriba, o decir si prefieres que lo haga el FE con
   `PUT /invoices/:id/cabecera`.

## FE

Nada que cambiar si el BE lo propaga. La pantalla de factura ya pinta `doctorId` de la cabecera.
