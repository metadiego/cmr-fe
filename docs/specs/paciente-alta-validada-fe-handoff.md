# FE Hand-off — Alta de paciente validada (récord sin duplicados + obligatorios por centro)

> BE: `docs/specs/paciente-alta-validada.md`, PR metadiego/cmr-be#231 (mezclado 2026-08-02).
> FE implementado en cmr-fe branch `feat/paciente-alta-validada` (este documento describe el
> contrato para referencia y para futuros consumidores).

## Contrato nuevo (REST v1, tenant-scoped, RBAC)

| Método | Ruta | RBAC | Respuesta |
|---|---|---|---|
| GET | `/api/v1/pacientes/record/:record` | `pacientes.read` | `{ record, disponible, dueno }`; `dueno = { id, nombres, apellidos, record, activo } \| null`. **Exige centro**: sin `X-Tenant-ID` con scope global → 400 `TENANT_REQUIRED`. |
| GET | `/api/v1/pacientes/config-alta` | `pacientes.read` | `{ camposObligatorios: string[] }` — efectiva del centro (fila propia → default `['telefono','zipcode','sexo']`). |
| PUT | `/api/v1/pacientes/config-alta` | `pacientes.config` (solo admin) | Igual shape; body `{ camposObligatorios }` con vocabulario validado (campos del CreatePacienteDto). |

## Errores de dominio nuevos (envelope `error`)

- **409 `PACIENTE_RECORD_DUPLICADO`** — labelKey `pacientes.record_duplicado`, payload `dueno`
  (mismo shape de arriba). Sale de `POST /pacientes` y `PUT /pacientes/:id` cuando el récord
  pertenece a OTRO paciente del centro. Conservar el récord propio no es conflicto.
- **400 `PACIENTE_CAMPOS_OBLIGATORIOS`** — labelKey `pacientes.campos_obligatorios`, payload
  `campos: string[]` (los faltantes). En create exige presencia; en update solo rechaza VACIAR.

## Reglas que el FE debe respetar

1. Los campos requeridos se leen de `config-alta` — **nada hardcodeado**; el BE es la última defensa.
2. El chequeo de récord se hace **solo con centro elegido** (el mismo número en otro centro es otra
   persona); debounce ~400 ms; el 409 del guardado es el fallback de la carrera.
3. La alerta de duplicado muestra nombre y estado (activo/inactivo) del dueño y bloquea el submit.
4. Dejar el récord vacío es válido (se puede asignar el consecutivo luego con
   `POST /pacientes/:id/asignar-record`).
5. i18n: traducir por `labelKey` (`pacientes.*`); el 400 de obligatorios trae `campos` para nombrarlos.

## Implementación de referencia (cmr-fe, branch `feat/paciente-alta-validada`)

- `components/clientes/paciente-form-sheet.tsx` — requeridos dinámicos, chequeo debounced,
  alerta destructiva, fallback 409 keyed por centro+récord, reset tras guardar.
- `components/ui/alert.tsx` — Alert reusable (shadcn); usar este, no copiar el patrón viejo.
- `lib/api/pacientes.ts` — `getRecordDueno`, `getConfigAltaPacientes` (tipos locales hasta
  regenerar `schema.d.ts` con `npm run gen:api` contra el BE desplegado).
- `messages/es.json` / `en.json` — `patients.form.recordDuplicado*`, `camposFaltantes`,
  `pacientes.record_duplicado`, `pacientes.campos_obligatorios`.

## Despliegue

BE y FE **juntos**: los obligatorios default aplican apenas despliega el BE. Post-deploy BE:
correr `npm run seed:rbac` contra prod (permiso nuevo `pacientes.config`).
