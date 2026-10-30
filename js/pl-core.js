// "Forest on any parcel in Poland": the same estimate as als-core.js, but the canopy
// height model is built on the fly from the national GUGiK elevation models
// (CHM = NMPT surface model 0.5 m - NMT terrain model 1 m), fetched through a small proxy
// because the GUGiK WCS does not allow cross-origin requests from the browser.
(function (root) {
  const ALS = (root.ALS = root.ALS || {});
  const core = ALS.core;
  // messages go through the page's translation function when there is one
  const T = (s, v = {}) => (ALS.T ? ALS.T(s, v) : s.replace(/\{(\w+)\}/g, (_, k) => v[k]));

  const MAX_KM2 = 1.0;   // largest bounding box we fetch (1 km2 = ~4 M pixels of NMPT)
  const MARGIN = 3;      // metres around the area, so tree tops on the edge can be found

  // --- fetching the elevation models ------------------------------------------------
  async function getGrid(model, bb, v) {
    // f=2: the answers changed (grids instead of pictures), so older copies in the browser cache are skipped
    const url = ALS.PROXY + '?m=' + model + '&bbox=' + bb.join(',') + (v ? '&v=' + v : '') + '&f=2';
    let r;
    try { r = await fetch(url); } catch (e) {
      throw new Error(T('The elevation data service did not respond. Try again in a moment.'));
    }
    if (!r.ok) throw new Error(T('Elevation data ({m}): {msg}', { m: model.toUpperCase(), msg: (await r.text()).slice(0, 200) }));
    const buf = await r.arrayBuffer();
    // the surface model can come as an ASCII grid (Geoportal sends a picture as TIFF there)
    if (/^\s*ncols/i.test(new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(16, buf.byteLength))))) return asciiGrid(new TextDecoder().decode(buf));
    const b0 = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
    if (!((b0[0] === 0x49 && b0[1] === 0x49) || (b0[0] === 0x4d && b0[1] === 0x4d))) {
      // neither a TIFF nor a grid: show the start of what came, so it can be traced
      throw new Error(T('Elevation data ({m}): {msg}', { m: model.toUpperCase(), msg: new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(160, buf.byteLength))).replace(/[^\x20-\x7e]+/g, ' ') }));
    }
    const tiff = await root.GeoTIFF.fromArrayBuffer(buf);
    const img = await tiff.getImage();
    const w = img.getWidth(), h = img.getHeight();
    const [data] = await img.readRasters({ interleave: false });
    // 8-bit answers are pictures or empty fills, not heights in metres
    if (data instanceof Uint8Array || data instanceof Int8Array) throw new Error(T('Elevation data ({m}): {msg}', { m: model.toUpperCase(), msg: 'no heights here' }));
    let x0, y0, res;
    try {
      [x0, y0] = img.getOrigin();
      res = img.getResolution()[0];
    } catch (e) { x0 = NaN; }
    // some WCS servers swap the axes of EPSG:2180 in the GeoTIFF; fall back to the request
    if (!(Math.abs(x0 - bb[0]) < 50 && Math.abs(y0 - bb[3]) < 50)) {
      x0 = bb[0]; y0 = bb[3]; res = (bb[2] - bb[0]) / w;
    }
    const nod = img.getGDALNoData();
    return { x0, y0, res, w, h, data, nod: nod === null ? -9999 : nod };
  }

  // ESRI ASCII grid: a header (ncols, nrows, xllcorner|xllcenter, yllcorner|yllcenter,
  // cellsize, NODATA_value), then the rows from north to south
  function asciiGrid(text) {
    const hd = {};
    let pos = 0;
    for (;;) {
      const end = text.indexOf('\n', pos);
      const line = text.slice(pos, end < 0 ? undefined : end).trim();
      const m = line.match(/^([a-z_]+)\s+(\S+)$/i);
      if (!m) break;
      hd[m[1].toLowerCase()] = +m[2];
      pos = end + 1;
    }
    const w = hd.ncols, h = hd.nrows, res = hd.cellsize;
    const x0 = 'xllcenter' in hd ? hd.xllcenter - res / 2 : hd.xllcorner;
    const yll = 'yllcenter' in hd ? hd.yllcenter - res / 2 : hd.yllcorner;
    const data = new Float32Array(w * h);
    const vals = text.slice(pos).split(/\s+/);
    let k = 0;
    for (const v of vals) { if (v === '') continue; if (k >= data.length) break; data[k++] = +v; }
    return { x0, y0: yll + h * res, res, w, h, data, nod: 'nodata_value' in hd ? hd.nodata_value : -9999 };
  }

  function sample(g, x, y) {  // bilinear value of grid g at (x, y), NaN outside or on nodata
    const fc = (x - g.x0) / g.res - 0.5, fr = (g.y0 - y) / g.res - 0.5;
    const c = Math.floor(fc), r = Math.floor(fr);
    if (c < 0 || r < 0 || c + 1 >= g.w || r + 1 >= g.h) {
      const cc = Math.round(fc), rr = Math.round(fr);
      if (cc < 0 || rr < 0 || cc >= g.w || rr >= g.h) return NaN;
      const v = g.data[rr * g.w + cc];
      return v === g.nod || v < -1000 ? NaN : v;
    }
    const a = g.data[r * g.w + c], b = g.data[r * g.w + c + 1];
    const d = g.data[(r + 1) * g.w + c], e = g.data[(r + 1) * g.w + c + 1];
    if ([a, b, d, e].some(v => v === g.nod || v < -1000)) return NaN;
    const tx = fc - c, ty = fr - r;
    return (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
  }

  // CHM on the NMPT grid: {x0, y0, res, w, h, chm: Float32Array (NaN = no data)}
  async function loadChm(polys, onStep) {
    const [x0, y0, x1, y1] = core.bbox(polys);
    const bb = [Math.floor(x0 - MARGIN), Math.floor(y0 - MARGIN), Math.ceil(x1 + MARGIN), Math.ceil(y1 + MARGIN)];
    const km2 = (bb[2] - bb[0]) * (bb[3] - bb[1]) / 1e6;
    if (km2 > MAX_KM2) {
      throw new Error(T('This area is too large for an on-the-fly calculation (bounding box {a} km², limit {max} km²). Draw a smaller part of it.', { a: km2.toFixed(1), max: MAX_KM2 }));
    }
    onStep && onStep(T('Downloading the surface and terrain models from Geoportal…'));
    // LIDAR PL-EVRF2007-NH first (the newer scans); PL-KRON86 only when that fails or
    // shows no vegetation at all
    let g = null;
    try {
      const [dsm, dtm] = await Promise.all([getGrid('nmpt', bb, 'evrf'), getGrid('nmt', bb, 'evrf')]);
      g = canopy(dsm, dtm);
      g.src = 'EVRF2007';
    } catch (e) { g = null; }
    if (!g || !g.diag || g.diag.tall < 0.01) {
      try {
        const [dsm, dtm] = await Promise.all([getGrid('nmpt', bb), getGrid('nmt', bb)]);
        onStep && onStep(T('Computing canopy height…'));
        const g2 = canopy(dsm, dtm);
        g2.src = 'KRON86';
        if (!g || !g.diag || (g2.diag && g2.diag.tall > g.diag.tall)) g = g2;
      } catch (e) { if (!g) throw e; }
    }
    return g;
  }

  function canopy(dsm, dtm) {
    const chm = new Float32Array(dsm.w * dsm.h);
    // a few numbers kept to tell bad data from bare land: share of cells where the surface
    // lies below the terrain or on it, and both mean levels
    const d = { n: 0, below: 0, flat: 0, tall: 0, s: 0, t: 0, resS: dsm.res, resT: dtm.res };
    for (let r = 0; r < dsm.h; r++) {
      const y = dsm.y0 - (r + 0.5) * dsm.res;
      for (let c = 0; c < dsm.w; c++) {
        const s = dsm.data[r * dsm.w + c];
        if (s === dsm.nod || s < -1000) { chm[r * dsm.w + c] = NaN; continue; }
        const t = sample(dtm, dsm.x0 + (c + 0.5) * dsm.res, y);
        if (Number.isNaN(t)) { chm[r * dsm.w + c] = NaN; continue; }
        const h = s - t;
        d.n++; d.s += s; d.t += t;
        if (h < -1) d.below++; else if (h < 0.3) d.flat++; else if (h >= 2) d.tall++;
        chm[r * dsm.w + c] = h < 0 ? 0 : h > 60 ? NaN : h;  // > 60 m: not a tree (data error)
      }
    }
    const diag = d.n ? { below: d.below / d.n, flat: d.flat / d.n, tall: d.tall / d.n, dsm: d.s / d.n, dtm: d.t / d.n, resS: d.resS, resT: d.resT } : null;
    return { x0: dsm.x0, y0: dsm.y0, res: dsm.res, w: dsm.w, h: dsm.h, chm, diag };
  }

  // --- tree tops: local maxima of the smoothed CHM, as in tools/03_drzewa.py ----------
  // search radius ~ 0.6 m + 6% of tree height, taken at the middle of 5 m height classes
  const CLASSES = [[5, 10], [10, 15], [15, 20], [20, 25], [25, 50]];
  const searchRadius = (h) => { const [a, b] = CLASSES.find(([, hi]) => h < hi) || CLASSES[4]; return 0.6 + 0.06 * (a + b) / 2; };
  const crownWidth = (h) => 2 * (0.6 + 0.06 * h);

  function findTrees(g) {
    const { w, h, res, chm } = g;
    // gaussian smoothing, sigma = 1 pixel (separable, NaN treated as 0 like nan_to_num)
    const k = [0.0545, 0.2442, 0.4026, 0.2442, 0.0545];
    const val = (v) => (Number.isNaN(v) ? 0 : v);
    const tmp = new Float32Array(w * h), sm = new Float32Array(w * h);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        let s = 0;
        for (let d = -2; d <= 2; d++) s += k[d + 2] * val(chm[r * w + Math.min(Math.max(c + d, 0), w - 1)]);
        tmp[r * w + c] = s;
      }
    }
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        let s = 0;
        for (let d = -2; d <= 2; d++) s += k[d + 2] * tmp[Math.min(Math.max(r + d, 0), h - 1) * w + c];
        sm[r * w + c] = s;
      }
    }
    const tops = [];
    for (let r = 1; r < h - 1; r++) {
      for (let c = 1; c < w - 1; c++) {
        const v = sm[r * w + c];
        if (!(v >= core.H_FOREST)) continue;
        const rr = Math.max(1, Math.round(searchRadius(v) / res)), r2 = rr * rr;
        let top = true;
        for (let a = -rr; a <= rr && top; a++) {
          const ra = r + a;
          if (ra < 0 || ra >= h) continue;
          for (let b = -rr; b <= rr; b++) {
            if ((a || b) === 0 || a * a + b * b > r2) continue;
            const cb = c + b;
            if (cb < 0 || cb >= w) continue;
            const u = sm[ra * w + cb];
            // ties: the first pixel in reading order wins
            if (u > v || (u === v && (a < 0 || (a === 0 && b < 0)))) { top = false; break; }
          }
        }
        if (!top) continue;
        let hmax = 0;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          const u = chm[(r + a) * w + c + b];
          if (u > hmax) hmax = u;
        }
        tops.push({ x: g.x0 + (c + 0.5) * res, y: g.y0 - (r + 0.5) * res, h: hmax, crown: crownWidth(hmax) });
      }
    }
    return tops;
  }

  // --- the calculation (same outputs as ALS.core.compute) ---------------------------
  function compute(polys, g) {
    const { res, w, chm } = g, px = res * res;
    const [bx0, by0, bx1, by1] = core.bbox(polys);
    const c0 = Math.floor((bx0 - g.x0) / res), c1 = Math.ceil((bx1 - g.x0) / res);
    const r0 = Math.floor((g.y0 - by1) / res), r1 = Math.ceil((g.y0 - by0) / res);
    const rows = r1 - r0, cols = c1 - c0;
    const mask = core.rasterize(polys, g, r0, c0, rows, cols);

    const out = { area_ha: core.polyArea(polys) / 1e4, data_ha: 0, forest_ha: 0, shrub_ha: 0, diag: g.diag };
    const H = new Float32Array(rows * cols).fill(NaN);
    let nData = 0, nForest = 0, nShrub = 0;
    for (let r = 0; r < rows; r++) {
      const gr = r0 + r;
      if (gr < 0 || gr >= g.h) continue;
      for (let c = 0; c < cols; c++) {
        const gc = c0 + c;
        if (gc < 0 || gc >= w || !mask[r * cols + c]) continue;
        const hh = chm[gr * w + gc];
        if (Number.isNaN(hh)) continue;
        H[r * cols + c] = hh;
        nData++;
        if (hh >= core.H_FOREST) nForest++; else if (hh >= core.H_SHRUB) nShrub++;
      }
    }
    out.data_ha = nData * px / 1e4;
    out.forest_ha = nForest * px / 1e4;
    out.shrub_ha = nShrub * px / 1e4;

    const rs = core.rings(polys), hs = [];
    let vA = 0, dSum = 0;
    out.tops = findTrees(g).filter(t => core.contains(rs, t.x, t.y));
    for (const t of out.tops) {
      const [v, d] = core.treeVolume(t.h);
      hs.push(t.h); vA += v; dSum += d;
    }
    hs.sort((a, b) => a - b);
    out.trees = hs.length;
    out.heights = hs;
    out.h_mean = hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : 0;
    out.dbh_mean = hs.length ? dSum / hs.length : 0;
    out.vol_trees = vA;

    const k = Math.max(1, Math.round(core.CELL / res));
    let vB = 0;
    for (let i = 0; i < rows; i += k) {
      for (let j = 0; j < cols; j += k) {
        let n = 0; const tall = [];
        for (let a = i; a < Math.min(i + k, rows); a++) {
          for (let b = j; b < Math.min(j + k, cols); b++) {
            const hh = H[a * cols + b];
            if (Number.isNaN(hh)) continue;
            n++; if (hh >= core.H_FOREST) tall.push(hh);
          }
        }
        if (!n || !tall.length) continue;
        tall.sort((a, b) => a - b);
        const h95 = core.percentile(tall, 95);
        vB += core.G_HA * (tall.length / n) * h95 * (0.42 + 1.0 / h95) * (n * px / 1e4);
      }
    }
    out.vol_canopy = vB;
    out.image = chmImage(g, H, r0, c0, rows, cols);
    // the canopy height of the area, kept for the yield-table estimate per stand
    out.grid = { H, rows, cols, res, x0: g.x0 + c0 * res, y0: g.y0 - r0 * res };
    return out;
  }

  // canopy height classes for the map: upper bound [m] and colour, white through blue,
  // green, yellow and orange to red and purple (greens alone were hard to read on the forest)
  const CHM_CLASSES = [[1.3, '#ffffff'], [4, '#a8d0f0'], [6.5, '#5aa0e6'], [9, '#a0e080'], [11.5, '#40d040'],
    [14, '#5a9a3a'], [16.5, '#c8c83c'], [19, '#f0f040'], [21.5, '#f0c020'], [24, '#f09030'], [26.5, '#f05030'],
    [29, '#e02020'], [31.5, '#e040c0'], [Infinity, '#a040c0']];
  const CHM_RGB = CHM_CLASSES.map(([, c]) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)));

  // CHM of the area as a coloured PNG in lat/lon (height classes above), resampled from the
  // EPSG:2180 grid so it lines up with the map; returns {url, south, west, north, east}
  function chmImage(g, H, r0, c0, rows, cols) {
    const xa = g.x0 + c0 * g.res, ya = g.y0 - r0 * g.res, xb = xa + cols * g.res, yb = ya - rows * g.res;
    const corners = [[xa, ya], [xb, ya], [xa, yb], [xb, yb]].map(([x, y]) => core.toWGS(x, y));
    const west = Math.min(...corners.map(c => c[0])), east = Math.max(...corners.map(c => c[0]));
    const south = Math.min(...corners.map(c => c[1])), north = Math.max(...corners.map(c => c[1]));
    const W = cols, Hh = rows;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = Hh;
    const ctx = cv.getContext('2d'), im = ctx.createImageData(W, Hh);
    // EPSG:2180 position of each output pixel, interpolated between the projected corners
    // (calling proj4 for every pixel froze the page for seconds; the error over 1 km is < 1 cm)
    const nw = core.toPL(west, north), ne = core.toPL(east, north), sw = core.toPL(west, south), se = core.toPL(east, south);
    for (let r = 0; r < Hh; r++) {
      const v = (r + 0.5) / Hh;
      const lx = nw[0] + (sw[0] - nw[0]) * v, ly = nw[1] + (sw[1] - nw[1]) * v;
      const rx = ne[0] + (se[0] - ne[0]) * v, ry = ne[1] + (se[1] - ne[1]) * v;
      for (let c = 0; c < W; c++) {
        const u = (c + 0.5) / W, x = lx + (rx - lx) * u, y = ly + (ry - ly) * u;
        const cc = Math.floor((x - xa) / g.res), rr = Math.floor((ya - y) / g.res);
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
        const h = H[rr * cols + cc];
        if (Number.isNaN(h)) continue;
        let k = 0;
        while (h >= CHM_CLASSES[k][0]) k++;
        const i = (r * W + c) * 4;
        for (let ch = 0; ch < 3; ch++) im.data[i + ch] = CHM_RGB[k][ch];
        im.data[i + 3] = k ? 230 : 110;  // bare ground only lightly whitened, so the photo shows through
      }
    }
    ctx.putImageData(im, 0, 0);
    return { url: cv.toDataURL(), south, west, north, east };
  }

  // the whole downloaded grid as an image (for the live canopy layer)
  const chmView = (g) => chmImage(g, g.chm, 0, 0, g.h, g.w);

  // --- when the laser scan was made: the NMPT sheet index (WFS "Skorowidze") ---------
  // Each sheet of the surface model carries its acquisition date. Attribute names differ
  // between the index layers, so any element whose name mentions a date is read and the
  // newest date wins (the WCS serves the newest model). Returns {year, date} or null.
  const WFS = [
    'https://mapy.geoportal.gov.pl/wss/service/PZGIK/NumerycznyModelPokryciaTerenuEVRF2007/WFS/Skorowidze',
    'https://mapy.geoportal.gov.pl/wss/service/PZGIK/NumerycznyModelPokryciaTerenuKRON86/WFS/Skorowidze',
  ];
  // the browser may be refused by Geoportal (no CORS headers); then the same request goes
  // through the Cloudflare Worker, if it passes such requests on (parameter "url")
  async function wfsGet(u) {
    try { const r = await fetch(u); if (r.ok) return r; } catch (e) { /* blocked: try the proxy */ }
    return fetch(ALS.PROXY + '?url=' + encodeURIComponent(u));
  }
  async function layersOf(url) {
    try {
      const r = await wfsGet(url + '?SERVICE=WFS&REQUEST=GetCapabilities&VERSION=2.0.0');
      const names = (await r.text()).match(/gugik:Skorowidz\w*/g) || [];
      return [...new Set(names)];
    } catch (e) { return []; }
  }
  async function scanDate(polys) {
    const [x0, y0, x1, y1] = core.bbox(polys);
    const a = core.toWGS(x0, y0), b = core.toWGS(x1, y1);
    // EPSG:4326 in WFS 2.0 is latitude first
    // the axis order of the BBOX is easy to get wrong on this server, so every reading is
    // tried; the ones that miss Poland simply return no sheets
    const bbs = [[a[1], a[0], b[1], b[0]].map(v => v.toFixed(6)).join(',') + ',urn:ogc:def:crs:EPSG::4326',
      [y0, x0, y1, x1].map(v => v.toFixed(1)).join(',') + ',urn:ogc:def:crs:EPSG::2180',
      [x0, y0, x1, y1].map(v => v.toFixed(1)).join(',') + ',EPSG:2180'];
    // EVRF2007 first (the models the heights come from), KRON86 only when it has nothing
    const bySvc = WFS.map(() => ({ dates: [], older: 0 }));
    await Promise.all(WFS.map(async (url, si) => {
      const found = bySvc[si];
      const layers = await layersOf(url);
      await Promise.all(layers.flatMap(ly => bbs.map(async (bb) => {
        try {
          const r = await wfsGet(url + '?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAMES=' + ly + '&COUNT=50&BBOX=' + encodeURIComponent(bb));
          if (!r.ok) return;
          const xml = await r.text();
          if (!/<(\w+:)?(member|featureMember)\b/.test(xml)) return;  // no sheet of this layer here
          let any = false;
          const re = /<(?:\w+:)?(\w*(?:aktualnosc|Aktualnosc|data|Data|DATA|rok|Rok|ROK|nalot|Nalot)\w*)>\s*([^<]{4,30})\s*<\//g;
          let m;
          while ((m = re.exec(xml))) {
            const d = m[2].match(/(19|20)\d\d(-\d\d(-\d\d)?)?/);
            if (d && +d[0].slice(0, 4) >= 2000) { found.dates.push(d[0]); any = true; }
          }
          // the index layers are split by year ("2024", "2025", "2023 i starsze"): the name tells it
          const y = ly.match(/(20\d\d)/);
          if (!any && y) {
            if (/starsze|older|wczesn/i.test(ly)) found.older = Math.max(found.older, +y[1]);
            else found.dates.push(y[1]);
          }
        } catch (e) { /* this index layer did not answer */ }
      })));
    }));
    for (const f of bySvc) {
      if (f.dates.length) {
        f.dates.sort();
        const date = f.dates[f.dates.length - 1];
        return { date, year: +date.slice(0, 4) };
      }
      if (f.older) return { older: f.older };
    }
    return null;
  }

  // --- stands: top height and canopy cover per BDL stand, on 10 m cells ---------------
  // Top height as in silvaR th_calc(): CHM averaged to 10 m cells, then the mean of the
  // cells above 2/3 of the stand's mean. owner(x, y) says which stand a cell centre is in.
  function standStats(grid, owner) {
    const { H, rows, cols, res } = grid, k = Math.max(1, Math.round(10 / res)), px = res * res;
    const st = new Map();
    for (let i = 0; i < rows; i += k) {
      for (let j = 0; j < cols; j += k) {
        let n = 0, sum = 0, tall = 0;
        for (let a = i; a < Math.min(i + k, rows); a++) {
          for (let b = j; b < Math.min(j + k, cols); b++) {
            const h = H[a * cols + b];
            if (Number.isNaN(h)) continue;
            n++; sum += h; if (h >= core.H_FOREST) tall++;
          }
        }
        if (!n) continue;
        const x = grid.x0 + (j + k / 2) * res, y = grid.y0 - (i + k / 2) * res;
        const id = owner(x, y);
        if (id === null || id === undefined) continue;
        const e = st.get(id) || { cells: [], n: 0, tall: 0 };
        e.cells.push(sum / n); e.n += n; e.tall += tall;
        st.set(id, e);
      }
    }
    const out = new Map();
    for (const [id, e] of st) {
      const m = e.cells.reduce((a, b) => a + b, 0) / e.cells.length;
      const top = e.cells.filter(v => v > m * 2 / 3);
      out.set(id, { th: top.length ? top.reduce((a, b) => a + b, 0) / top.length : NaN,
        cover: e.tall / e.n, ha: e.n * px / 1e4 });
    }
    return out;
  }

  ALS.pl = { loadChm, compute, findTrees, chmView, scanDate, standStats, MAX_KM2, CHM_CLASSES };
})(typeof window !== 'undefined' ? window : globalThis);
