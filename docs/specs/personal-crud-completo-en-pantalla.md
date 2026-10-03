# El personal se tiene que poder editar desde la pantalla

**Pedido del dueño, 3-oct-2026:** *«Acabo de ver que no tenemos cómo editar el nombre o cualquier
dato del personal»* → *«aplica un CRUD con todas las reglas»*.

## El backend ya está completo, y verificado hoy en producción

No falta ningún endpoint. Probado en vivo con **Bayamón, KAROLA BLASINI**: se le cambió nombre,
apellido y color por API y quedó correcto, con las iniciales recalculadas solas (`KBLA`).

```
GET    /api/v1/personal                      lista (q, capacidad, codigoLegacy, centroId,
                                             incluirInactivos, soloInactivos)
GET    /api/v1/personal/:id                  la ficha
GET    /api/v1/personal/:id/centros          sus centros, con cuál está encendido
POST   /api/v1/personal                      crear          · permiso personal.create
PUT    /api/v1/personal/:id                  editar         · permiso personal.update
PUT    /api/v1/personal/:id/centros          sus centros    · permiso personal.update
DELETE /api/v1/personal/:id                  baja LÓGICA    · permiso personal.delete
```

En `/api/v2`: `/staff`, `/staff/:id`, `/staff/:id/centers`. Y las mismas capacidades por MCP
(`list_staff`, `create_staff`, `update_staff`, `staff_centers`, `staff_by_capability`).

## Campos editables (todos los de la ficha)

`nombre`, `apellido`, `iniciales`, `cargo`, `capacidades`, `especialidad`, `telefono`, `email`,
`sexo`, `color`, `perfilId`, `activo`, `frontdeskStartsOnConsultation`, `pestanaInicialConsulta`.

Dos cosas que hoy se arreglaron en el backend para que el CRUD esté entero:
- **`color` ya se puede editar** (antes estaba en la entidad pero no en el DTO: había que tocar la
  base a mano).
- `POST`, `PUT` y `DELETE` **declaran su permiso** explícito, como ya hacían los `GET`.

## Lo que NO se edita, a propósito

- `codigoLegacy`: es el código de esa persona en el sistema viejo. Es un hecho, no una preferencia.
- Los centros van por su endpoint propio (`PUT :id/centros`), porque tienen su propia regla: sin
  centros la persona no aparece en ningún select, y el BE lo rechaza.
- **El borrado es baja lógica**: quien ya no trabaja aquí sigue firmando las citas y facturas que
  hizo, y su cartera de pacientes sigue siendo suya. Por eso existe `?soloInactivos=true`, para
  poder verlos y reactivarlos.

## Lo que falta, y es de pantalla

En la pestaña **Personal** del hub nuevo: poder **crear**, **editar** y **dar de baja**, no solo
ver. Con tres detalles que el backend ya soporta y conviene aprovechar:

1. **Ver los de baja** (`?soloInactivos=true`) y poder reactivarlos con `activo: true`. Hoy
   desaparecen de la lista y parecen borrados.
2. **Los centros** en la misma ficha, con su endpoint: es la pregunta de al lado («¿dónde trabaja
   esta persona?») y mandarla a otra pantalla es el paseo del que se queja el dueño.
3. **El color**, que se ve en los tableros, con un selector y no escribiendo un hexadecimal.
