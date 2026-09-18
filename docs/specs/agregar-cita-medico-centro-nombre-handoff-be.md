# Handoff BE → FE — nombre del CENTRO del médico en «Agregar cita»

Continúa `agregar-cita-medico-de-otro-centro-handoff-be.md` (ya resuelto: el médico foráneo se
muestra con la marca «Other center»).

**Pedido del dueño (18-sep-2026):** además de marcar «Other center», mostrar el **nombre del
centro** del médico. Con varios centros, ver «Idamys Herrera · Bayamón» identifica al vuelo de
dónde es el médico, en vez de un genérico «otro centro».

## Qué falta (dato del BE)

El paciente ya trae `doctorId` y `doctorName` (runtime; hueco de tipos conocido). **No trae el
centro del médico.** El FE no puede resolverlo por su cuenta: el catálogo de médicos
(`getOpciones(tablero,"medico",centro)` / `getMedicos`) está **acotado al centro activo**, así que
un médico de otro centro no aparece ahí y no hay de dónde sacar su centro.

## Pedido

En el mismo sitio donde se compone `medicoNombre` (`pacientes.service.ts:130-135`, del lookup de
personal por `medicoId`), agregar el **nombre del centro del médico** —su `clinicId` de ficha, o el
centro que corresponda si el criterio es otro— como una propiedad nueva del paciente, p. ej.
`medicoCentroNombre` (v1) → **`doctorClinicName`** (v2). El lookup de personal ya tiene el `clinicId`,
así que es resolver ese id a nombre de centro (mismo patrón que `nombresCentro`/`centrosSvc.findAll`
que ya se usa en la agenda).

Idealmente documentarlo con `@ApiProperty` para cerrar el hueco de tipos (hoy `doctorName` tampoco
está en Swagger; ver el handoff anterior), pero con que llegue en runtime el FE ya lo pinta.

## Lo que ya hizo el FE (desplegado, forward-compatible)

`components/tablero/agregar-cita-modal.tsx`: la `SelectItem` del médico foráneo ya lee
`paciente.doctorClinicName` (cast, por el hueco de tipos) y, si viene, pinta el badge como
«Other center · <centro>»; si no viene, cae al «Other center» de siempre. En cuanto el BE mande el
campo, aparece el nombre del centro sin más cambios en el FE.
