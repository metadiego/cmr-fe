# Handoff BE — «quién facturó» POR documento en el reporte del día de caja

> FE → BE. Fecha: 2026-08-21. Complementa `cuadre-quien-facturo-por-cajero.md` (aquel agregó el
> agregado `porCajero`; esto pide el dato a nivel de CADA documento).

## Qué se quiere
En `/caja/consulta` (y el cuadre en general) la tabla **«Documentos del día»** muestra por fila:
nº de factura, récord, paciente, forma de pago, total, estado. El dueño quiere **añadir una columna
con la persona que facturó** ese documento (quién trabajó/atendió en ese instante). Importante para
rastrear responsabilidades.

## El hueco (verificado por HTTP, 2026-08-21, Bayamón)
`GET /caja/reportes/dia?fecha&division` → cada item de `documentos[]` trae hoy SOLO:
`{ id, numero, pacienteId, paciente, record, formaPago, total, estado }`. **No hay usuario/cajero por
documento.** El agregado `porCajero` da totales por cajero, pero NO permite saber quién facturó CADA
documento. Por eso el FE no puede pintar la columna sin inventar el dato.

## Pedido (mínimo, mismo patrón que `emisor`/`creadoPor` de la factura)
Agregar a cada item de `documentos[]` el usuario que EMITIÓ/facturó ese documento, resuelto por el BE
desde el RequestContext (no falsificable), con nombre ya resuelto:

```jsonc
{
  "id": "…", "numero": "000225", "paciente": "HECTOR CANDELARIA FERNANDEZ",
  "record": null, "formaPago": "EF", "total": 20, "estado": "emitida",
  "usuario": { "id": "…", "nombre": "Ana Ruiz" }   // ← NUEVO (null si no se pudo resolver / fue una llave)
}
```

- Nombre del campo sugerido: `usuario` (`{ id, nombre }`); si prefieren `cajero`/`emitidoPor`, avisen
  el nombre exacto y el FE lo consume igual.
- `null` cuando no haya usuario ligado (documentos legado/importados o emitidos por integración `esLlave`)
  — el FE mostrará "—", sin trucos.
- La **suma por usuario de estos documentos debe cuadrar con `porCajero`** (misma fuente de verdad).

## FE (lo que haremos al llegar el campo)
Añadir una columna «Facturó» a la tabla de documentos en `components/caja/cuadre-detalle.tsx`
(pantalla + hoja impresa), leyendo `doc.usuario?.nombre ?? "—"`. Sin endpoint nuevo, sin cambiar el
resto. RBAC/`caja.read` como el resto del cuadre.

## Verificar
`GET /caja/reportes/dia?division=consulta` de un día con facturación real → cada `documentos[]` trae
`usuario:{id,nombre}` (o null), y la columna «Facturó» aparece por fila.
