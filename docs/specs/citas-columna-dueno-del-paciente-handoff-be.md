# Handoff BE — añadir la columna «Dueño del paciente» en el módulo de citas (ADITIVA)

**Origen**: el dueño, 2-oct-2026, sobre `/scheduling/appointments`, tras tu informe
`cmr-be/docs/plans/revision-citado-por-2026-10-02.md`. Decisión literal del dueño:
*«solo mostraremos el dueño del registro; no vamos a borrar nada, solo mostraremos otro campo»*.

## Qué se pide (y qué NO)

- **SÍ:** mostrar, junto a lo que ya hay, el **propietario del paciente** (`creadoPor` del paciente —
  `Karola`, `CCBAY2`, …). Tu informe dice que **1.448** citas hoy vacías de «citado por» tienen ese
  dueño guardado y coincide con el legado: se llenan de golpe, sin tocar un dato.
- **NO:** no se quita ni se cambia la columna **«citado por»** (`booked_by_staff_id` = quién agendó la
  cita). Se queda igual. Esto **suma** una columna, no reemplaza ninguna.

## Por qué es tuyo (el FE casi no toca)

El módulo de citas pinta las columnas **data-driven**: salen de la definición del tablero
(`GET .../day-agenda` / definición del board), y cada fila es un `Record` keyed por la `clave` de la
columna (en el FE, `CitaFila = { id, estado } & Record<string, unknown>`). Es decir: **si añades una
columna a la definición y pones su valor en cada fila, el FE la pinta sola**, sin código nuevo.

### Lo que haría falta del BE

1. Una **columna nueva** en la definición del tablero de citas (y de Atención si aplica), p. ej.
   `clave: "ownerName"` (o `propietario`), con su `labelKey` (`citas.col.owner` / «Dueño»), en inglés
   como el resto del contrato v2.
2. Que **cada fila** traiga ese valor: el `creadoPor` del paciente de la cita (nombre mostrable, no el
   id). Vacío → cadena vacía/`null`, el FE lo pinta «—».
3. (Opcional, mejor) exponerlo también en el **paciente embebido** que ya adjuntáis a las respuestas con
   `patientId` (`patient: { id, name, medicalRecordNumber, … }`), añadiendo `owner`/`ownerName`. Así
   cualquier otra pantalla que liste pacientes puede mostrar el dueño sin pedir la ficha fila a fila.

Decidme el **nombre exacto** de la clave/campo y si lo entregáis como columna del board o como campo del
paciente embebido, y en cuanto esté en producción lo confirmo por HTTP y ajusto el FE si hiciera falta
(labelKey, formato). Si sale como columna data-driven del board, no hay nada que tocar en el FE.

## Lo que queda fuera de este cambio (ya en tu informe, es dato/decisión, no FE)

- Repescar del legado a los que allí sí tienen usuario mirando **los dos centros** (caso 162831).
- Los 23.307 pacientes sin dueño y los logins sin ficha: decisión del dueño (comisiones), no se adivinan.
