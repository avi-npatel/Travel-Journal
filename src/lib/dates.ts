import type { Trip } from "./types";

// Trip dates are plain calendar dates ("2026-03-14"), not moments in time, so
// they are parsed and formatted by hand. Going through `new Date()` would let
// the server's or the visitor's time zone shift them by a day.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface CalendarDate {
  year: number;
  month: number; // 1–12
  day: number;
}

function parse(value: string | null): CalendarDate | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

const monthYear = (d: CalendarDate) => `${MONTHS[d.month - 1]} ${d.year}`;
const dayMonth = (d: CalendarDate) => `${d.day} ${MONTHS[d.month - 1]}`;

type TripDates = Pick<Trip, "start_date" | "end_date" | "date_precision">;
type TripLength = TripDates & Pick<Trip, "duration_days">;

/**
 * "Mar 2026", "14 Mar 2026", "14–19 Mar 2026", "28 Feb – 4 Mar 2026",
 * "29 Dec 2025 – 3 Jan 2026". Returns null when the trip has no dates.
 */
export function formatTripDates(trip: TripDates): string | null {
  const start = parse(trip.start_date);
  const end = parse(trip.end_date);
  if (!start) return null;

  if (trip.date_precision === "month") {
    if (!end || (end.year === start.year && end.month === start.month)) return monthYear(start);
    if (end.year === start.year) return `${MONTHS[start.month - 1]} – ${monthYear(end)}`;
    return `${monthYear(start)} – ${monthYear(end)}`;
  }

  if (!end || trip.end_date === trip.start_date) return `${dayMonth(start)} ${start.year}`;
  if (end.year !== start.year) {
    return `${dayMonth(start)} ${start.year} – ${dayMonth(end)} ${end.year}`;
  }
  if (end.month !== start.month) return `${dayMonth(start)} – ${dayMonth(end)} ${end.year}`;
  return `${start.day}–${end.day} ${monthYear(end)}`;
}

export function tripYear(trip: Pick<Trip, "start_date">): number | null {
  return parse(trip.start_date)?.year ?? null;
}

/**
 * How many days the trip lasted: the recorded duration, or (for trips entered
 * with exact first and last days) the days between them. Null if unknown.
 */
export function tripLengthDays(trip: TripLength): number | null {
  if (trip.duration_days) return trip.duration_days;
  if (trip.date_precision !== "day" || !trip.start_date || !trip.end_date) return null;
  const ms = Date.parse(`${trip.end_date}T00:00:00Z`) - Date.parse(`${trip.start_date}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

export const formatDays = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

/** The local calendar date of a Date, as "YYYY-MM-DD". */
export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
