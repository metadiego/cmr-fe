# FE → BE — Transferir disponibilidad de tratamiento a OTRO paciente (y exponer el de centro)

## Nota permanente — el caso Martina/Santos, cerrado tal cual quedó (19-nov-2026)

**Para que cualquier sesión futura, en cualquier equipo, tenga la respuesta sin tener que volver a
investigar:** el 19-nov-2026 se transfirió a mano el paquete de Plaquex de Martina Vidro Vega (récord
#102675, Bayamón, factura legado S243803, `copiadoDelLegado: true`) a Santos Ramírez Rodríguez
(récord #103058), por pedido directo del dueño, carácter de emergencia, para que la sesión de hoy de
Santos tuviera disponibilidad y pudiera atenderse (sesión 1/4).

- El BE hizo el cambio por datos, con respaldo (`.personal/backups/...`) y traza en el `meta` del
  paquete nuevo (`transferred_from_package_id`, `invoice_number` del legado).
- **Discrepancia conocida y aceptada, no es un bug:** a Martina le quedaban 3 sesiones; Santos quedó
  con 4 porque el dueño pidió explícitamente "1/4". El dueño, al verlo, confirmó que así se queda —
  es su decisión de negocio, no algo que haya que corregir.
- El paquete de origen (`284e32ef`) es del **legado** y de **otro centro/flujo** que esta sesión no
  conoce a fondo (cómo el legado contaba sus propias sesiones, si Martina ya había usado alguna fuera
  del sistema nuevo, etc.). El dueño decidió explícitamente **no investigarlo más** — "no sé cómo
  trabajan, lo mejor es dejarlo así".
- Pendiente de otra conversación, NO resuelto aquí: el BE señaló que Martina todavía tenía una sesión
  de Plaquex propia "en terapia" hoy, anclada a su paquete ya cerrado — si era en realidad Santos
  atendiéndose a nombre de ella, había que cancelarla. Si alguien pregunta por esto más adelante y no
  hay otra nota que lo cierre, es que seguía abierto en ese momento — no asumir que se resolvió solo.

Esta nota vive aquí (y no solo en el chat) porque el pedido del dueño fue justamente ese: que la
respuesta esté en GitHub, no solo en una conversación que se pierde.

## Pedido del dueño, 19-nov-2026

Casos reales, no hipotéticos: un paciente compra un paquete en un centro y se atiende en otro; o un
paciente no va a terminar su paquete y lo transfiere a otro (como el caso de emergencia de hoy,
Martina Vidro #102675 → Santos Ramírez #103058, Plaquex, resuelto a mano por el BE con respaldo y
`transferred_from_package_id`). El dueño quiere una pantalla para hacerlo él mismo, sin pedirlo como
emergencia cada vez: un nuevo tab/pill en la ficha del paciente (`/patients/:id`) para **transferir
tratamiento a otra persona** y **transferir a otro centro**, total o parcial, que descuente la
disponibilidad de donde sale y la sume donde el paciente será atendido. Pide que sea **muy fácil de
usar** — el mínimo de pasos, la información justa.

## Lo que ya existe (verificado en código, no asumido)

1. **Transferencia de tratamiento a otro CENTRO, mismo paciente — ya construida**:
   `POST /facturas/paquetes/:id/transferir` (`lib/api/frontdesk.ts`, `transferirTratamiento`):
   ```ts
   { destinationClinicId: string, sessions?: number /* omitido = todas las pendientes */,
     mode?: "virtual" | "fisica", sourceWarehouseId?: string, destinationWarehouseId?: string,
     reason?: string }
   ```
   - `sessions` omitido = transferencia TOTAL; con número = PARCIAL. Esto ya cubre el "total o
     parcial" que pide el dueño.
   - `mode: "virtual"` mueve solo el tratamiento (el destino descuenta su propio stock al aplicar);
     `mode: "fisica"` ADEMÁS mueve el material físico (viales/insumos) entre almacenes, enganchando
     el motor genérico de `/inventario/transferencias` (que ya tiene aceptar/rechazar en el centro
     destino, alertas, historial — ver `docs/specs/transferencia-*-handoff-be.md`).
   - Reversible: `POST /transferencias/:id/anular` (mencionado en el comentario del código; el FE
     no lo envuelve todavía — hace falta si esta pantalla va a ofrecer deshacer).
   - El centro ORIGEN es el activo (`X-Tenant-ID`).

2. **Transferencia de disponibilidad a otro PACIENTE — NO existe como endpoint.** Hoy se resuelve a
   mano (el caso de Martina/Santos de esta mañana): el BE marcó el paquete origen
   `transferred_sessions = N`, `status = consumido`, y creó un paquete nuevo para el destino con
   `transferred_from_package_id` apuntando al origen y el mismo `invoice_number` para trazabilidad.
   Eso es exactamente el modelo de datos que esta pantalla necesita poder disparar ella sola, sin que
   sea una corrección manual cada vez.

## Lo que pedimos (propuesta FE, a confirmar/ajustar por BE — API-First: ustedes deciden la forma final)

**No duplicar el mecanismo.** En vez de un endpoint paralelo, generalizar
`POST /facturas/paquetes/:id/transferir` para aceptar un destino que puede ser un paciente, un
centro, o ambos a la vez:

```ts
{
  destinationPatientId?: string;   // NUEVO. Omitido = mismo paciente (el caso de hoy, sin cambios).
  destinationClinicId?: string;    // Como hoy. Omitido = mismo centro.
  sessions?: number;               // Como hoy: omitido = todas las pendientes, con número = parcial.
  mode?: "virtual" | "fisica";
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  reason?: string;                 // Si va a otro paciente, que sea OBLIGATORIO: hay que poder
                                    // explicar por qué, igual que el meta que dejó el BE hoy a mano.
}
```

Con esto, las tres combinaciones del pedido del dueño salen de UN solo endpoint:
- Mismo paciente, otro centro → como hoy, sin `destinationPatientId`.
- Otro paciente, mismo centro → sin `destinationClinicId` (el caso de Martina/Santos).
- Otro paciente, otro centro → ambos campos.

**Validación dura que el caso de hoy demostró que hace falta**: el backend debe RECHAZAR
(`400`, con un código claro, p. ej. `SESSIONS_EXCEED_AVAILABLE`) un `sessions` mayor a lo que
realmente queda en el paquete origen. Hoy el dueño pidió "1/4" cuando a Martina solo le quedaban 3, y
el BE tuvo que avisarlo después de aplicado — con esta pantalla en manos de recepción, eso debe
bloquear ANTES de confirmar, no corregirse después.

**Qué necesitamos leer para construir la pantalla**:
- Un endpoint (o el ya existente `GET /frontdesk/servicios/:id/disponibilidad?patientId=`, revisar
  si ya alcanza) que devuelva, para UN paciente, sus paquetes con sesiones pendientes — para
  mostrarlos como origen a elegir.
- Confirmar si `destinationPatientId` necesita existir ya como paciente en el centro destino, o si
  el alta se resuelve aparte (no debería bloquear esta pantalla).
- El código de error exacto para "sesiones mayores a las disponibles" y para "paciente destino no
  existe en ese centro", para mostrarlos traducidos en vez de un error genérico.

## Pantalla propuesta (FE, boceto — ajustamos con su feedback)

Nuevo tab/pill en `app/(app)/patients/[id]/layout.tsx` (416 líneas hoy — el contenido de esta pestaña
nace en su propio componente, como ya hace `FichaCambioProtocolo`, nunca inline): **"Transferir
tratamiento"**.

- Paso 1: elegir el paquete de ESTE paciente con sesiones pendientes (de la lista de disponibilidad).
- Paso 2: elegir destino — **a otra persona** (buscador de paciente, como el de facturación) o **a
  otro centro** (como ya existe en el flujo de frontdesk, pero expuesto aquí también).
- Paso 3: cuántas sesiones — radio "Todas las pendientes (N)" / "Una cantidad" con el máximo
  bloqueado al pendiente real (nunca un número que el backend vaya a rechazar).
- Confirmar con un motivo (obligatorio si es a otra persona).
- Resultado: muestra la disponibilidad ANTES/DESPUÉS en ambos lados (origen baja, destino sube),
  para que quien lo hace vea que quedó bien sin tener que ir a comprobarlo en otra pantalla.

Diseño moderno, pantalla completa, nada a medias — seguimos el resto de estatutos del proyecto
(API-First, i18n, RBAC con `centerIds` opcional, TDD, sin hardcode) tal cual están en `CLAUDE.md`.

## Siguiente paso

Mandamos este handoff y nos detenemos del lado del contrato: no construimos la UI contra una forma de
payload supuesta. En cuanto confirmen (o ajusten) la forma de arriba, seguimos con la pantalla.
