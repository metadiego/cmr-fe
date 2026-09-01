# Handoff FE — El botón ASISTIDO bloqueado por campos requeridos debe AVISAR (toast), no morir en silencio

> **Fecha:** 2026-07-23 · **Origen:** BE (diagnóstico verificado en prod) · **Destino:** FE cmr-fe
> **Status:** SOLICITADO · **Prioridad:** alta (el dueño lo percibió como "asistido perdió su funcionalidad").

## 1. Diagnóstico (verificado, no asumido)

- La validación nueva del flujo funciona: BE #164 exige los campos `requerido` de `servicio.formAcciones`
  para asistir (láser: campo `aplicadas`, en=asistido, requerido=true — verificado en prod), y
  `marcarAsistido` lanza 400 si faltan. El FE ya calcula `faltantesPara(estado)` con ese mismo schema.
- **El defecto es de UX**: cuando `faltan.length > 0`, el botón del paso se pinta `disabled` + `ghost`
  (opacity 40) — SIN mensaje. Un botón deshabilitado no dispara clicks ni muestra bien el `title` →
  parece roto. Caso real: sesión de láser con `datos = null` → asistido "muerto" sin explicación.

## 2. Lo requerido (aprobado por el dueño)

En `components/frontdesk/frontdesk-board.tsx` (render de pasos del flujo, ~línea 860):
1. Si el paso está bloqueado **solo por campos requeridos** (`previo && !hecho && faltan.length > 0`):
   el botón queda **clicable** (mantener el estilo atenuado) y al click muestra
   `toast.warning(t("frontdesk.faltanCampos", { campos: faltan.join(", ") }))` — SIN disparar la acción.
2. Mantener `disabled` real solo para `busy` o cuando el paso previo no está sellado (orden del flujo).
3. El tooltip `title` con `faltanCampos` ya existe — conservarlo.
4. i18n: la clave `frontdesk.faltanCampos` YA existe en messages es/en (línea ~1020). Cero hardcode.

## 3. Criterios de aceptación

1. Láser, sesión sin `aplicadas`: click en ASISTIDO → toast "Falta completar: APLICADAS"; NO asiste.
2. Capturar `aplicadas` en la fila → el botón asiste normal (y el postAccion de programar citas sigue).
3. Flujo fuera de orden (sin en_terapia) → botón deshabilitado como hoy.
4. typecheck/lint/build verdes; tokens-only; sin reglas de negocio nuevas en el cliente (el BE sigue
   siendo la autoridad con su 400).
