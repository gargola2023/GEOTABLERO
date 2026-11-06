/* =================================================================
   GeoTablero · simbología: rampas de color, clasificación y reglas
   de renderizado para ImageServer. Funciones puras, sin interfaz.
   ================================================================= */
'use strict';

const RAMPS = {
  categorico: { name:'Categórico', stops:['#0e6e5c','#c2571a','#3a5fcd','#b5338a','#6f8a12','#8a5a2b','#0f8fa8','#6b4fbf','#d4a017','#5b6964','#e0457b','#2e8b57'], cat:true },
  verdes:     { name:'Verdes',     stops:['#edf8e9','#a1d99b','#41ab5d','#006d2c','#00441b'] },
  azules:     { name:'Azules',     stops:['#eff3ff','#9ecae1','#4292c6','#08519c','#08306b'] },
  naranjos:   { name:'Naranjos',   stops:['#fff5eb','#fdbe85','#fd8d3c','#d94701','#7f2704'] },
  rojos:      { name:'Rojos',      stops:['#fee5d9','#fcae91','#fb6a4a','#cb181d','#67000d'] },
  semaforo:   { name:'Verde a rojo', stops:['#1a9850','#91cf60','#fee08b','#fc8d59','#d73027'] },
  espectral:  { name:'Espectral',  stops:['#d7191c','#fdae61','#ffffbf','#abdda4','#2b83ba'] },
  viridis:    { name:'Viridis',    stops:['#440154','#3b528b','#21918c','#5ec962','#fde725'] },
  magma:      { name:'Magma',      stops:['#000004','#51127c','#b73779','#fc8961','#fcfdbf'] }
};
const OTHER_COLOR = '#9aa5a1';

const hexToRgb = h => { const n = parseInt(h.replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
function lerpStops(stops, t){
  if (stops.length === 1) return stops[0];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  const a = hexToRgb(stops[i]), b = hexToRgb(stops[i + 1]);
  return rgbToHex(a.map((v, k) => v + (b[k] - v) * f));
}
function rampColors(name, n, reverse){
  const r = RAMPS[name] || RAMPS.categorico;
  let out = r.cat ? Array.from({ length:n }, (_, i) => r.stops[i % r.stops.length])
                  : Array.from({ length:n }, (_, i) => lerpStops(r.stops, n === 1 ? .6 : i / (n - 1)));
  return reverse ? out.reverse() : out;
}
const rampCss = (name, reverse) => { const s = (RAMPS[name] || RAMPS.categorico).stops.slice(); if (reverse) s.reverse(); return `linear-gradient(90deg,${s.join(',')})`; };
/* Un color legible (claro u oscuro) para usar sobre un fondo dado */
function inkFor(hex){ const [r, g, b] = hexToRgb(hex); return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1b2422' : '#ffffff'; }
/* Normaliza cualquier color CSS conocido a #rrggbb (input type=color lo exige) */
function toHex(c){
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map(x => x + x).join('').toLowerCase();
  const m = String(c).match(/rgba?\(([^)]+)\)/); if (m) return rgbToHex(m[1].split(',').slice(0, 3).map(Number));
  return '#0e6e5c';
}

/* ---------- Clasificación ---------- */
function equalBreaks(vals, k){
  const mn = Math.min(...vals), mx = Math.max(...vals);
  return Array.from({ length:k + 1 }, (_, i) => mn + (mx - mn) * i / k);
}
function quantileBreaks(vals, k){
  const s = vals.slice().sort((a, b) => a - b);
  return Array.from({ length:k + 1 }, (_, i) => i === k ? s[s.length - 1] : s[Math.floor(i * (s.length - 1) / k)]);
}
/* Cortes naturales de Jenks (Fisher-Jenks). Muestra hasta 1.000 valores. */
function jenksBreaks(vals, k){
  let data = vals.slice().sort((a, b) => a - b);
  if (data.length > 1000){ const step = data.length / 1000; data = Array.from({ length:1000 }, (_, i) => data[Math.floor(i * step)]); data[999] = vals.reduce((a, b) => Math.max(a, b)); }
  const n = data.length;
  if (n <= k) return [...new Set(data)];
  const lower = Array.from({ length:n + 1 }, () => new Array(k + 1).fill(0));
  const vari = Array.from({ length:n + 1 }, () => new Array(k + 1).fill(0));
  for (let j = 1; j <= k; j++){ lower[1][j] = 1; vari[1][j] = 0; for (let i = 2; i <= n; i++) vari[i][j] = Infinity; }
  for (let l = 2; l <= n; l++){
    let s1 = 0, s2 = 0, w = 0, v = 0;
    for (let m = 1; m <= l; m++){
      const i3 = l - m + 1, val = data[i3 - 1];
      s2 += val * val; s1 += val; w++; v = s2 - (s1 * s1) / w;
      const i4 = i3 - 1;
      if (i4 !== 0) for (let j = 2; j <= k; j++) if (vari[l][j] >= v + vari[i4][j - 1]){ lower[l][j] = i3; vari[l][j] = v + vari[i4][j - 1]; }
    }
    lower[l][1] = 1; vari[l][1] = v;
  }
  const br = new Array(k + 1); br[k] = data[n - 1]; br[0] = data[0];
  let kk = n;
  for (let c = k; c >= 2; c--){ const id = lower[kk][c] - 2; br[c - 1] = data[id]; kk = lower[kk][c] - 1; }
  return br;
}
function classBreaks(vals, k, method){
  const v = vals.filter(Number.isFinite);
  if (!v.length) return [];
  const b = method === 'quantile' ? quantileBreaks(v, k) : method === 'equal' ? equalBreaks(v, k) : jenksBreaks(v, k);
  return b.filter((x, i) => i === 0 || x > b[i - 1]);   // sin cortes repetidos
}
function classIndex(breaks, v){
  for (let i = 0; i < breaks.length - 1; i++) if (v <= breaks[i + 1]) return i;
  return breaks.length - 2;
}
const fmtBreak = v => new Intl.NumberFormat('es-CL', { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 ? 1 : 3 }).format(v);

/* ---------- Estilo por defecto de una capa vectorial ---------- */
function defaultStyle(color, geom){
  const c = toHex(color || '#0e6e5c'), pt = geom === 'Point', ln = geom === 'LineString';
  return {
    mode:'single', fill:c, fillOpacity: pt ? .9 : ln ? 1 : .3,
    stroke: pt ? '#ffffff' : c, strokeSame: !pt, weight: ln ? 3 : pt ? 1.5 : 2, strokeOpacity:.95,
    radius:7, dash:'', field:'', ramp:'categorico', reverse:false, classes:5, method:'jenks',
    cats:[], breaks:[], colors:[], other: OTHER_COLOR, label:{ field:'', size:'m' }
  };
}
const DASHES = { '':'Continua', '8 6':'Guiones', '2 6':'Puntos', '12 6 2 6':'Guion y punto' };

/* ---------- ImageServer: regla de renderizado a partir de la simbología ---------- */
const STRETCH_TYPES = { minmax:5, stddev:3, percent:6 };
function bandPresets(n){
  if (n >= 8) return { natural:[5,3,2], falso:[7,5,3], agua:[8,7,2] };          // WorldView-2/3
  if (n >= 4) return { natural:[3,2,1], falso:[4,3,2], agua:[4,1,3] };          // B, G, R, NIR (PlanetScope, SkySat, ortofotos)
  if (n === 3) return { natural:[1,2,3] };
  return {};
}
const PRESET_NAMES = { natural:'Color natural', falso:'Falso color (vegetación en rojo)', agua:'Infrarrojo para agua y suelo' };
function imageRule(render){
  const r = render || {}, out = { bandIds: undefined, renderingRule: undefined };
  const bands = Array.isArray(r.bands) && r.bands.length === 3 ? r.bands.map(b => b - 1).join(',') : undefined;
  if (r.mode === 'ndvi'){
    out.renderingRule = { rasterFunction:'Colormap', rasterFunctionArguments:{ ColormapName: r.colormap || 'NDVI',
      Raster:{ rasterFunction:'NDVI', rasterFunctionArguments:{ VisibleBandID: (r.red || 3) - 1, InfraredBandID: (r.nir || 4) - 1 } } } };
  } else if (r.mode === 'fn' && r.fn){
    out.renderingRule = { rasterFunction: r.fn };
  } else if (r.mode === 'stretch'){
    const s = r.stretch || {}, g = +s.gamma || 1;
    out.bandIds = bands;
    out.renderingRule = { rasterFunction:'Stretch', outputPixelType:'U8', rasterFunctionArguments:{
      StretchType: STRETCH_TYPES[s.type] ?? 6, NumberOfStandardDeviations: +s.sd || 2,
      MinPercent: +s.min ?? .5, MaxPercent: +s.max ?? .5, DRA: s.dra !== false,
      UseGamma: g !== 1, Gamma: [g, g, g] } };
  } else {
    out.bandIds = bands;
  }
  return out;
}
const fxFilter = fx => { const f = fx || {}; return `brightness(${f.brightness ?? 100}%) contrast(${f.contrast ?? 100}%) saturate(${f.saturate ?? 100}%) grayscale(${f.grayscale ?? 0}%)`; };
