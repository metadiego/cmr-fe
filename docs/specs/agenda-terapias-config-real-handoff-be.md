# Handoff BE — crear la configuración REAL de recursos (para verificar la Pantalla 2)

**De:** cmr-fe. **Para:** cmr-be. **Fecha:** 2026-09-26.
Continúa `HANDOFF-FE-agenda-de-terapias.md`. Los endpoints ya están desplegados y verificados por el FE.

## Estado (verificado por HTTP, no supuesto)

- `GET /api/v2/resources` → **200**, hoy **vacío** (0 recursos).
- `GET /api/v2/resources/availability?...` → **200** con `configured: false` (porque no hay recursos ni
  consumo declarado para ningún servicio).
- `POST /api/v2/resources/patient-day` → **201**, forma correcta.
- El FE ya tiene la Pantalla 1 (Configuración → Recursos): CRUD de recursos + editor de «consumo por
  servicio». Desplegado.

## Lo que pido

**Que el BE cree la configuración REAL** (tú tienes la información del negocio; yo no la invento). Con eso
`availability` devolverá huecos de verdad y podré construir y **verificar en pantalla** la Pantalla 2
(programar el día del paciente con las horas que parpadean). Sin al menos un recurso + su consumo, la
Pantalla 2 no tiene nada real que mostrar.

Lo que el propio handoff ya describe como el cuadro real (para que no lo invente el FE):

- **Rooms de láser**: capacidad 5, `sequential`. APEX ocupa uno de esos rooms.
- **Room compartido** (NPT / GLP-1 / NEUROCATCH se pelean por uno): capacidad 1, `sequential`.
- **Sillas de suero**: 7, `simultaneous`, tope 90 min/paciente; varias terapias a la vez al mismo paciente.
- **Transcraneal**: `blocking: false` (casco que se lleva durante el suero — ocupa su puesto, no al paciente).
- **Doctora de EMPOWER**: recurso tipo persona, `blocksStaffAgenda: true`.
- Y el **consumo por servicio** de cada terapia (qué recurso usa, minutos, `per: session|area`): láser por
  área, etc.

Créalo por los endpoints reales (`POST /resources` + `PUT /resources/services/:id`), no por seed/SQL suelto,
para que quede en el mismo camino que usará la UI. Cuando esté, avísame con **un servicio de ejemplo** que
YA tenga consumo (p. ej. láser) para probar `availability` y armar la Pantalla 2 contra datos reales.

## Observado en las hojas REALES del 26-sep (Google Sheets de Bayamón y Caguas)

El dueño compartió las hojas del día. Confirman el modelo por recurso: cada hoja son **tres carriles**,
uno por recurso, y en cada HORA se apilan pacientes hasta la capacidad del recurso:

1. **LASER** — con `# AREAS` por paciente (2,4,5,7…). Hasta **5 pacientes por hora** → capacidad ~5 rooms,
   `sequential`, minutos `per: area`. APEX aparece en este carril → **APEX ocupa un room de láser**.
2. **ENDOLASER Y SUERO** — varios pacientes por hora → las **sillas** (handoff dice 7), `simultaneous`.
3. **OTRAS TERAPIAS** — con columna `TERAPIA`: **GLP1, APEX, NPT, TRANS (Transcraneal), VIT-INTRA** → el
   room compartido / recursos sueltos. `TRANS` es el casco → `blocking:false`.

Otros datos útiles: horas 7:00–16:30 (hora y media-hora), flag `CONFIRMADO` por cita, y muchas filas
`+DR`/`+DOCTOR` (el paciente además ve al médico → enlace con la agenda de consultas / staffBlocks). Un
mismo paciente aparece en Láser y en Suero a horas distintas (recursos que se suman en su día).

Estas hojas son, además, lo que un futuro motor de **citas de servicio** podría ingerir (hoy el motor de
GCP solo trae consultas; el de servicio aún no corre).

## Normas que aplican a esta entrega (recordatorio del dueño)

API-First + MCP + Swagger + configurable + multi-tenant + RBAC + comentarios en DB y en cada Field +
spec/plan + TDD + drift-clean + i18n. **Sin hardcode.** Nombres en INGLÉS (tablas, campos, endpoints,
variables). **Probar por HTTP** antes de decir que está bien; separar lo verificado de lo supuesto. Cada
endpoint puede recibir opcionalmente el array de centros para resolver permisos. Rigor **máximo**: esto
agenda pacientes.
