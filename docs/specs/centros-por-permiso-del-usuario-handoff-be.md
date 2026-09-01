# FE — El selector de centros de cada permiso (ficha de accesos de una persona)

Backend hecho, probado y **desplegado**. Falta la columna en la pantalla de accesos.

## De qué va, en una frase

Poder decir «esta persona, ESTE permiso, en ESTE centro» sin tocarle sus centros de trabajo, su rol
ni su menú.

Hasta ahora, para que la gerente de Caguas leyera el calendario de Bayamón había que asignarle
Bayamón como centro de trabajo. Al hacerlo, la sesión arrancaba en Bayamón —donde no tiene rol— y
**perdía el menú entero**. Eso ya no hace falta: se le concede el permiso en ese centro y nada más
cambia.

Dos cosas distintas que no hay que confundir en la UI:

| | Qué es | Dónde se gestiona |
|---|---|---|
| **Centro de trabajo** | Dónde sirve la persona. Manda en su sesión, su selector del nav y su menú | La pestaña de asignaciones, como hasta ahora |
| **Centro concedido** | Un permiso suelto en un centro ajeno | **Esto**: el selector de la fila del permiso |

Un centro concedido **no** da sesión, **no** sale en el selector del nav y **no** cambia su menú.

## Leer — `GET /api/v1/profiles/:id/access?centroId=`

Ya existía; ahora cada fila del catálogo trae sus centros, y la respuesta trae la lista de centros
para llenar el selector sin una segunda llamada:

```jsonc
{
  "permisos": [
    { "clave": "calendario.read", "modulo": "calendario", "accion": "read",
      "descripcion": null,
      "viaRole": true, "override": null, "effective": true,
      "centrosConcedidos": [ { "id": "ef6f87b0-…", "nombre": "Bayamón" } ] },
    { "clave": "pacientes.read", "…": "…", "centrosConcedidos": [] }
  ],
  "roles": [ { "id": "…", "rolId": "…", "clave": "gerente", "nombre": "Gerente", "centroId": "5f98ef29-…" } ],
  "overrides": [ { "id": "…", "permisoId": "…", "permisoClave": "calendario.read", "efecto": "grant", "centroId": "ef6f87b0-…" } ],
  "effectivePermissions": ["…"],
  "centrosDisponibles": [ { "id": "5f98ef29-…", "nombre": "Caguas" }, { "id": "ef6f87b0-…", "nombre": "Bayamón" } ]
}
```

- `centrosConcedidos` es **siempre** un array (vacío = sin excepciones), nunca `undefined`.
- Se ven aunque la vista sea la del ámbito global (sin `?centroId=`), que es como abre la pantalla:
  filtrarlas por ámbito escondería justo lo que hay que gestionar.
- `centrosDisponibles` son todos los centros de la empresa: es la fuente del selector.

## Escribir — `PUT /api/v1/profiles/:id/permisos/:permisoClave/centros`

```jsonc
{ "centroIds": ["ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1"] }
```

El nombre del campo es **`centroIds`** (plural, así lo valida el DTO: array de UUID v4, sin
repetidos). `permisoClave` va en la ruta, tal cual (`calendario.read`).

Deja los centros de esa fila **exactamente** en esa lista: crea los que falten, borra los que sobren.
`[]` quita todas las excepciones de la fila. Idempotente.

Respuesta — la fila recalculada, para repintar sin recargar:

```jsonc
{ "clave": "calendario.read", "centrosConcedidos": [ { "id": "ef6f87b0-…", "nombre": "Bayamón" } ] }
```

Errores: `404` si el perfil o la clave del permiso no existen; `400` si algún `centroId` no es un
centro real (no escribe nada, es todo o nada); `403` si quien llama no es admin.

Lo que este endpoint **no** hace, a propósito: no toca el permiso global de la persona ni ningún
`deny`. Dar o quitar el permiso entero sigue en `POST /profiles/:id/permisos`
(`{ permisoClave, efecto, centroId? }`) y `DELETE /profiles/:id/permisos/:permisoId`.

## La pantalla

Una **columna más** en la tabla de permisos de la ficha, a la derecha del origen del permiso:
«Centros» con un selector múltiple por fila, precargado con `centrosConcedidos` y las opciones de
`centrosDisponibles`. Al cambiar, un `PUT` de esa fila; con la respuesta se repinta solo esa fila.

- **Vacío no es «ninguno»**: vacío significa «donde le toque por su rol y sus centros». Que el
  placeholder lo diga (p. ej. «Sin excepciones»), o alguien va a pensar que le está quitando algo.
- Mostrar el nombre del centro, nunca el UUID.
- Esta columna es **por usuario**: si a mucha gente le hace falta lo mismo, eso es un rol, y va por
  la pestaña de roles. Vale la pena decirlo en la propia pantalla.
- Etiquetas por `labelKey`, como el resto.

## El selector DENTRO de cada pantalla (esto sigue pendiente y es lo que se ve)

`GET /api/v1/me/centros-donde-puedo?permiso=calendario.read` devuelve los centros donde la persona
que ha entrado puede hacer eso — ahora incluye los concedidos. Es genérico: sirve para cualquier
permiso de cualquier módulo, y es lo que llena el selector de centro **de la pantalla** (calendario,
citas, personal), no el del nav.

Con el permiso concedido, la gerente de Caguas ve Caguas **y** Bayamón en el selector del calendario,
y `GET /calendario/eventos?centroId=<Bayamón>` le responde. El mismo `?centroId=` está en citas y en
personal. Los handoffs de esa parte son
`selector-de-centro-en-la-pantalla-handoff-be.md` y `permisos-y-roles-pantalla-handoff-be.md`.
