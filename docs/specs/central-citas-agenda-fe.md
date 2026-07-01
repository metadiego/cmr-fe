# FE Hand-off — Central de Citas: vista-día + cupos + multi-centro

> BE listo (cmr-be commit `55c2a6a`, sin desplegar aún). Contrato estable. Este documento dice
> EXACTAMENTE qué construir en el FE. Todo lo de datos/reglas ya vive en el BE; el FE solo pinta y llama.

## 0. Qué queremos lograr (el objetivo)
El personal de citas es **un call-center único** que agenda para **varios centros** (Caguas/Bayamón).
Según el domicilio del paciente o la **disponibilidad de cupos**, asigna la cita al centro correcto.
Debe ser **fácil, rápido, intuitivo**. Dos cambios de UX:

1. **Al hacer click en una fecha del calendario NO abrir el modal simple de "crear cita"** → abrir una
   **vista-día tipo hoja** (como la hoja de cálculo que usan hoy, pero mejor): franjas horarias con
   **slots vacíos pre-asignados**, columnas ricas, notas del día, y agendar desde cada slot.
2. **Trabajar los dos centros a la vez**: ver combinado y/o conmutar; crear/reagendar eligiendo el centro
   destino; **reagendar puede mover** una cita de un centro a otro.

Todos los endpoints van bajo `/api/v1`, con `Authorization: Bearer <token>` y respuesta envuelta en
`{ data, meta }` (usa `res.data`). Errores traen `{ code, labelKey, message }` (traduce por `labelKey`).

---

## 1. Auth y multi-centro (lo primero que hay que entender)

El usuario puede tener 1 o N centros asignados y un permiso nuevo **`citas.multicentro`**.

- **`GET /auth/me`** → `{ id, perfilId, roles, permissions[], accessMode, allowedClinicIds[], activeClinicId, ... }`.
  - `permissions` incluye `citas.multicentro` si es central de citas.
  - `allowedClinicIds` = centros donde puede actuar. `activeClinicId` = centro activo (o `null`).
- **`GET /auth/me/centros`** → `[{ id, nombre, codigo, direccion, activo }]` — **usa esto para el selector de centro** (NO `GET /centros`, que es admin-only).

**Header `X-Tenant-ID` (centro activo):**
- Si el usuario tiene **1 centro** → no hace falta; queda fijo.
- Si tiene **N centros** y **NO** `citas.multicentro` → **debe** mandar `X-Tenant-ID` con un centro permitido, o el BE responde **409** ("elige centro"). (rol operativo normal, p.ej. médico.)
- Si tiene **N centros** y **SÍ** `citas.multicentro` (central de citas):
  - **Sin** `X-Tenant-ID` → **modo combinado**: lee de TODOS sus centros a la vez, escribe indicando `centroId`.
  - **Con** `X-Tenant-ID` → **modo conmutador**: fija ese centro (crear sin `centroId` cae en el activo).

**Recomendación UX:** un selector de centro arriba con opciones `[Todos] Caguas | Bayamón`.
- "Todos" → no mandes `X-Tenant-ID` (combinado). Las escrituras piden centro destino explícito.
- Un centro → manda `X-Tenant-ID: <id>` (conmutador). Persístelo (store/localStorage) y reléjalo en cada request.

---

## 2. Endpoint estrella: vista-día

### `GET /citas/agenda-dia?fecha=YYYY-MM-DD&centroId?=<uuid>`
- `fecha` obligatoria. `centroId` opcional: si lo pasas, ese centro; si no, el activo (o **todos los permitidos** en modo combinado).
- Permiso: `citas.read`.

**Respuesta (`res.data`):**
```jsonc
{
  "fecha": "2026-06-29",
  "columnas": [ /* ColumnaEfectiva[] — ver §5 (define el orden y tipo de columnas) */ ],
  "centros": [                       // 1 elemento (centro activo) o N (combinado)
    {
      "clinicId": "5f98ef29-…",
      "nombre": "CMR Caguas",
      "notasDia": [ { "id": "...", "fecha": "2026-06-29", "contenido": "Dr. Ocasio llega 9AM", "autorId": "...", "activo": true } ],
      "franjas": [
        {
          "hora": "07:00",
          "tipos": [
            {
              "tipoCitaId": "…", "tipoClave": "nueva", "tipoNombre": "Consulta (Nueva)",
              "cupo": 7,            // capacidad configurada de esa franja+tipo
              "vacios": 5,          // = max(0, cupo − citas.length) → SLOTS VACÍOS a pintar
              "citas": [            // filas YA proyectadas por las columnas dinámicas
                { "id": "…", "hora": "07:00", "tipo": "Consulta (Nueva)", "paciente": "JUAN PÉREZ",
                  "record": "14647", "telefono": "787-…", "medico": "Dr. Gilberto",
                  "comentarios": "…", "citadoPor": "KB", "estado": "programada", "acciones": null }
              ]
            },
            { "tipoCitaId":"…","tipoClave":"seguimiento","tipoNombre":"Seguimiento","cupo":5,"vacios":5,"citas":[] }
          ]
        },
        // … 08:00 … 13:00 …
        { "hora": null, "tipos": [ /* citas sin hora agendada (legacy agenda por día) */ ] }
      ],
      "resumen": { "totalCitas": 59, "porTipo": {"nueva":33,"seguimiento":26}, "cupoTotal": {"nueva":49,"seguimiento":35}, "atendidas": 20, "noShow": 0 }
    }
  ]
}
```

**Puntos clave para pintar:**
- Itera `centros[]`. En modo combinado hay 2 (una "hoja"/tab por centro, o dos columnas lado a lado). En modo single, 1.
- Por centro, la cabecera muestra `nombre` + `notasDia` (avisos del día) + `resumen` (p.ej. "Nuevos 33/49, Seguimientos 26/35, Atendidas 20").
- **`franjas`**: agrupa por `hora` (bloques 07:00…13:00). Dentro, un grupo por `tipos[]` (nueva/seguimiento).
- **Slots vacíos**: por cada grupo pinta `citas` (filas reales) y **además `vacios` filas vacías** con un botón "＋ Agendar {tipoNombre} {hora}". Ese botón abre el form de crear pre-llenado (fecha, hora, tipoCitaId, centroId=clinicId del bloque). Así se replica y mejora la hoja legacy.
- **`hora: null`** = citas sin hora agendada (los datos legacy vienen así). Píntalas como un grupo "Sin hora" al final; el usuario puede asignarles hora con "editar".

---

## 3. Columnas dinámicas (no hardcodees columnas)

`columnas` es un array `ColumnaEfectiva` que **define qué columnas mostrar, en qué orden y de qué tipo**.
No hardcodees los encabezados: recórrelas.

```ts
interface ColumnaEfectiva {
  clave: string;      // llave del valor dentro de cada fila de citas[] (p.ej. "record")
  labelKey: string;   // i18n del encabezado (p.ej. "tablero.col.record") → tradúcelo
  tipo: string;       // "texto" | "hora" | "badge" | "toggle" | "accion" | ...
  editable: boolean;
  permiso: string | null; // si no null y el user no lo tiene, oculta/deshabilita la columna
  render: Record<string, unknown> | null; // hints (ancho, color, opciones) — opcional
  orden: number;
  fijo: boolean;      // columna "sticky" (fíjala a la izquierda)
}
```
Cada fila de `citas[]` trae `fila[col.clave]`. El encabezado = `t(col.labelKey)`. Pinta según `col.tipo`
(badge = chip de color por estado/tipo; accion = botones por estado; texto/hora = texto).

Columnas del tablero `agenda` (orden actual): `hora, tipo, paciente, record, telefono, medico, comentarios, citadoPor, estado, acciones`.

---

## 4. Cupos (configuración de capacidad) — pantalla de admin

Panel de configuración (permiso `citas.config`, roles admin/gerente):
- **`GET /citas/cupos?diaSemana?=<0-6>`** → `[{ id, clinicId, diaSemana(0-6|null), hora, tipoCitaId, cantidad, activo }]`.
- **`POST /citas/cupos`** body `{ diaSemana?, hora, tipoCitaId, cantidad, activo? }` (diaSemana null/omitido = default todos los días).
- **`PUT /citas/cupos/:id`** body parcial. **`DELETE /citas/cupos/:id`** (soft-delete).

UX sugerida: una tabla por centro (usa `X-Tenant-ID`), filas = hora × tipo, editable la `cantidad`.
Default sembrado: 07:00–13:00, 7 nuevos + 5 seguimientos. La fila de una hora/día concreto **sobre-escribe**
el default. Esto es lo que alimenta `cupo`/`vacios` de la vista-día.

---

## 5. Notas del día — cabecera de la vista-día

- **`GET /citas/notas-dia?fecha=YYYY-MM-DD`** → `[{ id, fecha, contenido, autorId, activo, createdAt }]`.
- **`POST /citas/notas-dia`** body `{ fecha, contenido, autorId? }` (permiso `citas.update`).
- **`PUT /citas/notas-dia/:id`** `{ contenido?, activo? }`. **`DELETE /citas/notas-dia/:id`**.

En la cabecera de cada centro, muestra las notas y un "＋ Nota" para agregar (autorId = personal del usuario, si aplica).

---

## 6. Crear y reagendar (con centro destino)

### Crear — `POST /citas`
```jsonc
{
  "pacienteId": "uuid",
  "tipoCitaId": "uuid",     // nueva | seguimiento (de GET /citas/tipos)
  "centroId": "uuid",       // ← centro DESTINO. Obligatorio en modo combinado; opcional si hay activo.
  "medicoId": "uuid",       // requerido si tipo.requiereMedico y NO esPrimeraVez
  "fecha": "2026-06-29",
  "hora": "07:00",          // desde el slot vacío que se clickeó
  "horaFin": "08:00",       // opcional; el FE lo autocalcula con tipo.duracionMin
  "esPrimeraVez": true,
  "canal": "callcenter",    // central de citas = "callcenter"
  "callcenterId": "uuid",   // ← QUIÉN agenda (personal del operador logueado) = columna "CITADO POR"
  "motivo": "…", "notas": "…"
}
```
- Si el usuario está en **modo combinado** (sin `X-Tenant-ID`) DEBES enviar `centroId` o el BE responde
  **400** `citas.centro_requerido`. `centroId` no permitido → **403** `citas.centro_no_permitido`.
- Solapamiento (mismo médico/franja): el BE puede responder **200/201 con `meta.advertencias`**
  `[{ code:'SOLAPAMIENTO', labelKey:'citas.solapamiento', conflictos:[…] }]` (modo advertir), o **400**
  `citas.conflicto_horario` (modo bloquear). Usa **`POST /citas/validar`** (dry-run) para avisar ANTES de guardar.
- `callcenterId` = el `personal.id` del operador logueado → así se llena "CITADO POR" en la vista-día.

### Reagendar (incl. MOVER de centro) — `POST /citas/:id/reagendar`
```jsonc
{ "fecha": "2026-07-01", "hora": "09:00", "motivo": "paciente pidió Caguas", "centroId": "uuid-otro-centro" }
```
- Sin `centroId` → reagenda en el mismo centro.
- Con `centroId` distinto → **mueve** la cita a ese centro (la original queda `reprogramada`, nace una nueva
  en el destino; el BE limpia el `medicoId` porque el médico era del centro origen → habrá que reasignar).

### Tipos de cita — `GET /citas/tipos`
`[{ id, clave, nombre, color, duracionMin, requiereMedico, codigo, productoId, activo }]`.
**Filtra por `activo=true`**. Hoy solo hay 2 activos: `nueva` y `seguimiento`. Usa `duracionMin` para
autocalcular `horaFin` y `color` para el chip.

---

## 7. Tiempo real (opcional pero recomendado)

- **`GET /citas/stream`** (SSE, `@SkipEnvelope`) emite eventos del canal del centro:
  `{ canal, entidad: 'cita'|'nota_dia', id, accion, estado, actorId, version, ts }`.
- Trátalo como **invalidación**: al recibir un evento, re-fetch de `agenda-dia` (debounce ~300ms).
  Aplica el estado de forma idempotente; **nunca re-emitas** (anti-loop). Ignora los eventos cuyo `actorId`
  sea el propio usuario (ya reflejados por tu acción).

---

## 8. Flujo completo (pantalla por pantalla)

1. **Calendario mensual** (ya existe, `GET /citas?desde=&hasta=`): al **click en un día** → navega a la
   **vista-día** (`/citas/agenda/[fecha]` o modal grande), NO al form de crear.
2. **Vista-día**:
   - Cabecera: selector de centro (`[Todos]`/Caguas/Bayamón desde `/auth/me/centros`), fecha, notas del día, resumen.
   - Cuerpo: por cada centro, tabla agrupada por franja (07:00…) y tipo, con filas reales + `vacios` slots vacíos.
   - Cada slot vacío = botón "Agendar" → form de crear pre-llenado (fecha, hora, tipoCitaId, centroId).
   - Cada fila real = acciones por estado (confirmar, presente, triage, atender, no-show, cancelar, **reagendar**).
3. **Crear**: form con buscador de paciente (`GET /pacientes?q=`), tipo, médico (si aplica), hora/horaFin
   (autocalculado), motivo/notas; envía `centroId` + `callcenterId`. Antes de guardar, `POST /citas/validar`.
4. **Reagendar**: pide nueva fecha/hora + motivo + (opcional) centro destino. Si cambia de centro, avisa que
   se reasignará médico.
5. **Config cupos** y **notas**: pantallas de apoyo (ver §4 y §5).

---

## 9. i18n (agrega estas llaves a `messages/{es,en}.json`)
- Columnas: `tablero.col.tipo`, `tablero.col.record`, `tablero.col.telefono`, `tablero.col.comentarios`,
  `tablero.col.citadoPor`, `tablero.col.centro` (las demás ya existen).
- Errores: `citas.centro_no_permitido`, `citas.centro_requerido` (además de los ya existentes
  `citas.medico_requerido`, `citas.hora_fin_invalida`, `citas.conflicto_horario`, `citas.solapamiento`).

## 10. Edge cases / notas
- **Citas sin hora** (`hora:null`): datos legacy agendados "por día". Píntalas en el grupo "Sin hora";
  permite asignarles hora vía editar/reagendar.
- **Multi-centro combinado**: cada escritura DEBE llevar `centroId`. El selector "Todos" implica pedir el
  centro destino en el form de crear (o inferirlo del bloque desde donde se clickeó "Agendar").
- **`vacios` = 0**: franja llena; no muestres slot vacío (o muéstralo como "completo").
- **timezone**: usar `America/Puerto_Rico` (no Mexico_City) para render de horas/fechas.

## 11. Checklist FE
- [ ] Selector de centro con `/auth/me/centros`; manejo de `X-Tenant-ID` (todos vs uno) + permiso `citas.multicentro`.
- [ ] Vista-día que consume `/citas/agenda-dia` e itera `centros[] → franjas[] → tipos[]`, pintando citas + `vacios` slots.
- [ ] Columnas dinámicas desde `columnas` (label por `labelKey`, tipo, `fijo`, `permiso`).
- [ ] Slot vacío → crear pre-llenado (fecha/hora/tipo/centro) con `callcenterId` del operador.
- [ ] Crear/reagendar con `centroId`; reagendar cross-centro con aviso de reasignar médico.
- [ ] Notas del día (CRUD) + cupos (CRUD admin).
- [ ] `POST /citas/validar` antes de guardar (advertencias de solapamiento).
- [ ] SSE `/citas/stream` → invalida y re-fetch (debounce, anti-loop).
- [ ] i18n de las llaves nuevas.
