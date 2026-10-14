# Frontdesk nuevo — lo pendiente va primero en la ficha del paciente

**Fecha:** 2026-10-14 · **De:** BE → FE · **Pedido por:** el dueño, en pantalla (RIVERA OCASIO,
FELICITA, récord 15817: en «Todos», Vit C, Intravenoso y GLP-1 ya asistidos salían arriba en gris y
la **Consulta pendiente** salía la última, donde el usuario puede no verla).

## La regla

«Se trabaja a favor del paciente: lo que le falta es lo importante.»

**Sin filtro de servicio** («Todos», «Servicios» o «Consulta» sin sub-filtro), las secciones de la
ficha del paciente se ordenan así:

1. primero, todo lo que **aún tiene algo pendiente**, sea servicio o consulta;
2. después, lo **terminado**: asistido, o consulta en estado terminal. Las canceladas ya se tratan
   en `patient-desk-cancelada-no-es-sesion-handoff-fe.md`.

Dentro de cada grupo se mantiene el orden de hoy, el configurado. Una sección cuenta como
«pendiente» si **alguna** de sus sesiones vivas no está terminada.

Los chips de la lista de la izquierda siguen la misma regla.

**Con filtro de servicio, el filtro es canónico:** se queda exactamente como está hoy (el filtrado
primero, después el mismo personal y luego técnico → enfermera → ambos →
`patient-desk-orden-por-personal-handoff-fe.md`). Esta regla no se aplica encima.

## Dónde

`lib/frontdesk/patient-day.ts`. «Terminado» ya existe allí, en varios sitios: las sesiones
`asistido`/`cancelada` y la consulta en estado terminal (`CONSULTATION_NOT_SEEN` y el criterio de
«ya no sigue arriba»). Hay que reutilizarlo, no duplicarlo. El orden debe vivir en **un** sitio para
que detalle y chips lo hereden. Hoy la consulta se pinta aparte, después de los servicios: tiene que
entrar en el mismo orden.

## Pruebas que pide

- Vit C, Intravenoso y GLP-1 asistidos + Consulta pendiente, sin filtro → Consulta primero, luego
  los tres asistidos en su orden configurado.
- Láser pendiente + Vit C asistido + Consulta terminada → Láser, luego Vit C y Consulta en su orden.
- Con filtro de servicio, el orden es exactamente el de hoy (el filtrado primero), aunque haya
  pendientes en otros servicios.
