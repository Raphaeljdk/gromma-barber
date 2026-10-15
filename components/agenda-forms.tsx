"use client";

import { useRef, useState, useTransition } from "react";
import { createAppointment, registerAgendaCustomer } from "@/app/erp/[tenant]/actions";
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
  const [registeredCustomer, setRegisteredCustomer] = useState<AgendaCustomer | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationName, setRegistrationName] = useState("");
  const [registrationPhone, setRegistrationPhone] = useState("");
  const [registrationError, setRegistrationError] = useState("");
  const [registering, startRegistration] = useTransition();
  const [startsAt, setStartsAt] = useState(draft.startsAt);
  const [showNotes, setShowNotes] = useState(Boolean(draft.notes));
  const chosen = [primaryService, ...extraServices.map(item => item.serviceId)].filter(Boolean);
  const selectedServices = chosen.map(id => services.find(service => service.id === id)).filter((item): item is AgendaService => Boolean(item));
  const totalMinutes = selectedServices.reduce((sum, item) => sum + item.durationMinutes, 0);
  const totalPrice = selectedServices.reduce((sum, item) => sum + item.price, 0);
  const customerQuery = customerSearch.trim().toLocaleLowerCase("pt-BR");
  const normalizedPhoneQuery = customerQuery.replace(/\D/g, "");
  const visibleCustomers = customerQuery
    ? customers.filter(customer =>
        [customer.name, customer.phone || ""].some(value => value.toLocaleLowerCase("pt-BR").includes(customerQuery))
        || (normalizedPhoneQuery.length > 0 && !/[a-z]/i.test(customerQuery) && (customer.phone || "").replace(/\D/g, "").includes(normalizedPhoneQuery))
      )
    : [];
  const selectedCustomer = customers.find(item => item.id === customerId) ??
    (registeredCustomer?.id === customerId ? registeredCustomer : null);
  const customerChoiceMissing = !selectedCustomer;
  function pickCustomer(id: string) {
    setCustomerId(id);
    setCustomerSearch("");
    setCustomerChoicesOpen(false);
  }
  function saveNewCustomer() {
    setRegistrationError("");
    startRegistration(async () => {
      try {
        const result = await registerAgendaCustomer({
          tenantCode: context.tenantCode, name: registrationName, phone: registrationPhone, unitId,
        });
        if (!result.ok) { setRegistrationError(result.error); return; }
        setRegisteredCustomer(result.customer);
        pickCustomer(result.customer.id);
        setRegistrationOpen(false);
        setRegistrationName("");
        setRegistrationPhone("");
      } catch {
        setRegistrationError("Não foi possível cadastrar. Verifique a conexão e tente novamente.");
      }
    });
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
  function removePrimary() {
    if (extraServices.length) {
      setPrimaryService(extraServices[0].serviceId);
      setExtraServices(previous => previous.slice(1));
    } else {
      setPrimaryService("");
    }
  }
  const tooLongForOneDay = totalMinutes > 24 * 60;

  return (
    <form action={createAppointment} className="erp-quick-form agenda-modal-form agenda-booking-form">
      <AgendaContextFields context={context} />
      {draft.waitlistId && <input type="hidden" name="waitlistId" value={draft.waitlistId} />}
      {draft.waitlistId && <p className="agenda-form-hint agenda-booking-alert">Encaixe da fila: o cliente só sairá da lista quando o atendimento for salvo.</p>}
      <section className="agenda-booking-section">
        <div className="agenda-booking-section-heading"><span className="agenda-booking-number">01</span><div><h4>Cliente e horário</h4><p>Encontre o cliente e escolha unidade, data, horário e profissional.</p></div></div>
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
              {!visibleCustomers.length && <p className="agenda-form-hint">Cliente não encontrado. Use Cadastrar cliente abaixo.</p>}
              {visibleCustomers.length > 8 && <p className="agenda-form-hint">Mostrando 8 clientes. Digite mais letras para refinar.</p>}
            </div>}
          </div>
          <div className="agenda-customer-choice-row" aria-live="polite">
            {selectedCustomer
              ? <div className="agenda-customer-picked"><span className="agenda-customer-picked-icon">{selectedCustomer.name.charAt(0).toUpperCase()}</span><span><strong>{selectedCustomer.name}</strong><small>{selectedCustomer.phone || "Sem telefone"} · Cadastro vinculado</small></span></div>
              : <span className="agenda-form-hint">Selecione um cliente existente ou cadastre um novo sem sair da agenda.</span>}
            <button type="button" className="agenda-walkin-btn" onClick={() => {
              setRegistrationName(customerSearch && !/\d/.test(customerSearch) ? customerSearch : "");
              setRegistrationOpen(true); setCustomerChoicesOpen(false); setRegistrationError("");
            }}>+ Cadastrar cliente</button>
          </div>
          {customerChoiceMissing && <p role="status" className="agenda-form-hint agenda-customer-required">Selecione ou cadastre um cliente antes de confirmar.</p>}
          {registrationOpen && <div className="agenda-customer-registration-backdrop" role="presentation">
            <div role="dialog" aria-modal="true" aria-labelledby="agenda-new-customer-title" className="agenda-customer-registration"
              onKeyDown={event => {
                if (event.key === "Escape") { event.preventDefault(); setRegistrationOpen(false); }
                if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
                  event.preventDefault();
                  if (!registering && registrationName.trim().length >= 2 && registrationPhone.replace(/\\D/g, "").length >= 10) saveNewCustomer();
                }
              }}>
              <div className="agenda-customer-registration-head">
                <div><strong id="agenda-new-customer-title">Cadastrar cliente</strong><small>O cliente ficará vinculado ao agendamento.</small></div>
                <button type="button" aria-label="Fechar cadastro" onClick={() => setRegistrationOpen(false)}>×</button>
              </div>
              <label><span className="label">Nome do cliente</span>
                <input className="input" autoFocus value={registrationName} maxLength={120} autoComplete="off"
                  onChange={event => setRegistrationName(event.target.value)} placeholder="Nome e sobrenome" />
              </label>
              <label><span className="label">Telefone com DDD</span>
                <input className="input" type="tel" inputMode="tel" value={registrationPhone} maxLength={40}
                  onChange={event => setRegistrationPhone(event.target.value)} placeholder="(11) 99999-9999" />
              </label>
              {registrationError && <p role="alert" className="notice error-notice">{registrationError}</p>}
              <div className="agenda-customer-registration-actions">
                <button type="button" className="btn secondary" disabled={registering} onClick={() => setRegistrationOpen(false)}>Voltar</button>
                <button type="button" className="btn" disabled={registering || registrationName.trim().length < 2 || registrationPhone.replace(/\D/g, "").length < 10}
                  onClick={saveNewCustomer}>{registering ? "Salvando..." : "Salvar e selecionar cliente"}</button>
              </div>
            </div>
          </div>}
        </div>
        <div className="agenda-booking-timing">
          <div className="agenda-booking-section-heading"><div><h4>Unidade, horário e profissional</h4><p>Todos os dados do agendamento no mesmo lugar.</p></div></div>
          <div className="grid grid-2">
            <label><span className="label">Unidade</span>
              <select name="unitId" className="select" required value={unitId} onChange={event => setUnitId(event.target.value)}>
                <option value="" disabled>Selecione a unidade</option>
                {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </label>
            <label><span className="label">Data e hora do atendimento</span>
              <input className="input" name="startsAt" type="datetime-local" required value={startsAt} onChange={event => setStartsAt(event.target.value)} />
            </label>
            <div className="agenda-field-wide">
              <ProfessionalField key={unitId} professionals={professionals} unitId={unitId} initialBarberId={draft.barberId} />
            </div>
          </div>
          {rotationEnabled && <p className="agenda-form-hint">Sem preferência: o rodízio procura um profissional disponível. Conflitos são validados antes de salvar.</p>}
        </div>
      </section>
      <section className="agenda-booking-section">
        <div className="agenda-booking-section-heading"><span className="agenda-booking-number">02</span><div><h4>Serviços do atendimento</h4><p>Selecione o principal e adicione outros com um clique.</p></div></div>
        <div className="agenda-booking-service-entry">
          <label><span className="label">Selecionar serviço</span>
            <select className="select" defaultValue="" onChange={event => { if (event.target.value) addService(event.target.value); event.target.value = ""; }}>
              <option value="">Selecione para adicionar automaticamente</option>
              {services.map(service => <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes} min · {money(service.price)}</option>)}
            </select>
          </label>
        </div>
        <input type="hidden" name="serviceId" value={primaryService} />
        {extraServices.map((item, index) => <input key={item.key} type="hidden" name="serviceIds" value={item.serviceId} aria-label={"Serviço adicional " + (index + 1)} />)}
        <div className="agenda-booking-service-list" aria-live="polite">
          <div className="agenda-booking-section-heading"><div><h4>Serviços inseridos</h4><p>{chosen.length ? chosen.length + " selecionado(s)" : "Selecione um serviço acima para adicioná-lo"}</p></div></div>
          {primaryService && (() => {
            const service = services.find(item => item.id === primaryService);
            return service && <div className="agenda-service-line">
              <span><strong>{service.name}</strong><small>{service.durationMinutes} min · {money(service.price)} · Principal</small></span>
              <button type="button" aria-label={"Excluir " + service.name} onClick={removePrimary}>Excluir</button>
            </div>;
          })()}
          {extraServices.map(item => {
            const service = services.find(option => option.id === item.serviceId);
            return service && <div className="agenda-service-line" key={item.key}>
              <span><strong>{service.name}</strong><small>{service.durationMinutes} min · {money(service.price)}</small></span>
              <button type="button" aria-label={"Excluir " + service.name} onClick={() => removeExtra(item.key)}>Excluir</button>
            </div>;
          })}
        </div>
        <p className="agenda-form-hint">Serviços sem limite de quantidade; duração e preço são somados automaticamente.</p>
      </section>
      <section className="agenda-booking-section agenda-booking-final">
        <div className="agenda-booking-section-heading"><span className="agenda-booking-number">03</span><div><h4>Conferir e confirmar</h4><p>Revise os detalhes para evitar erros de recepção.</p></div></div>
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
          <AgendaSubmit disabled={tooLongForOneDay || customerChoiceMissing || !primaryService}>Confirmar agendamento</AgendaSubmit>
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
