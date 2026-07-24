# Handoff BE — Reversa del flujo del frontdesk (desasistir / deshacer paso)

## Pedido del dueño (2026-07-24)
En el board del frontdesk (p. ej. **laser**), el usuario avanza el flujo
`presente → en_consulta → asistido` con los chips del riel de Flujo. Quiere poder **deshacer** el último
paso sellado — sobre todo **desasistir**, que debe **devolver el consumo al inventario** y **restaurar
las unidades/sesiones del paquete**. Hoy el chip está **deshabilitado y mudo** (ni error ni post).

## Diagnóstico (verificado EN VIVO contra prod, 2026-07-24)
Dogfood real (token master, X-Tenant-ID Bayamón), sobre una sesión de laser:

1. **El avance funciona** vía `POST /tablero/accion` con `{ tablero: "laser", accion: "<render.transition>" }`.
   Las columnas de flujo del board de laser (`GET /frontdesk/tablero?servicio=laser`) declaran:
   - `presente`  → `render.transition = "presente"`, `estampa "llegadaEn"`, `group "grupo_presente"`
   - `en_consulta` → `render.transition = "consulta"`, `estampa "horaInEn"`
   - `asistido` → `render.transition = "atender"`, `estampa "horaOutEn"`, `postAccion "programar_citas"`
   Confirmado: `accion:"presente"` sobre `tablero:"laser"` → **200**, estado pasa a `presente`.

2. **La reversa NO existe para el board de laser.** `POST /tablero/accion` con `tablero:"laser"` devuelve
   `VALIDATION_ERROR` para **todas** las claves de reversa probadas:
   - `desasistir` → `"Acción 'desasistir' no válida para el tablero 'laser'"`
   - `volver_pendiente` → idem
   - `volver_presente` → idem

3. `GET /tablero/definicion?tablero=laser` → **vacío** (sin estados/transiciones). Solo
   `GET /tablero/definicion?tablero=servicios` trae transiciones, y ahí SÍ existen
   `desasistir (asistido→en_terapia)`, `volver_presente (en_terapia→presente)`,
   `volver_pendiente (presente→pendiente)` — **pero con otro vocabulario** (`en_terapia`, no `en_consulta`;
   claves de acción `en_terapia/asistido`, no `consulta/atender`) y el board de laser **no** las acepta.

**Conclusión:** el board por servicio (`tablero=laser`) registra solo transiciones de **avance**. No hay
acción de reversa registrada para él, ni declaración en el render de las columnas de flujo. Por eso el FE
no tiene nada que disparar. **Es competencia del BE.**

## Lo que ya hizo el FE (commit adjunto)
- Se **quitó el hardcode** (`paso.key === "asistido"` + `accion:"desasistir"`) que nunca casaba con el
  vocabulario real de laser (`atender`) → por eso el chip salía siempre deshabilitado y mudo.
- La reversa ahora es **100% data-driven desde el MISMO board**: el chip del último paso sellado lee
  `render.revert` de la columna de flujo (clave de acción para deshacer). Si existe, el chip queda clicable,
  pregunta por toast y dispara `POST /tablero/accion { tablero, entidadId, accion: <render.revert> }`.
  Si el BE no la declara, el sello no muestra afordancia (honesto: no hay reversa).

## Contrato que necesito del BE (para que "desasistir" funcione, sin tocar más FE)
1. **Registrar acciones de reversa** para los boards por servicio (`laser`, y las demás verticales de
   servicio), aceptadas por `POST /tablero/accion` con `tablero:"<servicio>"`. Mínimo: deshacer el último
   sello. Sugerencia de claves simétricas a las de avance (o una genérica `revertir`), a tu criterio —
   el FE es agnóstico a la clave.
2. **Efectos de la reversa de `atender`/asistido (crítico — decisión del dueño 2026-07-24):** la reversa
   debe **RESETEAR la sesión por completo**, dejando SOLO el paciente:
   - **Borrar en blanco TODOS los campos/sellos del flujo**: `llegadaEn`, `horaInEn`, `horaOutEn`
     (presente, en_consulta/en_terapia, asistido) y las mediciones/datos capturados (`datos.aplicadas`,
     áreas, dosis/`productoAplicadoId`, técnico/enfermera, etc.). Quitar **hasta el sello de `presente`**.
   - **Estado final = `pendiente`** (como recién agendada). Solo se conserva el paciente (y la fecha/servicio
     de la cita).
   - **Devolver el consumo al inventario** y **restaurar unidades/sesiones del paquete**
     (`disponibilidad` del paciente vuelve a subir).
   - Auditable (actor + motivo), igual que `reparar`.
   En una palabra: desasistir = "como si nunca hubiera llegado", conservando solo la cita del paciente.
3. **Declarar la reversa en el render de la columna de flujo** para que el FE la enchufe solo:
   ```jsonc
   // en GET /frontdesk/tablero → columnas[].render de la columna de flujo:
   { "transition": "atender", "estampa": "horaOutEn", "group": "grupo_presente",
     "postAccion": "programar_citas",
     "revert": "desatender" }   // ← NUEVO: clave de acción que POST /tablero/accion acepta para deshacer
   ```
   Con `render.revert` presente y la acción aceptada por el motor, el chip se habilita automáticamente
   (cero cambios de FE). Sin `render.revert`, queda como sello no reversible.
4. **Reglas:** solo el ÚLTIMO paso sellado es reversible (uno a la vez). Respetar RBAC
   (¿`frontdesk.reparar` o permiso propio de reversa?).

## Nota de FE
El FE ya envía `POST /tablero/accion { tablero: "<servicio>", entidadId, accion }`. En cuanto el motor
acepte la acción de reversa y el board la declare en `render.revert`, funciona sin más cambios.
Mientras tanto, el chip del último paso queda como sello (sin acción), no como botón muerto.
