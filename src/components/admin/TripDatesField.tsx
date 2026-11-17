"use client";

export interface TripWhen {
  /** "YYYY-MM-01", or null when no month is set. */
  start_date: string | null;
  duration_days: number | null;
}

interface TripDatesFieldProps {
  value: TripWhen;
  onChange: (value: TripWhen) => void;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MAX_DURATION_DAYS = 366;

/**
 * When a trip happened: month, year, and how many days it lasted. All three
 * are optional. (Month and year are two plain controls rather than
 * <input type="month">, which Safari and Firefox show as a bare text box.)
 */
export function TripDatesField({ value, onChange }: TripDatesFieldProps) {
  const year = value.start_date?.slice(0, 4) ?? "";
  const month = value.start_date?.slice(5, 7) ?? "";

  function setMonthYear(nextYear: string, nextMonth: string) {
    if (!nextYear && !nextMonth) return onChange({ ...value, start_date: null });
    const filledYear = nextYear || String(new Date().getFullYear());
    onChange({ ...value, start_date: `${filledYear.padStart(4, "0")}-${nextMonth || "01"}-01` });
  }

  return (
    <fieldset>
      <legend className="label">When</legend>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <div>
          <label htmlFor="trip-month" className="hint mb-1 mt-0 block">
            Month
          </label>
          <select
            id="trip-month"
            className="field"
            value={month}
            onChange={(event) => setMonthYear(year, event.target.value)}
          >
            <option value="">—</option>
            {MONTHS.map((name, index) => (
              <option key={name} value={String(index + 1).padStart(2, "0")}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="trip-year" className="hint mb-1 mt-0 block">
            Year
          </label>
          <input
            id="trip-year"
            type="number"
            inputMode="numeric"
            className="field"
            placeholder="2026"
            min={1900}
            max={2100}
            value={year ? Number(year) : ""}
            onChange={(event) => setMonthYear(event.target.value.slice(0, 4), month)}
          />
        </div>
        <div>
          <label htmlFor="trip-days" className="hint mb-1 mt-0 block">
            Days
          </label>
          <input
            id="trip-days"
            type="number"
            inputMode="numeric"
            className="field"
            placeholder="7"
            min={1}
            max={MAX_DURATION_DAYS}
            value={value.duration_days ?? ""}
            onChange={(event) => {
              const days = Math.round(event.target.valueAsNumber);
              onChange({
                ...value,
                duration_days: Number.isFinite(days) && days >= 1 ? Math.min(days, MAX_DURATION_DAYS) : null,
              });
            }}
          />
        </div>
      </div>
      <p className="hint">How long the trip lasted, in days. Shown on the trip&rsquo;s boarding pass.</p>
    </fieldset>
  );
}
