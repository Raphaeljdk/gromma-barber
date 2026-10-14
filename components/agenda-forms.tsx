"use client";

import { useRef, useState } from "react";
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
  context, professionals, units, services, customers, draft, rotationEnabled,
}: FormProps & {
  customers: AgendaCustomer[];
  draft: AgendaDraft;
  rotationEnabled: boolean;
}) {
  const [unitId, setUnitId] = useState(draft.unitId || (units.length === 1 ? units[0].id : ""));
  const [primaryService, setPrimaryService] = useState(draft.serviceId || "");
  const [extraServices, setExtraServices] = useState<{ key: number; serviceId: string }[]>([]);
  const nextExtraKey = useRef(0);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState(draft.customerId || "");
  const [customerChoicesOpen, setCustomerChoicesOpen] = useState(false);
  // Pesquisa iniciada exige uma escolha explícita: nunca deixar a ficha como
  // "avulso" por acidente após a recepção digitar um nome conhecido.
  const [walkIn, setWalkIn] = useState(!draft.customerId);
  const [startsAt, setStartsAt] = useState(draft.startsAt);
  const [showNotes, setShowNotes] = useState(Boolean(draft.notes));
  const chosen = [primaryService, ...extraServices.map(item => item.serviceId)].filter(Boolean);
  const selectedServices = chosen.map(id => services.find(service => service.id === id)).filter((item): item is AgendaService => Boolean(item));
  const totalMinutes = selectedServices.reduce((sum, item) => sum + item.durationMinutes, 0);
  const totalPrice = selectedServices.reduce((sum, item) => sum + item.price, 0);
  const customerQuery = customerSearch.trim().toLocaleLowerCase("pt-BR");
  const visibleCustomers = customerQuery
    ? customers.filter(customer =>
        [customer.name, customer.phone || ""].some(value => value.toLocaleLowerCase("pt-BR").includes(customerQuery))
      )
    : [];
  const selectedCustomer = customers.find(item => item.id === customerId);
  const customerChoiceMissing = !selectedCustomer && !walkIn;
  function pickCustomer(id: string) {
    setCustomerId(id);
    setWalkIn(false);
    setCustomerSearch("");
    setCustomerChoicesOpen(false);
  }
  function pickWalkIn() {
    setCustomerId("");
    setCustomerSearch("");
    setWalkIn(true);
    setCustomerChoicesOpen(false);
  }
  const finishAt = startsAt && totalMinutes
    ? new Date(new Date(startsAt + ":00-03:00").getTime() + totalMinutes * 60000)
        .toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
    : null;
  const money = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function addService(id: string) {
    if (!id || !services.some(service => service.id === id)) return;
    // A mesma opção pode aparecer mais de uma vez (atendimentos combinados).
    // A duração real é validada contra o expediente no servidor.
    if (!primaryService) setPrimaryService(id);
    else setExtraServices(previous => [...previous, { key: ++nextExtraKey.current, serviceId: id }]);
  }
  function removeExtra(key: number) {
    setExtraServices(previous => previous.filter(item => item.key !== key));
  }
  const tooLongForOneDay = totalMinutes > 24 * 60;
  const extraCounts = services.map(service => ({
    service, count: extraServices.filter(item => item.serviceId === service.id).length,
  })).filter(entry => entry.count > 0);

  return (
    <form action={createAppointment} className="erp-quick-form agenda-modal-form agenda-booking-form">
      <AgendaContextFields context={context} />
      {draft.waitlistId && <input type="hidden" name="waitlistId" value={draft.waitlistId} />}
      {draft.waitlistId && <p className="agenda-form-hint agenda-booking-alert">Encaixe da fila: o cliente só sairá da lista quando o atendimento for salvo.</p>}
      <section className="agenda-booking-section">
        <div className="agenda-booking-section-heading"><span className="agenda-booking-number">01</span><div><h4>Quem será atendido?</h4><p>Encontre o cliente pelo nome ou telefone.</p></div></div>
        <div className="agenda-customer-chooser">
          <label htmlFor="agenda-customer-search"><span className="label">Buscar cliente cadastrado</span></label>
          <input type="hidden" name="customerId" value={customerId} />
          <div className="agenda-customer-searchbox">
            <input id="agenda-customer-search" className="input" type="search" value={customerSearch}
              placeholder="Digite o nome ou telefone e selecione abaixo"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="agenda-customer-results"
              aria-expanded={customerChoicesOpen && !!customerQuery}
              onChange={event => {
                setCustomerSearch(event.target.value);
                setCustomerChoicesOpen(true);
                setWalkIn(false);
                setCustomerId("");
              }}
              onFocus={() => setCustomerChoicesOpen(true)}
              onKeyDown={event => {
                if (event.key === "Escape") setCustomerChoicesOpen(false);
                if (event.key === "Enter" && visibleCustomers.length) {
                  event.preventDefault();
                  pickCustomer(visibleCustomers[0].id);
                }
              }}
            />
            {customerQuery && customerChoicesOpen && <div id="agenda-customer-results" className="agenda-customer-results" role="listbox" aria-label="Clientes encontrados">
              {visibleCustomers.slice(0, 8).map(customer =>
                <button type="button" role="option" aria-selected={false}
                  className="agenda-customer-option" key={customer.id}
                  onClick={() => pickCustomer(customer.id)}>
                  <span><strong>{customer.name}</strong><small>{customer.phone || "Sem telefone"}</small></span>
                  <span>Selecionar</span>
                </button>
              )}
              {!visibleCustomers.length && <p className="agenda-form-hint">Nenhum cadastro encontrado. Confira o nome ou escolha atendimento avulso.</p>}
              {visibleCustomers.length > 8 && <p className="agenda-form-hint">Mostrando 8 clientes. Digite mais letras para refinar.</p>}
            </div>}
          </div>
          <div className="agenda-customer-choice-row" aria-live="polite">
            {selectedCustomer
              ? <div className="agenda-customer-picked"><span className="agenda-customer-picked-icon">{selectedCustomer.name.charAt(0).toUpperCase()}</span><span><strong>{selectedCustomer.name}</strong><small>{selectedCustomer.phone || "Sem telefone"} · Cadastro vinculado</small></span></div>
              : <span className="agenda-form-hint">{walkIn ? "Atendimento avulso selecionado. Sem histórico de cliente." : "Selecione um cliente nos resultados para vincular a visita."}</span>}
            <button type="button" className={walkIn ? "agenda-walkin-btn active" : "agenda-walkin-btn"}
              aria-pressed={walkIn} onClick={pickWalkIn}>Atendimento avulso</button>
          </div>
          {customerChoiceMissing && <p role="status" className="agenda-form-hint agenda-customer-required">Escolha um cliente encontrado ou clique em atendimento avulso antes de confirmar.</p>}
        </div>
      </section>
      <section className="agenda-booking-section">
        <div className="agenda-booking-section-heading"><span className="agenda-booking-number">02</span><div><h4>Serviços do atendimento</h4><p>Selecione o principal e adicione outros com um clique.</p></div></div>
        <label><span className="label">Serviço principal</span>
          <select className="select" name="serviceId" required value={primaryService} onChange={event => {
            const id = event.target.value;
            setPrimaryService(id);

          }}>
            <option value="" disabled>Selecione um serviço</option>
            {services.map(service => <option key={service.id} value={service.id}>{service.name + " · " + service.durationMinutes + " min · " + money(service.price)}</option>)}
          </select>
        </label>
        <div className="agenda-booking-services">
          <span className="label">Adicionar serviços extras</span>
          <div className="agenda-booking-service-options">
            {services.map(service => <button
              type="button" className="agenda-booking-service-choice" key={service.id}
              onClick={() => addService(service.id)}
              aria-label={"Adicionar " + service.name}
            ><span>+ {service.name}</span><small>{service.durationMinutes} min · {money(service.price)}</small></button>)}
            {!services.length && <small className="agenda-form-hint">Cadastre serviços para habilitar agendamentos.</small>}
          </div>
        </div>
        {extraServices.map((item, index) => <input key={item.key} type="hidden" name="serviceIds" value={item.serviceId} aria-label={"Serviço adicional " + (index + 1)} />)}
        {!!selectedServices.length && <div className="agenda-booking-chosen">
          <span className="agenda-booking-main-service">{selectedServices[0]?.name} <small>Principal</small></span>
          {extraCounts.map(({ service, count }) => <span key={service.id} className="agenda-booking-count">
            <strong>{count}× {service.name}</strong>
            <button type="button" aria-label={"Remover uma unidade de " + service.name}
              onClick={() => {
                const last = [...extraServices].reverse().find(item => item.serviceId === service.id);
                if (last) removeExtra(last.key);
              }}>−</button>
            <button type="button" aria-label={"Adicionar outra unidade de " + service.name} onClick={() => addService(service.id)}>+</button>
          </span>)}
        </div>}
        <p className="agenda-form-hint">{chosen.length} {chosen.length === 1 ? "serviço" : "serviços"} · {totalMinutes} minutos · {money(totalPrice)}. É possível repetir o mesmo serviço.</p>
      </section>
      <section className="agenda-booking-section">
        <div className="agenda-booking-section-heading"><span className="agenda-booking-number">03</span><div><h4>Quando e com quem?</h4><p>Profissional, unidade e horário reservados juntos.</p></div></div>
        <div className="grid grid-2">
          <label><span className="label">Unidade</span>
            <select name="unitId" className="select" required value={unitId} onChange={event => setUnitId(event.target.value)}>
              <option value="" disabled>Selecione a unidade</option>
              {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </label>
          <ProfessionalField key={unitId} professionals={professionals} unitId={unitId} initialBarberId={draft.barberId} />
          <label className="agenda-field-wide"><span className="label">Data e hora do atendimento</span>
            <input className="input" name="startsAt" type="datetime-local" required value={startsAt} onChange={event => setStartsAt(event.target.value)} />
          </label>
        </div>
        {rotationEnabled && <p className="agenda-form-hint">Sem preferência: o rodízio procura um profissional disponível. Conflitos são validados antes de salvar.</p>}
      </section>
      <section className="agenda-booking-section agenda-booking-final">
        <div className="agenda-booking-section-heading"><span className="agenda-booking-number">04</span><div><h4>Conferir e confirmar</h4><p>Revise os detalhes para evitar erros de recepção.</p></div></div>
        <div className="agenda-booking-total">
          <div><small>Tempo reservado</small><strong>{totalMinutes} minutos{finishAt ? " · até " + finishAt : ""}</strong></div>
          <div><small>Valor estimado</small><strong>{money(totalPrice)}</strong></div>
        </div>
        <button type="button" className="agenda-booking-notes-toggle" aria-expanded={showNotes} onClick={() => setShowNotes(!showNotes)}>
          {showNotes ? "Ocultar observações" : "+ Adicionar observação (opcional)"}
        </button>
        {showNotes ? <label><span className="label">Observações</span>
          <textarea className="input" name="notes" rows={3} maxLength={300} defaultValue={draft.notes || ""} placeholder="Preferências ou detalhes do atendimento..." />
        </label> : <input type="hidden" name="notes" value={draft.notes || ""} />}
        {tooLongForOneDay && <p role="alert" className="agenda-form-hint">A duração ultrapassa 24 horas. Divida esse atendimento em horários diferentes.</p>}
        <div className="agenda-booking-submit">
          <span>A duração e os conflitos são conferidos antes de salvar.</span>
          <AgendaSubmit disabled={tooLongForOneDay || customerChoiceMissing}>Confirmar agendamento</AgendaSubmit>
        </div>
      </section>
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
