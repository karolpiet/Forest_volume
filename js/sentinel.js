// Sentinel-2 NDVI for the map view, read straight from the public Sentinel-2 L2A archive on
// AWS (Element 84, bucket "sentinel-cogs"): no account and no key, the bucket allows reading
// from any web page. Each scene is a set of cloud-optimised GeoTIFFs, so only the pixels of
// the view are downloaded, not the whole 110 km tile.
(function (root) {
  const ALS = (root.ALS = root.ALS || {});
  const BUCKET = 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/';
  const PREFIX = 'sentinel-s2-l2a-cogs/';
  // the window read around the centre of the view; at most 4.9 km either way, so it always
  // fits inside one tile (tiles are 109.8 km wide on a 100 km grid)
  const HALF = 4500;
  const MAX_PX = 900;
  // SCL classes that hide the ground: no data, saturated, cloud shadow, clouds, cirrus, snow
  const SCL_BAD = new Set([0, 1, 3, 8, 9, 10, 11]);

  const utmDef = (zone) => `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`;

  // MGRS tile name (e.g. 34UDA) of the 100 km square whose Sentinel tile holds the whole
  // window around (E, N); the tile reaches 9.8 km past the square to the east and south
  function tileFor(lon, lat) {
    const zone = Math.floor((lon + 180) / 6) + 1;
    const [E, N] = root.proj4('WGS84', utmDef(zone), [lon, lat]);
    const col = Math.floor((E - HALF) / 1e5), row = Math.floor((N + HALF) / 1e5);
    const band = 'CDEFGHJKLMNPQRSTUVWX'[Math.floor((lat + 80) / 8)];
    const colL = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'][(zone - 1) % 3][col - 1];
    const rowL = 'ABCDEFGHJKLMNPQRSTUV'[(row + (zone % 2 ? 0 : 5)) % 20];
    return { zone, band, sq: colL + rowL, id: zone + band + colL + rowL, E, N };
  }

  // scenes of a tile in one month, newest first: [{id, date, url}]
  const monthCache = new Map();
  async function month(t, y, m) {
    const key = `${t.zone}/${t.band}/${t.sq}/${y}/${m}/`;
    if (!monthCache.has(key)) {
      monthCache.set(key, (async () => {
        const r = await fetch(BUCKET + '?list-type=2&delimiter=/&prefix=' + PREFIX + key);
        if (!r.ok) throw new Error('S3 ' + r.status);
        const xml = await r.text();
        return [...xml.matchAll(/<Prefix>[^<]*\/((S2[ABCD])_\w+?_(\d{8})_(\d+)_L2A)\/<\/Prefix>/g)].map(x => ({
          id: x[1], date: x[3].slice(0, 4) + '-' + x[3].slice(4, 6) + '-' + x[3].slice(6), ver: +x[4],
          url: BUCKET + PREFIX + key + x[1] + '/',
        })).sort((a, b) => (b.date + b.ver).localeCompare(a.date + a.ver));
      })().catch(e => { monthCache.delete(key); throw e; }));
    }
    return monthCache.get(key);
  }

  // scene metadata (STAC item): cloud cover of the tile, band files, value scaling
  const itemCache = new Map();
  function item(sc) {
    if (!itemCache.has(sc.id)) {
      itemCache.set(sc.id, fetch(sc.url + sc.id + '.json').then(r => r.json()).then(d => {
        const p = d.properties, rb = (d.assets.red['raster:bands'] || [{}])[0];
        return { ...sc, cloud: p['eo:cloud_cover'], nodata: p['s2:nodata_pixel_percentage'] || 0,
          red: d.assets.red.href, nir: d.assets.nir.href, scl: d.assets.scl.href,
          scale: rb.scale || 1e-4, offset: rb.offset || 0, time: p.datetime };
      }).catch(e => { itemCache.delete(sc.id); throw e; }));
    }
    return itemCache.get(sc.id);
  }

  const tiffs = new Map();
  const tiff = (url) => { if (!tiffs.has(url)) tiffs.set(url, root.GeoTIFF.fromUrl(url)); return tiffs.get(url); };

  // the window around (lon, lat) in UTM metres, clamped to what is visible
  function windowFor(t, view) {
    const def = utmDef(t.zone);
    const pts = [[view.west, view.south], [view.east, view.north], [view.west, view.north], [view.east, view.south]]
      .map(p => root.proj4('WGS84', def, p));
    const hw = Math.min(Math.max(...pts.map(p => Math.abs(p[0] - t.E))), HALF);
    const hh = Math.min(Math.max(...pts.map(p => Math.abs(p[1] - t.N))), HALF);
    return [t.E - hw, t.N - hh, t.E + hw, t.N + hh];
  }

  // NDVI of one scene in the window: {ndvi, w, h, bbox, ok} where ok is the share of pixels
  // seen clearly (not cloud, shadow or outside the satellite's strip)
  async function readNdvi(it, bbox) {
    const w = Math.max(8, Math.min(MAX_PX, Math.round((bbox[2] - bbox[0]) / 10)));
    const h = Math.max(8, Math.min(MAX_PX, Math.round((bbox[3] - bbox[1]) / 10)));
    const opt = { bbox, width: w, height: h, resampleMethod: 'nearest', interleave: true };
    const [red, nir, scl] = await Promise.all([it.red, it.nir, it.scl].map(async u => (await tiff(u)).readRasters(opt)));
    const ndvi = new Float32Array(w * h);
    // newer scenes carry a -0.1 offset in their metadata, but the files in this archive are
    // often already shifted: values below 1000 would then be negative reflectance. When many
    // red values are that low the offset has already been applied and is skipped here
    let low = 0, all = 0;
    for (let i = 0; i < w * h; i++) if (red[i] && !SCL_BAD.has(scl[i])) { all++; if (red[i] < 900) low++; }
    const off = it.offset && low > 0.01 * all ? 0 : it.offset;
    let good = 0;
    for (let i = 0; i < w * h; i++) {
      if (!red[i] || !nir[i] || SCL_BAD.has(scl[i])) { ndvi[i] = NaN; continue; }
      const r = red[i] * it.scale + off, n = nir[i] * it.scale + off;
      ndvi[i] = n + r > 0 ? (n - r) / (n + r) : NaN;
      if (!Number.isNaN(ndvi[i])) good++;
    }
    return { ndvi, w, h, bbox, ok: good / (w * h) };
  }

  // newest scene before `before` (YYYY-MM-DD, exclusive) and not older than `after`, with
  // tile cloud cover <= maxCloud and at least `minOk` of the window seen clearly
  // with `target` (YYYY-MM-DD) the scene closest to that day is taken instead of the newest
  async function findScene(t, bbox, { before = '9999', after = '0000', target = null, maxCloud = 10, minOk = 0.7, onTry } = {}) {
    const tryScene = async (sc) => {
      const it = await item(sc);
      if (it.cloud > maxCloud || it.nodata > 95) return null;
      if (onTry) onTry(it);
      const g = await readNdvi(it, bbox);
      return g.ok >= minOk ? { ...it, ...g } : null;
    };
    let d = new Date(before === '9999' ? Date.now() : before);
    const cands = [];
    for (let k = 0; k < 14; k++) {
      const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
      if (`${y}-${String(m).padStart(2, '0')}-31` < after) break;
      let list = [];
      try { list = await month(t, y, m); } catch (e) { if (k === 0) throw e; }
      for (const sc of list) {
        if (sc.date >= before || sc.date < after) continue;
        if (target) { cands.push(sc); continue; }
        const r = await tryScene(sc);
        if (r) return r;
      }
      d = new Date(Date.UTC(y, m - 2, 15));
    }
    const dist = (sc) => Math.abs(new Date(sc.date) - new Date(target));
    for (const sc of cands.sort((a, b) => dist(a) - dist(b))) {
      const r = await tryScene(sc);
      if (r) return r;
    }
    return null;
  }

  // NDVI classes: upper bound and colour, from water and bare soil (clear-cuts, fields after
  // harvest) through sparse to dense green
  const NDVI_CLASSES = [[0, '#3b6ea8'], [0.2, '#a0522d'], [0.35, '#e0b050'], [0.5, '#e8e870'],
    [0.65, '#9fd36a'], [0.8, '#3c9a3c'], [Infinity, '#155d27']];
  // NDVI change against a year before: only losses are drawn
  const DIFF_CLASSES = [[-0.35, '#d7191c'], [-0.2, '#f07c2a'], [-0.1, '#fdd27f'], [Infinity, null]];
  const rgb = (c) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));

  // a coloured picture in lat/lon for the map, resampled from the UTM grid (like the canopy
  // layer); values[i] -> class index via `classes`
  function image(g, zone, values, classes, alpha) {
    const def = utmDef(zone), [x0, y0, x1, y1] = g.bbox;
    const cs = [[x0, y1], [x1, y1], [x0, y0], [x1, y0]].map(p => root.proj4(def, 'WGS84', p));
    const west = Math.min(...cs.map(c => c[0])), east = Math.max(...cs.map(c => c[0]));
    const south = Math.min(...cs.map(c => c[1])), north = Math.max(...cs.map(c => c[1]));
    const W = g.w, H = g.h, cols = classes.map(([, c]) => c && rgb(c));
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), im = ctx.createImageData(W, H);
    const nw = root.proj4('WGS84', def, [west, north]), ne = root.proj4('WGS84', def, [east, north]);
    const sw = root.proj4('WGS84', def, [west, south]), se = root.proj4('WGS84', def, [east, south]);
    const rx = (x1 - x0) / W, ry = (y1 - y0) / H;
    for (let r = 0; r < H; r++) {
      const v = (r + 0.5) / H;
      const lx = nw[0] + (sw[0] - nw[0]) * v, ly = nw[1] + (sw[1] - nw[1]) * v;
      const qx = ne[0] + (se[0] - ne[0]) * v, qy = ne[1] + (se[1] - ne[1]) * v;
      for (let c = 0; c < W; c++) {
        const u = (c + 0.5) / W, x = lx + (qx - lx) * u, y = ly + (qy - ly) * u;
        const cc = Math.floor((x - x0) / rx), rr = Math.floor((y1 - y) / ry);
        if (cc < 0 || rr < 0 || cc >= W || rr >= H) continue;
        const val = values[rr * W + cc];
        if (Number.isNaN(val)) continue;
        let k = 0;
        while (val >= classes[k][0]) k++;
        if (!cols[k]) continue;
        const i = (r * W + c) * 4;
        for (let ch = 0; ch < 3; ch++) im.data[i + ch] = cols[k][ch];
        im.data[i + 3] = alpha;
      }
    }
    ctx.putImageData(im, 0, 0);
    return { url: cv.toDataURL(), south, west, north, east };
  }

  // the NDVI picture of the newest clear scene for the view
  // view: {west, south, east, north}; opt.before continues the search from an older date
  async function ndviView(view, opt = {}) {
    const t = tileFor((view.west + view.east) / 2, (view.south + view.north) / 2);
    const bbox = windowFor(t, view);
    const after = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    const sc = await findScene(t, bbox, { after, ...opt });
    if (!sc) return { tile: t.id, scene: null };
    return { tile: t.id, scene: sc, img: image(sc, t.zone, sc.ndvi, NDVI_CLASSES, 200) };
  }

  // NDVI loss against the clear scene closest to a year before the given one (±45 days)
  async function lossView(sc, tileId, view, opt = {}) {
    const t = tileFor((view.west + view.east) / 2, (view.south + view.north) / 2);
    const d = new Date(sc.date);
    const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
    const ago = d.getTime() - 365 * 864e5;
    const old = await findScene(t, sc.bbox, { before: iso(ago + 45 * 864e5), after: iso(ago - 45 * 864e5), target: iso(ago), minOk: 0.5, ...opt });
    if (!old) return { old: null };
    const diff = new Float32Array(sc.ndvi.length);
    // only where it was green a year before (forest, meadow), so bare fields being sown
    // do not show up
    for (let i = 0; i < diff.length; i++) diff[i] = old.ndvi[i] >= 0.6 ? sc.ndvi[i] - old.ndvi[i] : NaN;
    return { old, img: image(sc, t.zone, diff, DIFF_CLASSES, 220) };
  }

  ALS.s2 = { tileFor, findScene, ndviView, lossView, NDVI_CLASSES, DIFF_CLASSES };
})(typeof window !== 'undefined' ? window : globalThis);
