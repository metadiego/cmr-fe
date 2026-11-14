# Handoff BE — Eliminar un adjunto del cuadre (solo gerente/admin)

> FE → BE. Fecha: 2026-11-13.

## Contexto
Settlements escaneado (`.personal/handoff-cuadre-adjuntar-settlements.md`, BE PR #516) y ahora
Escanear al cuadre (BE PR #586) solo tienen **POST** (subir/registrar) y **GET** (listar) en
`/cash/reconciliations/:id/attachments`. No hay forma de quitar un adjunto — ni una foto subida por
error, ni (lo que motiva esto) un escaneo de prueba que deje un PDF pegado a un cuadre real.

## Pedido
`DELETE /cash/reconciliations/:id/attachments/:attachmentId` (+ `?centerIds=`, igual que el resto de
este sub-recurso). Permiso **`caja.ver_todos`** (gerente/admin) — **no** `caja.scan` ni el cajero
dueño del cuadre: quien puede escanear/adjuntar no debería poder hacer desaparecer la evidencia por su
cuenta; borrar es decisión de quien supervisa. Que quede en la auditoría (igual que el resto de
`caja`) quién borró qué y cuándo. 404 si el adjunto no existe o no es de ese cuadre.

No hace falta soft-delete visible en la UI — con que el storage lo borre o lo marque inactivo y deje
de salir en el GET es suficiente.

## FE
En cuanto exista el endpoint, agrego el botón «Eliminar» en `CuadreAttachments`
(`components/caja/cuadre-attachments.tsx`), visible solo con `can("caja.ver_todos")`, con confirmación
antes de borrar. Mientras tanto no hay forma de quitar un adjunto desde la pantalla.
