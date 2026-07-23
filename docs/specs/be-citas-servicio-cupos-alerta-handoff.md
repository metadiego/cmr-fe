# Handoff BE — Alerta NO bloqueante de cupos al agendar citas de servicio (/citas)

> **Fecha:** 2026-07-23 · **Origen:** FE cmr-fe (/citas → pestaña Servicios) · **Destino:** cmr-be
> **Status:** SOLICITADO. Decisión del dueño: **la regla de cupos es trabajo del BACKEND**; el FE
> solo agrega la cita y muestra la alerta que el BE devuelva.

## 1. Requerimiento (dueño)

La pantalla /citas (Servicios) es **solo para agregar citas de servicio**. Debe **respetar los
cupos/slots y horarios** para no dar más citas de lo establecido, pero **NO de forma bloqueante**:
si se excede lo establecido, se **permite agendar igual** y se **alerta**.

## 2. Quién hace qué

- **BE (esta tarea):** dueño de la regla. Al crear la sesión de servicio decide si excede los cupos
  establecidos y devuelve un **warning no bloqueante** (la creación SÍ se realiza).
- **FE (ya listo / mínimo):** agrega la cita vía `POST /frontdesk/sesiones` y, si la respuesta trae
  warning(s), los muestra como alerta (toast/aviso). No implementa la regla de cupos en el cliente
  (sería hardcode/duplicar lógica de negocio).

## 3. Contrato pedido

Al `POST /api/v1/frontdesk/sesiones` (crear sesión de servicio):
- Validar cupos/horarios para (servicio × fecha × centro) reusando la MISMA lógica que ya alimenta
  `GET /frontdesk/agenda` (`AgendaHora {hora, cupo, agendadas, vacios}`, precedencia
  `fecha > diaSemana > default`, `centro > global`).
- Si al agendar se **supera** lo establecido (p. ej. Σ agendadas ≥ Σ cupo del día, o la franja/So
  horario elegido sin vacíos), **NO** rechazar: crear la sesión y devolver un warning.
- Respuesta sugerida (envelope estándar `{ data, meta }`):
  ```jsonc
  {
    "data": { /* SesiónEntity creada */ },
    "meta": {
      "warnings": [
        { "code": "cupo_excedido", "message": "Se superó el cupo del día (agendadas 12 / cupo 10).",
          "cupo": 10, "agendadas": 12, "fecha": "2026-07-24", "servicioId": "…" }
      ]
    }
  }
  ```
  (o un campo `warning`/`aviso` en `data`; lo importante: **no bloquear** y que el FE pueda leerlo.)
- Swagger tipado del warning; MCP equivalente si la tool crea sesiones.

## 4. Criterios de aceptación

1. Agendar dentro del cupo → 201 sin warnings.
2. Agendar excediendo el cupo → **201 igual** (sesión creada) + `meta.warnings[0].code = "cupo_excedido"`
   con el detalle (cupo vs agendadas).
3. Sin cupos/horario configurados para esa fecha → warning informativo (p. ej. `sin_cupo_configurado`),
   tampoco bloquea.
4. Multi-tenant/centro y precedencia de cupos respetadas (reusa la lógica de `/frontdesk/agenda`).

## 5. FE — qué hará al recibir el contrato

- Leer `meta.warnings` de la respuesta de crear y mostrarlos como alerta no bloqueante (toast) en el
  modal de "Nueva sesión de servicio" (`components/agenda/sesion-modal.tsx`). Cero regla de cupos en
  el cliente. Avisar al FE cuando esté desplegado para conectar el aviso.
