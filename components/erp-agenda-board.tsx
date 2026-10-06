import Link from "next/link";
import type { CSSProperties } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Users } from "lucide-react";
import type { OperationalSettings, WaitlistConfig } from "@/lib/erp-workspace";
import { resolveWaitlist } from "@/app/erp/[tenant]/module-actions";

type AppointmentCard = {
  id: string;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  customerName: string;
  barberId: string | null;
  barberName: string;
  serviceName: string;
  unitName: string;
};

type Professional = {
  id: string;
  name: string;
};

type Props = {
  tenantCode: string;
  selectedDate: string;
  view: "day" | "week" | "month";
  appointments: AppointmentCard[];
  professionals: Professional[];
  settings: OperationalSettings;
  waitlist: Array<WaitlistConfig & { serviceName: string }>;
};

const TIME_ZONE = "America/Sao_Paulo";

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function timeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { hour: Number(map.hour), minute: Number(map.minute) };
}

function readableDate(value: string, view: Props["view"]) {
  const date = new Date(`${value}T12:00:00-03:00`);
  const options: Intl.DateTimeFormatOptions =
    view === "month"
      ? { timeZone: TIME_ZONE, month: "long", year: "numeric" }
      : { timeZone: TIME_ZONE, weekday: "long", day: "2-digit", month: "long" };
  return new Intl.DateTimeFormat("pt-BR", options).format(date);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function addMonths(value: string, months: number) {
  const date = new Date(`${value.slice(0, 7)}-01T12:00:00-03:00`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return dateKey(date);
}

function mondayOf(value: string) {
  const date = new Date(`${value}T12:00:00-03:00`);
  const weekDay = date.getUTCDay();
  const distance = weekDay === 0 ? -6 : 1 - weekDay;
  date.setUTCDate(date.getUTCDate() + distance);
  return dateKey(date);
}

function monthCalendarDays(value: string) {
  const monthStart = new Date(`${value.slice(0, 7)}-01T12:00:00-03:00`);
  const calendarStart = new Date(monthStart);
  const startDay = monthStart.getUTCDay();
  calendarStart.setUTCDate(calendarStart.getUTCDate() - (startDay === 0 ? 6 : startDay - 1));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setUTCDate(date.getUTCDate() + index);
    return dateKey(date);
  });
}

function statusClass(status: string) {
  if (["COMPLETED", "CLOSED"].includes(status)) return "completed";
  if (["IN_SERVICE", "CHECKED_IN"].includes(status)) return "service";
  if (["CANCELED", "NO_SHOW"].includes(status)) return "canceled";
  if (status === "CONFIRMED") return "confirmed";
  return "scheduled";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    SCHEDULED: "Agendado",
    CONFIRMED: "Confirmado",
    CHECKED_IN: "Check-in",
    IN_SERVICE: "Em atendimento",
    COMPLETED: "Concluído",
    CANCELED: "Cancelado",
    NO_SHOW: "Não compareceu",
  };
  return labels[status] ?? status;
}

export function ErpAgendaBoard({
  tenantCode,
  selectedDate,
  view,
  appointments,
  professionals,
  settings,
  waitlist,
}: Props) {
  const base = `/erp/${encodeURIComponent(tenantCode)}/agenda`;
  const safeOpen = Math.max(0, Math.min(22, settings.openHour));
  const safeClose = Math.max(safeOpen + 1, Math.min(24, settings.closeHour));
  const slotMinutes = [15, 20, 30, 45, 60].includes(settings.slotMinutes)
    ? settings.slotMinutes
    : 30;
  const totalSlots = Math.ceil(((safeClose - safeOpen) * 60) / slotMinutes);
  const selectedAppointments = appointments.filter(
    (appointment) => dateKey(appointment.startsAt) === selectedDate,
  );

  const scheduled = selectedAppointments.filter((item) =>
    ["SCHEDULED", "CONFIRMED"].includes(item.status),
  ).length;
  const inService = selectedAppointments.filter((item) =>
    ["CHECKED_IN", "IN_SERVICE"].includes(item.status),
  ).length;
  const completed = selectedAppointments.filter((item) => item.status === "COMPLETED").length;

  const availableSlots = professionals.flatMap((professional) => {
    const busy = selectedAppointments.filter(
      (appointment) =>
        appointment.barberId === professional.id &&
        !["CANCELED", "NO_SHOW"].includes(appointment.status),
    );

    return Array.from({ length: totalSlots }, (_, index) => {
      const startMinutes = safeOpen * 60 + index * slotMinutes;
      const endMinutes = startMinutes + slotMinutes;
      const occupied = busy.some((appointment) => {
        const start = timeParts(appointment.startsAt);
        const end = appointment.endsAt ? timeParts(appointment.endsAt) : start;
        const busyStart = start.hour * 60 + start.minute;
        const busyEnd = appointment.endsAt
          ? end.hour * 60 + end.minute
          : busyStart + slotMinutes;
        return startMinutes < busyEnd && endMinutes > busyStart;
      });

      if (occupied) return null;
      const hour = Math.floor(startMinutes / 60).toString().padStart(2, "0");
      const minute = (startMinutes % 60).toString().padStart(2, "0");
      return { professional: professional.name, time: `${hour}:${minute}` };
    }).filter(Boolean);
  }).filter(Boolean) as Array<{ professional: string; time: string }>;

  const weekStart = mondayOf(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthDays = monthCalendarDays(selectedDate);
  const activeMonth = selectedDate.slice(0, 7);
  const periodStep = view === "month" ? 0 : view === "week" ? 7 : 1;
  const previousDate = view === "month" ? addMonths(selectedDate, -1) : addDays(selectedDate, -periodStep);
  const nextDate = view === "month" ? addMonths(selectedDate, 1) : addDays(selectedDate, periodStep);

  return (
    <div className="agenda-workspace">
      <div className="agenda-toolbar">
        <div className="agenda-period-controls">
          <Link href={`${base}?agendaDate=${previousDate}&agendaView=${view}`} aria-label="Período anterior">
            <ChevronLeft size={16} />
          </Link>
          <Link className="agenda-today" href={`${base}?agendaDate=${dateKey(new Date())}&agendaView=${view}`}>Hoje</Link>
          <Link href={`${base}?agendaDate=${nextDate}&agendaView=${view}`} aria-label="Próximo período">
            <ChevronRight size={16} />
          </Link>
          <strong>{readableDate(selectedDate, view)}</strong>
        </div>
        <div className="agenda-view-switch">
          <Link className={view === "day" ? "active" : ""} href={`${base}?agendaDate=${selectedDate}&agendaView=day`}>Dia</Link>
          <Link className={view === "week" ? "active" : ""} href={`${base}?agendaDate=${selectedDate}&agendaView=week`}>Semana</Link>
          <Link className={view === "month" ? "active" : ""} href={`${base}?agendaDate=${selectedDate}&agendaView=month`}>Mês</Link>
        </div>
      </div>

      <div className="agenda-summary-grid">
        <article><CalendarDays size={17} /><div><span>Agendados no dia</span><strong>{scheduled}</strong></div></article>
        <article><Clock3 size={17} /><div><span>Em atendimento</span><strong>{inService}</strong></div></article>
        <article><Users size={17} /><div><span>Concluídos</span><strong>{completed}</strong></div></article>
        <article><Clock3 size={17} /><div><span>Horários livres</span><strong>{availableSlots.length}</strong></div></article>
      </div>

      {view === "day" ? (
        <div className="agenda-day-layout">
          <div className="agenda-calendar-shell">
            <div
              className="agenda-professional-grid"
              style={{ "--agenda-columns": Math.max(1, professionals.length) } as CSSProperties}
            >
              <div className="agenda-time-header">Horário</div>
              {professionals.length ? professionals.map((professional) => (
                <div className="agenda-professional-head" key={professional.id}>
                  <span>{professional.name.slice(0, 1).toUpperCase()}</span>
                  <div><strong>{professional.name}</strong><small>Agenda do dia</small></div>
                </div>
              )) : <div className="agenda-professional-head"><div><strong>Equipe</strong><small>Cadastre profissionais</small></div></div>}

              {Array.from({ length: totalSlots + 1 }, (_, index) => {
                const minutes = safeOpen * 60 + index * slotMinutes;
                const hour = Math.floor(minutes / 60).toString().padStart(2, "0");
                const minute = (minutes % 60).toString().padStart(2, "0");
                return (
                  <div
                    className="agenda-time-label"
                    key={minutes}
                    style={{ gridRow: index + 2, gridColumn: 1 }}
                  >
                    {hour}:{minute}
                  </div>
                );
              })}

              {professionals.map((professional, professionalIndex) =>
                selectedAppointments
                  .filter((appointment) => appointment.barberId === professional.id)
                  .map((appointment) => {
                    const start = timeParts(appointment.startsAt);
                    const startMinutes = start.hour * 60 + start.minute;
                    const end = appointment.endsAt ? timeParts(appointment.endsAt) : null;
                    const endMinutes = end
                      ? end.hour * 60 + end.minute
                      : startMinutes + slotMinutes;
                    const row = Math.max(
                      2,
                      Math.floor((startMinutes - safeOpen * 60) / slotMinutes) + 2,
                    );
                    const span = Math.max(1, Math.ceil((endMinutes - startMinutes) / slotMinutes));

                    return (
                      <article
                        className={`agenda-appointment ${statusClass(appointment.status)}`}
                        key={appointment.id}
                        style={{
                          gridColumn: professionalIndex + 2,
                          gridRow: `${row} / span ${span}`,
                        }}
                      >
                        <span>{new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(appointment.startsAt)}</span>
                        <strong>{appointment.customerName}</strong>
                        <small>{appointment.serviceName}</small>
                        <i>{statusLabel(appointment.status)}</i>
                      </article>
                    );
                  }),
              )}
            </div>
          </div>

          <aside className="agenda-side-panel">
            <div className="agenda-side-card">
              <div className="agenda-side-head"><span>Próximos horários livres</span><strong>{availableSlots.length}</strong></div>
              <div className="agenda-free-slots">
                {availableSlots.slice(0, 12).map((slot, index) => (
                  <div key={`${slot.professional}-${slot.time}-${index}`}>
                    <strong>{slot.time}</strong><span>{slot.professional}</span>
                  </div>
                ))}
                {!availableSlots.length && <small>Sem horários livres no período configurado.</small>}
              </div>
            </div>
            <div className="agenda-side-card">
              <div className="agenda-side-head"><span>Lista de espera</span><strong>{waitlist.length}</strong></div>
              <div className="agenda-waitlist">
                {waitlist.slice(0, 8).map((item) => (
                  <div className="agenda-waitlist-item" key={item.id}>
                    <div>
                      <strong>{item.customerName}</strong>
                      <span>{item.requestedDate} · {item.serviceName}</span>
                      {item.phone && <small>{item.phone}</small>}
                    </div>
                    <form action={resolveWaitlist}>
                      <input type="hidden" name="tenantCode" value={tenantCode} />
                      <input type="hidden" name="waitlistId" value={item.id} />
                      <button type="submit">Concluir</button>
                    </form>
                  </div>
                ))}
                {!waitlist.length && <small>Ninguém aguardando encaixe.</small>}
              </div>
            </div>
          </aside>
        </div>
      ) : view === "week" ? (
        <div className="agenda-week-grid">
          {weekDays.map((day) => {
            const dayAppointments = appointments.filter(
              (appointment) => dateKey(appointment.startsAt) === day,
            );
            return (
              <article className={day === selectedDate ? "active" : ""} key={day}>
                <header>
                  <strong>{new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, weekday: "short" }).format(new Date(`${day}T12:00:00-03:00`))}</strong>
                  <span>{day.slice(-2)}</span>
                </header>
                <div>
                  {dayAppointments.slice(0, 8).map((appointment) => (
                    <Link
                      className={`agenda-week-item ${statusClass(appointment.status)}`}
                      href={`${base}?agendaDate=${day}&agendaView=day`}
                      key={appointment.id}
                    >
                      <span>{new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(appointment.startsAt)}</span>
                      <strong>{appointment.customerName}</strong>
                      <small>{appointment.barberName}</small>
                    </Link>
                  ))}
                  {!dayAppointments.length && <small className="agenda-week-empty">Sem agendamentos</small>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="agenda-month">
          <div className="agenda-month-weekdays">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="agenda-month-grid">
            {monthDays.map((day) => {
              const dayAppointments = appointments.filter(
                (appointment) => dateKey(appointment.startsAt) === day,
              );
              const outside = day.slice(0, 7) !== activeMonth;
              return (
                <article className={[outside ? "outside" : "", day === selectedDate ? "active" : ""].join(" ")} key={day}>
                  <Link className="agenda-month-day" href={`${base}?agendaDate=${day}&agendaView=day`}>
                    <span>{day.slice(-2)}</span>
                    <small>{dayAppointments.length} agenda{dayAppointments.length === 1 ? "" : "s"}</small>
                  </Link>
                  <div>
                    {dayAppointments.slice(0, 4).map((appointment) => (
                      <Link
                        className={`agenda-month-item ${statusClass(appointment.status)}`}
                        href={`${base}?agendaDate=${day}&agendaView=day`}
                        key={appointment.id}
                      >
                        <span>{new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(appointment.startsAt)}</span>
                        <strong>{appointment.customerName}</strong>
                      </Link>
                    ))}
                    {dayAppointments.length > 4 && <small className="agenda-month-more">+ {dayAppointments.length - 4} atendimento(s)</small>}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
