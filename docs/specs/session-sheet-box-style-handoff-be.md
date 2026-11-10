# Hoja por sesión, estilo «caja» (Nano Aer Plus): una opción de render (handoff FE → BE)

**Fecha:** 10-nov-2026 · **Pedido por:** el dueño, revisando «Nano + Láser Intravenoso.pdf» contra lo
que imprimimos (`.personal/formatos-legacy/`).

## Por qué

El legacy tiene **dos familias** de hoja por sesión (`layout: "sesiones"`):

- **Franjas** (Vit C con láser, Láser intravenoso): franjas grises para escribir y la firma del paciente
  abajo a la derecha. Es lo que el FE dibuja hoy.
- **Caja** (Terapia de Nano Aer Plus, Nano + Láser intravenoso):
  - cajas blancas con borde negro;
  - «SESION #» a la derecha;
  - Enfermero(a) y Firma del paciente en la misma fila, y Hora debajo;
  - una raya que cierra cada bloque.

Nada en el armado distingue una familia de la otra: las dos llevan `render.notas: ["",""]` y
`porPagina: 2`.

## Lo que pide el FE

1. **Admitir `estiloSesion` en `OPCIONES_DE_RENDER`**, con valores `"caja" | "franjas"`. Sin la opción,
   el FE dibuja franjas.

   Probado en producción el 10-nov: `PUT /api/v2/formats/4f98f489-…` con
   `render.estiloSesion: "caja"` responde 400, «opción de dibujo desconocida», y no cambia nada.
2. **Ponerla en `"caja"`** en `nano_laser` y en `nano_laser_iv`, en los dos centros. Conservar el resto
   del `render` (`notas`, `porPagina`).
3. Que el armado la devuelva en `render`, como las demás opciones.

## Lo que ya hizo el FE (en producción)

- `SesionesFormato` dibuja la variante `caja` cuando `render.estiloSesion === "caja"`.
- Arreglado para todas las hojas por sesión:
  - el pie f-b/ ya no salta a una segunda hoja vacía;
  - con tres campos en el encabezado (nombre, récord, fecha), el nombre ya no se parte en dos líneas.

## Verificación

En Caguas, Ángel Ríos Vélez (6-nov), NANO → Acciones → «NANO AER PLUS · LÁSER INTRAVENOSO» → Imprimir.
Tienen que salir:

- cajas con borde;
- «SESIÓN # : 1/2» a la derecha;
- Enfermero(a) y Firma del paciente en la misma fila;
- una sola hoja.
