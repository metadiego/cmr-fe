# AP-Board — Handoff MAESTRO a BE (todo lo pendiente, consolidado)

**Fecha:** 2026-07-07 · **De:** FE (cmr-fe) · **Para:** BE (cmr-be)
**Regla:** esto es competencia de BE. El FE ya hizo su parte (renderers, chips poner/quitar, select,
modal config-driven, builder por columna, personalización). Aquí va TODO lo que falta del lado BE
para completar el AP-Board, por prioridad.

## Estado FE (ya hecho, para contexto)
Board dinámico + chips toggle (checkbox poner/quitar, optimista) + médico select (`writeBinding`) +
record (display) + modal ACCIONES leyendo `render.actions` + builder "configurar columna" + personalización
en Settings. Verificado el flujo: presente→consulta→atender→atendida→(volver)→en_consulta.

---

## 1. Toggles = PONER/QUITAR completo + RESET EN CASCADA — 🔴 ALTA
La función del check es **poner o quitar** (la hora sellada es un *beneficio*, no el punto).
- Toda etapa (presente / en_consulta / atendida) debe **marcarse y desmarcarse**.
- Faltaba la vuelta desde `atendida`; la creé por API (`volver_en_consulta`: atendida→en_consulta). **BE debe dueñar el set completo de vueltas.**
- **Al desmarcar (`volver_*`) LIMPIAR la hora sellada** (`llegadaEn`/`horaInEn`/`horaOutEn`) — hoy NO se limpia (queda basura).
- **Reset en cascada**: desmarcar una etapa resetea las de abajo (estado + horas + datos de consulta), como el legacy: *"se resetearán TODOS los datos de la consulta"* (ver `funciones.js` legacy: `updateRowInterface`, `validateAndUnassist`).

## 2. Guardas de activación (con `requierePrevios` claro) — 🔴 ALTA
Según spec del AP-Board:
- **EN CONSULTA**: requiere **PRESENTE + médico**. (Hoy `consulta` pide `medicoId` ✓; falta exigir presente → `desdeEstados:[presente]`.)
- **ASISTIDO**: requiere **PRESENTE + médico + EN CONSULTA + vitales aplicados**. (Hoy `atender` no exige nada extra; falta `desdeEstados:[en_consulta]` + la condición de vitales.)
- Exponer `requierePrevios` por transición para que el FE muestre **exactamente qué falta** (mensaje claro, como el Swal del legacy).

## 3. Proyección de filas — exponer campos faltantes — 🔴 ALTA
`GET /tablero/filas?tablero=atencion` — faltan: **`tipoConsulta`** (col CONSULTA), **`proxCita`** (col PROX-CITA), **`telefono`** del paciente (para WA).
- 🔴 **`estado` SIEMPRE en la fila** (como `id`/`pacienteId`), **independiente de que la columna estado esté compuesta/visible**. Hoy, al ocultar la columna `estado`, la proyección deja de traer `fila.estado` → se rompen la franja de color por estado y el desglose de KPIs. El flujo ya no depende de esto (usa timestamps), pero accent + KPI sí.
Ya vienen ✓: `pacienteId, record, medico, llegadaEn, horaInEn, horaOutEn, espera_min, duracion_min`.
+ **allowlist de bindings** para crear columnas atadas a esos campos.

## 4. RECORD editable — 🟡 MEDIA
- `record.editable = true`, binding `paciente.numeroHistoria`; edición manual = `PUT /pacientes/:id { numeroHistoria }`.
- Auto-consecutivo por centro `POST /pacientes/:id/asignar-record` ✓ (ya funciona).

## 5. MEDICO temporal vs total — 🟡 MEDIA
3 casos (spec): **nuevo** → escribe `cita.medicoId` **Y** `paciente.medicoId` (default); **temporal** (solo ese día) → solo `cita.medicoId` (hoy ✓); **total** (cambio permanente / médico se fue) → ambas tablas.
- BE: soportar "además fijar el médico **default** del paciente" (regla/flag detrás del mismo select). El FE ya escribe `cita.medicoId`.

## 5b. Médicos por centro (datos) + write cross-centro — 🔴 ALTA
Verificado en vivo: `optionsSource: medicos` es **por centro**. **Bayamón solo tiene "Médico Demo"** (`/personal` tenant Bayamón = 1); los médicos reales están en Caguas. El FE ya pide opciones por centro (fix), así que en Bayamón solo aparecerán sus médicos.
- **BE/datos: sembrar/asignar los médicos reales de Bayamón** (hoy la operación en Bayamón no tiene médicos válidos que elegir).
- **BE robustez:** escribir por `/tablero/celda columna=medico` un `medicoId` de **otro centro** devuelve **201 (éxito falso)** y deja `cita.medicoId` sin resolver (proyección `medico=null`). Debe **rechazar (400)** un médico que no pertenece al centro, en vez de fingir éxito.

## 6. VITALES + Enfermería (sub-proyecto, por SSE) — 🟡 MEDIA / GRANDE
- **Modal VITALES**: (a) **notificar** a enfermería que hay paciente para signos vitales/triage; (b) **asignar** la enfermera que tomó los vitales al paciente (registro/estadística). Endpoint `POST /citas/:id/triage` (definir payload) + notificación.
- **Pantalla de enfermería** (reemplazar el server NodeJS/WebSocket por **SSE**): tarjetas por enfermera (color, contador, AUSENTE), secciones **Vitales** + **Intravenoso** (cross-dominio frontdesk/servicios), tap para reclamar → apaga alarma + suma contador + pinta el nombre de la enfermera **bajo VITALES** en la fila del AP-Board.
- **"Estatus de enfermeras"**: botón + badge de conteo + modal; **lista de estatus configurable** (catálogo coloreado: AUSENTE, DÍA LIBRE, HASTA 1PM, Break, Salió, Vacaciones, PEMF, VITALES, VTONE, APEX, NPT, Empower…). ¿por centro? ¿reset diario?
- La condición **"vitales aplicados"** de la guarda de ASISTIDO (§2) sale de aquí.

## 7. WA (WhatsApp) — 🟡 MEDIA
- `POST /notificaciones/enviar` con destinatario = **el MÉDICO** de la cita (su teléfono), avisando que hay pacientes en espera. Definir plantilla/canal. (No es al paciente.)

## 8. PAGO / Facturación — 🟢 BAJA (diferido)
- Columna `pago`: proyección de la factura (**nº factura, modo de pago, usuario, monto**). Origen: facturación.
- Acción "Facturar Consulta" (modal ACCIONES): ruta/flujo de facturación de consulta con **retorno** al AP-Board.

## 9. Catálogos para el builder "simple de configurar" — 🟢 BAJA
Para que los dropdowns del builder sean 100% dato (hoy el FE lista algunos a mano):
- `GET /tablero/catalogos/options-sources` (`medicos, enfermeras, tipos_cita, estados, …`)
- `GET /tablero/catalogos/bindings?entidad=cita` (allowlist)
- `GET /tablero/catalogos/computes` (`esperaMin, duracionMin, …`)

## 9b. Encadenamiento de columnas configurable (`render.group`) — 🟡 MEDIA
El "Flujo de atención" (presente/en_consulta/asistido) son **columnas distintas** que se **encadenan** en una sola visual. El FE lo hace por **config**: columnas con el mismo `render.group` se agrupan (orden/dependencias derivados de transiciones + orden de estados; color del estado destino). Ya sembré `render.group:"flujo"` en las 3 por API.
- **BE: formalizar `group` en el schema de `render`** (Swagger + comentario en DB/Field), exponerlo en MCP (`set_tablero_columna`), spec/plan + TDD, drift-clean (gen:api). Es el mecanismo declarativo del encadenamiento — que sea dato de primera clase, no solo un JSON suelto.

## 10. Nits
- `POST /tablero/celda` **sin** `X-Tenant-ID` → **500** (debería 400/validación).
- Correr **gen:api** tras cada cambio de contrato.

---

## Orden sugerido
**§1 (poner/quitar + reset cascada)** → **§2 (guardas)** → **§3 (proyección)** → §4/§5 (record/médico) → §6 (enfermería) → §7 (WA) → §8/§9 (facturación/catálogos).
