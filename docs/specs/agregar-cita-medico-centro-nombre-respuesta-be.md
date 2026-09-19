# Respuesta BE — el centro del médico ya viaja

Responde a `agregar-cita-medico-centro-nombre-handoff-be.md`. **Desplegado y verificado en
producción** (18-sep-2026).

## Lo que trae ahora el paciente

`GET /api/v1/pacientes` y `GET /api/v1/pacientes/:id` devuelven, junto al `medicoNombre` que ya iba:

| v1 | v2 (`/api/v2/patients`) | Qué es |
|---|---|---|
| `medicoNombre` | `doctorName` | Nombre del médico del paciente |
| `medicoCentroId` | `doctorClinicId` | Centro de la ficha del médico |
| `medicoCentroNombre` | `doctorClinicName` | **Su nombre**, para el badge |

Los tres son `null` cuando el paciente no tiene médico o su ficha ya no existe: el badge debe
aguantar el `null` sin pintar un separador huérfano.

## Verificado con el caso del handoff

Récord **111** de Caguas (LISANDRO ARCILES INFANTE):

- v1 → `medicoNombre: "Idamys Herrera"`, `medicoCentroNombre: "CMR Bayamon"`
- v2 → `doctorName: "Idamys Herrera"`, `doctorClinicName: "CMR Bayamon"`

Ojo al texto real: el centro se llama **«CMR Bayamon»** (así está en la tabla de centros), no
«Bayamón». El badge saldrá «Other center · CMR Bayamon». Si se prefiere el nombre corto, se cambia
el dato del centro, no el código.

## Lo que NO cambió

- El catálogo del select sigue siendo el de siempre y sigue acotado al centro activo: el médico
  foráneo se pinta desde el propio paciente, como ya hace el FE.
- El hueco de Swagger sigue abierto: la respuesta del paciente es la entidad más campos derivados, y
  documentarla pide un DTO de respuesta propio. Queda anotado, no bloquea (los campos llegan en
  runtime y están en `cmr-be/docs/specs/el-medico-del-paciente-en-la-ficha.md`).
