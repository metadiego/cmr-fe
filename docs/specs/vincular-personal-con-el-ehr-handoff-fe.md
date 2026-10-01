# Vincular personal con el EHR — crear, actualizar, habilitar/deshabilitar

**BE:** PR #381 en revisión (`feat/ehr-staff-provisioning`, cmr-be), sin desplegar todavía.
**FE:** pendiente — un botón "Vincular con el EHR" en la ficha de Personal.

## Qué hace

Hasta hoy, el emparejamiento personal↔EHR solo se descubría por email (`sync`). Esto añade crear,
actualizar y habilitar/deshabilitar la cuenta del EHR de un médico/enfermera/técnico, con un clic.

**Lo de apagar/encender ya NO necesita nada del FE**: desde este mismo PR, marcar a alguien de
baja (o reactivarlo) en Personal ya avisa solo al EHR por detrás — ningún botón nuevo, ninguna
llamada nueva. Lo que SÍ falta en el FE es crear la cuenta la primera vez y editarla después.

## El rol se elige de una lista VIVA — nunca fijo en el FE

El EHR tiene roles sembrados (`Doctor`, `Nurse`, `Therapist`, `Staff`, `Admin`) **y además** los
que el propio cliente haya creado a mano allá (confirmado en vivo: ya existe uno llamado
`waldemar`). Por eso el selector de rol se llena con `GET ehr-integration/roles`, nunca con una
lista fija en el código del FE — si mañana el dueño crea un rol nuevo en el EHR, debe aparecer
sin tocar el FE.

```
GET /api/v2/ehr-integration/roles
→ { "data": [
      { "id": "...", "name": "Nurse", "description": null, "isSystem": true },
      { "id": "...", "name": "waldemar", "description": null, "isSystem": false }
    ] }
```

## Endpoints (mismo path en v1 y v2 — `ehr-integration` ya es el nombre inglés)

| Acción | Ruta | Permiso | Body |
|---|---|---|---|
| Listar roles del EHR | `GET ehr-integration/roles` | `ehr-integration.read` | — |
| Listar vínculos ya guardados | `GET ehr-integration/staff-links` | `ehr-integration.read` | — |
| Crear la cuenta (o actualizar si ya existe) | `POST ehr-integration/staff-links/:personalId/provision` | `ehr-integration.config` | `{ "ehrRoleId": "..." }` |
| Actualizar la cuenta ya vinculada | `PATCH ehr-integration/staff-links/:personalId` | `ehr-integration.config` | `{ "ehrRoleId"?, "fullName"? }` |
| Habilitar | `POST ehr-integration/staff-links/:personalId/enable` | `ehr-integration.config` | — |
| Deshabilitar | `POST ehr-integration/staff-links/:personalId/disable` | `ehr-integration.config` | — |

`GET staff-links` responde (**ojo, `nombre` se traduce a `name` en v2**, como el resto del API):

```
v1: { "data": [{ "personalId": "...", "nombre": "...", "ehrUserId": "...", "ehrEmail": "..." }] }
v2: { "data": [{ "personalId": "...", "name": "...",   "ehrUserId": "...", "ehrEmail": "..." }] }
```

`POST .../provision` devuelve `{ "ehrUserId": "...", "created": true|false }` — `created: false`
significa que ya estaba vinculado y solo se actualizó el rol, **nunca** se creó una cuenta
duplicada.

## Qué pasa al crear — un correo REAL, no hay forma silenciosa

`provision` manda, del lado del EHR, un correo de verdad invitando a esa persona a poner su
contraseña (confirmado leyendo el código del EHR — no es un efecto nuestro, es cómo funciona su
`POST /users/invite`). **Avisar esto en la UI antes de confirmar** — algo como «se le enviará un
correo a {email} para que active su cuenta en el EHR» — para que quien hace clic no se sorprenda.

## Qué tocar en el FE

En la ficha de Personal (`/configuration/staff` o la ficha individual, donde ya se edita
cargo/email):

- **El botón va en TODA ficha de Personal, sin excepción** — médico, enfermera, técnico o
  cualquier otro cargo: cualquiera puede necesitar la cuenta, no es exclusivo de un rol. Decisión
  del dueño, 01-oct-2026.
- **Sin vínculo todavía**: botón «Vincular con el EHR» → abre un selector de rol (poblado con
  `GET ehr-integration/roles`) **con una sugerencia PRE-MARCADA**, nunca elegida en silencio:
  comparar `personal.cargo` contra los `name` de la lista, sin acentos y en minúscula
  (`medico`→`Doctor`, `enfermera`→`Nurse`, `tecnico`→`Therapist` o `Staff` — a falta de un match
  exacto, no marcar nada y dejar que elijan). Es una sugerencia de UI local, recalculada cada vez
  contra la lista viva — no se guarda ni se vuelve una regla fija. Confirma → `POST
  .../provision`. Mostrar el aviso del correo antes de confirmar (ver arriba).
- **Ya vinculado**: mostrar el email/rol del EHR (de `GET staff-links`), con un botón «Editar»
  que permite cambiar el rol (`PATCH`) — sin pedir de nuevo el correo, eso no cambia.
- **Habilitar/Deshabilitar**: **no hace falta ningún botón nuevo** — ya ocurre solo al marcar a la
  persona de alta/baja, como se explicó arriba. Si se quiere mostrar el estado (activo en el EHR
  sí/no) como referencia visual en la misma ficha, es decisión de diseño, no requisito.

## Pendiente de verificar en vivo (aún no desplegado)

El PR #381 todavía no está mezclado — en cuanto se despliegue, se confirma por HTTP real contra
producción que los shapes de arriba coinciden exactamente, y se actualiza esta nota.

Razón completa: `cmr-be/docs/specs/vinculo-personal-con-el-ehr.md`.
