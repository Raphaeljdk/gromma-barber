"use client";

import Link from "next/link";
import {
  BadgeDollarSign,
  BellRing,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  PackageSearch,
  ReceiptText,
  ScrollText,
  Settings2,
  Star,
  Store,
  Tags,
  Users,
  UserRoundCog,
  WalletCards,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  business: string;
  tenantCode: string;
  city: string;
  state: string;
  units: number;
  users: number;
  planKey: "ESSENTIAL" | "PRO";
  planName: string;
  planPrice: string;
  email: string;
  viewerType: "TENANT" | "ADMIN";
  canManage: boolean;
  supportHref: string;
  logoutAction?: () => Promise<void>;
};

const NAV_GROUPS = [
  {
    id: "operacional",
    label: "Operacional",
    description: "Atendimento e rotina",
    icon: LayoutDashboard,
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "agenda", label: "Agenda", icon: CalendarDays },
      { id: "clientes", label: "Clientes", icon: Users },
      { id: "caixa", label: "Caixa", icon: ClipboardList },
      { id: "estoque", label: "Estoque", icon: PackageSearch },
      { id: "totem", label: "Totem / Check-in", icon: Store, proOnly: true },
    ],
  },
  {
    id: "assinaturas",
    label: "Assinaturas",
    description: "Clube e recorrência",
    icon: BadgeDollarSign,
    items: [
      { id: "assinaturas", label: "Clube / Assinaturas", icon: BadgeDollarSign },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    description: "Acompanhamento e controle",
    icon: LayoutDashboard,
    items: [
      { id: "gerencial", label: "Gerencial", icon: LayoutDashboard },
      { id: "auditoria", label: "Auditoria", icon: ScrollText },
      { id: "alertas", label: "Alertas", icon: BellRing },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    description: "Resultados e produtividade",
    icon: FileText,
    items: [
      { id: "relatorios", label: "Relatórios", icon: FileText },
      { id: "comissoes", label: "Comissões", icon: ScrollText },
    ],
  },
  {
    id: "marketing",
    label: "Marketing e Promoções",
    description: "Relacionamento e fidelização",
    icon: Tags,
    items: [
      { id: "promocoes", label: "Promoções / Cupons", icon: Tags },
      { id: "mensagens", label: "Mensagens", icon: MessageCircle },
      { id: "avaliacoes", label: "Avaliações", icon: Star },
    ],
  },
  {
    id: "empresa",
    label: "Empresa",
    description: "Cadastros e configurações",
    icon: Building2,
    items: [
      { id: "unidades", label: "Unidades / Filiais", icon: Building2 },
      { id: "equipe", label: "Profissionais", icon: UserRoundCog },
      { id: "servicos", label: "Serviços", icon: Store },
      { id: "documentos", label: "Documentos", icon: FileText },
      { id: "treinamentos", label: "Tutoriais / Cursos", icon: BookOpenCheck },
      { id: "configuracoes", label: "Configurações", icon: Settings2 },
      { id: "plano", label: "Meu plano", icon: BadgeDollarSign },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Receitas e despesas",
    icon: WalletCards,
    items: [
      { id: "financeiro", label: "Financeiro", icon: WalletCards },
    ],
  },
] as const;

function routeFor(tenantCode: string, id: string) {
  const base = `/erp/${encodeURIComponent(tenantCode)}`;
  if (id === "dashboard") return base;
  return `${base}/${id}`;
}

export function ErpSidebar({
  business,
  tenantCode,
  city,
  state,
  units,
  users,
  planKey,
  planName,
  planPrice,
  email,
  viewerType,
  canManage,
  supportHref,
  logoutAction,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cashOpenOverride, setCashOpenOverride] = useState<boolean | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const active = useMemo(() => {
    const base = `/erp/${encodeURIComponent(tenantCode)}`;
    if (pathname === base || pathname === `${base}/`) return "dashboard";
    const segment = pathname.slice(base.length).split("/").filter(Boolean)[0];
    return segment || "dashboard";
  }, [pathname, tenantCode]);

  const activeGroup = NAV_GROUPS.find((group) =>
    group.items.some((item) => item.id === active || (item.id === "caixa" && active === "comandas"))
  )?.id;
  const cashExpanded = cashOpenOverride ?? (active === "caixa" || active === "comandas");

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/login");
  }

  return (
    <>
      <button
        className="erp-mobile-trigger"
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu do ERP"
        aria-expanded={mobileOpen}
        aria-controls="erp-mobile-navigation"
      >
        <Menu size={20} />
        <span>Menu</span>
      </button>

      {mobileOpen && (
        <button
          className="erp-sidebar-overlay"
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        id="erp-mobile-navigation"
        aria-label="Navegação do ERP"
        className={[
          "demo-sidebar",
          "erp-sidebar",
          collapsed ? "is-collapsed" : "",
          mobileOpen ? "is-mobile-open" : "",
        ].join(" ")}
      >
        <div className="erp-sidebar-head">
          <Link href="/" className="brand erp-brand" title="GROMMA BARBER">
            <span className="brand-mark">G</span>
            <span className="erp-sidebar-label">GROMMA</span>
          </Link>

          <button
            type="button"
            className="erp-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={19} />
          </button>

          <button
            type="button"
            className="erp-collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>

        <div className="erp-company-card">
          <div className="erp-company-logo">{business.slice(0, 1).toUpperCase()}</div>
          <div className="erp-company-copy">
            <div className="erp-company-title-row">
              <strong>{business}</strong>
              <span className="erp-online-dot" title="Tenant ativo" />
            </div>
            <small>{city}/{state} · {units} {units === 1 ? "unidade" : "unidades"} · {users} usuários</small>
          </div>
        </div>

        <div className="erp-sidebar-shortcuts">
          <button type="button" onClick={goBack} title="Voltar">
            <ChevronLeft size={16} />
            <span className="erp-sidebar-label">Voltar</span>
          </button>
          <a href={supportHref} title="Enviar mensagem para o suporte">
            <MessageCircle size={16} />
            <span className="erp-sidebar-label">Suporte</span>
          </a>
        </div>

        <nav className="erp-nav" aria-label="Módulos do ERP">
          {NAV_GROUPS.map((group) => {
            const expanded = collapsed || (expandedGroups[group.id] ?? (group.id === activeGroup || (!activeGroup && group.id === "operacional")));
            const SectorIcon = group.icon;
            return <div className={["erp-nav-group", "erp-nav-sector", expanded ? "is-expanded" : "", activeGroup === group.id ? "has-active-module" : ""].join(" ")} key={group.id}>
              <button
                type="button"
                className="erp-nav-sector-heading"
                aria-controls={`erp-sector-${group.id}`}
                aria-expanded={expanded}
                onClick={() => setExpandedGroups((previous) => ({ ...previous, [group.id]: !expanded }))}
                title={group.label}
              >
                <SectorIcon size={17} strokeWidth={1.8} aria-hidden="true" />
                <span className="erp-nav-sector-copy">
                  <strong>{group.label}</strong>
                  <small>{group.description}</small>
                </span>
                <ChevronDown className="erp-nav-sector-chevron" size={16} aria-hidden="true" />
              </button>
              {expanded && <div className="erp-nav-sector-items" id={`erp-sector-${group.id}`}>
                {group.items.map((item) => {
                if (item.id === "auditoria" && !canManage) return null;
                const Icon = item.icon;
                const isActive = active === item.id;
                const isLocked = "proOnly" in item && item.proOnly && planKey !== "PRO";
                const href = isLocked
                  ? routeFor(tenantCode, "plano")
                  : routeFor(tenantCode, item.id);

                const link = (
                  <Link
                    href={href}
                    className={[
                      "erp-nav-item",
                      isActive ? "active" : "",
                      isLocked ? "locked" : "",
                    ].join(" ")}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="erp-nav-icon">
                      <Icon size={18} strokeWidth={1.9} />
                    </span>
                    <span className="erp-sidebar-label">{item.label}</span>
                    {isLocked ? (
                      <span className="erp-nav-plan-tag">PRO</span>
                    ) : isActive ? (
                      <span className="erp-nav-active-dot" />
                    ) : null}
                  </Link>
                );
                if (item.id === "caixa") return (
                  <Fragment key={item.id}>
                    <div className={["erp-nav-cash-parent", active === "comandas" ? "has-active-child" : ""].join(" ")}>
                      {link}
                      <button type="button" className="erp-nav-cash-toggle"
                        aria-label={cashExpanded ? "Recolher submenu de Caixa" : "Expandir submenu de Caixa"}
                        aria-expanded={cashExpanded} aria-controls="erp-nav-cash-children"
                        title="Expandir ou recolher comandas do caixa"
                        onClick={() => setCashOpenOverride(!cashExpanded)}>
                        <ChevronDown size={17} aria-hidden="true" />
                      </button>
                    </div>
                    {cashExpanded && <div id="erp-nav-cash-children" className="erp-nav-cash-children">
                      <Link href={routeFor(tenantCode, "comandas")}
                        className={["erp-nav-subitem", active === "comandas" ? "active" : ""].join(" ")}
                        aria-current={active === "comandas" ? "page" : undefined}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? "Comandas" : undefined}>
                        <ReceiptText size={16} strokeWidth={1.9} />
                        <span className="erp-sidebar-label">Comandas</span>
                        {active === "comandas" && <span className="erp-nav-active-dot" />}
                      </Link>
                    </div>}
                  </Fragment>
                );
                return <Fragment key={item.id}>{link}</Fragment>;
                })}
              </div>}
            </div>;
          })}
        </nav>

        <div className="erp-sidebar-bottom">
          <div className="erp-plan-summary">
            <div>
              <span className="erp-plan-kicker">Plano atual</span>
              <strong>{planName}</strong>
            </div>
            <span className={planKey === "PRO" ? "erp-plan-badge pro" : "erp-plan-badge"}>
              {planKey}
            </span>
            <small>{planPrice}/mês</small>
          </div>

          <div className="erp-user-card">
            <div className="erp-user-avatar">{email.slice(0, 1).toUpperCase()}</div>
            <div className="erp-user-copy">
              <strong>{viewerType === "ADMIN" ? "Administrador" : "Proprietário"}</strong>
              <span>{email}</span>
            </div>

            {viewerType === "TENANT" && logoutAction ? (
              <form action={logoutAction}>
                <button className="erp-logout" type="submit" title="Sair">
                  <LogOut size={17} />
                </button>
              </form>
            ) : (
              <Link className="erp-logout" href="/admin/barbearias" title="Voltar ao admin">
                <LogOut size={17} />
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
