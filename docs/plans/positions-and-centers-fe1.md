# Puestos y Centros — FE-1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La ficha de personal muestra y guarda **Puestos por centro** (`GET/PUT /staff/:id/positions`) y deja de ofrecer Cargo, Responsabilidades, Centros de servicio y Rol(es)/Centro(s) de acceso.

**Architecture:** Toda la lógica (etiqueta, rejilla centro×puesto, cuerpo del PUT, qué chip se puede tocar y por qué) vive en funciones puras en `lib/personal/positions.ts`, probadas con `node --test`. Un componente nuevo, `StaffPositionsSection`, las pinta y se guarda con el `useSaveSection` de la ficha. El 428 de admin ya lo resuelve `apiFetch` (escudo de `lib/api/confirm-action.ts`): nada nuevo que escribir para la confirmación.

**Tech Stack:** Next.js 16, React 19, next-intl, Tailwind v4 + shadcn, `node --test --experimental-strip-types` para `lib/**/*.test.ts`.

**Spec:** `docs/specs/positions-and-centers.md` (FE-1 handoff). Modelo de negocio: `cmr-be/docs/specs/positions-and-centers.md`.

## Revisión del código (26-nov-2026, BE `main` = `5c2bc4bf`, en producción)

Verificado leyendo el código:
- `GET /positions` (`cmr-be/src/modules/rbac/positions.controller.ts`) sirve `{ id, slug, name, labelKey, allCenters, permissions, fullAccess }` en v2 (v1: `clave/nombre/todosLosCentros`). No está en `lib/api/schema.d.ts`: los tipos se escriben a mano en `lib/api/positions.ts`, como ya hace `lib/api/centers.ts:28`.
- `GET /staff` devuelve la entidad entera: cada fila trae `primaryPositionId` (id de `roles`), no el slug. La lista cruza ese id con el catálogo.
- `servesInCenters` de la lista sale de `staff.service_centers`, que el BE mantiene al día con los puestos (BE spec §4). Las insignias de centro de la lista no cambian de código.
- `capabilities` / `jobTitle` también los mantiene el BE: `showsSpecialty`, `showsConsultaPreferences` y `esMedico` (staff page) siguen funcionando si la ficha se recarga tras guardar (`onSaved={onChanged}` ya lo hace).
- El 403 de un no-admin trae `labelKey: 'positions.accessChangeNeedsAdmin'` (`position-assignment.service.ts:136`); `toastError` traduce el `labelKey`. Tocar un centro con o sin permisos cuando la ficha **tiene login** también es solo admin (`movesLogin`).
- El 428 de admin es el escudo estándar (`ACTION_REQUIRES_CONFIRMATION`); `apiFetch` (`lib/api/client.ts:138`) pregunta y repite solo.
- Invitar (`POST /profiles/invite`) acepta un solo `centroId` + `rolClave` y **siempre** deja una ficha (la crea o enlaza `personalId`; enlazar quita los puestos con permisos). La respuesta **no** trae el `staffId`.

**Hallazgo que cambia el alcance (decidido, no preguntado):** el §3 del handoff («el menú es el mismo en cualquier centro» + nota por pantalla) **no se puede hacer solo en FE**. `GET /me/menu` (`cmr-be/src/modules/menu/me-menu.controller.ts`) filtra con `user.permissions` del **centro activo**, y el FE no recibe permisos por centro (solo `/me/centros-donde-puedo?permiso=` de uno en uno). Hace falta un BE pequeño (menú = unión de los centros de la persona, y `permissionsByCenter` en `/me`). Ese trozo sale de FE-1 y queda como **FE-1b** (con su BE-1b), escrito en `cmr-app/todo/README.md`. FE-1 se queda con §2 y con la primera línea de §3 (una sola fuente de «mis centros»).

## Global Constraints

- Permiso de escritura de la ficha: `staff.update` (en cada centro tocado). Permiso de lectura del catálogo: `staff.read`.
- Cuerpo del PUT = lista **COMPLETA**: `{ positions: [{ position, centerIds? }], primary? }`; `admin` (el de `fullAccess`) va **sin** `centerIds`.
- Claves i18n `positions.<slug>` en `messages/es.json` y `en.json` para: `admin`, `manager`, `appointments` (es «Operadora»), `frontdesk` («Recepción»), `billing`, `inventory`, `doctor`, `nurse`, `technician`, `cashier`, `accounting`, `other`, `nursing`, `nursing_panel`, `facturacion-inventario`, `read_only`. Sin clave → `name`.
- Regla 8: ningún control deshabilitado sin decir por qué, al lado.
- Todo el código, comentarios y nombres en inglés; textos de UI vía i18n (es + en, `lib/i18n/messages-parity.test.ts`).
- Ficheros: `access-dialog.tsx` (523) e `invite-dialog.tsx` (467) solo bajan de tamaño; un fichero nuevo nace < 600 líneas.
- UI (CLAUDE.md regla 10): la sección nueva es un `Panel` del kit (`components/kit/panel.tsx`), colores solo por tokens; si la página está en `eslint/legacy-card-files.mjs`, la región tocada pasa al kit.
- Formularios (regla 8): `FormDialog` + `Field` + `missingFields`; invitar es una acción hacia fuera → Enter NO envía (`onSubmit={() => {}}` + `actions`).
- Tipos del API: `npm run gen:api` contra producción (`CMR_OPENAPI_URL=https://api.centrodemedicinaregenerativa.com/api/docs-json`) solo si no mueve el pin de `lib/lifecycle/old-status-allowlist.ts`; si lo mueve, tipos a mano (Task 1) y se deja para el seguimiento ya anotado en `todo/README.md`.

## Review Focus

1. **Ficha con login y un no-admin** (gerente de un centro): añadir el primer puesto en un centro nuevo o quitar el último de un centro cambia dónde trabaja el login → el BE da 403. Esperado: esos chips ya salen deshabilitados con el motivo. Test en Task 2 (`chipState` con `hasLogin`).
2. **El principal deja de tenerse** (se quita su último chip): el PUT no puede mandar un `primary` que no va en la lista. Esperado: pasa al primer puesto que quede, o se omite. Test en Task 2 (`buildPositionsBody`).
3. **Centro donde el que mira no tiene `staff.update`**: la fila se ve, pero no se toca, con motivo. Test en Task 2 (`chipState` con `canEditCenter: false`).
4. **Puesto con `centerIds: null` que no es admin** (datos viejos): no debe perderse al guardar sin tocarlo. Esperado: se lee como «en todos los centros visibles» y vuelve con esos centros; test en Task 2 (`gridFromStaff`).
5. **Slug sin clave i18n ni nombre** (puesto nuevo creado en Configuración): se ve el slug, nunca una clave cruda `positions.x`. Test en Task 2 (`positionLabel`).

---

### Task 1: Cliente de API de puestos

**Files:**
- Create: `lib/api/positions.ts`

**Interfaces:**
- Produces:
  - `type Position = { id: string; slug: string; name: string; labelKey: string | null; allCenters: boolean; permissions: number; fullAccess: boolean }`
  - `type HeldPosition = { position: string; labelKey: string | null; permissions: number; centerIds: string[] | null }`
  - `type StaffPositions = { primary: string | null; positions: HeldPosition[] }`
  - `type StaffPositionsBody = { positions: { position: string; centerIds?: string[] }[]; primary?: string }`
  - `getPositions(): Promise<Position[]>` — `GET /positions`
  - `getStaffPositions(staffId: string, centro?: string): Promise<StaffPositions>`
  - `setStaffPositions(staffId: string, body: StaffPositionsBody, centro?: string): Promise<StaffPositions>` — `PUT`
  - `centro` = el centro de la ficha, pasado igual que en `getStaffExtensions` (`lib/api/personal.ts`).

- [ ] **Step 1:** Escribir el fichero siguiendo `getStaffExtensions`/`setStaffExtensions` de `lib/api/personal.ts` (mismo uso de `apiFetch` y del centro).
- [ ] **Step 2:** `npm run typecheck` → sin errores.
- [ ] **Step 3:** Commit `feat(positions): API client for positions held at centers`.

(Sin test propio: son envoltorios de `apiFetch`, igual que el resto de `lib/api/`.)

### Task 2: Lógica pura de puestos

**Files:**
- Create: `lib/personal/positions.ts`, `lib/personal/positions.test.ts`

**Interfaces:**
- Consumes: tipos de Task 1.
- Produces:
  - `type Translator = { has(key: string): boolean; (key: string): string }`
  - `positionLabel(slug: string, t: Translator, name?: string | null): string` — `positions.<slug>` → `personal.cargo.<slug>` → `name` → `slug`.
  - `type PositionGrid = { byCenter: Record<string, string[]>; admin: boolean }` (slugs ordenados, sin el de `fullAccess`).
  - `gridFromStaff(held: StaffPositions, catalog: Position[], centerIds: string[]): PositionGrid`
  - `togglePosition(grid: PositionGrid, centerId: string, slug: string): PositionGrid`
  - `centersOf(grid: PositionGrid): string[]` — centros con al menos un puesto.
  - `effectivePrimary(primary: string | null, grid: PositionGrid, catalog: Position[]): string | null`
  - `buildPositionsBody(grid: PositionGrid, primary: string | null, catalog: Position[]): StaffPositionsBody`
  - `type ChipBlock = "carriesPermissions" | "loginCenterNeedsAdmin" | "noCenterAccess" | null`
  - `chipState(args: { position: Position; centerId: string; grid: PositionGrid; viewerIsAdmin: boolean; hasLogin: boolean; canEditCenter: boolean }): ChipBlock`
  - `sameGrid(a: PositionGrid, b: PositionGrid): boolean`

- [ ] **Step 1: Tests que fallan** (`lib/personal/positions.test.ts`, `node:test` + `assert/strict`). Catálogo de prueba: `admin` (fullAccess, 999 permisos), `manager` (40), `doctor` (0), `nurse` (0); centros `BAY`, `CAG`.

```ts
test("positionLabel: positions key, then cargo key, then name, then slug", () => {
  const t = fakeT({ "positions.manager": "Gerente", "personal.cargo.medico": "Médico" });
  assert.equal(positionLabel("manager", t), "Gerente");
  assert.equal(positionLabel("medico", t), "Médico");
  assert.equal(positionLabel("new_one", t, "Nuevo"), "Nuevo");
  assert.equal(positionLabel("new_one", t), "new_one");
});
test("gridFromStaff: admin becomes the switch; centerIds null on a normal position spreads to every center", () => {
  const g = gridFromStaff({ primary: "doctor", positions: [
    { position: "admin", labelKey: null, permissions: 999, centerIds: null },
    { position: "doctor", labelKey: null, permissions: 0, centerIds: ["BAY"] },
    { position: "nurse", labelKey: null, permissions: 0, centerIds: null },
  ] }, CATALOG, ["BAY", "CAG"]);
  assert.deepEqual(g, { admin: true, byCenter: { BAY: ["doctor", "nurse"], CAG: ["nurse"] } });
});
test("buildPositionsBody: one entry per position with its centers; admin without centerIds", () => {
  const body = buildPositionsBody({ admin: true, byCenter: { BAY: ["doctor", "manager"], CAG: ["manager"] } }, "manager", CATALOG);
  assert.deepEqual(body, { positions: [
    { position: "admin" },
    { position: "doctor", centerIds: ["BAY"] },
    { position: "manager", centerIds: ["BAY", "CAG"] },
  ], primary: "manager" });
});
test("buildPositionsBody: a primary no longer held falls to the first held, or is omitted", () => {
  assert.equal(buildPositionsBody({ admin: false, byCenter: { BAY: ["nurse"] } }, "doctor", CATALOG).primary, "nurse");
  assert.equal("primary" in buildPositionsBody({ admin: false, byCenter: {} }, "doctor", CATALOG), false);
});
test("chipState: a position with permissions is admin-only", () => {
  assert.equal(chipState({ ...base, position: MANAGER, viewerIsAdmin: false }), "carriesPermissions");
  assert.equal(chipState({ ...base, position: MANAGER, viewerIsAdmin: true }), null);
});
test("chipState: with a login, a non-admin cannot add the first or remove the last position of a center", () => {
  const grid = { admin: false, byCenter: { BAY: ["doctor"] } };
  assert.equal(chipState({ ...base, grid, hasLogin: true, centerId: "BAY", position: DOCTOR }), "loginCenterNeedsAdmin"); // last one
  assert.equal(chipState({ ...base, grid, hasLogin: true, centerId: "CAG", position: DOCTOR }), "loginCenterNeedsAdmin"); // first one
  assert.equal(chipState({ ...base, grid: { admin: false, byCenter: { BAY: ["doctor"] } }, hasLogin: true, centerId: "BAY", position: NURSE }), null); // center stays
  assert.equal(chipState({ ...base, grid, hasLogin: false, centerId: "CAG", position: DOCTOR }), null); // no login
});
test("chipState: a center without staff.update is read-only", () => {
  assert.equal(chipState({ ...base, canEditCenter: false, viewerIsAdmin: true }), "noCenterAccess");
});
```
(`base` = `{ position: DOCTOR, centerId: "BAY", grid: { admin:false, byCenter:{} }, viewerIsAdmin:false, hasLogin:false, canEditCenter:true }`; orden de chequeo: `noCenterAccess` → `carriesPermissions` → `loginCenterNeedsAdmin`.)

- [ ] **Step 2:** `npm test` → falla (`Cannot find module './positions.ts'`).
- [ ] **Step 3:** Implementar las firmas de arriba en `lib/personal/positions.ts`. `byCenter` y las listas de centros salen ordenadas para que `sameGrid` y el cuerpo sean estables.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(positions): pure position grid, PUT body and chip rules`.

### Task 3: Una sola etiqueta de puesto + i18n

**Files:**
- Modify: `components/personal/staff-list.tsx:33,63`, `components/configuracion/column-config-dialog.tsx:456`, `components/admin/invite-dialog.tsx:315`
- Modify: `messages/es.json`, `messages/en.json`
- Modify: `app/(app)/configuration/staff/page.tsx` (pasa el catálogo a `StaffList`)

**Interfaces:**
- Consumes: `positionLabel`, `getPositions`.
- Produces: `StaffList` recibe `positions: Position[]`; la línea bajo el nombre = `positionLabel` del puesto cuyo `id === p.primaryPositionId` (si no hay, `t("sinCargo")`).

- [ ] **Step 1:** Añadir a `es.json` / `en.json`: `positions.<slug>` (las 16 de Global Constraints), `positions.accessChangeNeedsAdmin`, y en `personalFicha`: `puestos`, `puestosAyuda`, `puestoPrincipal`, `marcarPrincipal`, `adminSwitch`, `adminSwitchAyuda`, `bloqueo.carriesPermissions`, `bloqueo.loginCenterNeedsAdmin`, `bloqueo.noCenterAccess`, `puestosVacio`.
- [ ] **Step 2:** `npm test` → `messages-parity` PASS.
- [ ] **Step 3:** Sustituir los tres `cargoLabel`/`label` locales por `positionLabel` (column-config sigue etiquetando capacidades: `positionLabel` cae a `personal.cargo.*`, así que se ve igual). En `invite-dialog.tsx:315` mostrar `positionLabel` en vez del slug crudo.
- [ ] **Step 4:** `StaffPanel` carga `getPositions()` una vez (`useResource`) y lo pasa a `StaffList`.
- [ ] **Step 5:** `npm run typecheck && npm run lint && npm test` → limpios. Commit `refactor(staff): one position label helper; list shows the primary position`.

### Task 4: Sección «Puestos» en la ficha

**Files:**
- Create: `components/personal/staff-positions-section.tsx`
- Modify: `components/personal/ficha-editor.tsx` (quitar Cargo, Responsabilidades y sus estados/props `cargoCatalogo`, `capacidadOpciones`; `jobTitle`/`capabilities` dejan de ir en el payload)
- Modify: `components/personal/staff-record-sections.tsx` (borrar `CentrosDePersona`)
- Modify: `app/(app)/configuration/staff/page.tsx` (montar la sección donde estaba `CentrosDePersona`; quitar `getCargos`/`responsibilityOptions` si nadie más los usa en la página)

**Interfaces:**
- Consumes: Task 1 y 2; `useSaveSection("positions", dirty, save)`; `getCenters()` (todos los centros, para las filas); `getCentrosDondePuedo("staff.update")` (filas editables); `useMe()`/`isAdmin`.
- Produces: `StaffPositionsSection({ persona, catalog, centro }: { persona: Personal; catalog: Position[]; centro?: string })`.

Forma (maqueta `claude.ai/artifact/1fmXwp9RjMWTdB1KSQHyqJ`): una fila por centro con su nombre y los chips de los puestos no-`fullAccess`; chip con permisos lleva icono de candado (`SquareLock02Icon`); chip activo = estilo de `aria-pressed` ya usado en la ficha; junto a cada chip activo, una estrella para marcarlo principal (uno en toda la ficha). Un chip bloqueado: `disabled` + su motivo en texto bajo la fila (`personalFicha.bloqueo.*`), no solo en un tooltip. Interruptor «Administrador» aparte, visible solo si `viewerIsAdmin`.

- [ ] **Step 1:** Escribir el componente: carga `getStaffPositions`, construye `gridFromStaff`, guarda con `setStaffPositions(buildPositionsBody(...))` cuando `!sameGrid(grid, saved) || primary !== savedPrimary`. Mismo patrón de «ajustar en render» que `StaffExtensionsSection` (`ficha-editor.tsx`) para resetear al recargar.
- [ ] **Step 2:** Quitar de `FichaEditor` Cargo y Responsabilidades; la especialidad se sigue mostrando con `showsSpecialty(persona.jobTitle, persona.capabilities, persona.specialty)` (valores del BE, no del estado local).
- [ ] **Step 3:** Si `lib/personal/responsibilities.ts` deja de tener lectores de `normalizeResponsibilities`/`sameResponsibilities`/`responsibilityOptions`, dejarlo: `column-config-dialog` y la página aún lo usan. No borrar tests (regla 9).
- [ ] **Step 4:** `npm run typecheck && npm run lint && npm test` → limpios.
- [ ] **Step 5:** Commit `feat(staff): Puestos section replaces job title, responsibilities and service centers`.

### Task 5: «Acceso al sistema» sin roles ni centros

**Files:**
- Modify: `components/admin/user-access-panel.tsx` (quitar botón «Centros», `ProfileCentrosDialog`, filas Rol(es)/Centro(s); dejar estado, email, «Accesos» y el menú de acciones; el admin se sigue señalando con su insignia)
- Modify: `components/admin/access-dialog.tsx` (quitar pestañas `roles` y `porCentro`, `RolesTab`, `getRoles`; `defaultValue="exceptions"`)
- Delete: `components/admin/access-por-centro-tab.tsx`, `components/admin/profile-centros-dialog.tsx` (comprobar con `grep -rn` que no tienen otros lectores)

- [ ] **Step 1:** Hacer los cambios; `defaultCentroDe` se queda (sigue eligiendo el ámbito inicial de Excepciones).
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm test` → limpios; `wc -l components/admin/access-dialog.tsx` < 523.
- [ ] **Step 3:** Commit `refactor(access): access sheet keeps exceptions and menu preview only`.

### Task 6: Invitar con puestos

**Files:**
- Modify: `components/admin/invite-dialog.tsx`, `components/personal/give-access-dialog.tsx`
- Create: `components/personal/positions-picker.tsx` (la rejilla de chips sin carga ni guardado, compartida con Task 4)
- Modify: `components/personal/staff-positions-section.tsx` (usa `PositionsPicker`)

**Interfaces:**
- Produces: `PositionsPicker({ catalog, centers, grid, onChange, primary, onPrimaryChange, blockOf }: {...; blockOf: (position: Position, centerId: string) => ChipBlock })`.
- Consumes: `buildPositionsBody`, `centersOf`.

Flujo (solo admins invitan): correo + nombre + (opcional) ficha existente + rejilla de puestos. Al enviar: `invite` **sin** `rolClave`, con `centroId = centersOf(grid)[0]`; luego el `staffId` = `personalId` si se enlazó, si no `(await listPersonalAll()).find(p => p.profileId === result.id)?.id`; luego `setStaffPositions(staffId, buildPositionsBody(...))`. Si ese segundo paso falla, el diálogo lo dice y ofrece abrir la ficha (`onRequestAssign`, ya existe): la cuenta ya está creada.

- [ ] **Step 1:** Extraer `PositionsPicker` de la sección de Task 4 (sin cambio visible) → typecheck limpio → commit.
- [ ] **Step 2:** Cambiar `invite-dialog.tsx`: fuera los selects de centro, rol, temporal/vigente (`planInvite` deja de usarse; si su test queda sin lector, se queda el test y el helper hasta BE-2, regla 9); dentro `PositionsPicker`. Mismo cambio en `give-access-dialog.tsx`.
- [ ] **Step 3:** `npm run typecheck && npm run lint && npm test` → limpios; `wc -l components/admin/invite-dialog.tsx` < 467.
- [ ] **Step 4:** Commit `feat(invite): invite with positions per center`.

### Task 7: Una sola fuente de «mis centros»

**Files:**
- Modify: `components/center-selector.tsx:8,35`, `hooks/use-centro-pantalla.ts:5,60`, `lib/api/centers.ts:117-126`

- [ ] **Step 1:** Los dos lectores pasan a `getMyCentros()`; borrar `getMyCentrosOperativos` y su comentario (el BE ya sirve lo mismo en las dos rutas: `auth.controller.ts`, plan BE §BE-1).
- [ ] **Step 2:** `grep -rn "getMyCentrosOperativos\|centers/operational" app components hooks lib --include='*.ts*' | grep -v schema.d.ts` → vacío. Typecheck/lint/test limpios.
- [ ] **Step 3:** Commit `refactor(centers): one source for my centers`.

### Task 8: Verificación en navegador y PR

- [ ] **Step 1:** `npm run dev` contra el BE de producción (`NEXT_PUBLIC_API_BASE_URL=https://api.centrodemedicinaregenerativa.com`, solo lectura salvo una ficha de prueba) o la preview de Vercel del PR. Con `/qa-only` de gstack: claro/oscuro, escritorio/375px, con un admin y con un gerente de un centro. Comprobar: la ficha muestra los puestos reales; el gerente ve los candados y los motivos; un admin al marcar Administrador ve la confirmación (428).
- [ ] **Step 2:** Guardar sobre una ficha **sin login** de prueba (ni Damian ni nadie real): añadir y quitar un puesto de 0 permisos; recargar → persiste.
- [ ] **Step 3:** PR en `metadiego/cmr-fe` (descripción en español, lo verificado separado de lo supuesto). Vercel despliega al mezclar.
- [ ] **Step 4:** En `cmr-app/todo/README.md`: FE-1b (menú = unión de centros + nota por pantalla; necesita BE-1b: `/me/menu` sobre la unión de los centros de la persona y permisos por centro en `/me`), y la verificación real tras mezclar.

## Addendum (26-nov-2026, noche): FE-1b dentro de este mismo PR

El dueño quiere todo esta noche y 3 PRs en total (#722, el BE de esta noche, este). El BE nuevo
(`cmr-be` rama `feat/positions-be2`) sirve: `/me/menu` = unión de los centros de la persona;
`/me/centers` y `/me/centers/operational` = la misma lista (centro de origen primero, sin `centers.switch`).

- **Menú igual en cualquier centro:** `hooks/use-menu.ts` ya no vuelve a filtrar por los permisos del
  centro activo (el BE ya decide).
- **Pantalla sin acceso en el centro activo:** `components/center-access-gate.tsx`, una sola pieza en el
  shell. Encuentra la pantalla por la ruta (`lib/nav/screen-access.ts`, probado) y, si el centro activo
  no tiene su permiso pero otro sí, muestra «{pantalla}: solo en {centros}» con «Ir a {centro}». Mientras
  pregunta, no arranca la página.
- **Task 7 hecha:** el selector y `useCentroPantalla` leen `getMyCentros`; `getMyCentrosOperativos` borrado.
