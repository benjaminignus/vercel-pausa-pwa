# Vercel Pausa

App web instalable (PWA) para **pausar y reanudar proyectos de Vercel desde el móvil**.
Vercel no tiene app oficial para Android, y su panel web es incómodo para esto.

## Qué hace

- Lista **en vivo** los proyectos del equipo (botón ↻, arrastrar hacia abajo y recarga al volver a abrir la app).
- **Pausar todos / Reanudar todos** por defecto.
- **Casilla por proyecto** para dejarlo fuera de los botones generales (se recuerda en el móvil); un proyecto nuevo entra por defecto en «todos».
- Botón individual **Pausar / Reanudar** en cada fila.
- Confirmación antes de pausar (reanudar no la pide).
- **Se protege a sí misma**: nunca se pausa, para no quedarse bloqueada.
- Contraseña propia; el token de Vercel vive solo en el servidor, nunca en el móvil.

## Despliega tu propia copia

Cada persona despliega su copia con su propio token: este repo no contiene ninguna credencial.

1. **Crea un proyecto en Vercel** a partir de este repo (preset «Other», sin comando de build). Con el repo conectado, un push a `main` despliega solo.
2. **Token de Vercel**: Account Settings → Tokens → *Create Token*. En **Scope** elige el equipo donde están los proyectos que quieres controlar (no tu cuenta personal si estos están en un equipo) y ponle caducidad.
3. **Variables de entorno** del proyecto (ver `.env.example`): `VERCEL_TOKEN`, `APP_PASSWORD` y, si usas un equipo, `VERCEL_TEAM_ID`. Márcalas como *Sensitive*.
   Vercel solo aplica las variables a los despliegues posteriores: tras cambiarlas, hay que redesplegar.
4. **Desactiva «Vercel Authentication»** en Settings → Deployment Protection de *este* proyecto. La app tiene su propia contraseña; si queda activa, el móvil pide iniciar sesión en Vercel y la app no se puede instalar.
5. En el móvil, abre la URL en **Chrome → menú ⋮ → «Instalar app»** (o «Añadir a la pantalla de inicio»).

## Seguridad

Esta app puede apagar tus webs, así que conviene tratarla con cuidado:

- **Contraseña larga**: usa 16 caracteres aleatorios o más. El login no limita los intentos en paralelo, así que la contraseña es la defensa real.
- **Límite de intentos**: si tu plan lo permite, añade una regla de rate limit en el Firewall de Vercel sobre `/api/login`.
- **El token de Vercel no se puede limitar a «solo pausar»**: da control sobre todo el equipo. Ponle caducidad y no lo reutilices.
- **Sesiones**: duran 30 días. Cambiar `APP_PASSWORD` o `VERCEL_TOKEN` y redesplegar las cierra todas.
- Con «Vercel Authentication» desactivada, la contraseña es lo único que protege la app.

## Probar en local (sin tocar tu cuenta)

```bash
node dev/server.js      # http://localhost:5690, con una API de Vercel simulada
```

Contraseña de prueba: ver `dev/server.js`.

## Estructura

| Ruta | Función |
|---|---|
| `public/` | Interfaz (PWA): `index.html`, `manifest.webmanifest`, `sw.js` |
| `api/icon.js` | Icono de la app generado al vuelo (`/api/icon?size=192\|512`) |
| `api/login.js` | Valida la contraseña y devuelve una sesión firmada (30 días) |
| `api/projects.js` | Lista los proyectos con su estado (`paused`) |
| `api/toggle.js` | Pausa/reanuda los proyectos indicados (o todos) |
| `api/_lib.js` | Sesión, cliente de la API de Vercel y protección de la propia app |
| `dev/` | Servidor local y API simulada (no se despliega) |
