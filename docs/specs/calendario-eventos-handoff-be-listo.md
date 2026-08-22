# FE — Calendario de eventos: el backend está listo y sembrado

Responde a `calendario-eventos-handoff-be.md`. Desplegado, con permisos y categorías **ya sembrados en
producción** y probado creando un evento de verdad. Ya no chocarás con 403 ni con datos vacíos.

## Tus cuatro preguntas

1. **Los 1.395 eventos del legado se migran, como globales.** El legado no tiene centro y su autor
   habitual es el call center, que trabaja para todos: asignarlos a uno sería inventar. El importador
   está hecho (`migrate-legacy-calendario.ts`) y usa `legacyId` como llave anti-duplicados; lo corro
   cuando digas, porque el MSSQL solo se alcanza desde la red de la clínica.
2. **Recurrencia: no ahora.** El legado no la tiene y no hay un caso concreto. Cuando aparezca será una
   tabla de reglas, no un campo — así que no dejes hueco en la interfaz por si acaso.
3. **Categorías: catálogo del backend**, ya sembrado con seis (`feriado` rojo, `cierre` rojo, `visita`
   azul, `capacitacion` violeta, `personal` ámbar, `aviso` gris).
4. **Zona horaria:** no hace falta convertir nada. El evento se guarda como **día calendario** y hora
   de pared, que es la representación correcta de «el martes a las 9»: no se mueve con la zona.

## Endpoints

```
GET    /api/v1/calendario/eventos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD[&centroId=]
POST   /api/v1/calendario/eventos
PUT    /api/v1/calendario/eventos/:id
DELETE /api/v1/calendario/eventos/:id
GET    /api/v1/calendario/categorias
POST   /api/v1/calendario/categorias      (config)
PUT    /api/v1/calendario/categorias/:id  (config)
```

Evento:

```jsonc
{
  "id": "…", "clinicId": "…",
  "dia": "2026-08-25",          // día calendario
  "diaFin": null,               // último día si dura varios
  "hora": "09:00",              // HH:mm del centro; null = todo el día
  "horaFin": "10:30",
  "titulo": "…", "descripcion": null,
  "categoriaId": "…",           // de ahí salen color y rótulo
  "esGlobal": false,            // true = lo ve cualquier centro
  "creadoPor": "…", "legacyId": null
}
```

- `GET` devuelve los del centro activo **más** los globales, por **solapamiento**: una feria de tres
  días sale en todas las semanas que toca. Ya viene ordenado por día y hora.
- Permisos: `calendario.read` / `create` / `update` / `delete`, y `calendario.config` para el catálogo.
  Los tienen admin y gerente; dime qué otros roles deben crear eventos y se los doy.
- Un evento solo se edita desde su propio centro; los globales, desde cualquiera.

## Para la pantalla

- **El color y el rótulo salen de la categoría**, no de una lista en el FE. El color es una clave
  semántica (`rojo`, `azul`, `violeta`, `ambar`, `gris`, `verde`): tradúcela a tu paleta, no la pintes
  literal — igual que hiciste con la campanita.
- Los eventos globales conviene distinguirlos visualmente (un borde, un icono): son de la empresa, no
  del centro que estás mirando.
- Mes/Semana/Día como propusiste, con el panel de hoy y próximos días. Aprovecha el ancho.
