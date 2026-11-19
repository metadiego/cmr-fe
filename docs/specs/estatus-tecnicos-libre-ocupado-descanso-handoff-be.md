# Handoff FE → BE — Estatus de técnicos: libre / en terapia / descanso (con auto-expiración)

**Pedido del dueño, 06-nov-2026**, a continuación del botón de icono "Enfermería" (ver
`components/frontdesk/nurse-status-button.tsx`, PR del mismo día): agregar un botón equivalente, SOLO
ícono + tooltip, para **técnicos**, con tres estados:

1. **En terapia (ocupado)** — YA existe, se deriva en vivo de `GET /frontdesk/queue`
   (`lib/api/frontdesk-queue.ts`, `onShift[].load`/`available`): no hace falta nada nuevo para esto.
2. **Libre** — también ya se deriva de la misma cola (`free: QueueFreeStaff[]`).
3. **Descanso** — **NUEVO**, no existe hoy. Un técnico se marca manualmente "en descanso" por
   **N minutos**, y pasado ese tiempo vuelve solo a verse como libre/ocupado según la cola real — sin
   que nadie tenga que ir a quitarle el estatus a mano.

## Por qué no alcanza con reusar `nurse-status` tal cual

El sistema de estatus de enfermera (`GET/POST /frontdesk/nurse-status/...`,
`setNurseStatus`/`getNurseStatusActuales`) es manual puro: se pone y se quita a mano, SIN expiración.
El pedido de hoy necesita que el estatus **caduque solo** pasados los minutos indicados — eso no existe
en ese endpoint ni en su esquema.

## Lo que se pide

1. Un mecanismo de estatus para TÉCNICOS (nueva tabla/endpoint análogo a `nurse_status_tipos` +
   `nurse-status`, o generalizar el existente con un `capacidad`/`role` — decisión de BE) que acepte,
   al ponerlo, una **duración en minutos** opcional (`durationMinutes` o `expiresAt` calculado al
   guardar).
2. Al leer el estatus actual (`GET .../actuales` equivalente), filtrar fuera cualquier fila cuyo
   `expiresAt` ya pasó — así el FE nunca tiene que calcular caducidad por su cuenta, solo pinta lo que
   llega.
3. Solo necesita UN tipo nuevo en el catálogo: "Descanso" (color a elegir). Los otros dos estados
   (en terapia / libre) el FE los sigue leyendo de `GET /frontdesk/queue`, no hace falta que este
   catálogo los duplique.

## Lo que el FE ya tiene listo para reusar

El patrón entero de UI (botón ícono + tooltip + burbuja de conteo + Sheet con selector de persona +
grilla de estatus + lista de "actuales" con quitar) ya existe en `nurse-status-button.tsx` — en cuanto
el endpoint de técnicos con expiración exista, se clona ese componente para técnicos sin rediseñar
nada.

## Cómo verificar al terminar

Poner a un técnico en "Descanso" por 1 minuto, esperar, y confirmar que `GET .../actuales` deja de
devolverlo pasado ese minuto, sin que nadie lo haya quitado a mano.
