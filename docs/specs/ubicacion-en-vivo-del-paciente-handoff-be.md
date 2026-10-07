# Handoff BE — ubicación en vivo del paciente (vitales/consulta/servicio), para un widget app-wide en Frontdesk

## El pedido (dueño, 07-oct-2026)

Saber, en todo momento y sin importar qué pantalla de Frontdesk esté mirando el usuario, dónde
está CADA paciente ahora mismo (vitales, consulta, o un servicio específico — Láser, Suero…), en
vivo, sin recargar la página. Hoy mismo con datos propios; a futuro se alimenta también del EHR.

## Lo que ya existe y es reusable tal cual (no hace falta pedir nada para esto)

- El transporte en vivo: `GET /api/v2/tablero/stream` (SSE) ya es **un solo bus por centro activo**
  que emite TODOS los tipos de entidad (`cita`, `sesion`, …) — `RealtimeService.subscribeActiveCenter()`
  filtra solo por `clinicId`, no por tablero. El hook del FE (`useCitaStream`) ya sabe consumirlo sin
  filtrar por entidad. Un widget fijo, visible en cualquier pantalla de Frontdesk, puede suscribirse
  a este MISMO stream sin pedir nada nuevo de transporte.
- `GET /ahora-mismo` (módulo `ahora-mismo`) se investigó como posible base y **no sirve para esto**:
  es un dashboard gerencial agregado (`frontdesk.porServicio` son CONTEOS por servicio, sin
  identidad de paciente ni ubicación resuelta). Se descarta como punto de partida — que quede
  anotado para no reinventar la rueda buscándolo de nuevo.

## Lo que falta — el hueco real

Hoy la "ubicación" de un paciente vive partida en DOS entidades sin cruce entre sí:

1. El tablero `atencion` (citas): `confirmada → presente → triage → en_consulta → atendida`.
2. Cada `sesion` de Servicios (una tabla por sí sola, no por tablero): `pendiente → presente →
   en_terapia → asistido`, con su propio `servicioId`.

No existe ningún concepto en el BE que una "¿en qué tablero/servicio está activo este paciente
AHORA MISMO, entre todos?" — se confirmó por grep que no hay nada parecido a
`ubicacionActual`/`dondeEsta` ni una vista que cruce `cita` × `sesion` por `pacienteId`.

### Pedido concreto

Un endpoint de solo lectura, por centro, que devuelva — por cada paciente con actividad HOY (cita
o sesión no terminal) — una fila ya resuelta:

```json
{
  "patientId": "...",
  "patientName": "...",
  "ubicacion": "vitales" | "consulta" | "servicio",
  "servicioSlug": "laser" | null,
  "estado": "presente" | "triage" | "en_consulta" | "en_terapia" | "...",
  "desde": "2026-10-07T14:32:00Z"
}
```

Resuelto con la MISMA precedencia que ya exista implícita en el negocio (ej. si el paciente tiene
sesión de servicio activa Y cita de consulta, cuál manda) — eso lo decide el BE, el FE solo pinta
lo que le llega. Si además el endpoint viene acompañado de su propio evento en el stream existente
(`entidad: "ubicacionPaciente"` o similar) en vez de depender de que el FE recomponga por
`cita`+`sesion` sueltos, mejor — pero no es obligatorio: el FE puede recalcular con lo que ya
recibe de `cita`/`sesion` si el join se resuelve ahí mismo en el handler del stream.

## No-scope

- No se pide nada del lado del EHR todavía — es explícitamente una fase futura, mencionada por el
  dueño pero no parte de este pedido.
- No se pide tocar `ahora-mismo` (queda como está, es un dashboard distinto).

## FE: qué se construye en cuanto esto exista

Un widget fijo (pequeño, no una pantalla aparte) en el layout de Frontdesk, visible sin importar la
pestaña activa, suscrito al stream ya existente — sin esta pieza del BE no hay con qué pintarlo.
