# Publicar el roster cifrado

1. En el celular: Roster → **Activar roster automático**. Copia el código `ROSTER-PUB:...` y guárdalo como `roster.pub.json` en la raíz del repositorio (no es secreto).
2. Arma `roster.json` **fuera del repositorio**:
   `{"actualizado":"AAAA-MM-DD","unidad":"...","guardias":[{"subida":"AAAA-MM-DD","bajada":"AAAA-MM-DD"}]}` (bajada `null` si aún no se sabe).
3. Cifra: `node herramientas/cifrar-roster.mjs ruta/roster.json roster.pub.json roster.enc.json`
4. Sube `roster.enc.json` a main. La app lo descarga y lo abre sola; solo el celular que tiene la llave privada puede leerlo.

Nunca subas `roster.json`: el repositorio es público.

# La app completa va cifrada

El `index.html` del repositorio es solo un cascarón sin datos: descarga `app.enc.json` y lo abre con la llave privada del celular de Robert. Otro celular solo ve "🔒 App privada".

- La fuente en claro **nunca** se sube aquí. Vive en la carpeta del proyecto: `/mnt/project-files/asistente/fuente/index.html`.
- Para cambiar la app: edita esa fuente y luego `node herramientas/cifrar-app.mjs /mnt/project-files/asistente/fuente/index.html` (escribe `app.enc.json` y sube la versión de `sw.js`). Sube `app.enc.json` y `sw.js`.
- No pongas datos personales en el cascarón, `sw.js`, `manifest.json`, `chistes.json` ni en los mensajes de commit.
