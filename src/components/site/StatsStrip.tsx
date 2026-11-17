import type { SiteStats } from "@/lib/stats";

const pad = (n: number) => String(n).padStart(2, "0");

/** Four running totals, all counted from the database (see lib/stats.ts). */
export function StatsStrip({ stats }: { stats: SiteStats }) {
  const items = [
    { label: "Countries visited", value: pad(stats.countries) },
    { label: "Continents", value: String(stats.continents), suffix: `/${stats.continentsTotal}` },
    { label: "Trips logged", value: pad(stats.trips) },
    { label: "Photographs", value: stats.photos.toLocaleString("en-US") },
  ];

  return (
    <dl className="grid grid-cols-2 border-y border-rule lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          // Hairlines between cells: a left rule on every cell that is not
          // first in its row, and a top rule on the second row on mobile.
          className={[
            "flex flex-col-reverse justify-end gap-3 px-4 py-7 sm:px-8 sm:py-10",
            index % 2 === 1 ? "border-l border-rule" : "",
            index === 2 ? "lg:border-l lg:border-rule" : "",
            index >= 2 ? "border-t border-rule lg:border-t-0" : "",
          ].join(" ")}
        >
          <dt className="meta">{item.label}</dt>
          <dd className="stat-number">
            {item.value}
            {item.suffix && (
              <span className="text-[0.45em] tracking-normal text-muted [text-shadow:none]">
                {item.suffix}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
