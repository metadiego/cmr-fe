# Handoff BE → FE — «Clonar de»: copiar el acceso de otro usuario

**Fecha:** 2026-08-26 · **BE:** hecho y desplegado · **Spec:** `cmr-be/docs/specs/clonar-usuario-al-crear.md`
· **Plan:** `cmr-be/docs/plans/clonar-usuario-al-crear.md`

## Qué resuelve

«Esta persona nueva hace lo mismo que fulano». Hoy hay que armarle el acceso a mano y es fácil
olvidar una excepción: en el caso real que motivó esto, clonar a `larcilesbay` igual a Waldemar
necesitaba **3 roles y 6 excepciones**, y sin las excepciones el clon quedaba con más acceso del
debido (28 ítems de menú en vez de 24).

## El endpoint

```
POST /api/v1/rbac/profiles/:id/clonar-de
Authorization: Bearer <token>
X-Tenant-ID: <centro>          (como el resto de RBAC)

body: { "origenPerfilId": "<uuid del perfil del que se copia>" }
```

**Respuesta 200:**

```json
{
  "data": {
    "origenPerfilId": "…",
    "destinoPerfilId": "…",
    "roles":        { "copiados": 3, "yaTenia": 0 },
    "permisos":     { "copiados": 6, "yaTenia": 0 },
    "asignaciones": { "copiados": 2, "yaTenia": 0 },
    "accessMode":   { "antes": "operativo", "ahora": "operativo" }
  }
}
```

**Permiso:** `rbac.create`. (Ya no hace falta ser admin por nombre de rol: se quitó el `@Roles` de
todo el controlador de RBAC, así que basta con tener el permiso.)

### Qué copia — son TRES cosas, no dos

1. **Roles**, cada uno con el `centroId` que tenía en el origen (los roles multi-centro, como Citas,
   siguen siendo globales).
2. **Excepciones de permiso** por usuario, con su `efecto` (`grant`/`deny`) y su centro.
3. **Centros de trabajo** (asignaciones), con su `activo` **tal cual**: si el origen tiene Caguas
   apagado, el clon también. Esto es lo que la spec original no contemplaba y sin ello el clon no
   tiene centro activo: **su menú no coincidiría con el del origen**, que es justo lo que se quería.
4. **El modo de acceso** (`accessMode`: `operativo` | `gerencial`). También es acceso, no identidad:
   `gerencial` es **solo lectura** en los centros asignados y sin centro activo, mientras `operativo`
   escribe en uno. Un clon de un gerencial que quedara operativo tendría MÁS poder que el original.
   La respuesta trae `{ antes, ahora }`; si cambió, conviene decírselo a quien clona:

   > Este usuario pasa a modo **gerencial** (solo lectura), como el original.

**No copia**, a propósito: nombre, email, avatar, contraseña, la ficha de `personal`, el estado de
aprobación ni la marca de **master** —la llave del sistema no se reparte clonando—. Tampoco las
preferencias de apariencia: «Mi apariencia» es de cada quien.

### Para qué se usa de verdad

Puestos con **alta rotación**: citas y call-center, médicos, técnicos y enfermería. Entra alguien
nuevo al mismo puesto, se clona de un compañero y queda listo. El alta desde cero sigue ahí para el
usuario especial que lo necesite: clonar es un atajo, no el único camino.

## Cómo pintarlo

### Campo «Clonar de» en el alta de usuario

Un buscador de perfil (por nombre o email) **opcional**. El flujo de invitar sin clonar no cambia.

Importante: **el perfil tiene que existir antes de clonar** — el endpoint recibe el id del perfil
destino. Así que el orden es: crear/invitar el perfil → llamar a `clonar-de`. Si el alta y la
clonación se hacen en un mismo formulario, encadena las dos llamadas y muestra el resultado de la
segunda.

### Mostrar el recuento, no un «listo» genérico

Con la respuesta se puede decir exactamente qué pasó, y conviene:

> Copiado de Waldemar Ortiz: **3 roles**, **6 excepciones de permiso** y **2 centros**.

Y cuando algo ya estaba (`yaTenia > 0`), decirlo, porque **clonar SUMA, no reemplaza**:

> 2 roles copiados · 1 ya lo tenía.

Se puede clonar sobre un perfil que ya tiene cosas, y clonar dos veces no duplica nada.

### Errores que hay que enseñar tal cual

| Código | Cuándo | Qué decirle |
|---|---|---|
| 400 | El origen tiene un rol reservado (admin/super_admin global) y quien clona no es master | El mensaje del BE nombra el rol. **No se copió nada**: la clonación falla entera a propósito, para que nadie se quede con un clon a medias creyéndolo completo. |
| 400 | Origen y destino son el mismo perfil | «El perfil de origen y el de destino son el mismo.» |
| 404 | El origen (o el destino) no existe | El mensaje dice cuál de los dos. |
| 403 | Sin `rbac.create` | Esconder el campo si `!can("rbac.create")`. |

## Detalle que conviene avisar en la UI

Clonar copia el acceso **del momento**: no queda ningún vínculo entre los dos usuarios. Si mañana a
Waldemar le cambian los permisos, el clon **no cambia**. Merece una línea de ayuda bajo el campo:

> Copia su acceso ahora mismo. Después, cada usuario se administra por separado.

## Por MCP también

`clonar_acceso_de_usuario(perfilId, origenPerfilId)`, mismo permiso `rbac.create`. Útil para dar de
alta varias personas del mismo puesto sin pasar por la pantalla.

## Y algo más que cambió en RBAC (por si el FE lo notaba)

Todo el controlador de RBAC dejó de exigir el rol `admin`/`super_admin` por nombre: cada ruta declara
su permiso (`rbac.read` para leer, `rbac.create`/`update`/`delete` para escribir). **El acceso
efectivo no cambia** —`rbac.*` es superficie de administración y el comodín `.read` del gerente no la
alcanza—, pero ahora se le puede conceder a quien haga falta desde la pantalla de roles, sin
desplegar. Si el FE esconde algo comprobando el rol `admin`, conviene cambiarlo a `can("rbac.read")`.
