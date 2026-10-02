import { APP_START_DATE } from "@/constants/date";
export { APP_START_DATE } from "@/constants/date";

// Single source for both calendars (main tab + cycle tab): theme, range
// bounds, and month math. Values are byte-identical to what calendar.tsx
// computed inline, so importing them changes nothing visually.
export const CALENDAR_THEME = {
  todayTextColor: "#e75480",
  arrowColor: "#e75480",
} as const;

export const TODAY_TEXT_COLOR = "#e75480";
export const SELECTED_DAY_COLOR = "rgba(231,84,128,0.15)";

export const FUTURE_RANGE_MONTHS = 60; // 5 years — matches the dateMath default window

export const [START_YEAR, START_MONTH] = APP_START_DATE.split("-").map(Number);

const endDate = new Date(
  START_YEAR,
  START_MONTH - 1 + FUTURE_RANGE_MONTHS,
  1,
);
export const END_YEAR = endDate.getFullYear();
export const END_MONTH_INDEX = endDate.getMonth(); // 0-indexed, matches monthIndex grids

// Whole months from the first of startMonth to the first of (year, month0).
// Used to derive scroll ranges from today so they stay correct as time
// passes instead of hardcoding month counts.
export function monthDiffMonths(
  startISO: string,
  year: number,
  month0: number,
): number {
  const [sy, sm] = startISO.split("-").map(Number);
  return (year - sy) * 12 + (month0 - (sm - 1));
}

// Local-midnight parse (same pattern as dateMath: no UTC shift).
export function parseLocalDate(dateISO: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Month title text shared by both calendar headers.
export const calendarHeaderTextStyle = {
  fontSize: 16,
  fontWeight: "700" as const,
  color: "#e75480",
  textAlign: "center" as const,
  paddingVertical: 8,
};

// One source of truth for cycle dots: the Cycle calendar, its legend,
// its panel markers, and the main calendar's read-only dots all read
// these, so they can't drift apart.
export const CYCLE_DOT = {
  period: "#d32f2f",
  predicted: "#f3a6a6",
  ovulation: "#ff9800",
  fertile: "#ffe066",
} as const;
