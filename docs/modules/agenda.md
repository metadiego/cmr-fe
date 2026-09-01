# Agenda Médica (call-center · agendamiento) — FE module

Route: `/citas` — **dos tabs sobre el mismo calendario** (`components/agenda/month-calendar.tsx`):
**Citas Médicas** (módulo `citas`, con hora/horaFin, filtro por doctor) y **Citas de Servicio** (módulo
`frontdesk`, **por día sin hora**, filtro por servicio). i18n: `agenda` namespace. La vista operativa del
día ("Atención", tablero `{columnas,filas}`) es un módulo aparte (fase posterior).

## Tab Citas de Servicio (frontdesk)
- Clientes: `lib/api/servicios.ts` (`getServicios` → tabs/colores), `lib/api/frontdesk.ts`
  (`listSesionesRango({desde,hasta,servicioId?})` → array plano; `crearSesion`).
- `components/agenda/servicios-calendar.tsx`: calendario por servicio; eventos por **día** (sin hora),
  color = `servicio.color`. `components/agenda/sesion-modal.tsx`: Nueva cita de servicio (paciente,
  servicio, fecha, cantidad — **sin hora**; técnico se asigna en el tablero del día). `POST /frontdesk/sesiones`.
- Sesiones se gestionan (presente/en-terapia/asistido) en el **tablero del día**, no en el calendario.
- Verificado contra prod: crear sesión → 201; `GET /frontdesk/sesiones?desde&hasta&servicioId` la trae.

## Contrato BE (memoria `be-citas-agenda`)
- `GET /citas/tipos` → `{ id, clave, nombre, color, duracionMin, requiereMedico }`. El FE autocompleta
  `horaFin = hora + duracionMin`.
- `POST /citas` / `PUT /citas/:id` → aceptan `hora` + **`horaFin`**; `canal=callcenter`. `medicoId` oblig
  solo si `tipo.requiereMedico` y no `esPrimeraVez`.
- **`POST /citas/validar`** (dry-run) → `{ ok, advertencias, conflictos:[{citaId,hora,horaFin}] }`. Se llama
  antes de Guardar para advertir solape.
- Solape configurable (`citas.solapamiento`, default `advertir`): crear igual + `meta.advertencias[]`
  (`labelKey: citas.solapamiento`). El FE lo lee vía `apiFetchEnvelope` (`crearCitaAgenda`).
- `GET /medicos/horarios?medicoId=` y `GET /festivos?anio=` → para slots/bloquear días.
- **`limit` máximo = 100** → el calendario pagina el mes con `listCitasRango`.
- Color del evento: cita → `tipo.color` → `personal.color` → `#4a90d9` (`colorDeEvento`).

## Clientes / helpers
- `lib/api/citas.ts`: `listCitasRango({desde,hasta,medicoId})` (pagina), `validarCita`, `crearCitaAgenda`/
  `actualizarCitaAgenda` (retornan `{cita, advertencias}`), `getTiposCita`.
- `lib/api/disponibilidad.ts`: `getHorariosMedico`, `getFestivos`.
- `lib/agenda/calendar.ts`: `monthMatrix`, `toISO/parseISO`, `isFestivo`, `generarSlots`, `colorDeEvento`,
  helpers de tiempo (`addMinutes`).
- `lib/api/client.ts`: `apiFetchEnvelope` (devuelve `{data,meta}` para leer `meta.advertencias`).

## UI
- `app/(app)/citas/page.tsx`: calendario mensual (‹ › Hoy), filtro de doctor, **sidebar** (Pacientes
  buscar/＋ con `PacienteFormSheet`; leyenda de tipos con color), botón Nueva Cita (`citas.create`).
  **Vivo**: polling cada 20s (SSE pendiente de auth por query en el BE).
- `components/agenda/month-calendar.tsx`: rejilla del mes; festivos atenuados; eventos coloreados; click
  día → modal, click evento → editar.
- `components/agenda/cita-modal.tsx`: Fecha · Hora Inicio · **Hora Fin (auto desde tipo, editable)** ·
  Paciente · Doctor (oblig según tipo/primera vez) · Tipo · Estado (Agendada, read-only) · Motivo · Notas.
  Antes de Guardar → `validarCita`; si hay conflicto (política advertir) muestra aviso y permite "Guardar de
  todos modos"; al crear muestra `meta.advertencias`. Centro → `X-Tenant-ID` (master/multi-centro elige).

## Tenancy / i18n
- Escrituras llevan `X-Tenant-ID` (centro). `i18n/request.ts`: **timezone `America/Puerto_Rico` + `USD`**
  (negocio USA/PR). labelKeys del BE traducidos: `citas.{hora_fin_invalida,medico_requerido,conflicto_horario,solapamiento}`.

## Verificado (real contra API prod)
Tipos con color/duración (6+2); crear con `hora`+`horaFin` → 201; rango mensual (paginado, limit 100) trae
las citas; `validar` detecta solape; crear solapada → 201 + `meta.advertencias` (`citas.solapamiento`);
`horaFin<=hora` → 400. typecheck + lint verdes.

## Pendientes (BE / fases)
- BE: incluir `labelKey` en el 400 de `horaFin<=hora` (hoy solo message). SSE con auth por query (para pasar
  de polling a tiempo real). Sembrar horarios/festivos (hoy vacíos → modal usa hora libre).
- FE fases: vista **Atención** (día-de) + **Servicios** (frontdesk); slots desde horarios cuando se siembren;
  arrastrar para reagendar; vistas día/semana.
