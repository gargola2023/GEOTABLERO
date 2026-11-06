/* =================================================================
   GeoTablero · portal (index.html): acceso, aplicaciones y usuarios
   ================================================================= */
(() => {
const isAdmin = () => !!(S.me && S.me.isAdmin);
const params = new URLSearchParams(location.search);

/* Solo se permite volver a una página de aplicación de este mismo sitio */
function safeNext(){
  const n = params.get('next');
  return n && /^visor\.html\?app=[\w-]+$/.test(n) ? n : null;
}

/* ---------- Vistas ---------- */
const VIEWS = ['vLoading', 'vLogin', 'vHome', 'vUsers', 'vConns'];
function show(v){
  VIEWS.forEach(id => $('#' + id).hidden = id !== v);
  $('#nav').hidden = v === 'vLogin' || v === 'vLoading';
  $('#navApps').setAttribute('aria-current', v === 'vHome' ? 'page' : 'false');
  $('#navUsers').setAttribute('aria-current', v === 'vUsers' ? 'page' : 'false');
  $('#navConns').setAttribute('aria-current', v === 'vConns' ? 'page' : 'false');
  if (v === 'vUsers') history.replaceState(null, '', '#usuarios');
  else if (v === 'vConns') history.replaceState(null, '', '#conexiones');
  else if (v === 'vHome') history.replaceState(null, '', location.pathname);
}

/* ---------- Acceso ---------- */
DEMO.forEach(d => {
  const r = d.isAdmin ? 'admin' : d.login === 'editor' ? 'editor' : 'viewer';
  $('#demoList').append(el('button', { type:'button', onclick:() => { $('#loginUser').value = d.login; $('#loginPass').value = d.pass; $('#loginPass').focus(); } },
    el('span', {}, `${d.login} / ${d.pass}`), el('span', { class:'role ' + r }, ROLE_NAME[r])));
});
function showLogin(){
  $('#demoBox').hidden = !S.users.some(u => u.demo);
  show('vLogin'); setTimeout(() => $('#loginUser').focus(), 0);
}
$('#formLogin').addEventListener('submit', async e => {
  e.preventDefault();
  await reloadStore();
  const login = $('#loginUser').value.trim().toLowerCase(), pass = $('#loginPass').value;
  const u = S.users.find(x => x.login === login);
  if (!u || u.pass !== await hashPass(login, pass)){ $('#loginErr').textContent = 'Usuario o contraseña incorrectos.'; return; }
  $('#loginErr').textContent = ''; $('#loginPass').value = '';
  S.me = u; setSession(u.id); paintWho();
  const next = safeNext();
  if (next){ location.href = next; return; }
  goHome();
});
$('#btnLogout').addEventListener('click', () => { S.me = null; clearSession(); paintWho(); history.replaceState(null, '', location.pathname); showLogin(); });

/* ---------- Aplicaciones ---------- */
$('#navApps').addEventListener('click', () => goHome());
function goHome(){ renderHome(); show('vHome'); }

function drawThumb(canvas, pts){
  const w = canvas.clientWidth || 300, h = canvas.clientHeight || 96, dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d'); g.scale(dpr, dpr);
  g.strokeStyle = cssVar('--line'); g.lineWidth = 1;
  for (let x = 0; x < w; x += 24){ g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, h); g.stroke(); }
  for (let y = 0; y < h; y += 24){ g.beginPath(); g.moveTo(0, y + .5); g.lineTo(w, y + .5); g.stroke(); }
  if (!pts || !pts.length) return;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max(x1 - x0, y1 - y0, .01) * .15; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  const s = Math.min(w / (x1 - x0), h / (y1 - y0)), ox = (w - (x1 - x0) * s) / 2, oy = (h - (y1 - y0) * s) / 2;
  pts.forEach(([x, y, c]) => { g.fillStyle = c || cssVar('--accent'); g.beginPath(); g.arc(ox + (x - x0) * s, h - (oy + (y - y0) * s), 3.2, 0, Math.PI * 2); g.fill(); });
}
function renderHome(){
  const box = $('#appCards'); box.innerHTML = '';
  const mine = S.apps.filter(a => roleFor(S.me, a)).sort((a, b) => b.updatedAt - a.updatedAt);
  const n = S.apps.length;
  $('#homeSub').textContent = isAdmin()
    ? `${n} aplicación${n === 1 ? '' : 'es'} en total. Cada una se abre en su propia página, con un enlace que puedes compartir.`
    : `Tienes acceso a ${mine.length} aplicación${mine.length === 1 ? '' : 'es'}.`;
  if (!mine.length){
    box.append(el('div', { class:'empty', style:'grid-column:1/-1' }, isAdmin() ? 'Aún no hay aplicaciones. Crea la primera con "Nueva aplicación".' : 'Todavía no tienes aplicaciones asignadas. Pídele acceso a un administrador.'));
    return;
  }
  mine.forEach(a => {
    const r = roleFor(S.me, a), canvas = el('canvas'), url = appUrl(a.id);
    const nAccess = Object.keys(a.access || {}).length, s = a.stats || { layers:0, charts:0, kpis:0 };
    box.append(el('article', { class:'card' },
      el('a', { class:'mapthumb', href:url, 'aria-label':`Abrir ${a.name}` }, canvas, el('span', { class:'role ' + r }, ROLE_NAME[r])),
      el('div', { class:'body' },
        el('h3', {}, a.name),
        el('div', { class:'desc' }, a.description || ''),
        el('div', { class:'stats' }, el('span', {}, `${s.layers} capas`), el('span', {}, `${s.kpis} indicadores`), el('span', {}, `${s.charts} gráficos`), isAdmin() ? el('span', {}, `${nAccess} usuario${nAccess === 1 ? '' : 's'}`) : null),
        el('div', { class:'stats', style:'padding-top:0' }, `Actualizada ${fmtDate(a.updatedAt)}`)),
      el('div', { class:'foot' },
        el('a', { class:'btn primary', href:url }, 'Abrir'),
        el('span', { class:'spacer' }),
        el('button', { class:'icon-btn', title:'Copiar enlace de la aplicación', 'aria-label':'Copiar enlace', onclick:() => copyText(new URL(url, location.href).href) }, svg(ICON.link)),
        isAdmin() ? el('button', { class:'icon-btn', title:'Accesos', 'aria-label':'Accesos', onclick:() => openAccess(a) }, svg(ICON.users)) : null,
        isAdmin() ? el('button', { class:'icon-btn', title:'Editar nombre y descripción', 'aria-label':'Editar', onclick:() => openAppDialog(a) }, svg(ICON.edit)) : null,
        isAdmin() ? el('button', { class:'icon-btn', title:'Duplicar', 'aria-label':'Duplicar', onclick:() => duplicateApp(a) }, svg(ICON.copy)) : null,
        isAdmin() ? el('button', { class:'icon-btn', title:'Eliminar', 'aria-label':'Eliminar', onclick:() => deleteApp(a) }, svg(ICON.trash)) : null)));
    requestAnimationFrame(() => drawThumb(canvas, a.thumb));
  });
}

const dlgApp = $('#dlgApp'); let editingApp = null;
$('#btnNewApp').addEventListener('click', () => openAppDialog(null));
function openAppDialog(a){
  editingApp = a;
  $('#dlgAppTitle').textContent = a ? 'Editar aplicación' : 'Nueva aplicación';
  $('#btnAppOk').textContent = a ? 'Guardar' : 'Crear';
  $('#appName').value = a ? a.name : ''; $('#appDesc').value = a ? (a.description || '') : ''; $('#appErr').textContent = '';
  $('#appTplField').hidden = !!a;
  const sel = $('#appTpl'); sel.innerHTML = '';
  sel.append(el('option', { value:'empty' }, 'Vacía'), el('option', { value:'sample' }, 'Datos de ejemplo (Región Metropolitana)'));
  S.apps.forEach(x => sel.append(el('option', { value:'copy:' + x.id }, `Copia de: ${x.name}`)));
  dlgApp.showModal(); setTimeout(() => $('#appName').focus(), 0);
}
$('#btnAppOk').addEventListener('click', async () => {
  const name = $('#appName').value.trim(), desc = $('#appDesc').value.trim();
  if (!name) return $('#appErr').textContent = 'Ponle un nombre a la aplicación.';
  if (editingApp){
    await patchApp(editingApp.id, { name, description: desc });
    dlgApp.close(); renderHome(); toast('Aplicación actualizada'); return;
  }
  const tpl = $('#appTpl').value;
  let st = tpl === 'sample' ? sampleState() : emptyState();
  if (tpl.startsWith('copy:')) st = structuredClone((await DB.get('app:' + tpl.slice(5))) || emptyState());
  const a = { id: nid('A'), name, description: desc, createdBy: S.me.id, createdAt: Date.now(), updatedAt: Date.now(), access:{}, stats: statsOf(st), thumb: thumbData(st) };
  await reloadStore(); S.apps.push(a);
  await DB.set('app:' + a.id, st); await saveApps();
  dlgApp.close(); renderHome(); toast('Aplicación creada. Asígnale usuarios con el ícono de accesos.');
});
async function duplicateApp(a){
  const st = structuredClone((await DB.get('app:' + a.id)) || emptyState());
  const c = { ...structuredClone(a), id: nid('A'), name: a.name + ' (copia)', createdBy: S.me.id, createdAt: Date.now(), updatedAt: Date.now() };
  await reloadStore(); S.apps.push(c);
  await DB.set('app:' + c.id, st); await saveApps(); renderHome(); toast('Aplicación duplicada con los mismos accesos');
}
async function deleteApp(a){
  if (!await confirmAsk(`Eliminar "${a.name}"`, 'Se borran sus capas, indicadores y gráficos, y su enlace dejará de funcionar. Esta acción no se puede deshacer.', 'Eliminar')) return;
  await reloadStore(); S.apps = S.apps.filter(x => x.id !== a.id);
  await DB.del('app:' + a.id); await saveApps(); renderHome(); toast('Aplicación eliminada');
}

/* ---------- Accesos de una aplicación ---------- */
const dlgAccess = $('#dlgAccess'); let accessApp = null;
function accessSelect(val){
  const s = el('select', {}, el('option', { value:'' }, 'Sin acceso'), el('option', { value:'viewer' }, 'Visualizador'), el('option', { value:'editor' }, 'Editor'));
  s.value = val || ''; return s;
}
const byRoleName = (x, y) => (y.isAdmin - x.isAdmin) || x.name.localeCompare(y.name, 'es');
function openAccess(a){
  accessApp = a; $('#dlgAccessTitle').textContent = `Accesos · ${a.name}`;
  const list = $('#accessList'); list.innerHTML = '';
  S.users.slice().sort(byRoleName).forEach(u => {
    const ctl = u.isAdmin ? el('span', { class:'role admin', style:'justify-self:start' }, 'Administrador') : accessSelect(a.access[u.id]);
    if (!u.isAdmin) ctl.dataset.uid = u.id;
    list.append(el('div', { class:'access-row' }, el('div', { class:'who2' }, el('b', {}, u.name), el('span', {}, u.login)), ctl));
  });
  dlgAccess.showModal();
}
$('#btnAccessOk').addEventListener('click', async () => {
  const acc = {};
  document.querySelectorAll('#accessList select[data-uid]').forEach(s => { if (s.value) acc[s.dataset.uid] = s.value; });
  await patchApp(accessApp.id, { access: acc }); dlgAccess.close(); renderHome(); toast('Accesos guardados');
});

/* ---------- Usuarios ---------- */
$('#navUsers').addEventListener('click', () => goUsers());
function goUsers(){ if (!isAdmin()) return goHome(); renderUsers(); show('vUsers'); }
function renderUsers(){
  const tb = $('#userRows'); tb.innerHTML = '';
  S.users.slice().sort(byRoleName).forEach(u => {
    const chips = el('div', { class:'chips' });
    if (u.isAdmin) chips.append(el('span', { class:'chip' }, 'Todas las aplicaciones'));
    else {
      const own = S.apps.filter(a => a.access[u.id]);
      if (!own.length) chips.append(el('span', { style:'color:var(--muted);font-size:12px' }, 'Sin aplicaciones asignadas'));
      own.forEach(a => chips.append(el('span', { class:'chip' }, el('b', {}, ROLE_NAME[a.access[u.id]]), ' · ', a.name)));
    }
    tb.append(el('tr', {},
      el('td', {}, el('div', { class:'person' }, el('span', { class:'avatar' }, initials(u.name)), el('div', {}, el('div', {}, u.name, u.id === S.me.id ? el('span', { style:'color:var(--muted)' }, ' (tú)') : null), el('div', { class:'uname' }, u.login)))),
      el('td', {}, el('span', { class:'role ' + (u.isAdmin ? 'admin' : 'viewer') }, u.isAdmin ? 'Administrador' : 'Usuario')),
      el('td', {}, chips),
      el('td', { class:'r' },
        el('button', { class:'icon-btn', title:'Editar', 'aria-label':'Editar usuario', onclick:() => openUserDialog(u) }, svg(ICON.edit)),
        el('button', { class:'icon-btn', title:'Eliminar', 'aria-label':'Eliminar usuario', onclick:() => deleteUser(u) }, svg(ICON.trash)))));
  });
}
const dlgUser = $('#dlgUser'); let editingUser = null;
$('#btnNewUser').addEventListener('click', () => openUserDialog(null));
$('#uAdmin').addEventListener('change', () => { $('#uAccessWrap').hidden = $('#uAdmin').checked; });
function openUserDialog(u){
  editingUser = u;
  $('#dlgUserTitle').textContent = u ? 'Editar usuario' : 'Nuevo usuario';
  $('#uName').value = u ? u.name : ''; $('#uLogin').value = u ? u.login : ''; $('#uPass').value = '';
  $('#uPassLabel').textContent = u ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña';
  $('#uAdmin').checked = u ? u.isAdmin : false; $('#uErr').textContent = '';
  $('#uAccessWrap').hidden = $('#uAdmin').checked;
  const list = $('#uAccessList'); list.innerHTML = '';
  if (!S.apps.length) list.append(el('div', { class:'access-row', style:'grid-template-columns:1fr;color:var(--muted)' }, 'No hay aplicaciones creadas.'));
  S.apps.forEach(a => { const s = accessSelect(u ? a.access[u.id] : ''); s.dataset.aid = a.id; list.append(el('div', { class:'access-row' }, el('div', { class:'who2' }, el('b', {}, a.name)), s)); });
  dlgUser.showModal(); setTimeout(() => $('#uName').focus(), 0);
}
$('#btnUserOk').addEventListener('click', async () => {
  const name = $('#uName').value.trim(), login = $('#uLogin').value.trim().toLowerCase(), pass = $('#uPass').value, admin = $('#uAdmin').checked;
  const err = m => { $('#uErr').textContent = m; };
  if (!name) return err('Escribe el nombre.');
  if (!/^[a-z0-9._-]{3,30}$/.test(login)) return err('El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.');
  if (S.users.some(x => x.login === login && x !== editingUser)) return err('Ya existe un usuario con ese nombre de acceso.');
  if (!editingUser && pass.length < 6) return err('La contraseña debe tener al menos 6 caracteres.');
  if (editingUser && pass && pass.length < 6) return err('La nueva contraseña debe tener al menos 6 caracteres.');
  if (editingUser && editingUser.isAdmin && !admin && S.users.filter(x => x.isAdmin).length === 1) return err('Debe quedar al menos un administrador.');
  if (editingUser && editingUser.login !== login && !pass) return err('Si cambias el usuario, escribe también una contraseña nueva.');
  const u = editingUser || { id: nid('U'), createdAt: Date.now() };
  u.name = name; u.login = login; u.isAdmin = admin; delete u.demo;
  if (pass) u.pass = await hashPass(login, pass);
  if (!editingUser) S.users.push(u);
  const apps = (await DB.get('apps')) || S.apps;
  document.querySelectorAll('#uAccessList select[data-aid]').forEach(s => {
    const a = apps.find(x => x.id === s.dataset.aid); if (!a) return;
    if (!admin && s.value) a.access[u.id] = s.value; else delete a.access[u.id];
  });
  S.apps = apps;
  await saveUsers(); await saveApps();
  if (u.id === S.me.id){ S.me = u; paintWho(); }
  dlgUser.close(); toast(editingUser ? 'Usuario actualizado' : 'Usuario creado');
  if (u.id === S.me.id && !u.isAdmin) goHome(); else renderUsers();
});
async function deleteUser(u){
  if (u.id === S.me.id) return toast('No puedes eliminar tu propia cuenta');
  if (u.isAdmin && S.users.filter(x => x.isAdmin).length === 1) return toast('Debe quedar al menos un administrador');
  if (!await confirmAsk(`Eliminar a ${u.name}`, 'Perderá el acceso a todas sus aplicaciones. Las aplicaciones no se borran.', 'Eliminar usuario')) return;
  await reloadStore();
  S.users = S.users.filter(x => x.id !== u.id); S.apps.forEach(a => delete a.access[u.id]);
  await saveUsers(); await saveApps(); renderUsers(); toast('Usuario eliminado');
}


/* ---------- Conexiones a bases de datos ---------- */
$('#navConns').addEventListener('click', () => goConns());
function goConns(){ if (!isAdmin()) return goHome(); renderConns(); show('vConns'); }
const connStatus = new Map();   // id → {ok, msg}
function renderConns(){
  const tb = $('#connRows'); tb.innerHTML = '';
  if (!S.connections.length){
    tb.append(el('tr', {}, el('td', { colspan:'5', style:'color:var(--muted);padding:18px 14px' }, 'Aún no hay conexiones. Crea una para que los editores puedan agregar capas desde PostGIS.')));
    return;
  }
  S.connections.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).forEach(c => {
    const st = connStatus.get(c.id);
    const badge = st ? el('span', { class:'role ' + (st.ok ? 'editor' : 'admin'), title: st.msg }, st.ok ? 'Conectada' : 'Con error') : el('span', { style:'color:var(--muted);font-size:12px' }, 'Sin probar');
    tb.append(el('tr', {},
      el('td', {}, el('div', { class:'person' }, el('span', { class:'avatar' }, svg(ICON.db)), el('div', {}, el('div', {}, c.name), el('div', { class:'uname' }, CONN_TYPES[c.type].write ? 'lectura y escritura' : 'solo lectura')))),
      el('td', {}, CONN_TYPES[c.type].name),
      el('td', {}, el('span', { class:'uname', style:'word-break:break-all' }, c.url)),
      el('td', {}, badge),
      el('td', { class:'r' },
        el('button', { class:'icon-btn', title:'Probar', 'aria-label':'Probar conexión', onclick: async ev => {
          const b = ev.currentTarget; b.disabled = true;
          try { const t = await dbListTables(c); connStatus.set(c.id, { ok:true, msg:`${t.length} capas con geometría` }); toast(`${c.name}: ${t.length} capa(s) con geometría`); }
          catch (e){ connStatus.set(c.id, { ok:false, msg:e.message }); toast(`${c.name}: ${e.message}`); }
          b.disabled = false; renderConns();
        }}, svg(ICON.refresh)),
        el('button', { class:'icon-btn', title:'Editar', 'aria-label':'Editar conexión', onclick:() => openConnDialog(c) }, svg(ICON.edit)),
        el('button', { class:'icon-btn', title:'Eliminar', 'aria-label':'Eliminar conexión', onclick:() => deleteConn(c) }, svg(ICON.trash)))));
  });
}
const dlgConn = $('#dlgConn'); let editingConn = null, draftConnId = null;
Object.entries(CONN_TYPES).forEach(([k, t]) => $('#cnType').append(el('option', { value:k }, t.name)));
const CONN_HELP = {
  supabase: 'Usa la URL del proyecto (Project Settings → API) y la clave <b>pública</b>. Las tablas deben tener una columna geometry y políticas RLS que permitan leer (y escribir, si los editores van a guardar cambios). PostGIS 3 entrega la geometría como GeoJSON.',
  postgrest: 'URL base de tu PostgREST. Si la API exige autenticación, pega un token JWT con el rol adecuado; nunca uno de superusuario.',
  ogcapi: 'URL base del servicio (la que contiene /collections). pg_featureserv expone cada tabla PostGIS como una colección. Solo lectura.',
  wfs: 'URL del servicio WFS, por ejemplo https://servidor/geoserver/ows o …/geoserver/espacio/wfs. Se piden los datos en GeoJSON y EPSG:4326. Solo lectura.'
};
function syncConnForm(){
  const t = $('#cnType').value, T = CONN_TYPES[t];
  $('#cnUrl').placeholder = T.url;
  $('#cnKeyField').hidden = !T.key; $('#cnKeyLabel').textContent = T.key || 'Clave';
  $('#cnSchemaField').hidden = !(t === 'supabase' || t === 'postgrest');
  $('#cnHelp').innerHTML = CONN_HELP[t];
}
$('#cnType').addEventListener('change', () => { syncConnForm(); $('#cnResult').hidden = true; });
$('#btnNewConn').addEventListener('click', () => openConnDialog(null));
function openConnDialog(c){
  editingConn = c; draftConnId = c ? c.id : nid('D');
  $('#dlgConnTitle').textContent = c ? 'Editar conexión' : 'Nueva conexión';
  $('#cnName').value = c ? c.name : ''; $('#cnType').value = c ? c.type : 'supabase';
  $('#cnUrl').value = c ? c.url : ''; $('#cnKey').value = c ? (c.key || '') : ''; $('#cnSchema').value = c ? (c.schema || '') : '';
  $('#cnErr').textContent = ''; $('#cnResult').hidden = true;
  syncConnForm(); dlgConn.showModal(); setTimeout(() => $('#cnName').focus(), 0);
}
function readConnForm(){
  const c = { id: draftConnId, name: $('#cnName').value.trim(), type: $('#cnType').value,
    url: $('#cnUrl').value.trim().replace(/\/+$/, ''), key: $('#cnKey').value.trim(), schema: $('#cnSchema').value.trim() };
  if (!CONN_TYPES[c.type].key) c.key = '';
  if (!(c.type === 'supabase' || c.type === 'postgrest')) c.schema = '';
  if (!c.name) throw new Error('Ponle un nombre a la conexión.');
  if (!/^https?:\/\//.test(c.url)) throw new Error('La URL debe comenzar con https:// (o http:// en una red local).');
  const kp = connKeyProblem(c); if (kp) throw new Error(kp);
  return c;
}
$('#btnConnTest').addEventListener('click', async () => {
  const b = $('#btnConnTest'), res = $('#cnResult'); $('#cnErr').textContent = '';
  let c; try { c = readConnForm(); } catch (e){ $('#cnErr').textContent = e.message; return; }
  b.disabled = true; b.textContent = 'Probando…'; res.hidden = true;
  try {
    const t = await dbListTables(c);
    res.hidden = false;
    res.innerHTML = t.length
      ? `<b>Conexión correcta.</b> ${t.length} capa${t.length === 1 ? '' : 's'} con geometría: ${t.slice(0, 8).map(x => esc(x.title)).join(', ')}${t.length > 8 ? '…' : ''}`
      : '<b>La conexión responde</b>, pero no encontré tablas o capas con geometría visibles para esta clave.';
    connStatus.set(c.id, { ok:true, msg:`${t.length} capas` });
  } catch (e){ $('#cnErr').textContent = e.message; connStatus.set(c.id, { ok:false, msg:e.message }); }
  finally { b.disabled = false; b.textContent = 'Probar conexión'; }
});
$('#btnConnOk').addEventListener('click', async () => {
  let c; try { c = readConnForm(); } catch (e){ $('#cnErr').textContent = e.message; return; }
  await reloadStore();
  const i = S.connections.findIndex(x => x.id === c.id);
  if (i >= 0) S.connections[i] = c; else S.connections.push(c);
  await saveConnections(); dlgConn.close(); renderConns(); toast(i >= 0 ? 'Conexión actualizada' : 'Conexión creada');
});
async function deleteConn(c){
  if (!await confirmAsk(`Eliminar "${c.name}"`, 'Las capas que ya la usan conservarán su última copia de datos, pero no podrán volver a actualizarse ni guardar ediciones.', 'Eliminar conexión')) return;
  await reloadStore(); S.connections = S.connections.filter(x => x.id !== c.id);
  await saveConnections(); renderConns(); toast('Conexión eliminada');
}

/* ---------- Publicar y respaldar ---------- */
$('#btnExport').addEventListener('click', async () => {
  await reloadStore();
  const data = await exportAll();
  const hasTokens = Object.values(data.states).some(st => st && st.layers.some(l => l.spec && l.spec.token)) || S.connections.some(c => c.key && c.type === 'postgrest');
  downloadBlob(new Blob([JSON.stringify(data)], { type:'application/json' }), 'geotablero.json');
  toast(hasTokens ? 'Exportado. Ojo: incluye tokens de ArcGIS o PostgREST; no lo subas a un repositorio público.' : 'Exportado como geotablero.json');
});
$('#btnImport').addEventListener('click', () => $('#importInput').click());
$('#importInput').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { await importData(JSON.parse(await readText(f)), 'del archivo'); }
  catch (err){ toast(err.message || String(err)); }
});
$('#btnPublished').addEventListener('click', async () => {
  const d = await fetchPublished();
  if (!d) return toast(location.protocol === 'file:' ? 'Esta opción funciona con el sitio publicado (GitHub Pages), no abriendo el archivo local.' : 'El sitio no tiene data/geotablero.json publicado.');
  await importData(d, 'publicados en el sitio');
});
async function importData(d, origen){
  if (!Array.isArray(d.users) || !Array.isArray(d.apps)) throw new Error('El archivo no es un respaldo de GeoTablero.');
  if (!await confirmAsk('Reemplazar datos de este navegador', `Se cambiarán los usuarios y aplicaciones actuales por los ${origen}: ${d.users.length} usuario(s) y ${d.apps.length} aplicación(es).`, 'Reemplazar')) return;
  await importAll(d);
  const still = S.users.find(u => S.me && u.id === S.me.id);
  if (!still){ S.me = null; clearSession(); paintWho(); showLogin(); toast('Datos cargados. Inicia sesión con una cuenta de esos datos.'); return; }
  S.me = still; paintWho(); renderUsers(); toast('Datos cargados');
}

/* Refrescar al volver a la pestaña (por si se editó una aplicación en otra) */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !S.me) return;
  await reloadStore();
  if (!S.me){ showLogin(); return; }
  if (!$('#vHome').hidden) renderHome();
  if (!$('#vUsers').hidden) renderUsers();
  if (!$('#vConns').hidden) renderConns();
});

/* ---------- Inicio ---------- */
(async () => {
  await loadStore();
  paintWho();
  if (!S.me) return showLogin();
  const next = safeNext();
  if (next){ location.replace(next); return; }
  if (location.hash === '#usuarios' && isAdmin()) goUsers();
  else if (location.hash === '#conexiones' && isAdmin()) goConns();
  else goHome();
})();
})();
