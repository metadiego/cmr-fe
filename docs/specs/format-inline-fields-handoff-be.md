# Formatos: campos en una sola línea (`render.camposEnLinea`) — handoff FE → BE

**Fecha:** 2026-11-04

## Qué pide el dueño

En la hoja APEX (`apex_rf`, layout `campos`), la primera línea debe ser
**Paciente · Record # · Sesión # · Fecha**, juntos. Las horas de entrada y salida siguen debajo, una por línea.

## Qué hay ya

- **FE.** Lee `render.camposEnLinea: string[]`: las claves de `fields` que van juntas en la primera línea,
  en ese orden. El resto sigue con un campo por línea. Sin esa clave, el formato queda exactamente como
  el legacy. La lógica está en `lib/formatos/inline-fields.ts`, con su test.
- **Datos.** Los `fields` de `apex_rf` ya están reordenados y reetiquetados en Caguas y Bayamón con `PUT /formats/:id`.

## El hueco

`PUT /formats/:id` rechaza la clave:

```
render: opción de dibujo desconocida; las válidas son ocultarEmpresa, …, ocultarPie
```

## Lo que se pide

- Aceptar en la lista blanca de `render` la clave `camposEnLinea?: string[]`, con las claves de `fields`.
- Validar que cada clave exista en `fields` del mismo formato.
- Devolverla en `GET /formats` y en `/formats/:slug/assembly`.

Cuando esté, el FE pondrá `camposEnLinea = ["paciente","record","sesion","fecha"]` en `apex_rf` de los dos centros.
