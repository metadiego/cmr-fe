# Handoff BE → FE: medidas GLP-1 (enlace solo, hub de respaldo, báscula por imagen)

BE: cmr-be PR #509 (7-nov-2026). Spec: `cmr-be/docs/specs/medidas-corporales-glp1.md`, anexo del 7-nov.

## Qué cambió en el BE (y qué ya no hace falta en pantalla)

- **La medida se enlaza sola a la visita GLP-1 del día.** Hay tres momentos:
  - cuando la visita aparece o cambia en el frontdesk (aunque la enfermera haya mandado el dato antes);
  - cuando se abre la visita;
  - cuando se imprime el formato GLP-1.

  Ahora también vale una visita agendada que aún no se marcó presente. La pantalla no tiene que hacer
  nada para enlazar.
- `GET /api/v1|v2/body-measurements/sessions/:sessionId`, el mismo de siempre, devuelve ya la medida
  enlazada.

## Lo que sí hay que construir: el hub «Medidas sin vincular»

Es lo que no encontró visita: récord equivocado, o un paciente que nunca se metió al frontdesk.

- **Menú:** `clave: body-measurements-unlinked`, `labelKey: nav.bodyMeasurementsUnlinked`,
  `path: /body-measurements/unlinked`, bajo Servicios. Permiso `body_measurements.read`.
- **Listar:** `GET /api/v2/body-measurements/unlinked?from=YYYY-MM-DD&centerIds=...`. El `from` por
  defecto es 14 días atrás. Antes de listar, el BE intenta enlazar cada una; solo vuelve lo que de
  verdad sigue suelto.

  Cada fila trae:
  - `kind`: `scale` o `tape`;
  - `id`, `clinicId`, `clinicName`, `date`, `source`, `createdAt`;
  - `values`: los números medidos, con las mismas claves que `scale`/`tape` en
    `sessions/:sessionId`;
  - `patient`: `{ id, record, … }`, o `null`.

  **Copiar los nombres de campo exactos de la respuesta real de v2** (el traductor puede renombrar
  `patient.nombres`/`apellidos`); hoy la lista está vacía en producción.
- **Enlazar a mano:**
  - `POST /api/v2/body-measurements/scale/:id/link` o `.../tape/:id/link`, con `{ "sessionId": "<uuid>" }`.
  - La medida toma el paciente y el día de esa visita, lo que corrige un récord equivocado.
  - Permiso `body_measurements.write` en el centro de la visita.
  - Para elegir la visita: las sesiones del día del frontdesk, igual que en la ficha.
- **Errores (por `labelKey`):**
  - 409 `bodyMeasurements.error.alreadyLinked`: esa visita ya tiene su medida de ese tipo.
  - 404: la medida o la visita no están en tus centros.

## Báscula por imagen (sin pantalla; solo para saberlo)

- `POST /api/v1/body-measurements/scale-image` es la puerta del atajo del iPad: multipart `image`
  (PNG/JPG) + `record` (`R15808`) o `codclien`.
- Errores (por `labelKey`):
  - 503 `bodyMeasurements.error.visionNotConfigured`: aún no hay llave de IA en el servidor.
  - 422 `bodyMeasurements.error.visionUnreadable`.
- Si se quiere un botón «Subir captura de la báscula» en la ficha de la visita, usa esa misma puerta;
  no es obligatorio.

## i18n nuevas

- `nav.bodyMeasurementsUnlinked`
- `bodyMeasurements.error.alreadyLinked`
- `bodyMeasurements.error.visionNotConfigured`
- `bodyMeasurements.error.visionUnreadable`
