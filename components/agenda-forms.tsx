"use client";

import { useState } from "react";
import { createAppointment } from "@/app/erp/[tenant]/actions";
import { addWaitlist } from "@/app/erp/[tenant]/module-actions";
import type {
  AgendaContext,
  AgendaCustomer,
  AgendaDraft,
  AgendaProfessional,
  AgendaService,
  AgendaUnit,
} from "@/lib/agenda-types";
import { AgendaSubmit } from "./agenda-dialog";

export function AgendaContextFields({ context }: { context: AgendaContext }) {
  return (
    <>
      {Object.entries(context).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

type FormProps = {
  context: AgendaContext;
  professionals: AgendaProfessional[];
  units: AgendaUnit[];
  services: AgendaService[];
};

function ProfessionalField({
  professionals,
  unitId,
  initialBarberId = "",
}: {
  professionals: AgendaProfessional[];
  unitId: string;
  initialBarberId?: string;
}) {
  const available = professionals.filter(
    (person) => !unitId || !person.unitId || person.unitId === unitId,
  );
  return (
    <label>
      <span className="label">Profissional</span>
      <select
        className="select"
        name="barberId"
        defaultValue={
          available.some((person) => person.id === initialBarberId)
            ? initialBarberId
            : ""
        }
      >
        <option value="">Sem preferência</option>
        {available.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AgendaAppointmentForm({
  context,
  professionals,
  units,
  services,
  customers,
  draft,
  rotationEnabled,
}: FormProps & {
  customers: AgendaCustomer[];
  draft: AgendaDraft;
  rotationEnabled: boolean;
}) {
  const [extraServices, setExtraServices] = useState<string[]>([]);
  const [primaryService, setPrimaryService] = useState(draft.serviceId || "");
  const selectedServices = services.filter(s => s.id === primaryService || extraServices.includes(s.id));
  const [unitId, setUnitId] = useState(
    draft.unitId || (units.length === 1 ? units[0].id : ""),
  );
  return (
    <form
      action={createAppointment}
      className="erp-quick-form agenda-modal-form"
    >
      <AgendaContextFields context={context} />
      {draft.waitlistId && <input type="hidden" name="waitlistId" value={draft.waitlistId} />}
      {draft.waitlistId && <p className="agenda-form-hint">Encaixe da fila: confira o cliente e o serviço. A entrada só será retirada da fila após salvar o agendamento.</p>}
      <div className="grid grid-2">
        <label>
          <span className="label">Cliente</span>
          <select name="customerId" className="select" defaultValue={draft.customerId || ""}>
            <option value="">Cliente avulso</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.phone ? ` · ${customer.phone}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Serviço</span>
          <select className="select" name="serviceId" required value={primaryService} onChange={e => { setPrimaryService(e.target.value); setExtraServices(old => old.filter(id => id !== e.target.value)); }}>
            <option value="" disabled>
              Selecione o serviço
            </option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} · {service.durationMinutes} min ·{" "}
                {service.price.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </option>
            ))}
          </select>
        </label>
        <div className="agenda-extra-services">
          {extraServices.map((id, index) => <div className="agenda-service-row" key={index}><label><span className="label">Serviço adicional {index + 1}</span><select className="select" name="serviceIds" required value={id} onChange={e => setExtraServices(old => old.map((v, i) => i === index ? e.target.value : v))}><option value="">Selecione</option>{services.filter(s => s.id !== primaryService && (!extraServices.includes(s.id) || s.id === id)).map(s => <option key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min · {s.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</option>)}</select></label><button type="button" className="btn secondary" aria-label={`Remover serviço adicional ${index + 1}`} onClick={() => setExtraServices(old => old.filter((_, i) => i !== index))}>Remover</button></div>)}
          <button type="button" className="btn secondary" disabled={extraServices.length >= 11 || selectedServices.length >= services.length} onClick={() => setExtraServices(old => [...old, ""])}>＋ Adicionar outro serviço</button>
          <p className="agenda-form-hint">Duração total: {selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0)} min · Valor: {selectedServices.reduce((sum, s) => sum + s.price, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        </div>
        <label>
          <span className="label">Unidade</span>
          <select
            className="select"
            name="unitId"
            required
            value={unitId}
            onChange={(event) => setUnitId(event.target.value)}
          >
            <option value="" disabled>
              Selecione a unidade
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        <ProfessionalField
          key={unitId}
          professionals={professionals}
          unitId={unitId}
          initialBarberId={draft.barberId}
        />
        <label className="agenda-field-wide">
          <span className="label">Data e hora</span>
          <input
            type="datetime-local"
            className="input"
            name="startsAt"
            required
            defaultValue={draft.startsAt}
          />
        </label>
      </div>
      {rotationEnabled && (
        <p className="agenda-form-hint">
          Sem preferência: o rodízio procura um profissional disponível.
        </p>
      )}
      <label className="agenda-checkbox">
        <input type="checkbox" name="repurchase" value="1" />
        <span>Cliente com item para recompra</span>
      </label>
      <label>
        <span className="label">Observações</span>
        <textarea
          className="input"
          name="notes"
          rows={3}
          maxLength={300}
          placeholder="Detalhes do atendimento ou item para recompra"
          defaultValue={draft.notes || ""}
        />
      </label>
      <AgendaSubmit>Salvar agendamento</AgendaSubmit>
    </form>
  );
}

export function AgendaWaitlistForm({
  context,
  professionals,
  units,
  services,
}: FormProps) {
  const [unitId, setUnitId] = useState(
    context.agendaUnit || (units.length === 1 ? units[0].id : ""),
  );
  return (
    <form action={addWaitlist} className="erp-quick-form agenda-modal-form">
      <AgendaContextFields context={context} />
      <div className="grid grid-2">
        <label>
          <span className="label">Cliente</span>
          <input
            className="input"
            name="customerName"
            required
            minLength={2}
            maxLength={120}
            placeholder="Nome do cliente"
          />
        </label>
        <label>
          <span className="label">Telefone</span>
          <input
            className="input"
            name="phone"
            type="tel"
            maxLength={40}
            placeholder="(11) 99999-9999"
          />
        </label>
        <label>
          <span className="label">Data desejada</span>
          <input
            className="input"
            name="requestedDate"
            type="date"
            required
            defaultValue={context.agendaDate}
          />
        </label>
        <label>
          <span className="label">Serviço</span>
          <select className="select" name="serviceId">
            <option value="">Qualquer serviço</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Unidade</span>
          <select
            className="select"
            name="unitId"
            required
            value={unitId}
            onChange={(event) => setUnitId(event.target.value)}
          >
            <option value="" disabled>
              Selecione a unidade
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        <ProfessionalField
          key={unitId}
          professionals={professionals}
          unitId={unitId}
          initialBarberId={context.agendaProfessional}
        />
      </div>
      <AgendaSubmit>Adicionar à fila de espera</AgendaSubmit>
    </form>
  );
}
