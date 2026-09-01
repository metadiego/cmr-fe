# FE — Al entrar, cada uno a SU trabajo. Fuera «Tu sesión» como aterrizaje.

Backend desplegado y verificado en producción el 24-ago-2026.

## El problema, dicho claro

Al entrar, **todo el mundo aterriza en `/dashboard`**, que es una pantalla de sesión: nombre, roles,
centro y botones de ajustes. Está bonita, pero no es trabajo. Waldemar entra a facturar y lo primero
que ve es su propia ficha; Karola entra a agendar y también.

El ítem ya no está en el menú de nadie (salvo admin), pero **el FE sigue redirigiendo ahí**, así que
da igual: es lo primero que ve todo el mundo cada mañana.

## Qué hacer

**1. Al entrar, preguntar a dónde ir:**

```
GET /api/v1/me/inicio
→ { "path": "/tablero/frontdesk", "elegida": null }
```

Y redirigir a ese `path`. **Sin suposiciones sobre en qué módulo trabaja cada uno**: el backend manda
lo que la persona **eligió** y, si no ha elegido, la **primera opción de su propio menú** — el orden
que ya está curado. Nada de adivinar el área de trabajo.

Verificado hoy en producción:

| Persona | Aterriza en |
|---|---|
| Waldemar (atención + inventario + facturación) | `/tablero/frontdesk` |
| Karola (call center) | `/citas` |
| Inventario | `/inventario` |

`path: null` significa que esa persona no tiene ninguna pantalla: **dilo en la interfaz**, no la
dejes en blanco mirando.

**2. Que cada uno pueda elegir la suya.** Un selector en sus ajustes —«Al entrar, llévame a…»— con
las opciones de su propio menú. Se guarda donde ya se guarda su apariencia:

```
PUT /api/v1/me/preferences   { "config": { "inicio": "/facturacion" } }
```

Su elección manda: `GET /me/inicio` devolverá `{ path: "/facturacion", elegida: "/facturacion" }`.

**Cuidado con una cosa** (ya resuelta en el backend, no la reimplementes): si le quitan el permiso de
la pantalla que eligió, `path` vuelve a la deducida y `elegida` sigue mostrando lo que pidió. Así no
entra a un «prohibido» cada mañana. Si `elegida` y `path` no coinciden, puedes avisarle de que su
pantalla preferida ya no está disponible.

**3. `/dashboard` deja de ser destino: quien llegue ahí, al trabajo.** Corrige lo que decía antes este
documento («dejarla como ajustes»): no es aterrizaje **ni** una pantalla en la que quedarse. `/dashboard`
resuelve `GET /me/inicio` igual que la entrada y **redirige** a la pantalla de la persona; solo se queda
si no tiene ninguna. Lo que había ahí —Apariencia, Mis tableros, Cerrar sesión— vive colgando del
**avatar**, que es donde la gente lo busca; no hace falta una pantalla de sesión para eso.

## Por qué no lo arregla el backend solo

La redirección al entrar es del cliente. El backend ya quitó el ítem del menú y ya dice a dónde
llevar a cada uno; lo que falta es que el FE deje de mandar a todos al mismo sitio.
