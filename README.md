# GeoTablero

Aplicación web para crear tableros de **indicadores y gráficos** a partir de capas geoespaciales. Tiene usuarios con perfiles de **administrador**, **editor** y **visualizador**, y cada aplicación se abre en su propia página, con un enlace propio.

Autor: Daniel González Baez — Ingeniero de Ejecución en Geomensura, Candidato a Magíster en Teledetección.

## Qué hace

- **Portal** (`index.html`): inicio de sesión, listado de aplicaciones y administración de usuarios.
- **Página de cada aplicación** (`visor.html?app=ID`): mapa con capas, mapas base, dibujo, indicadores y gráficos. Cada aplicación tiene su propio enlace y se puede abrir en otra pestaña.
- **Capas que se pueden agregar**:
  - archivos Shapefile (.zip o sus partes), GeoPackage, File Geodatabase (.gdb comprimida o carpeta), GeoJSON, KML/KMZ, GPX y CSV con lat/lon;
  - servicios ArcGIS Server (MapServer, FeatureServer, ImageServer);
  - servicios WMS y teselas XYZ;
  - capas nuevas vacías para dibujar.
- **Mapas base**: Calles, Claro, Oscuro, Satelital, Satelital con nombres, Topográfico, Relieve, Gris y OpenStreetMap.
- **Indicadores y gráficos** que se recalculan al editar. Se pueden calcular con todas las entidades o solo con las de la extensión visible del mapa.

## Widgets flotantes y modo Diseño

En la página de cada aplicación, el mapa ocupa toda la pantalla y el resto son **widgets flotantes**:

| Widget | Contenido |
|---|---|
| Capas | Lista de capas con visibilidad, zoom, orden, simbología, edición y opacidad (uno por aplicación). El orden se cambia arrastrando el asa ⋮⋮ de cada capa, con Subir y Bajar en el menú ⋯, o con las flechas ↑ ↓ sobre el asa. Las imágenes siempre se dibujan bajo las capas vectoriales. |
| Mapa base | Selector de mapas base (uno por aplicación) |
| Indicador | Un valor calculado: suma, promedio, mínimo, máximo o conteo de un campo |
| Gráfico | Barras, barras horizontales, anillo, torta, línea o histograma |
| Texto | Títulos, notas o fuentes, con negrita y alineación |
| Leyenda | Simbología de las capas visibles (uno por aplicación) |
| Coordenadas | Posición del cursor o de un punto fijado en SIRGAS-Chile 2025: grados decimales, GMS y UTM; copiar e ir a una coordenada escrita |
| Imagen | Logos, fotos o gráficas de apoyo, subidas o por URL, con pie y enlace opcionales |

Editores y administradores ven el botón **Diseñar**. En ese modo:

- Se mueve un widget arrastrando su barra; con las flechas del teclado se ajusta de a 8 px, o de a 32 px con Mayús.
- Se cambia el tamaño arrastrando la esquina inferior derecha.
- Se configura con el ícono de ajustes, y se quita con la ✕.
- Lo que quede minimizado en modo Diseño se abre minimizado para todos.
- Se agregan widgets desde la barra inferior.

Cada widget queda anclado a la esquina más cercana, así que mantiene su lugar si cambia el tamaño de la ventana. La distribución se guarda por aplicación. Los visualizadores pueden minimizar y expandir widgets, pero no moverlos. En celulares, los widgets se muestran apilados debajo del mapa.

## Importar y exportar en distintos sistemas de referencia

GeoTablero usa **GDAL**, el mismo motor de lectura y escritura de QGIS y ArcGIS Pro, compilado para el navegador ([gdal3.js](https://github.com/bugra9/gdal3.js)). Se descarga desde cdn.jsdelivr.net la primera vez que se usa (unos 40 MB) y después queda en la caché del navegador.

**Al agregar una capa** desde Shapefile, GeoPackage, File Geodatabase o un GeoJSON con sistema propio, la app:

1. lista las capas con geometría y muestra el sistema de referencia que trae cada una, con su código EPSG (por ejemplo, *PSAD56 / UTM 19S · EPSG 24879*);
2. si el archivo no indica sistema (un Shapefile sin `.prj`), propone uno según sus coordenadas y te deja elegirlo;
3. transforma las coordenadas a WGS84 para mostrarlas en el mapa, aplicando el traslado de datum oficial cuando corresponde (PSAD56 y SAD69).

**File Geodatabase**: comprime la carpeta `.gdb` en un `.zip` o usa **Elegir una carpeta .gdb**. Se pueden elegir varias capas a la vez.

**Al descargar una capa** (menú ⋯ → Descargar):

| Formato | Notas |
|---|---|
| Shapefile (.zip) | `.shp`, `.dbf`, `.shx`, `.prj` y `.cpg` (UTF-8). Una capa por tipo de geometría si están mezcladas |
| GeoPackage | Un solo archivo `.gpkg` |
| File Geodatabase (.gdb.zip) | Carpeta `.gdb` comprimida, lista para ArcGIS. Una capa por tipo de geometría |
| GeoJSON | En WGS84 sigue el estándar actual; en otro sistema incluye la definición `crs` |
| KMZ | Para Google Earth, siempre en WGS84. Conserva los colores de la simbología |

Sistemas disponibles para descargar:

- SIRGAS-Chile 2025 (UTM 19S, 18S, 12S y geográficas);
- WGS84 (geográficas, UTM 19S, 18S, 17S y 12S, y Web Mercator);
- SIRGAS-Chile 2021, 2016, 2013 y 2002, y SIRGAS 2000;
- PSAD56 y SAD69 en UTM 17S, 18S y 19S.

Por defecto se propone el sistema original de la capa o, si no se conoce, SIRGAS-Chile 2025 en la zona UTM que corresponde. Las transformaciones se verificaron contra PROJ (pyproj) y coinciden al milímetro.

## Borrador, publicación y compartir

**Borrador y publicación**: lo que cambian editores y administradores no se publica solo.

- **Guardar borrador** (o `Ctrl + S`) guarda los cambios sin que los vean los visualizadores.
- **Publicar** hace visible la versión actual para todas las personas con acceso.
- El botón ↺ descarta el borrador y vuelve a la versión publicada.
- Al salir con cambios sin guardar, la aplicación pregunta si guardarlos como borrador.
- En el portal, la tarjeta marca **Borrador sin publicar** cuando corresponde.
- Las ediciones que se guardan en una base de datos (Supabase o PostgREST) quedan en la base de inmediato, igual que antes.

**Compartir** (administradores y creador de la aplicación), desde la tarjeta o desde la cabecera:

| Nivel | Quién la ve |
|---|---|
| Privada | Su creador, los administradores y quienes tengan un perfil asignado en Accesos |
| Organización | Cualquier usuario con cuenta en GeoTablero, como visualizador. Los editores se siguen asignando en Accesos |
| Pública | Cualquier persona con el enlace, sin iniciar sesión. También aparece en la pantalla de acceso |

## Personalizar el diseño

En modo **Diseñar**:

- **Tema** de la aplicación:
  - temas listos (Verde, Azul institucional, Grafito, Arena, Emergencia y Noche) o un color principal propio;
  - cabecera clara, de color u oscura;
  - esquinas, widgets translúcidos y modo oscuro;
  - el nombre visible en la cabecera.
- **Apariencia** de cada widget (ícono de pincel):
  - título, fondo y opacidad, color de texto y barra de título de color;
  - borde, sombra y esquinas.
- **Indicadores**:
  - número completo (3.647.764), en millones o abreviado, con los decimales que elijas;
  - prefijo y sufijo;
  - texto bajo el número (ninguno, el detalle del cálculo o un texto propio);
  - tamaño, alineación y color del número. El número se ajusta solo al ancho del widget.
- **Gráficos**:
  - colores automáticos, un solo color, una rampa o los colores de la simbología de la capa;
  - orden, cantidad de categorías (con "Otros") y etiquetas de valor;
  - leyenda, cuadrícula y detalle del cálculo bajo el título.

## Coordenadas

Todas las coordenadas se muestran en **SIRGAS-Chile 2025**, la Red Geodésica Nacional del IGM (época de referencia 2025.0, elipsoide GRS 1980).

En la cabecera, el recuadro de coordenadas muestra la posición del cursor. Al hacer clic se elige el formato:

| Formato | EPSG |
|---|---|
| Grados decimales | 11473 |
| Grados, minutos y segundos | 11473 |
| UTM | 11474 (zona 12S, Rapa Nui), 11475 (18S) y 11476 (19S) |

La zona UTM se calcula sola.

El widget **Coordenadas**:
- muestra los tres formatos a la vez;
- fija un punto con un clic;
- copia cada formato;
- **va a una coordenada escrita**, por ejemplo `-33.4489, -70.6693`, `33°26′56″S 70°40′09″O` o `19S 346512 6297123`. Si la coordenada UTM no trae zona, se usa la que elijas.

Los mapas base y la mayoría de los servicios web entregan sus datos en WGS84 / Web Mercator. GeoTablero los toma como coincidentes con SIRGAS-Chile 2025, porque la diferencia es de pocos centímetros, menor que la precisión de un visor web. Para levantamientos precisos usa las herramientas del IGM. Los cálculos UTM se verificaron con PROJ (pyproj) y coinciden al milímetro.

## Simbología

Editores y administradores abren la simbología con el ícono de paleta de cada capa. Los cambios se ven en vivo sobre el mapa; **Cancelar** los descarta.

**Capas vectoriales** (archivos, ArcGIS, bases de datos y capas dibujadas)

- **Símbolo único**: un color para toda la capa.
- **Por categorías**: un color por valor de un campo (hasta 40 valores). Se puede cambiar el color de cada categoría.
- **Por rangos**: clases de un campo numérico, de 2 a 9 clases, con cortes naturales (Jenks), cuantiles o intervalos iguales.
- Rampas de color: categórica, verdes, azules, naranjos, rojos, verde a rojo, espectral, viridis y magma, con opción de invertir.
- Opacidad del relleno, color y grosor del contorno, tipo de línea (continua, guiones, puntos) y tamaño de punto.
- **Etiquetas** con el valor de cualquier campo, en tres tamaños.
- La leyenda aparece bajo cada capa y en el widget **Leyenda**. Los gráficos agrupados por el mismo campo usan los mismos colores de las categorías.

**Servicios de imágenes (ArcGIS ImageServer)**

- **Render del servidor**, **estirado de histograma** (recorte por porcentaje, desviación estándar o mínimo–máximo, con gamma y DRA), **índice NDVI** con paleta, o **funciones ráster** publicadas en el servidor.
- **Combinación de bandas** con presets según la cantidad de bandas:
  - WorldView de 8 bandas: color natural 5-3-2 y falso color 7-5-3.
  - Imágenes de 4 bandas (B, G, R, NIR): 3-2-1 y 4-3-2.
  - También se puede armar una combinación personalizada.

**Cualquier capa ráster** (ImageServer, MapServer, WMS, XYZ): opacidad, brillo, contraste, saturación y escala de grises.

## Conexión a PostGIS

Un navegador no puede conectarse directo a PostgreSQL (usa un protocolo TCP propio y la contraseña quedaría visible en la página). Por eso GeoTablero se conecta a PostGIS a través de un servicio HTTP, igual que ArcGIS o QGIS Web:

| Tipo de conexión | Qué es | Lectura | Escritura |
|---|---|---|---|
| **Supabase** | PostgreSQL + PostGIS en la nube, con API REST incluida | Sí | Sí |
| **PostgREST** | API REST sobre tu propio PostgreSQL/PostGIS | Sí | Sí |
| **OGC API Features** | pg_featureserv, pygeoapi o GeoServer (OGC API) sobre PostGIS | Sí | No |
| **WFS** | GeoServer o MapServer con un almacén PostGIS | Sí | No |

**Cómo se usa**

1. En el portal, un administrador entra a **Conexiones**, crea la conexión y la prueba.
2. En una aplicación, un editor va a **Capa → Base de datos**, elige la conexión y la tabla, y opcionalmente:
   - agrega un filtro;
   - define un máximo de entidades;
   - activa la actualización automática (1, 5, 15 o 60 minutos);
   - con Supabase o PostgREST, y si la tabla tiene clave primaria, marca **Guardar las ediciones en la base de datos**.
3. Al abrir la aplicación, las capas de base de datos se vuelven a leer, así que los indicadores y gráficos muestran datos al día. Cada capa tiene un botón para recargarla a mano.

**Edición en la base** (Supabase y PostgREST): dibujar crea un registro, mover o editar vértices actualiza la geometría, el formulario actualiza los atributos y eliminar borra el registro. La geometría se envía como EWKT en EPSG:4326.

**Requisitos de la tabla**

- Columna `geometry` en **EPSG:4326**. Si tu tabla está en UTM, crea una vista: `create view zonas_4326 as select id, nombre, st_transform(geom, 4326) as geom from zonas;`
- PostGIS 3 o superior (entrega la geometría como GeoJSON).
- Una clave primaria, si quieres guardar ediciones.
- En Supabase: políticas **RLS** que permitan `select` y, para editar, `insert`, `update` y `delete`.

**Ejemplo mínimo en Supabase (SQL Editor)**

```sql
create extension if not exists postgis;
create table zonas (
  id bigint generated always as identity primary key,
  nombre text, estado text, superficie_ha numeric,
  geom geometry(MultiPolygon, 4326)
);
alter table zonas enable row level security;
create policy "leer" on zonas for select using (true);
-- Solo si quieres que la app escriba (ajusta a tus necesidades):
create policy "editar" on zonas for all using (true) with check (true);
```

**Seguridad**

- Usa siempre la clave **pública** (anon o publishable). GeoTablero rechaza las claves `service_role` o `sb_secret_`, porque darían acceso total a la base a cualquiera que abra la página.
- Quien controla lo que se puede leer o escribir son las políticas RLS de la base, no la página.
- Las conexiones se incluyen en el archivo exportado. Es normal para una clave pública, pero no subas tokens privados de PostgREST a un repositorio público.

## Perfiles

| Perfil | Qué puede hacer |
|---|---|
| Administrador | Crear, editar, duplicar y eliminar aplicaciones y usuarios. Asignar accesos. Entrar a todas las aplicaciones con permisos de edición. |
| Editor | En las aplicaciones asignadas: agregar y quitar capas, dibujar, editar atributos y crear indicadores y gráficos. |
| Visualizador | En las aplicaciones asignadas: consultar el mapa, las capas, los indicadores y los gráficos sin modificarlos. |

Los perfiles de editor y visualizador se asignan **por aplicación**: un mismo usuario puede editar una aplicación y solo ver otra.

### Cuentas de demostración

Se crean automáticamente la primera vez que se abre el sitio en un navegador (si no hay `data/geotablero.json` publicado):

| Usuario | Contraseña | Perfil |
|---|---|---|
| `admin` | `admin123` | Administrador |
| `editor` | `editor123` | Editor de la aplicación de ejemplo |
| `visor` | `visor123` | Visualizador de la aplicación de ejemplo |

## Publicar en GitHub Pages

La guía paso a paso, con los nombres exactos de cada menú y solución de problemas, está en [GUIA_GITHUB.md](GUIA_GITHUB.md). En resumen:

1. Crea un repositorio nuevo en GitHub, por ejemplo `geotablero`.
2. Sube **el contenido** de esta carpeta a la raíz del repositorio. Desde la web: *Add file → Upload files*, arrastra los archivos y carpetas y confirma con *Commit changes*.
3. En el repositorio, entra a *Settings → Pages*. En *Build and deployment* elige *Deploy from a branch*, rama `main`, carpeta `/ (root)` y guarda.
4. En uno o dos minutos el sitio queda en `https://TU_USUARIO.github.io/geotablero/`.

El enlace de cada aplicación queda así: `https://TU_USUARIO.github.io/geotablero/visor.html?app=ID`. Si alguien abre ese enlace sin haber iniciado sesión, primero se le pide entrar y luego llega directo a la aplicación.

## Dónde se guardan los datos

En esta versión **no hay servidor**: usuarios, aplicaciones y capas se guardan en el navegador de cada persona (IndexedDB). Por eso:

- Lo que crees en tu computador no aparece automáticamente en el de otra persona.
- Para que todos partan con las mismas aplicaciones y usuarios:
  1. Entra como administrador y ve a **Usuarios → Exportar**. Se descarga `geotablero.json`.
  2. Sube ese archivo a la carpeta `data/` del repositorio, reemplazando el anterior si existe.
  3. Quien abra el sitio por primera vez carga esos datos. Quien ya lo había abierto puede usar **Usuarios → Cargar datos publicados**.

## Advertencias de seguridad

Esta versión sirve para demostrar y validar el flujo, **no para proteger datos sensibles**:

- Los permisos se aplican en la interfaz; alguien con conocimientos técnicos puede saltárselos desde la consola del navegador.
- Si publicas `data/geotablero.json` en un repositorio **público**, cualquiera puede ver la lista de usuarios, las contraseñas cifradas (SHA-256) y el contenido de las aplicaciones. No uses contraseñas reales.
- Si una capa de ArcGIS usa **token**, ese token queda dentro del archivo exportado. No lo subas a un repositorio público.

Para uso real, el siguiente paso es conectar un servicio con autenticación y base de datos (por ejemplo, Supabase) que valide los permisos en el servidor.

## Mapas base

Los mapas base vienen de tres proveedores: CARTO (Calles, Claro, Oscuro), OpenStreetMap (el mapa estándar de openstreetmap.org) y Esri (Satelital, Satelital con nombres, Topográfico, Relieve, Gris). OpenStreetMap exige que la página se abra desde un sitio web, como GitHub Pages; abriendo el archivo con doble clic puede no cargar. Si uno no responde, GeoTablero cambia solo a otro proveedor y lo avisa; el botón del que falló queda marcado como "sin respuesta".

Si **ninguno** carga:

- Revisa la conexión a internet.
- Algunas redes institucionales bloquean estos servidores. Desde un navegador de esa red, prueba abrir `https://a.basemaps.cartocdn.com/rastertiles/voyager/0/0/0.png` `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/0/0/0` y `https://tile.openstreetmap.org/0/0/0.png`. Si no se ven, pide a soporte que habilite `*.basemaps.cartocdn.com`, `server.arcgisonline.com` y `tile.openstreetmap.org`.
- Mientras tanto, puedes agregar como capa un servicio de mapas interno (WMS, XYZ o ArcGIS MapServer) desde **Capa → WMS / URL** o **ArcGIS Server**.

## Probar en tu computador

Abrir `index.html` con doble clic funciona, pero algunos servicios (OpenStreetMap, ciertos ArcGIS) rechazan páginas abiertas como archivo local, y la carga de `data/geotablero.json` solo funciona desde un servidor. Para probar como en GitHub Pages:

```bash
cd geotablero
python -m http.server 8000
```

y abre `http://localhost:8000`.

## Estructura

```
index.html        Portal: acceso, aplicaciones y usuarios
visor.html        Página de cada aplicación (?app=ID)
css/estilos.css   Estilos compartidos (tema claro y oscuro)
js/comun.js       Utilidades, almacenamiento, sesión y datos de ejemplo
js/portal.js      Lógica del portal
js/visor.js       Mapa, capas, widgets, dibujo, indicadores y gráficos
js/basedatos.js   Conexiones a PostGIS (Supabase, PostgREST, OGC API, WFS)
js/simbologia.js  Rampas de color, clasificación y reglas de renderizado de imágenes
js/coordenadas.js Proyección UTM en SIRGAS-Chile 2025
js/gdalio.js      Importar y exportar Shapefile, GeoPackage, File Geodatabase, KMZ y GeoJSON con GDAL, GMS y lectura de coordenadas
data/             Aquí va geotablero.json si quieres publicar datos
```

## Librerías

[Leaflet](https://leafletjs.com) · [Leaflet-Geoman](https://geoman.io) · [Esri Leaflet](https://developers.arcgis.com/esri-leaflet/) · [Chart.js](https://www.chartjs.org) · [Turf.js](https://turfjs.org) · [shpjs](https://github.com/calvinmetcalf/shapefile-js) · [togeojson](https://github.com/placemark/togeojson) · [Papa Parse](https://www.papaparse.com) · [gdal3.js](https://github.com/bugra9/gdal3.js) · [JSZip](https://stuk.github.io/jszip/). Se cargan desde CDN, así que no hay que instalar nada.
