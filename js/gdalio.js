/* =================================================================
   GeoTablero · lectura y escritura de formatos geoespaciales con GDAL
   (gdal3.js, GDAL compilado a WebAssembly). Se descarga solo la
   primera vez que se usa (unos 40 MB) y queda en la caché del navegador.

   Lee:     Shapefile (.zip o archivos sueltos), GeoPackage (.gpkg),
            File Geodatabase (.gdb comprimida o carpeta), GeoJSON con
            sistema propio.
   Escribe: GeoJSON, KMZ, Shapefile, GeoPackage y File Geodatabase,
            en el sistema de referencia que se elija.
   ================================================================= */
'use strict';

const GDAL_CDN = 'https://cdn.jsdelivr.net/npm/gdal3.js@2.8.1/dist/package';
const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

function loadScriptOnce(src){
  return new Promise((res, rej) => {
    if ([...document.scripts].some(s => s.src === src)) return res();
    const s = document.createElement('script'); s.src = src;
    s.onload = res; s.onerror = () => rej(new Error('No se pudo descargar un componente necesario (' + src.split('/').pop() + '). Revisa la conexión o si tu red bloquea cdn.jsdelivr.net.'));
    document.head.append(s);
  });
}
let gdalPromise = null;
function loadGdal(onStatus){
  if (gdalPromise) return gdalPromise;
  gdalPromise = (async () => {
    const base = window.GT_GDAL_PATH || GDAL_CDN;
    if (!window.initGdalJs){ onStatus && onStatus('Descargando GDAL (unos 40 MB, solo la primera vez)…'); await loadScriptOnce(base + '/gdal3.js'); }
    onStatus && onStatus('Iniciando GDAL…');
    return window.initGdalJs({ path: base, useWorker: false });
  })();
  gdalPromise.catch(() => { gdalPromise = null; });
  return gdalPromise;
}
async function loadJSZip(){ if (!window.JSZip) await loadScriptOnce(window.GT_JSZIP_PATH || JSZIP_CDN); return window.JSZip; }

/* ---------- Catálogo de sistemas de referencia ---------- */
const SIRGAS25_UTM = { 12: 11474, 18: 11475, 19: 11476 };
function sirgas2025Wkt(zone){
  const geog = 'GEOGCS["SIRGAS-Chile 2025",DATUM["SIRGAS-Chile_2025",SPHEROID["GRS 1980",6378137,298.257222101],TOWGS84[0,0,0,0,0,0,0]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]';
  if (!zone) return geog + ',AXIS["Latitude",NORTH],AXIS["Longitude",EAST],AUTHORITY["EPSG","11473"]]';
  return `PROJCS["SIRGAS-Chile 2025 / UTM zone ${zone}S",${geog}],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",${(zone - 1) * 6 - 180 + 3}],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1],AXIS["Easting",EAST],AXIS["Northing",NORTH],AUTHORITY["EPSG","${SIRGAS25_UTM[zone]}"]]`;
}
const CRS_CATALOG = [
  { group:'SIRGAS-Chile 2025 (IGM, vigente)', items:[
    { id:'S25:19', epsg:11476, name:'SIRGAS-Chile 2025 / UTM 19S', utm:19 },
    { id:'S25:18', epsg:11475, name:'SIRGAS-Chile 2025 / UTM 18S', utm:18 },
    { id:'S25:12', epsg:11474, name:'SIRGAS-Chile 2025 / UTM 12S (Rapa Nui)', utm:12 },
    { id:'S25:geo', epsg:11473, name:'SIRGAS-Chile 2025 / geográficas' } ] },
  { group:'WGS84', items:[
    { id:'EPSG:4326', epsg:4326, name:'WGS84 / geográficas' },
    { id:'EPSG:32719', epsg:32719, name:'WGS84 / UTM 19S', utm:19 },
    { id:'EPSG:32718', epsg:32718, name:'WGS84 / UTM 18S', utm:18 },
    { id:'EPSG:32717', epsg:32717, name:'WGS84 / UTM 17S', utm:17 },
    { id:'EPSG:32712', epsg:32712, name:'WGS84 / UTM 12S', utm:12 },
    { id:'EPSG:3857', epsg:3857, name:'WGS84 / Web Mercator' } ] },
  { group:'SIRGAS-Chile anteriores', items:[
    { id:'EPSG:20049', epsg:20049, name:'SIRGAS-Chile 2021 / UTM 19S' },
    { id:'EPSG:20048', epsg:20048, name:'SIRGAS-Chile 2021 / UTM 18S' },
    { id:'EPSG:9155', epsg:9155, name:'SIRGAS-Chile 2016 / UTM 19S' },
    { id:'EPSG:9154', epsg:9154, name:'SIRGAS-Chile 2016 / UTM 18S' },
    { id:'EPSG:9150', epsg:9150, name:'SIRGAS-Chile 2013 / UTM 19S' },
    { id:'EPSG:9149', epsg:9149, name:'SIRGAS-Chile 2013 / UTM 18S' },
    { id:'EPSG:5361', epsg:5361, name:'SIRGAS-Chile 2002 / UTM 19S' },
    { id:'EPSG:5362', epsg:5362, name:'SIRGAS-Chile 2002 / UTM 18S' },
    { id:'EPSG:31979', epsg:31979, name:'SIRGAS 2000 / UTM 19S' },
    { id:'EPSG:31978', epsg:31978, name:'SIRGAS 2000 / UTM 18S' },
    { id:'EPSG:4674', epsg:4674, name:'SIRGAS 2000 / geográficas' } ] },
  { group:'Datums antiguos (requieren traslado)', items:[
    { id:'EPSG:24879', epsg:24879, name:'PSAD56 / UTM 19S' },
    { id:'EPSG:24878', epsg:24878, name:'PSAD56 / UTM 18S' },
    { id:'EPSG:24877', epsg:24877, name:'PSAD56 / UTM 17S' },
    { id:'EPSG:29189', epsg:29189, name:'SAD69 / UTM 19S' },
    { id:'EPSG:29188', epsg:29188, name:'SAD69 / UTM 18S' } ] }
];
const CRS_BY_ID = Object.fromEntries(CRS_CATALOG.flatMap(g => g.items).map(c => [c.id, c]));
const crsByEpsg = code => CRS_CATALOG.flatMap(g => g.items).find(c => c.epsg === +code) || null;
const normCrs = s => String(s || '').toLowerCase().replace(/gcs|zone|zona|geograficas|[\s_\-/.]/g, '');
function crsByName(name){
  const n = normCrs(name);
  return CRS_CATALOG.flatMap(g => g.items).find(c => normCrs(c.name) === n) || null;
}
const srsArg = id => id.startsWith('S25:') ? sirgas2025Wkt(id === 'S25:geo' ? null : +id.split(':')[1]) : id;
function fillCrsSelect(sel, value){
  sel.innerHTML = '';
  CRS_CATALOG.forEach(g => {
    const og = document.createElement('optgroup'); og.label = g.group;
    g.items.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.name} · EPSG ${c.epsg}`; og.append(o); });
    sel.append(og);
  });
  if (value && CRS_BY_ID[value]) sel.value = value;
}
/* Sistema sugerido para exportar: SIRGAS-Chile 2025 en la zona UTM del centro de la capa */
function suggestCrs(fc){
  let sx = 0, n = 0;
  (fc.features || []).slice(0, 500).forEach(f => { const c = f.geometry && firstLonLat(f.geometry); if (c){ sx += c[0]; n++; } });
  if (!n) return 'S25:19';
  const lon = sx / n, z = Math.floor((lon + 180) / 6) + 1;
  return SIRGAS25_UTM[z] ? 'S25:' + z : 'S25:geo';
}
function firstLonLat(g){
  if (!g) return null;
  if (g.type === 'GeometryCollection') return firstLonLat(g.geometries[0]);
  let c = g.coordinates; while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) ? c : null;
}

/* Describe el sistema de un campo geométrico de ogrinfo -json */
function describeCrs(cs){
  if (!cs || (!cs.wkt && !cs.projjson)) return null;
  const pj = cs.projjson || {};
  let code = pj.id && pj.id.authority === 'EPSG' ? pj.id.code : null;
  if (!code && cs.wkt){ const m = cs.wkt.match(/(?:AUTHORITY\["EPSG",\s*"?|ID\["EPSG",\s*)(\d+)"?\]\]?\s*$/); if (m) code = +m[1]; }
  const name = pj.name || (cs.wkt.match(/^\w+\["([^"]+)"/) || [])[1] || 'Sistema sin nombre';
  // Los .prj de estilo Esri no traen código: se reconoce el sistema por su nombre
  const known = (code ? crsByEpsg(code) : null) || crsByName(name);
  if (!code && known) code = known.epsg;
  const isGeog = /^\s*(GEOGCS|GEOGCRS)/.test(cs.wkt || '') || pj.type === 'GeographicCRS';
  return { name: known ? known.name : name, epsg: code, wkt: cs.wkt, geographic: isGeog, isWgs84: code === 4326 || /^WGS ?84$/i.test(name) };
}

/* ---------- Abrir archivos ---------- */
const GDAL_EXT = /\.(shp|dbf|shx|prj|cpg|qpj|sbn|sbx|gpkg|zip|gdbtable|gdbtablx|gdbindexes|spx|freelist|atx|horizon)$/i;
let gdalInN = 0;
/* Cada importación usa nombres propios: GDAL guarda en memoria los archivos ya abiertos */
const withPrefix = (blob, name, pre) => new File([blob], pre + name);
async function prepareInputs(files){
  files = [...files];
  const pre = `in${++gdalInN}_`;
  const JSZip = await loadJSZip();
  // Carpeta .gdb elegida con el selector de carpetas: se comprime en memoria como .gdb.zip
  if (files.some(f => f.webkitRelativePath && /\.gdb\//i.test(f.webkitRelativePath))){
    const z = new JSZip(); let gdbName = 'datos.gdb';
    files.forEach(f => { const p = f.webkitRelativePath; const m = p.match(/([^/]+\.gdb)\/(.*)$/i); if (m){ gdbName = m[1]; z.file(`${m[1]}/${m[2]}`, f); } });
    const blob = await z.generateAsync({ type:'blob', compression:'STORE' });
    return { kind:'gdb', label: gdbName, pre, inputs: [new File([blob], pre + gdbName + '.zip')] };
  }
  if (files.length === 1 && /\.zip$/i.test(files[0].name)){
    const f = files[0], zip = await JSZip.loadAsync(f), names = Object.keys(zip.files);
    const gdbDir = names.map(n => (n.match(/^(?:.*\/)?([^/]+\.gdb)\//i) || [])[0]).find(Boolean);
    if (gdbDir){
      // Se reempaqueta con la .gdb en la raíz, que es lo que espera GDAL
      const root = gdbDir.replace(/\/$/, ''), base = root.split('/').pop(), z = new JSZip();
      await Promise.all(names.filter(n => n.startsWith(gdbDir) && !zip.files[n].dir).map(async n => z.file(base + '/' + n.slice(gdbDir.length), await zip.files[n].async('uint8array'))));
      const blob = await z.generateAsync({ type:'blob', compression:'STORE' });
      return { kind:'gdb', label: base, pre, inputs: [new File([blob], pre + base + '.zip')] };
    }
    const gpkg = names.find(n => /\.gpkg$/i.test(n));
    if (gpkg && !names.some(n => /\.shp$/i.test(n))) return { kind:'gpkg', label: gpkg, pre, inputs: [withPrefix(await zip.files[gpkg].async('blob'), gpkg.split('/').pop(), pre)] };
    if (!names.some(n => /\.shp$/i.test(n))) throw new Error('El .zip no contiene un Shapefile, un GeoPackage ni una File Geodatabase (.gdb).');
    // Shapefile(s): se extraen todas sus partes
    const parts = await Promise.all(names.filter(n => !zip.files[n].dir && /\.(shp|shx|dbf|prj|cpg|qpj)$/i.test(n) && !/__MACOSX/.test(n))
      .map(async n => withPrefix(await zip.files[n].async('blob'), n.split('/').pop(), pre)));
    return { kind:'shp', label: f.name, pre, inputs: parts };
  }
  if (files.every(f => GDAL_EXT.test(f.name))){
    const ren = files.map(f => withPrefix(f, f.name, pre));
    if (files.some(f => /\.gpkg$/i.test(f.name))) return { kind:'gpkg', label: files[0].name, pre, inputs: ren };
    if (files.some(f => /\.shp$/i.test(f.name))) return { kind:'shp', label: files.find(f => /\.shp$/i.test(f.name)).name, pre, inputs: ren };
  }
  if (files.length === 1 && /\.(geojson|json)$/i.test(files[0].name)) return { kind:'geojson', label: files[0].name, pre, inputs: [withPrefix(files[0], files[0].name, pre)] };
  throw new Error('Para Shapefile elige el .zip o todas sus partes juntas (.shp, .dbf, .shx y .prj).');
}

/* Analiza los archivos: capas, cantidad de entidades, geometría y sistema de referencia */
async function gdalAnalyze(files, onStatus){
  const Gdal = await loadGdal(onStatus);
  onStatus && onStatus('Leyendo los archivos…');
  const prep = await prepareInputs(files);
  const opened = await runGdal(() => Gdal.open(prep.inputs.length === 1 ? prep.inputs[0] : prep.inputs));
  const datasets = opened.datasets || [];
  if (!datasets.length) throw new Error('GDAL no reconoció los archivos como datos vectoriales. ' + (opened.errors || []).map(e => e.message || e).join(' '));
  const layers = [];
  for (const ds of datasets){
    const info = await runGdal(() => Gdal.ogrinfo(ds, ['-json', '-so', '-al']));
    (info.layers || []).forEach(l => {
      const gf = (l.geometryFields || [])[0];
      if (!gf) return;   // tablas sin geometría
      layers.push({ ds, name: l.name, title: l.name.replace(prep.pre, ''), count: l.featureCount, geomType: gf.type, crs: describeCrs(gf.coordinateSystem), extent: gf.extent || null });
    });
  }
  if (!layers.length) throw new Error('Los archivos no tienen capas con geometría.');
  return { kind: prep.kind, label: prep.label, layers, datasets, Gdal };
}
let gdalOutN = 0;
/* Convierte una capa a GeoJSON en WGS84 para el mapa. srcOverride: sistema elegido si el archivo no trae uno */
async function gdalLayerToWgs84(an, layer, srcOverride){
  const opts = ['-f', 'GeoJSON', '-t_srs', 'EPSG:4326', '-lco', 'RFC7946=YES'];
  if (srcOverride) opts.push('-s_srs', srsArg(srcOverride));
  opts.push(layer.name);
  const out = await runGdal(() => an.Gdal.ogr2ogr(layer.ds, opts, 'imp' + (++gdalOutN)));
  const txt = new TextDecoder().decode(await an.Gdal.getFileBytes(out.local || out));
  return JSON.parse(txt);
}
function gdalClose(an){ try { an.datasets.forEach(d => an.Gdal.close(d)); } catch {} }

/* Adivina el sistema de un conjunto de coordenadas sin definición */
function guessCrsFromExtent(ext){
  if (!ext || ext.length < 4) return 'EPSG:4326';
  const [x0, y0, x1, y1] = ext;
  const deg = Math.abs(x0) <= 180 && Math.abs(x1) <= 180 && Math.abs(y0) <= 90 && Math.abs(y1) <= 90;
  if (deg) return 'EPSG:4326';
  if (x0 > 100000 && x1 < 900000 && y0 > 1000000 && y1 < 10000000) return 'S25:19';
  return 'S25:19';
}

/* ---------- Exportar ---------- */
const EXPORT_FORMATS = {
  geojson: { name:'GeoJSON', ext:'.geojson', driver:'GeoJSON' },
  kmz:     { name:'KMZ (Google Earth)', ext:'.kmz', driver:'KML', wgs84Only:true },
  shp:     { name:'Shapefile (.zip)', ext:'.zip', driver:'ESRI Shapefile', oneType:true },
  gpkg:    { name:'GeoPackage', ext:'.gpkg', driver:'GPKG' },
  gdb:     { name:'File Geodatabase (.gdb.zip)', ext:'.gdb.zip', driver:'OpenFileGDB', oneType:true }
};
const GEOM_GROUPS = [
  { key:'POINT', label:'puntos', where:"OGR_GEOMETRY='POINT' OR OGR_GEOMETRY='MULTIPOINT'", test: t => /Point/.test(t), nlt: types => types.has('MultiPoint') ? 'MULTIPOINT' : 'POINT' },
  { key:'LINE', label:'lineas', where:"OGR_GEOMETRY='LINESTRING' OR OGR_GEOMETRY='MULTILINESTRING'", test: t => /LineString/.test(t), nlt: () => 'MULTILINESTRING' },
  { key:'POLY', label:'poligonos', where:"OGR_GEOMETRY='POLYGON' OR OGR_GEOMETRY='MULTIPOLYGON'", test: t => /Polygon/.test(t), nlt: () => 'MULTIPOLYGON' }
];
/* gdal3.js rechaza con objetos; se convierten en errores con mensaje */
const gdalErr = e => e instanceof Error ? e : new Error((e && (e.message || (Array.isArray(e) ? e.map(x => x.message || x).join(' ') : JSON.stringify(e)))) || 'Error de GDAL');
async function runGdal(fn){ try { return await fn(); } catch (e){ throw gdalErr(e); } }
const safeName = s => (String(s || 'capa').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'capa').slice(0, 60);

/* fc: GeoJSON en WGS84. Devuelve { blob, filename } */
async function gdalExport(fc, { format, crs, name, onStatus }){
  const F = EXPORT_FORMATS[format]; if (!F) throw new Error('Formato desconocido');
  const Gdal = await loadGdal(onStatus);
  onStatus && onStatus('Preparando el archivo…');
  const base = safeName(name), tag = base + '_' + (++gdalOutN);
  const input = await runGdal(() => Gdal.open(new File([JSON.stringify(fc)], tag + '_in.geojson')));
  const ds = input.datasets[0];
  if (!ds) throw new Error('No se pudo preparar la capa para exportar.');
  const target = F.wgs84Only ? 'EPSG:4326' : srsArg(crs || 'EPSG:4326');
  const common = ['-f', F.driver, '-t_srs', target];
  if (format === 'shp') common.push('-lco', 'ENCODING=UTF-8');
  if (format === 'geojson' && target === 'EPSG:4326') common.push('-lco', 'RFC7946=YES');
  if (format === 'kmz') common.push('-dsco', 'NameField=' + (fc._nameField || 'Name'));
  const outName = tag + '_out';
  let groups = [null];
  const types = new Set(fc.features.filter(f => f.geometry).map(f => f.geometry.type));
  if (F.oneType){
    groups = GEOM_GROUPS.filter(g => [...types].some(g.test));
    if (!groups.length) throw new Error('La capa no tiene geometrías para exportar.');
  }
  let first = true;
  for (const g of groups){
    const opts = [...common];
    if (g) opts.push('-nlt', g.nlt(types));
    if (g){ opts.push('-where', g.where); }
    const lname = g && groups.length > 1 ? `${base}_${g.label}` : base;
    opts.push('-nln', lname);
    if (!first && format === 'gdb') opts.push('-update', '-append');
    const dst = format === 'shp' && g && groups.length > 1 ? `${outName}_${g.label}` : outName;
    await runGdal(() => Gdal.ogr2ogr(ds, opts, dst));
    first = false;
  }
  try { Gdal.close(ds); } catch {}
  const all = (await Gdal.getOutputFiles()).filter(x => x.path.startsWith('/output/' + outName));
  if (!all.length) throw new Error('GDAL no generó el archivo. Revisa que la capa tenga geometrías válidas.');
  const bytes = async p => Gdal.getFileBytes(p);
  if (format === 'geojson'){
    const p = all.find(x => /\.geojson$/i.test(x.path)) || all[0];
    return { blob: new Blob([await bytes(p.path)], { type:'application/geo+json' }), filename: base + F.ext };
  }
  if (format === 'gpkg'){
    const p = all.find(x => /\.gpkg$/i.test(x.path));
    return { blob: new Blob([await bytes(p.path)], { type:'application/geopackage+sqlite3' }), filename: base + F.ext };
  }
  const JSZip = await loadJSZip(), z = new JSZip();
  if (format === 'kmz'){
    const p = all.find(x => /\.kml$/i.test(x.path));
    z.file('doc.kml', await bytes(p.path));
    return { blob: await z.generateAsync({ type:'blob', compression:'DEFLATE', mimeType:'application/vnd.google-earth.kmz' }), filename: base + F.ext };
  }
  for (const x of all){
    let rel = x.path.replace('/output/', '');
    if (format === 'gdb') rel = rel.replace(outName + '.gdb', base + '.gdb');
    else rel = rel.replace(outName, base);
    z.file(rel, await bytes(x.path));
  }
  return { blob: await z.generateAsync({ type:'blob', compression:'DEFLATE' }), filename: base + F.ext };
}
