# HANDOFF BACKEND — Agendar con HORA (guardar hora + descontar cupo, NO bloqueante)

> Para cmr-be. Normas: API-First · Swagger/MCP (`gen:api`) · configurable · multi-tenant · RBAC ·
> comentarios DB/campos · TDD · drift-clean · i18n · sin hardcode · NUNCA asumir. El FE no toca BE.

## Qué quiere el dueño (verbatim)
"Guardar la hora y descontar el slot/cupo" al agendar una cita de servicio, **híbrido**: el usuario hace
clic en una hora (opcional) y se guarda; el cupo de esa hora se **descuenta**; pero **NO es bloqueante**
—si la hora está llena, avisa (warning) y **deja pasar**—. Ver mensajes 2026-07-24.

## Estado verificado (no asumido)
- `frontdesk_sesiones` **YA tiene** columna `hora text NULL` ("HH:mm", "casa con el cupo por hora del
  servicio"). NO hace falta migración de columna.
- Pero `CreateSesionDto` y `AgendarMultipleDto` **NO exponen `hora`** (verificado en schema/docs-json).
  Con `forbidNonWhitelisted: true` (src/main.ts), si el FE manda `hora` hoy → **400**. Por eso el FE
  está BLOQUEADO hasta este cambio.
- La vista-día ya calcula cupos por hora (`GET /frontdesk/agenda`, `AgendaHora {hora, cupo, vacios}`),
  y el modal FE ya los muestra (informativo). Falta que la sesión creada CON hora reste de `vacios`.

## Cambios BE pedidos
1. **Aceptar `hora?` (opcional, "HH:mm")** en `CreateSesionDto` y `AgendarMultipleDto`
   (para agendar-multiple, aplica la misma hora a todas las fechas, o acepta `hora?` por ahora simple).
   Validar formato ("HH:mm") si viene; null/ausente = sin hora (comportamiento actual).
2. **Persistir** `hora` en `frontdesk_sesiones.hora` al crear (`crearSesion`/`agendarMultiple`).
3. **Descontar cupo**: que el conteo de `vacios` por hora (vista-día `AgendaHora`) cuente las
   `frontdesk_sesiones` con esa `hora` (además de las citas). Al agendar con hora, esa franja baja 1.
4. **NO bloquear**: si `vacios <= 0` para esa hora, crear igual y devolver **warning** en `meta.warnings`
   (mismo mecanismo actual de cupo excedido). Nunca 4xx por cupo.
5. `gen:api` tras el cambio (el FE regenera tipos y enciende el clic de hora + envío de `hora`).

## Contrato que el FE encenderá al recibir esto
- El modal "Programar citas" hará los chips de "CUPOS POR HORA" **clicables**: al elegir una, se manda
  `hora` en el payload de crear/agendar; el cupo de esa hora se ve bajar; sin elegir hora, agenda por día
  como hoy. Los warnings de cupo se muestran con el toast existente (no bloquea).

## Test (TDD)
- crear con `hora="08:00"` → sesión.hora="08:00" y `vacios` de 08:00 baja 1.
- crear con hora en franja llena → se crea + `meta.warnings` incluye cupo excedido (no 400).
- crear sin hora → igual que hoy (hora null, no toca cupos por hora).
- agendar-multiple con hora → todas las fechas quedan con esa hora.
