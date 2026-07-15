# Handoff BE — Editar la cabecera de un BORRADOR sin descartar (POS Facturación General)

> ## ✅ RESUELTO POR BE (2026-07-15) — desplegado (PR #80)
> **`PUT /facturas/:id/cabecera`** — body `EditarCabeceraDto` (todos opcionales):
> `{ pacienteId?, medicoId?, medioId?, facturarANombre?, facturarADocId?, facturarATipo? }`
> - **AUSENTE = no tocar**; **`null` = limpiar** (medico/medio/facturarA*). `pacienteId` no admite null.
> - **Solo en `borrador`** (400 si no). Valida centro (el paciente nuevo debe ser del mismo `clinicId`).
> - Devuelve la factura **proyectada** (misma shape que `GET /facturas/:id`, con `items[]`/`componentes`).
> - `PUT /facturas/:id/paciente` sigue existiendo (subconjunto). MCP: `editar_cabecera_factura`.
> - Verificado E2E: set medioId + facturarANombre/tipo en un borrador → devuelve la proyección. 950/950 tests.
>
> **Acción FE:** cablear los selectores de médico/referido/tercero del header a este PUT (reusar los de VentaGeneral).

---


**Problema.** Hoy, una vez creada la factura (borrador), el FE **solo** puede corregir el paciente
(`PUT /facturas/:id/paciente`). Si el cajero se equivocó de **médico**, **referido/medio** o del
**tercero** a quien se factura, la única salida es **descartar** todo y empezar de cero. Es impráctico
y peor que el CMA viejo, donde toda la cabecera es editable en cualquier momento.

El FE ya resolvió el cambio de **paciente** in-place (commit `f7cae3b`, en prod). Falta poder editar el
resto de la cabecera **sin descartar**.

## Lo que necesito del BE

Extender el endpoint existente a un **PUT de cabecera** que acepte campos **opcionales** y solo aplique en
estado `borrador`. Dos opciones (elige la que te sea más limpia):

### Opción A (recomendada) — nuevo endpoint dedicado
```
PUT /api/v1/facturas/:id/cabecera        (RBAC: mismo permiso que crear/editar factura)
```
Body (`EditarCabeceraFacturaDto`), **todos opcionales**, solo se aplican los presentes:
```jsonc
{
  "pacienteId":       "uuid",     // reemplaza al actual (ya soportado en /paciente)
  "medicoId":         "uuid|null",// null = "Sin médico asociado"
  "medioId":          "uuid|null",// referido/medio; null = sin referido
  "facturarANombre":  "string|null",
  "facturarADocId":   "string|null",
  "facturarATipo":    "persona|empresa|null"
}
```

### Opción B — ampliar el DTO actual
Reusar `PUT /facturas/:id/paciente` renombrando el DTO a `EditarCabeceraFacturaDto` con los mismos campos
opcionales de arriba (retrocompatible: `{ pacienteId }` sigue funcionando).

## Reglas
- **Solo en estado `borrador`.** Si la factura está emitida/anulada → `400` (igual que el PUT de paciente hoy).
- Cada campo es **opcional e independiente**: enviar solo `{ medicoId }` cambia el médico y no toca lo demás.
- `null` explícito = **limpiar** (médico/medio/tercero → sin dato). Campo **ausente** = no tocar.
- Multi-tenant: respetar `X-Tenant-ID` (centro de la factura), igual que el resto de escrituras.
- Validar que `medicoId`/`medioId`/`pacienteId` pertenezcan al centro (como en `CreateFacturaDto`).
- La respuesta debe ser la **factura proyectada** (misma shape que `GET /facturas/:id`: paciente, medico,
  empresa, etc.) para que el FE refresque el header sin un segundo GET.
- Comentar el DTO/campos (norma de comentarios en Fields).

## Lo que hará el FE en cuanto exista (cero dudas)
Selectores editables en el header del editor (solo borrador), cableados a este PUT:
- **Médico tratante** (`/personal/por-capacidad/medico`) → `medicoId`.
- **Referido/Medio** (`/facturacion/medios`) → `medioId`.
- **Facturar a tercero** (nombre/ID/tipo) → `facturarA*`.
Mismos componentes que ya usa el alta (`VentaGeneral`), reutilizados — no se duplica código.

## Contexto / referencia
- Alta de factura general con cabecera completa: `docs/plans/fe-facturacion-general-pos-handoff.md`.
- Cambio de paciente ya implementado (FE): `cambiarPacienteFactura` → `PUT /facturas/:id/paciente`.
- El legacy que se busca igualar en practicidad (no en diseño): `cma/vistas/msprods/msprods-add.php`
  (cabecera con Médico / Referido / paciente editables vía modal en todo momento).
