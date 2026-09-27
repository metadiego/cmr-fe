# Handoff BE — sincronización EN REVERSA hacia Google Sheets (agendar desde nuestro módulo)

**Origen**: pedido de gerencia (2026-09-27), transmitido por el dueño. Solo confirmación de
entendimiento e investigación por ahora — **nada de esto está construido, ni del lado FE ni BE**.

## Lo que ya existe (verificado leyendo el código, no supuesto)

El puente `scheduling-bridge` (`lib/api/scheduling-bridge.ts`, pantalla
`/configuration/scheduling-bridge`, spec completa en `docs/specs/scheduling-bridge-handoff-fe.md`)
sincroniza hoy en **UN SOLO SENTIDO**: Google Sheets → nuestras citas. Solo citas **médicas**
(consultas); el propio handoff FE ya lo advertía explícitamente el 2026-09-21:

> LASER/IV/OTRA quedan fuera a propósito (fase futura).

Esa "fase futura" es ahora — anoche se construyó el planificador de terapias en serie
(`lib/agenda/recurring-plan.ts`, `components/agenda/recurring-booking-modal.tsx`, PRs #74/#77/#78
en `cmr-fe`), que agenda Láser/otras terapias por lotes usando
`POST /frontdesk/sesiones/agendar-multiple`. Ese es exactamente el módulo donde gerencia pide que
la sincronización empiece a correr también en reversa.

## Lo que pide gerencia (parafraseado, verificado contra el código donde fue posible)

1. **Antes de agendar desde nuestro módulo**, comparar disponibilidad contra el motor de Sheets
   (gerencia dice que ya existe un endpoint para consultarla — el dueño no está 100% seguro de los
   detalles, p. ej. si Sheets calcula por color o por otro método para Láser según número de áreas;
   **esto hay que confirmarlo con quien mantiene esa hoja/script, no asumir**).
2. **Si ambos motores coinciden en que hay cupo**, escribir en LAS DOS plataformas: nuestra sesión
   (ya existe) + una fila/bloqueo en la hoja de Sheets, para que el sync de Sheets→nosotros no
   intente crear la misma cita otra vez cuando corra (evitar colisión/duplicado).
3. **Dos identidades distintas por cada fila escrita**, no una:
   - **"Dueño" de la cita** — la identidad de call-center-citas que debe aparecer en Sheets (el
     mismo rol/código que ya usa `agentMapping.externalCode`, que hoy resuelve la comisión de
     captación de paciente nuevo cuando la sincronización va en el sentido normal). Gerencia lo
     describe como "siempre personal de call center citas".
   - **"Quién estaba trabajando/logueado"** — la persona real que hizo el agendamiento en ese
     momento, que puede ser alguien distinto del "dueño" (alguien con acceso a ese dominio
     ayudando, no necesariamente su rol fijo). Este campo **ya existe en nuestro sistema** para
     citas médicas: `bookedByStaffId` (ver `components/agenda/cita-modal.tsx:82,196`, resuelto de
     `useMe().staffId`) y `actorId` en varios DTOs de `frontdesk` y `citas`. **No hay que inventar
     el patrón, hay que extenderlo** a lo que se escriba en Sheets.
4. **Configurable + interruptor ON/OFF por centro**, mismo patrón que ya tiene
   `scheduling-bridge.config` (`enabled`, ya existe). Motivo explícito de gerencia: Sheets manda
   hoy, pero se dejará de usar en un futuro cercano, y la transición a apagar esto debe ser
   simple, no traumática — el interruptor ya es el mecanismo correcto, solo hace falta uno nuevo
   (o reusar el mismo) para la dirección reversa.

## Hallazgo concreto al revisar "qué hicimos recientemente que haga falta pasar a API" (pedido explícito del dueño)

Comparando el DTO real (`AgendarMultipleDto` en `lib/api/schema.d.ts`) contra lo que el FE
manda hoy en `components/agenda/recurring-booking-modal.tsx`:

- `AgendarMultipleDto` **acepta `actorId?: string`** — ya soportado por el BE.
- El FE del planificador en serie (anoche) **nunca lo manda**: `agendarMultiple({ patientId,
  serviceId, fechas, time }, centro)` — sin `actorId`. Comparado con `cita-modal.tsx`, que sí
  resuelve y manda `bookedByStaffId` desde `useMe().staffId`.
- **Esto es un fix FE, no BE** — pendiente de que el dueño confirme para aplicarlo (no se tocó
  código de negocio antes de esta confirmación, por instrucción explícita). Una vez confirmado:
  mandar `actorId: me.staffId` igual que `cita-modal.tsx`.

- **Gap de documentación separado, para BE**: `POST /frontdesk/sessions/book-multiple` (el
  endpoint que usa el flujo de una-sola-fecha con varios servicios, "Schedule and keep
  going"/"Schedule and close") **no aparece en absoluto en el schema OpenAPI tipado**
  (`lib/api/schema.d.ts`) — confirmado con `grep`, cero resultados. Ya estaba anotado en
  `docs/specs/api-v2-huecos-handoff-be.md` (`servicioIds`/`fechas` en español, fuera del mapa
  inglés), pero el hueco es más amplio: sin schema, el FE no puede saber si soporta `actorId` (o
  cualquier otro campo) sin adivinar o probar en caliente contra producción. Pedido: que este
  endpoint entre al Swagger/OpenAPI generado, como el resto — API-First real, no solo de nombre.

## Lo que se necesita del BE antes de que el FE pueda construir nada de esto

1. Confirmar con quien mantiene el script/hoja de Sheets: qué endpoint (si existe) expone su
   cálculo de disponibilidad, y su forma exacta (¿por color? ¿por número de áreas como Láser
   calcula aquí?) — **no asumir, documentar la fuente**.
2. Diseñar el endpoint/mecanismo de escritura hacia Sheets (nuevo, del lado BE — el FE no escribe
   directo a Google Sheets bajo ninguna circunstancia, por API-First y por seguridad: sin
   credenciales de Sheets en el cliente).
3. Definir dónde vive el mapeo "dueño de la cita" → código externo de 2 letras para el caso
   reversa (¿reusa `agentMapping` tal cual, o necesita una fila fija/configurable por centro
   representando "call center citas" como remitente?).
4. El interruptor ON/OFF de la dirección reversa: ¿campo nuevo en `scheduling-bridge.config`
   (p. ej. `reverseSyncEnabled`) o tabla separada? Debe seguir el mismo patrón `?centerIds=` y
   permisos (`scheduling-bridge.config`) que el resto del módulo.
5. MCP: el resto de `scheduling-bridge` ya tiene su puerta MCP paralela (mismos nombres en
   inglés, mismos permisos — ver la lista en `docs/specs/scheduling-bridge-handoff-fe.md`). Lo
   nuevo debe nacer con la suya desde el día uno, no agregarse después.

## Estatutos aplicables (recordatorio del dueño, verificado contra el módulo existente)

API-First + MCP + Swagger + configurable + multi-tenant + RBAC + comentarios en DB/campos en
inglés + spec/plan + TDD + drift-clean + i18n + centerIds opcional en cada endpoint. El módulo
`scheduling-bridge` YA cumple la mayoría de esto (confirmado leyendo su código: permisos
`scheduling-bridge.read/config/run`, `?centerIds=`, MCP paralelo, `enabled` por centro) — la
sincronización reversa debe seguir exactamente el mismo molde, no uno nuevo.
