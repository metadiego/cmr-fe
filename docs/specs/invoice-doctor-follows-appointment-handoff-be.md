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

## Caso de ejemplo del dueño (06-nov-2026), para que quede sin ambigüedad

Llega un paciente nuevo "N", primera visita. Se le hace la factura de consulta; en ese momento TODOS
los médicos están ocupados — ni el paciente ni el mostrador saben todavía a quién le va a tocar. La
cita (y la factura) nacen en "Sin médico" (comodín `legacyCode = '000'`, ver
`walk-in-sin-medico-habilitar-el-boton-handoff-fe.md`). Mientras el paciente llena los formularios, se
libera un médico y se le asigna a la cita. **Justo en ese momento** — se revisa si el médico ANTERIOR
de la cita era el comodín "Sin médico" — y ahí se actualizan DOS cosas, no solo una:

1. La **factura** de esa consulta (lo ya pedido abajo).
2. La **ficha del paciente** (`patient.doctorId`): si el paciente nuevo no tenía médico asignado
   (null/comodín), se le pone el que acaba de atenderlo. **Ojo:** esto es SOLO para cuando el paciente
   no tenía médico todavía (primera vez) — si ya tenía un médico de cabecera distinto y hoy lo ve
   OTRO médico (cubriendo, por ejemplo), la ficha del paciente NO se pisa; ese caso sigue la regla del
   punto 2 de abajo (no pisar en silencio).

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
5. **Nuevo (06-nov, ver caso de ejemplo arriba):** cuando se asigna médico a una cita y el médico
   ANTERIOR de esa cita era el comodín "Sin médico" (walk-in sin asignar), y el PACIENTE tampoco tenía
   médico propio (`patient.doctorId` nulo/comodín), poner también `patient.doctorId` = el médico recién
   asignado. Si el paciente YA tenía un médico de cabecera distinto, no tocar su ficha — eso es "otro
   médico cubriendo hoy", no un cambio de médico de cabecera.

## FE

Nada que cambiar si el BE lo propaga. La pantalla de factura ya pinta `doctorId` de la cabecera, y
`venta-general.tsx` ya usa `paciente.doctorId` como default del selector — al arreglarse esto en el
BE, Facturación general hereda el médico correcto sin que el FE tenga que forzar nada.
