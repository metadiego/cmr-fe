# Handoff FE: el sistema enseña el centro (alcance de lectura por permiso)

Fecha: 03-nov-2026. BE: `cmr-be/docs/specs/clinic-read-scope.md` y `docs/plans/clinic-read-scope.md`.
Serie: PR #446 (core) y #447 (Pacientes), ya en producción; el resto (Citas y todos los demás módulos,
escrituras y gerencial) va en un solo PR del BE (`feat/clinic-read-scope-rest`) y uno del FE
(`feat/clinic-read-scope-rest`). **Orden: primero el BE desplegado, luego el FE** (el BE de antes
responde 400 a `centerIds`).

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
| Citas | `GET /appointments`, `GET /appointments/:id`, `GET /appointments/board`, `GET /appointments/count-by-day`, `GET /appointments/reports/{summary,doctor-by,times,vitals-by-nurse}` (y su MCP) | BE listo. Sin `centerIds`, **todos** los centros legibles |
| Frontdesk | sesiones (lista, por id, historial), agenda e historial del paciente, cola, reportes, ubicación en vivo | BE listo. Tablero, agenda del día, presentes, pestañas y estado de enfermería: **un centro** (`centerIds[0]` o la sesión) |
| Facturación (lecturas) | facturas (lista, por id, tablero, resumen), devoluciones, reportes, transferencias, paquetes, cambios de protocolo | BE listo. Dinero que escribe: sin cambios |
| Caja (lecturas) | cuadres (lista, por id) | BE listo. Día y cajeros: un centro |
| Precios (lecturas) | precios, ofertas; catálogo = un centro (ahora comprobado) | BE listo |
| Inventario | almacenes, ubicaciones, lotes, viales, stock (detalle, consolidado, valoración), movimientos, cierres, reportes, transferencias, compras, básculas | BE listo. Resumen de stock, kardex, movimientos de stock, reporte de viales: un centro |
| Personal, calendario, disponibilidad, medidas | personal (una fila por persona, `servesInCenters`), eventos, horarios, ausencias, festivos, medidas | BE listo |
| El resto | alertas, notificaciones, paneles, callcenter, estadísticas de servicios, captación, export, eventos EHR, print jobs, auditoría | BE listo. Tableros de paneles y cierre diario: un centro |

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

## Hecho en el FE (PR `feat/clinic-read-scope`, 04-nov-2026)

Va **después** de que el BE de Citas (#450) esté desplegado: antes, el BE responde 400 a
`centerIds` en `/appointments` (los DTO rechazan campos desconocidos).

- `apiFetchPaged` devuelve también `clinicScope` (`lib/api/client.ts`, `Paginated`).
- Pacientes: la lista carga sin esperar a la lista de centros; `centerIds` solo con el filtro; la
  columna «Centro» sale de `meta.clinicScope`; el nombre, de `clinicName`. La ficha se abre por id
  (sin `?centro=`; los enlaces viejos siguen valiendo).
- Citas: `listCitas`, `listCitasRango`, `countByDay` y `getTablero` mandan el centro elegido como
  `centerIds` y ya no cambian `X-Tenant-ID` para leer (`lib/clinic-read-scope.ts`). La ficha del
  paciente (citas, última visita, reagendamientos), las acciones del paciente y el hub del médico
  (agenda, producción) leen todos los centros legibles (`listCitasEveryCenter`), con el centro de
  cada cita cuando hay más de uno.
- Sin tocar: `agenda-dia`, `cupos-libres`, `getVisitasRecientes` y todas las escrituras.

Con esto desplegado, el BE ya puede pasar el defecto de Citas a «todos»: cada pantalla de un centro
lo nombra en `centerIds`. Al hacerlo, `listCitasEveryCenter` queda como `listCitas` a secas.

## Hecho en el FE (PR `feat/clinic-read-scope-rest`, 04-nov-2026)

La regla, en `lib/api/client.ts` (`oneCenterPath`) y `lib/clinic-read-scope.ts` (`oneCenterIds`):
**una pantalla de un centro nombra su centro** en `centerIds` (el elegido; si no, el que lleva
`X-Tenant-ID`: el activo o el de la sesión). Sin esto, con el BE nuevo enseñaría todos los centros.
Se sigue mandando `X-Tenant-ID` igual que antes.

- Un centro: almacenes (`listAlmacenes`, todos los selectores), viales abiertos, detalle de stock,
  personal y selectores de médico (`listPersonal`, `getMedicos`, `listPersonalPorCapacidad`,
  `listMedicos`), horarios, festivos, ausencias, sesiones de calendarios y vistas del día
  (`listSesionesRango` sin paciente), agenda del paciente al agendar, avisos y cola del frontdesk,
  ubicación en vivo, tablero y resumen de facturas, devoluciones, reportes de facturación, cuadres
  de caja, estadísticas de servicios, eventos EHR.
- Todos los centros (sin cambiar nada, es el defecto del BE): historial de sesiones de un paciente,
  sus facturas y sus citas (ficha y acciones), transferencias, stock consolidado sin centro.
- Sin tocar a propósito: los tableros de un centro del frontdesk (`getFrontdeskTablero`,
  `getPresentes`, pestañas, estado de enfermería) y de paneles siguen con `X-Tenant-ID` y sin
  `centerIds`; el BE sigue usando la sesión.

**Escrituras:** las de citas, pacientes, sesiones, inventario, personal, calendario, alertas y paneles
ya encuentran el registro en el alcance y escriben en **su** centro. Mandar `X-Tenant-ID` = centro
del registro sigue siendo correcto (evita que el guard mire los permisos de otro centro); no hay que
cambiarlas. Crear sigue en el centro pedido (`centroId` en el cuerpo de la cita) o el de la sesión.

**Gerencial:** con varios centros y sin cabecera ya no recibe 409: entra en su centro base y las
lecturas ven todos sus centros.

**Pendiente (FE, no bloquea):**
- Columna «Centro» donde una lista ahora puede traer dos centros: campana de alertas, notificaciones,
  transferencias, cuadres (si se quita `centerIds`), personal (`servesInCenters`).
- Retirar `useCentroPantalla` pantalla a pantalla cuando una pantalla pase a enseñar todos los centros
  con filtro (`CenterFilter`), como Pacientes.

## Sin cambios

- Crear un paciente sigue creando en el centro de la sesión (la barra superior).
- Dinero (facturas, cobros, caja): sigue siendo de un centro.
