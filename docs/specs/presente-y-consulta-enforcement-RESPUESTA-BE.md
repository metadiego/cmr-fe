# RESPUESTA BE — las dos reglas ya viven en el servidor (desplegado y verificado)

Contesta a `presente-y-consulta-enforcement-handoff-be.md`. **Ambas reglas están en producción**,
comprobadas por HTTP contra producción el 30-sep-2026, no por tests.

## Regla 1 — PRESENTE exige los datos del paciente NUEVO

`POST /api/v2/appointments/:id/present` (v1: `/citas/:id/presente`) rechaza con **400**:

```json
{ "error": {
    "code": "PACIENTE_DATOS_REQUERIDOS",
    "labelKey": "citas.datos_requeridos_para_presente",
    "message": "faltan datos obligatorios del paciente para marcarlo presente",
    "faltantes": ["docId", "idType", "fechaNacimiento", "zipcode"] } }
```

**El campo se llama `faltantes`** (no `faltan`), y trae exactamente las claves que espera
`EhrReadinessModal`. Abridlo con esa lista y reanudad la transición al guardar.

### Verificado en producción — 4 de 4 rechazadas

```
cita 2050a8e3 (SANTOS SANTIAGO MATEO)  → 400 PACIENTE_DATOS_REQUERIDOS · docId,idType,fechaNacimiento,zipcode
cita 7077aad3 (MARIANIO MATOS MATOS)   → 400 PACIENTE_DATOS_REQUERIDOS
cita f0727b09 (NOELIA CRUZ GONZALEZ)   → 400 PACIENTE_DATOS_REQUERIDOS
cita 208d25be (GUADALUPE NAZARIO CRUZ) → 400 PACIENTE_DATOS_REQUERIDOS
```

Da igual el cliente, y da igual si el readiness se cae: **falla CERRADO**. Si no se puede
comprobar, no pasa — porque fallar abierto es lo que permitió que a PALMIRA la dejaran en Presente.

### Y NO bloquea a quien no debe

Comprobado con el readiness de pacientes reales con cita hoy, sin escribir nada:

```
GLADYS GUTIERREZ PEREZ          nuevo=true  → bloquear=true   (se le exige)
NILSA I BAEZ RIVERA             nuevo=false → bloquear=false  (pasa, aunque le falten datos)
MIGUEL ANGEL VELLON VILLANUEVA  nuevo=false → bloquear=false
MAYRA GRILLASCA ROSARIO         nuevo=true  → bloquear=true
```

El de SEGUIMIENTO nunca ve el modal, como estaba acordado. La regla de a quién aplica sigue siendo
dato (`blockOnlyNewPatients` en `ehr_integration_config`), no código.

## Regla 2 — EN CONSULTA exige un médico DE VERDAD

`POST /api/v2/appointments/:id/consultation` rechaza con **400**:

```json
{ "error": {
    "code": "CITA_MEDICO_REQUERIDO",
    "labelKey": "citas.medico_requerido_en_consulta",
    "message": "para entrar en consulta la cita necesita un médico de verdad" } }
```

Rechaza tanto **sin médico** como con el **«Sin Medico»** puesto (`legacyCode = '000'`), que es el
relleno que se estampa al agendar sin nadie. Entrar en consulta es ver a alguien.

## Y de propina: ningún 403 mudo

Cualquier 403 por permiso dice ahora **cuál falta**:

```json
{ "error": { "code": "FORBIDDEN", "labelKey": "auth.permiso_faltante",
             "faltan": ["pacientes.update"], "requeridos": ["pacientes.update"],
             "message": "falta el permiso pacientes.update" } }
```

## Lo que os toca

1. `PACIENTE_DATOS_REQUERIDOS` → abrir `EhrReadinessModal` con `error.faltantes`.
2. `CITA_MEDICO_REQUERIDO` → avisar y, si queréis, abrir el selector de médico.
3. `FORBIDDEN` → podéis mostrar `error.faltan` en vez de un «sin permiso» genérico.

El candado del cliente puede quedarse como camino feliz; ya no es lo único que hay.

---

## AÑADIDO 30-sep 12:55 — la pantalla PINTA Presente aunque el servidor lo rechace

El dueño, en directo con la usuaria **Leasy Martínez**: el paciente nuevo **JOSE DAVID COLON
SIMONETTI** (récord 102725) *«no muestra el modal y pasa directo al presente»*.

**El servidor lo rechazó.** Su cita es `7952be25-2fda-45cc-92f9-39d8d0490b9b`, y en la base, ahora
mismo:

```
status = confirmada · arrived_at = (nunca llegó)
```

Y llamando al endpoint por HTTP:

```
POST /api/v2/appointments/7952be25-…/present  → 400
{"code":"PACIENTE_DATOS_REQUERIDOS","faltantes":["docId","idType","fechaNacimiento","zipcode"]}
```

O sea: **la regla funciona y el paciente NO está presente**. Lo que falla es que la pantalla se
pinta como si hubiera pasado. Es una actualización optimista que no se revierte cuando la
transición devuelve 400, y es peor que el defecto original: recepción cree que el paciente está
dentro cuando el sistema dice que no.

**Lo que hay que arreglar en el FE:**

1. **No pintar el nuevo estado hasta que el servidor conteste 2xx**, o revertirlo al recibir el
   error (`runAccion` ya captura el error; lo que falta es deshacer el pintado).
2. Con `PACIENTE_DATOS_REQUERIDOS`, abrir `EhrReadinessModal` con `error.faltantes` — que es
   exactamente lo que el dueño esperaba ver y no vio.

Mientras eso no esté, la pantalla seguirá mintiendo aunque el candado del servidor esté puesto.
