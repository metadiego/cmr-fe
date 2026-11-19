# Cuadre por email con Gmail — handoff FE → BE

**Fecha:** 2026-11-05 · **Pedido por:** el dueño · **Prioridad:** alta.

## Lo que está mal hoy (verificado en el código del BE)

`POST /cash/reconciliations/:id/email` hace lo siguiente:

- llama a `CajaService.enviarEmail`, que delega en `notificaciones.enviarDirecto({ canal: 'email' })`;
- el dispatcher (`notificacion.dispatcher.ts`) deja el email en estado `pendiente`, con el aviso
  «queued (no provider configured)». **No sale ningún correo.**

Pese a eso, la pantalla muestra «Email enviado». El cuerpo del mensaje es además una sola línea de
texto, sin la hoja del cuadre.

## Lo que se pide

1. **Proveedor de correo real: Gmail / Google Workspace del dominio.** Configurable, sin hardcode y
   sin secretos en el repo.
   - SMTP `smtp.gmail.com:587` (STARTTLS) con una cuenta dedicada y una contraseña de aplicación.
     Alternativa: Gmail API con cuenta de servicio y delegación de dominio.
   - Variables de entorno, que el dueño carga directamente en el servidor: `MAIL_HOST`, `MAIL_PORT`,
     `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` y `MAIL_FROM_NAME`.
   - Si no está configurado, el endpoint responde con un error claro (503 o 409) y el FE lo avisa.
     Nunca devolver «enviado» cuando el correo no salió.
2. **El correo lleva la hoja del cuadre completa, en PDF adjunto y en el cuerpo HTML.** Es la misma
   hoja que el FE imprime:
   - el resumen;
   - el conteo de efectivo;
   - el desglose tributario;
   - la **Venta de productos (IVU)** con todas sus facturas (`productSales`);
   - quién facturó, los documentos y las devoluciones;
   - las firmas.
3. **Lo mismo para el cuadre total** (`/cash/total-reconciliation`): hoy no tiene email.
4. **Destinatarios configurables por centro:** una lista por defecto (por ejemplo, Contabilidad) que se
   puede editar al enviar.
5. **Firma electrónica:** pendiente de que el dueño decida entre firma dibujada en pantalla y sello de
   usuario, fecha y hora al cerrar. Se añadirá aquí.

## FE (cuando el BE lo publique)

- El botón «Enviar por email» en el cuadre por cajero, el consolidado y el total.
- Mostrar el error real si el correo no sale.
- Editor de destinatarios.
