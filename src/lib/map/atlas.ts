// Country and land outlines for the maps drawn on the server (the home page
// map and the globe covers). Low-resolution Natural Earth data: small enough
// to turn into inline SVG, and it never reaches the browser as data.

import type { Feature, FeatureCollection, Geometry, MultiPolygon } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countriesTopology from "world-atlas/countries-110m.json";
import landTopology from "world-atlas/land-110m.json";
import { countryForOutline } from "../countries";

export interface CountryOutline {
  /** ISO alpha-2 code, or null for the few outlines that are not countries. */
  code: string | null;
  name: string;
  feature: Feature<Geometry>;
}

const countries = countriesTopology as unknown as Topology<{
  countries: GeometryCollection<{ name: string }>;
}>;
const land = landTopology as unknown as Topology<{ land: GeometryCollection }>;

const countryFeatures = (
  feature(countries, countries.objects.countries) as FeatureCollection<Geometry, { name: string }>
).features;

export const COUNTRY_OUTLINES: CountryOutline[] = countryFeatures.map((f) => ({
  code: countryForOutline(f.id, f.properties.name)?.code ?? null,
  name: f.properties.name,
  feature: f,
}));

/** Codes that have an outline at this resolution (tiny countries do not). */
export const OUTLINED_CODES = new Set(COUNTRY_OUTLINES.map((c) => c.code).filter(Boolean));

export const LAND = (feature(land, land.objects.land) as FeatureCollection<MultiPolygon>).features[0];
