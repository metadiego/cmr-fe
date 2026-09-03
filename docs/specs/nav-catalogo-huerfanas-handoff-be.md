# Catálogo de menú — páginas huérfanas y un bug de ruta (handoff BE)

Contexto: se aplicó la decisión **«los accesos los decide el frontend»**
([accesos-los-decide-el-frontend.md](accesos-los-decide-el-frontend.md)). La barra ahora se construye
ENTERA desde `GET /menu` filtrado por permisos; se quitó la lista de rutas escrita a mano del FE.

Al hacerlo aparecieron **páginas reales de la app que NO estaban en el catálogo** — sin registro no se
ven en la barra. Como pide la nota («si falta alguno, dilo y se añade»), aquí va lo que falta.

## 1. Lo que el FE ya registró (provisional, para no perder acceso)

Para no romper el acceso mientras tanto, el FE dio de alta **9 ítems vía `POST /menu`**, todos colgados
del bucket **`en-desarrollo`** con permiso **`menu.desarrollo`** (admin-only, igual que estaban antes en
los buckets de desarrollo). Son páginas que **existen y funcionan** (varias ya en producción):

| clave (provisional)          | path                              | ¿estado real?        | grupo/permiso SUGERIDO para el seed |
|------------------------------|-----------------------------------|----------------------|-------------------------------------|
| dev-facturacion-general      | /facturacion/general              | **en producción**    | g-facturacion · `factura.read`      |
| dev-cuadre-general           | /caja/cuadre-general              | **en producción**    | g-facturacion · `caja.read`         |
| dev-config-numeracion        | /configuracion/numeracion         | **en producción**    | g-configuracion · `factura.update`  |
| dev-menu-editor              | /configuracion/menu               | **admin, en prod**   | g-configuracion · (perm de menú/admin) |
| dev-recepcion-factura        | /inventario/recepcion-factura     | en uso               | g-inventario · `inventario.recibir` |
| dev-planificacion-compras    | /inventario/planificacion         | en uso               | g-inventario · `inventario.read`    |
| dev-columnas-citas           | /citas/config/columnas            | config               | g-agenda · `citas.config`?          |
| dev-config-panel-enfermeria  | /configuracion/panel-enfermeria   | config               | g-configuracion · `panel.read`?     |
| dev-disp-legado              | /pacientes/disponibilidad-legado  | **legado**           | ¿retirar o g-monitoreo?             |

**Pedido:** llevar estos a `seed-rbac.ts` con su **grupo y permiso definitivos** (columna derecha son
sugerencias del FE, no decisiones), y **borrar los ítems `dev-*` provisionales** para que no queden
duplicados. Los permisos sugeridos ya existen en el seed (no hay que crear ninguno nuevo) salvo donde
pongo `?`. Mientras no se haga, quedan visibles solo para quien tenga `menu.desarrollo`.

Nota de visibilidad: al pasarlos a su grupo con el permiso real, dejarán de ser admin-only y los verá
**quien tenga ese permiso** (que es justo lo que la nota busca). Confirmar que eso es lo deseado para
cada uno; si alguno aún no debe verlo el usuario normal, dejarlo bajo `menu.desarrollo`.

## 2. Bug de ruta en el catálogo actual

El ítem **`cambio-de-protocolo`** apunta a `path: /pacientes/cambio-de-protocolo`, pero **la página real
es `/pacientes/cambio-protocolo`** (sin el «de»). Hoy ese enlace del menú lleva a un 404. Corregir el
`path` en el seed a `/pacientes/cambio-protocolo`.

## 3. Duplicado de apariencia

Existen dos rutas para lo mismo: el catálogo tiene `configuracion-apariencia` → `/configuracion/apariencia`,
y además la app tiene `/settings/appearance` (enlazada desde el menú del avatar). No es urgente, pero
conviene unificar a una sola ruta canónica para no confundir.

## Lo que NO cambió

El BE sigue comprobando `@Permissions(...)` en cada endpoint — esto es solo el menú (qué se VE). Y
`GET /me/menu` sigue existiendo; el FE lo usa como respaldo si `/menu` fallara.
