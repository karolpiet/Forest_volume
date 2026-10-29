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
    el.innerHTML = `<div><b>${T('Canopy height')}</b><div class="bar" style="background:linear-gradient(90deg,#ecf4c8,#add678,#60a652,#26703e,#0c3a22)"></div><div class="ends"><span>2 m</span><span>32 m</span></div></div>`;
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
  function showExample(e) { e.preventDefault(); $('q').value = EXAMPLE; $('search').requestSubmit(); }
  $('toggle').onclick = () => { $('panel').classList.toggle('min'); $('toggle').textContent = $('panel').classList.contains('min') ? '▴' : '▾'; setTimeout(() => map.invalidateSize(), 50); };
  document.querySelectorAll('.lang-btn').forEach(b => { b.onclick = () => ALS.setLang(b.dataset.lang); });

  const help = () => `<div class="help"><h3>${T('How it works (title)')}</h3>` + T('HELP', { max: pl.MAX_KM2 }) + '</div>';

  function redrawLine() {
    if (drawLine) map.removeLayer(drawLine);
    drawLine = drawPts.length ? L.polyline(drawPts, { color: '#e09a2c', weight: 3, dashArray: '4 4' }).addTo(map) : null;
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
      shown = lastCalc = { label, w, bdl: null };
      setNav('navCalc');
      render();
      // on a phone the panel sits under the map: bring the result into view
      if (window.innerWidth < 760) $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          <li>${T('The formulas are for Scots pine. In spruce, beech or oak stands the real volume can differ a lot.')}</li>
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
    const A = w.vol_trees, B = w.vol_canopy, mid = (A + B) / 2;
    // the range covers both methods and at least ±25% around their mean
    const lo = Math.min(A, B, 0.75 * mid), hi = Math.max(A, B, 1.25 * mid);
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
        <div class="gauge" aria-hidden="true">
          <div class="track"></div>
          <div class="band" style="left:${pos(lo)};width:${(100 * (hi - lo) / scale).toFixed(1)}%"></div>
          <div class="mid" style="left:${pos(mid)}"></div>
          <span class="m" style="left:${pos(A)}" title="${T('A) sum of detected trees')}">A</span>
          <span class="m b" style="left:${pos(B)}" title="${esc(T('B) from canopy height & closure'))}">B</span>
        </div>
        <div class="rc-scan" id="scan"></div>
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
      <h3>${T('Two ways of counting')}</h3>
      <table>
        <tr><td>${T('A) sum of detected trees')}</td><td>${fmt(A)} m³${per(A)}</td></tr>
        <tr><td>${esc(T('B) from canopy height & closure'))}</td><td>${fmt(B)} m³${per(B)}</td></tr>
      </table>
      <p class="note">${T('A adds up the volume of every tree top found; in dense stands crowns merge, so it is usually too low. B works from canopy height and closure in 20 m squares and is the steadier number. The truth is usually close to or between them.')}</p>
      <div id="bdl"></div>
      ${honest()}`;
    renderBdl();
    renderScan();
  }

  function renderBdl() {
    const box = $('bdl'), b = shown && shown.bdl;
    if (!box || !b) return;
    const head = `<h3>${T('Forest Data Bank (BDL)')}</h3>`;
    if (b.loading) box.innerHTML = head + `<div class="note">${T('Asking bdl.lasy.gov.pl for forest subcompartments…')}</div>`;
    else if (b.error) box.innerHTML = head + `<div class="note">${T('The BDL service did not answer right now, so stand descriptions are missing.')}</div>`;
    else if (!b.items.length) box.innerHTML = head + `<div class="note">${T('No State Forests subcompartments in this area (probably a private forest).')}</div>`;
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
    sp.innerHTML = share > 0.3 ? `<div class="warn">${T('According to the Forest Data Bank, {p}% of the State Forests stands here are dominated by species other than pine ({sp}). The pine formulas can be well off for them.',
      { p: fmt(share * 100), sp: Object.keys(other).sort((x, y) => other[y] - other[x]).slice(0, 4).join(', ') })}</div>` : '';
  }

  async function loadScanDate(polys, s) {
    s.scan = { loading: true };
    renderScan();
    let d = null;
    try { d = await pl.scanDate(polys); } catch (e) { d = null; }
    if (shown !== s) return;
    s.scan = d || { unknown: true };
    renderScan();
  }

  // how old the laser data are: shown in the result card
  function renderScan() {
    const el = $('scan'), sc = shown && shown.scan;
    if (!el || !sc) return;
    if (sc.loading) { el.textContent = T('Checking when the laser scan was made…'); return; }
    if (sc.unknown) { el.innerHTML = T('Laser scan date: unknown (2011–2023 depending on the region)'); return; }
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
