# Handoff BE — POS General: 3 piezas que faltan (facturar a tercero · corregir paciente · multiplicadores)

> **De:** cmr-fe. **Para:** cmr-be. **Fecha:** 2026-07-15. Todo verificado en vivo (prod + local) — no asumido.
> El FE ya tiene: picker de centro, listas (`tipoPrecioId`), precio efectivo, IVU por ítem, descuentos global.
> Estas 3 piezas son del BE; **el FE espera** el contrato para construir su parte.

---

## 1. Facturar a un TERCERO (empresa u otra persona ≠ paciente)
**Requerimiento (dueño):** el paciente puede pedir la factura **a nombre de una empresa u otra persona**.
**Evidencia:** `CreateFacturaDto` y `FacturaEntity` **no tienen** ningún campo de receptor/cliente/empresa
(verificado en el OpenAPI). Hoy la factura es **solo** `pacienteId`. No aparece en ningún plan/spec.
**Contrato propuesto (a confirmar):**
- Campos en `factura` (y `CreateFacturaDto` + `PUT` para editar en borrador):
  - `facturarA?: string` (nombre / razón social del receptor),
  - `facturarADoc?: string` (RNC / ID del receptor),
  - `facturarATipo?: 'paciente' | 'persona' | 'empresa'` (default `paciente`).
- Exponerlos en `GET /facturas/:id` y en la **proyección del recibo** (para imprimir "Facturado a: …").
- Default = paciente (si no se envía, se factura al paciente como hoy).
**Preguntas sí/no:** (1) ¿Agregan esos 3 campos? (2) ¿El recibo/impresión debe mostrar el receptor? (3) ¿Aplica a Consultas también o solo General?

## 2. Corregir el PACIENTE de un borrador (o descartarlo)
**Requerimiento:** si el cajero **se equivocó de paciente**, debe poder corregirlo sin dejar basura.
**Evidencia:** **no** existe `PUT /facturas/:id` ni `PATCH` (verificado); `anular` sobre borrador → **400**;
no hay `DELETE /facturas/:id`. → hoy un borrador con paciente equivocado **queda huérfano** y no se puede arreglar.
**Contrato propuesto (elegir uno o ambos):**
- **A)** `PUT /facturas/:id { pacienteId }` — cambia el paciente del borrador (recalcula lo que aplique).
- **B)** `DELETE /facturas/:id` (solo estado `borrador`) **o** permitir `anular` en borrador → `cancelada`.
**Preguntas sí/no:** ¿A, B, o ambos? (Con A el FE ofrece "cambiar paciente" en el editor; con B, "descartar y empezar de nuevo".)
> Nota: esto también cierra el gap 2 del handoff previo `pos-item-gravado-y-descartar-borrador-handoff-be.md`.

## 3. Multiplicadores: DÍAS · ÁREAS · SESIONES · DOSIS (columnas de captura)
**Requerimiento:** en láser/suero la línea necesita capturar **días/áreas/sesiones/dosis**; el total usa
`cantidadEfectiva = cantidad × Π(multiplicadores)` (según `PLAN-FACTURACION.md` §2 y `columnas_facturacion`).
**Evidencia:** `GET /facturacion/columnas` y `?productoId=` devuelven **0** (tabla `columnas_facturacion` **VACÍA**,
prod y local). Está **diferido** en `docs/plans/facturacion-general.md` S2 ("cuando se carguen láser/suero").
**Lo que el FE necesita del BE:**
1. **Sembrar** las columnas multiplicador (rol `multiplicador`) para los grupos/productos que las usan
   (láser → áreas/sesiones; suero → días/dosis; etc.), con `clave`, `labelKey`, `rol`, `orden`, y a qué
   producto/grupo aplican. Así `GET /facturacion/columnas?productoId=` las devuelve.
2. **Documentar el CONTRATO exacto de envío**: al agregar/editar un ítem, **¿en qué campo van los valores** de
   esos multiplicadores? (¿`AgregarItemDto.personalizacion`? ¿claves sueltas? ¿un objeto `multiplicadores`?) y
   **¿el server calcula `cantidadEfectiva` y el total**, o el FE manda ya el efectivo? (el FE NO debe calcular).
3. Un **ejemplo real** (JSON) de un producto con multiplicadores + el item resultante (para que el FE lo pinte y lo mande sin adivinar).
**Preguntas sí/no:** (1) ¿Siembran las columnas ahora o esperamos a cargar láser/suero? (2) ¿Campo de envío de los valores? (3) ¿El server calcula el efectivo?

---

## Lo que hace el FE en paralelo (sin esperar BE)
- Deja el **lector genérico de columnas** listo: cuando `GET /facturacion/columnas?productoId=` devuelva filas,
  el POS pinta esos campos dinámicamente (hoy no rompe: 0 columnas = cantidad×precio). Se activa solo al sembrar.
- Mejora del flujo de paciente en lo que NO depende del BE (confirmación visible del paciente elegido).
- El resto (cambiar paciente, facturar a tercero, valores de multiplicadores) **espera** el contrato de arriba.
