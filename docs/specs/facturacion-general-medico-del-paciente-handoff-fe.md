# Facturación general — el médico del paciente sale siempre, aunque esté de baja

**Fecha:** 2026-10-14 · **De:** BE → FE · **Visto por:** el dueño: «en la facturación general, donde
se elige el paciente, NO está el médico que salía hasta hace poco».

## Lo verificado (producción, lectura, 14-oct)

- El BE **sí** manda el médico. `GET /api/v2/invoices/search-patient?q=15817` (FELICITA RIVERA
  OCASIO, Bayamón) devuelve `doctorId` 57f3f6bf…, `doctorName` «Juan Pagan», `doctorClinicId` y
  `doctorClinicName`.
- El desplegable «Médico» de `components/facturacion/venta-general.tsx` se llena con
  `GET /staff/capacity-by/medico`, que solo trae médicos **activos** de ese centro. Juan Pagán está
  **de baja** (`active=false`, por `PUT /api/v2/staff/57f3…` desde la UI el 24-sep). Su id no está
  entre las opciones, así que el `Select` con `value = sel.doctorId` se queda **en blanco**: el
  médico «desaparece».
- No es un caso suelto. Hay **unos 40.000 pacientes** cuyo médico está de baja (Juan Pagán 11.650,
  Leonel Guedes 12.738, Daphne Figueroa 3.016, Narciso Reyes 2.772, Emma González 2.055…). Además,
  un médico activo que no atiende en ese centro tampoco sale.
- En el BE no cambió nada de esto en octubre: `porCapacidad` no se toca desde septiembre.

## Qué pide

Lo mismo que ya hace «agregar cita» (`c9d89a3`, `117935f`): **el médico del paciente sale siempre**.

1. Si `sel.doctorId` no está entre las opciones de `capacity-by/medico`, se **añade** como opción con
   `sel.doctorName` y una marca que lo explique: «de baja» si no está activo, o el nombre del centro
   (`doctorClinicName`) si es de otro centro. Viene preseleccionado, como hoy.
2. El usuario lo puede cambiar por un médico activo o por «Sin médico», como siempre.
3. Lo mismo en el detalle de la factura, si allí el médico sale de la misma lista.

Para la marca «de baja» no hace falta nada nuevo del BE: si el id no está en la lista de activos del
centro y `doctorClinicId` es este centro, está de baja. Si quieren el dato explícito
(`doctorActive`), díganlo y lo añado a `search-patient`.

## Pruebas que pide

- Paciente con médico activo del centro → sale preseleccionado (sin cambios).
- Paciente con médico de baja → sale «Juan Pagan · de baja», preseleccionado.
- Paciente con médico de otro centro → sale con el nombre de su centro.
- Paciente sin médico → «Sin médico».
