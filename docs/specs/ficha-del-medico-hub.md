# La ficha del médico como centro de todo — BE listo

Hermana de `ficha-del-paciente-hub-y-certificacion-de-gastos.md`. El dueño (18-sep-2026): «lo mismo
que con el paciente, pero con el médico: que todo lo relacionado con ellos se gestione desde ahí».
Aquí es donde viven **sus días de citas, sus ausencias y los feriados**.

Spec del BE: `cmr-be/docs/specs/la-ficha-del-medico-es-el-centro-de-todo.md`.

## Pestañas y sus endpoints (todos existen ya)

| Pestaña | Endpoints |
|---|---|
| **Resumen** | `GET /staff/:id`, `PUT /staff/:id`, `PUT /staff/:id/centers` (en qué centros sirve) |
| **Agenda** | `GET /appointments?doctorId=` — y el alta de cita que ya usáis |
| **Pacientes** | `GET /patients?doctorId=` — **nuevo**, paginado y con `doctorName` resuelto |
| **Disponibilidad** | `GET /doctors/schedules?medicoId=` + CRUD · `GET /doctors/absences?doctorId=` + CRUD · `GET /holidays` + CRUD · `GET /availability/next-available-date?doctorId=&date=` |
| **Producción** | los informes por médico que ya existen |

Probado en producción: `GET /api/v1/pacientes?medicoId=<Gilberto Caraballo>` → **3.481 pacientes**,
cada uno con su `medicoNombre`; en v2, `GET /api/v2/patients?doctorId=` con `doctorName`.

## Lo que hay que entender para pintar «Disponibilidad»

- **El día libre NO es un campo.** Es no tener horario ese día. La pestaña enseña la semana; los días
  con horario son los que trabaja, y los vacíos son sus días libres. Se editan con el CRUD de
  `/doctors/schedules`.
- **Vacaciones y permisos** son rangos con motivo: `POST /doctors/absences`
  `{ doctorId, kind: "vacation"|"leave", startDate, endDate, reason? }`.
- **Los feriados son compartidos**, no del médico: globales o del centro, recurrentes o de un año, y
  cada uno dice si cierra la agenda o solo informa. Se pintan aquí como lectura (con enlace a su
  configuración), no como algo suyo.
- **La pregunta** `GET /availability/next-available-date?doctorId=&date=` dice si esa fecha sirve,
  por qué no (`sunday`, `holiday`, `no_schedule`, `vacation`, `leave`, con su `labelKey`) y cuál es
  la próxima válida, siempre hacia adelante. Úsala también en el alta de cita de esta pantalla.

## Layout

El mismo de la ficha del paciente: cabecera con nombre y cargo, pestañas, acciones donde está el
dato, y toda la pantalla aprovechada. Uniformidad con lo que ya hay.

## RBAC

Leer: `personal.read`, `citas.read`, `pacientes.read`. Configurar horarios y ausencias:
`citas.config`. Editar la ficha: `personal.update`. Cada pestaña se pinta solo si su permiso lo
permite.
