/* =================================================================
   GeoTablero · código compartido entre el portal (index.html)
   y la página de cada aplicación (visor.html)
   ================================================================= */
'use strict';

/* ---------- Utilidades de interfaz ---------- */
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(c => c != null && c !== false && n.append(c.nodeType ? c : document.createTextNode(c)));
  return n;
};
const svg = d => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = d; return s;
};
const ICON = {
  zoom:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  down:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  palette:'<path d="M12 3a9 9 0 100 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.4-1.1-.2-.3-.4-.6-.4-1 0-.9.7-1.6 1.6-1.6H16a5 5 0 005-5C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  legend:'<rect x="4" y="5" width="4" height="4" rx="1"/><rect x="4" y="15" width="4" height="4" rx="1"/><path d="M11 7h9M11 17h9"/>',
  db:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  refresh:'<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
  link:'<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  minus:'<path d="M6 12h12"/>',
  expand:'<rect x="5" y="5" width="14" height="14" rx="2"/>',
  grip:'<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  sliders:'<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'
};
const fmt = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });
const fmtBig = v => Math.abs(v) >= 1e6 ? fmt.format(v / 1e6) + ' M' : fmt.format(v);
const fmtDate = t => new Intl.DateTimeFormat('es-CL', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(t));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const initials = n => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const palette = () => ['--c1','--c2','--c3','--c4','--c5','--c6','--c7','--c8'].map(cssVar);

/* Toast y diálogo de confirmación se insertan en cada página */
document.body.append(
  el('div', { class:'toast', id:'toast' }),
  (() => {
    const d = el('dialog', { id:'dlgConfirm', style:'width:min(400px,calc(100vw - 32px))' });
    d.innerHTML = '<form method="dialog"><div class="dlg-body"><b id="confirmTitle" style="font:600 16px var(--f-display)"></b><span id="confirmMsg" style="color:var(--muted)"></span></div><div class="dlg-foot"><button class="btn" value="no">Cancelar</button><button class="btn primary" value="yes" id="confirmOk">Confirmar</button></div></form>';
    return d;
  })()
);
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3200); }
function confirmAsk(title, msg, okLabel = 'Confirmar', danger = true){
  const d = $('#dlgConfirm');
  $('#confirmTitle').textContent = title; $('#confirmMsg').textContent = msg;
  const ok = $('#confirmOk'); ok.textContent = okLabel; ok.className = 'btn ' + (danger ? 'danger' : 'primary');
  return new Promise(res => { d.returnValue = ''; d.addEventListener('close', () => res(d.returnValue === 'yes'), { once:true }); d.showModal(); });
}
function downloadBlob(blob, name){
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const readText = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f); });
const readBuf = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(f); });
async function copyText(text){
  try { await navigator.clipboard.writeText(text); toast('Enlace copiado'); }
  catch { toast(text); }
}

/* ---------- Almacenamiento local: IndexedDB (respaldo en memoria) ---------- */
const DB = {
  db: null, mem: new Map(),
  open(){
    return new Promise(res => {
      try {
        const rq = indexedDB.open('geotablero', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
        rq.onsuccess = () => { this.db = rq.result; res(); };
        rq.onerror = () => res();
      } catch { res(); }
    });
  },
  tx(mode, fn){
    return new Promise((res, rej) => {
      const t = this.db.transaction('kv', mode), st = t.objectStore('kv');
      const r = fn(st); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  async get(k){ if (!this.db) return this.mem.get(k); return this.tx('readonly', st => st.get(k)); },
  async set(k, v){ if (!this.db){ this.mem.set(k, v); return; } return this.tx('readwrite', st => st.put(v, k)); },
  async del(k){ if (!this.db){ this.mem.delete(k); return; } return this.tx('readwrite', st => st.delete(k)); }
};

async function hashPass(login, pass){
  const s = `geotablero:${login.toLowerCase()}:${pass}`;
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return 'd' + (h >>> 0).toString(16);
  }
}

/* ---------- Estado compartido ---------- */
const S = { users: [], apps: [], connections: [], me: null };
const ROLE_NAME = { admin:'Administrador', editor:'Editor', viewer:'Visualizador' };
const roleFor = (u, a) => u && a ? (u.isAdmin ? 'admin' : (a.access && a.access[u.id]) || null) : null;
const saveUsers = () => DB.set('users', S.users);
const saveApps = () => DB.set('apps', S.apps);
const saveConnections = () => DB.set('connections', S.connections);
/* Actualiza una aplicación releyendo la lista, para no pisar cambios hechos en otra pestaña */
async function patchApp(id, fields){
  const list = (await DB.get('apps')) || [];
  const a = list.find(x => x.id === id);
  if (a){ Object.assign(a, fields); await DB.set('apps', list); }
  S.apps = list;
  return a;
}

/* ---------- Sesión (compartida entre pestañas, expira en 12 h) ---------- */
const SESSION_KEY = 'gt_session', SESSION_HOURS = 12;
const memSession = { v: null };
function getSession(){
  let raw = null;
  try { raw = localStorage.getItem(SESSION_KEY); } catch { raw = memSession.v; }
  try { const s = JSON.parse(raw); return s && s.exp > Date.now() ? s.uid : null; } catch { return null; }
}
function setSession(uid){
  const v = JSON.stringify({ uid, exp: Date.now() + SESSION_HOURS * 3600e3 });
  try { localStorage.setItem(SESSION_KEY, v); } catch { memSession.v = v; }
}
function clearSession(){ try { localStorage.removeItem(SESSION_KEY); } catch {} memSession.v = null; }

/* ---------- Contenido de las aplicaciones ---------- */
const emptyState = () => ({ basemap:'voyager', view:{ center:[-33.47, -70.65], zoom: 11 }, layers:[], widgets: emptyWidgets() });
const statsOf = st => {
  const ws = st.widgets;
  return ws
    ? { layers: st.layers.length, charts: ws.filter(w => w.type === 'chart').length, kpis: ws.filter(w => w.type === 'kpi').length }
    : { layers: st.layers.length, charts: (st.charts || []).length, kpis: (st.kpis || []).length };
};
const emptyWidgets = () => [
  { id:'W-layers', type:'layers', ax:'l', dx:56, ay:'t', dy:12, w:290, h:340 },
  { id:'W-basemaps', type:'basemaps', ax:'l', dx:56, ay:'b', dy:28, w:290, h:348, min:true }
];
function roughCenter(g){
  if (!g || !g.coordinates) return null;
  const pts = []; const walk = c => { if (typeof c[0] === 'number') pts.push(c); else c.forEach(walk); };
  walk(g.coordinates);
  if (!pts.length) return null;
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}
/* Puntos simplificados para la miniatura de cada tarjeta */
function thumbData(st){
  const pts = [];
  st.layers.filter(l => l.kind === 'vector').forEach(l => (l.data.features || []).slice(0, 400).forEach(f => {
    const c = roughCenter(f.geometry); if (c) pts.push([+c[0].toFixed(4), +c[1].toFixed(4), l.color]);
  }));
  return pts;
}

function sampleState(){
  const COMUNAS = [
    ['Santiago',-33.4378,-70.6505,404495,'Centro'],['Providencia',-33.4314,-70.6093,142079,'Oriente'],
    ['Las Condes',-33.4080,-70.5670,294838,'Oriente'],['Ñuñoa',-33.4569,-70.5979,208237,'Oriente'],
    ['Peñalolén',-33.4850,-70.5420,241599,'Oriente'],['La Florida',-33.5227,-70.5980,366916,'Sur'],
    ['Puente Alto',-33.6117,-70.5758,568106,'Sur'],['San Bernardo',-33.5922,-70.6996,301313,'Sur'],
    ['Maipú',-33.5110,-70.7580,521627,'Poniente'],['Pudahuel',-33.4400,-70.7550,230293,'Poniente'],
    ['Quilicura',-33.3600,-70.7300,210410,'Norte'],['Recoleta',-33.4060,-70.6400,157851,'Norte']
  ];
  const rect = (x1, y1, x2, y2) => ({ type:'Polygon', coordinates:[[[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]]] });
  const pal = palette();
  return {
    basemap:'voyager', view:{ center:[-33.47, -70.65], zoom: 11 },
    layers: [
      { id:'Lcomunas', kind:'vector', name:'Comunas RM (ejemplo)', editable:false, color: pal[0], geom:'Point', fields:['comuna','zona','poblacion','censo'], visible:true,
        data:{ type:'FeatureCollection', features: COMUNAS.map(([n, la, lo, p, z]) => ({ type:'Feature', properties:{ comuna:n, zona:z, poblacion:p, censo:2017 }, geometry:{ type:'Point', coordinates:[lo, la] } })) } },
      { id:'Lzonas', kind:'vector', name:'Zonas de trabajo (ejemplo)', editable:true, color: pal[1], geom:'Polygon', fields:['nombre','tipo','estado'], visible:true,
        data:{ type:'FeatureCollection', features:[
          { type:'Feature', properties:{ nombre:'Sector Centro', tipo:'Vuelo RPA', estado:'Planificado' }, geometry: rect(-70.67,-33.455,-70.635,-33.43) },
          { type:'Feature', properties:{ nombre:'Sector Maipú', tipo:'Terreno', estado:'En curso' }, geometry: rect(-70.785,-33.53,-70.735,-33.49) },
          { type:'Feature', properties:{ nombre:'Sector Quilicura', tipo:'Vuelo RPA', estado:'Ejecutado' }, geometry: rect(-70.75,-33.375,-70.71,-33.345) }
        ]}}
    ],
    widgets: [
      { id:'W-title', type:'text', ax:'l', dx:56, ay:'t', dy:12, w:296, h:88, noHead:true, cfg:{ text:'**Región Metropolitana**\nPoblación comunal y zonas de trabajo', size:'m', align:'left' } },
      { id:'W-layers', type:'layers', ax:'l', dx:56, ay:'t', dy:112, w:296, h:300 },
      { id:'W-basemaps', type:'basemaps', ax:'l', dx:56, ay:'b', dy:28, w:296, h:348, min:true },
      { id:'W-K1', type:'kpi', ax:'r', dx:540, ay:'t', dy:12, w:168, h:100, cfg:{ layerId:'Lcomunas', field:'poblacion', stat:'sum', unit:'hab', label:'Población total' } },
      { id:'W-K2', type:'kpi', ax:'r', dx:364, ay:'t', dy:12, w:168, h:100, cfg:{ layerId:'Lcomunas', field:'__count', stat:'count', unit:'', label:'Comunas' } },
      { id:'W-K3', type:'kpi', ax:'r', dx:188, ay:'t', dy:12, w:168, h:100, cfg:{ layerId:'Lzonas', field:'__area', stat:'sum', unit:'ha', label:'Superficie de zonas' } },
      { id:'W-K4', type:'kpi', ax:'r', dx:12, ay:'t', dy:12, w:168, h:100, cfg:{ layerId:'Lcomunas', field:'poblacion', stat:'mean', unit:'hab', label:'Población media' } },
      { id:'W-C1', type:'chart', ax:'r', dx:12, ay:'t', dy:120, w:344, h:296, cfg:{ layerId:'Lcomunas', type:'bar', catField:'zona', valField:'poblacion', agg:'sum', title:'Población por zona' } },
      { id:'W-C2', type:'chart', ax:'r', dx:12, ay:'b', dy:28, w:344, h:256, cfg:{ layerId:'Lzonas', type:'doughnut', catField:'tipo', valField:'__area', agg:'sum', title:'Superficie por tipo de trabajo' } }
    ]
  };
}

const DEMO = [
  { login:'admin', pass:'admin123', name:'Administrador SIG', isAdmin:true },
  { login:'editor', pass:'editor123', name:'Camila Editora', isAdmin:false },
  { login:'visor', pass:'visor123', name:'Pedro Visualizador', isAdmin:false }
];
async function seedDemo(){
  S.users = [];
  for (const d of DEMO) S.users.push({ id: nid('U'), login: d.login, name: d.name, isAdmin: d.isAdmin, pass: await hashPass(d.login, d.pass), createdAt: Date.now(), demo:true });
  const st = sampleState();
  const app = { id: nid('A'), name:'Demostración Región Metropolitana', description:'Comunas con población del Censo 2017 y zonas de trabajo editables.', createdBy: S.users[0].id, createdAt: Date.now(), updatedAt: Date.now(), access: { [S.users[1].id]:'editor', [S.users[2].id]:'viewer' }, stats: statsOf(st), thumb: thumbData(st) };
  S.apps = [app];
  await DB.set('app:' + app.id, st); await saveUsers(); await saveApps();
}

/* ---------- Datos publicados en el repositorio (data/geotablero.json) ---------- */
const PUBLISHED_URL = 'data/geotablero.json';
async function fetchPublished(){
  if (location.protocol === 'file:') return null;
  try {
    const r = await fetch(PUBLISHED_URL, { cache:'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.formato === 'geotablero' && Array.isArray(d.users) && Array.isArray(d.apps) ? d : null;
  } catch { return null; }
}
async function exportAll(){
  const data = { formato:'geotablero', version:2, exportado: new Date().toISOString(), users: S.users, apps: S.apps, connections: S.connections, states:{} };
  for (const a of S.apps) data.states[a.id] = await DB.get('app:' + a.id);
  return data;
}
async function importAll(d){
  if (d.formato !== 'geotablero' || !Array.isArray(d.users) || !Array.isArray(d.apps)) throw new Error('El archivo no es un respaldo de GeoTablero.');
  if (!d.users.some(u => u.isAdmin)) throw new Error('El respaldo no tiene ningún administrador.');
  for (const a of (await DB.get('apps')) || []) await DB.del('app:' + a.id);
  S.users = d.users; S.apps = d.apps; S.connections = Array.isArray(d.connections) ? d.connections : [];
  for (const a of S.apps) await DB.set('app:' + a.id, (d.states && d.states[a.id]) || emptyState());
  await saveUsers(); await saveApps(); await saveConnections();
  await DB.set('meta', { origen: d.exportado || null, importado: Date.now() });
}

/* Carga inicial: datos de este navegador; si no hay, los publicados en el repositorio; si no, la demostración */
async function loadStore(){
  await DB.open();
  if (!DB.db) toast('Este navegador no permite guardar datos: los cambios se perderán al cerrar la página.');
  S.users = (await DB.get('users')) || [];
  S.apps = (await DB.get('apps')) || [];
  S.connections = (await DB.get('connections')) || [];
  if (!S.users.length){
    const pub = await fetchPublished();
    if (pub) await importAll(pub); else await seedDemo();
  }
  const uid = getSession();
  S.me = S.users.find(u => u.id === uid) || null;
}
async function reloadStore(){
  S.users = (await DB.get('users')) || S.users;
  S.apps = (await DB.get('apps')) || S.apps;
  S.connections = (await DB.get('connections')) || S.connections;
  if (S.me) S.me = S.users.find(u => u.id === S.me.id) || null;
}

/* Cabecera: nombre e iniciales del usuario */
function paintWho(){
  const n = $('#whoName'), a = $('#whoAvatar');
  if (n) n.textContent = S.me ? S.me.name : '';
  if (a) a.textContent = S.me ? initials(S.me.name) : '';
  document.body.dataset.admin = S.me && S.me.isAdmin ? '1' : '0';
}
const appUrl = id => `visor.html?app=${encodeURIComponent(id)}`;
