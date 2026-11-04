# Handoff FE: el sistema enseña el centro (alcance de lectura por permiso)

Fecha: 03-nov-2026. BE: `cmr-be/docs/specs/clinic-read-scope.md` y `docs/plans/clinic-read-scope.md`.
Serie: PR #446 (core), #447 (Pacientes) y el PR de Citas, cada uno encima del anterior. Se amplía con cada módulo que migra.

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
| Citas | `GET /appointments`, `GET /appointments/:id`, `GET /appointments/board`, `GET /appointments/count-by-day`, `GET /appointments/reports/{summary,doctor-by,times,vitals-by-nurse}` (y su MCP) | BE listo (PR de Citas). **Sin `centerIds`, todavía la sesión**: ver abajo |

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

### Citas: qué cambia en el FE

**Ojo, aquí el orden importa.** Estas pantallas eligen el centro con `X-Tenant-ID` (el tercer
argumento `centroId` de `apiFetch`), no con `centerIds`. Por eso el BE, **sin `centerIds`, sigue
leyendo el centro de la sesión**, como hoy: nada cambia al desplegarlo. Para que el sistema enseñe
todos los centros, el FE tiene que mandar `centerIds`. Cuando el FE lo mande siempre, el BE pasa
el defecto a «todos» (un PR de una línea; avisar).

Con el BE desplegado:

1. `lib/api/citas.ts` (`listCitas`, `listCitasRango`, `countByDay`) y `lib/api/tablero.ts`
   (`getTablero`): aceptar `centerIds?: string[]` y mandarlo como `?centerIds=a,b`.
   - Con un centro elegido en el selector: `centerIds=[ese]`.
   - Sin selector o con «todos»: `centerIds` = los centros donde se puede leer citas
     (`getCentrosDondePuedo("citas.read")` o el `meta.clinicScope` de una respuesta anterior).
   - Dejar de usar `centroId` (el `X-Tenant-ID`) para LEER; las escrituras no cambian todavía.
2. Pintar el centro: filas de la lista y del tablero traen `clinicId` y `clinicName`. Columna
   «Centro» cuando `meta.clinicScope.clinicIds.length > 1` (en el tablero, cuando las filas traen
   más de un `clinicId`).
3. Ficha del paciente y hub del médico (`components/clientes/ficha-tabs.tsx`,
   `acciones-paciente-sheet.tsx`, `components/personal/medico-hub-tabs.tsx`): con `centerIds` de
   todos los legibles, las citas del paciente/médico en cualquier centro, cada una con su centro.
4. `getCita(id)`: ya busca en todos los centros legibles, sin cambiar nada; trae `clinicName`.
5. Reportes de citas: igual que la lista (`centerIds`; sin él, la sesión).
6. `agenda-dia` y `cupos-libres` **no cambian**: siguen con `centroId` (son vistas de un centro).

Errores: un `centerIds` con un centro sin `citas.read` → 403 `CENTROS_NO_AUTORIZADOS`. Si se piden
varios y alguno sí vale, se devuelve lo permitido (`meta.clinicScope.filtered = true`).

## Sin cambios

- Crear un paciente sigue creando en el centro de la sesión (la barra superior).
- Dinero (facturas, cobros, caja): sigue siendo de un centro.
