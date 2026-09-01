# Handoff BE ← FE — Cupos avanzados (Citas Médicas)

> Contexto: la config de cupos actual (`/citas/cupos`, global por centro) es demasiado
> simple. El negocio necesita cupos **por día de la semana**, un **default configurable**,
> **alcance por centro o todos**, **overrides por fecha específica** y **feriados que
> bloqueen (o no) la agenda**. Este doc inventaría qué soporta hoy el BE y qué falta.
> Ámbito: SOLO **Citas Médicas** (módulo `citas`). Citas de **Servicio** (`frontdesk`)
> es otra división y NO se toca aquí.

## Contrato actual (verificado en Swagger, prod)

### `/api/v1/citas/cupos` (gate `citas.config`)
- `CupoAgendaEntity { id, diaSemana: number|null, hora: "HH:mm", tipoCitaId, cantidad, activo, clinicId: string|null }`
- `CreateCupoDto { diaSemana?, hora, tipoCitaId, cantidad, activo? }` — **sin `clinicId`** (lo fija el `X-Tenant-ID`), **sin `fecha`**.
- `GET /citas/cupos?diaSemana=` · `POST` · `PUT /:id` · `DELETE /:id`.

### `/api/v1/festivos` (CRUD admin)
- `FestivoEntity { id, fecha, nombre, recurrenteAnual, activo, clinicId: string|null }`
- `CreateFestivoDto { fecha, nombre, recurrenteAnual?, activo? }` — **sin `clinicId`** (tenant), **sin flag de bloqueo**.

### `/api/v1/medicos/horarios` — `{ medicoId|null, diaSemana, horaInicio, horaFin, activo, clinicId|null }` (ya por día de semana).

## Qué YA soporta ✅
| Requerimiento | Estado |
|---|---|
| Cupo por **hora** + por **tipo de cita** (dinámico) | ✅ `hora` + `tipoCitaId` |
| Cupo **por día de la semana** | ✅ (dato: `diaSemana` 0-6) — ⚠️ falta **confirmar precedencia** (ver BE-1) |
| Cupo **por centro** | ✅ vía `X-Tenant-ID` |
| Feriados: definir fechas (incl. recurrentes anuales) | ✅ `/festivos` |
| Etiquetas de día en el idioma (Lunes/Monday) | ✅ es cosa del FE (Intl), no BE |

## Qué FALTA ❌ — pedidos concretos al BE

### BE-1 · Precedencia efectiva del cupo (confirmar/definir)
`agenda-dia` debe calcular el cupo **efectivo** de cada `(fecha, hora, tipoCita)` con esta prioridad, de más específico a más general:
```
fecha específica  >  día de la semana (0-6)  >  default (diaSemana=null)
   dentro de cada nivel:  centro específico  >  global (clinicId=null)
```
- **Confirmar** que hoy un cupo `diaSemana=3` ya pisa al `diaSemana=null` en `agenda-dia`. Si no, implementarlo.
- (Opcional pero útil) exponer un endpoint de **cupos efectivos** para una fecha+centro, p.ej. `GET /citas/cupos/efectivos?fecha=&centroId=`, para que la pantalla de config muestre "lo que realmente aplica" (default vs override) sin recalcular en el FE.

### BE-2 · Alcance "todos los centros" (default global) — cupos y festivos
Hoy no se puede crear un cupo/festivo **global** (para todos los centros): `clinicId` sale del tenant y los DTO no lo aceptan como `null`. El negocio quiere un **default absolutamente configurable** que aplique a todos y luego ajustar por centro.
- **Pedido:** aceptar en `CreateCupoDto` y `CreateFestivoDto` un `scope?: 'centro' | 'global'` (default `'centro'`). `'global'` guarda `clinicId=null`.
- Gatear `'global'` a rol alto (master/admin) — sugerido permiso nuevo `citas.config.global`.
- Lectura: `agenda-dia` combina global + override de centro según la precedencia de BE-1.
- `GET /citas/cupos` debería poder listar los globales (p.ej. `?scope=global`) para editarlos.

### BE-3 · Override por **fecha específica**
No existe dimensión de fecha en `cupos`. El negocio quiere ajustar cupos **solo para una fecha** (ej. 24-dic: nuevos=1), para un centro, varios o todos.
- **Pedido:** añadir `fecha?: "YYYY-MM-DD"` (nullable) a `cupos` (misma tabla) **o** endpoint aparte `/citas/cupos-fecha`.
- `CreateCupoDto`: `fecha?` + `scope?` (centro/global) como BE-2.
- `GET /citas/cupos?fecha=` para listar/editar los de una fecha.
- Entra en la precedencia de BE-1 (fecha > día-semana > default).

### BE-4 · Feriados que **bloquean la agenda** (configurable)
Hoy `festivos` es solo un catálogo de fechas; no está claro que **bloquee** el agendamiento, y el negocio quiere que el bloqueo sea **opcional por feriado** ("bloqueado o no según reglas").
- **Pedido:** añadir a `festivo` un flag `bloqueaAgenda: boolean` (o `modo: 'bloquea' | 'informativo'`).
- `agenda-dia` para una fecha feriada:
  - si `bloqueaAgenda` → devolver el día como **cerrado** (p.ej. `franjas` con `cupo/vacios = 0`, o un flag `bloqueado: true` + `festivos[]` en la respuesta del centro) para que el FE muestre "Feriado — cerrado" y deshabilite "Agendar".
  - si informativo → solo anotarlo (banner) sin bloquear.
- Aplicar la misma opción de **alcance** (centro/global) de BE-2.
- Confirmar que `recurrenteAnual` se resuelve a la fecha consultada.

### BE-5 · (menor) `agenda-dia` debe exponer feriados/estado del día
Para pintar el encabezado del día, que `agenda-dia` incluya por centro: `festivos: [{fecha,nombre,bloqueaAgenda}]` y `bloqueado: boolean`. Hoy solo trae `notasDia`.

## Resumen de cambios de contrato pedidos
1. `CreateCupoDto`/`UpdateCupoDto`: `+ scope?: 'centro'|'global'`, `+ fecha?: string`.
2. `CreateFestivoDto`/`UpdateFestivoDto`: `+ scope?: 'centro'|'global'`, `+ bloqueaAgenda: boolean`.
3. `agenda-dia`: aplicar precedencia (fecha>diaSemana>default; centro>global) al calcular `cupo/vacios`; incluir `festivos[]` + `bloqueado` por centro.
4. (Opcional) `GET /citas/cupos/efectivos?fecha=&centroId=`; `GET /citas/cupos?scope=global`.
5. Permiso nuevo sugerido `citas.config.global` para escribir cupos/festivos globales.

## Lo que hace el FE cuando BE entregue
- Rejilla **por día de la semana** (tabs Lun–Dom, etiquetas i18n) × hora × tipo de cita.
- Selector **centro / todos** (todos → `scope:'global'`).
- Sección **excepciones por fecha** (date picker → cupos solo de esa fecha, centro/todos).
- CRUD de **feriados** con toggle "bloquea agenda", centro/todos.
- La vista-día pinta "Feriado — cerrado" y respeta el cupo efectivo.
- La pantalla actual (`/citas/agenda/cupos`, global por centro) es un **primer corte**; se reemplaza por lo anterior.

Relacionado: memoria FE `be-citas-agenda`, `citas-medicas-vs-servicios`, `agenda-central-wip`.
