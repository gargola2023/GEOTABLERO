/* =================================================================
   GeoTablero · página de una aplicación (visor.html?app=ID)
   ================================================================= */
(() => {
let currentApp = null, role = null;
const canEdit = () => role === 'admin' || role === 'editor';

/* =================================================================
   Mapa y mapas base
   ================================================================= */
const map = L.map('map', { zoomControl: true, maxZoom: 20 }).setView([-33.47, -70.65], 11);
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
map.on('mousemove', e => { $('#coord').textContent = `WGS84 · ${e.latlng.lat.toFixed(5)}°, ${e.latlng.lng.toFixed(5)}°`; });
map.createPane('labels'); map.getPane('labels').style.zIndex = 450; map.getPane('labels').style.pointerEvents = 'none';

const ESRI = s => `https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`;
const BASEMAPS = [
  { id:'voyager', name:'Calles', url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr:'© OpenStreetMap © CARTO', native:20, sub:'abcd', thumb:'linear-gradient(135deg,#f5f3ee 40%,#a9d3e8 40% 55%,#d8ecc4 55%)' },
  { id:'positron', name:'Claro', url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr:'© OpenStreetMap © CARTO', native:20, sub:'abcd', thumb:'linear-gradient(135deg,#fafafa 50%,#e0e0e0 50% 60%,#d4dadc 60%)' },
  { id:'dark', name:'Oscuro', url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr:'© OpenStreetMap © CARTO', native:20, sub:'abcd', thumb:'linear-gradient(135deg,#262626 50%,#3a3a3a 50% 60%,#1a1d21 60%)' },
  { id:'sat', name:'Satelital', url:ESRI('World_Imagery'), attr:'© Esri, Maxar, Earthstar Geographics', native:18, thumb:'linear-gradient(135deg,#3d4a2f 30%,#6b6450 30% 55%,#2c3b3f 55%)' },
  { id:'hybrid', name:'Satelital con nombres', url:ESRI('World_Imagery'), labels:ESRI('Reference/World_Boundaries_and_Places'), attr:'© Esri, Maxar, Earthstar Geographics', native:18, thumb:'linear-gradient(135deg,#3d4a2f 30%,#6b6450 30% 55%,#2c3b3f 55%)' },
  { id:'topo', name:'Topográfico', url:ESRI('World_Topo_Map'), attr:'© Esri, HERE, Garmin, USGS', native:19, thumb:'linear-gradient(135deg,#efe9d8 45%,#c9dbb0 45% 70%,#b7d0e3 70%)' },
  { id:'relief', name:'Relieve', url:ESRI('World_Shaded_Relief'), attr:'© Esri, USGS', native:13, thumb:'repeating-linear-gradient(160deg,#e8e4dc 0 6px,#cfc8bb 6px 7px)' },
  { id:'gray', name:'Gris', url:ESRI('Canvas/World_Light_Gray_Base'), labels:ESRI('Canvas/World_Light_Gray_Reference'), attr:'© Esri, HERE, Garmin', native:16, thumb:'linear-gradient(135deg,#e6e6e6 50%,#d0d0d0 50%)' },
  { id:'osm', name:'OpenStreetMap', url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr:'© OpenStreetMap', native:19, needsHttp:true, thumb:'linear-gradient(135deg,#f2efe9 40%,#aad3df 40% 55%,#c8e6a0 55%)' },
  { id:'none', name:'Sin mapa base', url:null, thumb:'repeating-conic-gradient(var(--surface-2) 0 25%, var(--line) 0 50%) 0 0/10px 10px' }
];
let baseLayer = null, labelLayer = null, baseId = 'voyager';
function setBasemap(id){
  const b = BASEMAPS.find(x => x.id === id) || BASEMAPS[0];
  if (baseLayer) map.removeLayer(baseLayer);
  if (labelLayer) map.removeLayer(labelLayer);
  baseLayer = labelLayer = null;
  const btn = document.querySelector(`.bm[data-id="${b.id}"]`);
  if (b.url){
    const opts = { attribution: b.attr, maxZoom: 20, maxNativeZoom: b.native, subdomains: b.sub || 'abc' };
    baseLayer = L.tileLayer(b.url, opts).addTo(map).bringToBack();
    if (b.labels) labelLayer = L.tileLayer(b.labels, { ...opts, attribution: '', pane: 'labels' }).addTo(map);
    let ok = 0, bad = 0, warned = false;
    baseLayer.on('tileload', () => { ok++; if (btn) btn.classList.remove('bm-fail'); });
    baseLayer.on('tileerror', () => {
      bad++;
      if (!warned && bad >= 6 && ok === 0){
        warned = true; if (btn) btn.classList.add('bm-fail');
        toast(b.needsHttp && location.protocol === 'file:'
          ? `${b.name} bloquea páginas abiertas como archivo local. Usa otro mapa base o abre la app desde un servidor (GitHub Pages).`
          : `${b.name} no está respondiendo. Prueba con otro mapa base.`);
      }
    });
  }
  baseId = b.id;
  document.querySelectorAll('.bm').forEach(n => n.setAttribute('aria-pressed', n.dataset.id === b.id));
}
function renderBasemapButtons(){
  const box = $('#basemaps'); if (!box) return;
  box.innerHTML = '';
  BASEMAPS.forEach(b => box.append(el('button', { class:'bm', 'data-id':b.id, 'aria-pressed': String(b.id === baseId), onclick:() => { setBasemap(b.id); scheduleSave(); } }, el('div', { class:'thumb', style:`background:${b.thumb}` }), el('span', {}, b.name))));
}

/* =================================================================
   Capas
   ================================================================= */
const layers = [];   // {id,name,kind,group|tile,spec,editable,geom,fields,color,visible,opacity}
let targetId = null, colorIdx = 0, loading = false;
const nextColor = () => palette()[colorIdx++ % 8];
const baseGeom = t => !t ? null : t.replace('Multi','');
function inferGeom(fc){
  const s = new Set(fc.features.map(f => baseGeom(f.geometry && f.geometry.type)).filter(Boolean));
  return s.size === 1 ? [...s][0] : 'Mixed';
}
/* Color de una entidad según la simbología de su capa */
function featureColor(lyr, feature){
  const st = lyr.style;
  if (!feature || st.mode === 'single' || !st.field) return st.fill;
  const v = feature.properties ? feature.properties[st.field] : undefined;
  if (st.mode === 'categories'){
    const c = st.cats.find(x => String(x.value) === String(v ?? ''));
    return c ? c.color : st.other;
  }
  if (st.mode === 'ranges'){
    const n = v === '' || v == null ? NaN : +v;
    if (!Number.isFinite(n) || st.breaks.length < 2) return st.other;
    return st.colors[classIndex(st.breaks, n)] || st.other;
  }
  return st.fill;
}
function geomKind(lyr, feature){
  const t = feature && feature.geometry ? feature.geometry.type : lyr.geom;
  return /Point/.test(t) ? 'pt' : /LineString/.test(t) ? 'ln' : 'pg';
}
function featureStyle(lyr, feature){
  const st = lyr.style, color = featureColor(lyr, feature), k = geomKind(lyr, feature);
  return {
    color: k === 'ln' || st.strokeSame ? color : st.stroke,
    weight: st.weight, opacity: st.strokeOpacity, dashArray: st.dash || null,
    fillColor: color, fillOpacity: k === 'ln' ? 0 : st.fillOpacity,
    radius: st.radius
  };
}
const styleFor = lyr => featureStyle(lyr, null);
/* Etiquetas permanentes con el valor de un campo */
function applyLabels(lyr){
  const lb = lyr.style.label || {};
  lyr.group.eachLayer(f => {
    if (f.getTooltip()) f.unbindTooltip();
    if (!lb.field) return;
    const v = f.feature && f.feature.properties ? f.feature.properties[lb.field] : null;
    if (v === '' || v == null) return;
    f.bindTooltip(typeof v === 'number' ? fmt.format(v) : String(v), { permanent:true, direction: geomKind(lyr, f.feature) === 'pt' ? 'top' : 'center', className:`gt-label size-${lb.size || 'm'}`, interactive:false, offset: geomKind(lyr, f.feature) === 'pt' ? [0, -lyr.style.radius] : [0, 0] });
  });
}
function applyStyle(lyr){
  if (lyr.style.mode === 'single') lyr.color = lyr.style.fill;
  lyr.group.eachLayer(f => { if (f.setStyle) f.setStyle(featureStyle(lyr, f.feature)); });
  applyLabels(lyr);
}
const editAllowed = lyr => lyr.editable && canEdit();

function bindFeature(lyr, f){
  f.options.pmIgnore = !editAllowed(lyr);
  f.on('click', ev => { L.DomEvent.stopPropagation(ev); openPopup(lyr, f, ev.latlng); });
  f._gtLayer = lyr.id;
  f.on('pm:edit pm:dragend', () => { scheduleRefresh(); if (dbWritable(lyr)) queueGeomSave(lyr, f); });
}

function addVectorLayer(fc, o = {}){
  const lyr = { id: o.id || nid('L'), name: o.name || 'Capa sin nombre', kind:'vector', editable: !!o.editable, color: toHex(o.color || nextColor()), visible: o.visible !== false, opacity: 1, source: o.source, sourceUrl: o.sourceUrl, db: o.db ? { ...o.db } : null };
  lyr.geom = o.geom || inferGeom(fc);
  lyr.style = o.style ? { ...defaultStyle(lyr.color, lyr.geom), ...structuredClone(o.style) } : defaultStyle(lyr.color, lyr.geom);
  lyr.group = L.geoJSON(null, {
    style: feat => featureStyle(lyr, feat),
    pointToLayer: (feat, ll) => L.circleMarker(ll, featureStyle(lyr, feat)),
    onEachFeature: (feat, f) => bindFeature(lyr, f)
  });
  lyr.group.addData(fc);
  applyLabels(lyr);
  const keys = new Set(o.fields || []);
  fc.features.forEach(f => Object.keys(f.properties || {}).forEach(k => keys.add(k)));
  lyr.fields = [...keys];
  if (lyr.visible) lyr.group.addTo(map);
  layers.push(lyr);
  if (lyr.db) startDbTimer(lyr);
  if (lyr.editable && canEdit() && !loading) targetId = lyr.id;
  if (!loading){ refreshEditing(); renderLayers(); scheduleRefresh(); }
  return lyr;
}

/* Las capas ráster se guardan como especificación para poder recrearlas al abrir la aplicación */
/* Cada ráster va en su propio panel del mapa, para aplicarle brillo, contraste, etc. */
function rasterPane(id){
  const name = 'r-' + id;
  if (!map.getPane(name)){ const p = map.createPane(name); p.style.zIndex = 300; }
  return name;
}
function orderRasterPanes(){ layers.filter(l => l.kind === 'raster').forEach((l, i) => { const p = map.getPane('r-' + l.id); if (p) p.style.zIndex = 300 + i; }); }
function makeRaster(spec, pane){
  const tok = spec.token || undefined;
  let t;
  switch (spec.type){
    case 'xyz': t = L.tileLayer(spec.url, { maxZoom: 20, pane }); break;
    case 'wms': t = L.tileLayer.wms(spec.url, { layers: spec.layers, format:'image/png', transparent:true, maxZoom: 20, pane }); break;
    case 'ags-tiled': t = L.esri.tiledMapLayer({ url: spec.url, token: tok, maxZoom: 20, pane }); break;
    case 'ags-dynamic': t = L.esri.dynamicMapLayer({ url: spec.url, token: tok, format:'png32', transparent:true, f:'image', layers: spec.layers, pane }); break;
    case 'ags-image': {
      const rule = spec.render ? imageRule(spec.render) : { bandIds: spec.bandIds, renderingRule: spec.renderingRule };
      t = L.esri.imageMapLayer({ url: spec.url, token: tok, format:'jpgpng', f:'image', bandIds: rule.bandIds, renderingRule: rule.renderingRule, pane });
      break;
    }
    default: throw new Error('Tipo de capa desconocido: ' + spec.type);
  }
  if (spec.type.startsWith('ags')) t.on('requesterror', ev => toast('El servicio ArcGIS rechazó la solicitud: ' + ((ev.error && ev.error.message) || 'revisa permisos o token')));
  return t;
}
function addRasterLayer(spec, name, o = {}){
  const id = o.id || nid('L'), pane = rasterPane(id);
  const lyr = { id, name, kind:'raster', spec, tile: makeRaster(spec, pane), editable:false, visible: o.visible !== false, opacity: o.opacity ?? 1, color:'var(--muted)', fields:[], sourceLabel: o.sourceLabel, bounds: o.bounds ? L.latLngBounds(o.bounds) : null };
  if (lyr.tile.setOpacity) lyr.tile.setOpacity(lyr.opacity);
  map.getPane(pane).style.filter = fxFilter(spec.fx);
  if (lyr.visible) lyr.tile.addTo(map);
  layers.push(lyr); orderRasterPanes();
  if (!loading) renderLayers();
  return lyr;
}

function featuresOf(lyr){
  if (!lyr || lyr.kind !== 'vector' || !lyr.visible) return [];
  const only = $('#extentOnly').checked, b = map.getBounds(), out = [];
  lyr.group.eachLayer(f => {
    if (only){ const inside = f.getLatLng ? b.contains(f.getLatLng()) : b.intersects(f.getBounds()); if (!inside) return; }
    out.push(f.toGeoJSON());
  });
  return out;
}
const countOf = lyr => { let n = 0; lyr.group && lyr.group.eachLayer(() => n++); return n; };

async function removeLayer(lyr){
  const deps = widgets.filter(w => w.cfg && w.cfg.layerId === lyr.id).length;
  if (!await confirmAsk(`Quitar "${lyr.name}"`, deps ? `También se quitarán ${deps} widget(s) de gráfico o indicador que dependen de esta capa.` : 'La capa se quitará de esta aplicación.', 'Quitar capa')) return;
  map.removeLayer(lyr.kind === 'vector' ? lyr.group : lyr.tile);
  stopDbTimer(lyr);
  layers.splice(layers.indexOf(lyr), 1);
  const had = widgets.length;
  widgets = widgets.filter(w => !(w.cfg && w.cfg.layerId === lyr.id));
  if (targetId === lyr.id) targetId = (layers.find(l => l.editable) || {}).id || null;
  if (widgets.length !== had) renderWidgets();
  refreshEditing(); renderLayers(); scheduleRefresh();
}
function toggleEditable(lyr){
  lyr.editable = !lyr.editable;
  lyr.group.eachLayer(f => { f.options.pmIgnore = !editAllowed(lyr); L.PM.reInitLayer(f); });
  if (lyr.editable) targetId = lyr.id;
  else if (targetId === lyr.id) targetId = (layers.find(l => l.editable) || {}).id || null;
  map.pm.disableGlobalEditMode(); map.pm.disableGlobalDragMode(); map.pm.disableGlobalRemovalMode();
  refreshEditing(); renderLayers();
}
function exportLayer(lyr){
  const blob = new Blob([JSON.stringify(lyr.group.toGeoJSON(), null, 2)], { type:'application/geo+json' });
  downloadBlob(blob, (lyr.name.replace(/[^\w\-]+/g, '_') || 'capa') + '.geojson');
}

const GEOM_LABEL = { Point:'Puntos', LineString:'Líneas', Polygon:'Polígonos', Mixed:'Mixta' };
function renderLayers(){
  const ul = $('#layerList');
  if (!ul) return scheduleSave();
  ul.innerHTML = '';
  if (!layers.length) ul.append(el('li', { class:'empty' }, canEdit() ? 'Aún no hay capas. Agrega un archivo, un servicio o crea una capa editable.' : 'Esta aplicación aún no tiene capas.'));
  [...layers].reverse().forEach(lyr => {
    const vis = el('input', { type:'checkbox', 'aria-label':'Mostrar capa', onchange:e => {
      lyr.visible = e.target.checked;
      const obj = lyr.kind === 'vector' ? lyr.group : lyr.tile;
      lyr.visible ? obj.addTo(map) : map.removeLayer(obj);
      scheduleRefresh();
    }});
    vis.checked = lyr.visible;
    const meta = el('div', { class:'meta' });
    if (lyr.kind === 'vector'){
      meta.append(layerSwatch(lyr), `${GEOM_LABEL[lyr.geom] || lyr.geom} · ${countOf(lyr)}`);
      if (canEdit()) meta.append(el('span', { class:'pill' + (lyr.editable ? '' : ' ro') }, lyr.editable ? (lyr.id === targetId ? 'Dibujando' : 'Editable') : 'Solo lectura'));
      if (lyr.source === 'arcgis') meta.append(el('span', { class:'pill ro' }, 'ArcGIS'));
      if (lyr.db){
        const c = connOf(lyr), when = lyr.db.synced ? new Intl.DateTimeFormat('es-CL', { hour:'2-digit', minute:'2-digit' }).format(new Date(lyr.db.synced)) : '';
        meta.append(el('span', { class:'pill' + (lyr.db.status ? ' err' : ' ro'), title: c ? `${c.name} · ${lyr.db.table}${lyr.db.refresh ? ` · se actualiza cada ${lyr.db.refresh} min` : ''}` : 'Conexión no disponible' },
          lyr.db.status || `PostGIS ${when}`));
      }
    } else meta.append(lyr.sourceLabel || 'Ráster · teselas');
    const name = el('div', { class:'name', title: lyr.name, onclick:() => { if (editAllowed(lyr)){ targetId = lyr.id; refreshEditing(); renderLayers(); } } }, el('strong', {}, lyr.name), meta);
    const zoomTo = () => {
      if (lyr.kind === 'vector'){ const b = lyr.group.getBounds(); b.isValid() ? map.fitBounds(b, { padding:[30,30], maxZoom: 16 }) : toast('La capa no tiene entidades'); }
      else if (lyr.bounds) map.fitBounds(lyr.bounds);
      else toast('Esta capa no informa su extensión');
    };
    const menuItems = [
      lyr.db ? { icon: ICON.refresh, label:'Recargar desde la base de datos', run:() => refreshDbLayer(lyr, false) } : null,
      canEdit() && lyr.kind === 'vector' && (!lyr.db || lyr.db.write) ? { icon: lyr.editable ? ICON.lock : ICON.pen, label: lyr.editable ? 'Bloquear edición' : 'Permitir edición y dibujo', run:() => toggleEditable(lyr) } : null,
      canEdit() && lyr.kind === 'vector' ? { icon: ICON.down, label:'Descargar GeoJSON', run:() => exportLayer(lyr) } : null,
      canEdit() ? { icon: ICON.edit, label:'Cambiar nombre', run:() => renameLayer(lyr) } : null,
      canEdit() ? { icon: ICON.trash, label:'Quitar capa', danger:true, run:() => removeLayer(lyr) } : null
    ].filter(Boolean);
    const acts = el('div', { class:'acts' },
      el('button', { class:'icon-btn', title:'Acercar a la capa', 'aria-label':'Acercar a la capa', onclick: zoomTo }, svg(ICON.zoom)),
      canEdit() ? el('button', { class:'icon-btn', title:'Simbología', 'aria-label':'Simbología', onclick:() => openSymbology(lyr) }, svg(ICON.palette)) : null,
      menuItems.length ? el('button', { class:'icon-btn', title:'Más opciones', 'aria-label':'Más opciones', 'aria-haspopup':'menu', onclick: ev => openMenu(ev.currentTarget, menuItems) }, svg(ICON.more)) : null
    );
    const li = el('li', { class:'layer' + (lyr.id === targetId && canEdit() ? ' target' : '') }, vis, name, acts);
    const leg = layerLegend(lyr, 8); if (leg) li.append(leg);
    if (lyr.kind === 'raster'){
      const op = el('span', {}, Math.round(lyr.opacity * 100) + '%');
      const r = el('input', { type:'range', min:0, max:1, step:.05, 'aria-label':'Opacidad', oninput:e => { lyr.opacity = +e.target.value; lyr.tile.setOpacity(lyr.opacity); op.textContent = Math.round(lyr.opacity * 100) + '%'; scheduleSave(); } });
      r.value = lyr.opacity;
      li.append(el('div', { class:'opacity' }, 'Opacidad', r, op));
    }
    ul.append(li);
  });
  renderLegend();
  scheduleSave();
}

/* =================================================================
   Dibujo y edición (Geoman)
   ================================================================= */
map.pm.setLang('es');
function refreshEditing(){
  const t = canEdit() ? layers.find(l => l.id === targetId && l.editable) : null;
  map.pm.removeControls();
  const banner = $('#editBanner'), hint = $('#editHint') || document.createElement('div');
  banner.classList.toggle('view', !canEdit());
  if (!canEdit()){
    banner.hidden = false; $('#editBannerText').textContent = 'Modo visualización';
    hint.innerHTML = 'Tienes perfil de <b>visualizador</b> en esta aplicación: puedes explorar capas, mapas base, indicadores y gráficos, pero no modificarlos.';
    return;
  }
  if (!t){
    banner.hidden = true;
    hint.innerHTML = 'Para dibujar, marca una capa vectorial como <b>editable</b> con el ícono del candado o crea una <b>capa nueva</b>.';
    return;
  }
  const g = t.geom;
  map.pm.addControls({
    position:'topleft', drawMarker:false, drawCircle:false, drawText:false, cutPolygon:false, rotateMode:false,
    drawCircleMarker: g === 'Point' || g === 'Mixed', drawPolyline: g === 'LineString' || g === 'Mixed',
    drawPolygon: g === 'Polygon' || g === 'Mixed', drawRectangle: g === 'Polygon' || g === 'Mixed',
    editMode:true, dragMode:true, removalMode:true
  });
  map.pm.setGlobalOptions({ layerGroup: t.group, snappable: true, pathOptions: styleFor(t), templineStyle:{ color: t.color }, hintlineStyle:{ color: t.color, dashArray:[5,5] } });
  banner.hidden = false; $('#editBannerText').textContent = `Dibujando en: ${t.name}`;
  hint.innerHTML = `Las herramientas del mapa dibujan en <b>${esc(t.name)}</b>. Haz clic en una entidad para editar sus atributos.`;
}
map.on('pm:create', e => {
  const t = layers.find(l => l.id === targetId); if (!t || !canEdit()) return;
  const f = e.layer;
  const props = {}; t.fields.forEach(k => props[k] = '');
  f.feature = { type:'Feature', properties: props, geometry: null };
  if (f.setStyle) f.setStyle(featureStyle(t, f.feature));
  if (!t.group.hasLayer(f)) t.group.addLayer(f);
  bindFeature(t, f);
  f._dbNew = dbWritable(t);
  scheduleRefresh();
  const ll = f.getLatLng ? f.getLatLng() : f.getBounds().getCenter();
  setTimeout(() => openPopup(t, f, ll), 50);
});
map.on('pm:remove', e => {
  const f = e.layer, lyr = layers.find(l => l.id === f._gtLayer);
  if (lyr && dbWritable(lyr) && !f._dbNew){
    dbRemoveFeature(lyr, f).then(() => toast('Entidad eliminada de la base de datos')).catch(err => { lyr.group.addLayer(f); toast('No se eliminó en la base: ' + err.message); scheduleRefresh(); });
  }
  scheduleRefresh();
});
let popupOpen = false;
map.on('popupopen', () => { popupOpen = true; });
map.on('popupclose', () => { popupOpen = false; });

function geomSummary(gj){
  const t = baseGeom(gj.geometry.type);
  if (t === 'Polygon') return `Área: ${fmt.format(turf.area(gj) / 10000)} ha`;
  if (t === 'LineString') return `Longitud: ${fmt.format(turf.length(gj, { units:'kilometers' }))} km`;
  if (t === 'Point'){ const [x, y] = gj.geometry.coordinates; return `${y.toFixed(5)}°, ${x.toFixed(5)}°`; }
  return '';
}
function openPopup(lyr, f, latlng){
  const gj = f.toGeoJSON(), props = f.feature.properties || (f.feature.properties = {});
  const keys = [...new Set([...lyr.fields, ...Object.keys(props)])];
  const box = el('div', { class:'pop' }, el('h4', {}, lyr.name));
  if (editAllowed(lyr)){
    const form = el('div', { class:'f' }), inputs = {};
    const toDb = dbWritable(lyr), pk = lyr.db && lyr.db.pk;
    keys.forEach(k => { const id = nid('fld'); inputs[k] = el('input', { id, type:'text', value: props[k] ?? '', readonly: toDb && k === pk, title: toDb && k === pk ? 'Clave primaria: la asigna la base de datos' : null }); form.append(el('label', { for:id }, k), inputs[k]); });
    const addId = nid('fld'), newField = el('input', { id:addId, type:'text', placeholder:'nuevo campo' });
    if (!lyr.db) form.append(el('label', { for:addId }, '+ campo'), newField);
    const note = toDb ? el('div', { class:'geo' }, f._dbNew ? 'Entidad nueva: se guardará en la base al presionar Guardar.' : `Los cambios se guardan en ${connOf(lyr) ? connOf(lyr).name : 'la base de datos'}.`) : null;
    box.append(form, el('div', { class:'geo' }, geomSummary(gj)), note, el('div', { class:'row' },
      el('button', { class:'btn', onclick: async ev => {
        if (toDb && !f._dbNew){
          ev.currentTarget.disabled = true;
          try { await dbRemoveFeature(lyr, f); } catch (e){ ev.currentTarget.disabled = false; return toast('No se eliminó en la base: ' + e.message); }
        }
        lyr.group.removeLayer(f); map.closePopup(); scheduleRefresh(); toast(toDb ? 'Entidad eliminada de la base de datos' : 'Entidad eliminada');
      } }, svg(ICON.trash), 'Eliminar'),
      el('button', { class:'btn primary', onclick: async ev => {
        keys.forEach(k => { if (toDb && k === pk) return; const v = inputs[k].value.trim(); props[k] = v !== '' && /^-?\d+(\.\d+)?$/.test(v) ? +v : v; });
        const nf = newField.value.trim();
        if (nf && !lyr.fields.includes(nf)){ lyr.fields.push(nf); props[nf] = ''; }
        if (toDb){
          const b = ev.currentTarget; b.disabled = true; b.textContent = 'Guardando…';
          try { await dbSaveFeature(lyr, f); }
          catch (e){ b.disabled = false; b.textContent = 'Guardar'; return toast('No se guardó en la base: ' + e.message); }
        }
        if (f.setStyle) f.setStyle(featureStyle(lyr, f.feature));
        applyLabels(lyr);
        map.closePopup(); scheduleRefresh(); toast(toDb ? 'Guardado en la base de datos' : 'Atributos guardados');
      }}, 'Guardar')));
  } else {
    const tb = el('table');
    keys.forEach(k => tb.append(el('tr', {}, el('td', {}, k), el('td', {}, String(props[k] ?? '')))));
    box.append(tb, el('div', { class:'geo' }, geomSummary(gj)));
  }
  L.popup({ maxWidth: 320 }).setLatLng(latlng).setContent(box).openOn(map);
}

/* =================================================================
   Campos, estadísticas, indicadores y gráficos
   ================================================================= */
const VIRTUAL = { __count:'Conteo de entidades', __area:'Área (ha)', __length:'Longitud (km)' };
function valueOf(f, field){
  if (field === '__count') return 1;
  if (field === '__area') return baseGeom(f.geometry.type) === 'Polygon' ? turf.area(f) / 10000 : NaN;
  if (field === '__length') return baseGeom(f.geometry.type) === 'LineString' ? turf.length(f, { units:'kilometers' }) : NaN;
  const v = f.properties ? f.properties[field] : null;
  return v === '' || v == null ? NaN : +v;
}
function numericFields(lyr){
  const feats = []; lyr.group.eachLayer(f => feats.push(f.feature));
  return lyr.fields.filter(k => {
    const vals = feats.map(f => f.properties && f.properties[k]).filter(v => v !== '' && v != null);
    return vals.length && vals.filter(v => !isNaN(+v)).length / vals.length >= .8;
  });
}
function virtualFor(lyr){
  const v = ['__count'];
  if (lyr.geom === 'Polygon' || lyr.geom === 'Mixed') v.push('__area');
  if (lyr.geom === 'LineString' || lyr.geom === 'Mixed') v.push('__length');
  return v;
}
function stat(vals, s){
  const n = vals.filter(Number.isFinite);
  if (s === 'count') return vals.length;
  if (!n.length) return NaN;
  if (s === 'sum') return n.reduce((a, b) => a + b, 0);
  if (s === 'mean') return n.reduce((a, b) => a + b, 0) / n.length;
  if (s === 'min') return Math.min(...n);
  if (s === 'max') return Math.max(...n);
  return NaN;
}
const STAT_LABEL = { sum:'suma', mean:'promedio', min:'mínimo', max:'máximo', count:'conteo' };
const fieldLabel = k => VIRTUAL[k] || k;

function chartData(c){
  const feats = featuresOf(layers.find(l => l.id === c.layerId));
  if (c.type === 'hist'){
    const vals = feats.map(f => valueOf(f, c.valField)).filter(Number.isFinite);
    if (!vals.length) return { labels:[], data:[] };
    const mn = Math.min(...vals), mx = Math.max(...vals), bins = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(vals.length))));
    const w = (mx - mn) / bins || 1, counts = Array(bins).fill(0);
    vals.forEach(v => counts[Math.min(bins - 1, Math.floor((v - mn) / w))]++);
    return { labels: counts.map((_, i) => `${fmt.format(mn + i * w)}–${fmt.format(mn + (i + 1) * w)}`), data: counts };
  }
  const groups = new Map();
  feats.forEach(f => {
    const raw = f.properties ? f.properties[c.catField] : null;
    const key = raw === '' || raw == null ? '(sin valor)' : String(raw);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(valueOf(f, c.valField));
  });
  const rows = [...groups].map(([k, v]) => [k, stat(v, c.valField === '__count' ? 'count' : c.agg)]);
  if (c.type === 'line') rows.sort((a, b) => (isNaN(+a[0]) || isNaN(+b[0])) ? a[0].localeCompare(b[0], 'es') : (+a[0]) - (+b[0]));
  else rows.sort((a, b) => (b[1] || 0) - (a[1] || 0));
  return { labels: rows.map(r => r[0]), data: rows.map(r => Number.isFinite(r[1]) ? +r[1].toFixed(4) : 0) };
}
function subFor(c, lyr){
  const n = featuresOf(lyr).length;
  if (c.type === 'hist') return `${lyr ? lyr.name : '?'} · distribución de ${fieldLabel(c.valField)} · n=${n}`;
  const op = c.valField === '__count' ? 'conteo' : `${STAT_LABEL[c.agg]} de ${fieldLabel(c.valField)}`;
  return `${lyr ? lyr.name : '?'} · ${op} por ${c.catField} · n=${n}`;
}

/* =================================================================
   Widgets flotantes (estilo Experience Builder)
   Cada widget guarda su posición anclada al borde más cercano
   (ax: l|r, ay: t|b, dx/dy en px), así se mantiene en su lugar
   aunque cambie el tamaño de la ventana.
   ================================================================= */
let widgets = [];               // {id,type,ax,dx,ay,dy,w,h,min,title,noHead,cfg}
const chartInst = new Map();    // id del widget → instancia de Chart.js
const nodes = new Map();        // id del widget → elemento
const runtimeMin = new Map();   // minimizado solo durante esta visita
let design = false;
const WTYPE = {
  layers:   { name:'Capas',     w:290, h:340, minW:220, minH:140, single:true },
  basemaps: { name:'Mapa base', w:290, h:250, minW:200, minH:120, single:true },
  kpi:      { name:'Indicador', w:184, h:112, minW:140, minH:88 },
  chart:    { name:'Gráfico',   w:352, h:284, minW:240, minH:180 },
  text:     { name:'Texto',     w:320, h:104, minW:140, minH:48 },
  legend:   { name:'Leyenda',   w:240, h:280, minW:170, minH:100, single:true }
};
const stage = $('#vApp'), wlayer = $('#widgets');
const narrow = () => matchMedia('(max-width: 760px)').matches;
const GRID = 8, snap = v => Math.round(v / GRID) * GRID;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isMin = w => runtimeMin.has(w.id) ? runtimeMin.get(w.id) : !!w.min;
const widgetTitle = w => w.type === 'kpi' ? (w.cfg.label || 'Indicador') : w.type === 'chart' ? (w.cfg.title || 'Gráfico') : w.type === 'text' ? (w.title || (w.cfg.text || '').split('\n')[0].replace(/\*\*/g, '').slice(0, 40) || 'Texto') : WTYPE[w.type].name;

/* Distribución inicial para aplicaciones creadas antes de los widgets */
function defaultWidgets(st){
  const out = [
    { id:'W-layers', type:'layers', ax:'l', dx:56, ay:'t', dy:12, w:290, h:340 },
    { id:'W-basemaps', type:'basemaps', ax:'l', dx:56, ay:'b', dy:28, w:290, h:250, min:true }
  ];
  const ks = st.kpis || [], cs = st.charts || [];
  ks.forEach((k, i) => out.push({ id:'W-' + k.id, type:'kpi', ax:'r', dx: 12 + (3 - i % 4) * 176, ay:'t', dy: 12 + Math.floor(i / 4) * 108, w:168, h:100,
    cfg:{ layerId:k.layerId, field:k.field, stat:k.stat, unit:k.unit, label:k.label } }));
  const top = 12 + Math.ceil(ks.length / 4) * 108;
  cs.forEach((c, i) => out.push({ id:'W-' + c.id, type:'chart', ax:'r', dx: 12 + Math.floor(i / 2) * 360, ay: i % 2 ? 'b' : 't', dy: i % 2 ? 28 : top, w:344, h:290,
    cfg:{ layerId:c.layerId, type:c.type, catField:c.catField, valField:c.valField, agg:c.agg, title:c.title } }));
  return out;
}

/* ---------- Posición ---------- */
function place(node, w){
  if (narrow()){ node.style.left = node.style.top = node.style.width = node.style.height = ''; return; }
  const W = wlayer.clientWidth, H = wlayer.clientHeight, m = isMin(w);
  const ww = Math.min(w.w, W - 8);
  node.style.width = ww + 'px';
  node.style.height = m ? '' : Math.min(w.h, H - 8) + 'px';
  const hh = node.offsetHeight;
  const left = w.ax === 'r' ? W - w.dx - ww : w.dx;
  const top = w.ay === 'b' ? H - w.dy - hh : w.dy;
  node.style.left = clamp(left, 4, Math.max(4, W - ww - 4)) + 'px';
  node.style.top = clamp(top, 4, Math.max(4, H - hh - 4)) + 'px';
}
function anchorFrom(left, top, ww, hh, w){
  const W = wlayer.clientWidth, H = wlayer.clientHeight;
  w.ax = left + ww / 2 > W / 2 ? 'r' : 'l'; w.dx = Math.max(0, snap(w.ax === 'r' ? W - left - ww : left));
  w.ay = top + hh / 2 > H / 2 ? 'b' : 't'; w.dy = Math.max(0, snap(w.ay === 'b' ? H - top - hh : top));
}
const placeAll = () => widgets.forEach(w => { const n = nodes.get(w.id); if (n) place(n, w); });
window.addEventListener('resize', () => { if (currentApp){ placeAll(); if (narrow() && design) setDesign(false); } });
function restack(){ widgets.forEach((w, i) => { const n = nodes.get(w.id); if (n) n.style.zIndex = i + 1; }); }
function bringFront(w){
  const i = widgets.indexOf(w);
  if (i < widgets.length - 1){ widgets.splice(i, 1); widgets.push(w); restack(); return true; }
  return false;
}

/* ---------- Arrastrar y cambiar tamaño (solo en modo Diseño) ---------- */
function startDrag(e, w, node, mode){
  if (!design && mode === 'move' && !e.target.closest('button')) e.preventDefault();   // evita seleccionar texto al arrastrar
  if (!design || narrow() || e.button !== 0) return;
  if (mode === 'move' && e.target.closest('button')) return;
  e.preventDefault();
  const moved = bringFront(w);
  const W = wlayer.clientWidth, H = wlayer.clientHeight, T = WTYPE[w.type];
  const r0 = { left: node.offsetLeft, top: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight }, x0 = e.clientX, y0 = e.clientY;
  node.classList.add('dragging'); node.setPointerCapture(e.pointerId);
  const move = ev => {
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (mode === 'move'){
      node.style.left = clamp(snap(r0.left + dx), 4, W - r0.width - 4) + 'px';
      node.style.top = clamp(snap(r0.top + dy), 4, H - r0.height - 4) + 'px';
    } else {
      node.style.width = clamp(snap(r0.width + dx), T.minW, W - r0.left - 4) + 'px';
      node.style.height = clamp(snap(r0.height + dy), T.minH, H - r0.top - 4) + 'px';
    }
  };
  const up = () => {
    node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', up); node.removeEventListener('pointercancel', up);
    node.classList.remove('dragging');
    const ww = node.offsetWidth, hh = node.offsetHeight;
    if (mode === 'resize'){ w.w = ww; w.h = hh; }
    const changed = moved || node.offsetLeft !== r0.left || node.offsetTop !== r0.top || ww !== r0.width || hh !== r0.height;
    anchorFrom(node.offsetLeft, node.offsetTop, ww, hh, w);
    if (changed) scheduleSave();
  };
  node.addEventListener('pointermove', move); node.addEventListener('pointerup', up); node.addEventListener('pointercancel', up);
}
/* Mover con el teclado: flechas sobre la barra del widget en modo Diseño */
function keyMove(e, w, node){
  if (!design || narrow()) return;
  const step = e.shiftKey ? GRID * 4 : GRID, d = { ArrowLeft:[-step,0], ArrowRight:[step,0], ArrowUp:[0,-step], ArrowDown:[0,step] }[e.key];
  if (!d) return;
  e.preventDefault();
  const W = wlayer.clientWidth, H = wlayer.clientHeight;
  const left = clamp(node.offsetLeft + d[0], 4, W - node.offsetWidth - 4), top = clamp(node.offsetTop + d[1], 4, H - node.offsetHeight - 4);
  node.style.left = left + 'px'; node.style.top = top + 'px';
  anchorFrom(left, top, node.offsetWidth, node.offsetHeight, w); scheduleSave();
}

/* ---------- Construcción de cada widget ---------- */
function buildWidget(w){
  const m = isMin(w);
  const title = el('span', { class:'wg-title' }, widgetTitle(w));
  const btnMin = el('button', { class:'icon-btn', title: m ? 'Expandir' : 'Minimizar', 'aria-label': m ? 'Expandir' : 'Minimizar', 'aria-expanded': String(!m), onclick:() => toggleMin(w) }, svg(m ? ICON.expand : ICON.minus));
  const head = el('div', { class:'wg-head', tabindex:'-1' },
    el('span', { class:'wg-grip design-only', 'aria-hidden':'true' }, svg(ICON.grip)),
    title,
    el('span', { class:'wg-acts' },
      ['kpi', 'chart', 'text'].includes(w.type) ? el('button', { class:'icon-btn design-only', title:'Configurar', 'aria-label':'Configurar widget', onclick:() => configure(w) }, svg(ICON.sliders)) : null,
      btnMin,
      el('button', { class:'icon-btn design-only', title:'Quitar widget', 'aria-label':'Quitar widget', onclick:() => removeWidget(w) }, svg(ICON.x))));
  const body = el('div', { class:'wg-body' });
  const grip = el('div', { class:'wg-resize design-only', title:'Arrastra para cambiar el tamaño' });
  const node = el('section', { class:`wg wg-${w.type}` + (w.noHead ? ' nohead' : '') + (m ? ' min' : ''), 'data-id': w.id, 'aria-label': widgetTitle(w) }, head, body, grip);
  head.addEventListener('pointerdown', e => startDrag(e, w, node, 'move'));
  grip.addEventListener('pointerdown', e => startDrag(e, w, node, 'resize'));
  head.addEventListener('keydown', e => keyMove(e, w, node));
  node.addEventListener('pointerdown', () => { if (design && bringFront(w)) scheduleSave(); });
  nodes.set(w.id, node);
  mountBody(w, body);
  return node;
}
function mountBody(w, body){
  body.innerHTML = '';
  if (w.type === 'layers'){
    body.append(
      el('button', { class:'btn primary can-edit wg-addlayer', onclick: openAddLayer }, svg('<path d="M12 5v14M5 12h14"/>'), 'Agregar capa'),
      el('ul', { class:'layers', id:'layerList' }),
      el('div', { class:'hint', id:'editHint' }));
  } else if (w.type === 'basemaps'){
    body.append(el('div', { class:'basemaps', id:'basemaps' }));
    renderBasemapButtons();
  } else if (w.type === 'legend'){
    body.append(el('div', { class:'legend-box', id:'legendBox' }));
    setTimeout(renderLegend, 0);
  } else if (w.type === 'kpi'){
    body.append(el('div', { class:'k-val' }), el('div', { class:'k-sub' }));
  } else if (w.type === 'chart'){
    const canvas = el('canvas', { role:'img', 'aria-label': w.cfg.title || 'Gráfico' });
    body.append(el('div', { class:'c-sub' }), el('div', { class:'canvas' }, canvas));
  } else if (w.type === 'text'){
    body.append(el('div', { class:`wg-text size-${w.cfg.size || 'm'}`, style:`text-align:${w.cfg.align || 'left'}` }, ...textNodes(w.cfg.text || '')));
  }
}
/* Texto: saltos de línea y **negrita**; nada de HTML */
function textNodes(t){
  const out = [];
  t.split('\n').forEach((line, i) => {
    if (i) out.push(el('br'));
    line.split(/(\*\*[^*]+\*\*)/).forEach(part => out.push(/^\*\*[^*]+\*\*$/.test(part) ? el('strong', {}, part.slice(2, -2)) : part));
  });
  return out;
}

function renderWidgets(){
  chartInst.forEach(c => c.destroy()); chartInst.clear();
  nodes.clear(); wlayer.innerHTML = '';
  widgets.forEach(w => wlayer.append(buildWidget(w)));
  restack(); placeAll();
  widgets.forEach(w => { if (w.type === 'chart') makeChart(w); });
  refreshWidgets();
  if (!widgets.length) wlayer.append(el('div', { class:'wg-empty' }, canEdit() ? 'Esta aplicación no tiene widgets. Entra a Diseñar para agregarlos.' : ''));
}
function refreshWidgets(){
  widgets.forEach(w => {
    const node = nodes.get(w.id); if (!node) return;
    if (w.type === 'kpi'){
      const c = w.cfg, lyr = layers.find(l => l.id === c.layerId), feats = featuresOf(lyr);
      const v = stat(feats.map(f => valueOf(f, c.field)), c.stat);
      const val = node.querySelector('.k-val'); val.innerHTML = '';
      val.append(Number.isFinite(v) ? fmtBig(v) : '—', c.unit ? el('small', {}, c.unit) : '');
      node.querySelector('.k-sub').textContent = `${lyr ? lyr.name : 'Capa no disponible'} · ${STAT_LABEL[c.stat]} · n=${feats.length}`;
    } else if (w.type === 'chart'){
      const inst = chartInst.get(w.id), lyr = layers.find(l => l.id === w.cfg.layerId);
      node.querySelector('.c-sub').textContent = subFor(w.cfg, lyr);
      if (inst){ const { labels, data } = chartData(w.cfg); inst.data.labels = labels; inst.data.datasets[0].data = data; inst.update('none'); }
    }
  });
}
function makeChart(w){
  const node = nodes.get(w.id), c = w.cfg; if (!node) return;
  const old = chartInst.get(w.id); if (old) old.destroy();
  const canvas = node.querySelector('canvas'), lyr = layers.find(l => l.id === c.layerId);
  const { labels, data } = chartData(c);
  const pal = palette(), grid = cssVar('--line'), surf = cssVar('--surface');
  Chart.defaults.font.family = 'Archivo, system-ui, sans-serif';
  Chart.defaults.color = cssVar('--muted');
  const radial = c.type === 'pie' || c.type === 'doughnut';
  const color = lyr && lyr.color && !lyr.color.startsWith('var') ? (lyr.style && lyr.style.mode === 'single' ? lyr.style.fill : lyr.color) : pal[0];
  chartInst.set(w.id, new Chart(canvas, {
    type: radial ? c.type : (c.type === 'line' ? 'line' : 'bar'),
    data: { labels, datasets: [{
      label: fieldLabel(c.valField), data,
      backgroundColor: catColors(lyr, c, labels) || (radial ? labels.map((_, i) => pal[i % 8]) : (c.type === 'line' ? color + '33' : color)),
      borderColor: radial ? surf : color, borderWidth: radial ? 2 : (c.type === 'line' ? 2 : 0),
      borderRadius: radial ? 0 : 3, fill: c.type === 'line', tension: .3, pointRadius: 3, pointBackgroundColor: color,
      barPercentage: c.type === 'hist' ? 1 : .8, categoryPercentage: c.type === 'hist' ? 1 : .8
    }]},
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 }, indexAxis: c.type === 'hbar' ? 'y' : 'x',
      plugins: { legend: { display: radial, position:'right', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${fmt.format(ctx.parsed.y ?? ctx.parsed.x ?? ctx.parsed)}` } } },
      scales: radial ? {} : {
        x: { grid: { color: c.type === 'hbar' ? grid : 'transparent' }, ticks: { font: { size: 10 }, maxRotation: 45, callback: function(v){ const l = c.type === 'hbar' ? fmtBig(v) : this.getLabelForValue(v); return String(l).length > 14 ? String(l).slice(0, 13) + '…' : l; } } },
        y: { grid: { color: c.type === 'hbar' ? 'transparent' : grid }, beginAtZero: true, ticks: { font: { size: 10 }, callback: function(v){ return c.type === 'hbar' ? this.getLabelForValue(v) : fmtBig(v); } } }
      }
    }
  }));
}

/* ---------- Acciones sobre widgets ---------- */
function toggleMin(w){
  const v = !isMin(w), node = nodes.get(w.id);
  if (design){ w.min = v; runtimeMin.delete(w.id); scheduleSave(); } else runtimeMin.set(w.id, v);
  // Si está anclado abajo, se mantiene pegado al borde inferior al plegarse
  node.classList.toggle('min', v);
  const b = node.querySelector('.wg-acts .icon-btn:not(.design-only)');
  b.replaceChildren(svg(v ? ICON.expand : ICON.minus)); b.title = b.ariaLabel = v ? 'Expandir' : 'Minimizar'; b.setAttribute('aria-expanded', String(!v));
  place(node, w);
}
function addWidget(type, extra = {}){
  const T = WTYPE[type];
  if (T.single){
    const ex = widgets.find(w => w.type === type);
    if (ex){ const n = nodes.get(ex.id); bringFront(ex); n.classList.add('flash'); setTimeout(() => n.classList.remove('flash'), 900); return toast(`Ya existe el widget ${T.name}; es único por aplicación.`); }
  }
  const W = wlayer.clientWidth, k = widgets.length % 6;
  const w = { id: nid('W'), type, w: T.w, h: T.h, ...extra };
  anchorFrom(snap(W / 2 - T.w / 2 + k * 24), snap(72 + k * 24), T.w, T.h, w);
  widgets.push(w);
  renderWidgets(); if (type === 'layers'){ renderLayers(); refreshEditing(); }
  const n = nodes.get(w.id); n.classList.add('flash'); setTimeout(() => n.classList.remove('flash'), 900);
  scheduleSave();
  return w;
}
function removeWidget(w){
  widgets = widgets.filter(x => x !== w); runtimeMin.delete(w.id);
  renderWidgets(); if (widgets.some(x => x.type === 'layers')) renderLayers();
  scheduleSave(); toast(`Widget "${widgetTitle(w)}" quitado`);
}
function configure(w){
  if (w.type === 'kpi') openKpiDialog(w);
  else if (w.type === 'chart') openChartDialog(w);
  else if (w.type === 'text') openTextDialog(w);
}

/* ---------- Modo Diseño ---------- */
function setDesign(on){
  if (on && narrow()) return toast('El diseño se arma en una pantalla más ancha (computador o tablet horizontal).');
  design = !!on && canEdit();
  stage.classList.toggle('design', design);
  $('#designBar').hidden = !design;
  const b = $('#btnDesign'); b.setAttribute('aria-pressed', String(design)); b.classList.toggle('primary', design);
  if (design) runtimeMin.clear();
  renderWidgets(); if (widgets.some(x => x.type === 'layers')) renderLayers();
  refreshEditing();
}
$('#btnDesign').addEventListener('click', () => setDesign(!design));
$('#btnDesignDone').addEventListener('click', () => setDesign(false));
document.querySelectorAll('#designBar [data-add]').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.add === 'text') openTextDialog(null); else addWidget(b.dataset.add);
}));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && design && !document.querySelector('dialog[open]')) setDesign(false); });

/* ---------- Diálogo del widget de texto ---------- */
const dlgText = $('#dlgText'); let editingText = null;
function openTextDialog(w){
  editingText = w;
  $('#dlgTextTitle').textContent = w ? 'Editar texto' : 'Nuevo widget de texto';
  $('#btnTextOk').textContent = w ? 'Guardar' : 'Agregar';
  $('#txTitle').value = w ? (w.title || '') : '';
  $('#txBody').value = w ? (w.cfg.text || '') : '';
  $('#txSize').value = w ? (w.cfg.size || 'm') : 'l';
  $('#txAlign').value = w ? (w.cfg.align || 'left') : 'left';
  $('#txHead').checked = w ? !w.noHead : false;
  dlgText.showModal(); setTimeout(() => $('#txBody').focus(), 0);
}
$('#btnTextOk').addEventListener('click', () => {
  const text = $('#txBody').value.trim();
  if (!text) return $('#txErr').textContent = 'Escribe el texto del widget.';
  $('#txErr').textContent = '';
  const props = { title: $('#txTitle').value.trim(), noHead: !$('#txHead').checked, cfg:{ text, size: $('#txSize').value, align: $('#txAlign').value } };
  if (editingText){ Object.assign(editingText, props); renderWidgets(); if (widgets.some(x => x.type === 'layers')) renderLayers(); scheduleSave(); }
  else addWidget('text', props);
  dlgText.close();
});

let refreshT;
function scheduleRefresh(){ clearTimeout(refreshT); refreshT = setTimeout(() => { refreshWidgets(); renderLayers(); }, 120); }
map.on('moveend', () => { if ($('#extentOnly').checked) scheduleRefresh(); });
$('#extentOnly').addEventListener('change', scheduleRefresh);
const themeChanged = () => { if (currentApp){ renderWidgets(); renderLayers(); } };
const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener && mq.addEventListener('change', themeChanged);
new MutationObserver(themeChanged).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });

/* =================================================================
   Guardado de la aplicación abierta
   ================================================================= */
function serialize(){
  const c = map.getCenter();
  return {
    basemap: baseId, view: { center:[c.lat, c.lng], zoom: map.getZoom() },
    layers: layers.map(l => l.kind === 'vector'
      ? { id:l.id, kind:'vector', name:l.name, editable:l.editable, color:l.color, style:l.style, geom:l.geom, fields:l.fields, visible:l.visible, source:l.source, sourceUrl:l.sourceUrl, db: l.db ? (({ status, ...d }) => d)(l.db) : undefined, data: l.group.toGeoJSON() }
      : { id:l.id, kind:'raster', name:l.name, spec:l.spec, visible:l.visible, opacity:l.opacity, sourceLabel:l.sourceLabel, bounds: l.bounds ? [[l.bounds.getSouth(), l.bounds.getWest()], [l.bounds.getNorth(), l.bounds.getEast()]] : null }),
    widgets: widgets.map(w => structuredClone(w))
  };
}
let saveT, dirty = false;
function scheduleSave(){
  if (loading || !currentApp || !canEdit()) return;
  dirty = true; setStatus('Cambios sin guardar…');
  clearTimeout(saveT); saveT = setTimeout(saveNow, 700);
}
function setStatus(txt, err){ const s = $('#saveStatus'); s.textContent = txt; s.classList.toggle('err', !!err); }
/* Guarda solo el encuadre del mapa, sin marcar la aplicación como modificada */
async function saveViewOnly(){
  if (!currentApp || !canEdit()) return;
  try { const st = await DB.get('app:' + currentApp.id); if (st){ const c = map.getCenter(); st.view = { center:[c.lat, c.lng], zoom: map.getZoom() }; await DB.set('app:' + currentApp.id, st); } } catch {}
}
async function saveNow(){
  clearTimeout(saveT);
  if (!currentApp || !canEdit() || !dirty) return;
  dirty = false;
  try {
    const st = serialize();
    await DB.set('app:' + currentApp.id, st);
    const a = await patchApp(currentApp.id, { updatedAt: Date.now(), stats: statsOf(st), thumb: thumbData(st) });
    if (!a){ setStatus('La aplicación fue eliminada', true); toast('Esta aplicación fue eliminada desde el portal.'); return; }
    setStatus('Guardado ' + new Intl.DateTimeFormat('es-CL', { hour:'2-digit', minute:'2-digit' }).format(new Date()));
  } catch (e){ dirty = true; setStatus('No se pudo guardar', true); toast('No se pudo guardar: ' + (e.message || e)); }
}

function clearWorkspace(){
  map.closePopup(); map.pm.removeControls();
  dbTimers.forEach(t => clearInterval(t)); dbTimers.clear();
  layers.forEach(l => map.removeLayer(l.kind === 'vector' ? l.group : l.tile));
  layers.length = 0; targetId = null; colorIdx = 0;
  chartInst.forEach(c => c.destroy()); chartInst.clear(); nodes.clear(); widgets = []; wlayer.innerHTML = '';
}
async function loadState(st){
  loading = true;
  try {
    clearWorkspace();
    setBasemap(st.basemap || 'voyager');
    for (const l of st.layers || []){
      try {
        if (l.kind === 'vector') addVectorLayer(l.data, l);
        else addRasterLayer(l.spec, l.name, l);
      } catch (e){ toast(`No se pudo cargar "${l.name}": ${e.message}`); }
    }
    colorIdx = layers.length;
    widgets = Array.isArray(st.widgets) ? structuredClone(st.widgets) : defaultWidgets(st);
    if (st.view) map.setView(st.view.center, st.view.zoom, { animate:false });
    if (canEdit()) targetId = (layers.slice().reverse().find(l => l.editable) || {}).id || null;
    layers.forEach(l => l.kind === 'vector' && l.group.eachLayer(f => { f.options.pmIgnore = !editAllowed(l); }));
  } finally { loading = false; }
  renderWidgets(); refreshEditing(); renderLayers();
  layers.filter(l => l.db).forEach(l => refreshDbLayer(l, true));   // datos al día desde la base
}

/* =================================================================
   Diálogo: agregar capa (archivo, ArcGIS, WMS/XYZ, capa nueva)
   ================================================================= */
const dlgLayer = $('#dlgLayer');
let tab = 'file', pendingFile = null, ags = null;
const DROP_HTML = '<b>Arrastra un archivo aquí</b> o haz clic para elegirlo<br><span class="formats">GeoJSON · KML · GPX · Shapefile (.zip) · CSV con lat/lon</span>';
function setTab(t){
  tab = t;
  document.querySelectorAll('#dlgLayer [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  document.querySelectorAll('#dlgLayer [data-pane]').forEach(p => p.hidden = p.dataset.pane !== t);
  const rasterish = (t === 'url' && $('#urlType').value !== 'geojson') || (t === 'arcgis' && !String($('#agsMode').value || '').startsWith('vector'));
  $('#editableRow').hidden = t === 'new' || t === 'db' || rasterish;
  $('#layerErr').textContent = '';
  if (t === 'db') initDbPane();
}
document.querySelectorAll('#dlgLayer [role=tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('#urlType').addEventListener('change', () => { $('#wmsLayersField').hidden = $('#urlType').value !== 'wms'; setTab('url'); });
function openAddLayer(){
  if (!canEdit()) return;
  pendingFile = null; $('#drop').innerHTML = DROP_HTML;
  $('#layerName').value = ''; $('#layerName').dataset.auto = '1'; $('#layerEditable').checked = false; $('#dbFilter').value = ''; $('#dbWrite').checked = false; $('#dbRefresh').value = '0';
  ags = null; $('#agsInfo').hidden = true; $('#agsModeField').hidden = true; $('#agsWhereField').hidden = true; $('#agsBandsField').hidden = true; $('#agsBands').value = ''; $('#agsMode').innerHTML = '';
  const sel = $('#newColor'); sel.innerHTML = '';
  ['Verde','Naranjo','Azul','Magenta','Oliva','Café','Cian','Violeta'].forEach((n, i) => sel.append(el('option', { value: i }, n)));
  sel.value = colorIdx % 8;
  setTab('file'); dlgLayer.showModal();
}
$('#btnAddLayer').addEventListener('click', openAddLayer);
const drop = $('#drop');
drop.addEventListener('click', () => $('#fileInput').click());
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0]); });
$('#fileInput').addEventListener('change', e => { if (e.target.files[0]) pickFile(e.target.files[0]); e.target.value = ''; });
function pickFile(f){ pendingFile = f; drop.innerHTML = `<b>${esc(f.name)}</b><br><span class="formats">${fmt.format(f.size / 1024)} KB · listo para agregar</span>`; if (!$('#layerName').value) $('#layerName').value = f.name.replace(/\.[^.]+$/, ''); }
function normalizeFC(obj){
  if (!obj) throw new Error('El archivo está vacío.');
  if (obj.type === 'FeatureCollection') return obj;
  if (obj.type === 'Feature') return { type:'FeatureCollection', features:[obj] };
  if (obj.type && obj.coordinates) return { type:'FeatureCollection', features:[{ type:'Feature', properties:{}, geometry: obj }] };
  throw new Error('No se reconoce como GeoJSON.');
}
function csvToFC(text){
  const p = Papa.parse(text, { header:true, skipEmptyLines:true, dynamicTyping:true });
  const cols = p.meta.fields || [], find = re => cols.find(c => re.test(c.trim().toLowerCase()));
  const lat = find(/^(lat|latitud|latitude|y)$/), lon = find(/^(lon|lng|long|longitud|longitude|x)$/);
  if (!lat || !lon) throw new Error('El CSV necesita columnas de latitud y longitud (lat/lon, latitud/longitud o x/y).');
  return { type:'FeatureCollection', features: p.data.filter(r => Number.isFinite(+r[lat]) && Number.isFinite(+r[lon])).map(r => {
    const props = { ...r }; delete props[lat]; delete props[lon];
    return { type:'Feature', properties: props, geometry: { type:'Point', coordinates:[+r[lon], +r[lat]] } };
  })};
}

/* ---------- ArcGIS Server ---------- */
const MAX_FEATURES = 20000;
const agsToken = () => $('#agsToken').value.trim();
let jsonpN = 0;
function jsonp(url, params){
  return new Promise((res, rej) => {
    const cb = '__agsCb' + (++jsonpN), s = document.createElement('script');
    const done = () => { clearTimeout(t); delete window[cb]; s.remove(); };
    const t = setTimeout(() => { done(); rej(new Error('timeout')); }, 20000);
    window[cb] = d => { done(); res(d); };
    const p = new URLSearchParams(params); p.set('callback', cb);
    s.src = `${url}?${p}`; s.onerror = () => { done(); rej(new Error('jsonp')); };
    document.head.append(s);
  });
}
class HttpError extends Error {}
async function agsGet(url, params){
  try {
    const r = await fetch(`${url}?${params}`);
    if (r.status === 401 || r.status === 403) throw new HttpError(`El servicio rechazó el acceso (${r.status}). Requiere iniciar sesión o un token.`);
    if (!r.ok) throw new HttpError(`El servidor respondió ${r.status}.`);
    return await r.json();
  } catch (e){
    if (e instanceof HttpError) throw e;
    const p = new URLSearchParams(params); p.set('f', 'json');   // JSONP: evita el bloqueo CORS
    try { return await jsonp(url, p); }
    catch { throw new Error('No pude leer el servicio, ni directo ni por JSONP. Revisa que la URL abra en el navegador; si pide iniciar sesión, necesitas un token.'); }
  }
}
async function agsJson(url){
  const p = new URLSearchParams({ f:'json' }); if (agsToken()) p.set('token', agsToken());
  const j = await agsGet(url, p);
  if (!j || typeof j !== 'object') throw new Error('El servidor no devolvió una respuesta válida.');
  if (j.error){ const c = j.error.code; throw new Error(c === 499 || c === 498 ? 'El servicio requiere un token válido.' : `ArcGIS: ${j.error.message || 'error ' + c}`); }
  return j;
}
function utmToLatLng(x, y, zone, south){
  const k0 = .9996, a = 6378137, e2 = .00669438, ep2 = e2 / (1 - e2);
  const xs = x - 500000, ys = south ? y - 10000000 : y;
  const mu = ys / k0 / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1);
  const N = a / Math.sqrt(1 - e2 * s * s), T = t * t, C = ep2 * c * c, R = a * (1 - e2) / Math.pow(1 - e2 * s * s, 1.5), D = xs / (N * k0);
  const lat = p1 - (N * t / R) * (D * D / 2 - (5 + 3 * T + 10 * C - 4 * C * C - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T + 298 * C + 45 * T * T - 252 * ep2 - 3 * C * C) * D ** 6 / 720);
  const lon = (D - (1 + 2 * T + C) * D ** 3 / 6 + (5 - 2 * C + 28 * T - 3 * C * C + 8 * ep2 + 24 * T * T) * D ** 5 / 120) / c;
  return L.latLng(lat * 180 / Math.PI, (zone - 1) * 6 - 177 + lon * 180 / Math.PI);
}
function utmZoneOf(sr){
  const wk = sr.latestWkid || sr.wkid;
  if (wk >= 32601 && wk <= 32660) return [wk - 32600, false];
  if (wk >= 32701 && wk <= 32760) return [wk - 32700, true];
  if (wk >= 31965 && wk <= 31976) return [wk - 31954, false];
  if (wk >= 31977 && wk <= 31985) return [wk - 31960, true];
  if (wk === 5361) return [19, true]; if (wk === 5362) return [18, true];
  if (wk >= 24877 && wk <= 24882) return [wk - 24860, true];
  if (wk >= 29187 && wk <= 29195) return [wk - 29170, true];
  const m = (sr.wkt || '').match(/UTM[_ ]?zone[_ ]?(\d{1,2})\s*([NS])/i);
  return m ? [+m[1], m[2].toUpperCase() === 'S'] : null;
}
function agsExtent(ext){
  if (!ext || !ext.spatialReference || !Number.isFinite(ext.xmin)) return null;
  const sr = ext.spatialReference, wk = sr.latestWkid || sr.wkid;
  if (wk === 4326 || wk === 4674 || wk === 4190) return L.latLngBounds([ext.ymin, ext.xmin], [ext.ymax, ext.xmax]);
  if (wk === 102100 || wk === 3857 || wk === 102113){ const P = L.Projection.SphericalMercator; return L.latLngBounds(P.unproject(L.point(ext.xmin, ext.ymin)), P.unproject(L.point(ext.xmax, ext.ymax))); }
  const z = utmZoneOf(sr);
  if (z) return L.latLngBounds([[ext.xmin, ext.ymin], [ext.xmax, ext.ymax], [ext.xmin, ext.ymax], [ext.xmax, ext.ymin]].map(([x, y]) => utmToLatLng(x, y, z[0], z[1])));
  return null;
}
async function agsImageFootprint(url){
  try {
    const p = new URLSearchParams({ where:'1=1', returnGeometry:'true', outSR:'4326', outFields:'OBJECTID', f:'json' });
    if (agsToken()) p.set('token', agsToken());
    const j = await agsGet(`${url}/query`, p);
    const pts = (j.features || []).flatMap(f => (f.geometry && f.geometry.rings || []).flat()).map(([x, y]) => [y, x]);
    return pts.length ? L.latLngBounds(pts) : null;
  } catch { return null; }
}
const GEOM_ESRI = { esriGeometryPoint:'puntos', esriGeometryMultipoint:'puntos', esriGeometryPolyline:'líneas', esriGeometryPolygon:'polígonos' };
async function agsRead(){
  const url = $('#agsUrl').value.trim().replace(/\?.*$/, '').replace(/\/+$/, '');
  const m = url.match(/\/(MapServer|FeatureServer|ImageServer)(?:\/(\d+))?$/i);
  if (!m) throw new Error('La URL debe terminar en /MapServer, /FeatureServer o /ImageServer, opcionalmente con el número de capa (…/MapServer/2).');
  const kind = m[1], layerNum = m[2] != null ? +m[2] : null;
  const base = layerNum != null ? url.replace(/\/\d+$/, '') : url;
  const info = await agsJson(url), modes = [];
  let title, desc;
  if (layerNum != null){
    title = info.name || `Capa ${layerNum}`;
    if (info.geometryType) modes.push({ v:`vector:${layerNum}`, t:`Entidades vectoriales (${GEOM_ESRI[info.geometryType] || 'geometría'}) · gráficos, indicadores y edición` });
    if (/MapServer/i.test(kind)) modes.push({ v:`dynamic:${layerNum}`, t:'Imagen dinámica (solo esta capa)' });
    desc = `<b>${esc(title)}</b> · ${esc(info.type || 'Capa')}${info.geometryType ? ' · ' + GEOM_ESRI[info.geometryType] : ''}${info.maxRecordCount ? ` · máx. ${fmt.format(info.maxRecordCount)} registros por consulta` : ''}`;
  } else if (/ImageServer/i.test(kind)){
    title = info.name || base.split('/').slice(-2, -1)[0];
    if (/^(U16|S16|U32|S32|F32|F64)$/i.test(info.pixelType || '')) modes.push({ v:'image:stretch', t:'Imagen con estirado automático (recomendado para 16 bits)' });
    modes.push({ v:'image:default', t:'Imagen con el render por defecto del servidor' });
    (info.rasterFunctionInfos || []).filter(f => f.name && f.name !== 'None').forEach(f => modes.push({ v:'image:fn:' + f.name, t:`Función del servidor: ${f.name}` }));
    const sr = info.spatialReference || (info.extent && info.extent.spatialReference) || {};
    desc = `<b>${esc(title)}</b> · ImageServer · ${info.bandCount || '?'} banda${info.bandCount === 1 ? '' : 's'} · ${esc(info.pixelType || '')}${info.pixelSizeX ? ` · píxel ${fmt.format(info.pixelSizeX)}` : ''} · SR ${sr.latestWkid || sr.wkid || '?'}`;
  } else {
    title = info.mapName || (info.documentInfo && info.documentInfo.Title) || base.split('/').slice(-2, -1)[0];
    const lys = (info.layers || []).filter(l => !(l.subLayerIds && l.subLayerIds.length));
    if (/MapServer/i.test(kind)){
      const wk = info.spatialReference && (info.spatialReference.latestWkid || info.spatialReference.wkid);
      if (info.singleFusedMapCache && (wk === 102100 || wk === 3857)) modes.push({ v:'tiled', t:'Teselas en caché (más rápido)' });
      modes.push({ v:'dynamic', t:'Imagen dinámica (todas las capas)' });
    }
    lys.forEach(l => modes.push({ v:`vector:${l.id}`, t:`Entidades: ${l.name}${l.geometryType ? ' (' + (GEOM_ESRI[l.geometryType] || '') + ')' : ''}` }));
    desc = `<b>${esc(title)}</b> · ${kind} · ${lys.length} capa${lys.length === 1 ? '' : 's'}${info.spatialReference ? ` · SR ${info.spatialReference.latestWkid || info.spatialReference.wkid}` : ''}`;
  }
  if (!modes.length) throw new Error('No encontré capas que se puedan agregar en este servicio.');
  ags = { base, kind, info, title, layerNum };
  const sel = $('#agsMode'); sel.innerHTML = '';
  modes.forEach(o => sel.append(el('option', { value:o.v }, o.t)));
  $('#agsInfo').innerHTML = desc; $('#agsInfo').hidden = false; $('#agsModeField').hidden = false;
  syncAgsMode();
}
function syncAgsMode(){
  const v = $('#agsMode').value || '';
  $('#agsWhereField').hidden = !v.startsWith('vector');
  $('#editableRow').hidden = !v.startsWith('vector');
  $('#agsBandsField').hidden = !(v.startsWith('image') && ags && ags.info.bandCount > 3);
}
$('#agsMode').addEventListener('change', syncAgsMode);
$('#agsUrl').addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); $('#btnAgsRead').click(); } });
$('#btnAgsRead').addEventListener('click', async () => {
  const b = $('#btnAgsRead'), err = $('#layerErr'); err.textContent = '';
  b.disabled = true; b.textContent = 'Leyendo…';
  try { await agsRead(); } catch (e){ err.textContent = e.message; $('#agsInfo').hidden = true; $('#agsModeField').hidden = true; $('#agsWhereField').hidden = true; ags = null; }
  finally { b.disabled = false; b.textContent = 'Leer servicio'; }
});
async function agsQueryAll(layerUrl, layerInfo, where, onProgress){
  const page = Math.min(layerInfo.maxRecordCount || 1000, 2000);
  const paging = layerInfo.advancedQueryCapabilities ? layerInfo.advancedQueryCapabilities.supportsPagination !== false : true;
  const out = []; let offset = 0, useGeojson = true;
  while (out.length < MAX_FEATURES){
    const p = new URLSearchParams({ where: where || '1=1', outFields:'*', returnGeometry:'true', outSR:'4326', f: useGeojson ? 'geojson' : 'json' });
    if (paging){ p.set('resultOffset', offset); p.set('resultRecordCount', page); }
    if (agsToken()) p.set('token', agsToken());
    const j = await agsGet(`${layerUrl}/query`, p).catch(() => null);
    if (useGeojson && (!j || j.error || !Array.isArray(j.features))){ useGeojson = false; continue; }
    if (!j || j.error || !Array.isArray(j.features)) throw new Error(`ArcGIS: ${(j && j.error && j.error.message) || 'la consulta falló'}`);
    const feats = j.type === 'FeatureCollection' ? j.features : j.features.map(f => L.esri.Util.arcgisToGeoJSON(f));
    feats.forEach(f => { if (f.geometry) out.push({ type:'Feature', properties: f.properties || {}, geometry: f.geometry }); });
    onProgress && onProgress(out.length);
    const more = j.exceededTransferLimit || (j.properties && j.properties.exceededTransferLimit);
    if (!paging || !feats.length || (!more && feats.length < page)) break;
    offset += feats.length;
  }
  return out.slice(0, MAX_FEATURES);
}
async function addFromArcGIS(name, editable){
  if (!ags) throw new Error('Primero presiona "Leer servicio".');
  const mode = $('#agsMode').value, token = agsToken() || undefined;
  const [kind, num] = mode.split(':');
  if (kind === 'vector'){
    const layerUrl = `${ags.base}/${num}`;
    const info = ags.layerNum != null ? ags.info : await agsJson(layerUrl);
    const err = $('#layerErr');
    const feats = await agsQueryAll(layerUrl, info, $('#agsWhere').value.trim(), n => { err.style.color = 'var(--muted)'; err.textContent = `Descargando… ${fmt.format(n)} entidades`; });
    err.style.color = ''; err.textContent = '';
    if (!feats.length) throw new Error('La consulta no devolvió entidades. Revisa el filtro WHERE.');
    const fields = (info.fields || []).filter(f => !/esriFieldType(Geometry|Blob|Raster|XML)/.test(f.type) && !/^shape(_|\.)/i.test(f.name)).map(f => f.name);
    const lyr = addVectorLayer({ type:'FeatureCollection', features: feats }, { name: name || info.name || ags.title, editable, fields, source:'arcgis', sourceUrl: layerUrl });
    const b = lyr.group.getBounds(); if (b.isValid()) map.fitBounds(b, { padding:[30,30], maxZoom: 16 });
    toast(feats.length >= MAX_FEATURES ? `Se cargaron las primeras ${fmt.format(MAX_FEATURES)} entidades` : `${fmt.format(feats.length)} entidades cargadas`);
    return;
  }
  let bounds = agsExtent(ags.info.initialExtent || ags.info.fullExtent || ags.info.extent);
  if (!bounds && kind === 'image') bounds = await agsImageFootprint(ags.base);
  let spec, label;
  if (kind === 'tiled'){ spec = { type:'ags-tiled', url: ags.base, token }; label = 'ArcGIS · teselas'; }
  else if (kind === 'image'){
    spec = { type:'ags-image', url: ags.base, token, bandCount: ags.info.bandCount || null, pixelType: ags.info.pixelType || '',
      functions: (ags.info.rasterFunctionInfos || []).map(f => f.name).filter(n => n && n !== 'None') };
    const sub = mode.slice(6), bandTxt = $('#agsBands').value.trim();
    let bands = null;
    if (bandTxt){
      bands = bandTxt.split(/[\s,;]+/).map(Number);
      if (bands.length !== 3 || bands.some(n => !Number.isInteger(n) || n < 1 || n > (ags.info.bandCount || 99))) throw new Error(`Escribe tres bandas (R, G, B) entre 1 y ${ags.info.bandCount}.`);
    }
    if (sub === 'stretch'){ spec.render = { mode:'stretch', bands, stretch:{ type:'percent', min:.5, max:.5, sd:2, gamma:1, dra:true } }; label = 'ArcGIS · imagen estirada'; }
    else if (sub.startsWith('fn:')){ spec.render = { mode:'fn', fn: sub.slice(3) }; label = `ArcGIS · ${sub.slice(3)}`; }
    else { spec.render = { mode:'default', bands }; label = 'ArcGIS · ImageServer'; }
  } else {
    spec = { type:'ags-dynamic', url: ags.base, token }; if (num != null) spec.layers = [+num];
    label = 'ArcGIS · dinámico';
  }
  addRasterLayer(spec, name || (ags.layerNum != null ? ags.info.name : ags.title), { sourceLabel: label, bounds: bounds ? [[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]] : null });
  if (bounds){ map.fitBounds(bounds); toast('Servicio ArcGIS agregado'); }
  else toast('Servicio agregado, pero no pude calcular su extensión: navega hasta la zona para verlo');
}

$('#btnLayerOk').addEventListener('click', async () => {
  const err = $('#layerErr'); err.textContent = '';
  const name = $('#layerName').value.trim(), editable = $('#layerEditable').checked;
  const ok = $('#btnLayerOk'); ok.disabled = true;
  try {
    if (tab === 'file'){
      if (!pendingFile) throw new Error('Elige un archivo primero.');
      const ext = pendingFile.name.split('.').pop().toLowerCase();
      let fcs = [];
      if (ext === 'geojson' || ext === 'json') fcs = [normalizeFC(JSON.parse(await readText(pendingFile)))];
      else if (ext === 'kml') fcs = [toGeoJSON.kml(new DOMParser().parseFromString(await readText(pendingFile), 'text/xml'))];
      else if (ext === 'gpx') fcs = [toGeoJSON.gpx(new DOMParser().parseFromString(await readText(pendingFile), 'text/xml'))];
      else if (ext === 'zip'){ const r = await shp(await readBuf(pendingFile)); fcs = Array.isArray(r) ? r : [r]; }
      else if (ext === 'csv') fcs = [csvToFC(await readText(pendingFile))];
      else throw new Error('Formato no soportado: .' + ext);
      let last;
      fcs.forEach((fc, i) => { if (fc.features && fc.features.length) last = addVectorLayer(fc, { name: fcs.length > 1 ? (fc.fileName || `${name} ${i + 1}`) : (name || pendingFile.name), editable }); });
      if (!last) throw new Error('El archivo no tiene entidades.');
      const b = last.group.getBounds(); if (b.isValid()) map.fitBounds(b, { padding:[30,30], maxZoom: 16 });
      toast(`Capa agregada: ${last.name}`);
    } else if (tab === 'arcgis'){
      await addFromArcGIS(name, editable);
    } else if (tab === 'db'){
      await addFromDb(name);
    } else if (tab === 'url'){
      const type = $('#urlType').value, url = $('#urlValue').value.trim();
      if (!url) throw new Error('Escribe la URL del servicio.');
      if (type === 'geojson'){
        const r = await fetch(url); if (!r.ok) throw new Error(`El servidor respondió ${r.status}.`);
        const lyr = addVectorLayer(normalizeFC(await r.json()), { name: name || url.split('/').pop().split('?')[0] || 'GeoJSON', editable });
        const b = lyr.group.getBounds(); if (b.isValid()) map.fitBounds(b, { padding:[30,30] });
      } else if (type === 'wms'){
        const lys = $('#wmsLayers').value.trim(); if (!lys) throw new Error('Indica el nombre de la capa WMS.');
        addRasterLayer({ type:'wms', url, layers: lys }, name || lys, { sourceLabel:'WMS' });
      } else {
        if (!/\{z\}/.test(url)) throw new Error('La URL XYZ debe incluir {z}, {x} e {y}.');
        addRasterLayer({ type:'xyz', url }, name || 'Teselas XYZ', { sourceLabel:'Teselas XYZ' });
      }
      toast('Capa agregada');
    } else {
      const geom = $('#newGeom').value;
      const fields = $('#newFields').value.split(',').map(s => s.trim()).filter(Boolean);
      const color = palette()[+$('#newColor').value]; colorIdx++;
      addVectorLayer({ type:'FeatureCollection', features:[] }, { name: name || 'Capa editable', editable:true, color, fields, geom });
      toast('Capa creada. Usa las herramientas del mapa para dibujar.');
    }
    dlgLayer.close();
  } catch (e){ err.style.color = ''; err.textContent = e.message || String(e); }
  finally { ok.disabled = false; }
});

/* ---------- Diálogos de gráfico e indicador ---------- */
function fillLayerSelect(sel){ sel.innerHTML = ''; layers.filter(l => l.kind === 'vector').forEach(l => sel.append(el('option', { value: l.id }, l.name))); }
function fillFieldSelect(sel, lyr, opts){
  sel.innerHTML = ''; if (!lyr) return;
  const og1 = el('optgroup', { label:'Calculados' });
  if (opts.virtual) virtualFor(lyr).forEach(v => og1.append(el('option', { value:v }, VIRTUAL[v])));
  const og2 = el('optgroup', { label:'Atributos' });
  (opts.numeric ? numericFields(lyr) : lyr.fields).forEach(f => og2.append(el('option', { value:f }, f)));
  if (og1.children.length) sel.append(og1);
  if (og2.children.length) sel.append(og2);
}
const dlgChart = $('#dlgChart');
function syncChartForm(){
  const lyr = layers.find(l => l.id === $('#chLayer').value), hist = $('#chType').value === 'hist';
  $('#chCatField').hidden = hist; $('#chAggField').hidden = hist;
  const keepCat = $('#chCat').value, keepVal = $('#chVal').value;
  fillFieldSelect($('#chCat'), lyr, { virtual:false, numeric:false });
  fillFieldSelect($('#chVal'), lyr, { virtual: !hist, numeric:true });
  if ([...$('#chCat').options].some(o => o.value === keepCat)) $('#chCat').value = keepCat;
  if ([...$('#chVal').options].some(o => o.value === keepVal)) $('#chVal').value = keepVal;
  $('#chAgg').disabled = $('#chVal').value === '__count';
}
$('#chLayer').addEventListener('change', syncChartForm);
$('#chType').addEventListener('change', syncChartForm);
$('#chVal').addEventListener('change', () => { $('#chAgg').disabled = $('#chVal').value === '__count'; });
let editingChart = null, editingKpi = null;
function openChartDialog(w){
  if (!canEdit()) return;
  if (!layers.some(l => l.kind === 'vector')) return toast('Agrega primero una capa vectorial');
  editingChart = w;
  dlgChart.querySelector('.dlg-head h2').textContent = w ? 'Editar gráfico' : 'Nuevo gráfico';
  $('#btnChartOk').textContent = w ? 'Guardar' : 'Crear gráfico';
  fillLayerSelect($('#chLayer')); $('#chErr').textContent = '';
  const c = w ? w.cfg : null;
  if (c && [...$('#chLayer').options].some(o => o.value === c.layerId)) $('#chLayer').value = c.layerId;
  $('#chType').value = c ? c.type : 'bar';
  $('#chCat').innerHTML = ''; $('#chVal').innerHTML = '';
  syncChartForm();
  if (c){
    if ([...$('#chCat').options].some(o => o.value === c.catField)) $('#chCat').value = c.catField;
    if ([...$('#chVal').options].some(o => o.value === c.valField)) $('#chVal').value = c.valField;
    $('#chAgg').value = c.agg || 'sum'; $('#chAgg').disabled = $('#chVal').value === '__count';
  }
  $('#chTitle').value = c ? c.title : '';
  dlgChart.showModal();
}
$('#btnAddChart').addEventListener('click', () => openChartDialog(null));
$('#btnChartOk').addEventListener('click', () => {
  const c = { layerId: $('#chLayer').value, type: $('#chType').value, catField: $('#chCat').value, valField: $('#chVal').value, agg: $('#chAgg').value };
  if (!c.valField) return $('#chErr').textContent = 'La capa no tiene campos numéricos para este gráfico.';
  if (c.type !== 'hist' && !c.catField) return $('#chErr').textContent = 'Elige un campo para agrupar.';
  c.title = $('#chTitle').value.trim() || (c.type === 'hist' ? `Distribución de ${fieldLabel(c.valField)}` : `${c.valField === '__count' ? 'Entidades' : fieldLabel(c.valField)} por ${c.catField}`);
  dlgChart.close();
  if (editingChart){ editingChart.cfg = c; renderWidgets(); if (widgets.some(x => x.type === 'layers')) renderLayers(); scheduleSave(); toast('Gráfico actualizado'); }
  else { addWidget('chart', { cfg: c }); toast('Gráfico agregado: arrástralo a donde quieras'); }
});
const dlgKpi = $('#dlgKpi');
function syncKpiStat(){ const isCount = $('#kField').value === '__count'; $('#kStat').disabled = isCount; if (isCount) $('#kStat').value = 'count'; }
function syncKpiForm(){ fillFieldSelect($('#kField'), layers.find(l => l.id === $('#kLayer').value), { virtual:true, numeric:true }); syncKpiStat(); }
$('#kLayer').addEventListener('change', syncKpiForm);
$('#kField').addEventListener('change', syncKpiStat);
function openKpiDialog(w){
  if (!canEdit()) return;
  if (!layers.some(l => l.kind === 'vector')) return toast('Agrega primero una capa vectorial');
  editingKpi = w;
  dlgKpi.querySelector('.dlg-head h2').textContent = w ? 'Editar indicador' : 'Nuevo indicador';
  $('#btnKpiOk').textContent = w ? 'Guardar' : 'Crear indicador';
  fillLayerSelect($('#kLayer')); $('#kErr').textContent = '';
  const c = w ? w.cfg : null;
  if (c && [...$('#kLayer').options].some(o => o.value === c.layerId)) $('#kLayer').value = c.layerId;
  $('#kStat').value = 'sum';
  syncKpiForm();
  if (c && [...$('#kField').options].some(o => o.value === c.field)){ $('#kField').value = c.field; syncKpiStat(); if (c.field !== '__count') $('#kStat').value = c.stat; }
  $('#kLabel').value = c ? c.label : ''; $('#kUnit').value = c ? (c.unit || '') : '';
  dlgKpi.showModal();
}
$('#btnAddKpi').addEventListener('click', () => openKpiDialog(null));
$('#btnKpiOk').addEventListener('click', () => {
  const field = $('#kField').value; if (!field) return $('#kErr').textContent = 'Elige un campo.';
  const st = field === '__count' ? 'count' : $('#kStat').value, lyr = layers.find(l => l.id === $('#kLayer').value);
  const unit = $('#kUnit').value.trim() || (field === '__area' ? 'ha' : field === '__length' ? 'km' : '');
  const cfg = { layerId: lyr.id, field, stat: st, unit, label: $('#kLabel').value.trim() || (field === '__count' ? `Entidades en ${lyr.name}` : `${fieldLabel(field)} (${STAT_LABEL[st]})`) };
  dlgKpi.close();
  if (editingKpi){ editingKpi.cfg = cfg; renderWidgets(); if (widgets.some(x => x.type === 'layers')) renderLayers(); scheduleSave(); toast('Indicador actualizado'); }
  else { addWidget('kpi', { cfg }); toast('Indicador agregado: arrástralo a donde quieras'); }
});




/* =================================================================
   Simbología: leyendas, menú de capa y editores
   ================================================================= */
/* Muestra de símbolo según geometría */
function swatch(kind, fill, stroke, st){
  const s = el('span', { class:'sw sw-' + kind });
  if (kind === 'ln') s.style.background = fill;
  else { s.style.background = fill; s.style.boxShadow = `inset 0 0 0 ${Math.min(2, st ? st.weight : 1)}px ${stroke}`; if (st) s.style.opacity = Math.max(.35, kind === 'pg' ? Math.min(1, st.fillOpacity + .35) : 1); }
  return s;
}
const kindOf = lyr => lyr.geom === 'Point' ? 'pt' : lyr.geom === 'LineString' ? 'ln' : 'pg';
function layerSwatch(lyr){
  const st = lyr.style;
  if (st.mode === 'single') return swatch(kindOf(lyr), st.fill, st.strokeSame ? st.fill : st.stroke, st);
  const cols = st.mode === 'categories' ? st.cats.map(c => c.color) : st.colors;
  const s = el('span', { class:'sw sw-multi' }); s.style.background = `linear-gradient(90deg,${(cols.length ? cols : [st.fill]).slice(0, 6).join(',')})`;
  return s;
}
/* Entradas de leyenda de una capa: [{color, label}] */
function legendEntries(lyr){
  const st = lyr.style;
  if (lyr.kind !== 'vector' || st.mode === 'single') return [];
  if (st.mode === 'categories') return st.cats.map(c => ({ color:c.color, label: c.value === '' ? '(sin valor)' : String(c.value) })).concat(st.cats.length ? [] : []);
  return st.colors.map((c, i) => ({ color:c, label:`${fmtBreak(st.breaks[i])} – ${fmtBreak(st.breaks[i + 1])}` }));
}
function layerLegend(lyr, max){
  if (lyr.kind === 'raster') return rasterLegend(lyr);
  const items = legendEntries(lyr); if (!items.length) return null;
  const st = lyr.style, k = kindOf(lyr), box = el('div', { class:'mini-legend' });
  if (st.field) box.append(el('div', { class:'ml-field' }, st.field));
  items.slice(0, max || 99).forEach(it => box.append(el('div', { class:'ml-row' }, swatch(k, it.color, st.strokeSame ? it.color : st.stroke, st), el('span', {}, it.label))));
  if (max && items.length > max) box.append(el('div', { class:'ml-more' }, `y ${items.length - max} más`));
  return box;
}
function rasterLegend(lyr){
  const r = lyr.spec.render;
  if (!r || r.mode !== 'ndvi') return null;
  return el('div', { class:'mini-legend' }, el('div', { class:'ml-field' }, `NDVI (bandas ${r.nir} y ${r.red})`),
    el('div', { class:'ml-ramp', style:'background:linear-gradient(90deg,#a50026,#f46d43,#fee08b,#a6d96a,#1a9850,#006837)' }),
    el('div', { class:'ml-ends' }, el('span', {}, 'Sin vegetación'), el('span', {}, 'Vegetación densa')));
}
/* Widget Leyenda: capas visibles, en el orden del mapa */
function renderLegend(){
  const box = $('#legendBox'); if (!box) return;
  box.innerHTML = '';
  const vis = [...layers].reverse().filter(l => l.visible);
  if (!vis.length){ box.append(el('div', { class:'ml-more' }, 'No hay capas visibles.')); return; }
  vis.forEach(l => {
    const sec = el('div', { class:'lg-layer' });
    const head = el('div', { class:'lg-head' }, l.kind === 'vector' && l.style.mode === 'single' ? layerSwatch(l) : null, el('b', {}, l.name));
    sec.append(head);
    const leg = layerLegend(l); if (leg) sec.append(leg);
    else if (l.kind === 'raster') sec.append(el('div', { class:'ml-more' }, l.sourceLabel || 'Imagen'));
    box.append(sec);
  });
}
/* Colores por categoría también en los gráficos, si agrupan por el mismo campo */
function catColors(lyr, c, labels){
  if (!lyr || !lyr.style || c.type === 'line' || c.type === 'hist') return null;
  const st = lyr.style;
  if (st.mode !== 'categories' || st.field !== c.catField) return null;
  return labels.map(l => { const x = st.cats.find(k => String(k.value) === (l === '(sin valor)' ? '' : l)); return x ? x.color : st.other; });
}

/* ---------- Menú contextual ---------- */
let openMenuEl = null;
function closeMenu(){ if (openMenuEl){ openMenuEl.remove(); openMenuEl = null; document.removeEventListener('pointerdown', menuOutside, true); } }
function menuOutside(e){ if (openMenuEl && !openMenuEl.contains(e.target)) closeMenu(); }
function openMenu(btn, items){
  closeMenu();
  const m = el('div', { class:'menu', role:'menu' }, items.map(it => el('button', { role:'menuitem', class: it.danger ? 'danger' : '', onclick:() => { closeMenu(); it.run(); } }, svg(it.icon), it.label)));
  document.body.append(m); openMenuEl = m;
  const r = btn.getBoundingClientRect();
  m.style.top = Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8) + 'px';
  m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
  m.querySelector('button').focus();
  m.addEventListener('keydown', e => {
    const bs = [...m.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
    if (e.key === 'Escape'){ closeMenu(); btn.focus(); }
    if (e.key === 'ArrowDown'){ e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
    if (e.key === 'ArrowUp'){ e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
  });
  setTimeout(() => document.addEventListener('pointerdown', menuOutside, true), 0);
}

/* ---------- Cambiar nombre ---------- */
function renameLayer(lyr){
  const d = $('#dlgPrompt');
  $('#prTitle').textContent = 'Cambiar nombre de la capa'; $('#prInput').value = lyr.name;
  d.returnValue = '';
  d.addEventListener('close', () => {
    const v = $('#prInput').value.trim();
    if (d.returnValue !== 'ok' || !v || v === lyr.name) return;
    lyr.name = v; renderLayers(); renderWidgets(); renderLayers(); toast('Nombre actualizado');
  }, { once:true });
  d.showModal(); setTimeout(() => $('#prInput').select(), 0);
}
$('#formPrompt').addEventListener('submit', e => { e.preventDefault(); $('#dlgPrompt').close('ok'); });

function openSymbology(lyr){ if (!canEdit()) return; lyr.kind === 'vector' ? openVectorSym(lyr) : openRasterSym(lyr); }

/* ---------- Editor de simbología vectorial ---------- */
const dlgSym = $('#dlgSym');
let symLyr = null, symBackup = null, symApplied = false;
Object.entries(RAMPS).forEach(([k, r]) => $('#syRamp').append(el('option', { value:k }, r.name)));
for (let i = 2; i <= 9; i++) $('#syClasses').append(el('option', { value:i }, i));
Object.entries(DASHES).forEach(([k, n]) => $('#syDash').append(el('option', { value:k }, n)));
function symValues(lyr, field){
  const out = []; lyr.group.eachLayer(f => out.push(f.feature && f.feature.properties ? f.feature.properties[field] : undefined)); return out;
}
function buildClasses(lyr, st){
  if (st.mode === 'categories'){
    const counts = new Map();
    symValues(lyr, st.field).forEach(v => { const k = v == null ? '' : String(v); counts.set(k, (counts.get(k) || 0) + 1); });
    const vals = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(x => x[0]);
    vals.sort((a, b) => (isNaN(+a) || isNaN(+b)) ? a.localeCompare(b, 'es') : (+a) - (+b));
    const cols = rampColors(st.ramp, vals.length, st.reverse);
    const keep = new Map(st.cats.map(c => [String(c.value), c.color]));
    st.cats = vals.map((v, i) => ({ value:v, color: st._keep && keep.has(v) ? keep.get(v) : cols[i], n: counts.get(v) }));
    if (counts.size > 40) toast(`El campo tiene ${counts.size} valores; se simbolizan los 40 más frecuentes y el resto va en gris.`);
  } else if (st.mode === 'ranges'){
    const vals = symValues(lyr, st.field).map(v => v === '' || v == null ? NaN : +v).filter(Number.isFinite);
    st.breaks = classBreaks(vals, +st.classes, st.method);
    st.colors = rampColors(st.ramp === 'categorico' ? 'verdes' : st.ramp, Math.max(1, st.breaks.length - 1), st.reverse);
  }
  delete st._keep;
}
function renderClassList(){
  const st = symLyr.style, box = $('#syClassList'); box.innerHTML = '';
  const k = kindOf(symLyr);
  if (st.mode === 'categories'){
    if (!st.cats.length) return box.append(el('div', { class:'ml-more' }, 'El campo no tiene valores.'));
    st.cats.forEach(c => {
      const inp = el('input', { type:'color', value: toHex(c.color), 'aria-label':`Color de ${c.value || 'sin valor'}`, oninput:e => { c.color = e.target.value; applyStyle(symLyr); renderLayers(); } });
      box.append(el('label', { class:'sc-row' }, inp, el('span', { class:'sc-val' }, c.value === '' ? '(sin valor)' : c.value), el('span', { class:'sc-n' }, c.n != null ? fmt.format(c.n) : '')));
    });
  } else if (st.mode === 'ranges'){
    if (st.breaks.length < 2) return box.append(el('div', { class:'ml-more' }, 'El campo no tiene valores numéricos.'));
    const vals = symValues(symLyr, st.field).map(Number).filter(Number.isFinite);
    st.colors.forEach((c, i) => {
      const n = vals.filter(v => classIndex(st.breaks, v) === i).length;
      const inp = el('input', { type:'color', value: toHex(c), 'aria-label':`Color de la clase ${i + 1}`, oninput:e => { st.colors[i] = e.target.value; applyStyle(symLyr); renderLayers(); } });
      box.append(el('label', { class:'sc-row' }, inp, el('span', { class:'sc-val' }, `${fmtBreak(st.breaks[i])} – ${fmtBreak(st.breaks[i + 1])}`), el('span', { class:'sc-n' }, fmt.format(n))));
    });
  }
}
function setSymMode(mode){
  const st = symLyr.style; st.mode = mode;
  document.querySelectorAll('#symModes button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  $('#symSingle').hidden = mode !== 'single'; $('#symThematic').hidden = mode === 'single';
  $('#syRangeOpts').hidden = mode !== 'ranges';
  if (mode !== 'single'){
    const fields = mode === 'ranges' ? numericFields(symLyr) : symLyr.fields;
    const sel = $('#syField'), prev = st.field; sel.innerHTML = '';
    fields.forEach(f => sel.append(el('option', { value:f }, f)));
    if (!fields.length){ sel.append(el('option', { value:'' }, mode === 'ranges' ? 'No hay campos numéricos' : 'No hay campos')); }
    sel.value = fields.includes(prev) ? prev : (fields[0] || '');
    st.field = sel.value;
    if (mode === 'ranges' && st.ramp === 'categorico') st.ramp = 'verdes';
    if (mode === 'categories' && !st.cats.length) st.ramp = st.ramp || 'categorico';
    $('#syRamp').value = st.ramp;
    buildClasses(symLyr, st);
  }
  syncRampPrev(); renderClassList(); applyStyle(symLyr); renderLayers();
}
function syncRampPrev(){ $('#syRampPrev').style.background = rampCss($('#syRamp').value, $('#syReverse').checked); }
function openVectorSym(lyr){
  symLyr = lyr; symBackup = structuredClone(lyr.style); symApplied = false;
  const st = lyr.style;
  $('#symTitle').textContent = `Simbología · ${lyr.name}`;
  $('#syFill').value = toHex(st.fill);
  $('#syFillOp').value = st.fillOpacity; $('#syWeight').value = st.weight;
  $('#syStroke').value = toHex(st.stroke); $('#syStrokeSame').checked = !!st.strokeSame; $('#syStroke').disabled = !!st.strokeSame;
  $('#syDash').value = st.dash || ''; $('#syRadius').value = st.radius;
  $('#syRadiusField').hidden = !(lyr.geom === 'Point' || lyr.geom === 'Mixed');
  $('#syFillOpField').hidden = lyr.geom === 'LineString';
  $('#syStrokeRow').hidden = lyr.geom === 'LineString';
  $('#syClasses').value = st.classes; $('#syMethod').value = st.method; $('#syReverse').checked = !!st.reverse;
  const lf = $('#syLabel'); lf.innerHTML = ''; lf.append(el('option', { value:'' }, 'Sin etiquetas'));
  lyr.fields.forEach(f => lf.append(el('option', { value:f }, f)));
  lf.value = (st.label && st.label.field) || ''; $('#syLabelSize').value = (st.label && st.label.size) || 'm';
  syncSymOutputs();
  document.querySelectorAll('#symModes button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === st.mode)));
  $('#symSingle').hidden = st.mode !== 'single'; $('#symThematic').hidden = st.mode === 'single'; $('#syRangeOpts').hidden = st.mode !== 'ranges';
  if (st.mode !== 'single'){
    const fields = st.mode === 'ranges' ? numericFields(lyr) : lyr.fields, sel = $('#syField'); sel.innerHTML = '';
    fields.forEach(f => sel.append(el('option', { value:f }, f))); sel.value = st.field; $('#syRamp').value = st.ramp;
  }
  syncRampPrev(); renderClassList();
  dlgSym.showModal();
}
function syncSymOutputs(){
  $('#syFillOpOut').textContent = Math.round($('#syFillOp').value * 100) + '%';
  $('#syWeightOut').textContent = fmt.format(+$('#syWeight').value) + ' px';
  $('#syRadiusOut').textContent = $('#syRadius').value + ' px';
}
document.querySelectorAll('#symModes button').forEach(b => b.addEventListener('click', () => setSymMode(b.dataset.mode)));
function symCommon(){
  const st = symLyr.style;
  st.fill = $('#syFill').value; st.fillOpacity = +$('#syFillOp').value; st.weight = +$('#syWeight').value;
  st.strokeSame = $('#syStrokeSame').checked; st.stroke = $('#syStroke').value; $('#syStroke').disabled = st.strokeSame;
  st.dash = $('#syDash').value; st.radius = +$('#syRadius').value;
  st.label = { field: $('#syLabel').value, size: $('#syLabelSize').value };
  syncSymOutputs(); applyStyle(symLyr); renderLayers();
}
['#syFill', '#syFillOp', '#syWeight', '#syStroke', '#syStrokeSame', '#syDash', '#syRadius', '#syLabel', '#syLabelSize'].forEach(s => $(s).addEventListener('input', symCommon));
function symThematic(keep){
  const st = symLyr.style;
  st.field = $('#syField').value; st.ramp = $('#syRamp').value; st.reverse = $('#syReverse').checked;
  st.classes = +$('#syClasses').value; st.method = $('#syMethod').value; st._keep = !!keep;
  buildClasses(symLyr, st); syncRampPrev(); renderClassList(); applyStyle(symLyr); renderLayers();
}
$('#syField').addEventListener('change', () => symThematic(false));
['#syRamp', '#syReverse', '#syClasses', '#syMethod'].forEach(s => $(s).addEventListener('change', () => symThematic(false)));
$('#btnSymOk').addEventListener('click', () => {
  symApplied = true; dlgSym.close();
  renderWidgets(); renderLayers(); scheduleSave(); toast('Simbología aplicada');
});
dlgSym.addEventListener('close', () => {
  if (!symApplied && symLyr){ symLyr.style = symBackup; applyStyle(symLyr); renderLayers(); }
  symLyr = null;
});

/* ---------- Editor de simbología de imágenes ---------- */
const dlgRas = $('#dlgRas');
let rasLyr = null, rasBackup = null, rasApplied = false, rasT = null;
const FX = [['rsOpacity', 'opacity'], ['rsBright', 'brightness'], ['rsContrast', 'contrast'], ['rsSat', 'saturate'], ['rsGray', 'grayscale']];
function rebuildRaster(lyr){
  const pane = rasterPane(lyr.id);
  map.removeLayer(lyr.tile);
  lyr.tile = makeRaster(lyr.spec, pane);
  if (lyr.tile.setOpacity) lyr.tile.setOpacity(lyr.opacity);
  if (lyr.visible) lyr.tile.addTo(map);
}
function bandSelect(sel, n, v){
  sel.innerHTML = '';
  for (let i = 1; i <= n; i++) sel.append(el('option', { value:i }, `Banda ${i}`));
  sel.value = Math.min(n, Math.max(1, v || 1));
}
async function openRasterSym(lyr){
  rasLyr = lyr; rasBackup = { spec: structuredClone(lyr.spec), opacity: lyr.opacity }; rasApplied = false;
  const sp = lyr.spec, isImg = sp.type === 'ags-image';
  $('#rasTitle').textContent = `Simbología · ${lyr.name}`;
  $('#rsImage').hidden = !isImg;
  const fx = sp.fx || {};
  $('#rsOpacity').value = Math.round(lyr.opacity * 100);
  $('#rsBright').value = fx.brightness ?? 100; $('#rsContrast').value = fx.contrast ?? 100; $('#rsSat').value = fx.saturate ?? 100; $('#rsGray').value = fx.grayscale ?? 0;
  syncRasOutputs();
  dlgRas.showModal();
  if (!isImg) return;
  const info = $('#rsInfo');
  if (!sp.bandCount){
    info.textContent = 'Leyendo el servicio…';
    try {
      const p = new URLSearchParams({ f:'json' }); if (sp.token) p.set('token', sp.token);
      const j = await agsGet(sp.url, p);
      sp.bandCount = j.bandCount || 1; sp.pixelType = j.pixelType || '';
      sp.functions = (j.rasterFunctionInfos || []).map(f => f.name).filter(n => n && n !== 'None');
    } catch (e){ sp.bandCount = sp.bandCount || 3; info.textContent = 'No pude leer el servicio: ' + e.message; }
  }
  const n = sp.bandCount || 3;
  info.textContent = `${n} banda${n === 1 ? '' : 's'}${sp.pixelType ? ' · ' + sp.pixelType : ''}${/16|32|64/.test(sp.pixelType || '') ? ' · conviene estirar el histograma' : ''}`;
  const r = sp.render || (sp.renderingRule && sp.renderingRule.rasterFunction === 'Stretch' ? { mode:'stretch' } : { mode:'default' });
  sp.render = r;
  const fnOpt = $('#rsMode').querySelector('option[value="fn"]'); fnOpt.hidden = fnOpt.disabled = !(sp.functions || []).length;
  const ndviOpt = $('#rsMode').querySelector('option[value="ndvi"]'); ndviOpt.hidden = ndviOpt.disabled = n < 2;
  $('#rsMode').value = r.mode || 'default';
  const pres = bandPresets(n), ps = $('#rsPreset'); ps.innerHTML = '';
  ps.append(el('option', { value:'' }, 'Las que define el servidor'));
  Object.entries(pres).forEach(([k, b]) => ps.append(el('option', { value:k }, `${PRESET_NAMES[k]} (${b.join(', ')})`)));
  ps.append(el('option', { value:'custom' }, 'Personalizada'));
  const bs = r.bands || null;
  ['#rsR', '#rsG', '#rsB'].forEach((s, i) => bandSelect($(s), n, bs ? bs[i] : (pres.natural ? pres.natural[i] : i + 1)));
  const match = bs && Object.entries(pres).find(([, b]) => b.join() === bs.join());
  ps.value = !bs ? '' : match ? match[0] : 'custom';
  $('#rsCustom').hidden = ps.value !== 'custom';
  const s = r.stretch || {};
  $('#rsSType').value = s.type || 'percent'; $('#rsMin').value = s.min ?? .5; $('#rsMax').value = s.max ?? .5; $('#rsSd').value = s.sd ?? 2;
  $('#rsGamma').value = s.gamma ?? 1; $('#rsDra').checked = s.dra !== false;
  bandSelect($('#rsRed'), n, r.red || (n >= 8 ? 5 : n >= 4 ? 3 : 1)); bandSelect($('#rsNir'), n, r.nir || (n >= 8 ? 7 : n >= 4 ? 4 : n));
  $('#rsCmap').value = r.colormap || 'NDVI';
  const fs = $('#rsFn'); fs.innerHTML = ''; (sp.functions || []).forEach(f => fs.append(el('option', { value:f }, f))); if (r.fn) fs.value = r.fn;
  syncRasMode(); syncRasOutputs();
}
function syncRasMode(){
  const m = $('#rsMode').value;
  $('#rsBandsBox').hidden = !(m === 'default' || m === 'stretch') || (rasLyr && (rasLyr.spec.bandCount || 3) < 3);
  $('#rsStretchBox').hidden = m !== 'stretch';
  $('#rsNdviBox').hidden = m !== 'ndvi';
  $('#rsFnBox').hidden = m !== 'fn';
  const t = $('#rsSType').value;
  $('#rsPctBox').hidden = t !== 'percent'; $('#rsSdBox').hidden = t !== 'stddev';
}
function syncRasOutputs(){
  $('#rsOpacityOut').textContent = $('#rsOpacity').value + '%';
  $('#rsBrightOut').textContent = $('#rsBright').value + '%'; $('#rsContrastOut').textContent = $('#rsContrast').value + '%';
  $('#rsSatOut').textContent = $('#rsSat').value + '%'; $('#rsGrayOut').textContent = $('#rsGray').value + '%';
  $('#rsGammaOut').textContent = fmt.format(+$('#rsGamma').value);
}
function readRender(){
  const m = $('#rsMode').value, pres = bandPresets(rasLyr.spec.bandCount || 3), pv = $('#rsPreset').value;
  const bands = pv === '' ? null : pv === 'custom' ? ['#rsR', '#rsG', '#rsB'].map(s => +$(s).value) : pres[pv];
  if (m === 'ndvi') return { mode:'ndvi', red: +$('#rsRed').value, nir: +$('#rsNir').value, colormap: $('#rsCmap').value };
  if (m === 'fn') return { mode:'fn', fn: $('#rsFn').value };
  if (m === 'stretch') return { mode:'stretch', bands, stretch:{ type: $('#rsSType').value, min: +$('#rsMin').value, max: +$('#rsMax').value, sd: +$('#rsSd').value, gamma: +$('#rsGamma').value, dra: $('#rsDra').checked } };
  return { mode:'default', bands };
}
/* Vista previa: los ajustes visuales son inmediatos; el renderizado pide una imagen nueva al servidor */
function rasPreviewFx(){
  const sp = rasLyr.spec;
  sp.fx = { brightness: +$('#rsBright').value, contrast: +$('#rsContrast').value, saturate: +$('#rsSat').value, grayscale: +$('#rsGray').value };
  rasLyr.opacity = $('#rsOpacity').value / 100; if (rasLyr.tile.setOpacity) rasLyr.tile.setOpacity(rasLyr.opacity);
  map.getPane(rasterPane(rasLyr.id)).style.filter = fxFilter(sp.fx);
  syncRasOutputs();
}
function rasPreviewRender(){
  syncRasMode(); syncRasOutputs();
  if (rasLyr.spec.type !== 'ags-image') return;
  clearTimeout(rasT);
  rasT = setTimeout(() => { rasLyr.spec.render = readRender(); delete rasLyr.spec.renderingRule; delete rasLyr.spec.bandIds; rebuildRaster(rasLyr); }, 500);
}
FX.forEach(([id]) => $('#' + id).addEventListener('input', rasPreviewFx));
$('#rsPreset').addEventListener('change', () => {
  const pv = $('#rsPreset').value, pres = bandPresets(rasLyr.spec.bandCount || 3);
  $('#rsCustom').hidden = pv !== 'custom';
  if (pres[pv]) ['#rsR', '#rsG', '#rsB'].forEach((s, i) => { $(s).value = pres[pv][i]; });
  rasPreviewRender();
});
['#rsMode', '#rsR', '#rsG', '#rsB', '#rsSType', '#rsMin', '#rsMax', '#rsSd', '#rsGamma', '#rsDra', '#rsRed', '#rsNir', '#rsCmap', '#rsFn'].forEach(s => $(s).addEventListener('change', rasPreviewRender));
$('#rsGamma').addEventListener('input', syncRasOutputs);
$('#rsReset').addEventListener('click', () => { $('#rsBright').value = 100; $('#rsContrast').value = 100; $('#rsSat').value = 100; $('#rsGray').value = 0; $('#rsOpacity').value = 100; rasPreviewFx(); });
$('#btnRasOk').addEventListener('click', () => {
  clearTimeout(rasT);
  if (rasLyr.spec.type === 'ags-image'){
    const r = readRender(), changed = JSON.stringify(r) !== JSON.stringify(rasLyr.spec.render);
    rasLyr.spec.render = r; delete rasLyr.spec.renderingRule; delete rasLyr.spec.bandIds;
    if (changed) rebuildRaster(rasLyr);
    rasLyr.sourceLabel = { default:'ArcGIS · ImageServer', stretch:'ArcGIS · imagen estirada', ndvi:'ArcGIS · NDVI', fn:`ArcGIS · ${r.fn}` }[r.mode];
  }
  rasApplied = true; dlgRas.close();
  renderLayers(); scheduleSave(); toast('Simbología aplicada');
});
dlgRas.addEventListener('close', () => {
  clearTimeout(rasT);
  if (!rasApplied && rasLyr){
    const changedRender = JSON.stringify(rasLyr.spec.render) !== JSON.stringify(rasBackup.spec.render);
    rasLyr.spec = rasBackup.spec; rasLyr.opacity = rasBackup.opacity;
    map.getPane(rasterPane(rasLyr.id)).style.filter = fxFilter(rasLyr.spec.fx);
    if (changedRender) rebuildRaster(rasLyr); else if (rasLyr.tile.setOpacity) rasLyr.tile.setOpacity(rasLyr.opacity);
    renderLayers();
  }
  rasLyr = null;
});

/* =================================================================
   Capas desde bases de datos espaciales (PostGIS)
   ================================================================= */
const dbTimers = new Map(), geomTimers = new Map();
const connOf = lyr => lyr.db ? S.connections.find(c => c.id === lyr.db.connId) : null;
const dbWritable = lyr => !!(lyr.db && lyr.db.write && lyr.editable && canEdit() && connOf(lyr));
function startDbTimer(lyr){
  stopDbTimer(lyr);
  const m = +lyr.db.refresh || 0;
  if (m > 0) dbTimers.set(lyr.id, setInterval(() => refreshDbLayer(lyr, true), m * 60000));
}
function stopDbTimer(lyr){ clearInterval(dbTimers.get(lyr.id)); dbTimers.delete(lyr.id); }
async function refreshDbLayer(lyr, quiet){
  const c = connOf(lyr);
  if (!c){
    lyr.db.status = 'Sin conexión'; renderLayers();
    if (!quiet) toast(`La conexión de "${lyr.name}" no existe en este navegador; se muestra la última copia guardada.`);
    return;
  }
  let pending = false; lyr.group.eachLayer(f => { if (f._dbNew) pending = true; });
  if (lyr._busy || (quiet && (popupOpen || pending || design))) { renderLayers(); return; }
  lyr._busy = true;
  try {
    const fc = await dbFetchFeatures(c, { table: lyr.db.table, filter: lyr.db.filter, max: lyr.db.max, geomCol: lyr.db.geomCol });
    lyr.group.clearLayers(); lyr.group.addData(fc); applyLabels(lyr);
    fc.features.forEach(f => Object.keys(f.properties || {}).forEach(k => { if (!lyr.fields.includes(k)) lyr.fields.push(k); }));
    lyr.db.synced = Date.now(); lyr.db.status = null;
    if (!quiet) toast(`${lyr.name}: ${fmt.format(fc.features.length)} entidades desde ${c.name}`);
  } catch (e){
    lyr.db.status = 'Error de conexión';
    if (!quiet) toast(`${lyr.name}: ${e.message}`); else console.warn('GeoTablero', lyr.name, e);
  } finally { lyr._busy = false; }
  refreshEditing(); renderLayers(); scheduleRefresh();
}
/* Solo se envían columnas que existen en la tabla */
function dbRowFromProps(lyr, props){
  const row = {}, cols = lyr.db.columns;
  Object.entries(props).forEach(([k, v]) => {
    if (cols && cols.length && !cols.includes(k)) return;
    if (k === lyr.db.geomCol) return;
    row[k] = v === '' ? null : v;
  });
  return row;
}
async function dbSaveFeature(lyr, f){
  const c = connOf(lyr); if (!c) throw new Error('La conexión de esta capa no existe.');
  const props = f.feature.properties, row = dbRowFromProps(lyr, props), pk = lyr.db.pk;
  if (f._dbNew){
    if (pk && (row[pk] == null)) delete row[pk];
    row[lyr.db.geomCol] = toEWKT(f.toGeoJSON().geometry, lyr.db.multi);
    const back = await dbInsert(c, lyr.db.table, row);
    if (back && pk && back[pk] != null) props[pk] = back[pk];
    f._dbNew = false;
  } else {
    const id = props[pk];
    if (id == null || id === '') throw new Error('La entidad no tiene valor en la clave primaria.');
    delete row[pk];
    await dbUpdate(c, lyr.db.table, pk, id, row);
  }
  lyr.db.synced = Date.now();
}
function queueGeomSave(lyr, f){
  if (f._dbNew) return;   // las nuevas se guardan con el botón Guardar
  clearTimeout(geomTimers.get(f));
  geomTimers.set(f, setTimeout(async () => {
    geomTimers.delete(f);
    const c = connOf(lyr), id = f.feature.properties[lyr.db.pk];
    try { await dbUpdate(c, lyr.db.table, lyr.db.pk, id, { [lyr.db.geomCol]: toEWKT(f.toGeoJSON().geometry, lyr.db.multi) }); lyr.db.synced = Date.now(); toast('Geometría guardada en la base de datos'); renderLayers(); }
    catch (e){ toast('No se guardó la geometría en la base: ' + e.message); }
  }, 700));
}
async function dbRemoveFeature(lyr, f){
  const c = connOf(lyr); if (!c) throw new Error('La conexión de esta capa no existe.');
  await dbDelete(c, lyr.db.table, lyr.db.pk, f.feature.properties[lyr.db.pk]);
}

/* ---------- Pestaña "Base de datos" del diálogo Agregar capa ---------- */
let dbTables = [];
const FILTER_HELP = {
  supabase: 'Sintaxis PostgREST: columna=operador.valor, unidos con &. Operadores: eq, neq, gt, gte, lt, lte, like, ilike, in.(a,b).',
  postgrest: 'Sintaxis PostgREST: columna=operador.valor, unidos con &. Operadores: eq, neq, gt, gte, lt, lte, like, ilike, in.(a,b).',
  ogcapi: 'Parámetros de consulta del servicio, por ejemplo campo=valor, o filter=… (CQL2) si el servidor lo admite.',
  wfs: 'Filtro CQL de GeoServer, por ejemplo estado = \'Activo\' AND superficie > 10.'
};
const currentConn = () => S.connections.find(x => x.id === $('#dbConn').value);
async function initDbPane(){
  await reloadStore();
  const sel = $('#dbConn'), prev = sel.value; sel.innerHTML = '';
  $('#dbNoConn').hidden = S.connections.length > 0;
  $('#dbFields').hidden = !S.connections.length;
  S.connections.forEach(c => sel.append(el('option', { value: c.id }, `${c.name} · ${CONN_TYPES[c.type].name}`)));
  if (prev && S.connections.some(c => c.id === prev)) sel.value = prev;
  if (S.connections.length) loadDbTables();
}
async function loadDbTables(){
  const c = currentConn(), ts = $('#dbTable'), info = $('#dbInfo');
  ts.innerHTML = ''; dbTables = [];
  if (!c) return;
  $('#dbFilter').placeholder = 'ej. ' + CONN_TYPES[c.type].filter;
  $('#dbFilterHelp').textContent = FILTER_HELP[c.type];
  $('#dbWriteRow').hidden = !CONN_TYPES[c.type].write;
  info.hidden = false; info.textContent = 'Leyendo tablas…';
  try {
    dbTables = await dbListTables(c);
    if (!dbTables.length){ info.textContent = 'La conexión responde, pero no hay tablas o capas con geometría visibles para su clave.'; return; }
    dbTables.forEach(t => ts.append(el('option', { value: t.id }, t.title + (t.geomCol ? `  ·  ${t.geomCol}` : ''))));
    syncDbTable();
  } catch (e){ info.textContent = e.message; }
}
function syncDbTable(){
  const c = currentConn(), t = dbTables.find(x => x.id === $('#dbTable').value), info = $('#dbInfo');
  if (!c || !t) return;
  const canWrite = CONN_TYPES[c.type].write && !!t.pk;
  $('#dbWrite').disabled = !canWrite; if (!canWrite) $('#dbWrite').checked = false;
  info.hidden = false;
  info.innerHTML = CONN_TYPES[c.type].write
    ? `Geometría: <b>${esc(t.geomCol)}</b> · Clave primaria: <b>${esc(t.pk || 'no tiene')}</b> · ${t.fields.length} columnas${t.pk ? '' : '. Sin clave primaria se puede leer, pero no guardar ediciones.'}`
    : `Capa <b>${esc(t.title)}</b> · esta conexión es de solo lectura.`;
  const nm = $('#layerName');
  if (!nm.value || nm.dataset.auto === '1'){ nm.value = t.title; nm.dataset.auto = '1'; }
}
$('#dbConn').addEventListener('change', loadDbTables);
$('#dbTable').addEventListener('change', syncDbTable);
$('#layerName').addEventListener('input', e => { e.target.dataset.auto = '0'; });
async function addFromDb(name){
  const c = currentConn(); if (!c) throw new Error('Elige una conexión.');
  const t = dbTables.find(x => x.id === $('#dbTable').value); if (!t) throw new Error('Elige una tabla o capa.');
  const write = $('#dbWrite').checked && !$('#dbWrite').disabled;
  const db = { connId: c.id, table: t.id, filter: $('#dbFilter').value.trim(), max: +$('#dbMax').value, refresh: +$('#dbRefresh').value,
    geomCol: t.geomCol || null, pk: t.pk || null, columns: t.fields || [], write };
  const err = $('#layerErr');
  const fc = await dbFetchFeatures(c, db, n => { err.style.color = 'var(--muted)'; err.textContent = `Leyendo… ${fmt.format(n)} entidades`; });
  err.style.color = ''; err.textContent = '';
  if (!fc.features.length && !write) throw new Error('La consulta no devolvió entidades. Revisa el filtro o los permisos de lectura.');
  db.multi = fc.features.some(f => /^Multi/.test(f.geometry.type));
  db.synced = Date.now();
  const lyr = addVectorLayer(fc, { name: name || t.title, editable: write, fields: (t.fields || []).filter(k => k !== t.geomCol), source:'db', db });
  const b = lyr.group.getBounds(); if (b.isValid()) map.fitBounds(b, { padding:[30,30], maxZoom: 16 });
  toast(`${fmt.format(fc.features.length)} entidades desde ${c.name}${write ? ' · las ediciones se guardarán en la base' : ''}`);
}

/* =================================================================
   Inicio de la página: sesión, permisos y carga de la aplicación
   ================================================================= */
function deny(title, msg){
  $('#vLoading').hidden = true; $('#vApp').hidden = true; $('#vDenied').hidden = false;
  $('#deniedTitle').textContent = title; $('#deniedMsg').textContent = msg;
  document.title = 'GeoTablero';
}
/* Guardar antes de salir de la página por los enlaces de la cabecera */
async function leave(href){
  if (canEdit()){ if (dirty) await saveNow(); else await saveViewOnly(); }
  dirty = false; location.href = href;
}
['#lnkHome', '#lnkApps'].forEach(s => $(s).addEventListener('click', e => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); leave('index.html'); }));
$('#btnLogout').addEventListener('click', async () => {
  if (canEdit() && dirty) await saveNow();
  dirty = false; clearSession(); location.href = 'index.html';
});
window.addEventListener('beforeunload', e => { if (currentApp && canEdit() && dirty){ saveNow(); e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('pagehide', () => { if (currentApp && canEdit() && !dirty) saveViewOnly(); });

/* Si otra pestaña cierra la sesión o quita el acceso, esta lo detecta al volver */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !currentApp) return;
  if (!getSession()){ if (dirty) await saveNow(); location.href = 'index.html?next=' + encodeURIComponent(appUrl(currentApp.id)); return; }
  await reloadStore();
  const a = S.apps.find(x => x.id === currentApp.id), r = roleFor(S.me, a);
  if (!a){ deny('Aplicación eliminada', 'Un administrador eliminó esta aplicación.'); currentApp = null; return; }
  if (r !== role){ toast('Tu perfil en esta aplicación cambió. Se recargará la página.'); if (dirty && canEdit() && r && r !== 'viewer') await saveNow(); dirty = false; setTimeout(() => location.reload(), 1200); }
});

(async () => {
  const id = new URLSearchParams(location.search).get('app');
  await loadStore();
  if (!S.me){
    location.replace('index.html' + (id ? '?next=' + encodeURIComponent(appUrl(id)) : ''));
    return;
  }
  paintWho();
  $('#nav').hidden = false;
  if (!id) return deny('Falta indicar la aplicación', 'Este enlace no dice qué aplicación abrir. Elige una desde el listado.');
  const a = S.apps.find(x => x.id === id);
  if (!a) return deny('No encontramos esta aplicación', 'Puede que haya sido eliminada, o que exista en otro navegador. Las aplicaciones se guardan en cada navegador hasta que un administrador las publica en el repositorio.');
  const r = roleFor(S.me, a);
  if (!r) return deny('No tienes acceso a esta aplicación', `Tu usuario (${S.me.login}) no tiene un perfil asignado en "${a.name}". Pídele acceso a un administrador.`);

  currentApp = a; role = r; document.body.dataset.role = r;
  document.title = `${a.name} · GeoTablero`;
  $('#crumbName').textContent = a.name;
  const cr = $('#crumbRole'); cr.className = 'role ' + r; cr.textContent = ROLE_NAME[r];
  $('#crumb').hidden = false; $('#coord').hidden = false; $('#extentWrap').hidden = false; $('#appTools').hidden = !canEdit();
  $('#saveStatus').hidden = !canEdit(); setStatus('Guardado');
  $('#vLoading').hidden = true; $('#vApp').hidden = false;
  map.invalidateSize();
  const st = (await DB.get('app:' + a.id)) || emptyState();
  await loadState(st);
  await new Promise(res => setTimeout(res, 60));
  clearTimeout(saveT); dirty = false; setStatus('Guardado');   // abrir no cuenta como modificación
})();
})();
