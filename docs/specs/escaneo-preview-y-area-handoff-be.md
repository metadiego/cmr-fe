# Handoff BE/hub — Vista previa y selección de área antes de escanear

> FE → BE/hub. Fecha: 2026-11-13. Pedido del dueño, sobre Escanear al cuadre (BE PR #586).

## Qué pide
Antes de escanear el documento final: un **preview** (escaneo rápido, baja resolución, de toda la
bandeja/cristal) y que el usuario **dibuje el área** a conservar (recortar el papel real del fondo
del cristal/bandeja), igual que cualquier software de escáner de mesa. Solo entonces se pide el
escaneo final, ya recortado a esa área.

## Por qué no es solo FE
`eSCL` (el protocolo del hub con la Xerox) soporta esto en el estándar: un *preview job* a baja
resolución (o `Intent: Preview`) y `ScanRegions` (x/y/ancho/alto) en el trabajo final. Pero hoy:
- El hub (`cmr-print-hub`, repo aparte) solo expone el flujo de un escaneo final; no hay ruta para
  pedir un preview ni para mandar una región.
- El contrato BE actual (`POST /cash/reconciliations/:id/scans`) no tiene campos para región ni para
  pedir un preview en vez del final.

## Pedido concreto
1. Hub: nueva capacidad `scanPreview` — trabajo eSCL `Intent: Preview` (o resolución baja fija, p.
   ej. 75dpi) que devuelve la imagen sin guardarla como adjunto.
2. BE: `POST /cash/reconciliations/:id/scans/preview` → igual que `/scans` pero sin crear adjunto,
   devuelve la imagen (o una URL firmada de corta duración) para pintarla en el FE.
3. BE: `scanRegion?: { x, y, width, height }` (en la unidad que ya use eSCL) en el body de
   `POST /cash/reconciliations/:id/scans`, reenviado al hub como `ScanRegions` del trabajo final.

## FE (en cuanto exista lo de arriba)
Agrego un paso intermedio en `CuadreScanButton`: pedir preview → pintar la imagen con un recorte
arrastrable (como un crop de avatar) → mandar `scanRegion` en el escaneo final. No lo construyo antes
porque no hay nada que mostrar ni que mandar todavía.
