# «Ahora mismo» de la oficina — handoff BE → FE

**Fecha:** 2026-11-04 · **BE:** PR #451 (en producción). Spec BE:
`cmr-be/docs/specs/ahora-mismo-de-la-oficina.md`. Inventario del tablero del legado, cifra por cifra:
`cmr-be/docs/specs/ahora-mismo-inventario-del-legado.md`.

## Qué pide el dueño

Desde el 4-nov Caguas trabaja en el sistema nuevo, y su columna del tablero del legado
(`http://192.130.74.115/cmr/ahoramismos`) quedó a oscuras: «no se sabe nada». Hace falta la pantalla
que diga **en vivo qué pasa en cada oficina**, como aquel tablero, con un uso de la pantalla completo.

## Endpoints (v2, en producción)

Todos exigen `ahora-mismo.read`.

| Llamada | Qué devuelve |
|---|---|
| `GET /api/v2/right-now` | El día del centro activo |
| `GET /api/v2/right-now?centerIds=a` | El día del centro `a` |
| `GET /api/v2/right-now?centerIds=a,b` | Lo mismo que `/right-now/centers?centerIds=a,b` |
| `GET /api/v2/right-now/centers` | `{ date, centers: [ { clinicId, name, …día } ], combinado }` con todos los centros que el usuario puede leer (admin: todos los activos). Un centro nuevo aparece solo. |
| `GET /api/v2/right-now/stream` | SSE de invalidaciones: al recibir una, volver a pedir el snapshot (con *debounce*). |

- `date=YYYY-MM-DD` es opcional. Sin él, cada centro muestra **su** hoy, en su zona horaria.
- `centerIds` solo **acota**: pedir un centro sin permiso da 403 `CENTROS_NO_AUTORIZADOS`.

## Forma de la respuesta

Nombres copiados de la respuesta **real** de producción en v2 (Caguas, 4-nov, ~13:45), no del DTO.

**`patients`** (consultas médicas). Presente = llegó **y** tiene récord, como en el legado.

```
{ present, firstVisit, followUp, attended, pending }
```

**`services[]`** (servicios especializados). Ya vienen en el orden del catálogo y sin los que no
tienen nada ese día.

```
{ serviceId, name, color, icon, total, waiting, inCare, completed,
  staffOnDuty: string[],
  waitingList:   [{ medicalRecordNumber, patient, since }],
  completedList: [{ medicalRecordNumber, patient, attendedBy, startedAt, endedAt }] }
```

- `waitingList` va por orden de llegada.
- `completedList` va del último al primero.
- **Ojo:** el récord sale como `medicalRecordNumber`, no `record`.

**`doctors[]`**. Ranking por atendidos. `net` es lo facturado ese día con el médico menos lo
devuelto ese día de sus facturas.

```
{ doctorId, name, total, attended, firstVisit, followUp, net }
```

**`sales`**. `megagrupos` son los grupos raíz de `billing_groups`. Hoy todos son raíz; el dueño quiere
**un solo monto** en el tablero por ahora.

```
{ invoices, bruto, devuelto, neto, refunds,
  sellers: [{ userId, name, total }],
  megagrupos: [{ slug, neto, invoices }], … }
```

**`prescriptions`**. Llega **vacío** hasta que el EHR mande las recetas. El dueño quiere la sección en
pantalla igual, con su estado vacío.

```
{ source: 'ehr', available: false, ranking: [] }
```

**`calls`**. Hoy todo vale 0: las centrales están en Bayamón y aún no hay agente que empuje las
llamadas a la nube. Mostrar la sección con sus ceros.

```
{ byPbx: [{ pbx, total, inbound, outbound, missed, answerRate }],
  consolidated: { total, inbound, outbound, missed, answerRate },
  ranking: [{ extension, name, answered, outbound }] }
```

`answerRate` va de 0 a 1.

Siguen viniendo también `appointments`, `frontdesk`, `caja` y `alerts`.

## Lo que pide la pantalla

Tomando como referencia el tablero del legado, en el diseño actual del FE y a pantalla completa:

- **Una columna por centro.** Salen de `/right-now/centers`, nunca de una lista fija en el FE.
- **Arriba, los totales combinados**, de `combinado`. Es en español: así lo sirve v2 hoy, deuda de traducción del BE. Si cambia, se avisa antes.
- **Por centro:**
  - Ventas: un solo monto neto, el número de devoluciones y los tres mejores vendedores.
  - Pacientes: presentes, primera vez, seguimiento y la barra de atendidos frente a pendientes.
  - Ranking de médicos.
  - Recetas, aunque estén vacías.
  - Servicios: en espera, en atención y completados por servicio, con quién atiende. Al pulsar
    «en espera» o «completados» se abre su lista.
- **Llamadas:** consolidado y ranking de operadoras.
- **Refresco** por el SSE de `/right-now/stream`, no por sondeo cada pocos segundos: el cupo es de
  100 peticiones por minuto por persona.

## Menú

El ítem `ahora-mismo` (permiso `ahora-mismo.read`, grupo monitoreo) **no está en el menú** a
propósito, porque una opción que apunta a una página inexistente da 404. **Cuando la página esté
publicada, avisa al BE**: lo devuelvo al catálogo con la ruta que me digas y lo doy de alta en
producción.

## Ficha de personal: la extensión

Campo nuevo en `GET` / `POST` / `PUT /api/v2/staff…` (`/personal`): `extension` (texto, máximo 20).

- Es **única**: dar a alguien una extensión que ya tiene otra persona devuelve 409.
- Hace falta en el formulario de la ficha: es con lo que el ranking de operadoras pone nombre a cada
  llamada.
- Desde el legado ya se cargaron las de Caguas. Las de las operadoras de Bayamón aún faltan.

## FE — hecho (2026-11-04)

**Ruta:** `/monitoring/right-now`. El BE la registra en el catálogo de menú (clave `ahora-mismo`,
grupo monitoreo). El FE no la añade a `lib/nav/manifest.ts`, porque ese grupo no es del FE: la
resuelve `routeForClave` con la ruta del BE.

**Cómo está armado:**

- **Datos:** `lib/api/right-now.ts`, con `GET /right-now/centers` sin `X-Tenant-ID`, para todos los
  centros del usuario.
  - Los tipos están copiados de la respuesta real, porque el OpenAPI la declara como `{}`.
  - **Pendiente BE:** tipar la respuesta en Swagger, para que tsc detecte la deriva.
- **En vivo:** `useCitaStream({ path: "/api/v2/right-now/stream", centroId: null, debounceMs: 800 })`.
  - Mismo cliente SSE que el tablero (`subscribeCitas` acepta `path`).
  - Si el SSE cae, el respaldo es una consulta cada 20 s, y solo con la pestaña visible.
- **Lógica pura con tests:** `lib/right-now/view.ts`, con top 3 de vendedores, barra
  atendidos/pendientes, % contestadas, servicios sin movimiento y minutos en espera.
- **Pantalla** (`components/right-now/*`), a pantalla completa:
  - arriba, los KPI de `combinado`;
  - una columna por centro, con Ventas (neto + devoluciones + top 3), Pacientes, Médicos, Servicios
    (al pulsar «en espera» o «completados» se abre la lista) y Recetas (vacío con su estado);
  - abajo, Llamadas: consolidado, por central y ranking de operadoras.
- **RBAC:** `ahora-mismo.read`. Sin ese permiso sale «No tienes acceso».
- **i18n:** espacio de nombres `rightNow`, en es y en.
- **Ficha de personal:** campo «Extensión» (máximo 20) en `components/personal/ficha-editor.tsx`. Si la
  extensión está repetida, el BE responde 409 y se muestra como error.
