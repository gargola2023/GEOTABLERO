/* =================================================================
   GeoTablero · coordenadas
   Geográficas (decimales y GMS) y UTM en SIRGAS-Chile 2025
   (Red Geodésica Nacional del IGM, época de referencia 2025.0).
   Los mapas base y servicios web vienen en WGS84 / Web Mercator; se
   toman como coincidentes con SIRGAS-Chile 2025 (ver nota abajo).

   SIRGAS-Chile 2025 usa el elipsoide GRS 1980 (EPSG 11473). Entre
   WGS84 y SIRGAS-Chile no se aplica traslado de datum: la diferencia
   es de centímetros a pocos decímetros según la época, menor que la
   precisión de un visor web. Para trabajos geodésicos usa las
   transformaciones oficiales del IGM.
   ================================================================= */
'use strict';

const ELLIPSOIDS = {
  wgs84: { a: 6378137, f: 1 / 298.257223563 },
  grs80: { a: 6378137, f: 1 / 298.257222101 }
};
const DATUMS = {
  wgs84:  { name:'WGS84', ell:'wgs84' },
  sirgas: { name:'SIRGAS-Chile 2025', ell:'grs80' }
};
/* Formatos visibles: todo referido a SIRGAS-Chile 2025 */
const COORD_FORMATS = {
  dec:        'SIRGAS-Chile 2025 · grados decimales',
  dms:        'SIRGAS-Chile 2025 · grados, minutos y segundos',
  utm_sirgas: 'SIRGAS-Chile 2025 · UTM'
};
const K0 = 0.9996, D2R = Math.PI / 180;
/* Códigos EPSG: WGS84 / UTM sur = 327xx; SIRGAS-Chile 2025 según el registro EPSG */
const SIRGAS2025_UTM = { 12: 11474, 18: 11475, 19: 11476 };
function epsgFor(fmtKey, lat, lon){
  if (fmtKey === 'dec' || fmtKey === 'dms') return 11473;
  const z = utmZoneFor(lon);
  if (fmtKey === 'utm_wgs84') return (lat < 0 ? 32700 : 32600) + z;
  return lat < 0 ? SIRGAS2025_UTM[z] || null : null;
}

const utmZoneFor = lon => Math.max(1, Math.min(60, Math.floor((lon + 180) / 6) + 1));
const zoneMeridian = z => (z - 1) * 6 - 180 + 3;

/* Geográficas → UTM (Snyder, USGS PP 1395) */
function toUTM(lat, lon, datum = 'wgs84', zone){
  const { a, f } = ELLIPSOIDS[DATUMS[datum].ell], e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  zone = zone || utmZoneFor(lon);
  const phi = lat * D2R, lam = (lon - zoneMeridian(zone)) * D2R;
  const s = Math.sin(phi), c = Math.cos(phi), t = Math.tan(phi);
  const N = a / Math.sqrt(1 - e2 * s * s), T = t * t, C = ep2 * c * c, A = c * lam;
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
  const E = K0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
  let Nn = K0 * (M + N * t * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
  const hemi = lat < 0 ? 'S' : 'N';
  if (hemi === 'S') Nn += 10000000;
  return { e: E, n: Nn, zone, hemi };
}
/* UTM → geográficas */
function fromUTM(E, Nn, zone, hemi = 'S', datum = 'wgs84'){
  const { a, f } = ELLIPSOIDS[DATUMS[datum].ell], e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const x = E - 500000, y = hemi === 'S' ? Nn - 10000000 : Nn;
  const mu = y / K0 / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1);
  const N1 = a / Math.sqrt(1 - e2 * s * s), T1 = t * t, C1 = ep2 * c * c, R1 = a * (1 - e2) / Math.pow(1 - e2 * s * s, 1.5), D = x / (N1 * K0);
  const lat = p1 - (N1 * t / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / c;
  return { lat: lat / D2R, lon: zoneMeridian(zone) + lon / D2R };
}

/* ---------- Formatos de salida ---------- */
const nf = (v, d) => new Intl.NumberFormat('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
function toDMS(v, pos, neg){
  const h = v < 0 ? neg : pos, x = Math.abs(v);
  let d = Math.floor(x), m = Math.floor((x - d) * 60), s = (x - d - m / 60) * 3600;
  if (s >= 59.995){ s = 0; m++; } if (m >= 60){ m = 0; d++; }
  return `${d}° ${String(m).padStart(2, '0')}′ ${nf(s, 2).padStart(5, '0')}″ ${h}`;
}
function formatCoord(lat, lon, fmtKey){
  if (fmtKey === 'dms') return `${toDMS(lat, 'N', 'S')}   ${toDMS(lon, 'E', 'O')}`;
  if (fmtKey === 'utm_wgs84' || fmtKey === 'utm_sirgas'){
    const u = toUTM(lat, lon, fmtKey === 'utm_wgs84' ? 'wgs84' : 'sirgas');
    return `${u.zone}${u.hemi}   E ${nf(u.e, 0)} m   N ${nf(u.n, 0)} m`;
  }
  return `${nf(lat, 6)}°   ${nf(lon, 6)}°`;
}
/* Texto plano para copiar (punto decimal, sin separador de miles) */
function plainCoord(lat, lon, fmtKey){
  if (fmtKey === 'dms') return `${toDMS(lat, 'N', 'S').replace(/,/g, '.')} ${toDMS(lon, 'E', 'O').replace(/,/g, '.')}`;
  if (fmtKey === 'utm_wgs84' || fmtKey === 'utm_sirgas'){
    const u = toUTM(lat, lon, fmtKey === 'utm_wgs84' ? 'wgs84' : 'sirgas');
    return `${u.zone}${u.hemi} ${u.e.toFixed(1)} ${u.n.toFixed(1)}`;
  }
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

/* ---------- Lectura de coordenadas escritas ----------
   Acepta, por ejemplo:
     -33.4489, -70.6693          (latitud, longitud decimales)
     33°26'56"S 70°40'9"O        (GMS con hemisferio N/S/E/O/W)
     19S 346512 6297123          (UTM con zona; usa el sistema elegido)
     346512 6297123              (UTM sin zona: usa la zona elegida)      */
function parseCoord(text, opts = {}){
  const t = String(text || '').trim().replace(/[´`’]/g, "'").replace(/[”″]/g, '"').replace(/[′]/g, "'");
  if (!t) throw new Error('Escribe una coordenada.');
  const datum = opts.datum || 'sirgas';
  // GMS
  const dmsRe = /(-?\d+(?:[.,]\d+)?)\s*[°º d]\s*(?:(\d+(?:[.,]\d+)?)\s*['m]\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:"|''|s)\s*)?([NSEOW])?/gi;
  if (/[°º'"]/.test(t)){
    const parts = [...t.matchAll(dmsRe)].filter(m => m[0].trim());
    if (parts.length >= 2){
      const val = m => {
        let v = Math.abs(parseFloat(m[1].replace(',', '.'))) + (m[2] ? parseFloat(m[2].replace(',', '.')) / 60 : 0) + (m[3] ? parseFloat(m[3].replace(',', '.')) / 3600 : 0);
        const h = (m[4] || '').toUpperCase();
        if (m[1].trim().startsWith('-') || h === 'S' || h === 'O' || h === 'W') v = -v;
        return { v, h };
      };
      let a = val(parts[0]), b = val(parts[1]);
      if (/[EOW]/.test(a.h) || /[NS]/.test(b.h)) [a, b] = [b, a];
      return checkLL(a.v, b.v);
    }
  }
  const zoneM = t.match(/\b(\d{1,2})\s*([NS])\b/i);
  // UTM: dos números grandes (metros)
  const big = (t.match(/-?\d+(?:[.,]\d+)?/g) || []).map(x => parseFloat(x.replace(',', '.'))).filter(v => Math.abs(v) > 1000);
  if (big.length >= 2){
    const zone = zoneM ? +zoneM[1] : (opts.zone || 19), hemi = zoneM ? zoneM[2].toUpperCase() : (opts.hemi || 'S');
    let [E, N] = big; if (E > N) [E, N] = [N, E];
    if (E < 100000 || E > 900000 || N < 0 || N > 10000000) throw new Error('Los valores UTM no parecen válidos: el Este va entre 100.000 y 900.000 m y el Norte entre 0 y 10.000.000 m.');
    const ll = fromUTM(E, N, zone, hemi, datum);
    return { ...checkLL(ll.lat, ll.lon), utm: { e: E, n: N, zone, hemi } };
  }
  // Decimales: "-33.45, -70.66" o con coma decimal "-33,45 -70,66"
  const s2 = !/\./.test(t) && /\d,\d+[\s;]+-?\d+,\d/.test(t) ? t.replace(/(\d),(\d)/g, '$1.$2') : t;
  const v = (s2.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  if (v.length >= 2){
    let [lat, lon] = v;
    if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) [lat, lon] = [lon, lat];
    return checkLL(lat, lon);
  }
  throw new Error('No reconozco la coordenada. Ejemplos: -33.4489, -70.6693 · 33°26′56″S 70°40′09″O · 19S 346512 6297123');
}
function checkLL(lat, lon){
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('La coordenada queda fuera del rango válido (latitud ±90°, longitud ±180°).');
  return { lat, lon };
}
