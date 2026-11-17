"use client";

import type { DatePrecision } from "@/lib/types";

export interface TripDates {
  start_date: string | null;
  end_date: string | null;
  date_precision: DatePrecision;
}

interface TripDatesFieldProps {
  value: TripDates;
  onChange: (value: TripDates) => void;
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

/**
 * Start and end of a trip. Exact days by default; tick "month only" for a
 * trip remembered as "March 2025", which is then shown that way everywhere.
 */
export function TripDatesField({ value, onChange }: TripDatesFieldProps) {
  const monthOnly = value.date_precision === "month";

  function setPrecision(precision: DatePrecision) {
    // Month-only dates are stored as the first of the month.
    const firstOfMonth = (date: string | null) => (date ? `${date.slice(0, 7)}-01` : null);
    onChange(
      precision === "month"
        ? {
            date_precision: "month",
            start_date: firstOfMonth(value.start_date),
            end_date: firstOfMonth(value.end_date),
          }
        : { ...value, date_precision: "day" },
    );
  }

  return (
    <fieldset>
      <legend className="label">Dates</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {monthOnly ? (
          <>
            <MonthInput
              label="Start month"
              value={value.start_date}
              onChange={(start_date) => onChange({ ...value, start_date })}
            />
            <MonthInput
              label="End month (if different)"
              value={value.end_date}
              onChange={(end_date) => onChange({ ...value, end_date })}
            />
          </>
        ) : (
          <>
            <DayInput
              id="start-date"
              label="First day"
              value={value.start_date}
              onChange={(start_date) => onChange({ ...value, start_date })}
            />
            <DayInput
              id="end-date"
              label="Last day"
              value={value.end_date}
              min={value.start_date ?? undefined}
              onChange={(end_date) => onChange({ ...value, end_date })}
            />
          </>
        )}
      </div>
      <label className="mt-3 flex w-fit cursor-pointer items-center gap-2.5 text-sm text-soft">
        <input
          type="checkbox"
          className="size-4 accent-[var(--accent)]"
          checked={monthOnly}
          onChange={(event) => setPrecision(event.target.checked ? "month" : "day")}
        />
        I only know the month
      </label>
    </fieldset>
  );
}

interface DayInputProps {
  id: string;
  label: string;
  value: string | null;
  min?: string;
  onChange: (value: string | null) => void;
}

function DayInput({ id, label, value, min, onChange }: DayInputProps) {
  return (
    <div>
      <label htmlFor={id} className="hint mb-1 mt-0 block">
        {label}
      </label>
      <input
        id={id}
        type="date"
        className="field"
        value={value ?? ""}
        min={min}
        onChange={(event) => onChange(event.target.value || null)}
      />
    </div>
  );
}

interface MonthInputProps {
  label: string;
  /** "YYYY-MM-01" or null. */
  value: string | null;
  onChange: (value: string | null) => void;
}

/**
 * Month and year as two plain controls. (<input type="month"> would be
 * shorter, but Safari and Firefox on desktop show it as a bare text box.)
 */
function MonthInput({ label, value, onChange }: MonthInputProps) {
  const year = value?.slice(0, 4) ?? "";
  const month = value?.slice(5, 7) ?? "";

  function update(nextYear: string, nextMonth: string) {
    if (!nextYear && !nextMonth) return onChange(null);
    const filledYear = nextYear || String(new Date().getFullYear());
    onChange(`${filledYear.padStart(4, "0")}-${nextMonth || "01"}-01`);
  }

  return (
    <fieldset>
      <legend className="hint mb-1 mt-0">{label}</legend>
      <div className="flex gap-2">
        <select
          aria-label={`${label}: month`}
          className="field"
          value={month}
          onChange={(event) => update(year, event.target.value)}
        >
          <option value="">Month</option>
          {MONTHS.map((name, index) => (
            <option key={name} value={String(index + 1).padStart(2, "0")}>
              {name}
            </option>
          ))}
        </select>
        <input
          type="number"
          aria-label={`${label}: year`}
          className="field w-28"
          placeholder="Year"
          min={1900}
          max={2100}
          value={year ? Number(year) : ""}
          onChange={(event) => update(event.target.value.slice(0, 4), month)}
        />
      </div>
    </fieldset>
  );
}
