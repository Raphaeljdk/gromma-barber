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
  FolderOpen,
  type LucideIcon,
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
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ERP_NAVIGATION, ERP_NAVIGATION_EXTRA, type ErpNavigationNode, type ErpNavigationSector } from "@/lib/erp-navigation";

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

const NAV_GROUPS: readonly ErpNavigationSector[] = ERP_NAVIGATION.map((sector) => {
  const extraRoutes: Record<string, readonly string[]> = {
    operacional: ["totem"],
    gestao: ["gerencial", "alertas"],
    marketing: ["mensagens"],
    empresa: ["documentos", "treinamentos", "configuracoes"],
  };
  const extras = ERP_NAVIGATION_EXTRA.filter((item) =>
    extraRoutes[sector.id]?.includes(item.route ?? "")
  );
  return extras.length
    ? { ...sector, items: [...sector.items, { id: `${sector.id}-extras`, label: "Outras ferramentas", children: extras }] }
    : sector;
});

const SECTOR_ICONS: Record<string, LucideIcon> = {
  operacional: LayoutDashboard,
  assinaturas: BadgeDollarSign,
  gestao: ScrollText,
  relatorios: FileText,
  marketing: Tags,
  empresa: Building2,
  financeiro: WalletCards,
};

const MODULE_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, agenda: CalendarDays, clientes: Users,
  caixa: ClipboardList, comandas: ReceiptText, estoque: PackageSearch,
  assinaturas: BadgeDollarSign, gerencial: LayoutDashboard, auditoria: ScrollText,
  relatorios: FileText, comissoes: ScrollText, promocoes: Tags, mensagens: MessageCircle,
  avaliacoes: Star, unidades: Building2, equipe: UserRoundCog, servicos: Store,
  documentos: FileText, treinamentos: BookOpenCheck, configuracoes: Settings2,
  plano: BadgeDollarSign, financeiro: WalletCards, alertas: BellRing, totem: Store,
};

function itemIncludesRoute(node: ErpNavigationNode, route: string): boolean {
  return node.route === route || Boolean(node.children?.some((child) => itemIncludesRoute(child, route)));
}


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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const active = useMemo(() => {
    const base = `/erp/${encodeURIComponent(tenantCode)}`;
    if (pathname === base || pathname === `${base}/`) return "dashboard";
    const segment = pathname.slice(base.length).split("/").filter(Boolean)[0];
    return segment || "dashboard";
  }, [pathname, tenantCode]);

  const activeGroup = NAV_GROUPS.find((group) =>
    group.items.some((item) => itemIncludesRoute(item, active))
  )?.id;

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

  function renderNavItem(item: ErpNavigationNode, depth = 0): React.ReactNode {
    if (item.adminOnly && !canManage) return null;

    const visibleChildren = item.children?.filter((child) => !child.adminOnly || canManage) ?? [];
    const hasChildren = visibleChildren.length > 0;
    const activeItem = item.route === active;
    const activeInside = hasChildren && visibleChildren.some((child) => itemIncludesRoute(child, active));
    const expanded = expandedNodes[item.id] ?? (activeInside || activeItem && hasChildren);
    const isLocked = Boolean(item.proOnly && planKey !== "PRO");
    const Icon = MODULE_ICONS[item.route ?? ""] ?? (hasChildren ? FolderOpen : FileText);
    const labelContent = <>
      {depth === 0 ? <span className="erp-nav-icon"><Icon size={18} strokeWidth={1.9} /></span> : <span className="erp-nav-depth-mark" aria-hidden="true" />}
      <span className="erp-sidebar-label">{item.label}</span>
    </>;

    const toggleChildren = () => setExpandedNodes((current) => ({ ...current, [item.id]: !expanded }));
    return <div className={["erp-nav-tree-item", depth ? "is-nested" : "", hasChildren ? "has-children" : "", expanded ? "is-expanded" : ""].join(" ")} key={item.id}>
      <div className="erp-nav-tree-row" style={{ ["--erp-depth" as string]: depth }}>
        {item.route ? (
          <Link
            href={routeFor(tenantCode, isLocked ? "plano" : item.route)}
            className={["erp-nav-item", activeItem ? "active" : "", isLocked ? "locked" : ""].join(" ")}
            onClick={() => setMobileOpen(false)}
            aria-current={activeItem ? "page" : undefined}
            title={collapsed ? item.label : undefined}
          >
            {labelContent}
            {isLocked ? <span className="erp-nav-plan-tag">PRO</span> : activeItem ? <span className="erp-nav-active-dot" /> : null}
          </Link>
        ) : hasChildren ? (
          <button type="button" className={["erp-nav-item", "erp-nav-parent-button", activeInside ? "has-active-child" : ""].join(" ")}
            aria-expanded={expanded} aria-controls={`erp-nav-children-${item.id}`}
            onClick={toggleChildren}>
            {labelContent}
          </button>
        ) : (
          <span className="erp-nav-item erp-nav-planned" title="Funcionalidade prevista para implementação">
            {labelContent}
            <span className="erp-nav-planned-tag">Previsto</span>
          </span>
        )}
        {hasChildren && item.route && (
          <button type="button" className="erp-nav-tree-toggle"
            aria-label={expanded ? `Recolher ${item.label}` : `Expandir ${item.label}`}
            aria-controls={`erp-nav-children-${item.id}`}
            aria-expanded={expanded}
            onClick={toggleChildren}><ChevronDown size={16} aria-hidden="true" /></button>
        )}
        {hasChildren && !item.route && (
          <ChevronDown className="erp-nav-tree-inline-chevron" size={15} aria-hidden="true" />
        )}
      </div>
      {hasChildren && expanded && (
        <div className="erp-nav-tree-children" id={`erp-nav-children-${item.id}`}>
          {visibleChildren.map((child) => renderNavItem(child, depth + 1))}
        </div>
      )}
    </div>;
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
          <p className="erp-nav-plan-note">Em cinza: funcionalidades previstas para as próximas etapas.</p>
          {NAV_GROUPS.map((group) => {
            const expanded = !collapsed && (expandedGroups[group.id] ?? (group.id === activeGroup || (!activeGroup && group.id === "operacional")));
            const SectorIcon = SECTOR_ICONS[group.id] ?? LayoutDashboard;
            return <div className={["erp-nav-group", "erp-nav-sector", expanded ? "is-expanded" : "", activeGroup === group.id ? "has-active-module" : ""].join(" ")} key={group.id}>
              <button
                type="button"
                className="erp-nav-sector-heading"
                aria-controls={`erp-sector-${group.id}`}
                aria-expanded={expanded}
                onClick={() => {
                  if (collapsed) setCollapsed(false);
                  setExpandedGroups((previous) => ({ ...previous, [group.id]: !expanded }));
                }}
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
                {group.items.map((item) => renderNavItem(item))}
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
