# Pestañas como rutas — enlazar a un paciente, una sección y una pestaña

Fecha: 29-oct-2026 · Pedido del owner: «permitir enlazar a un paciente concreto, y a una sección y
pestaña concretas; las rutas deben ser consistentes con las secciones y subsecciones de la UI».

## Problema

- La ficha del paciente ya tenía URL (`/patients/<id>`), pero sus pestañas (Citas, Terapias,
  Facturación, Documentos, Cambio de protocolo) eran estado local: no se podía enlazar a «la
  facturación de este paciente», y un reload volvía siempre a Resumen.
- Facturación general/Consultas, Citas y Personal y accesos sí guardaban la pestaña, pero en `?tab=`,
  con valores en español y sin regla común (`?tab=caja`, `?tab=servicios`, `?tab=editorRol`).
- El día del calendario de servicios era `/scheduling/appointments/<fecha>?tab=servicios`: la misma
  ruta que el día de citas médicas, distinguida por un parámetro.

## Decisión

Cada pestaña es un **segmento de ruta** bajo la ruta de su pantalla, en inglés y con el nombre de la
pestaña. La **primera** pestaña es la ruta de la pantalla sin segmento, así el menú y los marcadores
viejos siguen cayendo donde siempre.

| Pantalla | Ruta por defecto | Pestañas |
|---|---|---|
| Ficha del paciente | `/patients/<id>` (Resumen) | `/appointments`, `/therapies`, `/billing`, `/documents`, `/protocol-change` |
| Facturación general | `/billing/invoices` (Facturas) | `/returns`, `/cash`, `/stats` |
| Facturación de consultas | `/billing/consultations` (Facturas) | `/returns`, `/cash` |
| Citas | `/scheduling/appointments` (Médicas) | `/services` |
| Personal y accesos | `/admin` (Personal) | `/users`, `/roles`, `/permissions`, `/role-editor`, `/pending`, `/centers`, `/theme`, `/menu` |

El día del calendario de servicios pasa a `/scheduling/appointments/services/<fecha>` (cuelga de su
pestaña, como el día médico `/scheduling/appointments/<fecha>` cuelga de la suya).

## Cómo funciona

- **Registro único**: `lib/nav/tab-routes.ts` declara cada pantalla (patrón de ruta, pestañas,
  equivalencias de `?tab=` viejos) y las funciones puras `matchTab`, `tabHref`, `legacyTab`,
  `screenPathOf`. Tests en `lib/nav/tab-routes.test.ts`.
- **La pantalla vive en el `layout.tsx`** de su ruta; cada pestaña es un `page.tsx` que no pinta nada
  (`components/kit/tab-page.tsx`). Los layouts no se desmontan al navegar entre sus hijos (docs de
  Next 16, `layout.md`), así que cambiar de pestaña **no** vuelve a pedir el paciente ni redibuja la
  cabecera. Facturación general y Citas usan un route group (`(tabs)`, `(calendars)`) para que el
  layout no envuelva las páginas de debajo (`/billing/invoices/new`, `/[id]`, el día del calendario).
- **`hooks/use-tab-route.ts`**: lee la pestaña del path y navega con `router.replace` (como antes:
  cambiar de pestaña no llena el historial). Conserva el resto del query string (`?centro=`).
- **Barra superior**: el shell compara el menú contra `screenPathOf(pathname)`, así todas las pestañas
  de una pantalla del menú muestran el mismo título (no una miga «volver» a su propia pestaña por
  defecto).
- **Permisos**: una pestaña que la persona no puede ver (enlace compartido a `/billing` sin
  `factura.read`) abre Resumen; en `/admin`, un no-admin cae en Personal, como antes.
- **Segmento desconocido** (`/patients/<id>/foo`, `/admin/foo`): redirige a la pantalla.

## Compatibilidad

- `?tab=<valor viejo>` en cualquiera de estas pantallas se reescribe en el sitio a su ruta nueva.
- `/scheduling/appointments/<fecha>?tab=servicios` redirige a `/scheduling/appointments/services/<fecha>`.
- Las páginas standalone que se volvieron pestañas el 09-oct (`/billing/returns`,
  `/billing/cash/general`, `/billing/cash/consultation`, `/reports/daily`) redirigen (307) a su
  pestaña (`next.config.ts`). `/billing/consultations/returns` no necesita redirección: ahora ES la ruta
  de la pestaña.

## Fuera de alcance (a propósito)

- Pestañas de los tableros dinámicos (`/boards/<clave>?tab=<slug>`): sus pestañas las define el BE
  como datos y ya son enlazables; además cargan la preferencia de aterrizaje por persona.
- Persona seleccionada en Personal (`/configuration/staff`) y sus pestañas: hoy la selección es estado
  local; enlazar a una persona concreta es otro cambio (necesita `/configuration/staff/<id>`).
- Conmutadores de vista dentro de una página (Existencias en vivo por producto/balanza, vistas del
  calendario, centros en el día médico): no son subsecciones de la UI.
