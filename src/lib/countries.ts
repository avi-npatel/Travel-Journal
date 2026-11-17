import data from "@/data/countries.json";

export const CONTINENTS = [
  "Africa",
  "Antarctica",
  "Asia",
  "Europe",
  "North America",
  "Oceania",
  "South America",
] as const;

export type Continent = (typeof CONTINENTS)[number];

export interface Country {
  /** ISO 3166-1 alpha-2, e.g. "PT". */
  code: string;
  /** ISO numeric code as a string, e.g. "620". Null for Kosovo. */
  num: string | null;
  name: string;
  continent: Continent;
  lat: number;
  lng: number;
}

export const COUNTRIES = data as Country[];

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));
const byNumeric = new Map(COUNTRIES.filter((c) => c.num).map((c) => [c.num as string, c]));
const byName = new Map(COUNTRIES.map((c) => [c.name, c]));

export function getCountry(code: string): Country | undefined {
  return byCode.get(code);
}

/**
 * Matches an outline from the world-atlas map data to a country. Outlines are
 * identified by ISO numeric id; the few without one (Kosovo) match by name.
 */
export function countryForOutline(id: string | number | undefined, name?: string): Country | undefined {
  if (id !== undefined) {
    const match = byNumeric.get(String(id).padStart(3, "0"));
    if (match) return match;
  }
  return name ? byName.get(name) : undefined;
}

export function countryName(code: string): string {
  return byCode.get(code)?.name ?? code;
}

export function countryNames(codes: string[]): string[] {
  return codes.map(countryName);
}

/** The continents a set of countries covers, in alphabetical order. */
export function continentsOf(codes: Iterable<string>): Continent[] {
  const found = new Set<Continent>();
  for (const code of codes) {
    const country = byCode.get(code);
    if (country) found.add(country.continent);
  }
  return CONTINENTS.filter((c) => found.has(c));
}
