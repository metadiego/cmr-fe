# FE → BE — Transferir disponibilidad de tratamiento a OTRO paciente (y exponer el de centro)

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
