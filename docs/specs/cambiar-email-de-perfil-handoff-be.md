# FE — Cambiar el email de acceso de un perfil ya invitado

El BE ya está listo y desplegado (cmr-be PR #277). Falta la pantalla.

## Para qué es

Alguien fue invitado con el correo equivocado (typo), o quiere entrar con otro. Hoy no hay forma de
corregirlo: hay que borrar y volver a invitar. Con esto, un administrador lo cambia en un paso.

## El endpoint

```
PUT /api/v1/profiles/:id/email
Body: { "email": "nuevo@dominio.com" }
```

Devuelve el perfil ya actualizado, con la misma forma que el resto de `/profiles` (`PerfilResponse`).

Permiso: `profiles.email`, y rol `admin` o `super_admin`. Si el usuario no lo tiene, el botón no se
enseña — pídelo al menú/permisos como con el resto, no lo escondas por rol a mano.

## Qué hace por debajo (para que el texto de la pantalla diga la verdad)

- Cambia el correo en Supabase **y** en nuestra tabla, a la vez. La persona entra con el nuevo desde
  ese momento, sin correo de confirmación de por medio.
- **Cierra las sesiones abiertas de esa persona**: si estaba dentro, se le pedirá entrar otra vez.
  Conviene avisarlo en el diálogo de confirmación.
- Si tiene ficha de personal, también le actualiza el correo ahí.
- No cambia la contraseña. Si además hace falta que ponga una nueva, es el flujo de código de acceso
  que ya existe.

## Errores que hay que enseñar bien

| Situación | Respuesta | Qué mostrar |
|---|---|---|
| El correo ya es de otro perfil | 409 | «Ese email ya es de otro perfil» |
| Es el correo reservado a la cuenta master | 409 | El mensaje que devuelve el BE, tal cual |
| Es el perfil master | 409 | «El perfil master no se puede cambiar por aquí» |
| Correo mal escrito | 400 | Validación en el propio campo, antes de enviar |
| Sin permiso | 403 | No debería pasar si el botón está bien gobernado |

Repetir la llamada con el mismo correo no es un error: devuelve el perfil sin tocar nada.

## Dónde ponerlo

En la ficha del perfil (donde hoy se editan nombre y apellido), como una acción aparte del formulario
—no un campo más del guardar— con confirmación, porque cambia la cuenta de acceso y cierra sesiones.
Mismo sitio y mismo estilo que el botón de código de acceso.

Textos por `labelKey`, como el resto; nada escrito a mano en el componente.
