# Handoff FE — Consulta como una pestaña más del frontdesk

**Origen**: una auditoría pidió «unificar todo en una vista». El dueño decidió —tras revisarlo—
**unificar la VISTA y no el modelo**: Consulta se ve junto a los servicios, pero el dato sigue
viviendo en `citas`. El porqué está escrito en `cmr-be/docs/specs/una-sola-vista-dos-entidades.md`,
con las tres razones concretas; léelo si alguien pregunta.

**Condición del dueño, literal**: *«todo lo que hemos trabajado hasta ahora debe permanecer y seguir
funcionando igual»*. Nada de Atención se migra ni se toca.

## Lo que el BE expone

```
GET /api/v2/frontdesk/tabs        (v1: /frontdesk/pestanas)
```

Devuelve las pestañas de la pantalla, **ya ordenadas**:

**Verificado contra producción el 1-oct 12:13** — y CORREGIDO respecto a la primera versión de este
handoff, que traía los nombres en español. En `/api/v2` el traductor los pasa a inglés, y estos son
los de verdad:

```json
[
  { "slug": "apex",     "name": "APEX",     "labelKey": "frontdesk.pestana.apex",
    "boardSlug": "servicios", "entity": "sesion", "serviceId": "150a2e93…", "sortOrder": 0,
    "color": null, "icon": null },
  { "slug": "consulta", "name": "Consulta", "labelKey": "frontdesk.pestana.consulta",
    "boardSlug": "atencion",  "entity": "cita",   "serviceId": null,        "sortOrder": 9007199254740991,
    "color": null, "icon": null }
]
```

(En v1 los mismos campos se llaman `clave`, `nombre`, `tablero`, `entidad`, `servicioId`, `orden`.)

**La clave está en `boardSlug` y `entity`.** Cada pestaña dice quién la sirve:

- `boardSlug: "servicios"` → lo de siempre: `GET /frontdesk/board?servicio=<slug>&fecha=…`
  y las acciones por `POST /board/action` con `tablero: "servicios"`.
- `boardSlug: "atencion"` → **el tablero de Atención que ya existe y que ya pintáis**:
  mismas llamadas que hoy en `/boards/atencion`, mismas acciones, mismos permisos.

Hoy son **23 pestañas** en Caguas: las 22 de servicio más Consulta al final.

Es decir: no hay endpoints nuevos para Consulta. Lo que cambia es **dónde se pinta**.

## Lo que hace falta del FE

1. Construir las pestañas del frontdesk desde `GET /frontdesk/tabs` en vez de desde `GET /services`.
2. Al seleccionar una pestaña, mirar `boardSlug`: si es `servicios`, lo de siempre; si es `atencion`,
   montar el componente de Atención que ya tenéis.
3. `labelKey` para el texto, como siempre.

### El coste honesto, dicho de frente

La pestaña de Consulta **no comparte columnas** con las de servicio: no tiene técnico ni dosis;
tiene médico, triage y sus propios estados. Así que es un `if` por `boardSlug` en el render, no una
columna más de la misma tabla. Es a propósito, y es mucho más barato que la alternativa.

## Configurable por centro, sin desplegar

Dos campos nuevos en los datos del centro (`PUT /api/v2/centers/:id/datos-fiscales`):

| campo | qué hace |
|---|---|
| `frontdeskShowsConsultation` | si ese centro enseña la pestaña (por defecto **sí**) |
| `frontdeskConsultationOrder` | en qué posición va entre las de servicio; `null` = al final |

Si queréis el selector en la pantalla de configuración del centro, va junto a los otros dos
interruptores que ya hay allí (`frontdeskAutopresente`, `autoPresentFollowUp`).

## Lo que NO cambia

- `/boards/atencion` sigue existiendo igual. Esto **añade** un sitio donde verlo, no lo mueve.
- Ninguna cita se convierte en sesión de frontdesk, ni al revés.
- Permisos, acciones y columnas de Atención: idénticos.
