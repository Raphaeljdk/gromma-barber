"use client";

import Link from "next/link";
import { whatsappWaitlist, whatsappAppointmentConfirmation } from "@/lib/checkout";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { rescheduleAppointment, saveAgendaBlock, removeAgendaBlock } from "@/app/erp/[tenant]/agenda-actions";
import { addCommandItem, removeCommandItem } from "@/app/erp/[tenant]/checkout-actions";
import { hasAgendaBlock, withinAgendaHours } from "@/lib/agenda-availability";
import type { AgendaBlock } from "@/lib/erp-workspace";
import {
  ArrowLeftRight,
  CalendarDays,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings2,
  Clock3,
  Users,
  Plus,
  ListOrdered,
  PanelRightOpen,
  PanelRightClose,
  Smartphone,
  Monitor,
  Cake,
  Sparkles,
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
  openAppointmentCheckout,
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

const orderFallback = new Map<string, string>();
function subscribeToOrder(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("gromma-agenda-order", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("gromma-agenda-order", callback);
  };
}
function readOrder(key: string) {
  try { return orderFallback.get(key) || localStorage.getItem(key) || "[]"; }
  catch { return orderFallback.get(key) || "[]"; }
}

type Props = {
  blocks?: AgendaBlock[];
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
function subscribeClock(callback: () => void) {
  const timer = window.setInterval(callback, 30000);
  return () => window.clearInterval(timer);
}
const clockSnapshot = () => Math.floor(Date.now() / 30000) * 30000;
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
        A primeira visita considera o histórico de atendimentos concluídos.
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
  blocks = [],
}: Props) {
  const router = useRouter();
  const calendarRef = useRef<HTMLDivElement>(null);
  const now = useSyncExternalStore(subscribeClock, clockSnapshot, () => 0);
  const preferenceKey = `gromma:agenda-view:${tenantCode}`;
  const preferenceSnapshot = useSyncExternalStore(subscribeToOrder, () => readOrder(preferenceKey), () => "{}");
  let preferences: { compact?: boolean; width?: number; hideEmpty?: boolean } = {};
  try { preferences = JSON.parse(preferenceSnapshot) || {}; } catch { /* use defaults */ }
  const SLOT_HEIGHT = preferences.compact ? 56 : 84;
  const columnWidth = [224, 280, 340].includes(preferences.width || 0) ? preferences.width! : 280;
  function savePreferences(change: typeof preferences) {
    const value = JSON.stringify({ ...preferences, ...change });
    orderFallback.set(preferenceKey, value);
    try { localStorage.setItem(preferenceKey, value); orderFallback.delete(preferenceKey); } catch { /* session fallback */ }
    window.dispatchEvent(new Event("gromma-agenda-order"));
  }
  const [moving, setMoving] = useState<AgendaAppointment | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ item: AgendaAppointment; startsAt: string; barberId: string } | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<AgendaBlock | null>(null);
  const [blockUnit, setBlockUnit] = useState(selectedUnitId || units[0]?.id || "");
  const [fitSlot, setFitSlot] = useState<{ startsAt: string; barberId: string; unitId: string } | null>(null);
  const orderKey = `gromma:agenda-order:${tenantCode}:${selectedUnitId || "all"}`;
  const orderSnapshot = useSyncExternalStore(subscribeToOrder, () => readOrder(orderKey), () => "[]");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [orderMessage, setOrderMessage] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState<AgendaDraft | null>(
    canOperate ? (initialDraft ?? null) : null,
  );
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [selectedDetail, setDetail] = useState<AgendaAppointment | null>(
    () => appointments.find((item) => item.id === initialAppointmentId) ?? null,
  );
  // Use refreshed server data after status changes and command item mutations.
  const detail = selectedDetail ? appointments.find(item => item.id === selectedDetail.id) ?? null : null;
  const [detailOptionsOpen, setDetailOptionsOpen] = useState(false);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  // O modal tem rolagem própria. O popover nativo ocupa a camada superior,
  // escapando do recorte de overflow do diálogo (inclusive no celular).
  function positionOptionsMenu() {
    const button = optionsButtonRef.current;
    const menu = optionsMenuRef.current;
    if (!button || !menu || !menu.matches(":popover-open")) return;
    const rect = button.getBoundingClientRect();
    const gap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(360, Math.max(0, viewportWidth - 24));
    const above = Math.max(0, rect.top - 12);
    const below = Math.max(0, viewportHeight - rect.bottom - 12);
    const preferAbove = above >= Math.min(menu.scrollHeight, 320) || above >= below;
    const available = preferAbove ? above : below;
    const height = Math.min(menu.scrollHeight, Math.max(100, available - gap));
    const left = Math.min(Math.max(12, rect.left), Math.max(12, viewportWidth - width - 12));
    const top = preferAbove
      ? Math.max(12, rect.top - height - gap)
      : Math.max(12, Math.min(rect.bottom + gap, viewportHeight - height - 12));
    menu.style.setProperty("--agenda-options-left", left + "px");
    menu.style.setProperty("--agenda-options-top", top + "px");
    menu.style.setProperty("--agenda-options-height", height + "px");
  }

  useEffect(() => {
    if (!detailOptionsOpen) return;
    const reposition = () => positionOptionsMenu();
    window.addEventListener("resize", reposition);
    // Captura a rolagem do próprio dialog, não somente da janela.
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [detailOptionsOpen]);


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
    (item) => item.status !== "CANCELED" && agendaDateKey(item.startsAt) === selectedDate,
  );
  // Cancelamentos permanecem no banco e na Auditoria, mas nunca ocupam cartões
  // ou contagens visuais em Dia/Semana/Mês.
  const displayedAppointments = unitAppointments.filter((item) =>
    item.status !== "CANCELED" && matchesAgendaClient(item, selectedClientFilter),
  );
  const displayedDayAppointments = displayedAppointments.filter(
    (item) => agendaDateKey(item.startsAt) === selectedDate,
  );
  const activeProfessionals = professionals.filter(
    (person) =>
      (!selectedUnitId || !person.unitId || person.unitId === selectedUnitId) &&
      (!selectedProfessionalId || person.id === selectedProfessionalId),
  );
  let columns = activeProfessionals.map((person) => ({
    ...person,
    canSchedule: true,
  }));
  for (const item of unitAppointments.filter(item => item.status !== "CANCELED")) {
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

  let orderedIds: string[] = [];
  try {
    const value: unknown = JSON.parse(orderSnapshot);
    if (Array.isArray(value)) orderedIds = value.filter((id): id is string => typeof id === "string");
  } catch { /* Ignore malformed browser preferences. */ }
  columns.sort((a, b) => {
    const indexA = orderedIds.indexOf(a.id);
    const indexB = orderedIds.indexOf(b.id);
    return (indexA < 0 ? Number.MAX_SAFE_INTEGER : indexA) - (indexB < 0 ? Number.MAX_SAFE_INTEGER : indexB);
  });
  if (preferences.hideEmpty) columns = columns.filter(person => dayAppointments.some(item => (item.barberId || "unassigned") === person.id) || blocks.some(block => block.barberId === person.id && block.startsAt.slice(0, 10) <= selectedDate && block.endsAt.slice(0, 10) >= selectedDate));
  function moveProfessional(from: string, to: string) {
    if (from === to) return;
    const ids = columns.map((person) => person.id);
    const source = ids.indexOf(from);
    const target = ids.indexOf(to);
    if (source < 0 || target < 0) return;
    ids.splice(source, 1);
    ids.splice(target, 0, from);
    // Preserve preferences for professionals temporarily hidden by a filter.
    const next = [...ids, ...orderedIds.filter((id) => !ids.includes(id))];
    orderFallback.set(orderKey, JSON.stringify(next));
    try {
      localStorage.setItem(orderKey, JSON.stringify(next));
      orderFallback.delete(orderKey);
      setOrderMessage("Ordem dos profissionais salva neste navegador.");
    } catch { setOrderMessage("Ordem alterada. O navegador não permitiu salvar a preferência."); }
    window.dispatchEvent(new Event("gromma-agenda-order"));
  }

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
          return occupied || hasAgendaBlock(blocks, person.id, new Date(start), new Date(start + slotMinutes * 60000), selectedUnitId) || (now > 0 && start < now)
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
  const slotsPerProfessional = Math.floor(((closeHour - openHour) * 60) / slotMinutes);
  const capacity = activeProfessionals.length * slotsPerProfessional;
  // Ocupação é a proporção efetivamente reservada: horário passado não é atendimento.
  // Bloqueios (almoço/folga) também não contam como vendas ou agenda ocupada.
  const occupiedSlots = activeProfessionals.reduce((total, person) => {
    const relevant = unitAppointments.filter(
      item => item.barberId === person.id && !["CANCELED", "NO_SHOW"].includes(item.status),
    );
    const booked = Array.from({ length: slotsPerProfessional }, (_, index) => {
      const minute = openHour * 60 + index * slotMinutes;
      const slotStart = new Date(`${selectedDate}T${timeLabel(minute)}:00-03:00`).getTime();
      const slotEnd = slotStart + slotMinutes * 60_000;
      return relevant.some(item => new Date(item.startsAt).getTime() < slotEnd &&
        (item.endsAt ? new Date(item.endsAt).getTime() : new Date(item.startsAt).getTime() + slotMinutes * 60_000) > slotStart);
    }).filter(Boolean).length;
    return total + booked;
  }, 0);
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
      value: `${capacity ? Math.round((occupiedSlots / capacity) * 100) : 0}%`,
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
  const nowDate = now ? agendaDateKey(new Date(now)) : "";
  const nowMinutes = now ? agendaMinutes(new Date(now)) : 0;
  const nowTop = Math.max(0, Math.min(calendarHeight, ((nowMinutes - openMinutes) / slotMinutes) * SLOT_HEIGHT));
  const scrolledToNow = useRef(false);
  useEffect(() => {
    if (!scrolledToNow.current && nowDate === selectedDate && view === "day" && window.location.hash === "#agenda-now") {
      calendarRef.current?.scrollTo({ top: Math.max(0, nowTop - 100) });
      scrolledToNow.current = true;
    }
  }, [nowDate, selectedDate, view, nowTop]);
  const fits = fitSlot ? visibleWaitlist.filter(item => {
    if (item.requestedDate !== selectedDate || (item.barberId && item.barberId !== fitSlot.barberId) || (fitSlot.unitId && item.unitId !== fitSlot.unitId)) return false;
    const possibleServices = item.serviceId ? services.filter(service => service.id === item.serviceId) : services;
    const start = new Date(`${fitSlot.startsAt}:00-03:00`);
    return Boolean(fitSlot.barberId) && possibleServices.some(service => {
      const end = new Date(start.getTime() + service.durationMinutes * 60000);
      return withinAgendaHours(start, end, openHour, closeHour) &&
        !hasAgendaBlock(blocks, fitSlot.barberId, start, end, fitSlot.unitId) &&
        !appointments.some(a => a.barberId === fitSlot.barberId && !["CANCELED", "NO_SHOW"].includes(a.status) && new Date(a.startsAt) < end && (a.endsAt ? new Date(a.endsAt) : new Date(new Date(a.startsAt).getTime() + slotMinutes * 60000)) > start);
    });
  }) : [];

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
              <button className="btn secondary" type="button" onClick={() => setBlockOpen(true)}>Bloquear horário</button>
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
        </div>
      </div>
          <section className="agenda-dashboard-panel" aria-label="Indicadores do dia">
            <div className="agenda-dashboard-head"><span>Indicadores do dia</span><strong>{dateLabel(selectedDate, { day: "2-digit", month: "2-digit" })}</strong></div>
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

          </section>
      <div className="agenda-toolbar">
        <button type="button" className="btn secondary" onClick={() => {
          if (selectedDate !== nowDate || view !== "day") router.push(`${href({ agendaDate: nowDate, agendaView: "day" })}#agenda-now`);
          else calendarRef.current?.scrollTo({ top: Math.max(0, nowTop - 100), behavior: "smooth" });
        }} disabled={!now}>Agora</button>
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
        <div className="agenda-view-tools">
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
          <button type="button"
            className={`agenda-information-toggle${panelOpen ? " active" : ""}`}
            aria-controls="agenda-information-panel"
            aria-expanded={panelOpen}
            aria-label={panelOpen ? "Ocultar unidades e informações" : "Mostrar unidades e informações"}
            title={panelOpen ? "Recolher informações" : "Abrir unidades e informações"}
            onClick={() => setPanelOpen(value => !value)}>
            {panelOpen ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
          </button>
        </div>
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
      {view === "day" && <p className="agenda-order-hint">Arraste o cabeçalho para organizar os profissionais. Pelo teclado, foque o ícone e use as setas ← →.</p>}
      <div className="agenda-display-settings">
        <label>Visualização <select value={preferences.compact ? "compact" : "expanded"} onChange={e => savePreferences({ compact: e.target.value === "compact" })}><option value="expanded">Ampliada</option><option value="compact">Compacta</option></select></label>
        <label>Largura das colunas <select value={columnWidth} onChange={e => savePreferences({ width: Number(e.target.value) })}><option value={224}>Estreita</option><option value={280}>Normal</option><option value={340}>Larga</option></select></label>
        <label><input type="checkbox" checked={Boolean(preferences.hideEmpty)} onChange={e => savePreferences({ hideEmpty: e.target.checked })} /> Ocultar profissionais sem atendimento no dia</label>
      </div>
      <span className="agenda-sr-only" role="status">{orderMessage}</span>
      <div className={`agenda-main-layout${panelOpen ? " with-panel" : ""}`}>
        <div className="agenda-main-calendar">
          {view === "day" ? (
            <>
            {columns.length > 1 && <p className="agenda-mobile-swipe-hint" role="note">
              <ArrowLeftRight size={15} aria-hidden="true" /> Deslize para os lados para ver outros profissionais.
            </p>}
            <div
              className="agenda-calendar-shell"
              ref={calendarRef}
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
                    "--agenda-column-width": `${columnWidth}px`,
                  } as CSSProperties
                }
              >
                {selectedDate === nowDate && <div id="agenda-now" className="agenda-now-line" style={{ top: 64 + nowTop }}><span>{agendaTime(new Date(now))}</span></div>}
                <div className="agenda-time-header">Horário</div>
                {columns.map((person) => (
                  <div key={person.id}
                    className={`agenda-professional-head${draggedId === person.id ? " is-dragging" : ""}${dropId === person.id ? " is-drop-target" : ""}`}
                    draggable={columns.length > 1}
                    onDragStart={(event) => { setDraggedId(person.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", person.id); }}
                    onDragOver={(event) => { if (draggedId) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropId(person.id); } }}
                    onDrop={(event) => { event.preventDefault(); if (draggedId) moveProfessional(draggedId, person.id); setDraggedId(null); setDropId(null); }}
                    onDragEnd={() => { setDraggedId(null); setDropId(null); }}
                  >
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
                    <button type="button" className="agenda-drag-handle" aria-label={`Mover ${person.name}. Use as setas esquerda e direita.`}
                      title="Arraste para reorganizar ou use as setas do teclado"
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                        event.preventDefault();
                        const target = columns[columns.findIndex((item) => item.id === person.id) + (event.key === "ArrowLeft" ? -1 : 1)];
                        if (target) moveProfessional(person.id, target.id);
                      }}><GripVertical size={18} /></button>
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
                      const blocked = hasAgendaBlock(blocks, person.id, new Date(start), new Date(start + slotMinutes * 60000), selectedUnitId);
                      const disabled =
                        !canOperate ||
                        !person.canSchedule ||
                        blocked ||
                        occupied ||
                        minutes < openHour * 60 ||
                        minutes >= closeHour * 60;
                      return (
                        <button
                          key={index}
                          type="button"
                          className="agenda-slot"
                          disabled={disabled && !moving}
                          aria-disabled={disabled}
                          onDragOver={event => { if (moving && !blocked && person.canSchedule && person.id !== "unassigned") event.preventDefault(); }}
                          onDrop={event => { event.preventDefault(); if (moving && !blocked && person.canSchedule && person.id !== "unassigned") setMoveTarget({ item: moving, startsAt: `${selectedDate}T${timeLabel(minutes)}`, barberId: person.id }); setMoving(null); }}
                          style={{
                            top: index * SLOT_HEIGHT,
                            height: Math.min(
                              SLOT_HEIGHT,
                              calendarHeight - index * SLOT_HEIGHT,
                            ),
                          }}
                          aria-label={`${occupied ? "Horário ocupado" : "Agendar"} ${timeLabel(minutes)} com ${person.name}`}
                          onClick={() => { if (!disabled) setFitSlot({
                              startsAt:
                              `${selectedDate}T${timeLabel(minutes)}`,
                              barberId: person.id === "unassigned" ? "" : person.id,
                              unitId: selectedUnitId || person.unitId || "",
                            }); }}
                        >
                          <Plus size={15} />
                          <span>{occupied ? "Ocupado" : "Agendar"}</span>
                        </button>
                      );
                    })}
                    {blocks.filter(block => block.barberId === person.id).map(block => {
                      const dayStart = new Date(`${selectedDate}T00:00:00-03:00`).getTime();
                      const start = Math.max(openMinutes, (new Date(block.startsAt).getTime() - dayStart) / 60000);
                      const end = Math.min(closeMinutes, (new Date(block.endsAt).getTime() - dayStart) / 60000);
                      if (end <= start) return null;
                      return <button type="button" key={block.id} className="agenda-block" style={{ top: (start - openMinutes) / slotMinutes * SLOT_HEIGHT, height: (end - start) / slotMinutes * SLOT_HEIGHT }} onClick={() => setSelectedBlock(block)} title={`${block.reason} · ${agendaTime(block.startsAt)}–${agendaTime(block.endsAt)}`}><strong>{block.reason}</strong><small>{agendaTime(block.startsAt)}–{agendaTime(block.endsAt)}</small></button>;
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
                          draggable={canOperate && ["SCHEDULED", "CONFIRMED"].includes(item.status) && !item.command}
                          onDragStart={event => { setMoving(item); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); }}
                          onDragEnd={() => setMoving(null)}
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
            </>
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
                    setFitSlot({ startsAt: `${selectedDate}T${slot.time}`, barberId: slot.professionalId, unitId: slot.unitId })
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
                    {whatsappWaitlist(item.phone, item.customerName, item.serviceName) && <a className="agenda-whatsapp" href={whatsappWaitlist(item.phone, item.customerName, item.serviceName)!} target="_blank" rel="noopener noreferrer" aria-label={`Avisar ${item.customerName} pelo WhatsApp`} title="Abrir WhatsApp com mensagem para revisar e enviar"><MessageCircle size={17} /> Avisar pelo WhatsApp</a>}
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
          subtitle="Preencha a ficha e confira os detalhes antes de salvar"
          variant="booking"
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
      {fitSlot && <AgendaDialog title="Novo agendamento" subtitle={`Horário selecionado · ${dateLabel(selectedDate, { dateStyle: "short" })} às ${fitSlot.startsAt.slice(11)}`} variant="booking" onClose={() => setFitSlot(null)}>
        {fits.length > 0 && <div className="agenda-fit-list"><h4>Clientes da fila para este horário</h4>
          {fits.map(item => <button type="button" className="btn secondary" key={item.id} onClick={() => {
            const matches = customers.filter(c => item.phone && c.phone?.replace(/\D/g, "") === item.phone.replace(/\D/g, ""));
            setDraft({ ...fitSlot, unitId: fitSlot.unitId || item.unitId || "", serviceId: item.serviceId || "", customerId: matches.length === 1 ? matches[0].id : "", waitlistId: item.id, notes: [item.notes, "Origem: fila de espera"].filter(Boolean).join(" · ") }); setFitSlot(null);
          }}>{item.customerName} · {item.serviceName}</button>)}
        </div>}
        <AgendaAppointmentForm context={context} professionals={professionals} units={units} services={services} customers={customers} draft={fitSlot} rotationEnabled={settings.rotationEnabled} />
      </AgendaDialog>}
      {moveTarget && <AgendaDialog title="Confirmar remarcação" subtitle="O horário original só muda depois da confirmação." onClose={() => setMoveTarget(null)}>
        <form action={rescheduleAppointment} className="agenda-modal-form">
          <AgendaContextFields context={context} />
          <input type="hidden" name="appointmentId" value={moveTarget.item.id} />
          <input type="hidden" name="originalStartsAt" value={moveTarget.item.startsAt} />
          <p><strong>{moveTarget.item.customerName}</strong> · {moveTarget.item.serviceName}</p>
          <p>De: {dateLabel(agendaDateKey(moveTarget.item.startsAt), { dateStyle: "short" })} às {agendaTime(moveTarget.item.startsAt)} · {moveTarget.item.barberName}</p>
          <label><span className="label">Novo horário</span><input className="input" type="datetime-local" name="startsAt" required defaultValue={moveTarget.startsAt} /></label>
          <label><span className="label">Profissional na mesma unidade</span><select className="select" name="barberId" required defaultValue={moveTarget.barberId}>{professionals.filter(p => !p.unitId || p.unitId === moveTarget.item.unitId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <p className="agenda-form-hint">A duração será mantida. Horários ocupados, bloqueados e fora do expediente serão recusados.</p>
          <AgendaSubmit>Confirmar remarcação</AgendaSubmit>
        </form>
      </AgendaDialog>}
      {blockOpen && <AgendaDialog title="Bloquear horário" subtitle="Bloqueios impedem agendamentos e encaixes para este profissional." onClose={() => setBlockOpen(false)}>
        <form action={saveAgendaBlock} className="agenda-modal-form">
          <AgendaContextFields context={context} />
          <label><span className="label">Unidade</span><select className="select" name="unitId" required value={blockUnit} onChange={e => setBlockUnit(e.target.value)}>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label><span className="label">Profissional</span><select className="select" name="barberId" required key={blockUnit}>{professionals.filter(p => !p.unitId || p.unitId === blockUnit).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label><span className="label">Motivo</span><select className="select" name="reason">{["Almoço", "Pausa", "Folga", "Ausência"].map(reason => <option key={reason}>{reason}</option>)}</select></label>
          <label><span className="label">Início</span><input className="input" type="datetime-local" name="startsAt" required defaultValue={`${selectedDate}T12:00`} /></label>
          <label><span className="label">Fim</span><input className="input" type="datetime-local" name="endsAt" required defaultValue={`${selectedDate}T13:00`} /></label>
          <AgendaSubmit>Salvar bloqueio</AgendaSubmit>
        </form>
      </AgendaDialog>}
      {selectedBlock && <AgendaDialog title={selectedBlock.reason} subtitle="Horário indisponível" onClose={() => setSelectedBlock(null)}>
        <p>{professionals.find(p => p.id === selectedBlock.barberId)?.name}</p>
        <p>{dateLabel(agendaDateKey(selectedBlock.startsAt), { dateStyle: "short" })} · {agendaTime(selectedBlock.startsAt)} até {dateLabel(agendaDateKey(selectedBlock.endsAt), { dateStyle: "short" })} · {agendaTime(selectedBlock.endsAt)}</p>
        {canOperate && <form action={removeAgendaBlock}><AgendaContextFields context={context} /><input type="hidden" name="blockId" value={selectedBlock.id} /><AgendaSubmit secondary>Liberar este horário</AgendaSubmit></form>}
      </AgendaDialog>}
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
          variant="checkout"
          title={detail.command ? "Comanda do atendimento" : "Detalhes do agendamento"}
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
            <div className="agenda-detail-preferences">
              <span>{detail.serviceName} · {money(detail.price)}</span>
            </div>
            {canOperate && <div className="agenda-quick-actions">
              {["SCHEDULED", "CONFIRMED"].includes(detail.status) && !detail.command && <button className="btn secondary" type="button" onClick={() => { setMoveTarget({ item: detail, startsAt: `${agendaDateKey(detail.startsAt)}T${agendaTime(detail.startsAt)}`, barberId: detail.barberId || "" }); setDetail(null); }}>Reagendar</button>}

            </div>}
            <section className="agenda-customer-summary agenda-command-summary">
              <div className="agenda-command-summary-title"><h4>Dados do atendimento</h4><span>{STATUS_LABELS[detail.status]}</span></div>
              <p><strong>Cliente:</strong> {detail.customerName} · {detail.customerPhone || "Telefone não informado"}</p>
              <p><strong>Plano:</strong> {detail.planName || "Sem plano ativo"}</p>
              {detail.customerNotes && <p><strong>Preferências do cliente:</strong> {detail.customerNotes}</p>}
              <p><strong>Data e horário:</strong> {dateLabel(agendaDateKey(detail.startsAt), { dateStyle: "short" })} · {agendaTime(detail.startsAt)}{detail.endsAt ? ` às ${agendaTime(detail.endsAt)}` : ""}</p>
              <p><strong>Unidade:</strong> {detail.unitName} · <strong>Profissional:</strong> {detail.barberName}</p>
            </section>
            <section className="agenda-previous-appointments">
              <div className="agenda-command-summary-title"><h4>Agendamentos realizados</h4><small>Últimos 3 atendimentos</small></div>
              {detail.lastThreeAppointments?.length ? <div className="agenda-previous-list">
                {detail.lastThreeAppointments.map(previous => <article key={previous.id}>
                  <time>{new Date(previous.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>
                  <strong>{previous.service}</strong><small>{previous.professional}</small>
                </article>)}
              </div> : <p className="agenda-form-hint">Nenhum atendimento concluído anteriormente para este cliente.</p>}
            </section>
            <section className="agenda-customer-purchases">
              <div className="agenda-command-summary-title"><h4>Histórico de compras</h4><small>Últimos produtos adquiridos</small></div>
              {detail.recentProducts?.length ? <div>
                {detail.recentProducts.map((product, index) => <article key={product.description + index}>
                  <div><strong>{product.description}</strong><small>{product.professional || "Profissional não informado"}</small></div>
                  <small>{product.quantity} un. · {new Date(product.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</small>
                </article>)}
              </div> : <p className="agenda-form-hint">Sem produtos comprados anteriormente.</p>}
            </section>
            <dl className="agenda-detail-grid agenda-detail-grid-compact">
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
            {canOperate ? <details className="agenda-command-notes">
              <summary>Observações do agendamento <span>Editar</span></summary>
              <form action={updateAppointmentNotes} id={`agenda-save-${detail.id}`} className="agenda-modal-form">
                <AgendaContextFields context={context} />
                <input type="hidden" name="appointmentId" value={detail.id} />
                <input type="hidden" name="repurchase" value={appointmentNotes(detail.notes).repurchase ? "1" : "0"} />
                <textarea className="input" name="notes" aria-label="Observações do agendamento" rows={3} maxLength={300} defaultValue={detailNotes} placeholder="Observações e preferências do atendimento" />
              </form>
            </details> : (detailNotes && <div className="agenda-detail-notes"><strong>Observações</strong><p>{detailNotes}</p></div>)}
            {detail.command && <section className="agenda-command-details agenda-command-services">
              <div className="agenda-command-summary-title"><h4>Serviços e produtos na comanda</h4><strong>{money(detail.command.total)}</strong></div>
              {canOperate && detail.command.status === "OPEN" && <form action={addCommandItem} className="agenda-command-add-form">
                <input type="hidden" name="tenantCode" value={tenantCode} />
                <input type="hidden" name="commandId" value={detail.command.id} />
                <input type="hidden" name="agendaReturn" value="1" />
                <input type="hidden" name="appointmentId" value={detail.id} />
                {["agendaView", "agendaUnit", "agendaProfessional", "agendaClient"].map(key => <input key={key} type="hidden" name={key} value={context[key as keyof AgendaContext]} />)}
                <input type="hidden" name="agendaDate" value={selectedDate} />
                <input type="hidden" name="quantity" value="1" />
                <label><span className="label">Inserir serviço</span><select className="select" name="catalogItem" defaultValue="" required>
                  <option value="" disabled>Selecione o serviço</option>
                  {services.map(service => <option key={service.id} value={`SERVICE:${service.id}`}>{service.name} · {money(service.price)}</option>)}
                </select></label>
                <AgendaSubmit secondary>+ Inserir</AgendaSubmit>
              </form>}
              <div className="agenda-command-item-list">
                {detail.command.items.map(item => <div key={item.id}>
                  <span>{item.quantity} × {item.description}</span><strong>{money(item.total)}</strong>
                  {canOperate && detail.command?.status === "OPEN" && <form action={removeCommandItem}>
                    <input type="hidden" name="tenantCode" value={tenantCode} />
                    <input type="hidden" name="commandId" value={detail.command.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="agendaReturn" value="1" />
                    <input type="hidden" name="appointmentId" value={detail.id} />
                    {["agendaView", "agendaUnit", "agendaProfessional", "agendaClient"].map(key => <input key={key} type="hidden" name={key} value={context[key as keyof AgendaContext]} />)}
                <input type="hidden" name="agendaDate" value={selectedDate} />
                    <AgendaSubmit secondary>Excluir</AgendaSubmit>
                  </form>}
                </div>)}
              </div>
              {detail.command.status === "OPEN" && <Link className="btn secondary" href={`/erp/${encodeURIComponent(tenantCode)}/comandas?commandId=${encodeURIComponent(detail.command.id)}`}>Adicionar produtos e abrir checkout</Link>}
            </section>}
            <div className="agenda-command-bottom-actions">
              <div className="agenda-bottom-options">
                <button ref={optionsButtonRef} type="button" className="btn secondary" aria-expanded={detailOptionsOpen}
                  aria-controls="agenda-detail-settings" aria-haspopup="menu"
                  onClick={() => {
                    const menu = optionsMenuRef.current;
                    if (!menu) return;
                    if (menu.matches(":popover-open")) menu.hidePopover();
                    else { menu.showPopover(); positionOptionsMenu(); }
                  }}>
                  <Settings2 size={16} /> Opções <ChevronDown size={14} />
                </button>
                <div ref={optionsMenuRef} id="agenda-detail-settings" popover="auto"
                  onToggle={event => setDetailOptionsOpen(event.currentTarget.matches(":popover-open"))}
                  className="agenda-detail-settings agenda-action-menu">
              <strong>Ações do agendamento</strong>
              {canOperate && ["SCHEDULED", "CONFIRMED", "CHECKED_IN"].includes(detail.status) && (!detail.command || detail.command.status === "OPEN") && <form
                action={updateAppointmentStatus} onSubmit={event => {
                  if (!window.confirm("Cancelar agendamento e, se existir, cancelar também a comanda aberta? O histórico será preservado e nenhum pagamento será registrado.")) event.preventDefault();
                }}>
                <AgendaContextFields context={context} />
                <input type="hidden" name="appointmentId" value={detail.id} />
                <AgendaSubmit secondary name="action" value="cancel">Cancelar e retirar da agenda</AgendaSubmit>
              </form>}
              {canOperate && ["SCHEDULED", "CONFIRMED"].includes(detail.status) && (!detail.command || detail.command.status === "OPEN") && <form
                action={updateAppointmentStatus} onSubmit={event => {
                  if (!window.confirm("Marcar cliente como faltante e cancelar eventual comanda aberta, sem registrar pagamento?")) event.preventDefault();
                }}>
                <AgendaContextFields context={context} />
                <input type="hidden" name="appointmentId" value={detail.id} />
                <AgendaSubmit secondary name="action" value="no_show">Cliente faltou</AgendaSubmit>
              </form>}
              {whatsappAppointmentConfirmation(detail.customerPhone || "", detail.customerName, detail.serviceName, detail.startsAt) && ["SCHEDULED", "CONFIRMED"].includes(detail.status) && <a className="btn secondary agenda-whatsapp-confirm" target="_blank" rel="noopener noreferrer"
                href={whatsappAppointmentConfirmation(detail.customerPhone || "", detail.customerName, detail.serviceName, detail.startsAt)!}>
                <MessageCircle size={16} /> Enviar confirmação pelo WhatsApp
              </a>}
              {canOperate && ["SCHEDULED", "CONFIRMED"].includes(detail.status) && <form action={updateAppointmentStatus}>
                <AgendaContextFields context={context} />
                <input type="hidden" name="appointmentId" value={detail.id} />
                <AgendaSubmit secondary name="action" value="checkin">Cliente no local</AgendaSubmit>
              </form>}
              {!detail.customerPhone && <p className="agenda-form-hint">WhatsApp indisponível: cliente sem telefone cadastrado.</p>}
              {(!canOperate || !["SCHEDULED", "CONFIRMED", "CHECKED_IN"].includes(detail.status)) && <p className="agenda-form-hint">Nenhuma alteração de status disponível para este atendimento.</p>}
            </div>
              </div>
              {detail.command?.status === "CLOSED" ? <span className="agenda-form-hint">Comanda fechada</span>
                : ["CANCELED", "NO_SHOW"].includes(detail.status) ? <span className="agenda-form-hint">Atendimento encerrado sem cobrança.</span>
                : detail.command?.status === "OPEN" ? <Link className="btn agenda-checkout-shortcut" href={`/erp/${encodeURIComponent(tenantCode)}/comandas?commandId=${encodeURIComponent(detail.command.id)}`}>Fechar comanda →</Link>
                : canOperate ? <form action={openAppointmentCheckout} className="agenda-direct-checkout">
                    <AgendaContextFields context={context} /><input type="hidden" name="appointmentId" value={detail.id} />
                    <AgendaSubmit>Fechar comanda →</AgendaSubmit>
                  </form> : null}
              {canOperate && <button type="submit" form={`agenda-save-${detail.id}`} className="btn secondary" title="Salva as observações alteradas">Salvar agendamento</button>}
            </div>
          </div>
        </AgendaDialog>
      )}
    </div>
  );
}
