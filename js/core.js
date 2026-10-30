// Core of the "forest on a parcel" calculator: data decoding, geometry and the
// timber estimate. Plain script (no modules) so the page also works from disk.
// Port of tools/06_las_na_dzialce.py; same thresholds and the same two methods.
(function (root) {
  const ALS = (root.ALS = root.ALS || {});
  // messages go through the page's translation function when there is one
  const T = (s, v = {}) => (ALS.T ? ALS.T(s, v) : s.replace(/\{(\w+)\}/g, (_, k) => v[k]));

  const H_FOREST = 5.0;  // canopy >= 5 m counts as forest
  const H_SHRUB = 2.0;   // 2-5 m: shrubs / regeneration
  const G_HA = 28.0;     // assumed basal area [m2/ha] for method B
  const CELL = 20.0;     // cell size for method B [m]

  const EPSG2180 = '+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 ' +
    '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
  const toPL = (lon, lat) => root.proj4('WGS84', EPSG2180, [lon, lat]);
  const toWGS = (x, y) => root.proj4(EPSG2180, 'WGS84', [x, y]);

  // --- data -------------------------------------------------------------------
  async function decode(name) {
    const d = ALS[name];
    if (!d) throw new Error('missing data/' + name + '.js');
    if (d._buf) return d;
    const bin = Uint8Array.from(atob(d.b64), c => c.charCodeAt(0));
    const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
    d._buf = await new Response(stream).arrayBuffer();
    delete d.b64;
    return d;
  }

  async function loadChm() {
    const d = await decode('chm');
    if (!d.grid) d.grid = new Uint8Array(d._buf);
    return d;
  }

  async function loadTrees() {
    const d = await decode('drzewa');
    if (!d.x) {
      const n = d.n, b = d._buf;
      const u16 = (i) => new Uint16Array(b, i * 2 * n, n);
      const xs = u16(0), ys = u16(1), hs = u16(2), ks = u16(3);
      const zs = new Uint8Array(b, 8 * n, n);
      d.x = new Float64Array(n); d.y = new Float64Array(n);
      d.hgt = new Float32Array(n); d.crown = new Float32Array(n); d.closure = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        d.x[i] = d.x0 + xs[i] * d.krok;
        d.y[i] = d.y0 - ys[i] * d.krok;
        d.hgt[i] = hs[i] / 100; d.crown[i] = ks[i] / 100; d.closure[i] = zs[i] / 250;
      }
    }
    return d;
  }

  // --- geometry (EPSG:2180, polygons = [[outer, hole...], ...], ring = [[x,y],...]) ---
  function ringArea(r) {
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
    return Math.abs(a / 2);
  }
  const polyArea = (polys) => polys.reduce((s, p) => s + ringArea(p[0]) - p.slice(1).reduce((t, h) => t + ringArea(h), 0), 0);
  const rings = (polys) => polys.flat();

  function bbox(polys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of rings(polys)) for (const [x, y] of r) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return [x0, y0, x1, y1];
  }

  function contains(rs, x, y) {  // even-odd rule over all rings (holes included)
    let inside = false;
    for (const r of rs) {
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  }

  // Pixel-centre mask of polygons over a grid window (same rule as rasterio geometry_mask).
  // Returns {r0, c0, rows, cols, mask: Uint8Array}.
  function rasterize(polys, g, r0, c0, rows, cols) {
    const mask = new Uint8Array(rows * cols);
    const rs = rings(polys);
    for (let r = 0; r < rows; r++) {
      const y = g.y0 - (r0 + r + 0.5) * g.res;
      const xs = [];
      for (const ring of rs) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i], [xj, yj] = ring[j];
          if ((yi > y) !== (yj > y)) xs.push((xj - xi) * (y - yi) / (yj - yi) + xi);
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        // pixel centre x = g.x0 + (c + 0.5) * res must lie in [xs[k], xs[k+1])
        const ca = Math.max(0, Math.ceil((xs[k] - g.x0) / g.res - 0.5) - c0);
        const cb = Math.min(cols - 1, Math.ceil((xs[k + 1] - g.x0) / g.res - 0.5) - 1 - c0);
        for (let c = ca; c <= cb; c++) mask[r * cols + c] = 1;
      }
    }
    return mask;
  }

  function percentile(sorted, p) {  // numpy 'linear'
    if (!sorted.length) return NaN;
    const k = (sorted.length - 1) * p / 100, f = Math.floor(k), c = Math.min(f + 1, sorted.length - 1);
    return sorted[f] + (sorted[c] - sorted[f]) * (k - f);
  }

  function treeVolume(h) {  // method A for one pine: v [m3], dbh [cm]
    const d = Math.max(1.3 * h - 2.5, 7);
    const f = 0.42 + 1.0 / h;
    return [Math.PI / 4 * (d / 100) ** 2 * h * f, d];
  }

  // --- the calculation ----------------------------------------------------------
  async function compute(polys) {
    const g = await loadChm();
    const t = await loadTrees();
    const res = g.res, px = res * res, nod = g.nodata, sc = g.skala;
    const [bx0, by0, bx1, by1] = bbox(polys);
    const c0 = Math.floor((bx0 - g.x0) / res), c1 = Math.ceil((bx1 - g.x0) / res);
    const r0 = Math.floor((g.y0 - by1) / res), r1 = Math.ceil((g.y0 - by0) / res);
    const rows = r1 - r0, cols = c1 - c0;
    const mask = rasterize(polys, g, r0, c0, rows, cols);

    const out = { area_ha: polyArea(polys) / 1e4, data_ha: 0, forest_ha: 0, shrub_ha: 0 };
    const H = new Float32Array(rows * cols).fill(NaN);
    let nData = 0, nForest = 0, nShrub = 0, sumH = 0;
    for (let r = 0; r < rows; r++) {
      const gr = r0 + r;
      if (gr < 0 || gr >= g.h) continue;
      for (let c = 0; c < cols; c++) {
        const gc = c0 + c;
        if (gc < 0 || gc >= g.w || !mask[r * cols + c]) continue;
        const v = g.grid[gr * g.w + gc];
        if (v === nod) continue;
        const h = (v + 0.5) * sc;  // centre of the 0.5 m height class
        H[r * cols + c] = h;
        nData++;
        if (h >= H_FOREST) { nForest++; sumH += h; } else if (h >= H_SHRUB) nShrub++;
      }
    }
    out.data_ha = nData * px / 1e4;
    out.forest_ha = nForest * px / 1e4;
    out.shrub_ha = nShrub * px / 1e4;
    out.canopy_mean = nForest ? sumH / nForest : 0;

    // trees with their top inside the area
    const rs = rings(polys), hs = [];
    let vA = 0, dSum = 0;
    for (let i = 0; i < t.n; i++) {
      const x = t.x[i], y = t.y[i];
      if (x < bx0 || x > bx1 || y < by0 || y > by1 || !contains(rs, x, y)) continue;
      const [v, d] = treeVolume(t.hgt[i]);
      hs.push(t.hgt[i]); vA += v; dSum += d;
    }
    hs.sort((a, b) => a - b);
    out.trees = hs.length;
    out.heights = hs;
    out.h_mean = hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : 0;
    out.dbh_mean = hs.length ? dSum / hs.length : 0;
    out.vol_trees = vA;

    // method B: CELL x CELL squares, V = G * closure * H95 * f
    const k = Math.max(1, Math.round(CELL / res));
    let vB = 0;
    for (let i = 0; i < rows; i += k) {
      for (let j = 0; j < cols; j += k) {
        let n = 0; const tall = [];
        for (let a = i; a < Math.min(i + k, rows); a++) {
          for (let b = j; b < Math.min(j + k, cols); b++) {
            const h = H[a * cols + b];
            if (Number.isNaN(h)) continue;
            n++; if (h >= H_FOREST) tall.push(h);
          }
        }
        if (!n || !tall.length) continue;
        tall.sort((a, b) => a - b);
        const h95 = percentile(tall, 95);
        vB += G_HA * (tall.length / n) * h95 * (0.42 + 1.0 / h95) * (n * px / 1e4);
      }
    }
    out.vol_canopy = vB;
    return out;
  }

  // --- parcel boundaries: ULDK (GUGiK) -------------------------------------------
  const ULDK = 'https://uldk.gugik.gov.pl/';

  function parseWkt(wkt) {
    wkt = wkt.replace(/^SRID=\d+;/i, '').trim();
    const nums = (s) => s.split(',').map(p => p.trim().split(/\s+/).map(Number));
    const body = wkt.replace(/^[A-Z ]+/i, '');
    if (/^MULTIPOLYGON/i.test(wkt)) {
      return body.slice(1, -1).split(/\)\s*\)\s*,\s*\(\s*\(/).map(p =>
        p.replace(/^[\s(]+|[\s)]+$/g, '').split(/\)\s*,\s*\(/).map(nums));
    }
    return [body.replace(/^[\s(]+|[\s)]+$/g, '').split(/\)\s*,\s*\(/).map(nums)];
  }

  async function uldk(request, key, value) {
    const q = new URLSearchParams({ request, [key]: value, result: 'geom_wkt,id,parcel,region,commune', srid: '2180' });
    let txt;
    try {
      const r = await fetch(ULDK + '?' + q.toString());
      txt = await r.text();
    } catch (e) {
      throw new Error(T('The GUGiK parcel service (ULDK) did not respond. Try again in a moment or draw the area by hand.'));
    }
    const lines = txt.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!lines.length || lines[0].startsWith('-1')) throw new Error(T('Parcel not found ({id}).', { id: value }));
    return lines.slice(1).map(ln => {
      const parts = ln.split('|');
      const geom = parts.find(p => /POLYGON/i.test(p));
      const meta = parts.filter(p => !/POLYGON/i.test(p));
      const [id, nr, region, commune] = meta.concat(['?', '?', '?', '?']);
      return { id, nr, region, commune, get label() { return T('Parcel {nr}, {region}, {commune}', { nr, region, commune }); }, polys: parseWkt(geom) };
    });
  }
  const parcelByXY = (x, y) => uldk('GetParcelByXY', 'xy', x.toFixed(2) + ',' + y.toFixed(2) + ',2180');
  const parcelById = (id) => uldk(/^\d{6}_\d\.\d{4}\./.test(id) ? 'GetParcelById' : 'GetParcelByIdOrNr', 'id', id);

  // --- Forest Data Bank (BDL): forest subcompartments in the area ---------------
  const BDL = 'https://ogcapi.bdl.lasy.gov.pl/collections';
  const RDLP = ['Radom', 'Lublin', 'Lodz', 'Krakow', 'Warszawa', 'Katowice', 'Krosno', 'Bialystok', 'Olsztyn',
    'Pila', 'Poznan', 'Szczecin', 'Szczecinek', 'Torun', 'Wroclaw', 'Zielona_Gora', 'Gdansk'];

  async function bdl(polys) {
    const [x0, y0, x1, y1] = bbox(polys);
    const a = toWGS(x0, y0), b = toWGS(x1, y1);
    const bb = [a[0], a[1], b[0], b[1]].map(v => v.toFixed(6)).join(',');
    const g = { x0: x0, y0: y1, res: 1 };
    const cols = Math.ceil(x1 - x0), rows = Math.ceil(y1 - y0);
    const area = rasterize(polys, g, 0, 0, rows, cols);
    for (const rd of RDLP) {
      const r = await fetch(`${BDL}/RDLP_${rd}_wydzielenia/items?f=json&bbox=${bb}&limit=500`);
      if (!r.ok) throw new Error('BDL HTTP ' + r.status);
      const feats = (await r.json()).features || [];
      if (!feats.length) continue;
      const out = [];
      for (const f of feats) {
        const gm = f.geometry;
        const raw = gm.type === 'Polygon' ? [gm.coordinates] : gm.coordinates;
        const p2 = raw.map(p => p.map(ring => ring.map(([lon, lat]) => toPL(lon, lat))));
        const m = rasterize(p2, g, 0, 0, rows, cols);
        let n = 0;
        for (let i = 0; i < m.length; i++) if (m[i] && area[i]) n++;
        if (n < 1) continue;
        out.push(Object.assign({}, f.properties, { _ha: n / 1e4, _polys: p2 }));
      }
      return { rdlp: rd, items: out.sort((a, b) => b._ha - a._ha) };
    }
    return { rdlp: null, items: [] };
  }

  // --- one BDL subcompartment, or a whole compartment, at a clicked point -------------
  let lastRdlp = null;
  async function bdlItems(rd, bb) {
    const r = await fetch(`${BDL}/RDLP_${rd}_wydzielenia/items?f=json&bbox=${bb.map(v => v.toFixed(6)).join(',')}&limit=1000`);
    if (!r.ok) return [];
    return (await r.json()).features || [];
  }
  const featPolys = (f) => {
    const gm = f.geometry, raw = gm.type === 'Polygon' ? [gm.coordinates] : gm.coordinates;
    return raw.map(p => p.map(ring => ring.map(([lon, lat]) => toPL(lon, lat))));
  };
  // compartment key: "16-17-1-10-93    -j   -00" -> "16-17-1-10-93"
  const compartment = (adr) => String(adr || '').replace(/\s+/g, '').split('-').slice(0, 5).join('-');

  async function bdlArea(lon, lat, whole) {
    const tiny = [lon - 1e-5, lat - 1e-5, lon + 1e-5, lat + 1e-5];
    const [x, y] = toPL(lon, lat);
    const hit = (feats) => feats.find(f => contains(rings(featPolys(f)), x, y));
    let rd = null, f = null;
    if (lastRdlp) { f = hit(await bdlItems(lastRdlp, tiny)); if (f) rd = lastRdlp; }
    if (!f) {
      // which regional directorate: ask all of them at once
      const res = await Promise.allSettled(RDLP.map(r => bdlItems(r, tiny).then(fs => ({ r, f: hit(fs) }))));
      const ok = res.find(v => v.status === 'fulfilled' && v.value.f);
      if (!ok) return null;
      rd = lastRdlp = ok.value.r; f = ok.value.f;
    }
    const p = f.properties || {};
    const desc = () => [p.species_cd, p.spec_age ? T('{n} y', { n: p.spec_age }) : ''].filter(Boolean).join(', ');
    if (!whole) {
      return { get label() { return T('Subcompartment {adr}', { adr: String(p.adr_for || '').replace(/\s+/g, '') }) + (desc() ? ' (' + desc() + ')' : ''); }, polys: featPolys(f) };
    }
    // a compartment = all subcompartments with the same address up to the compartment number
    const key = compartment(p.adr_for);
    let d = 0.006, polys = [];
    for (let i = 0; i < 3; i++, d *= 2) {
      const bb = [lon - d * 1.6, lat - d, lon + d * 1.6, lat + d];
      const same = (await bdlItems(rd, bb)).filter(g => compartment((g.properties || {}).adr_for) === key);
      polys = same.flatMap(featPolys);
      const [x0, y0, x1, y1] = bbox(polys);
      const a = toPL(bb[0], bb[1]), b = toPL(bb[2], bb[3]);
      if (x0 > a[0] + 20 && y0 > a[1] + 20 && x1 < b[0] - 20 && y1 < b[1] - 20) break;  // whole compartment inside the query box
    }
    return { get label() { return T('Compartment {key}', { key }); }, polys };
  }

  // --- reading a boundary file (KML, GPX, GeoJSON in WGS84 or EPSG:2180) -------
  function parseFile(name, text) {
    const ext = name.toLowerCase().split('.').pop();
    let polys = [];
    if (ext === 'kml' || ext === 'gpx') {
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      for (const el of doc.getElementsByTagName('coordinates')) {
        const pts = el.textContent.trim().split(/\s+/).map(c => c.split(',').slice(0, 2).map(Number));
        if (pts.length >= 3) polys.push([pts]);
      }
      for (const tag of ['trkseg', 'rte']) {
        for (const seg of doc.getElementsByTagName(tag)) {
          const pts = [...seg.children].filter(p => /^(trkpt|rtept)$/.test(p.localName))
            .map(p => [Number(p.getAttribute('lon')), Number(p.getAttribute('lat'))]);
          if (pts.length >= 3) polys.push([pts]);
        }
      }
    } else if (ext === 'geojson' || ext === 'json') {
      const gj = JSON.parse(text);
      const feats = gj.features || [gj];
      for (const f of feats) {
        const gm = f.geometry || f;
        if (gm.type === 'Polygon') polys.push(gm.coordinates);
        else if (gm.type === 'MultiPolygon') polys.push(...gm.coordinates);
        else if (gm.type === 'LineString' && gm.coordinates.length >= 3) polys.push([gm.coordinates]);
      }
    } else {
      throw new Error(T('Unsupported file type .{ext} (use KML, GPX or GeoJSON)', { ext }));
    }
    if (!polys.length) throw new Error(T('No polygon found in {name}', { name }));
    const planar = polys[0][0][0][0] > 180;  // already in metres (EPSG:2180)
    return planar ? polys : polys.map(p => p.map(r => r.map(([lon, lat]) => toPL(lon, lat))));
  }

  // --- non-state forests: the BDL map service also has subcompartments outside the State
  // Forests (from their forest management plans), but only through WMS GetFeatureInfo.
  // The area is sampled on a grid of points; the share of points gives the hectares.
  const BDL_WMS = 'https://mapserver.bdl.lasy.gov.pl/ArcGIS/services/WMS_BDL/mapserver/WMSServer';
  async function bdlPrivate(polys) {
    const [x0, y0, x1, y1] = bbox(polys), rs = rings(polys);
    const pts = [], n = 6;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = x0 + (x1 - x0) * (i + 0.5) / n, y = y0 + (y1 - y0) * (j + 0.5) / n;
      if (contains(rs, x, y)) pts.push([x, y]);
    }
    if (!pts.length) return [];
    const hits = await Promise.all(pts.map(async ([x, y]) => {
      const [lon, lat] = toWGS(x, y), d = 1e-5;
      const q = `?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=0&QUERY_LAYERS=0&SRS=EPSG:4326&STYLES=&FORMAT=image/png` +
        `&BBOX=${lon - d},${lat - d},${lon + d},${lat + d}&WIDTH=3&HEIGHT=3&X=1&Y=1&INFO_FORMAT=text/xml&FEATURE_COUNT=1`;
      const r = await fetch(BDL_WMS + q);
      if (!r.ok) throw new Error('BDL WMS HTTP ' + r.status);
      const doc = new DOMParser().parseFromString(await r.text(), 'text/xml');
      const f = [...doc.getElementsByTagName('*')].find(e => e.getAttribute && e.getAttribute('species_cd_d') !== null);
      if (!f) return null;
      const at = (k) => { const v = f.getAttribute(k); return v && v !== 'Null' ? v.trim() : ''; };
      return { id: at('subarea_id') || at('adress_forest'), adr_for: at('adress_forest'), species_cd: at('species_cd_d'),
        spec_age: at('species_age'), a_year: at('a_year'), owner: at('owner_cat_name'), _pt: [x, y] };
    }));
    const area = polyArea(polys) / 1e4, by = {};
    for (const h of hits) {
      if (!h) continue;
      const e = (by[h.id] = by[h.id] || Object.assign(h, { n: 0, _pts: [] }));
      e.n++; e._pts.push(h._pt);
    }
    return Object.values(by).map(h => Object.assign(h, { _ha: area * h.n / pts.length, _approx: true })).sort((a, b) => b._ha - a._ha);
  }

  // --- non-state forests (layer "Wydzielenia poza PGL LP wg PUL"): shapes from the ArcGIS
  // REST interface of the same BDL map server. Field names are matched loosely because the
  // REST names may differ from the WMS aliases.
  const BDL_REST = 'https://mapserver.bdl.lasy.gov.pl/ArcGIS/rest/services/WMS_BDL/MapServer/0/query';
  const field = (a, re) => { const k = Object.keys(a || {}).find(k => re.test(k)); const v = k ? a[k] : ''; return v == null || v === 'Null' ? '' : String(v).trim(); };
  const esriPolys = (g) => (g && g.rings ? [g.rings.map(r => r.map(([lon, lat]) => toPL(lon, lat)))] : []);
  async function bdlRest(params) {
    const q = new URLSearchParams(Object.assign({ outFields: '*', returnGeometry: 'true', outSR: '4326', f: 'json' }, params));
    const r = await fetch(BDL_REST + '?' + q);
    if (!r.ok) throw new Error('BDL HTTP ' + r.status);
    const j = await r.json();
    if (j.error) throw new Error('BDL: ' + (j.error.message || 'error'));
    return (j.features || []).map(f => ({ a: f.attributes || {}, polys: esriPolys(f.geometry) }));
  }
  async function bdlPrivateArea(lon, lat, whole) {
    const at = await bdlRest({ geometry: lon + ',' + lat, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects' });
    // the service sometimes also answers with a large region outline (a whole regional
    // directorate, tens of thousands of km²) that has no forest address; only real
    // subcompartments are kept: with an address and under 500 ha, the smallest one first
    const sub = at.filter(g => field(g.a, /^adr|adres|adress/i) && g.polys.length && polyArea(g.polys) < 500 * 1e4)
      .sort((a, b) => polyArea(a.polys) - polyArea(b.polys));
    if (!sub.length) return null;
    const f = sub[0], adr = field(f.a, /^adr|adres|adress/i);
    const sp = field(f.a, /species_cd/i), age = field(f.a, /species_age|spec_age/i);
    const desc = () => [sp, age ? T('{n} y', { n: age }) : ''].filter(Boolean).join(', ');
    if (!whole || !adr) {
      return { get label() { return T('Subcompartment {adr}', { adr: adr.replace(/\s+/g, '') }) + (desc() ? ' (' + desc() + ')' : ''); }, polys: f.polys };
    }
    const key = compartment(adr), d = 0.01;
    const all = await bdlRest({ geometry: [lon - d * 1.6, lat - d, lon + d * 1.6, lat + d].join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects' });
    const polys = all.filter(g => compartment(field(g.a, /^adr|adres|adress/i)) === key && polyArea(g.polys) < 500 * 1e4).flatMap(g => g.polys);
    return { get label() { return T('Compartment {key}', { key }); }, polys: polys.length ? polys : f.polys };
  }

  // --- search by forest address ("02-37-2-08-94-a-00", or a compartment "02-37-2-08-94") ----
  // The first two digits are the regional directorate. State Forests are asked through the
  // OGC API (CQL filter on the compartment), non-state forests through the ArcGIS REST layer.
  const RDLP_CODE = { '01': 'Bialystok', '02': 'Katowice', '03': 'Krakow', '04': 'Krosno', '05': 'Lublin', '06': 'Lodz',
    '07': 'Olsztyn', '08': 'Pila', '09': 'Poznan', '10': 'Szczecin', '11': 'Szczecinek', '12': 'Torun', '13': 'Wroclaw',
    '14': 'Zielona_Gora', '15': 'Gdansk', '16': 'Radom', '17': 'Warszawa' };
  const normAdr = (a) => String(a || '').replace(/\s+/g, '').toLowerCase();
  async function bdlByAddress(q) {
    const want = normAdr(q).replace(/-+$/, ''), key = compartment(want), rd = RDLP_CODE[want.slice(0, 2)];
    // the subcompartment letter and the "-00" part are optional in what the user types
    const match = (adr) => { const a = normAdr(adr); return a === want || a.startsWith(want + '-') || (want === key && compartment(a) === key); };
    let feats = [];
    if (rd) {
      const base = `${BDL}/RDLP_${rd}_wydzielenia/items?f=json&limit=1000`;
      const tries = [`${base}&filter-lang=cql-text&filter=${encodeURIComponent(`adr_for LIKE '${key}%'`)}`,
        `${base}&filter=${encodeURIComponent(`adr_for LIKE '${key}%'`)}`];
      for (const u of tries) {
        try {
          const r = await fetch(u);
          if (!r.ok) continue;
          const fs = ((await r.json()).features || []).filter(f => match((f.properties || {}).adr_for));
          if (fs.length) { feats = fs.map(f => ({ adr: f.properties.adr_for, p: f.properties, polys: featPolys(f) })); break; }
        } catch (e) { /* try the next form of the query */ }
      }
    }
    if (!feats.length) {
      try {
        const fs = await bdlRest({ where: `adress_forest LIKE '${key}%'` });
        feats = fs.filter(f => match(field(f.a, /^adr|adres|adress/i)))
          .map(f => ({ adr: field(f.a, /^adr|adres|adress/i), p: { species_cd: field(f.a, /species_cd/i), spec_age: field(f.a, /species_age|spec_age/i) }, polys: f.polys }));
      } catch (e) { /* the non-state layer did not answer */ }
    }
    if (!feats.length) return null;
    const polys = feats.flatMap(f => f.polys), one = feats.length === 1 ? feats[0] : null;
    const desc = one ? [one.p.species_cd, one.p.spec_age ? T('{n} y', { n: one.p.spec_age }) : ''].filter(Boolean).join(', ') : '';
    return { polys, get label() {
      return one ? T('Subcompartment {adr}', { adr: one.adr.replace(/\s+/g, '') }) + (desc ? ' (' + desc + ')' : '') : T('Compartment {key}', { key: q.trim() });
    } };
  }

  ALS.core = { compute, bdlPrivateArea, bdlByAddress, loadChm, loadTrees, parcelByXY, parcelById, bdl, bdlPrivate, parseFile, parseWkt,
    toPL, toWGS, polyArea, bbox, treeVolume, rasterize, percentile, rings, contains, bdlArea, RDLP,
    H_FOREST, H_SHRUB, G_HA, CELL };
})(typeof window !== 'undefined' ? window : globalThis);
