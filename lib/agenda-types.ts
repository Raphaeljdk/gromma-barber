import type { AgendaClientFilter, AgendaView } from "./agenda";

export type AgendaAppointment = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  customerId: string | null;
  serviceId?: string | null;
  customerName: string;
  customerPhone: string | null;
  barberId: string | null;
  barberName: string;
  serviceName: string;
  price: number;
  unitId: string;
  unitName: string;
  source: string;
  notes: string | null;
  lastVisit?: string | null;
  customerNotes?: string | null;
  recentProducts?: { description: string; quantity: number; date: string; professional?: string }[];
  lastThreeAppointments?: { id: string; date: string; service: string; professional: string; status: string }[];
  hasPlan: boolean;
  planName: string | null;
  firstVisit: boolean;
  birthday: boolean;
  command: {
    id: string;
    status: string;
    total: number;
    items: {
      id: string;
      description: string;
      quantity: number;
      total: number;
    }[];
  } | null;
};
export type AgendaProfessional = {
  id: string;
  name: string;
  unitId: string | null;
};
export type AgendaUnit = { id: string; name: string };
export type AgendaService = {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
};
export type AgendaCustomer = { id: string; name: string; phone: string | null };
export type AgendaContext = {
  tenantCode: string;
  agendaDate: string;
  agendaView: AgendaView;
  agendaUnit: string;
  agendaUnits: string;
  agendaProfessional: string;
  agendaProfessionals: string;
  agendaClient: AgendaClientFilter;
};
export type AgendaDraft = {
  serviceId?: string;
  customerId?: string;
  waitlistId?: string;
  notes?: string;
  startsAt: string;
  barberId: string;
  unitId: string;
};
