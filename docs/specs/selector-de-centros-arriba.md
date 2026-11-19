# Bayamón / Caguas / Ambos en la barra superior

Decisión del dueño (05-nov-2026, hablada con Lisandro). Reemplaza el filtro de centro de cada pantalla
(cmr-fe #118) y la regla «el dinero solo del centro activo» (cmr-be `ACTIVE_CENTER_ONLY_READS`, quitada en el
PR de backend `feat/money-reads-company-wide`).

## El modelo

- Todo es de la empresa: pacientes, médicos, citas, tratamientos y dinero. El centro es una **dimensión** de
  cada registro para partir los datos, no una pared.
- **Leer:** sin filtro, los datos de todos los centros asignados a la persona, sumados. El filtro es uno solo,
  arriba: **Bayamón / Caguas / Ambos**. «Ambos» solo aparece a quien tiene más de un centro.
- **Escribir:** cada registro nace con **un** centro. Las acciones sobre un registro (cobrar, anular, devolver,
  editar) corren en el centro del registro. Crear usa el centro elegido arriba; con «Ambos», el formulario
  pregunta el centro (obligatorio, sin valor por defecto).
- Al entrar, la barra arranca en el centro de la persona (el de la sesión). Se recuerda por navegador.
- La columna **Centro** se muestra siempre en las listas cuyas filas traen centro, con un centro o con dos.

## Cómo funciona

- Cookie `cmr_active_centro` (ya existe): el centro de trabajo, el `X-Tenant-ID`. No cambia de significado.
- Cookie nueva `cmr_clinic_view=all`: la vista «Ambos». Sin ella, la vista es el centro activo.
- Elegir Bayamón o Caguas fija el centro activo y quita «Ambos»; elegir «Ambos» deja el centro activo como
  estaba (sigue siendo el `X-Tenant-ID`, los guards lo exigen) y pone la cookie. Recarga, como hoy.
- Lecturas: con un centro, `centerIds=<ese>`; con «Ambos», todos los centros que la persona puede leer con el
  permiso de la pantalla (o ningún `centerIds`: el BE devuelve todos los del alcance).
- Pantallas de **un centro por naturaleza** (tablero del día, cuadre/día de caja, configuración de un centro,
  panel de enfermería, existencias de un almacén, cierre diario): con un centro arriba, ese; con «Ambos»,
  muestran su propio selector de centro (el de siempre, `useCentroPantalla`), arrancando en el centro activo.
- El filtro de centro de cada pantalla (`CenterFilter`) desaparece: lo reemplaza la barra.

## Fuera de alcance

- Juntar en una sola vista lo que es de un centro por naturaleza (dos tableros del día, dos cajas).
- Cambiar el modelo de datos o el sellado de `clinicId` en el BE.
