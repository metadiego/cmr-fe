# Handoff BE — dos transiciones necesitan candado en el SERVIDOR, no solo en el FE

**Origen**: el dueño, 30-sep-2026, tablero de Atención de hoy. Dos reglas que hoy el FE intenta
aplicar solo en el cliente y por eso se saltan. Las dos tocan datos de paciente / flujo clínico, así
que el rigor es máximo.

## Caso real (verificado, NO tocar el dato)

Paciente **PALMIRA SANCHEZ DE PIÑERO** (récord 102723), tipo **Consulta (Nueva)**, centro del
tablero de hoy. Está en **PRESENTE** y **no debería**: al dueño, al marcar Presente, el FE le pidió
el **ID y el tipo de ID** (modal de datos faltantes) y **canceló sin completarlos** — Presente NO se
aplicó, correcto. **Otro usuario repitió la acción justo después y SÍ la dejó en Presente sin
completar esos datos.** Ese es el fallo: el candado es del FE y se puede saltar (fail-open ante un
error del readiness, otro cliente, o llamada directa al endpoint de transición).

## Regla 1 — PRESENTE exige los datos requeridos del paciente (paciente NUEVO)

Hoy el FE, en `components/tablero/flujo-atencion.tsx`, antes de marcar Presente consulta
`GET /ehr/readiness/:patientId` y, si el paciente es `nuevo`, `!listo` y hay `faltantes`, abre un
modal (`EhrReadinessModal`) que guarda `idType, docId, sexo, fechaNacimiento, zipcode` con
`PUT /pacientes/:id` y recién entonces reanuda la transición. **Pero es solo del cliente y
fail-open** (si `isEhrEnabled` o `readiness` fallan, deja pasar; comentario explícito en el código).

**Lo que se pide al BE**: que la **transición a `presente`** (el `POST` de acción del motor de
tableros que hoy ejecuta `ejecutarAccion`) **valide ella misma** que un paciente `nuevo` tiene los
campos requeridos, y **rechace con 400 y un `code` claro** si faltan (idealmente devolviendo la
lista `faltantes`, para que el FE abra el mismo modal y no adivine). Así:

- Da igual qué cliente lo intente, o si el readiness se cayó: sin datos, no hay Presente.
- El FE mantiene el modal amable como camino feliz, y ante el 400 lo abre en vez de romper.

Nota de diseño: hoy la regla vive pegada al **interruptor de EHR** del centro. El dueño la quiere
como requisito del **Presente** en sí (dato clínico), no como efecto secundario del enganche EHR.
Si el BE prefiere mantenerla bajo el flag, que al menos el flag **no** deje el candado en manos del
FE.

## Regla 2 — EN CONSULTA exige médico

**Nueva regla del dueño (30-sep)**: *«para que se marque en consulta debe necesariamente poseer un
médico»*. Encaja con el walk-in que se acaba de soltar: agendar/entrar puede ser **sin** médico (se
estampa «Sin Medico», legacyCode 000), pero **pasar a EN CONSULTA sí requiere un médico de verdad**
— es cuando el paciente entra a ver a alguien.

**Lo que se pide al BE**: que la **transición a `en_consulta`** rechace (400, `code` claro) cuando la
cita no tiene médico asignado, o sigue con el «Sin Medico» por defecto (legacyCode 000). El médico se
asigna al marcar Presente (regla ya existente); al llegar a En consulta ya debe ser uno real.

Por qué en el servidor y no solo en el FE: el médico es un valor **data-driven** de la fila (columna
del motor de tableros, clave variable por centro); el FE no puede afirmar con certeza «no tiene
médico» sin acoplarse a la clave, y aun así sería saltable. El BE sí sabe el `doctorId`/legacyCode.

## Lo que el FE hace en cuanto el BE rechace

Nada nuevo: `runAccion` ya captura el error de la transición y lo muestra con `toastError`. Con un
`code` claro por regla:

- `PRESENTE` + faltan datos → el FE abre `EhrReadinessModal` con los `faltantes` del 400.
- `EN_CONSULTA` sin médico → el FE muestra el aviso y (si se quiere) abre el selector de médico.

Decidme los `code` exactos y los campos del cuerpo del 400 y lo conecto. **Mientras tanto no cambio
el estado de Palmira** (queda en Presente, como pidió el dueño).
