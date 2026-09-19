# Ficha del paciente: el médico (mostrar y cambiar)

El BE ya sirve el médico del paciente con **nombre**, y los datos históricos están cargados. Falta la
pantalla: enseñarlo y poder cambiarlo.

## Lo que devuelve el BE (desplegado, 17-sep)

`GET /api/v1/pacientes/:id` y `GET /api/v1/pacientes` traen ahora, además de `medicoId`:

```json
{ "medicoId": "91dfe602-…", "medicoNombre": "Gilberto Caraballo" }
```

En `/api/v2`: `doctorId` y **`doctorName`**. Sin médico, `medicoNombre` es `null` — hay que pintar
«Sin médico», no una cadena vacía.

## El select

- Catálogo: `GET /api/v1/personal?capacidad=medico` (en v2, `/api/v2/staff?capability=medico`).
  Devuelve solo los **activos** y los del centro según `centrosServicio`. El médico histórico que ya
  no trabaja **no** sale ahí a propósito, pero su nombre sí se pinta si el paciente lo tiene: por eso
  el valor actual hay que mostrarlo aunque no esté entre las opciones (opción fija arriba, o
  añadirla al vuelo con `medicoId`/`medicoNombre`).
- Guardar: `PUT /api/v1/pacientes/:id` con `{ "medicoId": "<uuid>" }`. Para quitarlo, `null`.
- Permiso: el de editar paciente, el mismo del resto de la ficha.

## Contexto (por si ayuda a colocarlo en pantalla)

El médico del paciente viene del legado (`Mclientes.codmedico`) y es el médico **tratante por
defecto**, distinto del médico de una cita concreta, que se asigna en el tablero de Atención. Hoy en
producción: Bayamón 12.181 pacientes con médico asignado, Caguas 40 más; el resto tiene «Sin Medico
Asociado» en el legado.
