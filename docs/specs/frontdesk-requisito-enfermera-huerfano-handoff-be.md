> **RESUELTO por el BE, 3-oct-2026 — ya corregido en producción, en los dos centros.**
>
> Diagnóstico confirmado, y la causa era **más honda** que un requisito mal puesto: `enfermera` no
> estaba escrita en `formAcciones.campos`, se **deriva** del atributo `requiereEnfermera` del
> servicio (`campos-que-el-servicio-exige.ts`). Trece servicios lo tenían en `true` sin deberlo, así
> que borrar el requisito no habría bastado: volvía a aparecer en la siguiente lectura.
>
> **Hecho:**
> 1. `requiereEnfermera: false` en los 13 servicios de técnico (6 Bayamón + 7 Caguas). Barrido
>    posterior con tu mismo método —contrastar requeridos contra columnas, servicio por servicio—:
>    **0 servicios con requisito imposible** en ambos centros. **Asistir ya cierra en Láser.**
> 2. **Invariante blindado**: `PUT /servicios/:id` rechaza ahora cualquier cambio que dejaría al
>    servicio exigiendo un campo sin columna, venga el requisito declarado o derivado. Responde 400
>    con `labelKey: frontdesk.servicio.requisito_sin_columna` y el array `campos` con los huérfanos,
>    por si quieres pintarlo en la pantalla de configuración del servicio.
>
> El guardia va en el GUARDADO y no solo en una prueba, porque esto era configuración: el dato
> validaba perfectamente — dos piezas correctas por separado que juntas formaban un muro. Ni el
> build ni los 5.168 tests podían verlo, igual que decías.
>
> **Tu supuesto era el correcto**: en servicios de técnico la intención es NO pedir enfermera. Si
> algún día uno sí la necesita, se le compone `fd_enfermera` y se reactiva; lo que ya no se puede es
> dejar el requisito colgando.
>
> Razón completa: `cmr-be/docs/specs/lo-que-se-exige-tiene-donde-escribirse.md`.

# Handoff BE — "Asistir" pide una ENFERMERA que no existe en el servicio (callejón sin salida)

**Severidad: ALTA.** Bloquea el cierre del flujo (`asistido`) en servicios de técnico reales, en
AMBOS centros, HOY, en producción. El recepcionista no puede asistir al paciente y no tiene forma de
destrabarlo desde la pantalla. Toca el flujo operativo del frontdesk a diario.

**Fecha de verificación:** 2026-10-03. **Entorno:** producción (`api.centrodemedicinaregenerativa.com`).
**Autor:** FE (larciles). **Esto NO es competencia del FE** — el FE es fiel al contrato; la causa es
dato de configuración del BE (ver §Causa raíz).

---

## 1. El síntoma (reproducible hoy)

Pestaña **Láser** del frontdesk, paciente real del día (record 90321, Bayamón). El flujo es
`PRESENTE → EN TERAPIA → ASISTIDO`. Al intentar **Asistir**, la pantalla exige el campo **"enfermera"**.
Pero en la tabla de Láser **no existe ninguna columna de Enfermera**: las columnas propias del servicio
son **Técnico** y **Aplicadas**. Resultado: te pide un dato que **no tiene dónde capturarse** → la
transición queda **permanentemente bloqueada**. Es un callejón sin salida.

## 2. Qué hace el FE (y por qué NO es el culpable)

El menú de acciones del frontdesk es **100 % data-driven**. Para decidir qué exige "Asistir", el FE lee
**exactamente** lo que el BE declara en el servicio:

```
servicio.formActions.campos  →  filtra  requerido === true && en === estadoDestino
```

(ver `components/frontdesk/frontdesk-board.tsx`, `faltantesPara()`). No hay NINGÚN hardcode de
"enfermera" en el FE. Si el BE declara `enfermera` como requerida para `asistido`, el FE la exige. Punto.
El FE da por lleno el campo si encuentra valor en `sesion.datos[clave]` **o** en la columna `fd_<clave>`
de la fila. Si esa columna **no está compuesta en el servicio**, nunca puede haber valor → bloqueo eterno.

## 3. Causa raíz (verificada por HTTP, no supuesta)

Hay servicios cuyo `formActions.campos` declara **`enfermera` requerida en `asistido`**, pero cuya
**composición de columnas NO incluye `fd_enfermera`**. El requisito es **huérfano**: apunta a una columna
que el servicio no tiene.

**Comprobado contrastando dos endpoints del propio BE, servicio por servicio:**

- `GET /api/v2/services` → `formActions.campos[]` (qué se exige).
- `GET /api/v2/services/:id/columns` → la composición real de columnas del servicio (qué se puede llenar).

### Evidencia — Láser (Bayamón)

- **Requeridos:** `aplicadas@asistido`, `tecnico@en_terapia`, `enfermera@asistido`.
- **Columnas compuestas:** `fd_paciente, fd_record, fd_tecnico, presente, en_consulta, asistido,
  fd_sesiones, fd_aplicadas, fd_wa, fd_sms, fd_acciones, fd_compras`.
- **`fd_enfermera` NO está.** `fd_tecnico` y `fd_aplicadas` sí → por eso Técnico y Aplicadas se ven en
  la tabla y Enfermera no. El requisito `enfermera` no tiene columna: imposible de satisfacer.

### Evidencia — barrido completo (todos los servicios con requisito huérfano)

Servicios que exigen `enfermera@asistido` **sin** columna `fd_enfermera` en su composición:

| Centro  | Servicios con requisito de enfermera HUÉRFANO                                  |
|---------|-------------------------------------------------------------------------------|
| Bayamón | `emtt`, `laser`, `ondas_choque`, `camara_energetica`, `pemf`, `camara_hiperbarica` (6) |
| Caguas  | los 6 anteriores + `bioresonancia` (7)                                         |

Son, sin excepción, **servicios de técnico** (todos tienen `fd_tecnico` y ya exigen `tecnico`). La
enfermera sobra ahí.

> Nota: otros servicios (p. ej. `mots_c`, `bpc`, `nano`, `intravenoso`…) también exigen `enfermera`,
> **pero esos SÍ tienen la columna `fd_enfermera`** compuesta, así que son llenables y NO entran en este
> bug. Si además deben o no pedir enfermera es una decisión clínica aparte; este handoff se limita a lo
> que está **roto de forma demostrable**: requisito sin columna.

## 4. El invariante que se violó

**Todo campo `requerido` de `formActions.campos` debe corresponder a una columna presente en la
composición del servicio** (match por `clave` o por `fd_<clave>`). Si no, el requisito es inalcanzable y
la transición es un muro. Hoy ese invariante no se cumple en 6–7 servicios por centro.

## 5. Lo que se pide al BE

1. **Arreglar el dato en los servicios huérfanos de AMBOS centros.** Para los servicios de técnico
   listados, la lectura correcta es **quitar `enfermera` de los requeridos de `asistido`** (ya gatean por
   `tecnico`, que es lo que corresponde a un servicio de técnico). Si en algún caso el criterio clínico
   fuera que SÍ hace falta enfermera, entonces hay que **componer la columna `fd_enfermera`** en ese
   servicio para que sea capturable — pero no dejar el requisito colgando sin columna.
2. **Blindarlo con un test de contrato / invariante** que recorra cada servicio y **falle** si algún
   campo `requerido` no tiene columna en la composición (clave o `fd_clave`). Es exactamente la clase de
   deriva silenciosa que ni el build ni las pruebas de unidad ven: el dato "valida", solo que pide algo
   imposible. Un guard aquí evita que vuelva a aparecer al sembrar un servicio nuevo.
3. **Confirmar el alcance por centro.** Se verificó Bayamón y Caguas; si hay más centros/tenants, el
   barrido debe correrse en todos, porque es configuración por servicio y puede repetirse.

## 6. Lo verificado vs. lo supuesto (separado, como manda)

- **Verificado por HTTP (2026-10-03, prod):** las tablas de §3 — requeridos por servicio y columnas
  compuestas por servicio, en Bayamón y Caguas. El FE no hardcodea "enfermera".
- **Supuesto (criterio clínico, lo decide el negocio/BE):** que la intención correcta en los servicios de
  técnico sea NO pedir enfermera. Lo marco como supuesto; si la intención es pedirla, entonces falta la
  columna (opción 1b), no sobra el requisito.

---

**Mientras tanto, el FE no inventa nada ni parchea el dato a mano** (sería renombrar/componer por mi
cuenta, justo lo que no se hace). Queda a la espera de que el BE corrija la configuración o diga el
criterio, y entonces se verifica de nuevo por HTTP que "Asistir" cierra sin muro.
