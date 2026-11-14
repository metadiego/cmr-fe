# Handoff BE — El email del cuadre debe llevar los settlements escaneados

> FE → BE. Fecha: 2026-11-14. Pedido del dueño.

## Contexto
`POST /cash/reconciliations/:id/email` arma y envía el PDF del cuadre por completo del lado del
backend (FE solo llama al endpoint, `lib/api/caja.ts enviarCuadreEmail`). El FE ya resolvió lo mismo
del lado de «Imprimir cuadre» — cuando el cuadre tiene adjuntos (settlements escaneados o fotos,
`GET /cash/reconciliations/:id/attachments`), los pega como página extra del mismo trabajo de
impresión. El email no lo hace: hoy manda solo el PDF del cuadre, sin los adjuntos.

## Pedido
Que el email (`POST /cash/reconciliations/:id/email`) incluya los adjuntos del cuadre, igual que lo
impreso: si hay cero adjuntos, sin cambio; si hay uno o más, van con el correo — como páginas extra
del mismo PDF adjunto, o como archivos adjuntos aparte del email, lo que sea más simple del lado del
backend (el FE no tiene preferencia aquí, ambos resuelven el mismo pedido del dueño).

## FE
Sin cambios pendientes de este lado — `enviarCuadreEmail` ya manda `id`/`emails`; nada que agregar en
el body a menos que el backend pida algo explícito (p. ej. un flag `incluirAdjuntos`).
