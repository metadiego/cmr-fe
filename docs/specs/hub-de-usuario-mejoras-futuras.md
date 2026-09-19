# Hub de usuario — mejoras futuras

**Estado:** el hub está bien para salir a producción. Estas mejoras se retoman **después** del arranque,
no bloquean. Contexto: el hub es de **usuario** (los médicos son un usuario más; la única distinción es
que hacen consultas). Todo vive en el panel derecho de `/configuration/staff`, en pestañas: Ficha,
Disponibilidad (todos), y Agenda / Pacientes / Producción (solo capacidad `medico`).

## Pendientes (orden sugerido)

1. **Renombrar lo interno de «médico» a «usuario».** Hoy quedan nombres heredados del primer enfoque:
   namespace i18n `medicoHub.*`, componentes `MedicoDisponibilidad`, `MedicoAgenda`, `MedicoPacientes`,
   `MedicoProduccion`, y props `doctorId`. Son de usuario, no de médico. Renombrar a `userHub.*` /
   `UserAvailability` / `UserAgenda` … y `staffId`, sin cambiar comportamiento. (Regla inglés + mantenible.)

2. **Textos de Disponibilidad genéricos.** El componente habla de «horarios de atención» / «próxima
   fecha», que para un no-médico (recepción, operadora) suena a agenda de consultas. Generalizar a
   «horario de trabajo» y mover el probador de «próxima fecha» a que **solo** aparezca para médicos.

3. **Permiso correcto para días libres/permisos/vacaciones.** Hoy la edición se gatea con
   `citas.config`. Para la parte de RRHH (ausencias de cualquier usuario) conviene un permiso propio
   (p. ej. `staff.availability.write`), separado de la configuración de citas. → handoff BE.

4. **Endpoints `/doctors/*` → `/staff/*`.** `/doctors/schedules`, `/doctors/absences` y
   `/availability/next-available-date` ya aceptan un usuario no-médico (verificado: GET 200, POST 201,
   DELETE 204), pero el nombre sigue diciendo «doctor». Pedir al BE el alias `/staff/*` y migrar el
   cliente `lib/api/disponibilidad.ts` cuando exista. → handoff BE.

5. **Estadísticas por usuario reales.** «Producción» hoy se **compone** en el FE (nº de pacientes +
   citas del año + atendidas). Cuando el BE publique un endpoint de estadísticas por persona, usarlo en
   vez de componer. → handoff BE.

6. **Limpieza menor.** La clave i18n `personalFicha.verHub` quedó sin uso tras eliminar la ruta aparte
   `/configuration/staff/[id]`; borrarla en ambos catálogos.

7. **¿Entrada de menú «Usuarios»?** Hoy se llega por Configuración → Personal. Si se quiere, valorar una
   entrada única «Usuarios» en Administración (una sola, sin duplicar; NO una de «Médicos»).

## Lo que NO se toca

- El hub sigue en **una sola pantalla**, sin volver a una ruta `[id]` aparte.
- **No** reintroducir una sección/menú exclusivo de médicos: todos por igual, excepción = consultas.
