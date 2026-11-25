# Handoff FE → BE: simulacro del cambio de protocolo, lo cobrado y la lista en los dos lados (24-nov-2026)

Dueño, 24-nov: «sería bueno que tome lo cobrado y la lista para tener un abanico de opciones». El
facturador saca los precios de las facturas para cuadrar a mano. La pantalla le ofrece ambas
referencias como botones que llenan el precio de un toque.

## Lo verificado (prod, 103120 Bayamón, solo lectura)

- La factura L037397 (9-nov) tiene:
  - MLS: lista 70, cobrado 3977.27 ÷ 72 = 55.24;
  - HILT: lista 150, cobrado 8522.73 ÷ 72 = 118.37.
- La factura S245103 (19-oct) tiene:
  - 25 g Vitamina C: lista 140, cobrado 994.29 ÷ 12 = 82.86;
  - LASER INTRAVENOSO - ENDO: lista 180, cobrado 1278.37 ÷ 12 = 106.53;
  - NANO AER PLUS: lista 2000, cobrado 2367.35 ÷ 2 = 1183.68.
- Hoy la simulación trae `closes[].chargedUnitPrice` y `creates[].listUnitPrice`, pero no las otras dos referencias.

## Lo que se pide

- **`closes[].listUnitPrice`**: el precio de lista del producto en el centro activo (`precioBase`), o `null`.
- **`creates[].chargedUnitPrice`**: lo cobrado por unidad en la **última factura del paciente** que
  tenga ese producto (`total ÷ cantidad` de su línea, el mismo cálculo que en los cierres), o `null` si
  nunca lo compró.
- Que salgan en la valoración guardada al aplicar, igual que el resto.

Las dos son opcionales para el FE. Ya pinta cada referencia como botón cuando llega, y no pinta nada si
llega `null`, así que no hay que coordinar despliegues.
