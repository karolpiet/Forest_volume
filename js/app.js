(function () {
  const core = ALS.core, pl = ALS.pl, T = ALS.T;
  const $ = (id) => document.getElementById(id);
  const fmt = (v, d = 0) => Number(v).toLocaleString(ALS.locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
  const ll = (x, y) => { const [lon, lat] = core.toWGS(x, y); return [lat, lon]; };

  // --- map and layers -----------------------------------------------------
  // start over a forest near Wierzchowiska, close enough to see the parcels
  const map = L.map('map', { zoomControl: true, preferCanvas: true }).fitBounds([[49.0, 14.1], [54.85, 24.15]]);
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
  // the BDL map is asked for as one picture of the whole view, not in tiles: the server
  // labels every polygon in each picture it draws, so tiles repeated the same address
  // in every tile it touched
  const BdlWms = L.Layer.extend({
    options: { pane: 'lines', attribution: 'Forest Data Bank &copy; BDL', minZoom: 13 },
    onAdd(m) { this._m = m; m.on('moveend', this._update, this); this._update(); },
    onRemove(m) { m.off('moveend', this._update, this); for (const l of [this._img, this._old]) if (l) m.removeLayer(l); this._img = this._old = null; },
    _update() {
      const m = this._m;
      if (m.getZoom() < this.options.minZoom) { if (this._img) { m.removeLayer(this._img); this._img = null; } return; }
      const b = m.getBounds(), size = m.getSize();
      const sw = L.CRS.EPSG3857.project(b.getSouthWest()), ne = L.CRS.EPSG3857.project(b.getNorthEast());
      const url = 'https://mapserver.bdl.lasy.gov.pl/ArcGIS/services/WMS_BDL/mapserver/WMSServer?SERVICE=WMS&REQUEST=GetMap' +
        '&VERSION=1.3.0&LAYERS=0,1,2,3&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857' +
        `&BBOX=${sw.x},${sw.y},${ne.x},${ne.y}&WIDTH=${size.x}&HEIGHT=${size.y}`;
      // the old picture stays until the new one has loaded, so the map does not flicker
      const img = L.imageOverlay(url, b, { pane: this.options.pane, attribution: this.options.attribution });
      img.once('load', () => { if (this._img !== img) return; if (this._old) m.removeLayer(this._old); this._old = null; });
      if (this._old) m.removeLayer(this._old);
      this._old = this._img; this._img = img; img.addTo(m);
    },
  });
  const bdlWms = new BdlWms();
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
    // one row per height class, the same colours as the canopy picture on the map
    const cl = ALS.pl.CHM_CLASSES, n = (v) => Number(v).toLocaleString(ALS.locale(), { maximumFractionDigits: 1 });
    const rows = cl.map(([to, c], i) => `<div class="cls"><i style="background:${c}"></i>${i === 0 ? '&lt; ' + n(to) : i === cl.length - 1 ? '&gt; ' + n(cl[i - 1][0]) : n(cl[i - 1][0]) + '–' + n(to)}</div>`).join('');
    el.innerHTML = `<div><b>${T('Canopy height')} [m]</b><div class="classes">${rows}</div></div>`;
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
    // on a phone the second, longer note would cover the map, so only the short one is shown there
    const small = window.innerWidth < 760;
    el.style.display = map.hasLayer(kieg) && map.getZoom() < (small ? 16 : 18) ? '' : 'none';
    el.textContent = map.getZoom() < 16 ? T('Zoom in to see parcel boundaries')
      : T('Some counties show parcels only when zoomed in further');
  }
  map.on('zoomend overlayadd overlayremove', updateZoomHint);
  updateZoomHint();

  // full-screen map: hides the top bar and the panel, the same button brings them back
  const full = L.control({ position: 'topright' });
  full.onAdd = () => {
    const b = L.DomUtil.create('button', 'fullbtn');
    b.type = 'button';
    b.textContent = '⛶';
    b.title = T('Full-screen map');
    L.DomEvent.disableClickPropagation(b);
    b.onclick = () => {
      const on = document.body.classList.toggle('full');
      b.textContent = on ? '✕' : '⛶';
      b.title = on ? T('Back to the panel') : T('Full-screen map');
      setTimeout(() => map.invalidateSize(), 50);
    };
    return b;
  };
  full.addTo(map);

  // --- UI state -------------------------------------------------------------
  let mode = 'pick', drawPts = [], drawLine = null, areaLayer = null, areaLine = null, bdlLayer = null, busy = false;
  let shown = null, areaLabel = null;  // what the result panel shows, so it can be redrawn in another language
  const status = (msg, cls = 'info') => { const s = $('status'); s.className = msg ? cls : ''; s.innerHTML = msg || ''; };
  const HINTS = {
    pick: () => T('Zoom in and click a parcel.'),
    wyd: () => T('Click inside a State Forests subcompartment (the BDL layer shows them).'),
    odd: () => T('Click inside a State Forests compartment: all its subcompartments are taken together.'),
    draw: () => T('Click to add corners, double-click (or click the first corner) to finish. {undo}',
      { undo: `<a href="#" id="undo">${T('Undo last point')}</a>` }) + ` <button type="button" id="finish" class="primary small">${T('Finish the shape')}</button>`,
  };
  function showHint() {
    $('hint').innerHTML = HINTS[mode]();
    if (mode === 'draw') {
      $('undo').onclick = (e) => { e.preventDefault(); drawPts.pop(); redrawLine(); };
      // a double tap is awkward on a phone, so the shape can also be closed with a button
      $('finish').onclick = () => { if (drawPts.length >= 3) finishDraw(); };
    }
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
    // on a phone the map needs the whole screen to draw on
    if (m === 'draw' && window.innerWidth < 760 && !$('panel').classList.contains('min')) $('toggle').click();
  }
  $('mPick').onclick = () => setMode('pick');
  $('mWyd').onclick = () => setMode('wyd');
  $('mOdd').onclick = () => setMode('odd');
  $('mDraw').onclick = () => setMode(mode === 'draw' ? 'pick' : 'draw');
  $('mFile').onclick = () => $('file').click();
  // the menu in the top bar: the calculator, or one of the info pages in the panel
  let lastCalc = null;
  const PAGES = { help: () => help(), trust: () => `<div class="help">${honest()}</div>`, data: () => dataSources() };
  function setNav(id) { document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.id === id)); }
  function showPage(k) {
    shown = { page: k };
    $('result').innerHTML = PAGES[k]();
    setNav({ help: 'navHow', trust: 'navTrust', data: 'navData' }[k]);
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('mHelp').onclick = () => showPage('help');
  $('navHow').onclick = () => showPage('help');
  $('navTrust').onclick = () => showPage('trust');
  $('navData').onclick = () => showPage('data');
  $('navCalc').onclick = () => {
    setNav('navCalc');
    if (lastCalc) { shown = lastCalc; render(); } else showIntro();
    $('panel').scrollTop = 0;
    $('q').focus();
  };
  const intro = () => `<div class="intro"><ol><li>${T('Type the parcel ID or click your forest on the map. You can also draw its outline.')}</li>
    <li>${T('The page downloads the national laser scanning models from Geoportal and measures the height of every tree.')}</li>
    <li>${T('You get an approximate volume of timber in cubic metres, with an honest range.')}</li></ol></div>`;
  function showIntro() { shown = { intro: true }; $('result').innerHTML = intro(); setNav('navCalc'); }
  $('toggle').onclick = () => { $('panel').classList.toggle('min'); $('toggle').textContent = $('panel').classList.contains('min') ? '▴' : '▾'; setTimeout(() => map.invalidateSize(), 50); };
  document.querySelectorAll('.lang-btn').forEach(b => { b.onclick = () => ALS.setLang(b.dataset.lang); });

  const help = () => `<div class="help"><h3>${T('How it works (title)')}</h3>` + T('HELP', { max: pl.MAX_KM2 }) + '</div>';

  // the corners get dots and the outline closes back to the first one, so every tap shows
  function redrawLine() {
    if (drawLine) map.removeLayer(drawLine);
    drawLine = drawPts.length ? L.layerGroup([
      L.polyline(drawPts.length >= 3 ? drawPts.concat([drawPts[0]]) : drawPts, { color: '#e09a2c', weight: 3, dashArray: '4 4', interactive: false }),
      ...drawPts.map((p, i) => L.circleMarker(p, { radius: i ? 5 : 8, color: '#fff', weight: 2, fillColor: '#e09a2c', fillOpacity: 1, interactive: false }))]).addTo(map) : null;
    if (drawBar.getContainer()) updateDrawBar();
  }

  // buttons on the map itself while drawing: reachable on a phone and in full-screen mode
  const drawBar = L.control({ position: 'bottomleft' });
  drawBar.onAdd = () => {
    const el = L.DomUtil.create('div', 'drawbar');
    L.DomEvent.disableClickPropagation(el);
    return el;
  };
  drawBar.addTo(map);
  function updateDrawBar() {
    const el = drawBar.getContainer();
    if (mode !== 'draw') { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = `<div class="db-msg">${drawPts.length < 3 ? T('Tap the map to add corners ({n} so far)', { n: drawPts.length }) : T('{n} corners', { n: drawPts.length })}</div>
      <button type="button" class="db-undo"${drawPts.length ? '' : ' disabled'}>↶ ${T('Undo')}</button>
      <button type="button" class="db-done primary"${drawPts.length >= 3 ? '' : ' disabled'}>✓ ${T('Finish the shape')}</button>
      <button type="button" class="db-cancel">✕</button>`;
    el.querySelector('.db-undo').onclick = () => { drawPts.pop(); redrawLine(); };
    el.querySelector('.db-done').onclick = () => { if (drawPts.length >= 3) finishDraw(); };
    el.querySelector('.db-cancel').onclick = () => setMode('pick');
  }

  map.on('click', async (e) => {
    if (busy) return;
    if (mode === 'draw') {
      if (drawPts.length >= 3 && map.latLngToContainerPoint(drawPts[0]).distanceTo(e.containerPoint) < (L.Browser.touch ? 24 : 12)) return finishDraw();
      drawPts.push(e.latlng); redrawLine(); return;
    }
    if (map.getZoom() < 14) { status(T('Zoom in closer to pick an area.')); return; }
    const [x, y] = core.toPL(e.latlng.lng, e.latlng.lat);
    if (mode === 'wyd' || mode === 'odd') {
      status(T('Looking up the Forest Data Bank (BDL)…'));
      try {
        let a = await core.bdlArea(e.latlng.lng, e.latlng.lat, mode === 'odd');
        // not State Forests: the non-state forest layer of the BDL
        if (!a) { try { a = await core.bdlPrivateArea(e.latlng.lng, e.latlng.lat, mode === 'odd'); } catch (er) { a = null; } }
        if (!a) { status(T('No forest subcompartment from the BDL at this point. Click inside the forest, or pick the parcel.'), 'err'); return; }
        run(() => a.label, a.polys);
      } catch (err) { status(T('The BDL service did not answer: {msg}', { msg: err.message }), 'err'); }
      return;
    }
    status(T('Looking up the parcel in the GUGiK register…'));
    try { showParcels(await core.parcelByXY(x, y)); } catch (err) { status(err.message, 'err'); }
  });
  // on touch screens two quick taps count as a double click and closed the shape too early
  map.on('dblclick', () => { if (mode === 'draw' && drawPts.length >= 3 && !L.Browser.touch) finishDraw(); });
  function finishDraw() {
    const pts = drawPts.filter((p, i) => i === 0 || p.distanceTo(drawPts[i - 1]) > 0.5);
    const ring = pts.map(p => core.toPL(p.lng, p.lat));
    ring.push(ring[0]);
    setMode('pick');
    if ($('panel').classList.contains('min')) $('toggle').click();  // the result and any error show in the panel
    run(() => T('Drawn area'), [[ring]]);
  }

  $('search').onsubmit = async (e) => {
    e.preventDefault();
    const q = $('q').value.trim();
    if (!q) return;
    // a forest address: 02-37-2-08-94-a-00 (regional directorate, district, …, compartment, subcompartment)
    if (/^\s*\d{2}-\d{2}-\d-\d{2}-\d+/.test(q)) {
      status(T('Looking up the Forest Data Bank (BDL)…'));
      try {
        const a = await core.bdlByAddress(q);
        if (!a) { status(T('The Forest Data Bank has no stand with the address {q}.', { q }), 'err'); return; }
        run(() => a.label, a.polys);
      } catch (err) { status(T('The BDL service did not answer: {msg}', { msg: err.message }), 'err'); }
      return;
    }
    // a parcel ID has digits and a dot or a slash (TERYT_obreb.arkusz.numer, e.g. 123456_7.0001.12/3); anything else is a place name
    if (/\d/.test(q) && /[._/]/.test(q)) {
      status(T('Looking up the parcel in the GUGiK register…'));
      try { showParcels(await core.parcelById(q)); } catch (err) { status(err.message, 'err'); }
      return;
    }
    status(T('Looking for the place…'));
    try { showPlaces(await findPlace(q)); } catch (err) { status(T('The place search did not answer. Try again in a moment.'), 'err'); }
  };

  // place names: OpenStreetMap Nominatim, limited to Poland
  async function findPlace(q) {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=pl&limit=6&accept-language=' +
      ALS.lang() + '&q=' + encodeURIComponent(q));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  function goTo(p) {
    status('');
    const b = p.boundingbox && p.boundingbox.map(Number);
    if (b && b[1] - b[0] < 0.2) map.fitBounds([[b[0], b[2]], [b[1], b[3]]], { maxZoom: 16 });
    else map.setView([+p.lat, +p.lon], 15);
    // the parcels are drawn from zoom 16: make sure the user lands close enough to click one
    map.once('moveend', () => { if (map.getZoom() < 16) map.setZoom(16); });
    setMode('pick');
  }
  function showPlaces(list) {
    if (!list.length) { status(T('Nothing found. Check the spelling or type a parcel ID.'), 'err'); return; }
    if (list.length === 1) return goTo(list[0]);
    status('');
    shown = null;
    $('result').innerHTML = `<div class="area-title">${T('Which place did you mean?')}</div><div class="choices"></div>`;
    const box = $('result').querySelector('.choices');
    list.forEach(p => { const b = document.createElement('button'); b.type = 'button'; b.textContent = p.display_name;
      b.onclick = () => { goTo(p); showIntro(); }; box.appendChild(b); });
  }

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
    $('result').innerHTML = `<div class="area-title">${T('Several parcels match, pick one:')}</div><div class="choices"></div>`;
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
    // from now on the tree heights are shown only inside the selected area
    // (the layer for the whole view can be switched back on in the layer menu)
    if (map.hasLayer(liveChm)) { liveChm.clearLayers(); map.removeLayer(liveChm); }
    const lls = polys.map(p => p.map(r => r.map(([x, y]) => ll(x, y))));
    areaLine = L.polygon(lls, { color: '#e09a2c', weight: 3, fill: false, interactive: false })
      .bindTooltip(label(), { permanent: true, direction: 'top', className: 'area-label' });
    areaLayer = L.layerGroup([
      L.polygon(lls, { color: '#1f2a17', weight: 7, opacity: 0.55, fill: false, interactive: false }), areaLine]).addTo(map);
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
          fillColor: t.h > 25 ? '#0c3a22' : t.h > 18 ? '#3f7a4a' : '#add678', fillOpacity: 0.55 })
          .bindPopup(() => treePopup(t)).addTo(trees));
      }
      shown = lastCalc = { label, w, bdl: null, polys };
      setNav('navCalc');
      render();
      // on a phone the panel sits under the map: bring the result into view
      if (document.body.classList.contains('full')) full.getContainer().click();
      if (window.innerWidth < 760) {
        if ($('panel').classList.contains('min')) $('toggle').click();
        $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (w.data_ha > 0) { loadBdl(polys, shown); loadScanDate(polys, shown); }
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
    const bars = bins.map((n, i) => `<rect x="${i * bw + 0.5}" y="${H - 14 - (n / mx) * (H - 20)}" width="${bw - 1}" height="${(n / mx) * (H - 20)}" fill="#3f7a4a"><title>${T('{a}–{b} m: {n} trees', { a: i + lo, b: i + lo + 1, n })}</title></rect>`).join('');
    const ticks = [5, 10, 15, 20, 25, 30, 35].map(t => `<text x="${(t - lo) * bw}" y="${H - 2}" text-anchor="middle">${t}</text>`).join('');
    return `<h3>${T('Tree heights [m]')}</h3><svg viewBox="-6 0 ${W + 12} ${H}" width="100%" role="img" aria-label="${T('Tree heights [m]')}">${bars}${ticks}</svg>`;
  }

  // the estimate is not more precise than two significant digits, so it is shown that way
  function nice(v) {
    if (v < 1) return v > 0 ? '<1' : '0';
    const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
    return fmt(Math.round(v / p) * p);
  }

  const honest = () => `<div class="honest">
        <h3>${T('How far can you trust this?')}</h3>
        <ul>
          <li>${T('It is an estimate, not a measurement: expect an error of at least ±25%.')}</li>
          <li>${T('Methods A and B assume Scots pine. Method C uses the species from the Forest Data Bank, but only where a stand description exists.')}</li>
          <li>${T('The laser scan is a few years old (2011–2023 depending on the region); trees cut or grown since then are not seen.')}</li>
          <li>${T('Buildings and other tall objects inside the area are counted as trees.')}</li>
          <li>${T('For a sale or valuation of timber, ask a forester to measure it in the field.')}</li>
        </ul>
      </div>`;
  const dataSources = () => `<div class="help"><h3>${T('Data sources')}</h3><ul class="src">
      <li><b>${T('Surface and terrain models')}</b> – GUGiK, Geoportal (NMPT 0,5 m, NMT 1 m), ${T('from airborne laser scanning (ISOK)')}</li>
      <li><b>${T('Cadastral parcels')}</b> – GUGiK, ${T('parcel locator (ULDK) and county registers (KIEG)')}</li>
      <li><b>${T('Forest subcompartments, species and age')}</b> – ${T('State Forests – Forest Data Bank')} (bdl.lasy.gov.pl)</li>
      <li><b>${T('Orthophoto and base map')}</b> – GUGiK, OpenStreetMap</li>
    </ul><p class="note">${T('All of it is free public data. The calculation runs in your browser; nothing you draw or upload is sent anywhere except the area’s bounding box to fetch the elevation data.')}</p></div>`;

  function render() {
    const { label, w } = shown, r = $('result');
    if (w.data_ha === 0) {
      r.innerHTML = `<div class="area-title">${label()}</div><div class="warn">${T('No elevation data for this area.')}</div>`;
      return;
    }
    // not a single cell above 2 m on a sizeable area: almost always the surface model the
    // service returned is wrong here (no vegetation in it), not a bare field. Say so instead of 0 m³.
    if (w.forest_ha === 0 && w.shrub_ha === 0 && w.data_ha > 0.5) {
      const d = w.diag;
      r.innerHTML = `<div class="area-title">${label()}</div>
        <div class="warn"><b>${T('No tree heights in the laser data for this place.')}</b><br>${T('The surface model (NMPT) that Geoportal returned here lies on the ground, so the trees cannot be measured. This is a gap or error in the data for this place, not a result of 0 m³.')}</div>` +
        (d ? `<p class="note">${T('Diagnostics: surface {s} m, terrain {t} m, surface below terrain on {b}% and on the ground on {f}% of the cells, resolution {rs}/{rt} m.', { s: fmt(d.dsm, 1), t: fmt(d.dtm, 1), b: fmt(d.below * 100), f: fmt(d.flat * 100), rs: fmt(d.resS, 2), rt: fmt(d.resT, 2) })}</p>` : '') +
        dbgLinks(shown.polys) + `<div id="bdl"></div>`;
      return;
    }
    const A = w.vol_trees, B = w.vol_canopy, ab = (A + B) / 2;
    // with species and age from the BDL the yield tables (C) give the headline; the pine
    // formulas A and B then only fill the part of the area that has no stand description
    const yt = shown.yt, useC = !!(yt && yt.ok && yt.share >= 0.5);
    const mid = useC ? yt.m1 + Math.max(0, 1 - yt.share) * ab : ab;
    // the range covers both methods and at least ±25% around their mean
    const lo = useC ? 0.75 * mid : Math.min(A, B, 0.75 * mid), hi = useC ? 1.25 * mid : Math.max(A, B, 1.25 * mid);
    const spList = useC ? [...new Set(yt.rows.filter(r => r.m1 > 0).map(r => r.sp))].join(', ') : '';
    const per = (v) => w.forest_ha > 0 ? ` <small>(${fmt(v / w.forest_ha)} m³/ha)</small>` : '';
    const cover = w.data_ha / w.area_ha;
    const p = (q) => w.heights[Math.min(w.heights.length - 1, Math.floor(q * (w.heights.length - 1)))];
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const scale = hi * 1.12 || 1, pos = (v) => (100 * v / scale).toFixed(1) + '%';
    const card = w.forest_ha > 0 ? `
      <div class="result-card">
        <div class="rc-label">${T('Timber in this forest (approx.)')}</div>
        <div class="rc-value">≈ ${nice(mid)}<small>m³</small></div>
        <div class="rc-range">${T('most likely between {lo} and {hi} m³', { lo: `<b>${nice(lo)}</b>`, hi: `<b>${nice(hi)}</b>` })}</div>
        <div class="rc-basis">${useC ? T('Today, from the yield tables for {sp} (species and age from the BDL). Pine formulas A/B: {a}–{b} m³.', { sp: spList, a: nice(Math.min(A, B)), b: nice(Math.max(A, B)) })
          : T('From the pine formulas A and B.')}</div>
        <div class="gauge" aria-hidden="true">
          <div class="track"></div>
          <div class="band" style="left:${pos(lo)};width:${(100 * (hi - lo) / scale).toFixed(1)}%"></div>
          <div class="mid" style="left:${pos(mid)}"></div>
          ${useC ? '' : `<span class="m" style="left:${pos(A)}" title="${T('A) sum of detected trees')}">A</span>
          <span class="m b" style="left:${pos(B)}" title="${esc(T('B) from canopy height & closure'))}">B</span>`}
        </div>
        <div class="rc-scan" id="scan"></div>
        <div class="rc-today" id="today"></div>
        <div class="rc-chips">
          <span>${T('{ha} ha of forest', { ha: fmt(w.forest_ha, w.forest_ha < 10 ? 2 : 1) })}</span>
          <span>≈ ${nice(mid / w.forest_ha)} m³/ha</span>
          ${w.trees ? `<span>${T('trees ~{h} m tall', { h: fmt(p(0.5)) })}</span>` : ''}
        </div>
      </div>` : `
      <div class="result-card">
        <div class="rc-label">${T('Timber in this forest (approx.)')}</div>
        <div class="rc-value">0<small>m³</small></div>
        <div class="rc-range">${T('No trees taller than 5 m were found in this area.')}</div>
      </div>`;
    r.innerHTML = `
      <div class="area-title">${label()}</div>
      ${cover < 0.97 ? `<div class="warn">${T('Elevation data cover only {p}% of this area ({ha} ha). The numbers below refer to that part.', { p: fmt(cover * 100), ha: fmt(w.data_ha, 2) })}</div>` : ''}
      ${card}
      <div id="species"></div>
      <h3>${T('The forest in numbers')}</h3>
      <table>
        <tr><td>${T('Area')}</td><td>${fmt(w.area_ha, 2)} ha</td></tr>
        <tr><td>${T('Forest (canopy ≥ 5 m)')}</td><td>${fmt(w.forest_ha, 2)} ha <small>(${fmt(100 * w.forest_ha / w.data_ha)}%)</small></td></tr>
        <tr><td>${T('Shrubs / regeneration 2–5 m')}</td><td>${fmt(w.shrub_ha, 2)} ha</td></tr>
        <tr><td>${esc(T('Tree tops detected (> 5 m)'))}</td><td>${fmt(w.trees)}${w.forest_ha > 0 ? ` <small>(${fmt(w.trees / w.forest_ha)}/ha)</small>` : ''}</td></tr>
        ${w.trees ? `<tr><td>${T('Tree height: mean / median')}</td><td>${fmt(w.h_mean, 1)} / ${fmt(p(0.5), 1)} m</td></tr>
        <tr><td>${T('Tree height: 10–90% / max')}</td><td>${fmt(p(0.1), 1)}–${fmt(p(0.9), 1)} / ${fmt(w.heights[w.heights.length - 1], 1)} m</td></tr>
        <tr><td>${T('Estimated mean DBH')}</td><td>${fmt(w.dbh_mean)} cm</td></tr>` : ''}
      </table>
      ${histogram(w.heights)}
      <h3>${useC ? T('For comparison: pine formulas') : T('Two ways of counting')}</h3>
      <table>
        <tr><td>${T('A) sum of detected trees')}</td><td>${fmt(A)} m³${per(A)}</td></tr>
        <tr><td>${esc(T('B) from canopy height & closure'))}</td><td>${fmt(B)} m³${per(B)}</td></tr>
      </table>
      <p class="note">${T('A adds up the volume of every tree top found; in dense stands crowns merge, so it is usually too low. B works from canopy height and closure in 20 m squares and is the steadier number. The truth is usually close to or between them.')}</p>
      <div id="yield"></div>
      <div id="bdl"></div>
      ${honest()}`;
    renderBdl();
    renderScan();
    renderYield();
  }

  // direct links to what the proxy gets from Geoportal for this box, to see the raw answer
  function dbgLinks(polys) {
    if (!polys) return '';
    const b = core.bbox(polys).map((v, i) => i < 2 ? Math.floor(v) : Math.ceil(v)).join(',');
    const a = (m, v) => `<a href="${ALS.PROXY}?m=${m}&bbox=${b}&debug=1${v ? '&v=' + v : ''}" target="_blank" rel="noopener">${m.toUpperCase()}${v ? ' EVRF2007' : ' KRON86'}</a>`;
    return `<p class="note">${T('Check what Geoportal sends:')} ${a('nmpt')} · ${a('nmt')} · ${a('nmpt', 'evrf')} · ${a('nmt', 'evrf')}</p>`;
  }

  function renderBdl() {
    const box = $('bdl'), b = shown && shown.bdl;
    if (!box || !b) return;
    const head = `<h3>${T('Forest Data Bank (BDL)')}</h3>`;
    if (b.loading) box.innerHTML = head + `<div class="note">${T('Asking bdl.lasy.gov.pl for forest subcompartments…')}</div>`;
    else if (b.error) box.innerHTML = head + `<div class="note">${T('The BDL service did not answer right now, so stand descriptions are missing.')}</div>`;
    else if (!b.items.length) box.innerHTML = head + `<div class="note">${T('This forest has no description in the Forest Data Bank.')}</div>`;
    else if (b.private || b.mixed) box.innerHTML = (b.mixed ? `<h3>${T('Forest Data Bank (BDL), RDLP {r}', { r: b.rdlp })}</h3><table><tr><td><b>${T('Forest address')}</b></td><td><b>${T('ha here · species · age')}</b></td></tr>` +
      b.items.filter(p => !p._pts).map(p => `<tr><td>${String(p.adr_for || '').replace(/\s+/g, ' ')}</td><td>${fmt(p._ha, 2)} · ${p.species_cd || '–'} · ${p.spec_age || '–'}</td></tr>`).join('') + '</table>' : '') +
      `<h3>${T('Forest Data Bank (BDL): non-state forest')}</h3><table><tr><td><b>${T('Forest address')}</b></td><td><b>${T('ha here · species · age')}</b></td></tr>` +
      b.items.filter(p => p._pts).map(p => `<tr><td>${String(p.adr_for || '').replace(/\s+/g, ' ')}${p.owner ? ` <small>(${p.owner})</small>` : ''}</td><td>~${fmt(p._ha, 2)} · ${p.species_cd || '–'} · ${p.spec_age ? T('{a} y in {y}', { a: p.spec_age, y: p.a_year || '?' }) : '–'}</td></tr>`).join('') +
      `</table><p class="note">${T('From the forest management plan of a non-state forest (year of the description in the table). Hectares are approximate.')}</p>`;
    else box.innerHTML = `<h3>${T('Forest Data Bank (BDL), RDLP {r}', { r: b.rdlp })}</h3><table><tr><td><b>${T('Forest address')}</b></td><td><b>${T('ha here · species · age')}</b></td></tr>` +
      b.items.map(p => `<tr><td>${String(p.adr_for || '').replace(/\s+/g, ' ')}</td><td>${fmt(p._ha, 2)} · ${p.species_cd || '–'} · ${p.spec_age || '–'}</td></tr>`).join('') +
      `</table><p class="note">${T('Dominant species and stand age from the official forest inventory.')}</p>`;
    // the volume formulas are for pine: say so when the official description shows another species
    const sp = $('species');
    if (!sp) return;
    const all = (b.items || []).reduce((a, p) => a + p._ha, 0);
    const other = {};
    (b.items || []).filter(p => p.species_cd && !/^SO/i.test(p.species_cd)).forEach(p => { other[p.species_cd] = (other[p.species_cd] || 0) + p._ha; });
    const share = all > 0 ? Object.values(other).reduce((a, v) => a + v, 0) / all : 0;
    const yt = shown.yt;
    if (yt && yt.ok && yt.share >= 0.5) { sp.innerHTML = ''; return; }  // the headline already uses the species
    sp.innerHTML = share > 0.3 ? `<div class="warn">${T('According to the Forest Data Bank, {p}% of the stands here are dominated by species other than pine ({sp}). The pine formulas can be well off for them.',
      { p: fmt(share * 100), sp: Object.keys(other).sort((x, y) => other[y] - other[x]).slice(0, 4).join(', ') })}` +
      (shown.scan && (shown.scan.unknown || shown.scan.older) ? ' <b>' + T('Type the scan year above and the result will be computed from the yield tables for these species.') + '</b>' : '') + '</div>' : '';
  }

  // --- C) yield tables: species and age from BDL, top height from the laser data ----------
  // Each stand of the Forest Data Bank in the area gets its 10 m cells; their top height,
  // the stand age at the scan and the species give the yield-table volume (Szymkiewicz,
  // through the silvaR models), scaled by the canopy cover in place of the stocking. The
  // height is then grown to today with the species' site index curve.
  function computeYield(s) {
    const b = s.bdl, sc = s.scan;
    if (!b || b.loading || !sc || sc.loading || !s.w.grid) return;
    if (b.error || !b.items.length) { s.yt = null; renderYield(); return; }
    // without the scan year the age at the scan and the growth since are unknown
    if (!sc.year) { s.yt = { noScan: true }; if (shown === s) renderYield(); return; }
    const Y = ALS.yield, now = new Date().getFullYear();
    const lp = b.items.map(p => p._polys ? core.rings(p._polys) : null);
    // state stands have outlines; non-state ones only sample points, so a cell outside every
    // outline goes to the nearest sample point
    const pts = b.items.flatMap((p, i) => (p._pts || []).map(q => [q[0], q[1], i]));
    const owner = (x, y) => {
      const i = lp.findIndex(r => r && core.contains(r, x, y));
      if (i >= 0 || !pts.length) return i < 0 ? null : i;
      let best = null, d = Infinity;
      for (const [px, py, i] of pts) { const e = (px - x) ** 2 + (py - y) ** 2; if (e < d) { d = e; best = i; } }
      return best;
    };
    const stats = pl.standStats(s.w.grid, owner);
    const rows = b.items.map((p, i) => {
      const st = stats.get(i), g = Y.groups(p.species_cd), age = +p.spec_age, ay = +p.a_year || now;
      const r = { p, st, sp: p.species_cd || '–' };
      if (!st) return Object.assign(r, { skip: 'out' });
      if (!g) return Object.assign(r, { skip: 'species' });
      if (!(age > 0)) return Object.assign(r, { skip: 'age' });
      const sy = sc.year, ageScan = age + sy - ay, ageNow = age + now - ay;
      if (ageScan < 10 || !(st.th >= 5)) return Object.assign(r, { skip: 'young' });
      const v0 = Y.vTab(ageScan, st.th, p.species_cd), hNow = Y.thGrowth(ageScan, ageNow, st.th, g.th);
      const v1 = Y.vTab(ageNow, hNow, p.species_cd);
      if (!(v0 > 0 && v1 > 0)) return Object.assign(r, { skip: 'age' });
      return Object.assign(r, { vt: g.vt, ageScan, ageNow, sy, th: st.th, hNow, m0: v0 * st.cover * st.ha, m1: v1 * st.cover * st.ha });
    });
    const ok = rows.filter(r => r.m1 > 0);
    const ha = ok.reduce((a, r) => a + r.st.ha, 0);
    s.yt = { rows, ok: ok.length, ha, share: s.w.data_ha > 0 ? ha / s.w.data_ha : 0,
      m0: ok.reduce((a, r) => a + r.m0, 0), m1: ok.reduce((a, r) => a + r.m1, 0), now, scanKnown: !!sc.year };
    if (shown === s) render();
  }

  function renderYield() {
    const box = $('yield'), today = $('today'), y = shown && shown.yt;
    if (!box || !today) return;
    if (!y) { box.innerHTML = ''; today.innerHTML = ''; return; }
    if (y.noScan) {
      today.innerHTML = '';
      box.innerHTML = `<h3>${T('C) Yield tables by species')}</h3><div class="warn">${T('This method needs the year of the laser scan. Type it in the box above the result (Geoportal shows it).')}</div>`;
      return;
    }
    const why = { out: T('outside the area'), species: T('no yield table for this species'), age: T('no age in the description'), young: T('young stand (under 10 years or 5 m)') };
    const yr = y.rows.find(r => r.sy) ? y.rows.find(r => r.sy).sy : null;
    today.innerHTML = y.ok && !(y.share >= 0.5) ? T('Today by yield tables: ≈ {v} m³', { v: `<b>${nice(y.m1)}</b>` }) +
      (y.share < 0.9 ? ' <small>' + T('(for the {p}% of the area described in BDL)', { p: fmt(y.share * 100) }) + '</small>' : '') : '';
    box.innerHTML = `<h3>${T('C) Yield tables by species')}</h3>
      <p class="note">${T('Species and age from the Forest Data Bank, top height from the laser data, volume from the Szymkiewicz yield tables (silvaR models), scaled by the canopy cover. Then grown to {now}.', { now: y.now })}</p>
      <table><tr><td><b>${T('Stand · species · age')}</b></td><td><b>${T('m³ at scan → today')}</b></td></tr>` +
      y.rows.map(r => r.skip ? `<tr><td>${String(r.p.adr_for || '').replace(/\s+/g, ' ')} · ${r.sp}</td><td><small>${why[r.skip]}</small></td></tr>`
        : `<tr><td>${String(r.p.adr_for || '').replace(/\s+/g, ' ')} · ${r.sp}${r.vt !== r.sp.split('.')[0] ? ` <small>(${T('{t} table', { t: r.vt })})</small>` : ''} · ${T('{a}→{b} y', { a: r.ageScan, b: r.ageNow })}<br><small>${T('top height {h0}→{h1} m, {ha} ha', { h0: fmt(r.th, 1), h1: fmt(r.hNow, 1), ha: fmt(r.st.ha, 2) })}</small></td><td>${fmt(r.m0)} → ${fmt(r.m1)}</td></tr>`).join('') +
      (y.ok ? `<tr><td><b>${T('Total ({ha} ha)', { ha: fmt(y.ha, 2) })}</b></td><td><b>${fmt(y.m0)} → ${fmt(y.m1)} m³</b></td></tr>` : '') +
      `</table>${yr ? `<p class="note">${T('Scan year used: {y}.', { y: yr })}</p>` : ''}`;
  }

  async function loadScanDate(polys, s) {
    s.scan = { loading: true };
    renderScan();
    let d = null;
    try { d = await pl.scanDate(polys); } catch (e) { d = null; }
    if (shown !== s) return;
    s.scan = d || { unknown: true };
    renderScan();
    computeYield(s);
  }

  // how old the laser data are: shown in the result card
  function renderScan() {
    const el = $('scan'), sc = shown && shown.scan;
    if (!el || !sc) return;
    if (sc.loading) { el.textContent = T('Checking when the laser scan was made…'); return; }
    if (sc.unknown || sc.older) {
      // the sheet index could not be read: the year shown on Geoportal can be typed in
      el.innerHTML = (sc.older ? T('Laser scan: {y} or earlier. Type the exact year from Geoportal:', { y: sc.older }) : T('Laser scan date: could not be read. Type the year from Geoportal:')) +
        ` <input id="scanYear" type="number" min="2006" max="${new Date().getFullYear()}" placeholder="2019" inputmode="numeric"> <button type="button" id="scanOk" class="small">OK</button>`;
      const set = () => {
        const v = +$('scanYear').value;
        if (!(v >= 2006 && v <= new Date().getFullYear())) return;
        shown.scan = { year: v, date: String(v), manual: true };
        renderScan(); computeYield(shown);
      };
      $('scanOk').onclick = set;
      $('scanYear').onkeydown = (e) => { if (e.key === 'Enter') set(); };
      return;
    }
    const age = new Date().getFullYear() - sc.year;
    el.innerHTML = T('Laser scan: {date}', { date: `<b>${sc.date.length > 4 ? new Date(sc.date).toLocaleDateString(ALS.locale(), { year: 'numeric', month: 'long' }) : sc.year}</b>` }) +
      (age > 0 ? ' · ' + T('the forest has grown for {n} more years since then', { n: age }) : '');
  }

  async function loadBdl(polys, s) {
    s.bdl = { loading: true };
    renderBdl();
    try {
      const { rdlp, items } = await core.bdl(polys);
      if (shown !== s) return;  // another area was picked meanwhile
      s.bdl = { rdlp, items };
      // State Forests cover only part of the area (or none): look for non-state forest plans
      // (private, municipal…) for the rest
      const stateHa = items.reduce((a, p) => a + p._ha, 0);
      if (stateHa < 0.8 * s.w.area_ha) {
        let priv = [];
        try { priv = await core.bdlPrivate(polys); } catch (e) { priv = []; }
        if (shown !== s) return;
        if (!items.length) s.bdl = { rdlp: null, items: priv, private: true };
        else if (priv.length) s.bdl = { rdlp, items: items.concat(priv), mixed: true };
      }
      if (items.length) bdlLayer = L.layerGroup(items.map(p => L.polygon(p._polys.map(pp => pp.map(r => r.map(([x, y]) => ll(x, y)))),
        { color: '#1d4e1d', weight: 1.5, fill: false, dashArray: '2 3' }).bindTooltip(String(p.adr_for || '')))).addTo(map);
    } catch (err) {
      if (shown !== s) return;
      s.bdl = { error: true };
    }
    renderBdl();
    computeYield(s);
  }

  // --- language -------------------------------------------------------------
  ALS.applyStatic();
  showHint();
  showIntro();
  ALS.onLang(() => {
    buildLayers();
    if (areaLine && areaLabel) areaLine.setTooltipContent(areaLabel());
    if (legend._map) { legend.remove(); legend.addTo(map); }
    updateZoomHint();
    showHint();
    if (shown && shown.page) $('result').innerHTML = PAGES[shown.page]();
    else if (shown && shown.intro) showIntro();
    else if (shown) render();
  });

  const m = location.hash.match(/parcel=([^&]+)/);
  if (m) { $('q').value = decodeURIComponent(m[1]); $('search').requestSubmit(); }
})();
