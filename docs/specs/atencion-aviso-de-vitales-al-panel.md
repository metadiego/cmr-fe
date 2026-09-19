# Atención: el aviso de VITALES al panel de enfermería — ya sirve el BE

Pedido del dueño (18-sep-2026): que en `/boards/atencion` esté el botón/aviso de **vitales** para
avisar al **panel de enfermería**.

**Hecho del lado del BE y verificado en producción.** No hubo que programar nada: la capacidad ya
existía entera; lo que faltaba era que la columna estuviera **visible** en la composición del
tablero. Ahora lo está, en los **dos centros** (la composición es global).

## Lo que sirve el tablero

`GET /board/rows?boardSlug=atencion&date=…` trae la columna **`citas_notificar`**, entre `asistido` y
`acciones`, con este render:

```json
{
  "icon": "bell",
  "kind": "notificar",
  "modal": "panel_notificar",
  "panel": "enfermeria",
  "seccion": "vitales",
  "mostrarAsignado": true,
  "asignadoDe": "enfermera",
  "asignadoBinding": "enfermera.nombre",
  "asignadoWriteBinding": "cita.enfermeraVitalesId"
}
```

Es el **mismo contrato** que el botón de notificar del frontdesk (`fd_notificar`), así que el modal
`panel_notificar` que ya existe sirve tal cual. Dos detalles propios de Atención:

- La enfermera se **lee** de `enfermera.nombre` (que sale de `cita.enfermeraVitalesId`) y se
  **escribe** en `cita.enfermeraVitalesId` — no en el `enfermeraId` de la sesión del frontdesk.
- La fila es una **cita**, así que el aviso viaja con `citaId`, no con `sesionId`.

## El aviso

```
POST /api/v1/paneles/enfermeria/notificar        (v2: /panels/enfermeria/notify)
{ "seccion": "vitales", "citaId": "<uuid de la fila>" }
```

Idempotente: si esa fila ya tiene un aviso pendiente en la sección, lo reusa (no duplica campanas).

Otros endpoints ya existentes: `GET /paneles/enfermeria/notificaciones` (pendientes),
`POST /paneles/notificaciones/:id/aceptar`, `.../cancelar`, `GET /paneles/enfermeria/contadores`.

Permiso: **`panel.notificar`**, que ya tienen `admin`, `gerente`, `recepcion`, `atencion` y
`enfermeria` (comprobado rol por rol en producción). Leer el panel: `panel.read`.

## Probado por HTTP contra producción (18-sep)

1. Aviso creado desde una cita real de Caguas → `estado: "pendiente"`.
2. `GET /paneles/enfermeria/notificaciones` lo devuelve con el nombre del paciente.
3. Cancelado y el panel vuelve a 0 pendientes — no quedó basura.
4. El panel `enfermeria` y sus dos secciones (`vitales`, `intravenoso`) existen en **Caguas y
   Bayamón**, y el tablero de ambos ya trae la columna.

## Lo que falta (FE)

- Pintar la campana en Atención (el mismo componente del frontdesk; `kind: "notificar"` ya lo dispara).
- Debajo, el nombre de la enfermera asignada (`mostrarAsignado`), y al asignarla escribir por
  `asignadoWriteBinding`.
- El aviso llega al panel por el SSE que ya existe; no hay que inventar canal.
