# Handoff BE — Que los filtros del resumen del día valgan también en el CSV y el email

Fecha: 2026-11-18. Pedido del dueño: «que esos filtros apliquen para csv, email y print».

## Verificado (FE 7707704, prod)

- El resumen del día (`/boards/patient-desk`, clic en un servicio x/x) tiene un filtro por columna:
  - Récord, Paciente y Hora por texto: «contiene», sin acentos ni mayúsculas.
  - Dosis, Enfermera, Asistido por, Cantidad, Viales y Contenido por valor exacto, elegido de los del día.
- Con un filtro activo, el pie, los totales y los conteos por enfermera y por usuario suman solo lo que se
  ve.
  - Probado: «Enfermera = Glorimar Lebron» → 5 de 13, 5 viales, 125 g.
- **Imprimir ya respeta el filtro**: imprime lo que está en pantalla, con la línea «Mostrando 5 de 13 ·
  Enfermera: …».
- El CSV y el email salen de `POST /export` y hoy traen el día completo.

## Pedido

El FE ya manda, dentro de `filters` del export `frontdesk-day-summary`, tres claves opcionales:

1. **`sessionIds: string[]`**: solo esas sesiones.
   - Es exactamente lo que se ve en pantalla, sin tener que replicar en el BE la lógica de «contiene» ni el
     formato de la hora.
   - Si falta, el export sale con el día completo, como hoy.
   - Los totales, la fila TOTAL y los bloques POR ENFERMERA / POR USUARIO se calculan sobre esas sesiones.
2. **`columns: string[]`**: las columnas visibles del usuario.
   - Valores: `record, patient, quantity, dose, nurse, attendedBy, time, sealedVials, content`, en ese orden.
   - Si falta, salen las columnas por defecto.
3. **`filterLabel: string`**: el texto «Enfermera: Glorimar Lebron · …», ya traducido.
   - Va bajo el título del PDF y como primera línea del CSV, para que quien reciba el archivo sepa que está
     filtrado.

Validaciones:
- `sessionIds` debe ser de ese servicio, ese día y esos centros; uno ajeno se ignora, no da error.
- Máximo 500.

El log de `/export/jobs` debería guardar los filtros, para que quede trazable que fue un export parcial.

## FE

Ya está enviado (`lib/api/day-summary.ts` → `daySummaryExport`). Cuando el BE lo publique, verifico que con
«Enfermera = Glorimar» el CSV traiga 5 filas, y lo mismo con el email.
