# Estadísticas diarias: «Nuevos / Seguimiento» y ocultar «Devueltos» — handoff BE → FE

**Pedido del dueño, 11-nov-2026.** Pantalla: «Estadísticas diarias», en `/billing/invoices/stats` (vista de pantalla y de papel «C.M.R. — CMR Caguas»).

## 1. Etiquetas completas en ATENCIÓN MÉDICA

- Hoy se muestra «N: 4   S: 12». Debe decir **«Nuevos: 4   Seguimiento: 12»**.
- Las etiquetas van por i18n: es «Nuevos» / «Seguimiento», en «New» / «Follow-up».
- El mismo cambio va en el texto que se envía por WhatsApp, por correo y al copiar.

## 2. Ocultar la columna «DEVUELTOS» de la tabla de servicios

- Por ahora se oculta porque puede confundir. **No se borra**: el dueño puede volver a pedirla.
- El BE sigue enviando `returned` por servicio.
- Debe quedar como una opción de vista oculta por defecto (preferencia o interruptor), no como código eliminado.
- No cambian las líneas de resumen: bruto, devoluciones y neto se quedan como están. Solo se oculta la columna por servicio.

## BE

Sin cambios. Los campos son los mismos de `GET /v2/statistics/daily`.

## Verificación

En el navegador, en producción, con Caguas el 10-nov:
- debe leerse «Nuevos 4, Seguimiento 12, Total 16»;
- la tabla de servicios no debe mostrar la columna «Devueltos»;
- el resumen debe seguir mostrando las devoluciones.
