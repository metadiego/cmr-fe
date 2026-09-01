# HANDOFF BE — El MENÚ del perfil debe ser una lista blanca de lo que se VE (separado de los permisos)

**Competencia BE.** Descubierto y verificado en producción hoy (2026-08-10). El FE no puede resolverlo:
hoy `/me/menu` deriva el menú de los PERMISOS, y los permisos son más gruesos que los ítems del menú, así
que el menú "se desborda" y un perfil nunca muestra exactamente lo que el admin eligió.

## Lo que el dueño quiere (modelo mental correcto)

1. En un PERFIL (rol), el admin elige EXACTAMENTE qué ítems de menú tiene (la lista del botón "Menú").
2. Cuando ese perfil se asigna a un usuario, el usuario ve EXACTAMENTE esos ítems. Ni uno más.
3. Los PERMISOS son otra cosa: controlan lo que el usuario puede HACER dentro de lo que ve (leer/crear/
   editar/borrar), no lo que ve.

En una frase: **el MENÚ del rol = lista blanca de VISIBILIDAD; los permisos = capacidades (acciones).**
Son ejes independientes.

## Lo que pasa hoy (evidencia, prod)

- Al rol `atencion` se le eligieron 5 dominios en el editor de Menú: tablero Atención, Facturación de
  consultas, Clientes, Cuadre de consulta, Devoluciones de consulta.
- Se le dio el CRUD de esos dominios (49 permisos: `factura.*`, `caja.*`, `citas.*`, `clientes.*`,
  `pacientes.*`, `consulta.*`, `prescripcion.*`, `mediciones.*`, `panel.read/notificar`, `formatos.read`,
  `tablero.read`, `factura.division.consulta`, etc.).
- **Resultado con el usuario real `atencionbay@cmr.test` (Bayamón):** `GET /api/v1/me/menu` devuelve **29
  ítems**, no 5. Aparecen, entre otros: Facturación general, Caja general, Grupos de facturación,
  Config. de factura, Config. de formatos, Consumo de insumos, Panel de enfermería, Cupos, Operaciones,
  Apariencia, Dashboard.

Causa: `/me/menu` está construido como la UNIÓN de los ítems que "desbloquea" cada permiso. Un mismo
permiso abre varios ítems de distinto ámbito: `factura.read` abre a la vez **Facturación general** y
**Facturación de consultas**; `caja.read` abre **Caja general** y **Cuadre de consulta**; `panel.read`
abre **Panel de enfermería**; etc. Como los permisos son por recurso (no por ítem de menú ni por
división de menú), el menú siempre muestra de más.

Nota: el editor de "Menú" del rol HOY, al guardar, en realidad fija PERMISOS derivados del menú (mapea
menú→permisos), no una lista blanca de visibilidad. Por eso elegir 5 ítems y luego cambiar permisos
"pierde" la selección del menú.

## Qué hay que hacer en el BE

1. **Guardar la selección de menú del rol como una LISTA BLANCA propia** (claves de ítems de menú), que
   NO se recalcula desde los permisos. Es el editor de "Menú" que ya existe en el FE
   (`POST /roles/:id/menu { claves }`); que persista la lista, no que la convierta a permisos.
2. **`GET /me/menu` debe devolver la INTERSECCIÓN**: solo los ítems que están en la lista blanca del rol
   (unión de los roles del usuario), y punto. Si el rol no tiene lista blanca definida, cae al
   comportamiento actual (compatibilidad).
3. **Los permisos siguen gobernando las ACCIONES** dentro de cada pantalla (crear/editar/borrar/anular…),
   como hoy — no cambian. Un usuario puede tener `factura.*` y aun así NO ver "Facturación general" si ese
   ítem no está en la lista blanca de su rol.
4. Ítems de GRUPO (cabeceras `grupo.*`) se muestran solo si tienen algún hijo visible en la lista blanca
   (para no dejar cabeceras vacías).

## Cómo comprobarlo sin adivinar

1. Fijar la lista blanca de `atencion` a exactamente: `atencion`, `consultas` (facturación de consulta),
   `consultas-devoluciones`, `clientes`, `caja-consulta`.
2. `GET /me/menu` como `atencionbay@cmr.test` (Bayamón) debe devolver **esos 5** (más sus cabeceras de
   grupo), no 29 — aunque el rol tenga `factura.*`, `caja.*`, etc.
3. Las acciones dentro de esas pantallas siguen habilitadas por los permisos (devolver, anular, cerrar…).

## Lo que el FE YA tiene

- Editor de "Menú" por rol (`components/admin/rbac-settings.tsx` → `RoleMenuDialog`, `setRoleMenu`) y de
  "Permisos" (`PermisosDialog`, `setRolePermisos`). En cuanto el BE trate el menú como lista blanca y
  `/me/menu` la respete, el FE no necesita cambios: ya pinta lo que `/me/menu` devuelve.

## Contexto

- El catch-all del FE (`lib/nav-manifest.ts`) solo se pinta para master/admin (commit cbfdaab), así que no
  influye en usuarios normales: para ellos manda `/me/menu`.
- Evidencia recogida con dogfood real (token del propio usuario + X-Tenant-ID Bayamón).
