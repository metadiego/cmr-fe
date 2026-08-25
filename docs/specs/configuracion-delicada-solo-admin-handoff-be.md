# Handoff BE → FE — La configuración del sistema es solo del administrador

**Fecha:** 2026-08-25 · **Estado BE:** hecho, aplicado y verificado en producción con sesiones
reales · **Spec:** `cmr-be/docs/specs/configuracion-delicada-solo-admin.md`

## Qué cambió y por qué

Cuatro pantallas de **Configuración** (las del menú del avatar) no editan datos del día: definen
cómo funciona el sistema. No son confidenciales, son **delicadas** — si alguien las cambia por
error, deja sin operar a los dos centros. Decisión del dueño: solo el administrador.

| Pantalla | Permiso que exige ahora | Antes |
|---|---|---|
| `/configuracion/requeridos` | `servicios.config` | `servicios.update` |
| `/configuracion/datos-paciente` | `pacientes.config` | (sin ítem de menú) |
| `/configuracion/tableros` | `tablero.config` | igual |
| `/configuracion/formatos` | `formatos.config` | `formatos.read` ⚠️ |

El hueco gordo era formatos: `formatos.read` lo tienen **seis roles** (atención, enfermería,
recepción, solo lectura, gerente, admin) porque lo necesitan para **imprimir** el formato de la
terapia. Con eso, media clínica veía la pantalla de *configuración* de formatos. Guardar les daba
403, pero entraban.

## Qué tiene que hacer el FE

### 1. `/configuracion/requeridos` — cambiar el permiso de la guarda

En `app/(app)/configuracion/requeridos/page.tsx`, línea ~20:

```diff
-{ready && !can("servicios.update") ? (
+{ready && !can("servicios.config") ? (
```

Sin esto, un gerente entra a la pantalla (ya no la ve en el menú, pero la URL sigue funcionando) y
al guardar recibe un 403 con el mensaje `configurar los campos requeridos del servicio requiere el
permiso 'servicios.config'`.

### 2. `/configuracion/tableros` — **le falta la guarda entera**

`app/(app)/configuracion/tableros/page.tsx` no comprueba ningún permiso: hoy solo la esconde el
menú, y quien escribe la URL entra igual. Añadir el mismo patrón que las otras tres:

```tsx
const { can, ready } = useCan();
…
{ready && !can("tablero.config") ? <SinPermiso /> : <TablerosList />}
```

Aplica también a `/configuracion/tableros/[clave]`.

### 3. `/configuracion/datos-paciente` — ya está bien, y ahora aparece en el menú

Ya usa `can("pacientes.config")` ✓. La pantalla existía pero **no estaba en ningún menú**: solo se
llegaba escribiendo la URL. Ahora el BE devuelve el ítem `config-datos-paciente` dentro del grupo
`g-configuracion`, orden 7 (justo después de «Requisitos del servicio», porque son las dos
configuraciones de «qué se exige» y estaban a un clic la una de la otra).

**Falta la traducción**: `nav.configuracion_datos_paciente` en es y en. Sugerencia:
- es: «Datos obligatorios del paciente»
- en: «Required patient data»

### 4. `/configuracion/formatos` — ya está bien

Ya usa `can("formatos.config")` ✓. No hay nada que tocar; el ítem del menú dejó de ofrecerse a los
seis roles.

## Cómo se comporta

- **Se oculta, no se deshabilita.** Quien no tiene el permiso no ve el ítem en el menú. El BE ya no
  lo devuelve en `GET /me/menu`.
- **La URL directa también está cerrada** en el BE: los cuatro endpoints de escritura exigen su
  permiso y responden 403 nombrándolo. Las guardas del FE son para que la persona vea un mensaje en
  vez de una pantalla que falla al guardar.
- **Nada soldado a un rol.** El código declara el permiso; quién lo tiene es un dato. Si mañana un
  centro quiere que su gerente configure formatos, se le concede `formatos.config` desde la
  pantalla de roles —o a una persona concreta, con o sin centro, desde su perfil— y funciona sin
  desplegar nada.
- **Recepción y enfermería siguen imprimiendo** el formato de la terapia: conservan `formatos.read`.

## Efecto colateral que conviene saber

`tablero.config` lo comparten tres ítems del menú: `configuracion-tableros`,
`configuracion-modulos` (`/settings/tablero-modulos`) y `mis-tableros` (`/settings/tableros`). Al
quedar el permiso solo en Administrador, el gerente pierde los tres. Es coherente —los tres
configuran tableros— pero queda dicho: si el dueño quiere devolverle «Mis tableros» al gerente, eso
pide un permiso propio para ese ítem, y es trabajo de BE. Avisar y no improvisarlo en el FE.

## Verificado en producción (25-ago), no en el previsualizador

Con la sesión real de cada usuario contra `GET /me/menu`, no con la vista previa del panel de admin
(que muestra 56 ítems a todo el mundo y engaña):

| Usuario | Rol | Configuración delicada que ve |
|---|---|---|
| wilma | gerente | ninguna |
| edgardo | gerente | ninguna |
| wortiz | atención + inventario + facturación | ninguna |
| yfeliciano | atención | ninguna |
| mcaballero | atención | ninguna |
| kdoliveira | inventarios | ninguna |

De los cuatro ítems, un administrador sigue viendo los cuatro.

---

## Añadido 25-ago (tarde): «Configuración de la app» se le muestra a TODO EL MUNDO

`components/user-menu.tsx` línea ~135 pinta el ítem sin comprobar nada:

```tsx
<DropdownMenuItem asChild>
  <Link href="/configuracion">…{t("appSettings")}</Link>
</DropdownMenuItem>
```

Justo debajo, «Módulos de tablero» sí filtra (`can("tablero.admin")`) y está bien comentado. A este
se le olvidó. Resultado: un usuario de prueba —o el call-center, o quien solo hace citas— entra a
Configuración y ve, entre otras, la **apariencia corporativa, que sobrescribe la personal**. Con
«Mi apariencia» ya tiene lo suyo; lo corporativo no es de él.

### Qué hacer (sin inventar un permiso nuevo)

El BE ya le dice al FE exactamente lo que esa persona puede configurar: el grupo `g-configuracion`
de `GET /me/menu`. Así que el ítem se muestra **solo si ese grupo le llega con algún hijo**:

```tsx
// «Configuración de la app» solo a quien tenga algo que configurar: el BE ya filtra el grupo
// g-configuracion por permiso en /me/menu. Si le llega vacío, no hay nada que abrir — y ahí dentro
// está la apariencia CORPORATIVA, que sobrescribe la personal, así que no es cosa de cualquiera.
const puedeConfigurar = (menu ?? []).some(
  (g) => g.clave === "g-configuracion" && (g.children?.length ?? 0) > 0,
);
…
{puedeConfigurar && (
  <DropdownMenuItem asChild>
    <Link href="/configuracion">…{t("appSettings")}</Link>
  </DropdownMenuItem>
)}
```

Derivarlo del menú y no de un permiso fijo tiene una ventaja concreta: cuando el dueño le conceda a
alguien una sola sección de Configuración (por rol o como excepción a esa persona), el ítem le
aparece solo, sin tocar el FE ni desplegar.

**Ojo:** «Mi apariencia» y «Cambiar mi contraseña» se quedan como están, visibles para todos. Son de
cada persona y no llevan permiso.

### Y de paso, dentro de `/configuracion`

La página índice debe pintar **solo las tarjetas que el menú le trae**, no las nueve fijas. Si hoy
las lista a mano, un usuario ve tarjetas que al abrirlas le dan 403.
