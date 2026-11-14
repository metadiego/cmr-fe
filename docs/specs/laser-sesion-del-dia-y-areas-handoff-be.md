# Handoff BE → FE: láser — la sesión del día, MLS + HILT juntas, y las áreas

BE: PR #598 (en producción). Spec BE: `cmr-be/docs/specs/laser-sesion-del-dia-y-areas.md`.
Caso: Caguas, 14-nov-2026, récord 15946. SESIÓN decía «1/12» (el ancla HILT) cuando la visita era la
MLS 6/12; APLICADAS se tecleaba a mano; Formatos nacía con «1/12» y áreas vacías.

## Lo que ya sirve el BE

1. **Columna SESIÓN (`fd_sesiones`)** — sin cambio de contrato. En el servicio láser
   (`primaryPackageRule = 'most_delivered'`) ya numera la visita en el paquete con más entregas (MLS).
2. **Hoja de la visita** — `GET /api/v2/frontdesk/sessions/:id/sheet` (v1: `/api/v1/frontdesk/sesiones/:id/hoja`),
   permiso `frontdesk.read`:

```json
{
  "sessionId": "…", "serviceId": "…",
  "display": "6/12",
  "packages": [
    { "packageId": "…", "productId": "…", "productName": null, "sku": null, "number": 6, "total": 12, "xy": "6/12", "primary": true },
    { "packageId": "…", "productId": "…", "productName": "TERAPIA DEL DOLOR FULL HILT", "sku": "TDSP30", "number": 1, "total": 12, "xy": "1/12", "primary": false }
  ],
  "areas": 2,
  "areasSource": "last_visit"
}
```

   - `packages`: un renglón por paquete que la visita consume (láser: MLS y HILT), el principal primero.
     `productName`/`sku` pueden venir null en un paquete del legado sin meta: cruzar `productId` con el saldo
     (`disp.paquetes`) que ya pintáis.
   - `areas`: valor a precargar; `areasSource`: `session` (ya tecleado en esta visita) · `package`
     (multiplicadores del paquete, de la factura) · `last_visit` (lo último tecleado en una visita anterior,
     legado incluido) · `null` (no se sabe: dejar vacío, nunca un 1).
3. **`primaryPackageRule`** en el servicio (`'row'` | `'most_delivered'`), editable en la ficha del servicio
   (`PATCH /servicios/:id`). Configurable, no fijo.

## Lo que falta en pantalla

- **(e) SESIÓN y saldo** — la celda ya trae la sesión de HOY (no tocar). En el desplegable de saldo,
  «Session X of N» es la PRÓXIMA (`entregadas + 1`): rotularlo como «Próxima: X de N», o mostrar al lado la
  de hoy desde `sheet.packages[].xy` del renglón correspondiente. El dueño leyó «7 of 12» como la de hoy.
- **(f) APLICADAS** — si la visita no tiene `datos.aplicadas`, precargar `sheet.areas` en la celda como
  valor PROPUESTO (visible, editable) y guardarlo solo cuando el usuario lo confirma/edita; si
  `areasSource` es `session`, ya está guardado. Nunca escribir solo al abrir el tablero.
- **(g) Formatos de Láser** — Sesión: el `xy` del paquete que corresponde al formato (HILT → el renglón cuyo
  `sku`/`productName` contiene «hilt»; MLS → el otro; si no casa, `display`). Áreas: `multiplicadores.areas`
  del paquete como hoy, y si no hay, `sheet.areas`. Así el personal solo revisa y envía a la impresora.
- **Ficha del servicio** — selector «Número de sesión cuando consume varios paquetes»: `row` / `most_delivered`.
  labelKeys sugeridos: `services.primaryPackageRule.label`, `.row`, `.most_delivered`.

## i18n de la confirmación (reparación, solo admin/gerencia)

`confirmation.action.repairCompanionPackages`, `confirmation.effect.companionPackagesRaised`
(params: `packages`, `sessions`). La reparación se lanza por API/script; no necesita pantalla.

## Verificar

Caguas, récord 15946: la visita del 14-nov debe decir 6/12 en SESIÓN y en Formatos MLS; HILT su propio
número; áreas 2 propuestas.
