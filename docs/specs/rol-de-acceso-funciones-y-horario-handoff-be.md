# Handoff BE → FE: Rol de acceso, Funciones y Horario (PR 2 del programa)

Al día el **28-nov-2026**. Todo el backend de abajo está **en producción**: cmr-be #735 (rol «Clínico»,
Funciones, Cambios de un día), #736 (centro de origen), #738 (Horario con `staff.update`); cmr-fe #167
(etiqueta `positions.clinical`). Spec de negocio: `cmr-be/docs/specs/access-skills-and-usual-week.md`.
Programa: `cmr-be/docs/plans/role-functions-and-learning-schedule.md` (PR 2 = estas pantallas).

**Nada de esto cuenta cupo ni llena selectores todavía** (eso es el PR 3 del backend, §6). Las pantallas
solo muestran y editan los datos.

## 1. Las decisiones del dueño que dan forma a las pantallas

- **Rol de acceso** (qué puede abrir, por centro) y **Funciones** (qué hace la persona, sin centro) son dos
  cosas separadas. Una función nunca abre una pantalla; un rol nunca pone a nadie en un selector.
- **«Clínico»** es un rol de acceso sin permisos para los logins de médicos, enfermeras y técnicos que no
  tenían ningún rol con permisos (29). Sirve para darles pantallas a todos de una vez desde Configuración.
  Contabilidad no lo recibe.
- **Un solo horario por persona: la agenda** (`staff_schedules`), la que ya existe. No hay tabla de horario
  nueva ni aprendizaje automático. La pantalla «Horario» de la ficha muestra y edita la agenda.
- **Editar el Horario de una persona pide `staff.update`** (quien edita su ficha). Las filas por defecto
  del **centro** (sin persona) siguen siendo configuración de reservas (`appointments.config`).
- **Cambios de un día:** el centro destino no se limita a los centros de quien lo pone (se deja así).
- **Centro de origen** de la ficha: ahora se puede cambiar (§2.5).

## 2. API (v2, envoltorio `{ data, meta }`; todas aceptan `?centerIds=` opcional)

### 2.1 Catálogo de funciones
| Método y ruta | Permiso | Cuerpo / respuesta |
|---|---|---|
| `GET /functions?includeInactive=true` | `staff.read` | `[{ slug, labelKey, name, kind: 'service'\|'task', serviceSlug, place: 'in_person'\|'any_center', active, sortOrder }]` |
| `POST /functions` | `rbac.create` (solo acceso total) | `{ slug, name, labelKey?, kind, serviceSlug?, place, sortOrder? }` |
| `PATCH /functions/:slug` | `rbac.update` (solo acceso total) | `{ name?, labelKey?, place?, active?, sortOrder? }` — `kind` y `serviceSlug` no se cambian (400) |

- Etiqueta en pantalla: `t(labelKey)` si viene; **si `labelKey` es `null`, mostrar `name`**. Solo las 8
  tareas sembradas traen `labelKey`; los servicios y cualquier función creada después, `null`.
- `place`: `in_person` = «Presencial», `any_center` = «Para cualquier centro».
- `active = false` = no se ofrece para añadir; quien ya la tiene la conserva.

### 2.2 Funciones de una persona
| Método y ruta | Permiso | Cuerpo / respuesta |
|---|---|---|
| `GET /staff/:id/functions` | `staff.read` | `[{ slug, labelKey, name, kind, serviceSlug, place }]` |
| `PUT /staff/:id/functions` | `staff.update` en el centro de la ficha | `{ functions: string[] }` = la lista COMPLETA |

- Se mueven también solas desde las pantallas de hoy: un puesto sin permisos (médico, enfermera, técnico,
  cajero, contabilidad) añadido o quitado en la pantalla de puestos añade o quita su función; el cargo y
  las capacidades del formulario viejo de personal también.
- Quitar una función que un puesto todavía respalda da 409 `functions.backedByPosition` (§3).

### 2.3 Horario = la agenda (endpoints que ya existían; el nombre `doctors/` es histórico, vale para todos)
| Método y ruta | Permiso | Cuerpo |
|---|---|---|
| `GET /doctors/schedules?staffId=…&centerIds=…` | `staff.read` **o** `appointments.read` | — |
| `POST /doctors/schedules` | `staff.update` en `centerId` (fila de persona) | `{ staffId, centerId, dayOfWeek, startTime, endTime, active? }` |
| `POST /doctors/schedules/bulk` | ídem | `{ staffId, centerId, daysOfWeek: number[], startTime, endTime, active? }` — upsert por día **en ese centro** |
| `PUT /doctors/schedules/:id` | `staff.update` en el centro de la fila | `{ dayOfWeek?, startTime?, endTime?, active? }` — **no cambia el centro** |
| `DELETE /doctors/schedules/:id` | ídem | 204 — **desactiva** la fila (`active=false`), no la borra |

Reglas para la pantalla:
- **El centro se elige en cada fila** y se manda siempre `centerId` en el cuerpo. Si no se manda, la fila
  cae en el centro de la sesión: así nacieron filas con el centro equivocado.
- **Mover un día a otro centro** = `POST` en el nuevo centro + `DELETE` de la fila vieja (crear primero).
- **Lo que devuelve el GET con `staffId`:** las filas **propias** activas (`staffId` = la persona) y, para
  los días que la persona no tiene en un centro, las filas **por defecto de ese centro** (`staffId: null`).
  En el Horario de la ficha, mostrar las propias como su horario; las de `staffId: null`, o no mostrarlas o
  marcarlas «horario general del centro», nunca como si fueran suyas.
- Una fila desactivada en un centro cuenta como «ese día no trabaja aquí» y no sale en el GET.
- 0 = domingo … 6 = sábado. Horas `HH:mm`; la salida debe ser posterior a la entrada.
- Hay gente sin agenda (p. ej. Edwin Perez, Emmanuel Martinez e Idamys Herrera, médicos de Bayamón): su
  Horario sale vacío y se teclea.

### 2.4 Cambios de un día (nada los lee todavía; los usará el PR 3)
| Método y ruta | Permiso | Cuerpo |
|---|---|---|
| `GET /staff/:id/day-changes?from=YYYY-MM-DD` | `staff.read` | por defecto desde hoy (zona del centro de origen) |
| `PUT /staff/:id/day-changes/:day` | `staff.update` | `{ centerId \| null, startTime?, endTime?, note? }` — `null` = «no viene» |
| `DELETE /staff/:id/day-changes/:day` | `staff.update` | 204 |

- Con centro: horas las dos o ninguna (ninguna = sus horas de siempre). Sin centro: sin horas.
- Un día pasado no se puede poner ni borrar (`dayChanges.pastDay`).

### 2.5 Centro de origen de la ficha (`cmr-be/docs/specs/staff-home-center.md`)
| Método y ruta | Permiso | Cuerpo |
|---|---|---|
| `PUT /staff/:id/home-center` | `staff.update` en el centro de origen actual **y** en el nuevo | `{ centerId }` → la ficha |

- En la ficha: selector «Centro de origen» con los centros activos; enviar solo si cambia. Sin
  `staff.update` en ambos centros la API da 403: mostrar el selector deshabilitado.
- Si la ficha tiene lista propia de centros donde aparece (`serviceCenters`), el nuevo origen se añade; el
  anterior se queda hasta que alguien lo apague (`PUT /staff/:id/centers`).
- El origen es «el centro de la ficha» (listados, `clinicName`). No es dónde trabaja cada día (eso es la
  agenda) ni qué puede abrir (eso es el rol de acceso).

## 3. Errores (por `labelKey`; añadir es + en)

| labelKey | Cuándo | Datos extra en el cuerpo del error |
|---|---|---|
| `functions.unknown` | función inexistente, o inactiva que se intenta añadir | `unknown: string[]` |
| `functions.backedByPosition` (409) | quitar una función que un puesto de la pantalla de hoy todavía respalda | `blockedBy: { functions, positions }` — decir «quita antes el puesto …» |
| `functions.duplicate` (409) | slug repetido en el catálogo | `slug` |
| `functions.unknownService` | `serviceSlug` que no existe | `serviceSlug` |
| `functions.kindServiceMismatch` | `kind` y `serviceSlug` no casan | — |
| `functions.notFound` (404) | PATCH de un slug inexistente | — |
| `staff.unknownCenter` | centro de origen inexistente o inactivo | — |
| `disponibilidad.horario_imposible` | la salida no es posterior a la entrada | (ya existe) |
| `dayChanges.pastDay` | poner o borrar el cambio de un día pasado | — |
| `dayChanges.notFound` (404) | DELETE de un cambio que no existe | — |

Etiquetas de catálogo: `functions.doctor|nurse|technician|front_desk|cashier|operator|billing|accounting`
(Médico, Enfermera, Técnico, Recepción, Caja, Operadora, Facturación, Contabilidad). Ya existe
`positions.clinical` (fe#167).

## 4. Pantallas del PR 2 (lo que queda en el FE)

En la **ficha de personal**:
1. **«Rol de acceso»**: los puestos con permisos por centro (la pantalla de puestos de hoy, fe#164, sin los
   puestos sin permisos). Solo admin.
2. **«Funciones»**: chips del catálogo agrupados Servicios / Tareas, con «Presencial / Para cualquier
   centro» a la vista; edita quien tiene `staff.update`. Sale de aquí la lista mezclada de hoy.
3. **«Horario»**: la agenda de la persona por día de la semana, con **centro por fila**, horas, añadir /
   cambiar / quitar (§2.3); edita quien tiene `staff.update`.
4. **«Cambios de un día»**: lista desde hoy y alta/baja por fecha (§2.4).
5. **«Centro de origen»**: selector (§2.5).

En **Configuración › Funciones**: el catálogo con «Presencial / Para cualquier centro», activar/ocultar y
alta de funciones (solo acceso total).

Pendientes del FE que se van con este PR:
- La página en blanco del técnico sin pantallas (con «Clínico» sin permisos, sigue igual hasta que el
  dueño le dé pantallas al rol).
- Las filas de solo lectura de otro centro para gerentes.
- Retirar «Solo lectura» y «Facturación e inventario» del catálogo de puestos.
- Traducciones es + en de todo lo nuevo (§3 y los textos de las pantallas).

## 5. Datos que la pantalla encontrará (producción, 28-nov)

- 30 funciones; 288 asignaciones para 63 de 80 personas activas. MOTS-C y SERMORELIN, 0 personas.
- La agenda: el centro es correcto en casi todo (medido contra 8 semanas de citas y sesiones). Se
  corrigieron a mano: Edgardo Ortiz, Leiyani Jimenez y Yomar Perez → Bayamón; Gilberto Caraballo y Victor
  M. Ocasio → centro de origen Caguas.
- Desde #738, quienes editaban agendas solo por el rol Facturación (Edgardo Ortiz en Caguas, Michelle
  Padilla y Waldemar Ortiz) ya no editan agendas de personas: si deben, el dueño les da `staff.update`.

## 6. Lo que queda después de este PR (no es FE; para saber hacia dónde va)

- **PR 3 (BE, con ensayo en copia de producción):** el cupo de reservas, «quién está libre» y los
  selectores pasan a leer Funciones + agenda + cambios de un día (selectores: primero quien tiene la
  función y trabaja en ese centro o es «para cualquier centro»; nunca vacíos).
- **PR 4 (BE + FE):** se retira lo viejo: `job_title`, `capabilities`, `service_centers`, el `staff_role` de
  servicios/recursos y los puestos sin permisos.
- **Más adelante, si el dueño lo pide:** aprender el horario de la presencia real.
