# Handoff BE — Calendario de eventos por centro (versión moderna)

> FE → BE. Fecha: 2026-08-22. Análisis del legado en `docs/plans/calendario-eventos-analisis.md`.

## Qué es
Reemplazo moderno del calendario del legado (`cma` tabla `eventos`, hoy: día + texto + creador, SIN
centro). La versión nueva es un calendario por CENTROS con eventos enriquecidos. Necesito CRUD
multi-tenant, RBAC, i18n de labels; sin hardcode.

## Modelo propuesto (evento)
```jsonc
{
  "id": "uuid",
  "centroId": "uuid | null",     // null = evento global (todos los centros); si no, es de ese centro
  "titulo": "string",
  "descripcion": "string | null",
  "inicio": "2026-08-22T09:00:00-04:00",   // ISO con tz America/Puerto_Rico
  "fin": "2026-08-22T10:00:00-04:00 | null",
  "todoElDia": true,
  "categoria": "string | null",  // catálogo del BE (color/labelKey), NO lista quemada en el FE
  "color": "#RRGGBB | null",     // o derivado de la categoría / del centro
  "creadoPor": { "id": "…", "nombre": "…" },
  "createdAt": "…",
  "recurrencia": null            // futuro: { frecuencia:'diaria|semanal|mensual', hasta? } — confirmar si entra ya
}
```

## Endpoints
- `GET /calendario/eventos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD[&centroId=]` → eventos del rango.
  - Sin `centroId` y con permiso de gerencia → todos los centros (consolidado, para colorear por centro).
  - Con `centroId` (o centro activo) → los de ese centro (+ globales `centroId:null`).
- `POST /calendario/eventos` → crear. `PUT /calendario/eventos/:id` → editar. `DELETE /calendario/eventos/:id`.
- `GET /calendario/categorias` → catálogo de categorías (id, labelKey/nombre, color) si se usan categorías.

Permisos: `calendario.read` / `calendario.write` (o los que ya existan para agenda). Multi-tenant por
`X-Tenant-ID`; el consolidado (todos los centros) solo para roles que ya ven todos los centros.

## Preguntas a zanjar (no asumir)
1. ¿Migramos los eventos existentes de la tabla `eventos` del legado (día+texto+creador) al modelo
   nuevo? Si sí, ¿a qué centro se asignan (global vs el centro del creador)?
2. ¿Entra recurrencia en esta primera versión o después?
3. ¿Categorías con catálogo del BE, o de momento solo color por centro (reusando el acento de color por
   centro que ya existe)?
4. ¿tz siempre America/Puerto_Rico como en Citas?

Con esto armo el calendario moderno (Mes/Semana/Día, por centro, color por centro, panel Hoy/Próximos),
data-driven y uniforme con el resto del sistema.
