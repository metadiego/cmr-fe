# Handoff FE — Corregir la numeración de sesiones migradas del legado

**Pedido del dueño, 19-nov-2026.**

El récord 103115 de Bayamón (Láser, 12 sesiones) muestra «1/8» en su primera sesión. El «1/8» lo
escribió el legado, y hoy la pantalla no tiene forma de corregirlo.

- BE: `cmr-be`, rama `feat/legacy-session-numbering`.
- Spec: `cmr-be/docs/specs/numeracion-de-sesiones-migradas.md`.

## Dónde
En la ficha del paciente, pestaña **Terapias** (`components/clientes/ficha-tabs.tsx`, `FichaTerapias`).

## Datos
`getHistorialPaciente` ya devuelve cada fila. Ahora trae además **`migrated: boolean`**: `true`
significa que la fila vino del legado y su «n/m» es texto propio, sin paquete. Las filas nacidas aquí
(`migrated: false`) se numeran por su paquete, y se corrigen con el ajuste de paquete que ya existe,
no con esto.

## Acciones (permiso `frontdesk.disponibilidad.editar`; sin él, no se muestran)

### 1. «Corregir numeración», por fila
Solo en las filas con `migrated: true`: icono de lápiz junto a la barra de sesión.
- Popover con dos números, «Sesión» y «de», más un «Motivo» obligatorio (mínimo 3 caracteres).
- Llamada: `POST /api/v2/frontdesk/sessions/:id/legacy-label`
  - Body: `{ number, total, reason, centerIds: [centro] }`.
  - Responde: `{ id, before, after }`.
- Toast: «Sesión corregida: 1/8 → 1/12». Después, recargar el historial.

### 2. «Renumerar serie», por servicio
Botón en la cabecera de la tabla, visible si el filtro de servicio tiene alguna fila migrada.
1. Diálogo con:
   - «Total de sesiones» (número);
   - «Empieza en» (por defecto 1);
   - «Desde» y «Hasta» (fechas opcionales);
   - «Motivo».
2. **Vista previa automática.** Al cambiar cualquier campo, llamar
   `POST /api/v2/frontdesk/patients/:patientId/services/:serviceId/legacy-renumber` con
   `{ total, startAt?, from?, to?, reason, preview: true, centerIds: [centro] }`.
3. Pintar la tabla que devuelve: Fecha · Antes · Después. Resaltar las filas con `changed: true`.
4. «Aplicar (N cambios)» repite la llamada sin `preview` y cierra el diálogo.
5. Toast: «N sesiones renumeradas».

### Errores
Mostrarlos con `labelKey`:
- 400 `FRONTDESK_LEGACY_LABEL_INVALID` (`frontdesk.legacyLabel.invalid`): «La sesión va de 1 al
  total». También sale cuando la serie no cabe en el total.
- 409 `FRONTDESK_LEGACY_LABEL_NOT_MIGRATED` (`frontdesk.legacyLabel.notMigrated`): «Esta sesión la
  numera su paquete; corrígela desde el paquete».

## i18n (es / en)
Claves:
- `legacyLabel.correct`
- `legacyLabel.renumber`
- `legacyLabel.session`
- `legacyLabel.of`
- `legacyLabel.total`
- `legacyLabel.startAt`
- `legacyLabel.from`
- `legacyLabel.to`
- `legacyLabel.reason`
- `legacyLabel.before`
- `legacyLabel.after`
- `legacyLabel.apply`
- `legacyLabel.corrected`
- `legacyLabel.renumbered`
- `frontdesk.legacyLabel.invalid`
- `frontdesk.legacyLabel.notMigrated`

## Verificación
1. En producción, Bayamón, récord 103115, Láser: «Renumerar serie» con total 12 y vista previa.
   Debe proponer un solo cambio: 10/19/2026, de 1/8 a 1/12.
2. El BE lo aplica en su propia verificación. Después, la pestaña Terapias debe mostrar 1/12 … 8/12,
   9/12 y 10/12.
