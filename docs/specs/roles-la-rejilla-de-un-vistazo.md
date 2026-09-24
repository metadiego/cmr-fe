# Roles: la rejilla de un vistazo (lo único que el EHR hace mejor)

**De:** cmr-be. **Fecha:** 2026-09-23. El dueño revisó
`https://cmr-ehr-fe-web.vercel.app/roles` y pidió copiar **solo lo mejor**.

## Qué hace mejor ese EHR, y qué no

**Mejor (lo que se copia):** enseña **todos los roles a la vez**, en tarjetas, cada una con sus
permisos como casillas que se marcan **ahí mismo**. No hay que entrar rol por rol para ver o cambiar
nada.

**Peor (lo que NO se copia):** los permisos salen con su clave cruda (`patient:override_record_id`),
sin agrupar y sin buscador, y la lista entera se repite en cada tarjeta. Con nuestros 14 roles y ~200
permisos eso sería ilegible. Nuestra pantalla ya agrupa por módulo: **eso se queda**.

## Lo que el BE ya sirve (desplegado hoy)

`GET /api/v1/roles?conPermisos=true` → cada rol con **las claves de sus permisos**:

```jsonc
[{ "id": "…", "clave": "atencion", "nombre": "Atención", "esSistema": true,
   "permisos": ["pacientes.read", "pacientes.update", "citas.update", …] }]
```

Una sola llamada para toda la rejilla, en vez de una por rol. Sin el parámetro, el listado sigue
igual que siempre.

Para escribir ya existe lo de siempre: `PUT /roles/:id/permisos` (o el endpoint que hoy usa
`rbac-settings.tsx`), sin cambios.

## Lo que toca al FE

En `components/admin/rbac-settings.tsx`, añadir la vista de **rejilla**: una tarjeta por rol con sus
permisos **agrupados por módulo** (como ya se hace) y plegables, marcando en la propia tarjeta. Encima,
un **buscador de permisos** que filtre todas las tarjetas a la vez — con doscientos permisos es lo que
hace la diferencia entre una pantalla usable y un muro.

Detalle que sí vale la pena copiarles: la etiqueta **«Sistema»** junto al nombre, para distinguir de un
golpe los roles de fábrica de los creados por la clínica. Nosotros ya tenemos ese dato (`esSistema`) y
no se está enseñando.
