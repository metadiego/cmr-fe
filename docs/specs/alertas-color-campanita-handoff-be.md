# FE — Color de alerta por dominio y alertas apiladas en la campanita

El backend ya manda el dato. Falta pintarlo.

## Qué llega ahora

`GET /api/v1/comunicaciones/tipos-alerta` — cada tipo trae dos campos nuevos:

```jsonc
{
  "clave": "transferencia.recepcion",
  "labelKey": "alerta.tipo.transferencia_recepcion",
  "severidadDefault": "warning",
  "icono": "inbox",
  "dominio": "inventario",   // ← NUEVO: inventario | caja | clinico | agenda | …
  "color": "verde"           // ← NUEVO: verde | ambar | rojo | azul | violeta | gris
}
```

`color` es una **clave semántica, no un hex**: mapéala a tu paleta para que la pantalla mantenga una
sola identidad visual. `null` en cualquiera de los dos = cae al comportamiento de hoy (color por
severidad).

Hoy en producción los dos tipos de transferencia son `inventario` / `verde`. Cuando se añadan más
tipos llegarán con su propio color desde el catálogo, sin tocar código: no metas un mapa de colores
por clave de alerta en el FE, usa el campo.

## Lo que hay que hacer en la campanita

1. **Color por dominio.** Cada alerta se pinta con el color de su tipo. Inventario en verde.
2. **Apiladas, no solapadas.** Cuando hay varias, que se vea el borde de cada una, como un libro
   entreabierto: un ligero desplazamiento y un halo o borde propio por alerta, de forma que se
   cuenten de un vistazo sin abrir el panel. Nunca una tapando a la otra.
3. Al abrir el panel, agrupar por dominio ayuda: el color ya lo insinúa.

Busca una referencia moderna de este patrón de pila (notification stack / stacked toasts) y adáptala
a nuestra paleta, sin romper la uniformidad del resto de la interfaz.

## Contexto de por qué

La transferencia entre centros crea una alerta accionable en el centro **destino**: el stock no sube
allí hasta que su encargado la acepta. Esa alerta es la que le avisa, y el verde le dice que es de
inventario antes de leerla.
