# FE — Al entrar, el avatar completo (no el volcado de la sesión)

Verificado en gamma el 23-ago-2026 entrando como `mbonillo43@gmail.com` (gerencia, Caguas).
**El backend ya sirve todo lo necesario.** Los tres puntos son de FE.

## 1. La primera pantalla enseña el volcado técnico, no a la persona

Al entrar, `/dashboard` muestra una tarjeta «Tu sesión» con `email`, `estado`, `isMaster`,
`accessMode`, `roles`, `allowedClinicIds`, `activeClinicId`, `perfilId`. Eso es diagnóstico, no una
pantalla de trabajo: los identificadores no le dicen nada a quien entra a facturar.

Lo que debería verse es la identidad de la persona: su nombre, su puesto y el centro donde está
trabajando, con el avatar. Los identificadores, detrás de un «ver detalles» o solo para admin.

**El dato ya está**, en dos llamadas que existen:

`GET /api/v1/auth/me` →
```jsonc
{
  "nombre": "M.", "apellido": "Bonillo",   // nombre visible; si viene null, usar el email
  "avatarUrl": null,                        // null → iniciales como respaldo (hoy ya se ven: «MB»)
  "roles": ["gerente"],                     // el puesto, para enseñarlo junto al nombre
  "activeClinicId": "5f98ef29-…",            // el centro donde está
  "allowedClinicIds": ["5f98ef29-…"],        // si trae más de uno, el selector de centro tiene sentido
  "estado": "aprobado", "personalId": "f0b93468-…", "perfilId": "ba3fbc43-…"
}
```

`GET /api/v1/auth/me/centros` → los centros de la persona **con nombre**:
```jsonc
[{ "id": "5f98ef29-…", "nombre": "CMR Caguas", "codigo": "cag", "zonaHoraria": "America/Puerto_Rico", … }]
```

Así que el nombre del centro **no hay que pedirlo aparte ni resolverlo contra `/centros`**: cruzar
`activeClinicId` con esa lista da «CMR Caguas». No hace falta ningún endpoint nuevo.

## 2. El botón dice «Iniciar sesión» estando ya dentro

En la barra superior, con la sesión abierta, sigue apareciendo «Iniciar sesión» arriba a la derecha
(se ve en la captura del dueño, y también con la cuenta de gerencia de Bayamón). Ahí va el avatar
con su menú: nombre, puesto, centro, y las opciones que ya existen (Apariencia, Mis tableros,
Módulos, Cerrar sesión).

## 3. Hace falta recarga forzada para ver los cambios

El dueño reporta que tras entrar hay que hacer *hard reload* para que se cargue bien. Eso apunta a
que la sesión y el menú se resuelven una vez y quedan en caché del cliente. El menú **depende del
permiso**, así que si se sirve cacheado, alguien puede ver ítems que ya no le tocan (o al revés)
hasta que recargue a mano.

Al entrar hay que volver a pedir `auth/me`, `auth/me/centros` y `me/menu` — sin caché o con la
clave de caché atada al usuario y al centro activo. Nadie debería tener que pulsar recargar para que
su propio menú sea el correcto.

## Nota sobre el nombre

`M. Bonillo` es el nombre con el que se creó la cuenta, no su nombre completo. Cuando el dueño diga
cuál es, se corrige con `PUT /api/v1/profiles/:id` y el avatar lo recoge solo.
