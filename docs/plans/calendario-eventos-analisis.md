# Análisis — Calendario de eventos (legado) + propuesta moderna por centros

**Estado: análisis, sin código.** Fuente auditada en disco: `cma/vistas/calendario/{index.php,
modal_eventos.php}`, `cma/models/EventosModel.php`, `cma/js/calendario.js`,
`cma/handler/EventosHandler.php` (`q=saveevent|loadevent|delete`).

## Qué hace el legado (`/cma/vistas/calendario/`)
Un calendario MENSUAL simple de recordatorios/eventos:
- Rejilla del mes (`calendar_table`, tabla propia — NO FullCalendar) con selector de **mes**. Cada celda
  de día es clicable → abre un modal con los eventos de ESE día y permite agregar uno.
- Dos paneles arriba: **«Eventos de hoy»** y **«Próximos 6 días»** (resumen).
- Modal de evento: **Fecha inicial** (el día) + **Evento** (texto libre). La lista muestra
  **Desde | Evento | Aprobado por** (usuario que lo creó) y borrar.

## Modelo de datos (tabla `eventos`)
Por lo que guarda `save_evento` (`q=saveevent`): `fechaEvent` (día del evento), `evento` (texto),
`usuario` + `creado` (fecha_creado = «programado en» / «Aprobado por»). `loadevent` trae los eventos de
un día. **NO existe:** centro/clinic, hora, hora fin, color/categoría, recurrencia, adjuntos, estado.

## Limitaciones del legado (lo que hay que superar)
- **Un solo calendario, sin centros.** No se puede ver/filtrar por Bayamón vs Caguas.
- Solo texto + día; sin **hora**, sin **color/categoría**, sin **recurrencia**, sin vistas semana/día.
- Tabla mensual casera, poco visual; sin arrastrar, sin rango, sin buscar.

## Propuesta — versión moderna, «supercool», POR CENTROS (FE cmr-fe)
Manteniendo la uniformidad del diseño del proyecto y usando todo el ancho:
- **Calendario moderno** con vistas **Mes / Semana / Día** (y agenda/lista). Buscar layout de referencia
  (Google Calendar / Cal.com / Linear) y adaptarlo al sistema de diseño.
- **Por centros**: filtro/segmentación por centro (multi-tenant), **color por centro** (reusa el acento
  de color por centro ya existente — [[acento-color-por-centro]]); vista «Todos los centros» para
  gerencia y por-centro para el resto (mismo patrón que la agenda del día y el switcher).
- **Evento enriquecido**: título, fecha + **hora inicio/fin** (o todo-el-día), **centro**, **categoría/color**,
  descripción, creado por, y **recurrencia** opcional (diaria/semanal/mensual).
- Paneles «Hoy» y «Próximos días» como tarjetas (mismo lenguaje visual que los KPIs del Frontdesk).
- Crear/editar en un panel lateral o modal moderno; arrastrar para mover; clic en día para crear.
- **Nada aislado** ([[todo-relacionado-nada-aislado]]): un evento puede relacionarse con su centro y, a
  futuro, con lo que ya existe (una cita, un paciente, una campaña) — dejar el enganche previsto.

## Qué necesito del BE
Ver `docs/specs/calendario-eventos-handoff-be.md`: CRUD de eventos multi-tenant (centroId), con los
campos nuevos. El FE no inventa el modelo; lo pinta data-driven.
