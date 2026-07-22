# Handoff BE — Historial de terapias por PACIENTE + SERVICIO (modal del Frontdesk)

## Qué se quiere (paridad legacy, screenshot `laser.png` → "Historial de Terapias - Record: 15252")
Al hacer clic en el récord (o desde Acciones) de una fila del Frontdesk, abrir un modal con TODAS las
sesiones de ESE paciente para ESE servicio, en el tiempo. Cada fila del historial:
- **Fecha** (día).
- **Estado** (Asistido / …).
- **Servicio / Detalles**: nombre del servicio + `Sesión: X/Y` + `Áreas: N` (las "aplicadas").
- **Staff**: quién atendió (técnico/enfermera).

Ejemplo real: LASER, Sesión 1/12 … 7/12, Áreas 4, staff variando por fecha.

## Qué falta en el BE
`GET /frontdesk/sesiones?desde&hasta&servicioId&tecnicoId` existe pero **NO filtra por `pacienteId`** y
no proyecta los campos del historial. Se necesita una de estas dos (preferible la 1):

1. **Filtro `pacienteId` en `/frontdesk/sesiones`** + que cada sesión traiga, ya resueltos:
   `fecha`, `estado`, `servicioNombre`, `sesionNumero` + `sesionesTotales` (el X/Y del paquete),
   `areas`/`aplicadas` (de `sesion.datos` o cantidad), `staffNombre` (tecnico/enfermera).
2. O un endpoint dedicado `GET /frontdesk/pacientes/:pacienteId/historial?servicioId=` que devuelva esa
   lista proyectada (más limpio para el modal).

Notas:
- `Sesión X/Y`: X = cuántas asistidas acumuladas de ese paquete; Y = total del paquete (disponibilidad
  PR #134 ya sabe el total). Idealmente el BE lo calcula (el FE NO debe recomputar el paquete).
- `Áreas/aplicadas`: viene de facturación general (láser MLS/HEAT venden días=sesiones y áreas). Exponerlo
  como campo de la sesión.
- Multi-centro/RBAC como el resto; ordenar por fecha desc.

## FE (cuando el BE entregue)
Modal "Historial de terapias" abierto desde el link del récord y/o el menú Acciones de la fila. Nivel
"mega pro" (tabla limpia, badges de staff, estado con color). Reusa `formatFechaSolo`, tokens, i18n.
Sin lógica de cálculo en FE: pinta lo que el BE proyecta.

## Aceptación
- Clic en récord 15252 (Caguas, láser) → modal con sus 7 sesiones (1/12…7/12), áreas 4, staff por fecha.
- Cambiar de servicio/paciente trae su propio historial. Data-driven, sin hardcode.
