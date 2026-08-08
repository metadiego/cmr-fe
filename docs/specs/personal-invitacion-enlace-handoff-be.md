# HANDOFF BE — Personal sin login + invitación que ENLAZA a un personal existente (sin perder historial)

> Competencia BE. Escrito desde el FE a pedido del dueño (2026-08-04). Es diseño/contrato; el FE solo
> consumirá lo que el BE exponga (invitar, aceptar, ver el enlace). NO implementar en el FE.

## El problema en una frase
Técnicos y enfermeras trabajan y **acumulan historial** (sellos, participaciones, sesiones aplicadas)
**sin entrar nunca al sistema**. El día que uno necesite acceso y se le mande la invitación por correo,
**su historial NO puede borrarse ni quedar en otra identidad**: la cuenta nueva debe enlazarse al
registro de personal que ya existe.

## Principio (ya validado con el dueño)
La identidad "quien aplica la terapia / trabaja" es el registro **`personal`** (con su `personalId`), y es
**independiente** de la "cuenta que inicia sesión" (auth user + `perfil`). **Todo el historial cuelga de
`personalId`, nunca del login.** Por eso un personal puede existir años sin cuenta y luego recibir acceso
sin perder nada.

## Lo que se necesita del BE

### 1. Alta de personal SIN login
- Crear `personal` (técnicos/enfermeras) por **centro** (sobre todo **Bayamón**; Caguas es el mismo caso),
  con su **capacidad** (terapeuta/enfermera). Sin cuenta de acceso, sin invitación.
- Desde el alta ya deben poder aparecer como técnico/enfermera en tableros, sellos y estadísticas.
- **Fuente legacy** para sembrar (misma consulta para ambos centros):
  ```sql
  SELECT CASE clase WHEN 'ns' THEN 'enfermera' WHEN 'lt' THEN 'tecnico' END AS capacidad,
         [login] AS usuario, nombre, apellido
  FROM loginpass WHERE activo = 1 AND clase IN ('lt','ns');
  ```

### 2. Roles/capacidades MÚLTIPLES (no una sola tarea)
Regla del dueño desde el inicio: **un usuario NO se limita a una única tarea.** Ejemplo real (Caguas):
`EORTIZ · Eduardo Ortiz Rodriguez` es **sub-gerente** y además **da terapias** y **trabaja en Atención y
Frontdesk**. Igual hay gerentes/CEO/presidencia que además atienden al frente. El modelo de roles/capacidades
debe ser un **conjunto** por persona, no un rol excluyente.

### 3. Invitación que ENLAZA a un personal existente (el núcleo)
Al invitar, hay que **vincular el correo de la invitación al `personalId` que ya existe** (el "usuario base"),
para que al aceptar + fijar contraseña la cuenta auth/`perfil` quede atada a **ese mismo `personalId`**:
- **Antes/al enviar** la invitación: elegir el personal existente y asociarle el email → la invitación
  queda "reservada" para ese personal.
- **Al aceptar** (magic link + set-password): NO crear una identidad nueva; **bindear** el auth user al
  `perfil` que apunta a ese `personalId`. El historial (participaciones/sellos/sesiones) se conserva porque
  ya colgaba de `personalId`.
- Idempotente y a prueba de errores: si el correo ya tuviera cuenta, no duplicar personal ni romper; si se
  invita dos veces, no crear dos identidades. Nunca dejar historial "huérfano" ni partido en dos personas.

### 4. Reparable (norma del dueño: nada rígido)
- Debe poder **corregirse** si alguien enlaza mal: reasignar el `perfil`/cuenta a otro `personal`, o
  desvincular, sin perder el historial (que sigue en `personalId`).

## Lo que hará el FE (cuando el BE lo exponga)
- Pantalla para dar de alta personal sin cuenta (por centro, con capacidad) — o reusar la de personal.
- En la gestión de accesos: acción "Invitar" que pida el correo y **muestre a qué personal existente se
  está enlazando** (para no crear un duplicado por error), y el estado (invitado / activo).
- Consumir el ciclo de invitación por email que ya existe (ver `be-email-invite-contract`), añadiendo el
  enlace al `personalId`.

## Preguntas para el dueño/BE (decidir antes de construir)
1. ¿El enlace se hace **al enviar** la invitación (reservar el personal) o **al aceptar** (casar por correo)?
   El dueño prefiere enlazar por adelantado.
2. ¿Un `personal` puede tener más de una cuenta a lo largo del tiempo (rotación)? ¿O 1:1 vivo a la vez?
3. ¿La capacidad (terapeuta/enfermera) y los roles de app (gerente, atención…) viven juntos o separados?
