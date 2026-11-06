# GeoTablero

Aplicación web para crear tableros de **indicadores y gráficos** a partir de capas geoespaciales. Tiene usuarios con perfiles de **administrador**, **editor** y **visualizador**, y cada aplicación se abre en su propia página, con un enlace propio.

Autor: Daniel González Baez — Ingeniero de Ejecución en Geomensura, Candidato a Magíster en Teledetección.

## Qué hace

- **Portal** (`index.html`): inicio de sesión, listado de aplicaciones y administración de usuarios.
- **Página de cada aplicación** (`visor.html?app=ID`): mapa con capas, mapas base, dibujo, indicadores y gráficos. Cada aplicación tiene su propio enlace y se puede abrir en otra pestaña.
- **Capas que se pueden agregar**:
  - archivos GeoJSON, KML, GPX, Shapefile (.zip) y CSV con lat/lon;
  - servicios ArcGIS Server (MapServer, FeatureServer, ImageServer);
  - servicios WMS y teselas XYZ;
  - capas nuevas vacías para dibujar.
- **Mapas base**: Calles, Claro, Oscuro, Satelital, Satelital con nombres, Topográfico, Relieve, Gris y OpenStreetMap.
- **Indicadores y gráficos** que se recalculan al editar. Se pueden calcular con todas las entidades o solo con las de la extensión visible del mapa.

## Widgets flotantes y modo Diseño

En la página de cada aplicación, el mapa ocupa toda la pantalla y el resto son **widgets flotantes**:

| Widget | Contenido |
|---|---|
| Capas | Lista de capas con visibilidad, zoom, edición y opacidad (uno por aplicación) |
| Mapa base | Selector de mapas base (uno por aplicación) |
| Indicador | Un valor calculado: suma, promedio, mínimo, máximo o conteo de un campo |
| Gráfico | Barras, barras horizontales, anillo, torta, línea o histograma |
| Texto | Títulos, notas o fuentes, con negrita y alineación |
| Leyenda | Simbología de las capas visibles (uno por aplicación) |

Editores y administradores ven el botón **Diseñar**. En ese modo:

- Se mueve un widget arrastrando su barra; con las flechas del teclado se ajusta de a 8 px, o de a 32 px con Mayús.
- Se cambia el tamaño arrastrando la esquina inferior derecha.
- Se configura con el ícono de ajustes, y se quita con la ✕.
- Lo que quede minimizado en modo Diseño se abre minimizado para todos.
- Se agregan widgets desde la barra inferior.

Cada widget queda anclado a la esquina más cercana, así que mantiene su lugar si cambia el tamaño de la ventana. La distribución se guarda por aplicación. Los visualizadores pueden minimizar y expandir widgets, pero no moverlos. En celulares, los widgets se muestran apilados debajo del mapa.

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
data/             Aquí va geotablero.json si quieres publicar datos
```

## Librerías

[Leaflet](https://leafletjs.com) · [Leaflet-Geoman](https://geoman.io) · [Esri Leaflet](https://developers.arcgis.com/esri-leaflet/) · [Chart.js](https://www.chartjs.org) · [Turf.js](https://turfjs.org) · [shpjs](https://github.com/calvinmetcalf/shapefile-js) · [togeojson](https://github.com/placemark/togeojson) · [Papa Parse](https://www.papaparse.com). Se cargan desde CDN, así que no hay que instalar nada.
