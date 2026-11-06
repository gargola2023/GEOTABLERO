# Guía rápida: publicar GeoTablero en GitHub

Tiempo estimado: 10 minutos. No hace falta instalar nada: todo se hace desde la web de GitHub.

## 1. Crear el repositorio

1. Entra a [github.com](https://github.com) con tu cuenta.
2. Arriba a la derecha: **+ → New repository**.
3. **Repository name**: `geotablero` (u otro nombre corto, sin espacios).
4. Elige la visibilidad:
   - **Public**: GitHub Pages funciona en cualquier plan gratuito.
   - **Private**: GitHub Pages solo funciona con un plan pagado (Pro, Team o Enterprise).
5. No marques "Add a README", porque el proyecto ya trae uno.
6. Presiona **Create repository**.

## 2. Subir los archivos

1. Descomprime `geotablero.zip` en tu computador.
2. En el repositorio recién creado, haz clic en **uploading an existing file**, o en **Add file → Upload files**.
3. Abre la carpeta `geotablero` y arrastra **todo su contenido** a la página:
   - `index.html`, `visor.html`, `README.md`, `GUIA_GITHUB.md`, `.nojekyll`
   - las carpetas `css`, `js` y `data`

   Arrastra los archivos que están **dentro** de la carpeta, no la carpeta misma. Si la subes entera, el sitio queda en `…/geotablero/geotablero/` y no carga.
4. El archivo `.nojekyll` está oculto en Windows y macOS. Para verlo:
   - en macOS, presiona `Cmd + Shift + .` en el Finder;
   - en Windows, activa *Vista → Elementos ocultos*.

   Si no se sube, el sitio funciona igual.
5. Abajo, en **Commit changes**, escribe "Primera versión" y presiona **Commit changes**.

## 3. Activar GitHub Pages

1. En el repositorio: **Settings → Pages** (menú izquierdo).
2. En **Build and deployment → Source**, elige **Deploy from a branch**.
3. En **Branch**, elige `main` y la carpeta `/ (root)`, y presiona **Save**.
4. Espera de 1 a 2 minutos y recarga la página de Settings → Pages. Aparecerá:
   **Your site is live at `https://TU_USUARIO.github.io/geotablero/`**

## 4. Probar

1. Abre la dirección del sitio.
2. Entra con `admin` / `admin123`.
3. Abre la aplicación de ejemplo y comprueba que carguen el mapa base y los widgets.
4. Crea tus usuarios reales en **Usuarios** y cambia o elimina las cuentas de demostración.

## 5. Publicar tus aplicaciones para todos

Las aplicaciones y usuarios se guardan en el navegador de quien los crea. Para que otras personas los vean:

1. En el portal, como administrador: **Usuarios → Exportar**. Se descarga `geotablero.json`.
2. En GitHub, entra a la carpeta `data` → **Add file → Upload files** → sube `geotablero.json` → **Commit changes**.
3. Quien abra el sitio por primera vez carga esos datos automáticamente. Quien ya lo había abierto usa **Usuarios → Cargar datos publicados**.

Repite estos pasos cada vez que quieras publicar cambios.

## 6. Actualizar a una versión nueva de GeoTablero

1. **Add file → Upload files** y arrastra los archivos nuevos. GitHub reemplaza los que tienen el mismo nombre.
2. **Commit changes**. Pages se actualiza solo en 1 o 2 minutos.
3. Si no ves los cambios, recarga sin caché: `Ctrl + F5` en Windows o `Cmd + Shift + R` en macOS.

## Antes de publicar: seguridad

- En un repositorio **público**, cualquiera puede leer `data/geotablero.json`: usuarios, contraseñas cifradas, conexiones y datos de las capas. No uses contraseñas reales ni subas datos sensibles.
- No subas tokens de ArcGIS ni tokens privados de PostgREST. La clave pública (anon o publishable) de Supabase sí puede ir, siempre que las tablas tengan políticas RLS.
- Esta versión no tiene servidor propio, así que los permisos protegen la interfaz pero no los datos. Para información restringida del SAF, usa servicios con autenticación propia (portal ArcGIS o Supabase con RLS).

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| Error 404 al abrir el sitio | Pages aún no termina, o los archivos quedaron dentro de una subcarpeta. Revisa que `index.html` esté en la raíz del repositorio. |
| La página carga sin estilos | Falta la carpeta `css`, o se subió con otro nombre. |
| No aparecen mis aplicaciones en otro computador | Es lo esperado: expórtalas a `data/geotablero.json` (paso 5). |
| Un mapa base no carga | El proveedor bloqueó la solicitud. Cambia de mapa base; en GitHub Pages, OpenStreetMap funciona. |
| Un servicio ArcGIS o PostGIS no responde | El servidor debe permitir solicitudes desde `https://TU_USUARIO.github.io` (CORS). Pídeselo al administrador del servidor. |

## Alternativa con Git (para quien ya lo usa)

```bash
cd geotablero
git init
git add .
git commit -m "Primera versión"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/geotablero.git
git push -u origin main
```

Después, activa Pages como en el paso 3.
