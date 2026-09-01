# Estrategia de arranque del FE (cmr-fe) — organizada por capas y dominios

> Plan aprobado por larciles (2026-06-19). Escrito desde la sesión cmr-be como hand-off; **se ejecuta en
> la sesión cmr-fe**. Memoria relacionada: `be-facturacion-anulaciones`, `be-rbac-ready-for-fe`,
> `i18n-and-english-keys-convention`.

## Contexto
El BE (cmr-be) tiene ~24 dominios y >250 endpoints listos (facturación 43, citas 22, frontdesk 18,
inventario ~15 sub-controllers, caja, consultas, pacientes, personal, alertas, mediciones, tablero,
export, MCP, auditoría…), todos multi-tenant + RBAC + Swagger. El FE ya tiene **la plataforma hecha**
(auth/login/sesión, `useCan` RBAC, `useMenu` dinámico, preferencias/theming, selector de centro, i18n
es/en, media) pero **cero UI de dominio de negocio** y **cero clientes API de dominio**. Falta una forma
ORGANIZADA de bajar ese BE al FE sin construir a mano, inconsistente y desincronizado.

Decisiones tomadas:
1. **Orden**: Pacientes → Citas → Facturación (dependencia + valor diario).
2. **Cliente API**: tipos generados desde Swagger (openapi-typescript) + wrappers fetch finos (reusa la
   plomería actual). No reescribir; no acoplar a orval.
3. **Kit de módulo primero**, luego dominios en molde.

## Estado real del FE (grounding, no asumir de cero)
- **Cliente**: `lib/api/client.ts` → `apiFetch<T>(path,init)` adjunta `Authorization: Bearer <jwt>` +
  `X-Tenant-ID` (cookie `cmr_active_centro` → fallback `app_metadata.clinic_id`) y **desenvuelve `data`**.
  ⚠️ **descarta `meta`** (paginación) y ⚠️ **no usa `labelKey`** de errores.
- **Errores**: `ApiError(code, message, status, details)` (`lib/api/types.ts`); `apiErrorMessage()` en
  `lib/api/errors.ts` → string para toast. Tipos ya definidos (`ApiEnvelope`, `ApiMeta`, `Paginated<T>`).
- **Patrón de cliente de dominio** (`lib/api/profiles.ts`, `rbac.ts`, `centers.ts`): tipos a mano +
  funciones por operación + helper `asList`/`asArray` defensivo. **No** hay openapi-typescript/orval.
- **UI**: shadcn/ui en `components/ui/` (button, input, select, tabs, dialog, alert-dialog, table, badge,
  sheet, dropdown-menu, avatar, checkbox, textarea, sonner). **No** hay `data-table`/form abstraídos.
  Patrón vigente: client components, estado discriminado `{loading|ok|fail}`, fetch en `useEffect` con
  cleanup, `toast.*` (sonner), `Dialog` como máquina de estado (ver `components/admin/users-list.tsx` y
  `invite-dialog.tsx`).
- **Plataforma**: `hooks/use-can.ts` (`can('x.y')`, soporta `*`), `hooks/use-menu.ts` + `lib/api/menu.ts`
  (GET `/me/menu`, `labelKey`, `clave` mapea a `lib/nav.ts`), `app/(app)/layout.tsx` (guard server +
  `SessionGate`), `CenterSelector`, `PresentationProvider`, `site-header.tsx`.
- **i18n**: next-intl, `messages/{es,en}.json`, namespaces, **claves nuevas en inglés**; `docs/modules/`
  documenta por módulo. (Nota: `i18n/request.ts` fija `timeZone: America/Mexico_City` y `currency: MXN`
  → revisar para RD/IVU al llegar facturación.)
- **Stack**: Next 16 (App Router), React 19, Supabase SSR, Tailwind 4, sonner, Hugeicons. **Sin test
  runner** (no jest/vitest) → verificación manual hoy.

## Fase 0 — "Kit de módulo" + cliente tipado (una sola vez, base de todo)

### 0.1 Tipos desde Swagger (openapi-typescript) + wrappers finos
- Dev dep `openapi-typescript` + script `gen:api` que lea el OpenAPI JSON del BE (Nest sirve la UI en
  `/<apiPrefix>/docs`; el JSON suele estar en `…/docs-json` — **verificar la ruta real en cmr-be
  `src/main.ts`** y exponer/usar la que aplique) → genera `lib/api/schema.d.ts`.
- Mantener `lib/api/<dominio>.ts` a mano (reusan `apiFetch`), **tipados contra los schemas generados**
  (`components['schemas']['…']`). Documentar: "regenerar `gen:api` cuando cambie el BE".
- No migrar de golpe los clientes existentes; aplicar el patrón tipado a los **nuevos** dominios.

### 0.2 Paginación + helpers en el cliente (cubrir el gap de `meta`)
- `apiFetchPaged<T>(path,init): Promise<Paginated<T>>` que **lea `meta.pagination`** (hoy se descarta) →
  `{ items, pagination }` (tipo `Paginated<T>` ya existe en `types.ts`).
- `useResource<T>()` hook: encapsula el patrón repetido (estado `{loading|ok|fail}` + `reload()` +
  cleanup). Reemplaza el `useEffect` copy-paste de cada página.

### 0.3 Errores → i18n (`labelKey`)
- Preferir `error.labelKey` (el BE lo envía, p.ej. `facturacion.anulacion.fuera_de_ventana`): helper
  `apiErrorLabel(err, t)` que traduce el `labelKey` si existe y cae a `message`. Helper `toastError(err)`.

### 0.4 Componentes del kit (`components/kit/`) — extraídos de lo existente, no inventar
- `<DataTable columns rows state onReload pagination?>` (extraer de `users-list.tsx`) con loading/empty/fail
  y footer de paginación opcional.
- `<ListToolbar>` (search + selects + rango de fechas → query state).
- `<FormDialog>` + `<Field>` (extraer de `invite-dialog.tsx`): reset-on-close + botón con loading.
- `<Can permiso>` + seguir usando `useCan`.
- `useSSE(path)` para tableros realtime (BE expone SSE: alertas `/alertas/stream`, realtime).
- `<ExportPrintMenu doc>` contra el módulo `export` transversal del BE (PDF/CSV/email/SMS).

### 0.5 Manifiesto de rutas + i18n
- Extender `lib/nav.ts`: `clave` de menú → ruta + icono para dominios nuevos (BE ya siembra
  `clientes`/`citas`; sembrar el resto en BE como hand-off).
- Un namespace i18n por dominio (`patients`, `appointments`, `billing`…), claves en inglés, doc en
  `docs/modules/<dominio>.md`.

### 0.6 (Recomendado, no bloqueante) Test runner
- El FE no tiene tests. Recomendar **Vitest** (unit del kit/clientes) + **Playwright** (E2E contra BE).
  Decisión de larciles; si no, el DoD del FE es typecheck + lint + verificación manual.

## Fases de dominio (cada una = vertical completo en molde del kit)

### Fase 1 — Pacientes (cimiento, prueba el kit)
- `lib/api/pacientes.ts`: list paginada (`apiFetchPaged`), get, create, update, búsqueda.
- `app/(app)/pacientes/page.tsx` (lista + `ListToolbar` + `DataTable` + paginación), `[id]/page.tsx`
  (detalle), `FormDialog` crear/editar. Gating `useCan('pacientes.*')`; ítem de menú `clientes` ya existe.
- i18n `patients` (inglés) + `docs/modules/patients.md`. **Es la plantilla**: al cerrarla el kit queda
  validado punta a punta.

### Fase 2 — Citas (tablero diario + realtime)
- `lib/api/citas.ts`: rango (`GET /citas?desde&hasta`), filtros `medicoId/estado/canal`, crear,
  `confirmar`, `triage`/vitales. Vista calendario/tablero + `useSSE`. Selectores de paciente (F1) y médico
  (personal, read). Call center = canal `callcenter` + estado `programada`.

### Fase 3 — Facturación (el grande, 43 endpoints, por slices)
- `lib/api/facturacion.ts` por bloques: catálogo (grupos/columnas/divisiones, read), factura
  (borrador → agregar item → emitir), pagos, devoluciones + **anular**, reportes. Depende de Pacientes +
  catálogo inventario/precios (read) + render de columnas configurables.
- Consumir el hand-off `be-facturacion-anulaciones`: gated buttons `factura.anular` /
  `factura.devolucion.anular`, manejar 400 `ANULACION_FUERA_DE_VENTANA` (labelKey), estado
  `devolucion.anulada`. **Revisar moneda/zona horaria** (RD/IVU vs MXN/Mexico_City en `i18n/request`).

### Después de las tres (orden sugerido)
Inventario, Consultas/Prescripción, Frontdesk, Caja, Alertas (SSE), "Ahora mismo", Mediciones, Personal,
Notificaciones, Export (pulido), Auditoría (visor).

## Definition of Done por módulo FE (adaptado; el FE no tiene el TDD del BE)
- [ ] Cliente `lib/api/<dominio>.ts` tipado contra `schema.d.ts` (gen:api), usa `apiFetch`/`apiFetchPaged`.
- [ ] Páginas usan el kit (`DataTable`/`FormDialog`/`ListToolbar`), no copy-paste.
- [ ] Acciones gated con `useCan`; ítem de menú presente (sembrado en BE).
- [ ] i18n: claves en `es.json`+`en.json` (en inglés) + `docs/modules/<dominio>.md`.
- [ ] Multi-tenant: listas scoping por centro activo (X-Tenant-ID automático) — verificado.
- [ ] Errores: `labelKey`→toast vía helper.
- [ ] `npm run typecheck` + `npm run lint` verdes; **verificación manual** contra BE en vivo
      (`npm run dev` :8080 → API CORS ok). (Si 0.6: + Vitest/Playwright.)
- [ ] Bitácora dual `.personal/HANDOFF.md` + memoria de la sesión cmr-fe.

## Verificación end-to-end
1. **gen:api**: con el BE corriendo, `npm run gen:api` genera `schema.d.ts`; un cambio de DTO se refleja al
   regenerar.
2. **Kit**: página demo que liste un recurso real paginado (`/centros` o `/profiles`) con `DataTable` +
   paginación leyendo `meta.pagination`; provocar un error del BE y ver el toast con `labelKey` traducido.
3. **Dominio**: `npm run dev` (:8080) autenticado → lista scoped al centro; crear/editar vía `FormDialog`;
   un botón gated desaparece sin el permiso (rol limitado); `CenterSelector` refiltra.
4. `npm run typecheck` + `npm run lint` verdes.

## Riesgos / decisiones abiertas
- **Ruta del OpenAPI JSON**: confirmar `…/docs-json` (o equivalente) en el BE; si no se expone, añadir
  `SwaggerModule` JSON o usar el documento generado.
- **Moneda/zona horaria**: hoy MXN/America_Mexico_City en `i18n/request.ts`; el negocio es RD (IVU 11.5%,
  America/Santo_Domingo). Debería venir de preferencias por centro — resolver antes de Facturación.
- **Sembrar menú** de los dominios nuevos en el BE (`seed-menu`) para que aparezcan en `useMenu`.
- **Test runner**: adoptar Vitest/Playwright o aceptar verificación manual (decisión de larciles).
