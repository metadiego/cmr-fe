# Handoff BE + spec FE — Acciones de barra del tablero, estilo "hooks" (plug/unplug por dato)

## Idea del dueño (2026-07-23)
Como los hooks de WordPress: poder **enchufar/quitar botones** de la barra del tablero SIN tocar código,
por configuración (API). Casos concretos pedidos:
1. Botón **"Calendario"** (abre el calendario del paciente / del día).
2. Botón **"Volver"** (retroceder a la vista previa).
3. **Filtro por paciente**: ver las citas de UN paciente (individuales) o TODAS (conjuntas/general).
Todo configurable, multi-tenant, sin hardcode. Si algo falla, se quita el botón por dato y ya.

## Modelo propuesto (data-driven, análogo a las COLUMNAS del tablero)
El tablero ya sirve `columnas` data-driven; añadir un arreglo **`acciones`** (toolbar slots) en la
definición/registro del tablero (`GET /tablero/definicion` o `/tableros`):
```jsonc
"acciones": [
  { "clave": "calendario_paciente", "labelKey": "tb.acc.calendario", "icon": "calendar",
    "slot": "toolbar", "orden": 1, "handler": "abrir_calendario_paciente",
    "requierePermiso": "citas.read", "visible": true, "params": { "rangoDias": 90 } },
  { "clave": "volver", "labelKey": "tb.acc.volver", "icon": "arrow-left", "slot": "toolbar",
    "handler": "volver", "orden": 0 }
]
```
- `handler` = clave de una acción que el FE sabe ejecutar (registro de handlers en el FE, como los
  `postAccion` ya existentes: `programar_citas`, etc.). El BE NO conoce la implementación, solo declara
  qué acción va y con qué params. Enchufar/quitar = agregar/quitar el item (o `visible:false`).
- `requierePermiso` = RBAC cosmético (el FE oculta; el BE es la autoridad).
- `slot` = dónde se pinta (`toolbar`, `row`, …) para crecer a más zonas.

## FE (cuando exista el contrato)
- Un **registro de handlers** por clave (`abrir_calendario_paciente`, `volver`, `filtrar_paciente`, …) y un
  renderer de `slot="toolbar"` que pinta los botones declarados (icon+label i18n, gate por permiso, orden).
  Agregar un handler nuevo = registrarlo una vez; el BE ya puede enchufarlo por dato. Plug-and-play real.
- Filtro por paciente: la búsqueda del frontdesk ya filtra por nombre/record/tel; el handler
  `filtrar_paciente` fijaría el paciente y un toggle "solo este paciente / todos".

## Contrato que necesito del BE
1. `acciones[]` en la definición del tablero (estructura de arriba; claves de `handler`/`slot`
   documentadas y configurables por API, no seed fijo).
2. Confirmar el catálogo de `handler` soportados que quieres para arrancar (calendario, volver, filtro).

## Pendiente decisión del dueño
- ¿El "Calendario" es del PACIENTE (sus citas) o del DÍA (todas)? El filtro "individual vs conjuntas"
  sugiere ambos → un handler con param `modo: "paciente" | "dia"`.
**FE detenido en esta pieza hasta el contrato `acciones[]`.** Lo demás del frontdesk sigue igual.
