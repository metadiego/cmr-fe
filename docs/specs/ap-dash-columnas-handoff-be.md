# Handoff BE — Columnas dinámicas del AP-Dash (tablero `atencion`)

**Fecha:** 2026-07-04 · **De:** FE (cmr-fe) · **Para:** BE (cmr-be)
**Regla:** el FE se detiene en las partes marcadas BE hasta tener este contrato resuelto.

> ## ✅ ESTADO: TODO RESUELTO Y EN PROD (BE, 2026-07-04)
> El mensaje de dogfood de abajo está **atendido en su totalidad** (PRs #22/#23/#24, desplegados y verificados):
> - ⚠️ 1 `optionsSource` (no `optionsFrom`) + `estado_selector` del call-center migrado → **PR #22**.
> - ⚠️ 2 `/tablero/opciones` va por `columna=<clave>` → doc corregida. ⚠️ 3 catálogo de `optionsSource` documentado (`medicos`, `enfermeras`, `tipos_cita`, `estados`).
> - 🔴 write del select-FK médico → **PR #23** (`render.writeBinding`: muestra `medico.nombre`, escribe `cita.medicoId`; `medico` = select editable en `atencion`).
> - ⏸ 1 toggle con hora → **PR #24** (transiciones configurables: presente/consulta/atender sellan llegadaEn/horaInEn/horaOutEn; atender ya no exige triage). ⏸ 5 personalización usuario → `POST /tablero/personalizar` render{color,background} (+ fondo de board por preferences). ⏸ 6 WA = `POST /notificaciones/enviar`, vitales = `POST /citas/:id/triage`.
>
> Detalle en las secciones **"✅ BE resolvió…"** más abajo. El FE puede reanudar sin bloqueos.
>
> **FE verificó en vivo (4 jul, tras PRs):** ✅ `medico` = select con `render.writeBinding:cita.medicoId` — write por `/tablero/celda` con `X-Tenant-ID` correcto → **201**. ✅ transiciones traen `estampa` (confirmadaEn/llegadaEn/horaInEn/horaOutEn) + `requierePrevios`. ⚠️ **Nit BE (no bloquea):** `/tablero/celda` **sin** `X-Tenant-ID` → **500 INTERNAL_ERROR** (debería ser 400/validación; el FE siempre manda tenant, pero conviene endurecer). Repro requestId `a1e11707-…`.

---

## 📩 MENSAJE PARA BE (copiar/pegar) — hallazgos dogfood 4 jul 2026

> Probé los endpoints reales. Esto es lo que encontré:
>
> **✅ Funciona:** color por columna (`POST /tablero/composicion {tablero,columnaId,color}` + `definicion.color`); edición de celda (`POST /tablero/celda {tablero,entidadId,columna,valor}`, `columna`=clave); opciones de médico (n=6, shape `{value,label}`).
>
> **⚠️ Corregir:**
> 1. La llave que funciona es **`render.optionsSource`**, NO `optionsFrom`. La columna `estado_selector` (citas_cc) usa `optionsFrom` → por `/tablero/opciones` sale **vacía**; unificar y revisar el selector de estado del call-center.
> 2. `/tablero/opciones` va por **`columna=<clave>`**; por `columnaId` (uuid) da **404**.
> 3. Documentar el catálogo de `optionsSource` válidos (solo respondió `medicos`).
>
> **🔴 BLOQUEANTE — write del select de médico:** debe **mostrar** el nombre y **escribir** el FK `cita.medicoId`, pero hoy:
> - binding `medico.nombre` → `POST /tablero/celda` da **400 "no es escribible"**.
> - binding `cita.medicoId` → **500 INTERNAL_ERROR** + proyección `medico: null`.
> - Necesito: write target del select (ej. `render.writeBinding:"cita.medicoId"`) **o** atar la columna a `cita.medicoId` con proyección que resuelva el FK a nombre y write que no crashee. Repro: cita `c4e30c8a-…`, columna `medico` id `4a254e63-…`, centro `ef6f87b0-…`.
>
> **⏸ Pendiente del contrato:** (1) toggle con hora (presente/en consulta/asistido); (5) personalización usuario (`render` con `{color,background}`; ¿background por columna o por tablero?); (6) acciones WA/vitales (¿endpoint o FE?).

---

## Objetivo
Replicar y mejorar el AP-Dash legacy (`/cmr/atencion`) con columnas 100% dinámicas:
cada columna tiene **comportamiento propio que escribe en la DB**, el **admin/supervisor/dev**
pre-personaliza (tipo, color, orden), y el **usuario final** personaliza lo suyo
(orden, colores, background) sin afectar a los demás.

## Estado actual (verificado en prod, 2026-07-04)
- **Catálogo** `ColumnaEntity`: `tipo ∈ {accion,fecha,hora,texto,select,toggle,badge,derivado}`,
  `binding`, `editable`, `render`(JSON), `ambitos[]`, `permiso`. CRUD: POST/PUT `/tablero/columnas`.
- **Composición admin** `TableroColumnaEntity`: `orden, visible, fijo, editable, activo`. **SIN color.**
  Escritura: POST `/tablero/composicion/bulk`.
- **Personalización usuario** `UsuarioColumnaEntity`: `visible, orden, fijo, render`(JSON).
  Escritura: POST `/tablero/personalizar` (any user). `PersonalizarColumnaDto` acepta `render`.
- **Edición de celda**: POST `/tablero/celda {tablero,entidadId,columna,valor}` (funciona, con historial `actorNombre`).
- **`atencion` hoy**: `hora, paciente, estado(badge), primeraVez(toggle), medico(texto), enfermera, canal, motivo, acciones`.

## Columnas objetivo (AP-Dash) y gap
| Columna | tipo destino | binding sugerido | Gap |
|---|---|---|---|
| record | texto **editable** | `paciente.record` | editable + **auto-consecutivo** (§3) |
| paciente | texto | `paciente.nombre` | ✅ existe |
| medico | **select** | `cita.medicoId` | opciones + escritura (§2) |
| consulta | texto/select | `cita.tipoConsulta` | definir binding real |
| prox_cita | fecha | `cita.proxCita` | **crear** |
| pago | texto/badge | `cita.pago` | **crear** |
| presente | **toggle-hora** | `cita.presenteAt` | crear + semántica (§1) |
| en_consulta | **toggle-hora** | `cita.enConsultaAt` | crear + semántica (§1) |
| asistido | **toggle-hora** | `cita.asistidoAt` | crear + semántica (§1) |
| vitales | accion | — | crear + acción (§6) |
| wa | accion | — | crear + acción (§6) |
| acciones | accion | `cita.acciones` | ✅ existe |

> Crear el **catálogo** y **componer** ya se puede con endpoints existentes; el FE puede
> sembrarlas. Lo que NO existe es el comportamiento/color de abajo. **Eso es lo que se necesita.**

---

## Lo que necesito del BE (contrato)

### 1. `toggle` con timestamp — PRESENTE / EN CONSULTA / ASISTIDO
- Click → BE fija el campo bound a la **hora actual** (`America/Puerto_Rico`) + historial; devuelve la hora para pintar "08:10". Segundo click → limpiar (o confirmar).
- ¿Vía POST `/tablero/celda` con `valor` especial (`"__now__"` / `null`) o endpoint dedicado `/tablero/toggle {tablero,entidadId,columna}`? **Definir.**
- ¿Estos toggles disparan **transición de estado** (agendada→presente→en_consulta→asistido)? Definir relación con `estados`/`transiciones` para no duplicar lógica.

### 2. `select` con fuente de opciones — MEDICO
- ¿Cómo obtiene el FE las opciones? Propuesta: `render = { optionsSource: "medicos", value:"id", label:"nombre" }` **o** GET `/tablero/opciones?tablero=&columna=`. **Definir** (aplica a cualquier select futuro).
- Escritura: POST `/tablero/celda columna=medico valor=<medicoId>` → BE actualiza `cita.medicoId`. **Confirmar.**
- Regla SEGUIMIENTO limpia médico (ver decisiones de reagendar) — ¿aplica al editar aquí?

### 3. RECORD # auto-consecutivo
- Columna `record` editable. Si está **vacío** y se guarda → BE genera el **siguiente consecutivo** y lo asigna.
- ¿POST `/tablero/celda columna=record valor="__next__"` → devuelve el número asignado? ¿o `/pacientes/next-record`? **Definir.**
- Multi-centro: ¿consecutivo **global o por centro**? Unicidad + concurrencia (dos usuarios a la vez).

### 4. Color de pre-personalización (ADMIN, nivel composición) — cambio de esquema
- Añadir `color?: string|null` (y opcional `bg?`, `textColor?`) a **`TableroColumnaEntity`** + **`SetComposicionItemDto`** + **`SetComposicionDto`**.
- Es el color que el admin fija **por columna en ese tablero** (el "molde"). Correr **gen:api** tras el deploy.

### 5. Personalización por usuario (orden + color + background)
- `UsuarioColumnaEntity.render` + `PersonalizarColumnaDto.render` ya existen. **Confirmar** que persiste/devuelve JSON arbitrario, p.ej. `render = { color, background, textColor }`. Si sí → **el FE lo usa sin cambio BE**.
- **Background**: ¿es por columna o **fondo general del board por usuario**? Si es a nivel tablero, ¿dónde se guarda la preferencia del usuario (¿`UsuarioTablero`?)? **Definir.**

### 6. Acciones `accion` — VITALES / WA / ACCIONES
- Cada `accion` necesita declarar **qué hace**: `render = { action: "vitales" | "whatsapp" | "doc" }`.
- WA: ¿BE expone endpoint para enviar/registrar WhatsApp, o es link `wa.me` (FE)? VITALES: ¿abre formulario (FE) o hay endpoint?

### 7. RBAC (2 niveles — importante)
- **Crear/administrar columnas + color de pre-personalización + composición** = admin/supervisor/desarrollador (`tablero.admin`/`tablero.config`).
- **Personalizar** (usuario) = cualquiera (`/tablero/personalizar`). **Confirmar** que un usuario NO-admin puede personalizar pero **NO** puede tocar catálogo/composición.

---

## Aceptación
En el FE, el tablero `atencion` muestra las columnas del AP-Dash; los toggles fijan hora en DB;
`medico` select escribe; `record` vacío genera consecutivo; el admin fija colores de columna;
el usuario reordena/recolorea/pone background **sin afectar** a otros usuarios.

## FE (lo que hago cuando el contrato esté resuelto)
- Renderers por `tipo` (select / toggle-hora / fecha / editable / accion) en `GenericBoard` + `TableroDinamico`.
- Builder (Columnas tab): selector de `tipo` (enum), **color por columna**, orden — pre-personalización admin.
- Panel de personalización del usuario (orden / color / background) vía `/tablero/personalizar`.

---

## ✅ Respuesta BE recibida (2026-07-04) + hallazgos de verificación en vivo

BE resolvió **3 de 6**: #2 select-opciones, #3 record-consecutivo, #4 color-composición. Al ejercer los
endpoints reales (dogfood) encontré discrepancias entre lo descrito y lo que la API hace — **corregir en vivo**:

### ✅ Confirmado funcionando
- **#4 Color**: `GET /tablero/definicion` ya trae `color` (string|null) por columna efectiva. Todas null hoy (nadie configuró). FE lo lee y aplica si ≠ null.
- **celda**: el DTO real es `{ tablero, entidadId, columna, valor }` donde `columna` = **clave** (no `campo`/binding, no `id`). El FE ya envía este shape. Para médico: `{tablero:"atencion", entidadId:<citaId>, columna:"medico", valor:<uuid>}`.
- **#2 Select**: con `render.optionsSource:"medicos"` + `GET /tablero/opciones?tablero=atencion&columna=medico` → **200, n=6**, shape `{value,label}` (`{value:<uuid>, label:"Christina Rosa"}`). Médico ya quedó configurado como `select` editable vía API.

### ⚠️ Discrepancias a corregir con BE
1. **Llave de render**: la que funciona es **`render.optionsSource`**, NO `optionsFrom`. Ojo: la columna `estado_selector` (citas_cc) está con `render.optionsFrom:"estados"` → por `/tablero/opciones` devuelve **vacío**. BE: unificar a `optionsSource` (o que el endpoint acepte ambas) y **verificar que el selector de estado del call-center no esté roto**.
2. **Parámetro de `opciones`**: es **`columna=<clave>`**. Por `columnaId` (uuid) da **404** (`ENTITY_NOT_FOUND … no está en '<tablero>'`). La doc de BE decía `columnaId` — corregir.
3. **`definicion` no expone `columnaId`** por columna efectiva (trae `clave` pero no el id). No es bloqueante para el FE (opciones va por clave), pero conviene incluirlo.
4. **Fuentes válidas de opciones**: solo `"medicos"` responde (n=6). `personal`/`medico`/`doctores`/`staff` → vacío. Documentar el catálogo de `optionsSource` soportados (medicos, enfermeras, tipos_cita, estados) y su nombre exacto.

### ✅ BE resolvió los hallazgos de dogfood (2026-07-04, prod)
1. **Llave de render** = **`render.optionsSource`** (única y correcta). `optionsFrom` era llave muerta. Se
   corrigió el seed de `estado_selector` (citas_cc) a `optionsSource:"estados"` y el seed ahora **migra en vivo**
   cualquier fila con `optionsFrom` → `optionsSource` (idempotente). Re-sembrado en prod: el selector de estado
   del call-center ya devuelve opciones.
2. **Parámetro de `opciones`** = **`columna=<clave>`** (confirmado; no uuid). Doc corregida.
3. **`definicion` no trae `columnaId`**: se mantiene por clave (el FE no lo necesita). No se añade el id por ahora.
4. **Catálogo de `optionsSource` soportados** (nombres EXACTOS): `medicos`, `enfermeras`, `tipos_cita`, `estados`.
   Cualquier otro (`personal`/`medico`/`doctores`/`staff`) → `[]`. `medicos`/`enfermeras` resuelven por
   `personal.porCapacidad('medico'|'enfermera')`; `tipos_cita` → catálogo activo; `estados` → estados del tablero.
   Añadir una fuente nueva = una rama en `TablerosService.opciones` (no configurable por dato aún).

### 🔴 BLOQUEANTE nuevo: el WRITE del select-FK (médico) NO funciona en BE
La lectura del select (opciones + display) funciona, pero **escribir el médico falla por ambos caminos**:
- Columna `medico` con `binding: "medico.nombre"` → `POST /tablero/celda {columna:"medico", valor:<uuid>}` → **400** `"la columna 'medico' (medico.nombre) no es escribible"` (binding de display, read-only).
- Cambiando `binding: "cita.medicoId"` → el write da **500 INTERNAL_ERROR** y además la **proyección de filas devuelve `medico: null`** (no resuelve el FK a label).

**✅ RESUELTO BE (Opción 1 — `render.writeBinding`, PR #23, prod).** El modelo elegido: la columna
select-FK mantiene su binding de **display** (`medico.nombre` → la proyección sigue resolviendo el nombre,
sin `null`) y declara el destino de escritura en `render.writeBinding` (`cita.medicoId`). `/tablero/celda`
escribe en `writeBinding` si existe (si no, en el propio binding, como las columnas de texto). No más 400 ni 500.
- La columna `medico` ya quedó sembrada como **`tipo:'select'`, `render:{optionsSource:'medicos',
  writeBinding:'cita.medicoId'}`, editable en `atencion`** (re-seed en prod).
- FE: enciende el renderer `select` de `medico`. Leer opciones con `GET /tablero/opciones?tablero=atencion&columna=medico`;
  escribir con `POST /tablero/celda {tablero:'atencion', entidadId, columna:'medico', valor:<uuid>}`. La celda
  sigue mostrando el nombre (display) y el historial registra `campo_editado` en `cita.medicoId`.
- Patrón general: **cualquier** columna select-FK futura = binding de display + `render.optionsSource` +
  `render.writeBinding`. Cero código nuevo.

### ✅ Sigue abierto → RESUELTO (todo ya servido por BE existente, cero build; PR #23 doc)
- **#1 toggle con hora (PRESENTE / EN CONSULTA / ASISTIDO)** — RESUELTO y AHORA CONFIGURABLE (PR #24, prod):
  NO se escribe la hora a mano — se dispara una **transición** que estampa el timestamp server-side.
  `POST /tablero/accion {tablero:'atencion', entidadId, accion}` con `accion`:
  - `presente` → estado `presente`, estampa `cita.llegadaEn`.
  - `consulta` → estado `en_consulta`, estampa `cita.horaInEn`. Exige `medicoId` (configurable).
  - `atender` → estado `atendida`, estampa `cita.horaOutEn`. **YA NO exige triage** (la regla se relajó;
    es configurable — un centro puede volver a exigir vitales sin deploy).
  Las 3 marcas (presente/en_consulta/asistido) miden el tiempo de espera y de consulta. Estas transiciones
  vienen en `definicion.transiciones` (con labelKey) → el FE pinta el toggle desde datos. Pintar las horas
  con bindings `cita.llegadaEn/horaInEn/horaOutEn`. Emite SSE + historial. NO crear campos.
  **Configurable, no rígido**: qué estampa y qué exige cada paso es dato (`tablero_transiciones.estampa` /
  `.requierePrevios`), editable por CRUD/MCP; agregar un estado nuevo del flujo con su marca = una fila, cero código.
- **#5 personalización usuario**: `POST /tablero/personalizar {tablero, columnaId, render:{color, background,…}}`
  persiste render arbitrario **por columna y por usuario**; `columnasEfectivas` lo mergea
  (`{...catalog.render, ...user.render}`) y lo expone en `definicion.columnas[].render`. Fondo del board
  **completo** por usuario (no por columna) = usa la capa usuario de **preferences** (`PUT /me/preferences`
  con una clave tuya, ej. `tablero.atencion.background`); el FE la lee del effective. Sin build BE.
- **#6 acciones WA / vitales**: endpoints existentes (acción de fila, no transición de estado):
  - **WA/SMS**: `POST /notificaciones/enviar` (EnviarNotificacionDto: cita → paciente por whatsapp/sms/impresa).
  - **vitales**: `POST /citas/:id/triage {enfermeraId, vitales}` (estampa `vitalesEn`, guarda vitales, avanza a
    triage). El FE llama estos directo desde el botón de la fila.

## ✅ BE resolvió el ROUND 2 (A–G, 2026-07-07, prod) — spec cmr-be/docs/specs/ap-dash-proyeccion-derivados.md
- **A. Proyección de filas** (`GET /tablero/filas?tablero=atencion`): cada fila ahora trae **`pacienteId`
  SIEMPRE** (como `id`, sin depender de columnas). Se enriqueció el ctx del board `atencion` → `record`
  (`paciente.record`/alias `paciente.numeroHistoria`) y `telefono` (`paciente.telefono`) ya NO salen null.
  `tipoConsulta` = binding EXISTENTE `cita.tipo` (nombre nueva/seguimiento). `proxCita` = DERIVADO
  (`cita.proxCita`): próxima cita futura no cancelada del paciente. **Allowlist de bindings = el registro
  `CITAS_RESOLVERS`** (binding no listado → celda null; nunca lee campos arbitrarios).
- **E. Record**: `pacienteId` por fila + binding `record`=`paciente.numeroHistoria`. Flujo:
  celda vacía → `POST /pacientes/:id/asignar-record` (por centro, idempotente); manual → `PUT /pacientes/:id`.
- **C. Toggles-hora** (chips): columnas `presente`/`en_consulta`/`asistido` (tipo `toggle`) sembradas y
  compuestas en `atencion`, con **`render = { transition, estampa }`**: `presente`→{transition:'presente',
  estampa:'llegadaEn'}, `en_consulta`→{'consulta','horaInEn'}, `asistido`→{'atender','horaOutEn'}. El chip
  dispara `POST /tablero/accion {accion: render.transition}` y muestra la hora del binding (`cita.llegadaEn`…).
  **Cadena lineal estricta (round 2.1)**: `consulta` SOLO desde `presente`; `atender` SOLO desde `en_consulta`
  (`consulta` sigue exigiendo `medicoId`). Es config (`tablero_transiciones.desdeEstados`) — cuando vuelva
  enfermería/triage se re-añade a `desdeEstados` sin código.
- **B. Derivados computados por config**: mecanismo = **computes con nombre** (seguro, sin eval), binding
  `computed.<nombre>`, `tipo:'derivado'`. Ya disponibles: `computed.esperaMin` (llegada→consulta),
  `computed.duracionMin` (consulta→salida), `computed.cicloMin`. Columnas `espera_min`/`duracion_min`
  compuestas en `atencion`. NO hay `render.formula` arbitraria; ampliar catálogo = una función en BE.
- **D. Acciones configurables** (`render.action`): payloads confirmados:
  - `vitales` → `POST /citas/:id/triage { enfermeraId, vitales:{...} }`.
  - `whatsapp` → `POST /notificaciones/enviar { citaId, canal:'whatsapp'|'sms'|'email'|'impresa',
    plantillaClave?, idioma?, destinatario?:'paciente'|'medico' }`. **round 2.1**: `destinatario:'medico'`
    envía al MÉDICO de la cita (destino = tel/email del `personal`; 400 si la cita no tiene médico). Default
    `paciente`. Vars de plantilla disponibles: `{{paciente}}`, `{{medico}}`, `{{fecha}}`, `{{hora}}`, `{{motivo}}`.
  - `expediente` → navegación FE (sin BE).
- **F. Fondo del board por usuario**: `PUT /me/preferences { config:{ tablero:{ atencion:{ background:"<url|color>" }}}}`;
  el FE lo lee del effective (`GET /me/preferences`). (El `render{color,background}` por-columna sigue por `/tablero/personalizar`.)
- **G. Hardening**: `/tablero/celda` (y cualquier lógica tenant-scoped) SIN `X-Tenant-ID` resoluble ahora
  responde **400 `TENANT_REQUERIDO`** (i18n `tenant.requerido`), no 500.

## ✅ Catálogos del builder (round 2.2, PR pendiente de #, prod) — dropdowns 100% dato
El builder ya no lista fuentes/computes/bindings a mano. Endpoints (lectura, principal autenticado):
- **`GET /tablero/catalogos/options-sources`** → `[{clave, labelKey}]` (medicos, enfermeras, tipos_cita,
  estados). MISMA lista que resuelve `/tablero/opciones` (fuente única, sin drift).
- **`GET /tablero/catalogos/bindings?entidad=cita`** → `[{binding, grupo}]` (allowlist real = claves del
  resolver de la entidad; grupo = prefijo cita/paciente/medico/computed/…). entidades: cita, sesion, factura.
- **`GET /tablero/catalogos/computes`** → `[{clave, labelKey, binding}]` (esperaMin, duracionMin, cicloMin;
  binding `computed.<clave>`). Transiciones ya vienen en `/tablero/definicion`.
- MCP: `tablero_catalogos(entidad?)` → los tres de una. Agregar una fuente/cómputo = una entrada en su const, sin tocar FE.

## Preguntas abiertas para BE — TODAS RESUELTAS ✅
1. `toggle` → transición vía `POST /tablero/accion` (sella hora server-side). **Resuelto** (PR #24/#25/#26).
2. `select` → `render.optionsSource` + `GET /tablero/opciones`. **Resuelto** (PR #22/#23).
3. `record` → `POST /pacientes/:id/asignar-record`, **por centro**. **Resuelto** (PR #21).
4. Color admin en composición (`tablero_columnas.color`). **Resuelto** (PR migr. 1783700000000).
5. Personalización usuario `render{color,background}` (por columna) + fondo de board por preferences. **Resuelto**.
6. Acciones WA (`/notificaciones/enviar`, incl. destinatario médico) / vitales (`/citas/:id/triage`). **Resuelto** (PR #26).
