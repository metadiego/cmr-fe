# Quejas del mostrador (20-oct-2026) — handoff BE → FE

**De:** BE · **Origen:** Christian y Yadira, vía Diego · **Spec BE:**
`cmr-be/docs/specs/quejas-de-mostrador-2026-10-20.md` · **BE:** `1582785`.

En el BE ya está arreglado lo suyo:
- un paciente de seguimiento ya no se trata como «nuevo» en el chequeo del EHR;
- el error «no se pudo comprobar» tiene su propio `labelKey`;
- `POST /board/action` lleva al actor del login, y los vitales guardan quién los tomó.

Esto es lo que le toca a la pantalla.

## 1. «Faltan datos» al marcar Presente: abrir el modal en TODAS las pantallas

El 400 con `code: PACIENTE_DATOS_REQUERIDOS` trae `faltantes: ['docId', 'idType', 'zipcode', …]`
(nombres de campo). Hoy solo `flujo-atencion.tsx`, `agregar-cita-modal.tsx` y `patient-detail.tsx`
abren `EhrReadinessModal` para completarlos. Estas pantallas muestran solo un toast, y el usuario no
sabe qué falta ni cómo seguir:

- `components/tablero/celda-toggle-hora.tsx` (~81-86)
- `components/tablero/estado-select.tsx` (~57)
- `components/agenda/cita-modal.tsx` (~291, Control de Citas)
- `components/frontdesk/fila-sesion.tsx` (no maneja este código)

**Pedido:** una sola pieza compartida («si llega `PACIENTE_DATOS_REQUERIDOS` con `faltantes`, abre el
modal, y al guardar reintenta la acción»), usada por todas. Y una prueba que impida que una pantalla
nueva vuelva a mostrar solo el toast.

Nuevo `labelKey`: `citas.datos_no_verificables`, con `faltantes: []`. Significa que no se pudieron
comprobar los datos (falló el chequeo con el EHR). Hay que mostrar «No se pudieron comprobar los
datos del paciente, inténtalo de nuevo». No es «faltan datos».

## 1b. Completar los datos al registrar la llegada, aunque no bloquee

Algunos pacientes se citan directamente en recepción, sin pasar por Control de Citas. Si al paciente
le faltan datos y **no** se bloquea (porque es de seguimiento), el modal debe **ofrecerlos** al
marcar Presente, sin impedir continuar: botón «Completar ahora» y botón «Seguir sin completar».
`GET /ehr-integration/patients/:id/readiness` ya devuelve `faltantes` y `bloquear` por separado.

## 2. Se pierde el médico asignado al atender

Al marcar «Asistido» se abre `nueva-cita-modal.tsx`. `pickDoctor` (`lib/tablero/pick-doctor.ts`)
solo encuentra al médico si está en `getOpciones(tablero, "medico")`, que son los médicos activos
del centro. Control de Citas elige de otra lista (`getMedicos()`). Si el médico asignado no está en
la del tablero, el modal cae a «Sin médico» y la cita de seguimiento nace sin él.

**Pedido:** usar `lib/medicos/patient-doctor-option.ts`, la misma pieza que ya usan facturación y
agregar-cita. Si `cita.doctorId` no está entre las opciones, se añade con su nombre, preseleccionado,
y se puede cambiar. En el BE ninguna transición toca `doctorId`; está verificado.

## 3. Filtro de tipo de consulta: «Todos los tipos» por defecto

Si quedó elegido «Seguimiento» o «Consulta nueva», algunos pacientes no aparecen y el usuario no se
da cuenta de que hay un filtro puesto.

**Pedido:**
- al abrir el tablero, el filtro de tipo siempre arranca en **Todos los tipos**: no se recuerda
  entre sesiones ni entre días;
- cuando hay un filtro activo, se ve claramente: un chip con una ✕ y el contador «filtrando:
  Seguimiento».

## 5. Buscar por récord deja el panel congelado en ese paciente

Con un récord escrito en la búsqueda, solo se ve ese paciente, y el panel no se limpia ni se
actualiza solo.

**Pedido:**
- la búsqueda se limpia con una ✕ visible;
- el panel sigue recibiendo actualizaciones en vivo (SSE) aunque haya búsqueda;
- al terminar la acción sobre ese paciente (Presente, Asistido…), la búsqueda se limpia sola, o
  al menos se ve que está puesta.

## 6. Mostrar quién tomó los vitales

Desde `1582785` el BE guarda `vitalsNurseId` (v2) / `enfermeraVitalesId` (v1) al pasar el paso de
vitales, y el resolver `enfermera.nombre` ya lo devuelve en el tablero. La columna `enfermera` del
tablero de Atención está activa pero **oculta**: se activa desde la configuración del tablero (lo
decide el dueño). Si la pantalla tiene su propio lugar para «Vitales: hora», que diga también
«por <nombre>».

## Pruebas que pide

- Presente sobre un paciente con datos faltantes, desde cada una de las 4 pantallas: se abre el
  modal, no solo el toast.
- Asistido con un médico asignado que no está en la lista del tablero: la nueva cita lo mantiene.
- El tablero abre en «Todos los tipos» aunque ayer se dejara en «Seguimiento».
- Búsqueda por récord: hay ✕ para limpiar, y el panel sigue vivo.
