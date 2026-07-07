# Handoff BE — AP-Dash: lo que falta (2ª ola) + capacidades del motor

**Fecha:** 2026-07-07 · **De:** FE (cmr-fe) · **Para:** BE (cmr-be)
---

## 🎯 LO QUE NECESITO PARA AVANZAR (AP-Board base) — prioridad #1

Tras simplificar con el usuario (MEDICO = solo select ✅ ya funciona; facturación y enfermería = fases
posteriores), el **camino crítico** para que el AP-Board cobre vida es:

**1. Proyección `/tablero/filas?tablero=atencion` — exponer campos (BLOQUEA casi todo):**
`pacienteId`, `llegadaEn`, `horaInEn`, `horaOutEn`, `tipoConsulta`, `proxCita` + **allowlist de bindings** para crear columnas atadas a ellos.

**2. Toggle-hora ligado a transición (chips PRESENTE/EN CONSULTA/ASISTIDO):**
- `render` que enlaza la columna toggle con su transición + su hora, ej. `render = { transition:"presente", estampa:"llegadaEn" }`. **Confirmar shape.**
- Guardas: `consulta` → `desdeEstados:[presente]` (hoy permite programada/confirmada); `atender` → `desdeEstados:[en_consulta]` (hoy permite presente/triage). `consulta` ya pide `medicoId` ✓.

**3. RECORD consecutivo:** binding `record`=`paciente.numeroHistoria` + `pacienteId` en proyección (#1) para `POST /pacientes/:id/asignar-record` (vacío→consecutivo por centro); edición manual `PUT /pacientes/:id {numeroHistoria}`.

**4. WA (chico):** `POST /notificaciones/enviar` con destinatario = **el MÉDICO** de la cita (no el paciente). Confirmar payload (medicoId / canal / plantilla).

**5. Nit (no bloquea):** `/tablero/celda` sin `X-Tenant-ID` → 500 (debería ser 400).

**Diferido (NO lo necesito ahora):** PAGO + "Facturar Consulta" (facturación); sub-proyecto **Enfermería** (pantalla vitales* + asignación por paciente + estatus de enfermeras, por SSE); fondo de board por usuario (F).

**MEDICO:** ✅ nada pendiente (select + `writeBinding:cita.medicoId` ya escribe). Regla futura opcional: fijar médico *default* del paciente = regla BE detrás del mismo select, sin cambio FE.

**Prioridad:** #1 desbloquea RECORD/CONSULTA/PROX-CITA · #2 desbloquea los 3 toggles (el corazón) · #3 record · #4 WA.

---

**Contexto:** el motor de tableros ya funciona (select con `writeBinding`, toggle, color por columna,
transiciones con `estampa`, personalización base). Para **completar el AP-Dash como el mockup** y
habilitar tableros nuevos (ej. "gestion") **a punta de config**, BE necesita preparar lo siguiente.
El FE avanza en paralelo con lo que NO depende de esto.

---

## A. Proyección de filas — exponer los campos que faltan
Hoy `GET /tablero/filas?tablero=atencion` devuelve: `hora, paciente, estado, primeraVez, medico, enfermera, canal, motivo, acciones`. Faltan (para las columnas del AP-Dash):
- **`pacienteId`** (uuid) — para el record consecutivo y acciones sobre el paciente.
- **`llegadaEn`, `horaInEn`, `horaOutEn`** (las horas selladas por las transiciones) — para pintar los chips Presente / En consulta / Asistido con su hora.
- **`proxCita`** (fecha de la próxima cita).
- **`tipoConsulta`** (columna "Consulta"; si es select → fuente `tipos_cita`).
- **`pago`** — definir origen: ¿campo de cita o proyección de facturación? En el legacy es texto ("EXONERADA", "038082 LM ATH $20.00").
- **`telefono`** del paciente — para la acción WhatsApp.
- **Allowlist de bindings** para poder crear columnas atadas a estos campos (hoy `motivo` da "no editable"; confirmar cuáles son escribibles).

## B. Columnas `derivado` (computadas server-side por config)
Aquí viven los "if/else/aritmética simples". Necesitamos columnas de solo-lectura calculadas por BE:
- `esperaMin` = `horaInEn − llegadaEn` (minutos en sala).
- `duracionMin` = `horaOutEn − horaInEn`.
- (futuro: `edad` desde nacimiento, `saldo` = suma, etc.)

**Pregunta clave:** ¿cómo se declara una columna `derivado` por config? Propuesta: `render = { compute: "esperaMin" }` contra un catálogo de cómputos server-side, o `render = { formula: "..." }`. Definir el mecanismo — es lo que hace "columna calculada nueva = config, no código".

## C. Toggle-hora ligado a transición (chips Presente / En consulta / Asistido)
El FE construye el widget (chip con hora + click). Del BE necesita:
- Las horas selladas en la proyección (A).
- Un `render` que **enlace** la columna toggle con su transición y su campo de hora, ej. `render = { transition: "presente", estampa: "llegadaEn" }`. Así el chip sabe qué `POST /tablero/accion` disparar y qué hora mostrar. **Confirmar el shape.**
- Confirmar que `requierePrevios` (ya existe) hace cumplir el orden (no "asistido" sin "presente").

## D. Acciones configurables (VITALES / WA / expediente)
Columna `accion` que declare qué hace por config: `render = { action: "vitales" | "whatsapp" | "expediente" }`.
- **Vitales** = `POST /citas/:id/triage` → payload exacto (¿enfermeraId? ¿abre formulario FE y luego postea?).
- **WhatsApp** = `POST /notificaciones/enviar` → destinatario (¿`telefono` del paciente, ver A?), plantilla/mensaje, canal. ¿O link `wa.me`?
- RBAC de cada acción.

## E. Record consecutivo — cerrar el flujo
- Confirmar binding de la columna `record` (¿`paciente.numeroHistoria`?).
- Proyección expone `pacienteId` (A) para `POST /pacientes/:id/asignar-record` (vacío → consecutivo por centro).
- Edición manual = `PUT /pacientes/:id { numeroHistoria }`. RBAC `pacientes.update`.

## F. Personalización a nivel tablero (fondo del board por usuario)
- Confirmado: `POST /tablero/personalizar` render `{color, background}` por columna.
- Falta: **fondo general del board por usuario** — ¿endpoint / shape? (se mencionó "por preferences"). Definir para el "tu espacio" del mockup.

## H. Catálogos para el builder "simple de configurar" (para que los dropdowns sean 100% dato)
El editor de columnas del builder debe ofrecer dropdowns **poblados por BE**, no listas escritas en el FE:
- **`GET /tablero/catalogos/options-sources`** → fuentes válidas (`medicos, enfermeras, tipos_cita, estados, …`). Hoy el FE las lista a mano (stopgap); esto lo vuelve dato.
- **`GET /tablero/catalogos/bindings?entidad=cita`** → allowlist de bindings escribibles/legibles por entidad.
- **`GET /tablero/catalogos/computes`** → cómputos `derivado` soportados (`esperaMin, duracionMin, …`).
- (Transiciones ya vienen en `/tablero/definicion` ✅.)
Con esto, agregar una fuente/cómputo nuevo = dato, sin tocar FE.

## G. Nit de robustez
- `POST /tablero/celda` **sin** `X-Tenant-ID` → **500** (debería ser 400/validación). Repro requestId `a1e11707-…`.

---

## Aceptación
Con A–F: el **AP-Dash se arma 100% por config** (columna nueva = fila de catálogo + `render` + composición), y un tablero nuevo **"gestion"** con columnas nuevas (select / toggle / check / derivado / accion) se levanta **sin código FE nuevo** — salvo un *primitivo de widget genuinamente nuevo*, que se agrega **una sola vez** al renderer y luego es config para siempre.

## Prioridad sugerida
1. **A** (proyección) + **E** (record) → desbloquea la mayoría de columnas visibles.
2. **C** (toggle-hora render config) → el corazón del flujo.
3. **B** (derivado) → esperaMin/duracionMin (métricas del mockup).
4. **D** (acciones) + **F** (fondo) → completan la experiencia.
