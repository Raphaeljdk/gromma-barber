export const AGENDA_TIME_ZONE = "America/Sao_Paulo";
export const REPURCHASE_MARKER = "[GROMMA:RECOMPRA]";
export type AgendaView = "day" | "week" | "month";
export type AgendaClientFilter = "" | "with-plan" | "without-plan" | "on-site";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: AGENDA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: AGENDA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function agendaDateKey(value: Date | string) {
  const parts = DATE_FORMATTER.formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function isAgendaDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00-03:00`);
  return Number.isFinite(date.getTime()) && agendaDateKey(date) === value;
}

export function agendaTime(value: Date | string) {
  return TIME_FORMATTER.format(new Date(value));
}

export function agendaMinutes(value: Date | string) {
  const [hours, minutes] = agendaTime(value).split(":").map(Number);
  return hours * 60 + minutes;
}

export function addAgendaDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return agendaDateKey(date);
}

export function agendaMonthDays(value: string) {
  const first = `${value.slice(0, 7)}-01`;
  const weekday = new Date(`${first}T12:00:00-03:00`).getUTCDay();
  const start = addAgendaDays(first, weekday === 0 ? -6 : 1 - weekday);
  return Array.from({ length: 42 }, (_, index) => addAgendaDays(start, index));
}

export function agendaHref(
  tenantCode: string,
  context: {
    agendaDate?: string;
    agendaView?: string;
    agendaProfessional?: string;
    agendaUnit?: string;
    agendaClient?: string;
    [key: string]: string | undefined;
  },
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(context))
    if (value) params.set(key, value);
  return `/erp/${encodeURIComponent(tenantCode)}/agenda?${params.toString()}`;
}

// Only agenda-owned parameters are accepted; return URLs can never leave this tenant.
export function agendaReturnHref(
  tenantCode: string,
  form: FormData,
  result: Record<string, string>,
) {
  const date = String(form.get("agendaDate") ?? "");
  const view = String(form.get("agendaView") ?? "day");
  const client = String(form.get("agendaClient") ?? "");
  return agendaHref(tenantCode, {
    agendaDate: isAgendaDate(date) ? date : agendaDateKey(new Date()),
    agendaView: ["day", "week", "month"].includes(view) ? view : "day",
    agendaUnit: String(form.get("agendaUnit") ?? "").slice(0, 80),
    agendaProfessional: String(form.get("agendaProfessional") ?? "").slice(
      0,
      80,
    ),
    agendaClient: ["with-plan", "without-plan", "on-site"].includes(client)
      ? client
      : "",
    ...result,
  });
}

export function appointmentNotes(notes: string | null | undefined) {
  return {
    repurchase: Boolean(notes?.includes(REPURCHASE_MARKER)),
    text: (notes ?? "").replaceAll(REPURCHASE_MARKER, "").trim(),
  };
}

export function encodeAppointmentNotes(notes: string, repurchase: boolean) {
  const plain = appointmentNotes(notes).text.slice(0, 300);
  return (
    [plain, repurchase ? REPURCHASE_MARKER : ""].filter(Boolean).join("\n") ||
    null
  );
}

export function appointmentSource(source: string) {
  if (source.includes("MOBILE"))
    return { icon: "mobile", label: "Agendado pelo celular" } as const;
  if (source.includes("DESKTOP"))
    return { icon: "desktop", label: "Agendado pelo computador" } as const;
  if (source === "WHATSAPP")
    return { icon: "message", label: "Agendado pelo WhatsApp" } as const;
  if (source === "TOTEM")
    return { icon: "store", label: "Agendado pelo totem" } as const;
  return { icon: "calendar", label: "Dispositivo não informado" } as const;
}

export function matchesAgendaClient(
  item: { hasPlan: boolean; status: string },
  filter: AgendaClientFilter,
) {
  if (filter === "with-plan") return item.hasPlan;
  if (filter === "without-plan") return !item.hasPlan;
  if (filter === "on-site")
    return ["CHECKED_IN", "IN_SERVICE"].includes(item.status);
  return true;
}

// Separate simultaneous cards (including canceled bookings) instead of hiding one behind another.
export function layoutAgendaAppointments<
  T extends { id: string; startsAt: string; endsAt: string | null },
>(
  items: T[],
  day: string,
  openMinutes: number,
  closeMinutes: number,
  slotMinutes: number,
) {
  const dayStart = new Date(`${day}T00:00:00-03:00`).getTime();
  const positioned = items
    .map((item) => {
      const start = (new Date(item.startsAt).getTime() - dayStart) / 60_000;
      const end = item.endsAt
        ? (new Date(item.endsAt).getTime() - dayStart) / 60_000
        : start + slotMinutes;
      return {
        item,
        start: Math.max(openMinutes, start),
        end: Math.min(closeMinutes, Math.max(start + 1, end)),
        track: 0,
        tracks: 1,
      };
    })
    .filter((item) => item.start < item.end)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let group: typeof positioned = [];
  let trackEnds: number[] = [];
  let groupEnd = -Infinity;
  const finish = () =>
    group.forEach((item) => {
      item.tracks = trackEnds.length;
    });
  for (const item of positioned) {
    if (item.start >= groupEnd) {
      finish();
      group = [];
      trackEnds = [];
      groupEnd = -Infinity;
    }
    let track = trackEnds.findIndex((end) => end <= item.start);
    if (track === -1) track = trackEnds.length;
    item.track = track;
    trackEnds[track] = item.end;
    groupEnd = Math.max(groupEnd, item.end);
    group.push(item);
  }
  finish();
  return positioned;
}
