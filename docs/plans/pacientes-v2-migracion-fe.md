# FE — Migración a Pacientes v2 (guía de ejecución, referencias reales)

> El BE v2 YA está desplegado en prod (estructura). Cambió el **contrato de la API** de pacientes, así que el
> FE actual se rompe en 2 puntos hasta aplicar esto: `numeroHistoria → record` y `sexo` (M/F → enum nuevo).
> Contrato completo del BE: `cmr-be/docs/specs/pacientes-v2-fe-handoff.md`. Aquí van los pasos concretos con
> **archivo:línea reales** hallados en este repo. Ejecutar en orden.

## Resumen de lo que cambió en el BE
1. **`numeroHistoria` → `record`** (mismo dato, nombre nuevo) en TODA la API de pacientes y en la proyección de
   factura. El endpoint `POST /pacientes/:id/asignar-record` NO cambió de ruta.
2. **`sexo`**: antes `"M" | "F" | "otro"`; ahora `"femenino" | "masculino" | "otro" | "desconocido"`. Además la
   respuesta trae **`sexoLabel`** ya resuelto ("Femenino", etc.) → conviene mostrar ese en vez de mapear a mano.
   El backfill del BE ya convirtió los datos viejos (M→masculino, F→femenino).
3. **Campos nuevos** (opcionales, aditivos): `telCasa, telOficina, telPref, ciudadId, estadoId, paisId,
   envDireccion, envCiudadId, envEstadoId, envPaisId, envZipcode, envioIgual, atendidoPor, fallecido,
   esTestimonio, altaOriginal, creadoPor`. `telefono` es ahora el principal/de búsqueda. `docId` NO es único.
4. **Endpoints nuevos** para selects en cascada: `GET /geo/paises`, `GET /geo/estados?paisId=`,
   `GET /geo/ciudades?estadoId=&q=`.

---

## Paso 0 — Regenerar los tipos de la API (base de todo)
`lib/api/schema.d.ts` es autogenerado. Regenerarlo trae los tipos nuevos (`record`, enum `sexo`, campos v2):
```bash
# apuntando al BE (local en :3001, o prod)
npm run gen:api
# o contra prod:
CMR_OPENAPI_URL=https://api.centrodemedicinaregenerativa.com/api/docs-json npm run gen:api
```
Tras esto, TypeScript marcará en rojo las referencias viejas (`numeroHistoria`, `sexo: "M"`) → son exactamente
las que hay que arreglar en los pasos 1 y 2.

---

## Paso 1 — Rename `numeroHistoria` → `record` (17 referencias)
Cambiar `numeroHistoria` por `record` en:

| Archivo:línea | Cambio |
|---|---|
| `app/(app)/facturacion/[id]/page.tsx:99` | `paciente?.numeroHistoria` → `paciente?.record` |
| `app/(app)/clientes/[id]/page.tsx:259` | `p.numeroHistoria` → `p.record` y `t("form.numeroHistoria")` → `t("form.record")` |
| `components/clientes/paciente-form-sheet.tsx:52` | campo tipo `numeroHistoria: string` → `record: string` |
| `components/clientes/paciente-form-sheet.tsx:68` | estado inicial `numeroHistoria: ""` → `record: ""` |
| `components/clientes/paciente-form-sheet.tsx:85` | `numeroHistoria: p.numeroHistoria ?? ""` → `record: p.record ?? ""` |
| `components/clientes/paciente-form-sheet.tsx:105` | `numeroHistoria: t(f.numeroHistoria)` → `record: t(f.record)` |
| `components/clientes/paciente-form-sheet.tsx:309-312` | label `t("numeroHistoria")` → `t("record")`; `value={form.numeroHistoria}` → `form.record`; `set("numeroHistoria", …)` → `set("record", …)` |
| `components/tablero/nueva-cita-modal.tsx:244` | `.numeroHistoria` → `.record` |
| `lib/api/pacientes.ts:57` | comentario (opcional) |
| `messages/es.json:442` | clave `"numeroHistoria": "Número de historia"` → `"record": "Número de record"` |
| `messages/en.json:442` | clave `"numeroHistoria": "Record number"` → `"record": "Record number"` |

> Ojo: en el envío de create/update, ahora manda `record` (no `numeroHistoria`), o el BE responde 400
> (rechaza campos desconocidos).

Verificar 0 restantes:
```bash
grep -rn "numeroHistoria" app components lib messages --include='*.ts' --include='*.tsx' --include='*.json'
```

---

## Paso 2 — `sexo`: enum nuevo + usar `sexoLabel`
Valores nuevos: `femenino | masculino | otro | desconocido`.

| Archivo:línea | Cambio |
|---|---|
| `components/clientes/paciente-form-sheet.tsx:247-249` | `SelectItem value="M"` → `"femenino"`, `"F"` → `"masculino"`, `"otro"` igual; **añadir** `<SelectItem value="desconocido">` |
| `app/(app)/clientes/[id]/page.tsx:315-317` | reemplazar el `if (sexo === "M")…` por mostrar directamente `p.sexoLabel` de la API (más simple), o mapear los 4 valores nuevos |
| `messages/es.json:432-434` y `en.json` | mantener `sexoM/sexoF/sexoOtro` como labels o migrar a claves por valor; **añadir** `sexoDesconocido` |
| `components/clientes/paciente-form-sheet.tsx:44,77,97` | el tipo `Sexo` sale de `schema.d.ts` regenerado → ya trae los valores nuevos |

Recomendado: en la vista de detalle usa **`p.sexoLabel`** (viene resuelto del BE) y evita el mapeo manual.

Verificar:
```bash
grep -rn '"M"\|"F"' components/clientes app/\(app\)/clientes --include='*.tsx' | grep -i sexo
```

---

## Paso 3 — (Opcional, incremental) Campos v2 y geo
No rompen nada; adoptar cuando toque el rediseño del form (ver layout en `cmr-be/docs/specs/pacientes-v2-fe-handoff.md`):
- **3 teléfonos**: `telefono` (principal/búsqueda), `telCasa`, `telOficina` + `telPref` (`principal|casa|oficina|whatsapp`).
- **Direcciones estructuradas** (residencia + envío) con selects en cascada usando `GET /geo/paises` →
  `/geo/estados?paisId=` → `/geo/ciudades?estadoId=&q=` (typeahead). Enviar `ciudadId/estadoId/paisId` y `env*`.
- **`atendidoPor`** (operadora), **`medico`** — enviar `atendidoPor`/`medicoId` (UUID); el BE los devuelve resueltos.
- Flags: `fallecido`, `esTestimonio`. Provenance solo-lectura: `altaOriginal`, `creadoPor`.
- Búsqueda: el `q` de `GET /pacientes` ahora también busca por **teléfono** y `record`/`docId`.

---

## Checklist FE
- [x] `npm run gen:api` (schema.d.ts regenerado, contra prod).
- [x] Paso 1: 0 referencias a `numeroHistoria` (grep limpio). Write de `record` verificado en prod (PUT 200 + persiste).
- [x] Paso 2: selects/labels de sexo con valores nuevos (`femenino/masculino/otro/desconocido`).
      **Ojo:** `sexoLabel` viene `null` para datos legacy → el detalle mapea el enum localmente, no depende de `sexoLabel`.
- [x] `tsc --noEmit` verde (0 errores).
- [x] Crear/editar paciente sin 400: contrato de escritura de `sexo` verificado (enum→200, legacy `"0"`→400).
      **Blindaje añadido:** `SEXO_VALUES` + coerción en `fromPaciente` — un valor legacy se omite en el submit
      (no re-envía `"0"` → no 400; el BE conserva el legacy). Ver `paciente-form-sheet.tsx`.
- [ ] (Opcional) campos v2 + geo en el rediseño del form.

## ⚠️ Bloqueo de datos → BE (no bloquea el FE)
El backfill v2 de `sexo` **no corrió en prod** (datos siguen en `"0"/"1"`) y `sexoLabel` no los resuelve.
Detalle + repro + pedido en `docs/specs/pacientes-v2-sexo-backfill-handoff-be.md`. El Sexo de pacientes
existentes se verá "—" hasta que el BE corra el backfill.
