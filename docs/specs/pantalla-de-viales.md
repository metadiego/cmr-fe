# Pantalla de viales: ver el frasco abierto y de cuál salió cada dosis

> Repo: **cmr-fe** (frontend). El backend está construido, revisado y desplegado.
> Spec del BE: `cmr-be/docs/specs/reporte-de-viales-configurable.md`.

## Por qué

El legado tiene un reporte de viales de Tirzepatide que el dueño usa a diario y que nosotros no
teníamos. Lo importante no es la tabla: es el **dibujo**. Se ve el frasco abierto medio lleno y los
frascos cerrados contados, y eso se entiende sin leer nada. Debajo, cada dosis dice de qué vial salió.

Aplica a cualquier producto que se dosifique en viales — Tirzepatide (GLP-1), NANO DPM (gelatina de
Wharton) y BPC-157, que además lleva **el vial personalizado por paciente**: al frasco se le escribe el
número de récord.

## Lo que da el backend

`GET /api/v1/inventario/viales-abiertos/reporte?productoId=&almacenId=&desde=&hasta=&pacienteId=`

```jsonc
{
  "productoId": "…",
  "cerrados": 13,                    // frascos sellados en el estante
  "activo": {                        // el que está en uso; null si no hay ninguno abierto
    "id": "…", "numero": 37, "estado": "abierto",
    "capacidad": 60, "remanente": 45, "porcentaje": 75
  },
  "historicos": [ { "id": "…", "numero": 36, "estado": "agotado", … } ],
  "consumos": [
    { "fecha": "2026-08-21T12:07:11Z", "cantidad": 7.5, "vialId": "…", "vialNumero": 37,
      "pacienteId": "…", "sesionId": "…", "usuarioId": "…" }
  ]
}
```

Detalles que la pantalla debe respetar:

- **El porcentaje ya viene calculado** y está acotado entre 0 y 100. No recalcular.
- **Un remanente NEGATIVO se muestra tal cual** (significa que se aplicó más de lo que el frasco tenía,
  y es una señal de que algo se registró mal), pero el frasco se dibuja vacío, no invertido.
- El rango de fechas incluye el día completo: `hasta` no pierde el último día.
- Permiso `inventario.read`: lo ven admin, gerente y el rol Inventarios.

## La pantalla

Va en el menú de **Inventario → Viales**. Ancho completo, mismo lenguaje visual del resto.

1. **Selector de producto** arriba. Los productos salen del BE (los que se dosifican en vial), nunca de
   una lista escrita en el FE. Selector de almacén al lado, opcional.
2. **Inventario visual**, la mitad del valor:
   - los frascos **cerrados** con su número grande;
   - el **frasco activo** dibujado con su nivel real (relleno proporcional al porcentaje), su número de
     vial, y `45 de 60 mg` debajo.
   Si no hay vial abierto, se dice: «no hay vial activo», no un frasco vacío ambiguo.
3. **Detalle de consumos**: fecha, hora, paciente, dosis, y la columna **Vial** con su número. Filtros de
   fecha y paciente. Paginado como el resto.
4. **Históricos**: los viales ya agotados, en una lista secundaria (colapsable), no compitiendo con lo
   que importa.
5. **BPC / viales por paciente**: cuando el vial tiene dueño, su nombre va junto al número del frasco.

## Lo que NO se hace

- No se recalcula nada que el BE ya calcula (porcentaje, remanente, cerrados).
- No se esconde un remanente negativo: es justo lo que hay que ver.
- No se listan productos a mano: si mañana un producto nuevo se dosifica en vial, aparece solo.

## Cumple

API-First · Swagger (el BE ya lo documenta) · configurable sin hardcode · multi-tenant (el BE filtra por
centro) · RBAC (`inventario.read`) · i18n en es/en con `labelKey`, nunca cadenas quemadas · no duplicar
código · usar el endpoint correcto, no el más cómodo · TDD en la lógica pura del FE · `/review` antes de
mezclar y `/qa` con navegador real contra el desplegado, comparando los números con el reporte del legado
del mismo producto.

## Qué es «terminado»

- Con Tirzepatide seleccionado, la pantalla muestra los frascos cerrados y el activo con su nivel, y los
  números cuadran con el reporte del legado.
- Cada consumo dice de qué vial salió.
- Cambiar a NANO DPM muestra su propio inventario sin tocar código.
- Un vial con dueño enseña el paciente junto al frasco.
- Un día sin consumos se lee como «sin consumos», no como una tabla rota.
