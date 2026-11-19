/** Datas de aniversário calculadas no calendário local da barbearia (segunda a domingo). */
export function birthdayWeek(reference: Date, timeZone = "America/Sao_Paulo") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(reference);
  const part = (kind: string) => Number(parts.find(item => item.type === kind)?.value ?? 0);
  const day = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  const weekday = day.getUTCDay();
  day.setUTCDate(day.getUTCDate() - ((weekday + 6) % 7));
  const dates = Array.from({ length: 7 }, (_, i) => {
    const value = new Date(day);
    value.setUTCDate(day.getUTCDate() + i);
    return value.toISOString().slice(0, 10);
  });
  return {
    start: dates[0],
    end: dates[6],
    birthDays: new Set(dates.map(date => date.slice(5))),
  };
}

export function isBirthdayInCurrentWeek(
  birthDate: Date | null | undefined,
  reference: Date,
  timeZone = "America/Sao_Paulo",
) {
  if (!birthDate || !Number.isFinite(birthDate.getTime())) return false;
  return birthdayWeek(reference, timeZone).birthDays.has(birthDate.toISOString().slice(5, 10));
}
