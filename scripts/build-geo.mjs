// Generates the two data files the maps and the country picker depend on:
//
//   src/data/countries.json       name, continent and centre point per country
//   public/geo/countries.geojson  country outlines for the interactive map
//
// Both outputs are committed, so this only needs re-running if the upstream
// datasets (world-countries, world-atlas) are updated:  npm run geo:build

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoEquirectangular } from "d3-geo";
import { geoProject } from "d3-geo-projection";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const source = require("world-countries");
const atlas = require("world-atlas/countries-50m.json");

// --- Country list ------------------------------------------------------------

/** world-countries groups the Americas together; split them into continents. */
function continentOf(country) {
  if (country.region === "Americas") {
    return country.subregion === "South America" ? "South America" : "North America";
  }
  if (country.region === "Antarctic") return "Antarctica";
  return country.region; // Africa, Asia, Europe, Oceania
}

const countries = source
  .map((c) => ({
    code: c.cca2,
    // ISO numeric code: how world-atlas identifies each outline.
    num: c.ccn3 || null,
    name: c.name.common,
    continent: continentOf(c),
    lat: c.latlng[0],
    lng: c.latlng[1],
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(
  new URL("../src/data/countries.json", import.meta.url),
  JSON.stringify(countries).replace(/},/g, "},\n") + "\n",
);

// --- Outlines for the interactive map ----------------------------------------
//
// The source outlines are drawn on a sphere: Russia, Fiji and Antarctica run
// straight across the 180° meridian. A flat map cannot draw that; it joins
// 180° to -180° with a line right across the world. Passing each outline
// through a plain longitude/latitude projection makes d3 cut it at the
// meridian (and close Antarctica along the pole), which a flat map can draw.

const byNumeric = new Map(countries.filter((c) => c.num).map((c) => [c.num, c]));
const byName = new Map(countries.map((c) => [c.name, c]));

// One unit per degree; precision(0) keeps the original points as they are.
const degrees = geoEquirectangular()
  .scale(180 / Math.PI)
  .translate([0, 0])
  .precision(0);

/** d3 projects with y pointing down; flip back to latitude and round. */
const toLngLat = ([x, y]) => [Math.round(x * 1000) / 1000, Math.round(-y * 1000) / 1000];
const mapRings = (polygon) => polygon.map((ring) => ring.map(toLngLat));

const outlines = feature(atlas, atlas.objects.countries).features.flatMap((outline) => {
  const flat = geoProject(outline, degrees);
  if (!flat?.geometry) return [];

  const { type, coordinates } = flat.geometry;
  const country =
    byNumeric.get(String(outline.id ?? "").padStart(3, "0")) ?? byName.get(outline.properties.name);

  return [
    {
      type: "Feature",
      properties: { code: country?.code ?? null, name: country?.name ?? outline.properties.name },
      geometry: {
        type,
        coordinates: type === "Polygon" ? mapRings(coordinates) : coordinates.map(mapRings),
      },
    },
  ];
});

writeFileSync(
  new URL("../public/geo/countries.geojson", import.meta.url),
  JSON.stringify({ type: "FeatureCollection", features: outlines }),
);

console.log(`Wrote ${countries.length} countries and ${outlines.length} outlines.`);
