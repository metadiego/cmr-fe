# Contrato BE → FE: hoja de enfermería GLP-1 en el iPad

Respuesta al handoff `glp1-hoja-enfermeria-ipad-handoff-be.md` (secciones 1–5). BE: PR en cmr-be
rama `feat/glp1-nursing-sheet-answers` (spec `cmr-be/docs/specs/respuestas-de-formatos-por-visita.md`).

**Verificado**: todos los JSON de abajo salieron de llamadas HTTP reales por `/api/v2` contra una
base LOCAL desechable (no producción), y las claves están fijadas en modo estricto en
`cmr-be/src/modules/formatos/format-answers-v2-keys.spec.ts`.
**Pendiente tras el despliegue (no está en producción hasta que se haga)**: cargar la semilla
actualizada del formato `glp1_adherencia` en cada centro (`SOLO=glp1_adherencia`, script
`cargar-formatos-del-legado.ts`) y conceder `formats.fill` / `formats.send` en la pantalla de roles.

## Decisiones que cambian lo que pidió el FE

1. **Las claves de los campos son las del FORMATO, no `weight`/`bloodPressure`.** Qué campos existen
   es dato del formato (genérico, no soldado a GLP-1), y por eso viajan como VALOR (`key`), no como
   nombre de propiedad. Para `glp1_adherencia`:

   | key | etiqueta del papel | sugerido |
   |---|---|---|
   | `paciente` | Paciente: | nombre (sale solo) |
   | `fecha` | Fecha: | fecha de la visita |
   | `peso` | Peso (lb): | báscula enlazada a la visita (lb) |
   | `ta` | T/A: | — (null) |
   | `record` | Record #: | récord |
   | `medicamento` | Medicamento: | producto vendido en el paquete de la visita |
   | `dosis` | Dosis actual: | producto aplicado en la visita, o el último aplicado en GLP-1 |
   | `semana` | Semana de tratamiento: | nº de visitas GLP-1 ASISTIDAS antes de hoy + 1 |

   La etiqueta y el `labelKey` de cada `key` están en el assembly (`fields[].clave/label/labelKey`).
2. **`fields` es un array `[{ key, value }]`**, no un objeto.
3. **Preguntas por posición** `section/group/question` (índices en `assembly.sections[section].grupos[group].preguntas[question]`).
   `section` es opcional al guardar (= la primera sección con preguntas; en GLP-1 es `0`).
4. **Por pregunta: `value` = `"yes" | "no" | null` y `note` opcional** (confirmado por el dueño 20-nov).
5. El paciente en v2 lleva **`medicalRecordNumber`** (no `record`), como en todo v2.
6. «Enviar al iPad»: el bus SSE es por CENTRO; el evento lleva `toUserId` y **el iPad filtra por su
   `staffId`** (`GET /api/v2/auth/me` → `staffId`). No existe destino por persona.
7. La lista de hoy NO es `GET /frontdesk/sessions` (no trae nombre/récord ni `sheetSaved`): es
   `GET /api/v2/formats/glp1_adherencia/sessions?date=`, que reutiliza esa lista por dentro.

## Permisos

| Acción | Permiso | Centro |
|---|---|---|
| Leer hoja, lista del día, imprimir | `formats.read` | cualquiera donde se tenga; `centerIds` acota |
| Guardar la hoja | `formats.fill` (nuevo) | el de la VISITA |
| Enviar al iPad | `formats.send` (nuevo) | el de la VISITA |

Semilla de roles: `nursing` → `formats.fill` + `formats.send`; `frontdesk` → `formats.send`.
Todas las rutas aceptan `?centerIds=a,b` (opcional).

## 1. Leer la hoja (pre-llenado incluido)

`GET /api/v2/formats/glp1_adherencia/sessions/:sessionId/answers` → **siempre 200**.

```json
{
  "formatSlug": "glp1_adherencia",
  "sessionId": "a444…",
  "clinicId": "b000…",
  "clinicName": "Bayamón",
  "saved": false,
  "fields": [],
  "answers": [],
  "additionalNotes": null,
  "nurseId": null,
  "recordedAt": null,
  "updatedBy": null,
  "updatedAt": null,
  "suggested": {
    "fields": [
      { "key": "paciente", "value": "Ana Ruiz" },
      { "key": "fecha", "value": "2026-11-20" },
      { "key": "peso", "value": "211.6" },
      { "key": "ta", "value": null },
      { "key": "record", "value": "77" },
      { "key": "medicamento", "value": null },
      { "key": "dosis", "value": null },
      { "key": "semana", "value": "1" }
    ],
    "patient": { "id": "a111…", "name": "Ana Ruiz", "medicalRecordNumber": "77" },
    "date": "2026-11-20",
    "nurse": { "id": "a333…", "name": "Marta Díaz" }
  }
}
```

Con hoja guardada: `saved: true` y `fields`, `answers`, `additionalNotes`, `nurseId`,
`recordedAt` (ISO UTC), `updatedBy` (staff id), `updatedAt` llenos. Lo guardado gana: el FE pinta
`fields[key]` si existe, si no `suggested.fields[key]`. `suggested.nurse` = enfermera asignada a la
visita (o `null`). Sin medida/paquete/producto el sugerido es `null`, nunca `0`.

Errores: `404` visita fuera de los centros con `formats.read` (o formato inexistente en su centro);
`403 CENTROS_NO_AUTORIZADOS` si `centerIds` pide solo centros no permitidos.

## 2. Guardar la hoja

`PUT /api/v2/formats/glp1_adherencia/sessions/:sessionId/answers`

```json
{
  "fields": [ { "key": "peso", "value": "212.4" }, { "key": "ta", "value": "120/80" } ],
  "answers": [
    { "group": 0, "question": 0, "value": "yes" },
    { "group": 0, "question": 1, "value": "no", "note": "refrescos" }
  ],
  "additionalNotes": "Paciente estable",
  "nurseId": "<staff uuid>",
  "recordedAt": "2026-11-20T14:30:00-04:00"
}
```

- Todo opcional. Lo que no se manda se conserva; un array que se manda **reemplaza** al guardado
  (mandar siempre la hoja entera desde el iPad).
- `value`: `"yes" | "no" | null`. `note` ≤ 1000, `additionalNotes` ≤ 4000, `value` de campo ≤ 500.
- `recordedAt` ISO 8601 con offset. `updatedBy` lo pone el BE con el token.
- Respuesta: la misma forma del GET (con `saved: true`).
- Se puede guardar las veces que haga falta; cada guardado queda en el registro de cambios
  (`format_answer_create` / `format_answer_edit`).

- Solo se valida lo que el PUT manda: si el formato perdió una pregunta después de guardar, un PUT
  con solo `nurseId`/`additionalNotes`/`recordedAt` pasa; un `answers` con esa posición da 400.
- Dos primeros guardados a la vez (dos dispositivos): el segundo se convierte en actualización del
  primero; no hay error ni código nuevo (gana lo último que llega en lo que cada uno manda).

Errores:
- `400 FORMAT_ANSWERS_INVALID` (`labelKey: formats.error.answersInvalid`): `key` que no es campo del
  formato o repetida, posición que no existe o repetida, `value` fuera de yes/no/null, o `nurseId`
  que no es personal activo del centro de la visita. El `message` dice cuál.
- `400 VALIDATION_ERROR`: tipos o longitudes del cuerpo.
- `403` sin `formats.fill` en el centro de la visita. La visita se busca donde se tiene
  `formats.read` O `formats.fill`: quien solo llena (sin leer) también la encuentra. `404` solo si
  la visita no está en ninguno de esos centros.

## 3. Imprimir con lo guardado

`GET /api/v2/formats/glp1_adherencia/assembly?sessionId=` (sin cambios de ruta). Con hoja guardada:

- `fields[i].valor` = lo guardado para su `clave` (si se guardó).
- `sections[0].grupos[g].preguntas[q]` = `{ "texto": "…", "value": "yes"|"no"|null, "note": "…"|null }`.
- la sección `texto_libre` lleva `"text": "Paciente estable"`.
- `sections[2].lineas` = `[{ "label": "Firma de enfermería", "origen": "answers.nurse", "valor": "Marta Díaz" }, { "label": "Fecha y hora", "origen": "answers.recordedAt", "valor": "2026-11-20 14:30" }]`
  (hora local del centro; fecha en el formato del papel si declara `render.formatoFecha`).

Sin hoja guardada sale como hoy. Ojo: dentro de `fields`/`sections` las claves NO se traducen en v2
(son opacas), por eso `clave`, `valor`, `grupos`, `preguntas`, `texto` siguen en español y las
nuevas (`value`, `note`, `text`, `suggestFrom`) en inglés. Los campos llevan ahora `suggestFrom`
(dato del formato; el FE puede ignorarlo).

## 4. Lista de las visitas del día (portada del iPad)

`GET /api/v2/formats/glp1_adherencia/sessions?date=2026-11-20` (`date` obligatorio, YYYY-MM-DD).

```json
[
  {
    "sessionId": "a444…",
    "clinicId": "b000…",
    "clinicName": "Bayamón",
    "date": "2026-11-20",
    "time": "09:30",
    "status": "presente",
    "patient": { "id": "a111…", "name": "Ana Ruiz", "medicalRecordNumber": "77" },
    "nurse": { "id": "a333…", "name": "Marta Díaz" },
    "sheetSaved": true,
    "savedAt": "2026-11-20T18:48:33.118Z"
  }
]
```

Sin canceladas; ordenado por hora (las sin hora al final). `status` es el estado del frontdesk
(`pendiente|presente|en_terapia|asistido`, valores aún en español).

## 5. Enviar al iPad

`POST /api/v2/formats/glp1_adherencia/sessions/:sessionId/send` con `{ "toUserId": "<staff uuid>" }`
→ `201`:

```json
{ "sent": true, "formatSlug": "glp1_adherencia", "sessionId": "a444…", "toUserId": "a333…", "clinicId": "b000…" }
```

Evento en el bus que ya usa el FE (`/api/v2/tablero/stream`, `useCitaStream`), canal = centro de la
visita (el iPad debe estar suscrito a ESE centro con `X-Tenant-ID`):

```
data: {"channel":"b000…","entity":"format_sheet","id":"<sessionId>","action":"open_requested",
       "status":{"formatSlug":"glp1_adherencia","sessionId":"a444…","toUserId":"a333…",
                 "requestedBy":"<staff id o null>",
                 "patient":{"id":"a111…","name":"Ana Ruiz","medicalRecordNumber":"77"}},
       "actorId":"<staff id o null>","version":1795200543487,"ts":"2026-11-20T18:49:03.487Z"}
```

El iPad: `entity === "format_sheet" && status.toUserId === me.staffId` → abrir
`/forms/glp1/<status.sessionId>` (o la ruta de `status.formatSlug`).

La visita se busca donde se tiene `formats.read` O `formats.send` (igual que el PUT).

Errores: `400 FORMAT_SEND_TARGET_INVALID` (`formats.error.sendTargetInvalid`): `toUserId` no es
personal activo, sin cuenta (login) o no sirve en el centro de la visita. `403` sin `formats.send`
en el centro de la visita. `404` como en el GET.

## 6. Abrir al pesar

Cuando una medida (báscula o cinta) queda enlazada a una visita (por el atajo del iPad
`scale`/`scale-image`, por el enlace automático o a mano) se publica, en el mismo bus:

```
data: {"channel":"b000…","entity":"body_measurement","id":"<reading id>","action":"linked",
       "status":{"kind":"scale","sessionId":"a444…","serviceId":"a222…","date":"2026-11-20",
                 "patient":{"id":"a111…","name":"Ana Ruiz","medicalRecordNumber":"77"}},
       "actorId":null,"version":1795200559614,"ts":"2026-11-20T18:49:19.614Z"}
```

Solo cuando el enlace es NUEVO (corregir la medida ya enlazada no avisa) y **solo si la medida viene
de un APARATO** (báscula/atajo del iPad, imagen de la báscula, cinta Renpho). Una medida escrita a
mano en la visita (`PUT /body-measurements/sessions/:id`, `source = manual`) NO publica nada. Es por centro y no lleva
destinatario: el FE decide si mostrar «Ana Ruiz acaba de pesarse — abrir hoja» (p. ej. si
`serviceId` es el del servicio GLP-1 o si el iPad está en la portada de la hoja).

## 7. Borrar una visita que tiene hoja guardada

`DELETE` de la visita en el frontdesk (patient-desk) cuando tiene una hoja guardada → **409**, y no
se toca nada (ni historial, ni asiento, ni registro de cambios):

```json
{ "error": { "code": "FRONTDESK_SESSION_DELETE_BLOCKED",
             "labelKey": "frontdesk.error.sessionDeleteBlocked",
             "message": "the visit cannot be deleted: the visit has a saved 'glp1_adherencia' sheet",
             "blockedBy": [ { "kind": "format_sheet", "detail": { "formatSlug": "glp1_adherencia" } } ] } }
```

Una hoja clínica llenada no desaparece con su visita. Si de verdad hay que borrar la visita, la hoja
se resuelve antes (hoy no hay endpoint para borrar una hoja: es a propósito). Cancelar la visita sí
se puede.

## Lo que el FE tiene que hacer (resumen)

- Leer la estructura (campos, preguntas, etiquetas) del assembly; leer/guardar por `…/answers`.
- Pintar `fields[key] ?? suggested.fields[key]`; mandar la hoja entera en el PUT.
- Filtrar el bus por `entity` (`format_sheet` con `toUserId === staffId`; `body_measurement`).
- Patient-desk: mostrar el 409 `FRONTDESK_SESSION_DELETE_BLOCKED` al borrar una visita con hoja.
- i18n: claves nuevas `formats.error.answersInvalid`, `formats.error.sendTargetInvalid`,
  `frontdesk.error.sessionDeleteBlocked` y, para el
  constructor de formatos, `formato.origen.session_last_dose`, `formato.origen.session_service_visit_number`,
  `formato.origen.package_product`.
