(function () {
  const core = ALS.core, pl = ALS.pl, T = ALS.T;
  const $ = (id) => document.getElementById(id);
  const fmt = (v, d = 0) => Number(v).toLocaleString(ALS.locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
  const ll = (x, y) => { const [lon, lat] = core.toWGS(x, y); return [lat, lon]; };
  const EXAMPLE = '140905_5.0031.129/6';

  // --- map and layers -----------------------------------------------------
  // start over a forest near Wierzchowiska, close enough to see the parcels
  const map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([51.1775, 21.507], 16);
  map.createPane('lines').style.zIndex = 450;
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 21, maxNativeZoom: 19, attribution: '&copy; OpenStreetMap contributors' });
  // WMTS (pre-cut tiles) loads much faster than the orthophoto WMS
  const orto = L.tileLayer('https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution' +
    '?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg' +
    '&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}',
    { maxZoom: 21, maxNativeZoom: 19, attribution: 'Orthophoto &copy; GUGiK' });
  // KIEG draws county parcels below 1:10 000 (zoom 16+); where a county has no service the
  // parcels come from the LPIS supplement ('geoportal'), drawn only below 1:2 500 (zoom 18+);
  // parcel numbers below 1:1 500 (zoom 19+)
  const kieg = L.tileLayer.wms('https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow',
    { layers: 'geoportal,dzialki,numery_dzialek', format: 'image/png', transparent: true, minZoom: 16, maxZoom: 21,
      pane: 'lines', attribution: 'Parcels &copy; GUGiK (KIEG)' });
  const bdlWms = L.tileLayer.wms('https://mapserver.bdl.lasy.gov.pl/ArcGIS/services/WMS_BDL/mapserver/WMSServer',
    { layers: '0,1,2,3', format: 'image/png', transparent: true, version: '1.3.0', minZoom: 13, maxZoom: 21,
      pane: 'lines', attribution: 'Forest Data Bank &copy; BDL' });
  const chmLayer = L.layerGroup(), trees = L.layerGroup(), liveChm = L.layerGroup();
  orto.addTo(map); kieg.addTo(map); chmLayer.addTo(map); liveChm.addTo(map);

  // the layer control has no API to rename entries, so it is rebuilt when the language changes
  let layers = null;
  function buildLayers() {
    if (layers) map.removeControl(layers);
    layers = L.control.layers(
      { [T('Orthophoto (Geoportal)')]: orto, 'OpenStreetMap': osm },
      { [T('Canopy height in view (zoom 16+)')]: liveChm, [T('Canopy height of the selected area')]: chmLayer,
        [T('Tree tops (computed)')]: trees, [T('Cadastral parcels')]: kieg, [T('Forest subcompartments (BDL)')]: bdlWms },
      { collapsed: window.innerWidth < 760 }).addTo(map);
  }
  buildLayers();
  L.control.scale({ imperial: false }).addTo(map);

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const el = L.DomUtil.create('div', 'legend');
    el.innerHTML = `<div><b>${T('Canopy height')}</b><div class="bar" style="background:linear-gradient(90deg,#fde725,#5ec962,#21918c,#3b528b,#440154)"></div><div class="ends"><span>2 m</span><span>32 m</span></div></div>`;
    return el;
  };

  // live canopy height for the map view: NMPT - NMT from Geoportal, recomputed after each move
  let liveSeq = 0, liveTimer = null;
  async function updateLive() {
    const seq = ++liveSeq;
    if (!map.hasLayer(liveChm) || map.getZoom() < 16) { liveChm.clearLayers(); return; }
    const b = map.getBounds(), c = core.toPL(b.getCenter().lng, b.getCenter().lat);
    const pts = [b.getSouthWest(), b.getNorthEast(), b.getNorthWest(), b.getSouthEast()].map(p => core.toPL(p.lng, p.lat));
    // at most ~0.9 km2 around the centre of the view
    const hw = Math.min(Math.max(...pts.map(p => Math.abs(p[0] - c[0]))), 470);
    const hh = Math.min(Math.max(...pts.map(p => Math.abs(p[1] - c[1]))), 470);
    const ring = [[c[0] - hw, c[1] - hh], [c[0] + hw, c[1] - hh], [c[0] + hw, c[1] + hh], [c[0] - hw, c[1] + hh], [c[0] - hw, c[1] - hh]];
    try {
      const g = await pl.loadChm([[ring]]);
      if (seq !== liveSeq) return;  // the map moved again meanwhile
      const im = pl.chmView(g);
      liveChm.clearLayers();
      L.imageOverlay(im.url, [[im.south, im.west], [im.north, im.east]], { opacity: 0.7, interactive: false }).addTo(liveChm);
      legend.addTo(map);
    } catch (e) { /* the selected-area calculation reports errors; the background layer stays quiet */ }
  }
  map.on('moveend overlayadd', () => { clearTimeout(liveTimer); liveTimer = setTimeout(updateLive, 500); });
  map.whenReady(() => setTimeout(updateLive, 300));

  const zoomHint = L.control({ position: 'topleft' });
  zoomHint.onAdd = () => L.DomUtil.create('div', 'zoomhint');
  zoomHint.addTo(map);
  function updateZoomHint() {
    const el = zoomHint.getContainer();
    el.style.display = map.hasLayer(kieg) && map.getZoom() < 18 ? '' : 'none';
    el.textContent = map.getZoom() < 16 ? T('Zoom in to see parcel boundaries')
      : T('Some counties show parcels only when zoomed in further');
  }
  map.on('zoomend overlayadd overlayremove', updateZoomHint);
  updateZoomHint();

  // --- UI state -------------------------------------------------------------
  let mode = 'pick', drawPts = [], drawLine = null, areaLayer = null, areaLine = null, bdlLayer = null, busy = false;
  let shown = null, areaLabel = null;  // what the result panel shows, so it can be redrawn in another language
  const status = (msg, cls = 'info') => { const s = $('status'); s.className = msg ? cls : ''; s.innerHTML = msg || ''; };
  const HINTS = {
    pick: () => T('Zoom in and click a parcel, or try {ex}.', { ex: `<a href="#" id="example">${EXAMPLE}</a>` }),
    wyd: () => T('Click inside a State Forests subcompartment (the BDL layer shows them).'),
    odd: () => T('Click inside a State Forests compartment: all its subcompartments are taken together.'),
    draw: () => T('Click to add corners, double-click (or click the first corner) to finish. {undo}',
      { undo: `<a href="#" id="undo">${T('Undo last point')}</a>` }),
  };
  function showHint() {
    $('hint').innerHTML = HINTS[mode]();
    if (mode === 'draw') $('undo').onclick = (e) => { e.preventDefault(); drawPts.pop(); redrawLine(); };
    if (mode === 'pick') $('example').onclick = showExample;
  }
  function setMode(m) {
    mode = m;
    [['mPick', 'pick'], ['mWyd', 'wyd'], ['mOdd', 'odd'], ['mDraw', 'draw']].forEach(([id, k]) => $(id).classList.toggle('on', m === k));
    m === 'draw' ? map.doubleClickZoom.disable() : map.doubleClickZoom.enable();
    showHint();
    // the BDL boundaries are what the user clicks on in these modes
    if ((m === 'wyd' || m === 'odd') && !map.hasLayer(bdlWms)) bdlWms.addTo(map);
    map.getContainer().style.cursor = m === 'draw' ? 'crosshair' : '';
    drawPts = []; redrawLine();
  }
  $('mPick').onclick = () => setMode('pick');
  $('mWyd').onclick = () => setMode('wyd');
  $('mOdd').onclick = () => setMode('odd');
  $('mDraw').onclick = () => setMode(mode === 'draw' ? 'pick' : 'draw');
  $('mFile').onclick = () => $('file').click();
  $('mHelp').onclick = () => { shown = { help: true }; $('result').innerHTML = help(); };
  function showExample(e) { e.preventDefault(); $('q').value = EXAMPLE; $('search').requestSubmit(); }
  $('toggle').onclick = () => { $('panel').classList.toggle('min'); $('toggle').textContent = $('panel').classList.contains('min') ? '▴' : '▾'; setTimeout(() => map.invalidateSize(), 50); };
  document.querySelectorAll('.lang-btn').forEach(b => { b.onclick = () => ALS.setLang(b.dataset.lang); });

  const help = () => `<div class="title">${T('How it works (title)')}</div>` + T('HELP', { max: pl.MAX_KM2 });

  function redrawLine() {
    if (drawLine) map.removeLayer(drawLine);
    drawLine = drawPts.length ? L.polyline(drawPts, { color: '#f4894c', weight: 3, dashArray: '4 4' }).addTo(map) : null;
  }

  map.on('click', async (e) => {
    if (busy) return;
    if (mode === 'draw') {
      if (drawPts.length >= 3 && map.latLngToContainerPoint(drawPts[0]).distanceTo(e.containerPoint) < 12) return finishDraw();
      drawPts.push(e.latlng); redrawLine(); return;
    }
    if (map.getZoom() < 14) { status(T('Zoom in closer to pick an area.')); return; }
    const [x, y] = core.toPL(e.latlng.lng, e.latlng.lat);
    if (mode === 'wyd' || mode === 'odd') {
      status(T('Looking up the Forest Data Bank (BDL)…'));
      try {
        const a = await core.bdlArea(e.latlng.lng, e.latlng.lat, mode === 'odd');
        if (!a) { status(T('No State Forests subcompartment here. The BDL publishes shapes only for State Forests; for a private forest pick the parcel or draw the area.'), 'err'); return; }
        run(() => a.label, a.polys);
      } catch (err) { status(T('The BDL service did not answer: {msg}', { msg: err.message }), 'err'); }
      return;
    }
    status(T('Looking up the parcel in the GUGiK register…'));
    try { showParcels(await core.parcelByXY(x, y)); } catch (err) { status(err.message, 'err'); }
  });
  map.on('dblclick', () => { if (mode === 'draw' && drawPts.length >= 3) finishDraw(); });
  function finishDraw() {
    const pts = drawPts.filter((p, i) => i === 0 || p.distanceTo(drawPts[i - 1]) > 0.5);
    const ring = pts.map(p => core.toPL(p.lng, p.lat));
    ring.push(ring[0]);
    setMode('pick');
    run(() => T('Drawn area'), [[ring]]);
  }

  $('search').onsubmit = async (e) => {
    e.preventDefault();
    const q = $('q').value.trim();
    if (!q) return;
    status(T('Looking up the parcel in the GUGiK register…'));
    try { showParcels(await core.parcelById(q)); } catch (err) { status(err.message, 'err'); }
  };

  $('file').onchange = async () => {
    const f = $('file').files[0];
    if (!f) return;
    try { run(() => f.name, core.parseFile(f.name, await f.text())); } catch (err) { status(err.message, 'err'); }
    $('file').value = '';
  };

  function showParcels(list) {
    if (list.length === 1) return run(() => list[0].label, list[0].polys, { id: list[0].id });
    status('');
    shown = null;
    $('result').innerHTML = `<div class="title">${T('Several parcels match, pick one:')}</div><div class="choices"></div>`;
    const box = $('result').querySelector('.choices');
    list.forEach(p => { const b = document.createElement('button'); b.type = 'button'; b.textContent = p.label + ' (' + p.id + ')';
      b.onclick = () => run(() => p.label, p.polys, { id: p.id }); box.appendChild(b); });
  }

  // --- the calculation ------------------------------------------------------
  // label is a function, so the name follows the language switch
  async function run(label, polys, opt = {}) {
    if (busy) return;
    busy = true;
    if (areaLayer) map.removeLayer(areaLayer);
    if (bdlLayer) { map.removeLayer(bdlLayer); bdlLayer = null; }
    chmLayer.clearLayers(); trees.clearLayers();
    const lls = polys.map(p => p.map(r => r.map(([x, y]) => ll(x, y))));
    areaLine = L.polygon(lls, { color: '#d7263d', weight: 3, fill: false, interactive: false })
      .bindTooltip(label(), { permanent: true, direction: 'top', className: 'area-label' });
    areaLayer = L.layerGroup([
      L.polygon(lls, { color: '#fff', weight: 7, opacity: 0.9, fill: false, interactive: false }), areaLine]).addTo(map);
    areaLabel = label;
    map.fitBounds(L.latLngBounds(lls.flat(2)), { padding: [30, 30], maxZoom: 18 });
    if (opt.id) history.replaceState(null, '', '#parcel=' + encodeURIComponent(opt.id));
    $('result').innerHTML = '';
    shown = null;
    try {
      const g = await pl.loadChm(polys, (m) => status(m));
      status(T('Finding trees…'));
      await new Promise(r => setTimeout(r, 20));
      const w = pl.compute(polys, g);
      status('');
      const im = w.image;
      L.imageOverlay(im.url, [[im.south, im.west], [im.north, im.east]], { opacity: 0.85 }).addTo(chmLayer);
      legend.addTo(map);
      if (w.tops.length <= 5000) {
        w.tops.forEach(t => L.circle(ll(t.x, t.y), { radius: Math.max(t.crown / 2, 0.8), weight: 1, color: '#fff',
          fillColor: t.h > 25 ? '#1d4e1d' : t.h > 18 ? '#2e8b2e' : '#8bc34a', fillOpacity: 0.55 })
          .bindPopup(() => treePopup(t)).addTo(trees));
      }
      shown = { label, w, bdl: null };
      render();
      if (w.data_ha > 0) loadBdl(polys, shown);
    } catch (err) {
      status(err.message, 'err');
    } finally { busy = false; }
  }

  function treePopup(t) {
    const [v, d] = core.treeVolume(t.h);
    return `<b>${T('Tree top')}</b><br>${T('Height')}: <b>${fmt(t.h, 1)} m</b><br>${T('Expected crown')}: ${fmt(t.crown, 1)} m` +
      `<br>${T('Est. DBH')}: ~${fmt(d)} cm ${T('(pine)')}<br>${T('Est. stem volume')}: ~${fmt(v, 2)} m³`;
  }

  function histogram(hs) {
    if (hs.length < 5) return '';
    const lo = 5, hi = 36, bins = new Array(hi - lo).fill(0);
    hs.forEach(h => bins[Math.min(Math.max(Math.floor(h) - lo, 0), bins.length - 1)]++);
    const mx = Math.max(...bins), W = 320, H = 90, bw = W / bins.length;
    const bars = bins.map((n, i) => `<rect x="${i * bw + 0.5}" y="${H - 14 - (n / mx) * (H - 20)}" width="${bw - 1}" height="${(n / mx) * (H - 20)}" fill="#2e6d2e"><title>${T('{a}–{b} m: {n} trees', { a: i + lo, b: i + lo + 1, n })}</title></rect>`).join('');
    const ticks = [5, 10, 15, 20, 25, 30, 35].map(t => `<text x="${(t - lo) * bw}" y="${H - 2}" text-anchor="middle">${t}</text>`).join('');
    return `<div class="title">${T('Tree heights [m]')}</div><svg viewBox="-6 0 ${W + 12} ${H}" width="100%" role="img" aria-label="${T('Tree heights [m]')}">${bars}${ticks}</svg>`;
  }

  function render() {
    const { label, w } = shown, r = $('result');
    if (w.data_ha === 0) {
      r.innerHTML = `<div class="title">${label()}</div><div class="warn">${T('No elevation data for this area.')}</div>`;
      return;
    }
    const lo = Math.min(w.vol_trees, w.vol_canopy), hi = Math.max(w.vol_trees, w.vol_canopy);
    const per = (v) => w.forest_ha > 0 ? ` <small>(${fmt(v / w.forest_ha)} m³/ha)</small>` : '';
    const cover = w.data_ha / w.area_ha;
    const p = (q) => w.heights[Math.min(w.heights.length - 1, Math.floor(q * (w.heights.length - 1)))];
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    r.innerHTML = `
      <div class="title">${label()}</div>
      ${cover < 0.97 ? `<div class="warn">${T('Elevation data cover only {p}% of this area ({ha} ha). The numbers below refer to that part.', { p: fmt(cover * 100), ha: fmt(w.data_ha, 2) })}</div>` : ''}
      <div class="big"><div class="l">${T('Timber volume estimate (stem wood over bark)')}</div>
        <div class="v">${w.forest_ha > 0 ? fmt(lo) + '–' + fmt(hi) + ' m³' : '0 m³'}</div>
        ${w.forest_ha > 0 ? `<div class="l">${T('{lo}–{hi} m³ per ha of forest', { lo: fmt(lo / w.forest_ha), hi: fmt(hi / w.forest_ha) })}</div>` : ''}</div>
      <table>
        <tr><td>${T('Area')}</td><td>${fmt(w.area_ha, 2)} ha</td></tr>
        <tr><td>${T('Forest (canopy ≥ 5 m)')}</td><td>${fmt(w.forest_ha, 2)} ha (${fmt(100 * w.forest_ha / w.data_ha)}%)</td></tr>
        <tr><td>${T('Shrubs / regeneration 2–5 m')}</td><td>${fmt(w.shrub_ha, 2)} ha</td></tr>
        <tr><td>${esc(T('Tree tops detected (> 5 m)'))}</td><td>${fmt(w.trees)}${w.forest_ha > 0 ? ` <small>(${fmt(w.trees / w.forest_ha)}/ha)</small>` : ''}</td></tr>
        ${w.trees ? `<tr><td>${T('Tree height: mean / median')}</td><td>${fmt(w.h_mean, 1)} / ${fmt(p(0.5), 1)} m</td></tr>
        <tr><td>${T('Tree height: 10–90% / max')}</td><td>${fmt(p(0.1), 1)}–${fmt(p(0.9), 1)} / ${fmt(w.heights[w.heights.length - 1], 1)} m</td></tr>
        <tr><td>${T('Estimated mean DBH')}</td><td>${fmt(w.dbh_mean)} cm</td></tr>` : ''}
        <tr><td>${T('A) sum of detected trees')}</td><td>${fmt(w.vol_trees)} m³${per(w.vol_trees)}</td></tr>
        <tr><td>${esc(T('B) from canopy height & closure'))}</td><td>${fmt(w.vol_canopy)} m³${per(w.vol_canopy)}</td></tr>
      </table>
      ${histogram(w.heights)}
      <p class="note">${T('An estimate, not a measurement. The national surface model is coarser than a raw point cloud, so trees in dense stands merge and the tree count is usually too low; method B is the steadier number. The models assume pine; broadleaves and spruce differ. The scanning year depends on the region.')}</p>
      <div id="bdl"></div>`;
    renderBdl();
  }

  function renderBdl() {
    const box = $('bdl'), b = shown && shown.bdl;
    if (!box || !b) return;
    const head = `<h2>${T('Forest Data Bank (BDL)')}</h2>`;
    if (b.loading) box.innerHTML = head + `<div class="note">${T('Asking bdl.lasy.gov.pl for forest subcompartments…')}</div>`;
    else if (b.error) box.innerHTML = head + `<div class="note">${T('The BDL service did not answer right now, so stand descriptions are missing.')}</div>`;
    else if (!b.items.length) box.innerHTML = head + `<div class="note">${T('No State Forests subcompartments in this area (probably a private forest).')}</div>`;
    else box.innerHTML = `<h2>${T('Forest Data Bank (BDL), RDLP {r}', { r: b.rdlp })}</h2><table><tr><td><b>${T('Forest address')}</b></td><td><b>${T('ha here · species · age')}</b></td></tr>` +
      b.items.map(p => `<tr><td>${String(p.adr_for || '').replace(/\s+/g, ' ')}</td><td>${fmt(p._ha, 2)} · ${p.species_cd || '–'} · ${p.spec_age || '–'}</td></tr>`).join('') +
      `</table><p class="note">${T('Dominant species and stand age from the official forest inventory.')}</p>`;
  }

  async function loadBdl(polys, s) {
    s.bdl = { loading: true };
    renderBdl();
    try {
      const { rdlp, items } = await core.bdl(polys);
      if (shown !== s) return;  // another area was picked meanwhile
      s.bdl = { rdlp, items };
      if (items.length) bdlLayer = L.layerGroup(items.map(p => L.polygon(p._polys.map(pp => pp.map(r => r.map(([x, y]) => ll(x, y)))),
        { color: '#1d4e1d', weight: 1.5, fill: false, dashArray: '2 3' }).bindTooltip(String(p.adr_for || '')))).addTo(map);
    } catch (err) {
      if (shown !== s) return;
      s.bdl = { error: true };
    }
    renderBdl();
  }

  // --- language -------------------------------------------------------------
  ALS.applyStatic();
  showHint();
  ALS.onLang(() => {
    buildLayers();
    if (areaLine && areaLabel) areaLine.setTooltipContent(areaLabel());
    if (legend._map) { legend.remove(); legend.addTo(map); }
    updateZoomHint();
    showHint();
    if (shown && shown.help) $('result').innerHTML = help();
    else if (shown) render();
  });

  const m = location.hash.match(/parcel=([^&]+)/);
  if (m) { $('q').value = decodeURIComponent(m[1]); $('search').requestSubmit(); }
})();
