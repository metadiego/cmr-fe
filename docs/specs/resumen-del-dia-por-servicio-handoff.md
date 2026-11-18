# Handoff FE — Resumen del día por servicio (imprimir, CSV, email)

**Pedido del dueño, 18-nov-2026.** Para cuadrar las vitaminas aplicadas, hoy se imprimen las hojas y
se guardan.

En el Centro de Pacientes (`/boards/patient-desk`), menú **Servicios**, cada servicio muestra
asistidas/total (p. ej. «Sueroterapia… 17/17»). Cuando el servicio está **completo (x/x)**, el clic
abre su **resumen del día**:
- detallado, con logo, profesional;
- imprimible, CSV y email;
- trazable.

Se empieza por la Vitamina C, pero vale para cualquier servicio.

**Solo cuando está x/x.** Si no está completo, el clic se queda para otra función que vendrá: no
abras el resumen.

BE: `cmr-be` PR #632. Spec: `cmr-be/docs/specs/resumen-del-dia-por-servicio.md`.

## Datos (v2)
`GET /api/v2/frontdesk/summary-of-day?servicio=<slug o id>&fecha=YYYY-MM-DD&centerIds=<centro>`
(permiso `frontdesk.read`).

Pasa **siempre** `centerIds` con el centro del tablero.

Responde:
```
{ service:{id,slug,name}, centers:[{id,name}], date, total, attended, complete,
  rows:[{ sessionId, record, patient, quantity, dose, nurse, attendedBy, attendedAt, sealedVials, content }],
  totals:{ sessions, patients, quantity, sealedVials, content, proportion } }
```

Qué es cada campo:
- `dose` es el producto aplicado («25 g Vitamina C»).
- `attendedBy` es quien marcó la asistencia.
- `sealedVials` son los viales que salieron del stock.
- `content` son los gramos sacados de viales abiertos.
- `proportion` es `content` ÷ capacidad del vial (25 g = 1).

## Pantalla
- Un diálogo o panel con el membrete y el logo del centro.
- Título: «Resumen del día · <servicio> · <fecha> · <centro>».
- Tabla con estas columnas:
  - Récord
  - Paciente
  - Cantidad
  - Dosis
  - Enfermera
  - Asistido por
  - Hora (de `attendedAt`, en hora del centro)
  - Viales
- Al pie, los totales:
  - pacientes y sesiones;
  - **total de viales aplicados** (`totals.sealedVials`);
  - contenido y proporción.
- Columnas configurables: el usuario elige cuáles ve. Guarda la elección como preferencia de usuario,
  igual que en otras tablas.
- Barra común **Imprimir / CSV / Email**, la misma de los demás reportes:
  - **Imprimir**: la ventana de impresión con el membrete, como el kardex.
  - **CSV y Email**: `POST /api/v2/export` con
    `{ recurso:'frontdesk-day-summary', formato:'pdf'|'csv', canal:'download'|'email', destino?, filtros:{ servicio, fecha, centerIds:[centro] } }`.
    - En `download` devuelve el archivo en base64.
    - En `email` lo manda adjunto.
    - Queda en `/export/jobs` (trazable).
- Textos con `labelKey` (i18n, es/en).

## Verificación
En producción, Caguas, Vitamina C del 18-nov debe dar 13/13 (completo), 13 viales y 325 g.
Prueba también un servicio que **no** esté completo: no debe abrir el resumen.
