/* =================================================================
   GeoTablero · conexiones a bases de datos espaciales (PostGIS)

   El navegador no puede hablar el protocolo de PostgreSQL, así que
   PostGIS se consulta a través de un servicio HTTP:
     - supabase   Supabase (PostgREST sobre PostGIS)   lectura y escritura
     - postgrest  PostgREST propio sobre PostGIS        lectura y escritura
     - ogcapi     OGC API Features (pg_featureserv,     solo lectura
                  pygeoapi, GeoServer OGC API)
     - wfs        WFS de GeoServer / MapServer          solo lectura
   ================================================================= */
'use strict';

const CONN_TYPES = {
  supabase:  { name:'Supabase (PostGIS)',  write:true,  url:'https://xxxx.supabase.co', key:'Clave pública (anon o publishable)', filter:'estado=eq.Activo&region=eq.Aysén' },
  postgrest: { name:'PostgREST (PostGIS)', write:true,  url:'https://servidor/api', key:'Token JWT (opcional)', filter:'estado=eq.Activo' },
  ogcapi:    { name:'OGC API Features · pg_featureserv', write:false, url:'https://servidor/featureserv', key:'', filter:'estado=Activo' },
  wfs:       { name:'WFS · GeoServer', write:false, url:'https://servidor/geoserver/ows', key:'', filter:"estado = 'Activo'" }
};
const DB_PAGE = 1000, DB_MAX = 20000;

/* ---------- Claves ---------- */
function jwtRole(key){
  try { const p = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return p.role || null; }
  catch { return null; }
}
/* Devuelve un texto de error si la clave no debe usarse en una página web */
function connKeyProblem(c){
  if (c.type === 'supabase' && !c.key) return 'Supabase necesita la clave pública del proyecto (anon o publishable).';
  if (c.key && (/^sb_secret_/.test(c.key) || jwtRole(c.key) === 'service_role'))
    return 'Esa es una clave secreta (service_role): da acceso total a la base y quedaría visible para cualquiera que abra la página. Usa la clave pública (anon o publishable) y protege las tablas con políticas RLS.';
  return null;
}

/* ---------- HTTP ---------- */
const restBase = c => c.type === 'supabase' ? c.url.replace(/\/+$/, '') + '/rest/v1' : c.url.replace(/\/+$/, '');
function restHeaders(c, extra = {}){
  const h = { ...extra };
  if (c.key){
    if (c.type === 'supabase') h.apikey = c.key;
    if (c.key.split('.').length === 3) h.Authorization = 'Bearer ' + c.key;   // solo si es un JWT
  }
  if (c.schema){ h['Accept-Profile'] = c.schema; h['Content-Profile'] = c.schema; }
  return h;
}
async function httpReq(url, opts = {}){
  let r;
  try { r = await fetch(url, opts); }
  catch { throw new Error('No se pudo conectar con el servidor. Revisa la URL y que el servidor permita solicitudes desde esta página (CORS).'); }
  const txt = await r.text();
  let body; try { body = txt ? JSON.parse(txt) : null; } catch { body = txt; }
  if (!r.ok){
    const m = body && typeof body === 'object' ? (body.message || body.error_description || body.error || body.hint || body.details || '') : '';
    const extra = m ? `: ${m}` : '';
    if (r.status === 401 || r.status === 403) throw new Error(`Acceso denegado (${r.status})${extra}. Revisa la clave y las políticas de acceso (RLS) de la tabla.`);
    if (r.status === 404) throw new Error(`No se encontró el recurso (404)${extra}. Revisa la URL, la tabla o el esquema.`);
    throw new Error(`El servidor respondió ${r.status}${extra}.`);
  }
  return { body, text: txt, ct: r.headers.get('content-type') || '' };
}
/* JSONP para GeoServer sin CORS (requiere que el servidor lo tenga habilitado) */
let dbJsonpN = 0;
function jsonpGet(build){
  return new Promise((res, rej) => {
    const cb = '__gtDb' + (++dbJsonpN), s = document.createElement('script');
    const done = () => { clearTimeout(t); delete window[cb]; s.remove(); };
    const t = setTimeout(() => { done(); rej(new Error('timeout')); }, 25000);
    window[cb] = d => { done(); res(d); };
    s.src = build(cb); s.onerror = () => { done(); rej(new Error('jsonp')); };
    document.head.append(s);
  });
}

/* ---------- Geometrías ---------- */
function geomToWKT(g){
  const pt = c => `${c[0]} ${c[1]}`, ring = r => `(${r.map(pt).join(', ')})`;
  switch (g.type){
    case 'Point': return `POINT(${pt(g.coordinates)})`;
    case 'MultiPoint': return `MULTIPOINT(${g.coordinates.map(c => `(${pt(c)})`).join(', ')})`;
    case 'LineString': return `LINESTRING${ring(g.coordinates)}`;
    case 'MultiLineString': return `MULTILINESTRING(${g.coordinates.map(ring).join(', ')})`;
    case 'Polygon': return `POLYGON(${g.coordinates.map(ring).join(', ')})`;
    case 'MultiPolygon': return `MULTIPOLYGON(${g.coordinates.map(p => `(${p.map(ring).join(', ')})`).join(', ')})`;
    default: throw new Error('Tipo de geometría no soportado: ' + g.type);
  }
}
function toMulti(g){ return /^Multi/.test(g.type) ? g : { type: 'Multi' + g.type, coordinates: [g.coordinates] }; }
const toEWKT = (g, multi) => 'SRID=4326;' + geomToWKT(multi ? toMulti(g) : g);
function firstCoord(g){
  if (!g) return null;
  if (g.type === 'GeometryCollection') return firstCoord(g.geometries[0]);
  let c = g.coordinates; while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) ? c : null;
}
function assertLonLat(features){
  const f = features.find(x => x.geometry); if (!f) return;
  const c = firstCoord(f.geometry);
  if (c && (Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90))
    throw new Error('Las coordenadas vienen en un sistema proyectado (por ejemplo UTM), no en grados. Crea en PostGIS una vista con ST_Transform(geom, 4326) y conéctate a esa vista.');
}
/* Geometría que llega dentro de una fila (PostGIS 3 la entrega como GeoJSON) */
function parseGeom(v){
  if (v && typeof v === 'object' && v.type) return v;
  if (typeof v === 'string'){
    if (v.trim().startsWith('{')) { try { return JSON.parse(v); } catch {} }
    if (/^[0-9A-Fa-f]+$/.test(v)) throw new Error('La geometría llega en formato binario (WKB). Usa PostGIS 3 o crea una vista que exponga ST_AsGeoJSON(geom)::json.');
  }
  return null;
}

/* ---------- Listar tablas o capas con geometría ---------- */
async function dbListTables(c){
  const p = connKeyProblem(c); if (p) throw new Error(p);
  if (c.type === 'supabase' || c.type === 'postgrest'){
    const { body } = await httpReq(restBase(c) + '/', { headers: restHeaders(c, { Accept:'application/openapi+json' }) });
    const defs = body && body.definitions;
    if (!defs) throw new Error('El servidor respondió, pero no entregó la lista de tablas. Verifica que la URL sea la del proyecto o de la API PostgREST.');
    return Object.entries(defs).map(([name, d]) => {
      const props = d.properties || {}, cols = Object.keys(props);
      const geomCol = cols.find(k => /geometry|geography/i.test(props[k].format || ''));
      const pk = cols.find(k => /<pk\/>/.test(props[k].description || ''));
      return { id: name, title: name, geomCol, pk, fields: cols.filter(k => k !== geomCol) };
    }).filter(t => t.geomCol).sort((a, b) => a.id.localeCompare(b.id));
  }
  if (c.type === 'ogcapi'){
    const base = c.url.replace(/\/+$/, '');
    let body;
    try { ({ body } = await httpReq(base + '/collections', { headers:{ Accept:'application/json' } })); }
    catch (e){ ({ body } = await httpReq(base + '/collections.json')); }
    if (typeof body === 'string' || !body || !Array.isArray(body.collections)) throw new Error('La URL no parece un servicio OGC API Features (no tiene /collections).');
    return body.collections.map(k => ({ id: k.id || k.name, title: k.title || k.id, fields: [] })).filter(t => t.id);
  }
  if (c.type === 'wfs'){
    const base = c.url.replace(/\?.*$/, '');
    const { text } = await httpReq(`${base}?service=WFS&version=2.0.0&request=GetCapabilities`);
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    if (xml.getElementsByTagName('parsererror').length || !xml.getElementsByTagNameNS('*', 'FeatureTypeList').length) throw new Error('La URL no respondió como un servicio WFS.');
    return [...xml.getElementsByTagNameNS('*', 'FeatureType')].map(ft => {
      const get = n => { const e = ft.getElementsByTagNameNS('*', n)[0]; return e ? e.textContent.trim() : ''; };
      return { id: get('Name'), title: get('Title') || get('Name'), fields: [] };
    }).filter(t => t.id);
  }
  throw new Error('Tipo de conexión desconocido.');
}

/* ---------- Leer entidades ---------- */
async function dbFetchFeatures(c, opts, onProgress){
  const max = Math.min(opts.max || DB_MAX, DB_MAX), filter = (opts.filter || '').trim().replace(/^[?&]/, '');
  const p = connKeyProblem(c); if (p) throw new Error(p);
  let out = [];
  if (c.type === 'supabase' || c.type === 'postgrest'){
    let offset = 0;
    while (out.length < max){
      const lim = Math.min(DB_PAGE, max - out.length);
      const url = `${restBase(c)}/${encodeURIComponent(opts.table)}?select=*&limit=${lim}&offset=${offset}${filter ? '&' + filter : ''}`;
      const { body } = await httpReq(url, { headers: restHeaders(c, { Accept:'application/geo+json, application/json;q=0.8' }) });
      let feats;
      if (body && body.type === 'FeatureCollection') feats = body.features;
      else if (Array.isArray(body)){
        feats = body.map(row => {
          const props = { ...row }, g = parseGeom(row[opts.geomCol]); delete props[opts.geomCol];
          return { type:'Feature', properties: props, geometry: g };
        });
      } else throw new Error('Respuesta inesperada del servidor.');
      out.push(...feats.filter(f => f.geometry || opts.keepNull));
      onProgress && onProgress(out.length);
      if (feats.length < lim) break;
      offset += feats.length;
    }
  } else if (c.type === 'ogcapi'){
    const base = c.url.replace(/\/+$/, '');
    let url = `${base}/collections/${encodeURIComponent(opts.table)}/items?limit=${Math.min(DB_PAGE, max)}${filter ? '&' + filter : ''}`;
    while (url && out.length < max){
      const { body } = await httpReq(url, { headers:{ Accept:'application/geo+json, application/json;q=0.8' } });
      if (!body || !Array.isArray(body.features)) throw new Error('El servicio no devolvió entidades GeoJSON.');
      out.push(...body.features.filter(f => f.geometry));
      onProgress && onProgress(out.length);
      const next = (body.links || []).find(l => l.rel === 'next');
      url = next && body.features.length ? new URL(next.href, url).href : null;
    }
  } else if (c.type === 'wfs'){
    const base = c.url.replace(/\?.*$/, '');
    const q = new URLSearchParams({ service:'WFS', version:'2.0.0', request:'GetFeature', typeNames: opts.table, outputFormat:'application/json', srsName:'EPSG:4326', count: String(max) });
    if (filter) q.set('CQL_FILTER', filter);
    let body;
    try { ({ body } = await httpReq(`${base}?${q}`)); }
    catch (e){
      if (!/conectar/.test(e.message)) throw e;
      q.set('outputFormat', 'text/javascript');
      try { body = await jsonpGet(cb => { q.set('format_options', 'callback:' + cb); return `${base}?${q}`; }); }
      catch { throw e; }
    }
    if (!body || !Array.isArray(body.features)) throw new Error(typeof body === 'string' && /Exception/.test(body) ? 'El WFS devolvió un error: revisa el nombre de la capa o el filtro CQL.' : 'El WFS no devolvió GeoJSON.');
    out = body.features.filter(f => f.geometry);
    onProgress && onProgress(out.length);
  }
  out = out.slice(0, max).map(f => ({ type:'Feature', properties: f.properties || {}, geometry: f.geometry, id: f.id }));
  assertLonLat(out);
  return { type:'FeatureCollection', features: out };
}

/* ---------- Escribir (solo Supabase / PostgREST) ---------- */
const tableUrl = (c, t) => `${restBase(c)}/${encodeURIComponent(t)}`;
const pkFilter = (pk, v) => `${encodeURIComponent(pk)}=eq.${encodeURIComponent(v)}`;
async function dbInsert(c, table, row){
  const { body } = await httpReq(tableUrl(c, table), { method:'POST', headers: restHeaders(c, { 'Content-Type':'application/json', Accept:'application/json', Prefer:'return=representation' }), body: JSON.stringify(row) });
  return Array.isArray(body) ? body[0] : body;
}
async function dbUpdate(c, table, pk, id, row){
  await httpReq(`${tableUrl(c, table)}?${pkFilter(pk, id)}`, { method:'PATCH', headers: restHeaders(c, { 'Content-Type':'application/json', Prefer:'return=minimal' }), body: JSON.stringify(row) });
}
async function dbDelete(c, table, pk, id){
  await httpReq(`${tableUrl(c, table)}?${pkFilter(pk, id)}`, { method:'DELETE', headers: restHeaders(c, { Prefer:'return=minimal' }) });
}
