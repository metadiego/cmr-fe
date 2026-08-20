# Avisar al usuario que está tomando una dosis que el paciente no compró (y ver los descuidos del día)

> Handoff **BE → FE**. Fecha: 2026-08-20. El BE ya está construido, probado y desplegado.
> Spec del BE: `cmr-be/docs/specs/avisos-del-descuido-frontdesk.md`.

## Por qué esto existe

Palabras del dueño:

> «¿Qué pasa si un usuario descuidado, de las doce dosis que ya tiene reservadas el paciente por su
> compra, no le asigna ninguna? Tenemos que cuidar todas las bases, porque los usuarios hacen lo que les
> da la gana y dañan.»

> «Se le hace una notificación visual… no que venga en la parte inferior como todos los toast: este
> tiene que estar **más en el centro, a la vista**, de tal manera que el usuario se dé cuenta de que
> está cagándola. Y si de verdad es necesario que tome esa dosis que no le corresponde, está bien que la
> tome, pero que por lo menos se le avise.»

El BE ya no pierde el descuento en silencio y registra tres tipos de descuido. Lo que falta es que el
usuario lo vea **cuando todavía puede corregir**, y que alguien pueda revisar lo que pasó al final del día.

## 1. El cartel centrado, al elegir una dosis que no compró

El select de dosis del tablero **ya separa** lo que el paciente compró del resto (el separador existe).
Cuando el usuario elige una opción **del lado no comprado**:

- Sale un **diálogo centrado en la pantalla** (no un toast abajo: nadie los ve). Estilo alerta, con el
  peso visual de algo que hay que leer.
- Dice las dos cosas concretas: **qué compró el paciente** (por ejemplo «tiene 12 sesiones de Vitamina C
  de 25 g pendientes») y **qué está eligiendo** («estás aplicando 15 g, que no compró»).
- Dos salidas, sin ambigüedad: **«Usar la que compró»** (vuelve el select a la opción comprada) y
  **«Aplicar esta de todas formas»**.
- **No bloquea.** Hay casos legítimos y el dueño lo dijo explícito. Si sigue, el BE ya registra el evento
  `dosis_no_comprada` al asistir, y ahora además sale en la lista de descuidos.
- Sale **solo** al elegir del lado no comprado — no cada vez que se abre el select. Un cartel que
  aparece siempre se aprende a cerrar sin leer, y entonces no sirve para nada.

## 2. El contador de descuidos en el tablero de frontdesk

`GET /frontdesk/reportes/avisos?desde=<hoy>&hasta=<hoy>`

```jsonc
{
  "desde": "2026-08-20", "hasta": "2026-08-20",
  "total": 3,
  "porTipo": { "entrega_sin_paquete": 2, "dosis_no_comprada": 1, "entrega_sin_saldo": 0 },
  "avisos": [
    { "id": "…", "tipo": "entrega_sin_paquete", "sesionId": "…", "fecha": "2026-08-20",
      "paciente": "LOURDES MALDONADO", "servicio": "NANO DPM",
      "actorId": "…", "actor": "Ana Ruiz", "cuando": "2026-08-20T14:02:11Z",
      "detalle": { "cantidad": 1 } }
  ]
}
```

Los tres contadores vienen **siempre**, en cero cuando el día fue limpio: así «todo bien» se lee de un
vistazo y no se confunde con «el reporte no cargó».

Qué significa cada tipo, para el texto de la pantalla:

| tipo | qué pasó |
|---|---|
| `entrega_sin_paquete` | la visita ocurrió y no había paquete al que descontarla: el insumo no se movió |
| `dosis_no_comprada` | se aplicó una presentación que el paciente no compró; se cobró al paquete de la fila |
| `entrega_sin_saldo` | se entregó sin disponibilidad y el pendiente quedó en negativo |

**Dónde va:** un contador visible en el tablero de frontdesk (por ejemplo «3 avisos hoy») que abre la
lista. Si hay que ir a buscarlo a una pantalla de reportes, nadie lo mira — eso es exactamente el
problema que estamos arreglando. Cada fila debe poder abrir su sesión para repararla.

Permiso: `frontdesk.read`, el mismo que los otros reportes de la jornada.

## Cumple, como todo lo demás

API-First · MCP (`reportes_frontdesk` con `tipo: "avisos"`) · Swagger · configurable sin hardcode ·
multi-tenant (el reporte ya filtra por centro; un descuido de Bayamón no aparece en Caguas) · RBAC ·
spec y plan antes de código · TDD · i18n con `labelKey`, nunca cadenas quemadas · no duplicar código ·
usar el endpoint correcto, no el más cómodo · verificar en pantalla con `/qa`, sin adivinar.

## Qué es «terminado»

- Elegir una dosis del lado no comprado saca el cartel **centrado**, con lo que compró y lo que está
  eligiendo, y las dos salidas. Elegir una comprada no saca nada.
- Seguir de todas formas deja aplicar y no rompe el flujo.
- El tablero muestra el contador de descuidos del día y abre la lista con paciente, servicio y quién.
- Un día limpio muestra cero, no una lista vacía sin explicación.
