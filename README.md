# Kubik – how much timber grows in the forest

**Live:** https://karolpiet.github.io/Forest_volume/

A rough, honest estimate of how many cubic metres of timber stand on a forest in Poland. Pick a cadastral parcel, a State Forests subcompartment or compartment, draw your own shape or upload a KML / GPX / GeoJSON file. The page downloads the national elevation models from Geoportal and computes everything in the browser. Available in Polish, English and German.

## How it works

1. **Area.** Parcels come from the GUGiK cadastral service (ULDK); subcompartments and compartments from the Forest Data Bank (BDL OGC API).
2. **Canopy height.** For the area's bounding box the page fetches the digital surface model (NMPT, 0.5 m) and the terrain model (NMT, 1 m) from the GUGiK WCS. Canopy height = NMPT − NMT. Pixels ≥ 5 m are forest, 2–5 m shrubs and regeneration.
3. **Trees.** Tree tops are local maxima of the canopy height smoothed with a Gaussian (σ = 1 px), searched in a window of radius 0.6 + 0.06·h m.
4. **Timber volume**, two estimates:
   - A) sum over detected trees, DBH = 1.3·h − 2.5 cm, form factor 0.42 + 1/h (pine);
   - B) 28 m²/ha basal area × canopy closure × H95 × form factor, in 20 m cells.
5. **The headline number** is the mean of A and B, rounded to two significant digits. The range shown covers both methods and at least ±25 % around their mean.
6. **BDL.** Dominant species and stand age of the State Forests subcompartments inside the area. When more than 30 % of them are not pine, the page warns that the pine formulas may be well off.

A live canopy height layer is drawn for the current map view anywhere in Poland (zoom 16+).

## Limits

- An estimate, not a measurement (±25 % at best). The surface model is coarser than a raw point cloud, so in dense stands crowns merge and the tree count is usually too low; method B is the steadier number.
- The models assume Scots pine. Spruce, beech and oak differ.
- The scanning year depends on the region (roughly 2011–2023). Buildings inside the area count as canopy.
- At most 1 km² (bounding box) per calculation.
- Not a basis for a timber sale or valuation: that needs a field measurement.

## Technical notes

- Static site (GitHub Pages), no build step: Leaflet, proj4, geotiff.js in `vendor/`.
- The GUGiK WCS sends no CORS headers, so the elevation models go through a small Cloudflare Worker (`?m=nmt|nmpt&bbox=x0,y0,x1,y1` in EPSG:2180, max 1 km², cached for 7 days).
- `js/core.js`: projections, parcels (ULDK), BDL, file import. `js/pl-core.js`: elevation download, canopy height, trees, volume. `js/i18n.js`: EN / PL / DE texts. `js/app.js`: the map and the panel.

## Data

GUGiK (Geoportal: NMT, NMPT, orthophoto, cadastral parcels), State Forests – Forest Data Bank (BDL), OpenStreetMap.
