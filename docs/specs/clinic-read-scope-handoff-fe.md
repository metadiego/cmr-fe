# Handoff FE: el sistema enseña el centro (alcance de lectura por permiso)

Fecha: 03-nov-2026. BE: `cmr-be/docs/specs/clinic-read-scope.md` y `docs/plans/clinic-read-scope.md`.
Serie: PR #446 (core) y el PR de Pacientes que va encima. Se amplía con cada módulo que migra.

## La idea

Las pantallas dejan de tener selector de centro. Una lectura enseña **todos los centros donde la
persona tiene el permiso de esa pantalla** (administración: todos), cada fila con su centro, y un
filtro para acotar. Quien trabaja en un centro no nota nada. La barra superior pasa a ser «centro
por defecto para lo nuevo».

## Lo que da el BE, en toda lectura migrada

- **Sin `centerIds`**: todos los centros del alcance. **Con `centerIds`**: solo esos, y si ninguno
  está permitido, 403 `CENTROS_NO_AUTORIZADOS`. Nunca amplía.
- **Cada fila trae `clinicId` y `clinicName`.**
- **`meta.clinicScope`** en la respuesta:
  ```jsonc
  { "all": false, "clinicIds": ["<bay>", "<cag>"], "filtered": false }
  ```
  - `clinicIds`: los centros que cubre la respuesta (para el admin, los centros activos).
  - `filtered`: `true` si se acotó con `centerIds`.

**Ojo, en el cliente:** `apiFetchPaged` (`lib/api/client.ts`) devuelve solo `{ items, pagination }` y
**descarta el resto de `meta`**. Hay que pasarle también `clinicScope` (p. ej.
`{ items, pagination, clinicScope }`), una sola vez y para todos. Si no, ninguna pantalla lo ve.

Regla para la pantalla, sin llamar a nada más:
- **Columna «Centro»** cuando `meta.clinicScope.clinicIds.length > 1`.
- **Filtro de centros** cuando el alcance SIN filtrar tiene más de uno. Hay que recordar la primera
  respuesta sin `centerIds`, porque una respuesta filtrada solo trae los centros pedidos.
- Las opciones del filtro: los `clinicIds` de esa primera respuesta, con nombre desde las filas o
  desde la lista de centros.

## Módulos migrados

| Módulo | Endpoints | Estado |
|---|---|---|
| Pacientes | `GET /patients`, `GET /patients/:id`, `GET /patients/priority-flags` (y MCP `list_patients`, `get_patient`, `list_priority_flags_of_patients`) | BE listo (PR de Pacientes) |

### Pacientes: qué cambia en el FE (después del PR #114)

El #114 sigue funcionando tal cual: manda `centerIds` con todos los centros legibles, y eso da el
mismo resultado. Para simplificar, cuando el PR del BE esté desplegado:

1. `app/(app)/patients/page.tsx`: dejar de pedir `getCentrosDondePuedo("pacientes.read")` y de
   esperar a que cargue. Llamar sin `centerIds`, y con `centerIds` solo cuando el filtro acota.
   Tomar columna y filtro de `meta.clinicScope`.
2. Usar `clinicName` de la fila en vez de cruzar con la lista de centros.
3. `patientRecordHref` (`lib/pacientes/center-scope.ts`): el `?centro=` ya no hace falta, porque la
   ficha se encuentra por id en todo el alcance. Se puede dejar para no romper enlaces guardados;
   el BE lo sigue aceptando como `centerIds`.
4. `app/(app)/patients/[id]/layout.tsx`: `getPaciente(id)` sin `centerIds`.

## Sin cambios

- Crear un paciente sigue creando en el centro de la sesión (la barra superior).
- Dinero (facturas, cobros, caja): sigue siendo de un centro.
