const CA_DAYS = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'];
const CA_DAYS_SHORT = ['dg.', 'dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.'];
const CA_MONTHS = [
  "gener", "febrer", "març", "abril", "maig", "juny",
  "juliol", "agost", "setembre", "octubre", "novembre", "desembre"
];
// 3-letter abbreviations except "maig" (May) — kept full to avoid clashing
// with the Catalan word "mai" ("never").
const CA_MONTHS_SHORT = [
  "gen", "feb", "mar", "abr", "maig", "jun",
  "jul", "ago", "set", "oct", "nov", "des"
];

export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateCa(dateStr: string): { dayName: string; dayNum: number; monthName: string; year: number } {
  const d = parseDateStr(dateStr);
  return {
    dayName: CA_DAYS[d.getDay()],
    dayNum: d.getDate(),
    monthName: CA_MONTHS[d.getMonth()],
    year: d.getFullYear(),
  };
}

export function formatDateLong(dateStr: string): string {
  const { dayName, dayNum, monthName } = formatDateCa(dateStr);
  return `${dayName}, ${dayNum} de ${monthName}`;
}

export function formatDateShort(dateStr: string): string {
  const { dayNum, monthName } = formatDateCa(dateStr);
  return `${dayNum} de ${monthName}`;
}

export function formatDateChip(dateStr: string): string {
  const today = toDateStr(new Date());
  if (dateStr === today) {
    const { dayName, dayNum, monthName } = formatDateCa(dateStr);
    const dayShort = CA_DAYS_SHORT[parseDateStr(dateStr).getDay()];
    return `Avui · ${dayShort} ${dayNum} ${CA_MONTHS_SHORT[parseDateStr(dateStr).getMonth()]}`;
  }
  const { dayName, dayNum, monthName } = formatDateCa(dateStr);
  const dayShort = CA_DAYS_SHORT[parseDateStr(dateStr).getDay()];
  return `${dayShort} ${dayNum} ${CA_MONTHS_SHORT[parseDateStr(dateStr).getMonth()]}`;
}

export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function isToday(dateStr: string): boolean {
  return dateStr === toDateStr(new Date());
}

export function formatVisitDate(dateStr: string): string {
  const { dayNum, monthName, year } = formatDateCa(dateStr);
  return `${dayNum} ${CA_MONTHS_SHORT[parseDateStr(dateStr).getMonth()]} ${year}`;
}

export function formatTimeAgo(minutesAgo: number): string {
  if (minutesAgo < 60) return `fa ${minutesAgo} min`;
  const hours = Math.floor(minutesAgo / 60);
  return `fa ${hours} h`;
}

export function getDayHeaderLabel(dateStr: string): string {
  const { dayName, dayNum, monthName } = formatDateCa(dateStr);
  const today = toDateStr(new Date());
  const label = isToday(dateStr) ? 'Avui · ' : '';
  return `${label}${dayName}`;
}

export function getDaySubLabel(dateStr: string): string {
  const { dayNum, monthName } = formatDateCa(dateStr);
  return `${dayNum} de ${monthName}`;
}
