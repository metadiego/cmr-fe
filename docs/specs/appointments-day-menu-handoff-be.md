# Hand-off al BE: ítem de menú «Citas» (pantalla del día) — pieza 4 del ciclo de vida

**De:** `cmr-fe` rama `feat/citas-day-screen-ui` (plan `docs/plans/citas-day-screen-ui.md`).
**Para:** `cmr-be`, el catálogo de menú (`/me/menu`).

## Qué hace falta

El FE ya tiene la pantalla nueva **Citas** en `/scheduling/booked` (lista del día de
`GET appointments/day`). El menú lo arma el catálogo del BE; el FE solo decide grupo y orden por
`clave`. Falta **sembrar el ítem**:

| Campo | Valor |
|---|---|
| `clave` / `slug` | `appointments-day` (el FE la mapea en `lib/nav/manifest.ts`) |
| `labelKey` | `nav.appointmentsDay` (ES «Citas», EN «Appointments»; ya en `messages/{es,en}.json`) |
| ruta | `/scheduling/booked` (el FE resuelve la ruta por la clave; cualquier path del BE sirve) |
| permiso | `appointments.read` (`citas.read`) |
| grupo del BE | el mismo que `citas` (agenda) |
| visible | sí, para todos los centros |

El ítem existente `citas` **no cambia** (misma clave, misma ruta `/scheduling/appointments`): el FE ya
le cambió el texto de `nav.citas` a «Agendar cita» / «Book appointment».

Mientras el ítem no esté sembrado, un admin puede darlo de alta desde el editor de menú (la ruta está en
la paleta `lib/nav-manifest.ts`).

## Además, tras desplegar 4a

- Regenerar `lib/api/schema.d.ts` en el FE (`npm run gen:api` contra un BE con 4a). Hasta entonces, a
  mano: `lib/appointments-day/day-list.ts` (`DayListRow`), `confirmed?` en `CreateCitaPayload`,
  `CreateSesionPayload`, `agendarVariosServicios` y `bookTrain`, `allowedActions?` en `CitaFila`.
- **Orden de despliegue:** el FE de esta rama manda `confirmed` al crear citas. Los DTO del BE son
  `forbidNonWhitelisted`, así que **antes de 4a ese campo da 400**: esta rama se mezcla solo con 4a ya en
  producción.
