# Handoff — Asistido bloqueado por «áreas» que la pantalla SÍ muestra (21-nov-2026)

## Lo que reportan (dueño, Bayamón, láser)

Con la fila lista (sesiones y áreas visibles, p. ej. «2»), al pulsar **Asistido** sale el aviso de
que faltan las áreas. Para que acepte, el usuario sube y baja el número y lo deja en el mismo valor.

## Causa (verificada en código y en producción)

1. `components/frontdesk/medicion-cell.tsx`: si la sesión no tiene `datos.aplicadas`, la celda
   precarga `sheet.areas` (hoja de la visita) como valor **PROPUESTO** (borde punteado, tooltip
   `frontdesk.aplicadasPropuesto`). Por diseño **no se guarda** hasta que el usuario sale del campo
   o lo edita.
2. `components/frontdesk/fila-sesion.tsx:498-551`: el candado de la transición lee solo
   `sesion.datos[clave]` → `aplicadas` vacío → `toast.warning(faltanCampos)` y no llama al BE.
3. El BE exige lo mismo: `servicios.form_actions` de `laser` (Caguas y Bayamón) declara
   `{ clave: "aplicadas", requerido: true, en: "asistido" }` y `marcarAsistido` →
   `validarRequisitos` lee `datos.aplicadas`. Sin el dato guardado el BE también rechazaría.
   (En la auditoría no hay ningún 400 por áreas: el bloqueo de hoy es el del FE, antes de llamar.)

Lo que se VE (propuesto) y lo que se COMPRUEBA (guardado) salen de sitios distintos.

## Lo que se pide (pieza compartida, no parche de pantalla)

Al pulsar una transición con campos requeridos, **un valor propuesto visible cuenta como valor**:

- Si un requerido está vacío en `datos` pero la celda tiene un propuesto, **guardarlo primero**
  (el mismo `onSave` de la celda / `POST /frontdesk/sesiones/:id/acciones` con `{ datos: { aplicadas: n } }`)
  y **después** pedir la transición. El usuario no tiene que tocar el número.
- Hacerlo en la pieza que decide «faltan campos» (no en el láser): cualquier celda con valor
  propuesto (hoy `aplicadas`; mañana otra) se comporta igual.
- Solo bloquear (toast `faltanCampos`) si no hay ni valor guardado ni propuesto.
- Mantener que abrir el tablero **no** escribe nada: se escribe al confirmar la transición.

## Verificación

- Fila de láser sin `datos.aplicadas`, con propuesto 2 → Asistido pasa a la primera; después
  `GET` de la sesión trae `datos.aplicadas = 2` y el paquete descuenta.
- Sin propuesto ni valor → sigue saliendo el aviso de campos faltantes.
- Pantalla viva: `/boards/patient-desk` (`service-sessions-table.tsx` usa la misma fila).

No hay cambio de BE en este handoff.
