# Handoff FE → BE — URGENTE: email de cierre del día por sesiones "En terapia" sin cerrar

**Pedido del dueño, 06-nov-2026, quiere esto corriendo DESDE HOY.**

## Qué ya existe en el FE (hecho, commit b173b09)

Banner en el tablero de Servicios que nombra a quien dejó pacientes "En terapia" de un día YA CERRADO
sin pasar a Asistido/Cancelada. El responsable es el **usuario logueado que hizo la transición**
(`frontdesk_eventos.actorId` del evento `en_terapia`), NO el enfermero/técnico asignado en el select de
la fila — pueden ser personas distintas. Verificado en vivo, Caguas: 3 usuarios con 16/4/3 sesiones sin
cerrar de días anteriores.

## Lo que se pide (NO es trabajo de FE — no hay cron ni envío de correo en este repo)

Al cierre de cada día (medianoche / cierre de caja del centro), un job que:

1. Encuentre toda sesión `frontdesk_sessions` con `status = 'en_terapia'` y `date < hoy` (del centro en
   cuestión).
2. Para cada una, identifique al responsable: el `actorId` del ÚLTIMO evento `en_terapia` de
   `frontdesk_eventos` para esa sesión (mismo criterio que el FE, ver `getHistorialSesion` en
   `lib/api/frontdesk-eventos.ts` de cmr-fe si hace falta la referencia).
3. Agrupe por responsable y envíe UN email a cada uno, desde **`cuadres@centrodemedicinaregenerativa.com`**
   (remitente confirmado por el dueño), listando sus pacientes/sesiones dejados sin asistir ese cierre.
4. Envíe TAMBIÉN una copia (o un resumen de todos los responsables de ese centro) al/los **gerente(s)
   del centro** en cuestión — falta definir cómo se identifica "gerente de centro" en RBAC (¿permiso
   específico? ¿rol `gerente` por centro?) — a confirmar con el dueño si no es obvio desde el catálogo de
   permisos existente.

## Contenido del email (pedido del dueño)

Va al **responsable** (el `actorId`) Y al/los **gerente(s) del centro**, mismo email o copia — el
dueño no distingue tono entre uno y otro. Debe explicar, no solo listar:

- Por qué importa para el PACIENTE llevar el registro de cada sesión de su terapia (continuidad del
  tratamiento, historial clínico/de servicio).
- Que esto alimenta las ESTADÍSTICAS de técnicos, enfermeras y médicos — dejar sesiones sin cerrar
  ensucia esos números para todo el equipo, no solo para quien la dejó así.
- Que es un reflejo del VALOR PROFESIONAL del propio trabajador: cerrar bien su trabajo es parte de lo
  que lo hace valioso para el centro, no un trámite aparte.
- La lista de pacientes/sesiones concretas que ese usuario dejó sin asistir (fecha, servicio,
  paciente).

## Copia de control (pedido del dueño)

Mandar copia de CADA correo (el del responsable y el resumen del gerente) a `larciles@centrodemedicinaregenerativa.com`
— por ahora, al menos para **CMR Caguas**, donde el dueño quiere manejar esto directamente con el
personal de ese centro.

## Por qué urge

El dueño lo pidió explícitamente como medida de presión/responsabilidad: hoy mismo, no mañana. Si el
corte de "días anteriores" no puede salir hoy por timing del cron, avisar cuánto falta en vez de
dejarlo abierto sin fecha.

## Cómo verificar al terminar

Con sesiones reales ya identificadas hoy en Caguas (ver arriba, 3 responsables), confirmar que cada uno
recibe su email y que el/los gerente(s) de Caguas reciben el suyo, el primer cierre de día después del
despliegue.
