"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState, type CSSProperties } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Users,
  Plus,
  ListOrdered,
  PanelRight,
  Smartphone,
  Monitor,
  Cake,
  Sparkles,
  ShoppingBag,
  Crown,
  UserRound,
  MapPin,
  MessageCircle,
  Store,
  X,
} from "lucide-react";
import type { OperationalSettings, WaitlistConfig } from "@/lib/erp-workspace";
import { resolveWaitlist } from "@/app/erp/[tenant]/module-actions";
import {
  updateAppointmentNotes,
  updateAppointmentStatus,
} from "@/app/erp/[tenant]/actions";
import {
  AGENDA_TIME_ZONE,
  addAgendaDays,
  agendaDateKey,
  agendaHref,
  agendaMinutes,
  agendaMonthDays,
  agendaTime,
  appointmentNotes,
  appointmentSource,
  isAgendaDate,
  layoutAgendaAppointments,
  matchesAgendaClient,
  type AgendaClientFilter,
  type AgendaView,
} from "@/lib/agenda";
import type {
  AgendaAppointment,
  AgendaContext,
  AgendaCustomer,
  AgendaDraft,
  AgendaProfessional,
  AgendaService,
  AgendaUnit,
} from "@/lib/agenda-types";
import { AgendaDialog, AgendaSubmit } from "./agenda-dialog";
import {
  AgendaAppointmentForm,
  AgendaContextFields,
  AgendaWaitlistForm,
} from "./agenda-forms";

type Props = {
  tenantCode: string;
  selectedDate: string;
  view: AgendaView;
  appointments: AgendaAppointment[];
  professionals: AgendaProfessional[];
  units: AgendaUnit[];
  customers: AgendaCustomer[];
  services: AgendaService[];
  selectedProfessionalId?: string;
  selectedUnitId?: string;
  selectedClientFilter: AgendaClientFilter;
  settings: OperationalSettings;
  waitlist: Array<WaitlistConfig & { serviceName: string }>;
  canOperate: boolean;
  initialDraft?: AgendaDraft;
  initialAppointmentId?: string;
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  CHECKED_IN: "No local",
  IN_SERVICE: "Em atendimento",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Não compareceu",
};
const NEXT_ACTION: Record<string, { action: string; label: string }> = {
  SCHEDULED: { action: "confirm", label: "Confirmar agendamento" },
  CONFIRMED: { action: "checkin", label: "Cliente chegou" },
  CHECKED_IN: { action: "start", label: "Iniciar atendimento" },
  IN_SERVICE: { action: "complete", label: "Concluir atendimento" },
};
const SLOT_HEIGHT = 84;
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: AGENDA_TIME_ZONE,
    ...options,
  }).format(new Date(`${value}T12:00:00-03:00`));
const timeLabel = (minutes: number) =>
  `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;

function statusClass(status: string) {
  if (status === "COMPLETED") return "completed";
  if (status === "CHECKED_IN") return "checked-in";
  if (status === "IN_SERVICE") return "service";
  if (status === "CANCELED") return "canceled";
  if (status === "NO_SHOW") return "no-show";
  return status === "CONFIRMED" ? "confirmed" : "scheduled";
}

const SOURCE_ICONS = {
  mobile: Smartphone,
  desktop: Monitor,
  message: MessageCircle,
  store: Store,
  calendar: CalendarDays,
};
function AppointmentSignals({
  appointment,
  expanded = false,
}: {
  appointment: AgendaAppointment;
  expanded?: boolean;
}) {
  const source = appointmentSource(appointment.source);
  const SourceIcon = SOURCE_ICONS[source.icon];
  const flags = [
    { icon: SourceIcon, label: source.label },
    ...(appointment.firstVisit
      ? [{ icon: Sparkles, label: "Primeira visita" }]
      : []),
    ...(appointment.birthday
      ? [{ icon: Cake, label: "Aniversariante do dia" }]
      : []),
    ...(appointmentNotes(appointment.notes).repurchase
      ? [{ icon: ShoppingBag, label: "Item para recompra" }]
      : []),
    {
      icon: appointment.hasPlan ? Crown : UserRound,
      label: appointment.hasPlan
        ? `Com plano${appointment.planName ? ` · ${appointment.planName}` : ""}`
        : "Sem plano",
    },
    ...(["CHECKED_IN", "IN_SERVICE"].includes(appointment.status)
      ? [{ icon: MapPin, label: "Cliente no local" }]
      : []),
  ];
  return (
    <span className={`agenda-signals${expanded ? " expanded" : ""}`}>
      {flags.map(({ icon: Icon, label }) => (
        <span key={label} title={label} aria-label={label}>
          <Icon size={13} aria-hidden="true" />
          {expanded && <span>{label}</span>}
        </span>
      ))}
    </span>
  );
}

function AgendaLegend() {
  const signals = [
    { icon: Smartphone, label: "Agendado pelo celular" },
    { icon: Monitor, label: "Agendado pelo computador" },
    { icon: MessageCircle, label: "Agendado pelo WhatsApp" },
    { icon: CalendarDays, label: "Dispositivo não informado" },
    { icon: Store, label: "Agendado pelo totem" },
    { icon: Sparkles, label: "Primeira visita" },
    { icon: Cake, label: "Aniversariante do dia" },
    { icon: ShoppingBag, label: "Item para recompra" },
    { icon: Crown, label: "Com plano" },
    { icon: UserRound, label: "Sem plano" },
    { icon: MapPin, label: "Cliente no local" },
  ];
  return (
    <section className="agenda-side-card">
      <div className="agenda-side-head">
        <span>Legendas dos agendamentos</span>
      </div>
      <div className="agenda-information-legend">
        {signals.map(({ icon: Icon, label }) => (
          <span key={label}>
            <Icon size={15} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
      <div className="agenda-status-legend">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <span key={status}>
            <i className={statusClass(status)} />
            {label}
          </span>
        ))}
      </div>
      <p className="agenda-form-hint">
        A recompra é marcada na ficha. A primeira visita considera o histórico
        de atendimentos concluídos.
      </p>
    </section>
  );
}

export function ErpAgendaBoard({
  tenantCode,
  selectedDate,
  view,
  appointments,
  professionals,
  units,
  customers,
  services,
  selectedProfessionalId = "",
  selectedUnitId = "",
  selectedClientFilter,
  settings,
  waitlist,
  canOperate,
  initialDraft,
  initialAppointmentId,
}: Props) {
  const router = useRouter();
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState<AgendaDraft | null>(
    canOperate ? (initialDraft ?? null) : null,
  );
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [detail, setDetail] = useState<AgendaAppointment | null>(
    () => appointments.find((item) => item.id === initialAppointmentId) ?? null,
  );
  const context: AgendaContext = {
    tenantCode,
    agendaDate: selectedDate,
    agendaView: view,
    agendaProfessional: selectedProfessionalId,
    agendaUnit: selectedUnitId,
    agendaClient: selectedClientFilter,
  };
  const href = (changes: Record<string, string> = {}) =>
    agendaHref(tenantCode, {
      agendaDate: selectedDate,
      agendaView: view,
      agendaProfessional: selectedProfessionalId,
      agendaUnit: selectedUnitId,
      agendaClient: selectedClientFilter,
      ...changes,
    });
  const slotMinutes = [15, 20, 30, 45, 60].includes(settings.slotMinutes)
    ? settings.slotMinutes
    : 30;
  const openHour = Number.isFinite(settings.openHour)
    ? Math.max(0, Math.min(22, settings.openHour))
    : 8;
  const closeHour = Number.isFinite(settings.closeHour)
    ? Math.max(openHour + 1, Math.min(24, settings.closeHour))
    : 20;
  const unitAppointments = appointments.filter(
    (item) =>
      (!selectedUnitId || item.unitId === selectedUnitId) &&
      (!selectedProfessionalId ||
        (selectedProfessionalId === "unassigned"
          ? !item.barberId
          : item.barberId === selectedProfessionalId)),
  );
  const dayAppointments = unitAppointments.filter(
    (item) => agendaDateKey(item.startsAt) === selectedDate,
  );
  const displayedAppointments = unitAppointments.filter((item) =>
    matchesAgendaClient(item, selectedClientFilter),
  );
  const displayedDayAppointments = displayedAppointments.filter(
    (item) => agendaDateKey(item.startsAt) === selectedDate,
  );
  const activeProfessionals = professionals.filter(
    (person) =>
      (!selectedUnitId || !person.unitId || person.unitId === selectedUnitId) &&
      (!selectedProfessionalId || person.id === selectedProfessionalId),
  );
  const columns = activeProfessionals.map((person) => ({
    ...person,
    canSchedule: true,
  }));
  for (const item of unitAppointments) {
    if (item.barberId && !columns.some((person) => person.id === item.barberId))
      columns.push({
        id: item.barberId,
        name: item.barberName,
        unitId: item.unitId,
        canSchedule: false,
      });
  }
  if (!selectedProfessionalId || selectedProfessionalId === "unassigned")
    columns.push({
      id: "unassigned",
      name: "Sem preferência",
      unitId: null,
      canSchedule: true,
    });

  // Keep all booked times visible, even if business hours changed after a booking.
  const openMinutes = Math.min(
    openHour * 60,
    ...dayAppointments.map(
      (item) => Math.floor(agendaMinutes(item.startsAt) / 60) * 60,
    ),
  );
  const closeMinutes = Math.min(
    1440,
    Math.max(
      closeHour * 60,
      ...dayAppointments.map((item) =>
        item.endsAt && agendaDateKey(item.endsAt) !== selectedDate
          ? 1440
          : Math.ceil(
              (item.endsAt
                ? agendaMinutes(item.endsAt)
                : agendaMinutes(item.startsAt) + slotMinutes) / 60,
            ) * 60,
      ),
    ),
  );
  const totalSlots = Math.ceil((closeMinutes - openMinutes) / slotMinutes);
  const calendarHeight =
    ((closeMinutes - openMinutes) / slotMinutes) * SLOT_HEIGHT;
  const availableSlots = activeProfessionals
    .flatMap((person) =>
      Array.from(
        { length: Math.ceil(((closeHour - openHour) * 60) / slotMinutes) },
        (_, index) => {
          const minutes = openHour * 60 + index * slotMinutes;
          if (minutes + slotMinutes > closeHour * 60) return null;
          const start = new Date(
            `${selectedDate}T${timeLabel(minutes)}:00-03:00`,
          ).getTime();
          // A professional cannot be offered twice, including bookings at another unit.
          const occupied = appointments.some(
            (item) =>
              item.barberId === person.id &&
              !["CANCELED", "NO_SHOW"].includes(item.status) &&
              new Date(item.startsAt).getTime() <
                start + slotMinutes * 60_000 &&
              (item.endsAt
                ? new Date(item.endsAt).getTime()
                : new Date(item.startsAt).getTime() + slotMinutes * 60_000) >
                start,
          );
          return occupied
            ? null
            : {
                professionalId: person.id,
                professional: person.name,
                time: timeLabel(minutes),
                unitId: selectedUnitId || person.unitId || "",
              };
        },
      ).filter((slot) => slot !== null),
    )
    .sort(
      (a, b) =>
        a.time.localeCompare(b.time) ||
        a.professional.localeCompare(b.professional),
    );
  const capacity =
    activeProfessionals.length *
    Math.floor(((closeHour - openHour) * 60) / slotMinutes);
  const activeDay = dayAppointments.filter(
    (item) => !["CANCELED", "NO_SHOW"].includes(item.status),
  );
  const countCustomers = (items: AgendaAppointment[]) =>
    new Set(items.map((item) => item.customerId || item.id)).size;
  const summaries = [
    {
      icon: CalendarDays,
      label: "Agendados",
      value: dayAppointments.filter((item) =>
        ["SCHEDULED", "CONFIRMED"].includes(item.status),
      ).length,
    },
    {
      icon: Clock3,
      label: "Em atendimento",
      value: dayAppointments.filter((item) => item.status === "IN_SERVICE")
        .length,
    },
    {
      icon: Users,
      label: "Concluídos",
      value: dayAppointments.filter((item) => item.status === "COMPLETED")
        .length,
    },
    { icon: Clock3, label: "Horários livres", value: availableSlots.length },
    {
      icon: Users,
      label: "Ocupação",
      value: `${capacity ? Math.round(((capacity - availableSlots.length) / capacity) * 100) : 0}%`,
    },
    {
      icon: UserRound,
      label: "Clientes sem plano",
      value: countCustomers(activeDay.filter((item) => !item.hasPlan)),
      filter: "without-plan",
    },
    {
      icon: Crown,
      label: "Clientes com plano",
      value: countCustomers(activeDay.filter((item) => item.hasPlan)),
      filter: "with-plan",
    },
    {
      icon: MapPin,
      label: "No local",
      value: countCustomers(
        activeDay.filter((item) =>
          ["CHECKED_IN", "IN_SERVICE"].includes(item.status),
        ),
      ),
      filter: "on-site",
    },
  ];
  const visibleWaitlist = waitlist.filter(
    (item) =>
      (!selectedUnitId || !item.unitId || item.unitId === selectedUnitId) &&
      (!selectedProfessionalId ||
        (selectedProfessionalId === "unassigned"
          ? !item.barberId
          : !item.barberId || item.barberId === selectedProfessionalId)),
  );
  const weekday = new Date(`${selectedDate}T12:00:00-03:00`).getUTCDay();
  const weekStart = addAgendaDays(
    selectedDate,
    weekday === 0 ? -6 : 1 - weekday,
  );
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addAgendaDays(weekStart, index),
  );
  const monthDays = agendaMonthDays(selectedDate);
  const moveMonth = (amount: number) => {
    const date = new Date(`${selectedDate.slice(0, 7)}-01T12:00:00-03:00`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    return agendaDateKey(date);
  };
  const previousDate =
    view === "month"
      ? moveMonth(-1)
      : addAgendaDays(selectedDate, view === "week" ? -7 : -1);
  const nextDate =
    view === "month"
      ? moveMonth(1)
      : addAgendaDays(selectedDate, view === "week" ? 7 : 1);
  const newAppointment = (
    startsAt = `${selectedDate}T${timeLabel(openHour * 60)}`,
    barberId = selectedProfessionalId,
    unitId = selectedUnitId,
  ) => {
    if (canOperate)
      setDraft({
        startsAt,
        barberId: barberId === "unassigned" ? "" : barberId,
        unitId: unitId || (units.length === 1 ? units[0].id : ""),
      });
  };
  const activeUnit =
    units.find((unit) => unit.id === selectedUnitId)?.name ??
    "Todas as unidades";
  const detailNotes = detail ? appointmentNotes(detail.notes).text : "";

  return (
    <div className="agenda-workspace agenda-interactive">
      <div className="agenda-top-actions">
        <div>
          <span className="agenda-unit-caption">
            <Store size={15} />
            {activeUnit}
          </span>
          <p>
            Selecione um horário livre para agendar ou um cartão para abrir a
            ficha.
          </p>
        </div>
        <div className="agenda-action-buttons">
          {canOperate && (
            <>
              <button
                className="btn secondary"
                type="button"
                onClick={() => setWaitlistOpen(true)}
              >
                <ListOrdered size={16} />
                Fila de espera
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => newAppointment()}
              >
                <Plus size={16} />
                Novo agendamento
              </button>
            </>
          )}
          <button
            type="button"
            className={`btn secondary agenda-panel-toggle${panelOpen ? " active" : ""}`}
            aria-controls="agenda-information-panel"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen(!panelOpen)}
          >
            <PanelRight size={17} />
            Unidades e informações
          </button>
        </div>
      </div>
      <div className="agenda-toolbar">
        <div className="agenda-period-controls">
          <Link
            prefetch={false}
            href={href({ agendaDate: previousDate })}
            aria-label="Período anterior"
          >
            <ChevronLeft size={16} />
          </Link>
          <Link
            prefetch={false}
            className="agenda-today"
            href={href({ agendaDate: agendaDateKey(new Date()) })}
          >
            Hoje
          </Link>
          <label className="agenda-date-picker">
            <CalendarDays size={17} aria-hidden="true" />
            <span className="agenda-sr-only">Ir para uma data</span>
            <input
              aria-label="Ir para uma data"
              type="date"
              value={selectedDate}
              onChange={(event) => {
                if (isAgendaDate(event.target.value))
                  router.push(href({ agendaDate: event.target.value }), {
                    scroll: false,
                  });
              }}
            />
          </label>
          <Link
            prefetch={false}
            href={href({ agendaDate: nextDate })}
            aria-label="Próximo período"
          >
            <ChevronRight size={16} />
          </Link>
          <strong>
            {dateLabel(
              selectedDate,
              view === "month"
                ? { month: "long", year: "numeric" }
                : {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  },
            )}
          </strong>
        </div>
        <div className="agenda-view-switch" aria-label="Visualização da agenda">
          {(
            [
              ["day", "Dia"],
              ["week", "Semana"],
              ["month", "Mês"],
            ] as const
          ).map(([mode, label]) => (
            <Link
              prefetch={false}
              key={mode}
              className={view === mode ? "active" : ""}
              aria-current={view === mode ? "page" : undefined}
              href={href({ agendaView: mode })}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <div className="agenda-summary-caption">
        Indicadores de{" "}
        {dateLabel(selectedDate, { day: "2-digit", month: "2-digit" })}
      </div>
      <div className="agenda-summary-grid">
        {summaries.map(({ icon: Icon, label, value, filter }) => (
          <article
            className={
              filter && selectedClientFilter === filter ? "selected" : ""
            }
            key={label}
          >
            {filter ? (
              <Link
                prefetch={false}
                href={href({
                  agendaClient: selectedClientFilter === filter ? "" : filter,
                })}
                aria-label={`${label}: ${value}. ${selectedClientFilter === filter ? "Remover" : "Aplicar"} filtro`}
              >
                <Icon size={18} />
                <span>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </span>
              </Link>
            ) : (
              <>
                <Icon size={18} />
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
      <div className="agenda-active-filters">
        <label>
          <span>Profissional</span>
          <select
            value={selectedProfessionalId}
            onChange={(event) =>
              router.push(href({ agendaProfessional: event.target.value }), {
                scroll: false,
              })
            }
          >
            <option value="">Todos os profissionais</option>
            <option value="unassigned">Sem preferência</option>
            {professionals
              .filter(
                (person) =>
                  !selectedUnitId ||
                  !person.unitId ||
                  person.unitId === selectedUnitId,
              )
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
          </select>
        </label>
        {selectedClientFilter && (
          <Link
            prefetch={false}
            className="agenda-filter-chip"
            href={href({ agendaClient: "" })}
          >
            {selectedClientFilter === "with-plan"
              ? "Com plano"
              : selectedClientFilter === "without-plan"
                ? "Sem plano"
                : "No local"}
            <X size={14} />
            <span className="agenda-sr-only">Remover filtro</span>
          </Link>
        )}
        {(selectedProfessionalId || selectedUnitId) && (
          <Link
            prefetch={false}
            href={href({
              agendaUnit: "",
              agendaProfessional: "",
              agendaClient: "",
            })}
          >
            Limpar filtros
          </Link>
        )}
      </div>
      <div className={`agenda-main-layout${panelOpen ? " with-panel" : ""}`}>
        <div className="agenda-main-calendar">
          {view === "day" ? (
            <div
              className="agenda-calendar-shell"
              tabIndex={0}
              role="region"
              aria-label="Agenda diária por profissional"
            >
              <div
                className="agenda-lane-grid"
                style={
                  {
                    "--agenda-columns": Math.max(1, columns.length),
                    "--agenda-slot-height": `${SLOT_HEIGHT}px`,
                  } as CSSProperties
                }
              >
                <div className="agenda-time-header">Horário</div>
                {columns.map((person) => (
                  <div key={person.id} className="agenda-professional-head">
                    <span>
                      {person.id === "unassigned" ? (
                        <Users size={16} />
                      ) : (
                        person.name.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <div>
                      <strong>{person.name}</strong>
                      <small>
                        {
                          dayAppointments.filter(
                            (item) =>
                              (item.barberId ?? "unassigned") === person.id,
                          ).length
                        }{" "}
                        agendamento(s)
                        {!person.canSchedule ? " · indisponível" : ""}
                      </small>
                    </div>
                  </div>
                ))}
                {!columns.length && (
                  <div className="agenda-professional-head">
                    Nenhum profissional para este filtro.
                  </div>
                )}
                <div
                  className="agenda-time-column"
                  style={{ height: calendarHeight }}
                >
                  {Array.from({ length: totalSlots }, (_, index) => (
                    <span key={index} style={{ top: index * SLOT_HEIGHT }}>
                      {timeLabel(openMinutes + index * slotMinutes)}
                    </span>
                  ))}
                </div>
                {columns.map((person) => (
                  <div
                    key={person.id}
                    className="agenda-professional-lane"
                    style={{ height: calendarHeight }}
                  >
                    {Array.from({ length: totalSlots }, (_, index) => {
                      const minutes = openMinutes + index * slotMinutes;
                      const start = new Date(
                        `${selectedDate}T${timeLabel(minutes)}:00-03:00`,
                      ).getTime();
                      const occupied =
                        person.id !== "unassigned" &&
                        appointments.some(
                          (item) =>
                            item.barberId === person.id &&
                            !["CANCELED", "NO_SHOW"].includes(item.status) &&
                            new Date(item.startsAt).getTime() <
                              start + slotMinutes * 60_000 &&
                            (item.endsAt
                              ? new Date(item.endsAt).getTime()
                              : new Date(item.startsAt).getTime() +
                                slotMinutes * 60_000) > start,
                        );
                      const disabled =
                        !canOperate ||
                        !person.canSchedule ||
                        occupied ||
                        minutes < openHour * 60 ||
                        minutes >= closeHour * 60;
                      return (
                        <button
                          key={index}
                          type="button"
                          className="agenda-slot"
                          disabled={disabled}
                          style={{
                            top: index * SLOT_HEIGHT,
                            height: Math.min(
                              SLOT_HEIGHT,
                              calendarHeight - index * SLOT_HEIGHT,
                            ),
                          }}
                          aria-label={`${occupied ? "Horário ocupado" : "Agendar"} ${timeLabel(minutes)} com ${person.name}`}
                          onClick={() =>
                            newAppointment(
                              `${selectedDate}T${timeLabel(minutes)}`,
                              person.id,
                              selectedUnitId || person.unitId || "",
                            )
                          }
                        >
                          <Plus size={15} />
                          <span>{occupied ? "Ocupado" : "Agendar"}</span>
                        </button>
                      );
                    })}
                    {layoutAgendaAppointments(
                      displayedDayAppointments.filter(
                        (item) => (item.barberId ?? "unassigned") === person.id,
                      ),
                      selectedDate,
                      openMinutes,
                      closeMinutes,
                      slotMinutes,
                    ).map(({ item, start, end, track, tracks }) => {
                      const height =
                        ((end - start) / slotMinutes) * SLOT_HEIGHT;
                      return (
                        <button
                          type="button"
                          className={`agenda-appointment ${statusClass(item.status)}${height < 65 ? " compact" : ""}`}
                          key={item.id}
                          style={{
                            top:
                              ((start - openMinutes) / slotMinutes) *
                              SLOT_HEIGHT,
                            height: Math.max(24, height - 6),
                            left: `calc(${(track / tracks) * 100}% + 5px)`,
                            width: `calc(${100 / tracks}% - 10px)`,
                          }}
                          onClick={() => setDetail(item)}
                          aria-label={`Abrir agendamento de ${item.customerName}, ${agendaTime(item.startsAt)}, ${STATUS_LABELS[item.status]}`}
                          title={`${item.customerName} · ${item.serviceName} · ${STATUS_LABELS[item.status]}`}
                        >
                          <span className="agenda-card-top">
                            <time>
                              {agendaTime(item.startsAt)}
                              {height >= 65 && item.endsAt
                                ? ` – ${agendaTime(item.endsAt)}`
                                : ""}
                            </time>
                            <span className="agenda-card-status">
                              {STATUS_LABELS[item.status]}
                            </span>
                          </span>
                          <strong>{item.customerName}</strong>
                          <small>{item.serviceName}</small>
                          <AppointmentSignals appointment={item} />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : view === "week" ? (
            <div
              className="agenda-week-grid"
              role="region"
              aria-label="Agenda semanal"
              tabIndex={0}
            >
              {weekDays.map((day) => {
                const items = displayedAppointments.filter(
                  (item) => agendaDateKey(item.startsAt) === day,
                );
                return (
                  <article
                    className={day === selectedDate ? "active" : ""}
                    key={day}
                  >
                    <header>
                      <Link
                        prefetch={false}
                        href={href({ agendaDate: day, agendaView: "day" })}
                      >
                        <strong>{dateLabel(day, { weekday: "short" })}</strong>
                        <span>{day.slice(-2)}</span>
                      </Link>
                      {canOperate && (
                        <button
                          type="button"
                          className="agenda-icon-button"
                          onClick={() =>
                            newAppointment(`${day}T${timeLabel(openHour * 60)}`)
                          }
                          aria-label={`Agendar em ${dateLabel(day, { dateStyle: "short" })}`}
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </header>
                    <div>
                      {columns.map((person) => {
                        const bookings = items.filter(
                          (item) =>
                            (item.barberId ?? "unassigned") === person.id,
                        );
                        return bookings.length ? (
                          <section
                            className="agenda-week-professional"
                            key={person.id}
                          >
                            <h4>{person.name}</h4>
                            {bookings.map((item) => (
                              <button
                                type="button"
                                className={`agenda-week-item ${statusClass(item.status)}`}
                                key={item.id}
                                onClick={() => setDetail(item)}
                              >
                                <span>{agendaTime(item.startsAt)}</span>
                                <strong>{item.customerName}</strong>
                                <small>{item.serviceName}</small>
                                <AppointmentSignals appointment={item} />
                              </button>
                            ))}
                          </section>
                        ) : null;
                      })}
                      {!items.length && (
                        <small className="agenda-week-empty">
                          Sem agendamentos
                        </small>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div
              className="agenda-month"
              role="region"
              aria-label="Agenda mensal"
              tabIndex={0}
            >
              <div className="agenda-month-weekdays">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(
                  (day) => (
                    <span key={day}>{day}</span>
                  ),
                )}
              </div>
              <div className="agenda-month-grid">
                {monthDays.map((day) => {
                  const items = displayedAppointments.filter(
                    (item) => agendaDateKey(item.startsAt) === day,
                  );
                  return (
                    <article
                      key={day}
                      className={[
                        day.slice(0, 7) !== selectedDate.slice(0, 7)
                          ? "outside"
                          : "",
                        day === selectedDate ? "active" : "",
                      ].join(" ")}
                    >
                      <div className="agenda-month-cell-head">
                        <Link
                          prefetch={false}
                          className="agenda-month-day"
                          href={href({ agendaDate: day, agendaView: "day" })}
                        >
                          <span>{day.slice(-2)}</span>
                          <small>{items.length} ag.</small>
                        </Link>
                        {canOperate && (
                          <button
                            type="button"
                            className="agenda-icon-button"
                            onClick={() =>
                              newAppointment(
                                `${day}T${timeLabel(openHour * 60)}`,
                              )
                            }
                            aria-label={`Agendar em ${dateLabel(day, { dateStyle: "short" })}`}
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </div>
                      <div>
                        {items.slice(0, 4).map((item) => (
                          <button
                            type="button"
                            className={`agenda-month-item ${statusClass(item.status)}`}
                            key={item.id}
                            onClick={() => setDetail(item)}
                            title={`${item.barberName} · ${STATUS_LABELS[item.status]}`}
                          >
                            <span>{agendaTime(item.startsAt)}</span>
                            <strong>{item.customerName}</strong>
                            <AppointmentSignals appointment={item} />
                          </button>
                        ))}
                        {items.length > 4 && (
                          <Link
                            prefetch={false}
                            className="agenda-month-more"
                            href={href({ agendaDate: day, agendaView: "day" })}
                          >
                            Ver mais {items.length - 4}
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <aside
          id="agenda-information-panel"
          className="agenda-side-panel"
          hidden={!panelOpen}
          aria-label="Unidades e informações da agenda"
        >
          <div className="agenda-side-card">
            <div className="agenda-side-head">
              <span>Unidades e informações</span>
              <button
                className="agenda-icon-button"
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Recolher informações"
              >
                <X size={16} />
              </button>
            </div>
            <label className="agenda-unit-select">
              <span>Alternar unidade</span>
              <select
                value={selectedUnitId}
                onChange={(event) =>
                  router.push(
                    href({
                      agendaUnit: event.target.value,
                      agendaProfessional: "",
                    }),
                    { scroll: false },
                  )
                }
              >
                <option value="">Todas as unidades</option>
                {units.map((unit) => (
                  <option value={unit.id} key={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <small className="agenda-form-hint">
              A data e a visualização são mantidas ao trocar de unidade.
            </small>
          </div>
          <section className="agenda-side-card">
            <div className="agenda-side-head">
              <span>Próximos horários livres</span>
              <strong>{availableSlots.length}</strong>
            </div>
            <div className="agenda-free-slots">
              {availableSlots.slice(0, 12).map((slot) => (
                <button
                  type="button"
                  disabled={!canOperate}
                  className="agenda-free-slot"
                  key={`${slot.professionalId}-${slot.time}`}
                  onClick={() =>
                    newAppointment(
                      `${selectedDate}T${slot.time}`,
                      slot.professionalId,
                      slot.unitId,
                    )
                  }
                >
                  <strong>{slot.time}</strong>
                  <span>{slot.professional}</span>
                  <small>Agendar</small>
                </button>
              ))}
              {!availableSlots.length && (
                <small>
                  Sem horários livres para os profissionais selecionados.
                </small>
              )}
            </div>
          </section>
          <section className="agenda-side-card">
            <div className="agenda-side-head">
              <span>Fila de espera</span>
              <strong>{visibleWaitlist.length}</strong>
            </div>
            {canOperate && (
              <button
                className="btn secondary"
                type="button"
                onClick={() => setWaitlistOpen(true)}
              >
                <Plus size={14} />
                Adicionar cliente
              </button>
            )}
            <div className="agenda-waitlist">
              {visibleWaitlist.map((item) => (
                <div className="agenda-waitlist-item" key={item.id}>
                  <div>
                    <strong>{item.customerName}</strong>
                    <span>
                      {isAgendaDate(item.requestedDate)
                        ? dateLabel(item.requestedDate, {
                            day: "2-digit",
                            month: "2-digit",
                          })
                        : item.requestedDate}{" "}
                      · {item.serviceName}
                    </span>
                    <small>
                      {item.barberId
                        ? (professionals.find(
                            (person) => person.id === item.barberId,
                          )?.name ?? "Profissional indisponível")
                        : "Sem preferência"}
                    </small>
                    <small>
                      {units.find((unit) => unit.id === item.unitId)?.name ??
                        "Unidade não informada"}
                    </small>
                    {item.phone && <small>{item.phone}</small>}
                    {item.notes && <small>{item.notes}</small>}
                  </div>
                  {canOperate && (
                    <form action={resolveWaitlist}>
                      <AgendaContextFields context={context} />
                      <input type="hidden" name="waitlistId" value={item.id} />
                      <AgendaSubmit secondary>Concluir</AgendaSubmit>
                    </form>
                  )}
                </div>
              ))}
              {!visibleWaitlist.length && (
                <small>Ninguém aguardando encaixe.</small>
              )}
            </div>
          </section>
          <AgendaLegend />
        </aside>
      </div>
      {draft && (
        <AgendaDialog
          title="Novo agendamento"
          subtitle="Ficha de agendamento"
          onClose={() => setDraft(null)}
        >
          <AgendaAppointmentForm
            context={context}
            professionals={professionals}
            units={units}
            services={services}
            customers={customers}
            draft={draft}
            rotationEnabled={settings.rotationEnabled}
          />
        </AgendaDialog>
      )}
      {waitlistOpen && (
        <AgendaDialog
          title="Fila de espera"
          subtitle="Registre a preferência de profissional para o encaixe."
          onClose={() => setWaitlistOpen(false)}
        >
          <AgendaWaitlistForm
            context={context}
            professionals={professionals}
            units={units}
            services={services}
          />
        </AgendaDialog>
      )}
      {detail && (
        <AgendaDialog
          title="Comanda do agendamento"
          subtitle={`${dateLabel(agendaDateKey(detail.startsAt), { dateStyle: "long" })} · ${agendaTime(detail.startsAt)}${detail.endsAt ? ` às ${agendaTime(detail.endsAt)}` : ""}`}
          onClose={() => setDetail(null)}
        >
          <div className="agenda-detail">
            <div className="agenda-detail-customer">
              <span className="agenda-detail-avatar">
                {detail.customerName.slice(0, 1)}
              </span>
              <div>
                <h4>{detail.customerName}</h4>
                <p>{detail.customerPhone || "Telefone não informado"}</p>
              </div>
              <span
                className={`agenda-detail-status ${statusClass(detail.status)}`}
              >
                {STATUS_LABELS[detail.status]}
              </span>
            </div>
            <AppointmentSignals appointment={detail} expanded />
            <dl className="agenda-detail-grid">
              <div>
                <dt>Serviço</dt>
                <dd>{detail.serviceName}</dd>
              </div>
              <div>
                <dt>Valor do serviço</dt>
                <dd>{money(detail.price)}</dd>
              </div>
              <div>
                <dt>Profissional</dt>
                <dd>{detail.barberName}</dd>
              </div>
              <div>
                <dt>Unidade</dt>
                <dd>{detail.unitName}</dd>
              </div>
            </dl>
            {canOperate ? (
              <form
                action={updateAppointmentNotes}
                className="agenda-modal-form"
              >
                <AgendaContextFields context={context} />
                <input type="hidden" name="appointmentId" value={detail.id} />
                <label className="agenda-checkbox">
                  <input
                    type="checkbox"
                    name="repurchase"
                    value="1"
                    defaultChecked={appointmentNotes(detail.notes).repurchase}
                  />
                  <span>Cliente com item para recompra</span>
                </label>
                <label>
                  <span className="label">Observações</span>
                  <textarea
                    className="input"
                    name="notes"
                    rows={3}
                    maxLength={300}
                    defaultValue={detailNotes}
                    placeholder="Detalhes do atendimento ou item para recompra"
                  />
                </label>
                <AgendaSubmit secondary>Salvar informações</AgendaSubmit>
              </form>
            ) : (
              detailNotes && (
                <div className="agenda-detail-notes">
                  <strong>Observações</strong>
                  <p>{detailNotes}</p>
                </div>
              )
            )}
            {detail.command ? (
              <section className="agenda-command-details">
                <h4>
                  Comanda de atendimento ·{" "}
                  {detail.command.status === "OPEN"
                    ? "Aberta"
                    : detail.command.status === "CLOSED"
                      ? "Fechada"
                      : "Cancelada"}
                </h4>
                <dl>
                  {detail.command.items.map((item) => (
                    <Fragment key={item.id}>
                      <dt>
                        {item.quantity} × {item.description}
                      </dt>
                      <dd>{money(item.total)}</dd>
                    </Fragment>
                  ))}
                  <dt>
                    <strong>Total</strong>
                  </dt>
                  <dd>
                    <strong>{money(detail.command.total)}</strong>
                  </dd>
                </dl>
                <Link
                  className="btn secondary"
                  href={`/erp/${encodeURIComponent(tenantCode)}/comandas`}
                >
                  Ir para comandas
                </Link>
              </section>
            ) : (
              <p className="agenda-form-hint">
                A comanda de atendimento é gerada ao iniciar o serviço.
              </p>
            )}
            {canOperate && (
              <div className="agenda-detail-actions">
                <form action={updateAppointmentStatus}>
                  <AgendaContextFields context={context} />
                  <input type="hidden" name="appointmentId" value={detail.id} />
                  {NEXT_ACTION[detail.status] && (
                    <AgendaSubmit
                      name="action"
                      value={NEXT_ACTION[detail.status].action}
                    >
                      {NEXT_ACTION[detail.status].label}
                    </AgendaSubmit>
                  )}
                  {["SCHEDULED", "CONFIRMED", "CHECKED_IN"].includes(
                    detail.status,
                  ) && (
                    <AgendaSubmit secondary name="action" value="cancel">
                      Cancelar agendamento
                    </AgendaSubmit>
                  )}
                  {["SCHEDULED", "CONFIRMED"].includes(detail.status) && (
                    <AgendaSubmit secondary name="action" value="no_show">
                      Não compareceu
                    </AgendaSubmit>
                  )}
                </form>
              </div>
            )}
          </div>
        </AgendaDialog>
      )}
    </div>
  );
}
