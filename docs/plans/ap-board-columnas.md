# Plan — Columnas del AP-Board (config-driven)

**Spec:** `docs/specs/ap-board-columnas.md` · **Handoff BE:** `docs/specs/ap-dash-siguiente-handoff-be.md`
**Regla:** cada fase = configurable/sin hardcode · i18n · RBAC · multi-tenant · verificación real. Lo BE = handoff+stop.

## Estado base (ya en `main`, verificado)
- Motor genérico + AP-Board compuesto: hora · record · paciente · médico · estado · presente · en consulta · asistido · espera · duración · acciones.
- Médico select ✅ · chips toggle-hora ✅ · derivados ✅ · record (dato) ✅ · modal acciones (dato) ✅ · personalización en Settings ✅.

## Fase 1 — Builder "simple de configurar" (FE, sin BE) ← PRÓXIMA
Objetivo: que un admin configure **cada columna** desde `/configuracion/tableros/atencion` → Columnas, con
controles amables (no JSON). Entregables:
1. Panel de edición por columna: `tipo`, `binding` (allowlist), `editable`, `color`, `permiso`.
2. **Config por tipo** (render): select(optionsSource+writeBinding) · toggle(transition+estampa) · derivado(compute) · **accion(editor de lista de acciones)**.
3. Persistir con `PUT /tablero/columnas/:id { render }`. Verificación real: editar en UI → recargar `/tablero/atencion` → cambio reflejado.
- **Dependencias BE (para dropdowns, no bloquean el esqueleto):** catálogo de `optionsSource`, de `binding` allowlist, de `compute`, lista de transiciones (ya viene en definicion). Lo que falte → handoff.

## Fase 2 — VITALES (FE modal ahora; BE después)
- FE: columna `vitales` (accion `{action:vitales}`) → modal "Alerta de Vitales" (nombre+record, botón Notificar, grid de enfermeras desde `optionsSource:enfermeras`). UI construible ya.
- BE (handoff): `POST /citas/:id/triage` (payload), notificación a enfermería, asignación de enfermera. **No lo implemento en FE.**
- Al llegar BE: mostrar bajo el botón el nombre de la enfermera asignada (en la fila).

## Fase 3 — Guardas + columnas opcionales (BE + FE config)
- BE: `consulta.desdeEstados:[presente]`, `atender.desdeEstados:[en_consulta]`.
- FE: componer `consulta`/`prox_cita` si se quieren (opcionales); exponer `tipoConsulta`/`proxCita` = BE.

## Fase 4 — RECORD editable (BE + FE)
- BE: `record.editable=true` + `PUT /pacientes/:id {numeroHistoria}` (edición manual) + confirmar binding.
- FE: celda editable con doble-clic; vacío → acción "generar" (`asignar-record`, ya funciona).

## Fase 5 — Sub-proyecto Enfermería (pantalla vitales* por SSE)
- Rehacer `cma/vistas/vitales` en el stack nuevo: tarjetas por enfermera (color, contador, AUSENTE),
  secciones Vitales + Intravenoso (cross-dominio), tap para reclamar → apaga alarma + suma + pinta enfermera en AP-Board.
- **Estatus de enfermeras** (botón + badge + modal, lista de estatus **configurable** coloreada).
- Realtime por **SSE** (retirar NodeJS/WebSocket). BE: eventos + endpoints. Fase mayor, propia.

## Fase 6 — Facturación / PAGO (diferido)
- BE: proyección de factura (nº/modo/usuario/monto) para columna `pago`; ruta `/facturacion` + acción "Facturar Consulta".

## Orden sugerido
**Fase 1 (builder simple)** → Fase 2 (vitales modal) → Fase 3 (guardas/opcionales) → Fase 4 (record editable) → Fase 5 (enfermería) → Fase 6 (facturación).
