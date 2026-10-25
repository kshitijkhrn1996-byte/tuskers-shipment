// Extract the countries around the UK → DE/FR/NL corridor from world-atlas
// into a small GeoJSON file for the route map. Run: node scripts/make_map.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { feature } from 'topojson-client'

const world = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url)))
// ISO 3166 numeric ids
const SERVED = { 826: 'United Kingdom', 276: 'Germany', 250: 'France', 528: 'Netherlands' }
const CONTEXT = [372, 56, 442, 756, 40, 208, 380, 724, 616, 203, 438, 492, 20, 578, 752, 705, 191, 348, 703]
const keep = new Set([...Object.keys(SERVED), ...CONTEXT.map(String)].map((id) => id.padStart(3, '0')))

const round = (c) => (typeof c[0] === 'number' ? [+c[0].toFixed(3), +c[1].toFixed(3)] : c.map(round))
// Drop polygons far outside Europe (e.g. French Guiana) so the file stays small.
const inEurope = (poly) => poly[0].some(([lng, lat]) => lng > -12 && lng < 30 && lat > 34 && lat < 64)

const features = feature(world, world.objects.countries).features
  .filter((f) => keep.has(String(f.id)))
  .map((f) => {
    let { type, coordinates } = f.geometry
    if (type === 'MultiPolygon') coordinates = coordinates.filter(inEurope)
    else if (!inEurope(coordinates)) return null
    return {
      type: 'Feature',
      properties: { id: String(f.id), name: SERVED[Number(f.id)] || f.properties.name, served: Number(f.id) in SERVED },
      geometry: { type, coordinates: round(coordinates) },
    }
  })
  .filter(Boolean)

writeFileSync(new URL('../src/data/europe.json', import.meta.url), JSON.stringify({ type: 'FeatureCollection', features }))
console.log(features.length, 'countries')
