function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export { formatDateISO };

export function getMonthsAndDays(fromISO: string) {
  const [year, month, day] = fromISO.split("-").map(Number);
  const from = new Date(year, month - 1, day);
  const now = new Date();
  let months =
    (now.getFullYear() - from.getFullYear()) * 12 +
    (now.getMonth() - from.getMonth());
  let days = now.getDate() - from.getDate();
  if (days < 0) {
    months -= 1;
    const daysInPrevMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
    ).getDate();
    days += daysInPrevMonth;
  }
  return { months, days };
}

export function getAge(birthISO: string) {
  const [year, month, day] = birthISO.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - year;
  const hadBirthdayThisYear =
    now.getMonth() + 1 > month ||
    (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

export function getMonthsaryOccurrences(
  anniversaryISO: string,
  monthsBack = 0,
  monthsForward = 18,
): string[] {
  const [year, month, day] = anniversaryISO.split("-").map(Number);
  const now = new Date();
  const monthsSinceAnniversary =
    (now.getFullYear() - year) * 12 + (now.getMonth() - (month - 1));
  const start = Math.max(0, monthsSinceAnniversary - monthsBack);
  const end = monthsSinceAnniversary + monthsForward;

  const dates: string[] = [];
  for (let i = start; i <= end; i++) {
    dates.push(formatDateISO(new Date(year, month - 1 + i, day)));
  }
  return dates;
}

export function getYearlyOccurrences(
  dateISO: string,
  yearsBack = 0,
  yearsForward = 2,
): string[] {
  const [origYear, month, day] = dateISO.split("-").map(Number);
  const currentYear = new Date().getFullYear();
  const dates: string[] = [];
  for (
    let year = currentYear - yearsBack;
    year <= currentYear + yearsForward;
    year++
  ) {
    if (year < origYear) continue;
    dates.push(formatDateISO(new Date(year, month - 1, day)));
  }
  return dates;
}

// For events with no fixed "start year" (custom recurring events) — just a
// "MM-DD" that repeats every year from startYear onward
export function getYearlyOccurrencesFromMonthDay(
  monthDay: string,
  startYear: number,
  yearsForward = 5,
): string[] {
  const [month, day] = monthDay.split("-").map(Number);
  const dates: string[] = [];
  for (let year = startYear; year <= startYear + yearsForward; year++) {
    dates.push(formatDateISO(new Date(year, month - 1, day)));
  }
  return dates;
}

// Picks the soonest date that is today or later from a list of occurrences
export function getNextOccurrence(occurrences: string[]): string | null {
  const today = formatDateISO(new Date());
  const future = occurrences.filter((d) => d >= today).sort();
  return future[0] ?? null;
}

export function daysUntil(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}
