# El tercer interruptor de auto-presente — agendar un servicio para HOY

**BE:** desplegado y verificado en producción el 1-oct-2026 (PR #382).
**FE:** pendiente — un `Switch` más en `/configuration/invoice`, junto a los dos que ya están.

## Qué hace

En «Programar Citas», agendar un servicio **para hoy** hace que la sesión nazca ya en
**Presente** (con su `presenteEn` sellado), en vez de `pendiente`. Esa pantalla se usa con el
paciente delante — es lo que hacía el sistema legado.

La regla aplica **por par (servicio, fecha)**, no por la llamada entera: si una misma acción agenda
Láser para hoy y Suero para el martes, solo Láser nace presente. «Hoy» lo decide el servidor con la
zona horaria del centro; el FE **no** tiene que calcular nada.

## Nace APAGADO, y es a propósito

Al revés que los otros dos auto-presente. `agendar-multiple` lleva meses en producción y nunca ha
marcado presente a nadie: encenderlo por defecto le cambiaría el tablero al mostrador el día del
despliegue sin que nadie lo pidiera. Cada centro lo enciende cuando quiera.

## El campo

Verificado dos veces contra producción, con la respuesta real de `GET .../tax-details`:

| | v1 (`/api/v1/centros/:id/datos-fiscales`) | v2 (`/api/v2/centers/:id/tax-details`) |
|---|---|---|
| El nuevo | `autoPresentSameDayBooking` | `autoPresentSameDayBooking` (igual) |
| Los que ya estaban | `frontdeskAutopresente` | **`frontdeskAutoPresent`** (ojo, cambia) |
| | `autoPresentFollowUp` | `autoPresentFollowUp` (igual) |

```
GET /api/v2/centers/<id>/tax-details
→ { "frontdeskAutoPresent": true, "autoPresentFollowUp": true,
    "autoPresentSameDayBooking": false }
```

Se escribe con el mismo `PUT` parcial que los otros dos (permiso `centro.fiscal.write`), y el
campo se llama igual en las dos versiones:

```
PUT /api/v2/centers/<id>/tax-details   { "autoPresentSameDayBooking": true }
→ devuelve el bloque fiscal entero ya compuesto
```

## Qué tocar en el FE

En `/configuration/invoice`, donde ya viven los otros dos `Switch`, añadir el tercero:

- **Etiqueta sugerida:** «Agendar para hoy marca Presente».
- **Ayuda:** «Programar Citas se usa con el paciente delante: un servicio agendado para hoy entra
  ya como Presente. Agendar para otro día nunca.»
- **Valor inicial:** `false` — no asumir `true` como en los otros dos.

Nada más: el bloque fiscal se lee y se escribe con las llamadas que esa pantalla ya usa.

## Verificado en vivo (no supuesto)

Con el interruptor encendido en Bayamón, por HTTP real:

- Sesión agendada para **hoy** → `estado: "presente"`, `presenteEn: 2026-10-01T21:13:22Z`.
- Sesión agendada para **mañana**, misma llamada y mismo interruptor → `estado: "pendiente"`,
  `presenteEn: null`.

Las dos sesiones de prueba se borraron y el interruptor quedó apagado, como estaba.

Razón completa: `cmr-be/docs/specs/auto-presente-al-agendar-el-mismo-dia.md`.
