# Personal y accesos: una sola página, no nueve sitios

**Pedido del dueño, 3-oct-2026:**

> «tenemos que fusionar administración con personal, tener todo en una sola página. No le veo
> sentido tener todo eso regado como la plataforma horrible de GCP, que para hacer algo hay que
> recorrer todas las opciones.»

## Lo que hay hoy (verificado en el menú de producción)

Dentro de **Configuración** hay **13 entradas sueltas**, y dos de ellas son la misma conversación:

- `/admin` → ya tiene 8 pestañas: **Usuarios, Centros, Tema, Roles, Permisos, Menú, Editor de rol,
  Pendientes**.
- `/personal` → apunta a `/configuration/staff`: la **ficha de personal** (cargo, centros, email,
  y ahora la pestaña inicial de Consulta).

Son la misma persona vista por dos puertas: en una está su ficha, en la otra su usuario, su rol y
sus permisos. Para dar de alta a alguien y dejarlo trabajando hay que ir a las dos.

## Lo que se propone

Una sola página, **«Personal y accesos»**, con las pestañas de `/admin` más la de personal:

| Pestaña | Qué es | De dónde sale |
|---|---|---|
| **Personal** | La ficha: nombre, cargo, centros, email, preferencias | lo que hoy es `/configuration/staff` |
| Usuarios | El login y su perfil | `/admin` → users |
| Roles · Permisos · Editor de rol | Quién puede qué | `/admin` → roles/permisos/editorRol |
| Pendientes | Los que esperan aprobación | `/admin` → pending |
| Centros · Tema · Menú | Configuración global | `/admin` → centers/theme/menu |

**Personal va primera**, porque es por donde se empieza: primero existe la persona, después su
acceso.

### Que la pestaña se pueda enlazar

`?tab=personal` en la URL. Sin eso, «ve a Personal y accesos y pulsa la tercera pestaña» es
exactamente el paseo del que se queja el dueño.

## Lo que hace falta del BE

**Nada nuevo**: los endpoints de personal, usuarios, roles, permisos y menú ya existen y la página
los usa hoy desde sus dos sitios. Cuando la página esté lista, el BE **quita un ítem del menú** y
deja uno solo — es un dato, no código, y lo hago yo en cuanto me digas que está.

## Y lo que esto deja a medias si no se sigue

Configuración seguirá teniendo once entradas. La queja del dueño no es solo admin+personal, es la
dispersión: **«para hacer algo hay que recorrer todas las opciones»**. Esta fusión es la primera y
la más clara; las siguientes candidatas, por el mismo criterio de «esto es una sola conversación»:

- **Facturación**: `config-factura` + `config-requeridos` + `configuracion-modulos`.
- **Tableros**: `configuracion-tableros` + `configuracion-apariencia`.
- **Integraciones**: `ehr-integration` + `scheduling-bridge`.

Con eso Configuración pasaría de 13 entradas a unas 5.
