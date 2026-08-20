# Handoff BE — `/me/preferences` responde 409 sin centro activo

## Contexto
El acento de color por centro (spec `acento-de-color-por-centro`, ya en prod en el FE) pinta un
punto de color junto al nombre del centro en el switcher del header. El color sale de
`GET /me/preferences → effective.colorPorCentro[centroId]`.

## El problema
Para un usuario **multi-centro** (`allowedClinicIds.length > 1`, ej. `larcilesbay@outlook.com`)
que **aún no tiene centro activo elegido** (primer login / tras limpiar la cookie), el navegador
llama `GET /me/preferences` **sin** un `X-Tenant-ID` válido y el BE responde **409**. Verificado en
gamma: con Bayamón activo → 200 (trae colorPorCentro azul/verde, el punto se pinta bien); sin centro
activo → 409 (el FE lo captura y el punto no aparece). Es el mismo círculo vicioso que se arregló en
`/auth/me` y `/auth/me/centros` con el decorador `@SinCentroActivo()`.

## Impacto
Menor y acotado al PRIMER pick: en el desplegable del switcher, la primera vez (sin centro activo)
las opciones salen SIN su punto de color — justo cuando el color más ayudaría a elegir bien. En
cuanto se elige un centro, todo funciona (el centro activo persiste en cookie/perfil).

## Pedido
Marcar `GET /me/preferences` como accesible sin centro activo (mismo `@SinCentroActivo()` que
`/auth/me`). La resolución por capas ya funciona (sistema → centro → usuario → override): con centro
activo devuelve la capa `centro`; sin centro activo, basta con devolver `sistema` (+ `usuario`), que
es donde vive `colorPorCentro` por default. No hace falta endpoint nuevo.

## Cómo verificar
Login multi-centro sin centro activo → `GET /me/preferences` debe dar 200 con
`effective.colorPorCentro` presente (no 409).
