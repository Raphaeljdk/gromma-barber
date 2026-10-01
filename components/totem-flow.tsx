"use client";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Scissors,
  Search,
  Smartphone,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
};

type Appointment = {
  customerId: string | null;
  startsAt: string;
  status: string;
  serviceName: string | null;
};

type Props = {
  business: string;
  tenantCode: string;
  customers: Customer[];
  appointments: Appointment[];
};

type DemoScenario = "NEW" | "REGISTERED" | "NO_PLAN" | "ACTIVE_PLAN" | "LATE_PLAN";

const DEMO_SCENARIOS: Array<{
  key: DemoScenario;
  title: string;
  description: string;
}> = [
  { key: "NEW", title: "Cliente sem cadastro", description: "Cadastro rápido antes do agendamento." },
  { key: "REGISTERED", title: "Cliente com cadastro", description: "Identificação e escolha do atendimento." },
  { key: "NO_PLAN", title: "Agendado sem plano", description: "Check-in normal sem assinatura ativa." },
  { key: "ACTIVE_PLAN", title: "Plano ativo", description: "Check-in liberado com benefício de assinatura." },
  { key: "LATE_PLAN", title: "Plano atrasado", description: "Regularização antes de concluir o fluxo." },
];

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function TotemFlow({ business, tenantCode, customers, appointments }: Props) {
  const [screen, setScreen] = useState<"home" | "identify" | "new" | "found" | "schedule" | "done" | "demo">("home");
  const [query, setQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<DemoScenario | null>(null);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );

  const selectedAppointment = useMemo(
    () =>
      appointments.find(
        (appointment) =>
          appointment.customerId === selectedCustomerId &&
          !["COMPLETED", "CANCELED", "NO_SHOW"].includes(appointment.status),
      ) ?? null,
    [appointments, selectedCustomerId],
  );

  function identify() {
    const normalized = digits(query);
    const found = customers.find((customer) => {
      const phone = digits(customer.phone ?? "");
      return normalized.length >= 4 && phone.endsWith(normalized.slice(-8));
    });

    if (found) {
      setSelectedCustomerId(found.id);
      setScreen("found");
      return;
    }

    setSelectedCustomerId(null);
    setScreen("new");
  }

  function reset() {
    setQuery("");
    setSelectedCustomerId(null);
    setScenario(null);
    setScreen("home");
  }

  return (
    <div className="totem-stage">
      <header className="totem-brandbar">
        <div className="totem-brandmark">{business.slice(0, 1).toUpperCase()}</div>
        <div>
          <strong>{business}</strong>
          <span>{tenantCode} · Autoatendimento</span>
        </div>
        {screen !== "home" && (
          <button type="button" className="totem-back" onClick={() => setScreen("home")}>
            <ArrowLeft size={18} /> Início
          </button>
        )}
      </header>

      {screen === "home" && (
        <section className="totem-screen">
          <div className="totem-screen-copy">
            <span className="eyebrow">Bem-vindo</span>
            <h1>Como podemos ajudar?</h1>
            <p>Identifique-se para agendar, consultar seu atendimento ou realizar o check-in.</p>
          </div>

          <div className="totem-action-grid">
            <button type="button" className="totem-action primary" onClick={() => setScreen("identify")}>
              <Smartphone size={28} />
              <strong>Já sou cliente</strong>
              <span>Entrar com telefone ou CPF</span>
            </button>
            <button type="button" className="totem-action" onClick={() => setScreen("new")}>
              <UserPlus size={28} />
              <strong>Primeiro acesso</strong>
              <span>Fazer cadastro e agendar</span>
            </button>
            <button type="button" className="totem-action" onClick={() => setScreen("identify")}>
              <CheckCircle2 size={28} />
              <strong>Fazer check-in</strong>
              <span>Tenho um agendamento</span>
            </button>
            <button type="button" className="totem-action" onClick={() => setScreen("schedule")}>
              <CalendarDays size={28} />
              <strong>Novo agendamento</strong>
              <span>Consultar horários disponíveis</span>
            </button>
          </div>

          <button type="button" className="totem-demo-link" onClick={() => setScreen("demo")}>
            Abrir cenários de validação
          </button>
        </section>
      )}

      {screen === "identify" && (
        <section className="totem-screen compact">
          <div className="totem-screen-copy">
            <span className="eyebrow">Identificação</span>
            <h1>Informe seu telefone ou CPF.</h1>
            <p>Para o piloto atual, a busca real utiliza o telefone cadastrado no tenant.</p>
          </div>

          <div className="totem-form-card">
            <label>
              <span>Telefone ou CPF</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Digite seus dados"
                inputMode="numeric"
                autoFocus
              />
            </label>
            <button type="button" className="btn full" onClick={identify}>
              <Search size={17} /> Identificar cliente
            </button>
          </div>
        </section>
      )}

      {screen === "new" && (
        <section className="totem-screen compact">
          <div className="totem-screen-copy">
            <span className="eyebrow">Novo cliente</span>
            <h1>Cadastro rápido.</h1>
            <p>Fluxo preparado para nome, telefone, CPF, e-mail e data de nascimento.</p>
          </div>

          <div className="totem-form-card grid">
            <label><span>Nome completo</span><input placeholder="Nome do cliente" /></label>
            <div className="grid grid-2">
              <label><span>Telefone</span><input placeholder="(00) 00000-0000" /></label>
              <label><span>CPF</span><input placeholder="000.000.000-00" /></label>
            </div>
            <label><span>E-mail</span><input type="email" placeholder="cliente@email.com" /></label>
            <label><span>Data de nascimento</span><input type="date" /></label>
            <div className="totem-validation-note">
              Este formulário valida a experiência visual; persistência de CPF/data de nascimento será adicionada ao modelo de cliente.
            </div>
            <button type="button" className="btn full" onClick={() => setScreen("schedule")}>
              Continuar para agendamento
            </button>
          </div>
        </section>
      )}

      {screen === "found" && selectedCustomer && (
        <section className="totem-screen compact">
          <div className="totem-success-icon"><Users size={30} /></div>
          <div className="totem-screen-copy">
            <span className="eyebrow">Cliente identificado</span>
            <h1>Olá, {selectedCustomer.name}.</h1>
            <p>
              {selectedAppointment
                ? "Encontramos um atendimento vinculado ao seu cadastro."
                : "Seu cadastro foi localizado. Você pode seguir para um novo agendamento."}
            </p>
          </div>

          {selectedAppointment ? (
            <div className="totem-appointment-card">
              <div><CalendarDays size={20} /><span>Data</span><strong>{new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(selectedAppointment.startsAt))}</strong></div>
              <div><Scissors size={20} /><span>Serviço</span><strong>{selectedAppointment.serviceName ?? "Atendimento"}</strong></div>
              <div><Clock3 size={20} /><span>Status</span><strong>{selectedAppointment.status}</strong></div>
              <button type="button" className="btn full" onClick={() => setScreen("done")}>Confirmar check-in</button>
            </div>
          ) : (
            <button type="button" className="btn" onClick={() => setScreen("schedule")}>Fazer agendamento</button>
          )}
        </section>
      )}

      {screen === "schedule" && (
        <section className="totem-screen compact">
          <div className="totem-screen-copy">
            <span className="eyebrow">Agendamento</span>
            <h1>Escolha seu próximo atendimento.</h1>
            <p>A grade abaixo representa a etapa de escolha. A gravação na agenda será conectada ao fluxo oficial do ERP.</p>
          </div>

          <div className="totem-slots">
            {["Hoje · 14:00","Hoje · 15:30","Hoje · 17:00","Amanhã · 10:00","Amanhã · 11:30","Amanhã · 14:30"].map((slot) => (
              <button key={slot} type="button" onClick={() => setScreen("done")}>{slot}</button>
            ))}
          </div>
        </section>
      )}

      {screen === "done" && (
        <section className="totem-screen compact centered">
          <div className="totem-success-icon success"><CheckCircle2 size={34} /></div>
          <div className="totem-screen-copy">
            <span className="eyebrow">Concluído</span>
            <h1>Atendimento confirmado.</h1>
            <p>Fluxo finalizado no ambiente de validação do GROMMA.</p>
          </div>
          <button type="button" className="btn" onClick={reset}>Voltar ao início</button>
        </section>
      )}

      {screen === "demo" && (
        <section className="totem-screen">
          <div className="totem-screen-copy">
            <span className="eyebrow">Modo apresentação</span>
            <h1>Fluxos previstos no Totem.</h1>
            <p>Selecione um cenário para validar a experiência sem alterar dados do tenant.</p>
          </div>

          <div className="totem-scenario-grid">
            {DEMO_SCENARIOS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={scenario === item.key ? "totem-scenario active" : "totem-scenario"}
                onClick={() => setScenario(item.key)}
              >
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>

          {scenario && (
            <div className="totem-scenario-result">
              {scenario === "NEW" && (
                <><UserPlus size={24} /><div><strong>Solicitar cadastro</strong><span>Cadastrar cliente e seguir para agendamento.</span></div></>
              )}
              {scenario === "REGISTERED" && (
                <><Users size={24} /><div><strong>Cliente reconhecido</strong><span>Permitir agendamento ou consulta do atendimento.</span></div></>
              )}
              {scenario === "NO_PLAN" && (
                <><CheckCircle2 size={24} /><div><strong>Check-in liberado</strong><span>Cliente segue normalmente sem benefício de assinatura.</span></div></>
              )}
              {scenario === "ACTIVE_PLAN" && (
                <><CreditCard size={24} /><div><strong>Plano ativo</strong><span>Check-in liberado e benefícios do plano podem ser aplicados.</span></div></>
              )}
              {scenario === "LATE_PLAN" && (
                <><CreditCard size={24} /><div><strong>Plano atrasado</strong><span>Orientar regularização antes de aplicar benefícios da assinatura.</span></div></>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
