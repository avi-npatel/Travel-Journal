"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Everything the list needs about one trip, prepared on the server. */
export interface TripListItem {
  id: string;
  href: string;
  title: string;
  summary: string;
  numberLabel: string;
  dateLabel: string | null;
  /** start_date ("YYYY-MM-DD") or "" when undated; sorts as text. */
  sortKey: string;
  year: number | null;
  countries: string[];
  continents: string[];
  tags: string[];
  distanceLabel: string | null;
  photoCount: number;
  /** The cover (photo or globe), rendered on the server. Fills its parent. */
  cover: ReactNode;
}

interface TripFilters {
  year: string;
  continent: string;
  tag: string;
  sort: "newest" | "oldest";
  view: "grid" | "list";
}

const DEFAULT_FILTERS: TripFilters = {
  year: "",
  continent: "",
  tag: "",
  sort: "newest",
  view: "grid",
};

// Grid rhythm on wide screens: column span and cover shape repeat every seven
// trips, so rows alternate between a wide/narrow pair and a run of three.
// (Class names are written out in full so Tailwind can find them.)
const GRID_PATTERN = [
  { span: "lg:col-span-7", shape: "lg:aspect-[3/2]", title: "text-4xl lg:text-5xl" },
  { span: "lg:col-span-5 lg:mt-20", shape: "lg:aspect-[4/5]", title: "text-3xl lg:text-4xl" },
  { span: "lg:col-span-4", shape: "lg:aspect-[4/5]", title: "text-3xl" },
  { span: "lg:col-span-4 lg:mt-14", shape: "lg:aspect-[4/3]", title: "text-3xl" },
  { span: "lg:col-span-4", shape: "lg:aspect-[4/5]", title: "text-3xl" },
  { span: "lg:col-span-5", shape: "lg:aspect-[4/5]", title: "text-3xl lg:text-4xl" },
  { span: "lg:col-span-7 lg:mt-20", shape: "lg:aspect-[3/2]", title: "text-4xl lg:text-5xl" },
];

function applyFilters(items: TripListItem[], filters: TripFilters): TripListItem[] {
  const matches = items.filter(
    (item) =>
      (!filters.year || String(item.year) === filters.year) &&
      (!filters.continent || item.continents.includes(filters.continent)) &&
      (!filters.tag || item.tags.includes(filters.tag)),
  );
  // Undated trips always go last, whichever way the dated ones are sorted.
  return matches.sort((a, b) => {
    if (!a.sortKey || !b.sortKey) return Number(!a.sortKey) - Number(!b.sortKey);
    const order = a.sortKey.localeCompare(b.sortKey);
    return filters.sort === "newest" ? -order : order;
  });
}

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

interface TripsViewProps {
  items: TripListItem[];
  filters: TripFilters;
  onChange: (changes: Partial<TripFilters>) => void;
}

/** The filter bar and the results, for a given set of filters. */
function TripsView({ items, filters, onChange }: TripsViewProps) {
  const visible = applyFilters(items, filters);
  const years = unique(items.flatMap((item) => (item.year ? [String(item.year)] : []))).reverse();
  const continents = unique(items.flatMap((item) => item.continents));
  const tags = unique(items.flatMap((item) => item.tags));
  const isFiltered = Boolean(filters.year || filters.continent || filters.tag);

  return (
    <>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-4 border-y border-rule py-4">
        <FilterSelect
          label="Year"
          value={filters.year}
          options={years}
          onChange={(year) => onChange({ year })}
        />
        <FilterSelect
          label="Continent"
          value={filters.continent}
          options={continents}
          onChange={(continent) => onChange({ continent })}
        />
        {tags.length > 0 && (
          <FilterSelect
            label="Tag"
            value={filters.tag}
            options={tags}
            onChange={(tag) => onChange({ tag })}
          />
        )}
        <FilterSelect
          label="Sort"
          value={filters.sort}
          options={["newest", "oldest"]}
          optionLabels={{ newest: "Newest first", oldest: "Oldest first" }}
          allLabel={null}
          onChange={(sort) => onChange({ sort: sort as TripFilters["sort"] })}
        />

        <div className="ml-auto flex items-end gap-4">
          {isFiltered && (
            <button
              type="button"
              className="meta link min-h-10"
              onClick={() => onChange({ year: "", continent: "", tag: "" })}
            >
              Clear filters
            </button>
          )}
          <div role="group" aria-label="Layout" className="flex">
            <ViewButton current={filters.view} view="grid" label="Grid" onChange={onChange} />
            <ViewButton current={filters.view} view="list" label="List" onChange={onChange} />
          </div>
        </div>
      </div>

      <p className="meta mt-4" aria-live="polite">
        {visible.length === items.length
          ? `${items.length} ${items.length === 1 ? "trip" : "trips"}`
          : `${visible.length} of ${items.length} trips`}
      </p>

      {visible.length === 0 ? (
        <p className="display mt-16 text-3xl text-muted">No trips match these filters.</p>
      ) : filters.view === "grid" ? (
        <TripGrid items={visible} />
      ) : (
        <TripBoard items={visible} />
      )}
    </>
  );
}

/**
 * The trips page body. Filters live in the URL (?year=2025&view=list), so a
 * filtered view can be linked to and survives a refresh.
 */
export function TripsBrowser({ items }: { items: TripListItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters: TripFilters = {
    year: params.get("year") ?? "",
    continent: params.get("continent") ?? "",
    tag: params.get("tag") ?? "",
    sort: params.get("sort") === "oldest" ? "oldest" : "newest",
    view: params.get("view") === "list" ? "list" : "grid",
  };

  function update(changes: Partial<TripFilters>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      const isDefault = value === DEFAULT_FILTERS[key as keyof TripFilters];
      if (isDefault) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return <TripsView items={items} filters={filters} onChange={update} />;
}

/**
 * What is shown until the URL has been read: the full list, newest first.
 * It is also what search engines and visitors without JavaScript get.
 */
export function TripsFallback({ items }: { items: TripListItem[] }) {
  return <TripsView items={items} filters={DEFAULT_FILTERS} onChange={() => {}} />;
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  optionLabels?: Record<string, string>;
  /** Text of the "no filter" option, or null to leave it out. */
  allLabel?: string | null;
  onChange: (value: string) => void;
}

function FilterSelect({
  label,
  value,
  options,
  optionLabels,
  allLabel = "All",
  onChange,
}: FilterSelectProps) {
  return (
    <label className="block">
      <span className="meta mb-1 block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field min-h-10 w-auto min-w-[8.5rem] py-1.5 pr-8 text-[0.9375rem]"
      >
        {allLabel !== null && <option value="">{allLabel}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

interface ViewButtonProps {
  current: TripFilters["view"];
  view: TripFilters["view"];
  label: string;
  onChange: (changes: Partial<TripFilters>) => void;
}

function ViewButton({ current, view, label, onChange }: ViewButtonProps) {
  const pressed = current === view;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange({ view })}
      className={cn(
        "meta flex min-h-10 items-center gap-2 border px-3 transition-colors first:rounded-l last:-ml-px last:rounded-r",
        pressed
          ? "relative z-10 border-accent bg-accent text-on-accent"
          : "meta-ink border-rule hover:border-ink",
      )}
    >
      {/* A pictogram of the layout itself. */}
      <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden="true" fill="currentColor">
        {view === "grid" ? (
          <path d="M0 0h8v6H0zM10 0h4v6h-4zM0 8h4v6H0zM6 8h8v6H6z" />
        ) : (
          <path d="M0 1h14v2H0zM0 6h14v2H0zM0 11h14v2H0z" />
        )}
      </svg>
      {label}
    </button>
  );
}

function TripGrid({ items }: { items: TripListItem[] }) {
  return (
    <ul className="mt-10 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-20">
      {items.map((item, index) => {
        const pattern = GRID_PATTERN[index % GRID_PATTERN.length];
        return (
          <li key={item.id} className={pattern.span}>
            <Link href={item.href} className="group reveal block">
              <div className={cn("relative aspect-[4/3] overflow-hidden", pattern.shape)}>{item.cover}</div>
              <p className="meta mt-4 flex flex-wrap gap-x-3">
                <span>{item.numberLabel}</span>
                {item.dateLabel && <span>{item.dateLabel}</span>}
                <span>{item.countries.join(", ")}</span>
              </p>
              <h2
                className={cn(
                  "display mt-2 text-3xl transition-colors group-hover:text-accent",
                  pattern.title,
                )}
              >
                {item.title}
              </h2>
              {item.summary && <p className="mt-3 line-clamp-2 max-w-xl text-soft">{item.summary}</p>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Chronological list, set like an airport departures board. */
function TripBoard({ items }: { items: TripListItem[] }) {
  return (
    <div className="mt-8">
      <div className="board-head meta" aria-hidden="true">
        <span>Date</span>
        <span>Destination</span>
        <span>Country</span>
        <span className="text-right">From home</span>
        <span className="text-right">Photos</span>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className="board-row">
              <span className="meta order-2 md:order-none">{item.dateLabel ?? "Undated"}</span>
              <span className="board-title order-1 col-span-2 md:order-none md:col-span-1">{item.title}</span>
              <span className="meta meta-ink order-3 text-right md:order-none md:text-left">
                {item.countries.join(", ") || "—"}
              </span>
              <span className="meta hidden text-right md:block">{item.distanceLabel ?? "—"}</span>
              <span className="meta hidden text-right md:block">
                <span className="sr-only">Photos: </span>
                {item.photoCount || "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
