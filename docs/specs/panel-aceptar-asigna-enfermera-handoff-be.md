# HANDOFF BE — Aceptar en el panel debe ASIGNAR la enfermera a la cita/sesión (y avisar en vivo)

**Competencia BE.** El FE ya está listo (ver abajo); falta que el servidor propague la aceptación a la
entidad y emita su evento. Descubierto y verificado en producción hoy (2026-08-08) con dogfood reversible.

## El comportamiento que pide el dueño

Cuando la enfermera toca **su propia tarjeta** en el Panel de Enfermería (acepta el aviso), ella queda
como quien atiende ese servicio, y **su nombre debe aparecer solo, en vivo, justo debajo de la campana**
en el tablero de Atención (columna `fd_notificar`). Es decir: al aceptar, el **id/login de la enfermera
que aceptó debe viajar a la cita** y reflejarse como nombre.

Hoy ese comportamiento existe SOLO por la otra vía (abrir el modal y elegir la enfermera a mano), pero NO
cuando la enfermera se asigna sola desde el panel.

## Lo que hace hoy el BE (verificado en prod, reversible)

`POST /api/v1/paneles/notificaciones/:id/aceptar { personalId }`:

- La notificación pasa a `estado: "aceptada"` y guarda `aceptadaPorId` (la enfermera). ✅
- **PERO la cita NO recibe la enfermera:** tras aceptar, `GET /api/v1/citas/:id` sigue con
  `enfermeraVitalesId: null`, y la fila del tablero (`fd_enfermera`) sigue en `null`. ❌

Evidencia (Caguas, hoy):
- Aviso creado: `POST /paneles/enfermeria/notificar {seccion:"vitales", citaId:"3c2273a8-…"}` → 201,
  notificación `0be02c8b-…` con `asignaA` = binding de enfermera de la sección.
- Aceptar: `POST /paneles/notificaciones/0be02c8b-…/aceptar {personalId:"1cf13b5d-…" (Britalie)}` → 201,
  `estado:"aceptada"`, `aceptadaPorId:"1cf13b5d-…"` (requestId `9224fcb7-…`).
- Resultado: `citas/3c2273a8-…` → `enfermeraVitalesId: null`; fila `fd_enfermera: null`. **No se asignó.**

## Qué hay que hacer en el BE

1. **Al aceptar, aplicar `aceptadaPorId` al binding de la sección** (`panel_secciones.asignaA`, hoy
   `sesion.enfermeraId | sesion.tecnicoId | sesion.medicoId`, y su equivalente `cita.*` cuando el aviso es
   de una CITA). Concretamente: si el aviso está ligado a una **cita** (`citaId`), escribir la enfermera en
   `cita.enfermeraVitalesId`; si a una **sesión** (`sesionId`), en `sesion.enfermeraId`. Es la MISMA
   asignación que ya hace el modal manual — de hecho el FE la escribe con `PUT /citas/:id
   {enfermeraVitalesId}` y funciona (verificado). Aceptar debe dejar el mismo estado.
2. **Emitir el evento de la ENTIDAD** (no solo el de `panel_notificacion`): un evento de `cita`
   (`/citas/stream`, `entidad:"cita"`) para esa cita — y de `sesion` para servicios — para que los tableros
   abiertos se refresquen en vivo. El FE ya escucha ese bus por entidad y recarga solo.

## Lo que el FE YA hace (no hay que tocar nada aquí cuando el BE cierre el gap)

- La celda de Notificar (`components/agenda/tablero-dinamico.tsx` → `NotificarCell`) pinta el nombre de
  `fila[asignadoDe]` (`fd_enfermera`) **justo debajo de la campana** cuando `render.mostrarAsignado` es
  true. Verificado en navegador real: al asignar por el modal, el nombre aparece bajo la campana.
- El tablero de Atención se **auto-recarga por SSE** ante eventos de `entidad: "cita"`
  (`components/tablero/generic-board.tsx` → `useCitaStream({ entidad: registro.entidad, onInvalidate:
  filasRes.refresh })`). En cuanto el BE escriba la enfermera en la cita y emita el evento de cita, el
  nombre aparecerá solo, en vivo, sin cambios en el FE.

## Cómo comprobarlo sin adivinar (el mismo dogfood, reversible)

1. `GET /tablero/filas?tablero=atencion&fecha=HOY` → tomar una fila con paciente y `fd_enfermera:null`.
2. `POST /paneles/enfermeria/notificar {seccion:"vitales", citaId:<id>}`.
3. `POST /paneles/notificaciones/<notifId>/aceptar {personalId:<enfermera>}`.
4. `GET /citas/<id>` → **debe** quedar `enfermeraVitalesId = <enfermera>` (hoy queda null).
5. La fila debe proyectar `fd_enfermera = <nombre>` y los clientes abiertos recibir el evento de cita.
6. Revertir: `PUT /citas/<id> {enfermeraVitalesId:null}`.

## Contexto

- `panel_secciones.asignaA` ya declara el binding (lista cerrada sesion.enfermeraId/tecnicoId/medicoId).
- Spec relacionada: `docs/specs/notificar-enfermera-en-celda.md` y la columna reusable de Notificar
  (`columnas-reusables-binding-relativo.md`).

## Dónde ESTÁ hoy el dato (verificado en Bayamón, solo lectura)

La aceptación SÍ se guarda, pero en la NOTIFICACIÓN del panel (`panel_notificaciones.aceptadaPorId`),
no en la cita. La definición del panel lo agrega en `contadores` por enfermera/sección. Bayamón, hoy:

- Anna Matosantos → total 2 (vitales 1, intravenoso 1)
- Jennifer Concepcion → total 3 (vitales 2, intravenoso 1)
- Wanda Barroso → total 1 (vitales 1)

Es decir: el sistema YA sabe quién atendió (por eso salen esos contadores), pero ese `aceptadaPorId`
vive en la tabla de notificaciones del panel — **no** en `cita.enfermeraVitalesId` ni en
`sesion.enfermeraId`. Por eso el nombre no llega a la campana en Atención. El arreglo es copiar
`aceptadaPorId` al binding de la entidad al aceptar (§"Qué hay que hacer en el BE").

## Consistencia: UNA sola fuente de verdad (riesgo señalado por el dueño)

Si "aceptar" copia la enfermera a la cita PERO quedan dos campos independientes
(`panel_notificaciones.aceptadaPorId` y `cita.enfermeraVitalesId`), pueden **divergir**: si Wanda
aceptó por error y luego se corrige a Jennifer en Atención (modal → `PUT /citas/:id
{enfermeraVitalesId}`), el campo de la cita cambia pero el `aceptadaPorId` del panel NO, así que los
contadores del panel seguirían acreditando a Wanda. Eso es peligroso para reportes de productividad.

Hay que decidir en el BE una de estas (que el FE no puede resolver solo):

- **Opción A (recomendada): la cita es la ÚNICA verdad.** `aceptar` escribe `cita.enfermeraVitalesId`;
  los contadores/atribución del panel se DERIVAN de ese campo (no de `aceptadaPorId`). Corregir en
  Atención corrige el reporte automáticamente. `aceptadaPorId` queda como traza de "quién tocó la tarjeta",
  no como fuente de la atribución.
- **Opción B: bidireccional.** Corregir en Atención (o donde sea) reconcilia también `aceptadaPorId`
  de la notificación de esa cita/sección, para que ambos coincidan siempre.

Sea cual sea, el requisito es: **cambiar la enfermera en un sitio no puede dejar el otro desactualizado.**
