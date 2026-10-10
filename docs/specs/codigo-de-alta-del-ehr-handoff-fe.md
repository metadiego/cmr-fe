# Handoff FE — Imprimir solo el código de alta del EHR del paciente nuevo

**De:** BE · **Para:** FE · **Fecha:** 2026-10-10 · **Prioridad:** alta (pedido del dueño).
Spec BE: `cmr-be/docs/specs/codigo-de-alta-del-ehr.md`. Origen: PR del EHR `metadiego/cmr-ehr-be#52`.

## Qué cambia

Al marcar **presente** a un paciente que todavía no está en el EHR, el BE ahora lo da de alta con
`POST /patients/onboard` del EHR, que devuelve un **código de alta** (8 dígitos, vence a las 6 h). El
paciente lo canjea en el iPad para llenar su registro. **El ticket con el código se imprime solo.**

## Contrato (evento en vivo, el mismo SSE del centro)

```
entidad: 'ehr-claim-code'   id: <pacienteId>   accion: 'creada'
estado: {
  pacienteId, ehrRecordId: 'CAG-003618',
  claimCode: '12345678', claimExpiresAt: '2026-10-10T23:00:00.000Z',
  claimCodePrinterId: '<center_printers.id>' | null
}
```

- Solo llega para pacientes **nuevos** en el EHR (uno que ya estaba no trae código).
- **El código no se guarda en el BE** (ni tabla, ni log, ni auditoría): si no se imprime al llegar el
  evento, se pierde. Para reimprimir, el EHR permite «Start intake» y emite otro.

## Lo que se pide

1. **Imprime solo la pantalla que marcó presente a ESE paciente** (el evento llega a todas las del
   centro; las demás lo ignoran). Sugerencia: recordar en memoria los `pacienteId` que esta pantalla
   marcó presente en los últimos ~2 minutos.
2. **Dónde:** si `claimCodePrinterId` viene, esa impresora (está en `GET /me/print-hub → printers[]`
   por `id`), por el hub de siempre; si es null, la impresora elegida en esa pantalla.
3. **El ticket:** código grande, nombre y récord del paciente (los tienes en la sesión/cita), «Válido
   hasta» con `claimExpiresAt` en hora de Puerto Rico, y una línea de instrucción («Escanee/ingrese este
   código en el iPad»). Texto por `labelKey`.
4. **Configuración:** en la pantalla de integración del EHR, un selector «Impresora del código de alta»
   con las impresoras del centro → `PUT /ehr-integration/config { claimCodePrinterId }` (null = la de cada
   pantalla). Un id de otro centro responde 400 `EHR_CLAIM_PRINTER_NOT_IN_CENTER`
   (`labelKey: ehrIntegration.claimPrinterNotInCenter`). `GET /ehr-integration/config` lo devuelve.

## Estado en producción

Caguas: `claimCodePrinterId` = **lab-test** (ipp `192.130.80.199:631`, cola `EPSON_TM_T20II`), como pidió el
dueño. Bayamón: sin configurar (hub apagado).
