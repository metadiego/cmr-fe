# Handoff BE → FE — La ficha de personal: todo en UNA pantalla

**Fecha:** 2026-08-26 · **BE:** hecho y desplegado

## Lo que pide el dueño, textual

> «Todo desde una misma pantalla, y uno está saltando de pantalla en pantalla. Ese es un fastidio,
> porque al final no sabe si lo hizo bien o lo hizo mal.»
> «Quiero simplemente entrar con mi usuario de admin, seleccionar, uno o dos clics y ya. Las cosas no
> tienen por qué ser complicadas.»

Así que **una sola pantalla por persona**, sin navegar a otra para completar nada, y **que se vea el
estado final** en la misma pantalla al terminar. Nada de «guardado» a secas.

## La pantalla: ficha de personal

Un panel por persona con todo lo suyo. Cuatro bloques, ningún salto:

```
Luis Guzmán                                    [ Dar acceso al sistema ]
lguzman · sin cuenta de acceso

Cargo        [ Técnico ▾ ]            ← desplegable del catálogo: GET /personal/cargos
Hace         [✓ Técnico] [ ] Enfermera [ ] Médico [ ] Recepción …   ← capacidades
Centros      [✓] CMR Bayamón   [✓] CMR Caguas   [ ] CMR Miami
             Marca donde debe salir en los desplegables. Si un día cubre en otro
             centro, lo marcas; al volver, lo desmarcas.
Acceso       Sin cuenta. [ Dar acceso al sistema ]
```

### Los cuatro endpoints, uno por bloque

| Bloque | Llamada |
|---|---|
| Cargo y capacidades | `PUT /personal/:id` con `{ cargo, capacidades }` |
| Centros | `PUT /personal/:id/centros` con `{ centroIds: [...] }` |
| Catálogo del desplegable | `GET /personal/cargos` |
| Dar acceso | `POST /profiles/invite` (abajo) |

## «Dar acceso al sistema»: UN diálogo, UNA llamada

Este es el que importa para lo de «dos clics». **No hay que orquestar nada**: `POST /profiles/invite`
ya lo hace todo en una sola llamada.

```
POST /api/v1/profiles/invite
{
  "email": "lguzman@…",
  "nombre": "Luis",
  "apellido": "Guzman",
  "personalId": "<id de la ficha>",   ← ESTO es lo que lo enlaza. No lo olvides.
  "rolClave": "tecnicos",
  "centroId": "<uuid del centro>",
  "tipoAsignacion": "base"
}
```

En una sola llamada: crea la cuenta, la enlaza a la ficha, le da el rol y le asigna el centro. El
diálogo solo necesita **dos campos**: correo y rol (el nombre y el apellido salen de la ficha, y el
centro por defecto es el activo).

### Errores que el diálogo debe enseñar tal cual

| Código | Qué pasó |
|---|---|
| `PERSONAL_YA_TIENE_CUENTA` | Ya tiene cuenta enlazada. Hay que desvincular la actual primero — dos cuentas para la misma persona rompen las estadísticas de quién hizo qué. |
| `PERSONAL_DE_OTRO_CENTRO` | El centro elegido no es uno de los que la ficha tiene encendidos. **Ojo:** se comprueba contra los centros de servicio, no contra el de origen, así que Luis (Bayamón + Caguas) acepta los dos. |
| `PERSONAL_NO_EXISTE` | El `personalId` no existe. |

### Después de dar acceso, repinta el bloque

El botón desaparece y en su lugar:

```
Acceso       lguzman@… · rol Técnicos · aprobado        [ Ver usuario ]
```

Eso es lo de «saber si lo hizo bien»: la misma pantalla dice el estado final. Si hace falta ir al
detalle del usuario, que sea un enlace **opcional**, no el sitio donde se termina el trabajo.

## Y para los usuarios que sí entran al sistema

En la ficha del **usuario** (no del personal) hacen falta dos cosas más, ya documentadas aparte:

- **Accesos por centro** (un rol distinto en cada centro): `roles-por-centro-en-la-ui-handoff-be.md`.
- **«Clonar de»** para los puestos con rotación: `clonar-acceso-de-usuario-handoff-be.md`.

Las tres pantallas comparten la misma idea: **una persona, un panel, y el estado a la vista**.
