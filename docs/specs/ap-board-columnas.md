# Spec — Columnas del AP-Board (tablero `atencion`)

**Fecha:** 2026-07-07 · **Dominio:** Atención al Paciente (AP-Board) · **Autor:** FE

## Objetivo
El AP-Board es **100% config-driven**. Cada columna = `tipo` + `render` (config en la DB). El FE es
**genérico**: renderiza por `tipo`/`render`, nunca por listas/acciones/colores escritos en código.
Regla de oro: **agregar o cambiar una columna/acción = configuración, no código.** Y la configuración
debe ser **simple** (controles amables en el builder, no JSON crudo).

## Reglas inmutables aplicadas (FE)
API-First · Swagger types (`gen:api`) · **configurable / sin hardcode** · multi-tenant (`X-Tenant-ID` en
escrituras) · RBAC (permiso por columna/acción, gateado con `useCan`) · spec/plan (este doc) · i18n
(claves inglés + fallback humanizado) · drift-clean · sin secretos · **solo BE lo hace BE** (handoff+stop).

## Contrato de columna (recordatorio)
`ColumnaEntity`: `clave, labelKey, tipo(accion|fecha|hora|texto|select|toggle|badge|derivado), binding,
editable, render(JSON), permiso, color, ambitos`. Proyección de fila = valor por `clave`.
`render` por tipo:
- **select**: `{ optionsSource, writeBinding? }` — opciones vía `GET /tablero/opciones?columna=<clave>`.
- **toggle (con hora)**: `{ transition, estampa }` — click ejecuta la transición; muestra la hora sellada.
- **accion**: `{ actions: [{ key, labelKey, icon, kind: "link"|"soon", href?, permiso? }] }`.
- **derivado**: `{ compute }` — lo calcula el **BE** (FE solo muestra).

## Columnas del AP-Board
| Columna | tipo | render / binding | Comportamiento | FE | BE | Estado |
|---|---|---|---|---|---|---|
| **record** | texto (editable) | `paciente.record` | muestra/edita nº; vacío→genera consecutivo por centro | celda editable + acción "generar" | `asignar-record` ✅, `editable`+`PUT paciente` | ✅ dato / ⏳ editar |
| **paciente** | texto | `paciente.nombre` | nombre | ✅ | — | ✅ |
| **medico** | select | `{optionsSource:medicos, writeBinding:cita.medicoId}` | asigna/cambia médico de la cita | ✅ select | ✅ | ✅ |
| **consulta** | texto/select | `cita.tipoConsulta` | tipo (nueva/seguimiento, crece) | render texto/select | exponer `tipoConsulta` | ⏳ opcional |
| **prox_cita** | fecha | `cita.proxCita` | fecha próxima cita | render fecha | exponer `proxCita` | ⏳ opcional |
| **pago** | texto/badge | (facturación) | nº factura/modo/usuario/monto | render | proyección de factura | ⏸ diferido |
| **presente** | toggle | `{transition:presente, estampa:llegadaEn}` | sella llegada; ordena por hora | ✅ chip | ✅ | ✅ |
| **en_consulta** | toggle | `{transition:consulta, estampa:horaInEn}` | exige presente + médico | ✅ chip | ✅ (ajustar `desdeEstados:[presente]`) | ✅ / ⏳ guarda |
| **asistido** | toggle | `{transition:atender, estampa:horaOutEn}` | exige en_consulta | ✅ chip | ✅ (ajustar `desdeEstados:[en_consulta]`) | ✅ / ⏳ guarda |
| **espera_min** | derivado | `computed.esperaMin` | minutos en sala | ✅ muestra | ✅ | ✅ |
| **duracion_min** | derivado | `computed.duracionMin` | duración consulta | ✅ muestra | ✅ | ✅ |
| **vitales** | accion | `{action:vitales}` | modal: Notificar enfermería + asignar enfermera | modal + grid enfermeras | triage/notif + asignación | ⏳ FE listo-parcial / BE |
| **wa** | accion | `{action:whatsapp}` | notifica al **médico** por WhatsApp | botón | `POST /notificaciones/enviar` (médico) | ⏸ BE |
| **acciones** | accion | `{actions:[editar_paciente(link), facturar(soon)…]}` | modal de atajos configurable | ✅ modal (dato) | facturación (item) | ✅ base |

## "Simple de configurar" (builder)
En `/configuracion/tableros/atencion` → tab **Columnas**, cada columna se configura con **controles amables**
(no JSON):
- `tipo` (select) · `binding` (select desde allowlist del BE) · `editable` (toggle) · `color` (swatch) · `permiso` (select).
- **Config por tipo** (aparece según `tipo`):
  - **select** → `optionsSource` (dropdown: medicos/enfermeras/tipos_cita/estados) + `writeBinding`.
  - **toggle** → `transition` (dropdown de transiciones del tablero) + `estampa` (dropdown de campos).
  - **accion** → **editor de lista de acciones** (key/label/icono/kind/href/permiso) con add/quitar/ordenar.
  - **derivado** → `compute` (dropdown de cómputos del BE).
El FE escribe la config con `PUT /tablero/columnas/:id { render }` (o composición). Cero JSON a mano.

## RBAC
- **Configurar** columnas (builder) = `tablero.admin`. **Operar** = permiso del tablero (`atencion.read`, `citas.update`).
- Cada columna/acción puede declarar `permiso`; el FE lo gatea con `useCan` (cosmético) y el BE enforza.

## Multi-tenant
Toda escritura (celda, accion, personalizar, asignar-record) lleva `X-Tenant-ID` del centro. El master ve
todos los centros con el selector; la cita pertenece a un centro (Bayamón / Caguas).

## Verificación (real, sustituye TDD)
Por columna: `typecheck` + `lint` verdes **y** ejercer el flujo real contra el API (crear/editar/accionar).
"verde" ≠ "funciona". Datos de prueba: pacientes MARCOS (Bayamón), LUZ (Caguas) con cita hoy + 2 visitas.

## FE vs BE (resumen)
- **FE (yo):** renderers por tipo (chips ✅, select ✅, modal-acciones ✅, derivado ✅), **builder config UI** (pendiente — el "simple de configurar"), modal de VITALES (UI), personalización en Settings ✅.
- **BE:** proyección ✅, consecutivo ✅, derivados ✅, guardas de transición (ajustar), triage/notificaciones (vitales/WA), facturación (pago). → handoff `docs/specs/ap-dash-siguiente-handoff-be.md`.
