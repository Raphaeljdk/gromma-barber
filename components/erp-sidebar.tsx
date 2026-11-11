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
import { ERP_NAVIGATION, ERP_NAVIGATION_EXTRA, primaryNavigationItemId, type ErpNavigationNode, type ErpNavigationSector } from "@/lib/erp-navigation";

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
  isOwner: boolean;
  notificationCount: number;
  supportHref: string;
  logoutAction?: () => Promise<void>;
};

const NAV_GROUPS: readonly ErpNavigationSector[] = [...ERP_NAVIGATION]
  .sort((left,right)=>left.id==="gestao"&&right.id==="assinaturas"?-1:
    left.id==="assinaturas"&&right.id==="gestao"?1:0)
  .map((sector) => {
  const extraRoutes: Record<string, readonly string[]> = {
    gestao: ["gerencial", "alertas"],
    marketing: ["mensagens"],
    empresa: ["documentos", "treinamentos", "configuracoes"],
  };
  const extras = ERP_NAVIGATION_EXTRA.filter((item) =>
    extraRoutes[sector.id]?.includes(item.route ?? "")
  );
  // Keep every existing module reachable, but remove the nested
  // "Outras ferramentas" section: extras are now direct sector links.
  return extras.length ? { ...sector, items: [...sector.items, ...extras] } : sector;
});

const SECTOR_ICONS: Record<string, LucideIcon> = {
  operacional: LayoutDashboard,
  assinaturas: BadgeDollarSign,
  gestao: ScrollText,
  marketing: Tags,
  empresa: Building2,
  financeiro: WalletCards,
  totem: Store,
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

function itemIncludesNavId(node: ErpNavigationNode, id: string | undefined): boolean {
  return Boolean(id) && (node.id === id || Boolean(node.children?.some((child) => itemIncludesNavId(child, id))));
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
  isOwner,
  notificationCount,
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

  const activeNavItemId = useMemo(() => primaryNavigationItemId(active), [active]);
  const activeGroup = NAV_GROUPS.find((group) =>
    group.items.some((item) => itemIncludesNavId(item, activeNavItemId))
  )?.id;

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function goBack() {
    setMobileOpen(false);
    if (window.history.length > 1) router.back();
    else router.push("/login");
  }

  function renderNavItem(item: ErpNavigationNode, depth = 0, alwaysVisible = false): React.ReactNode {
    if ((item.adminOnly && !canManage) || (item.ownerOnly && !isOwner)) return null;

    // Profissionais e Serviços têm uma única entrada no menu. Cadastro,
    // edição e destaque continuam acessíveis dentro de suas páginas.
    const compactModule = item.id === "empresa-profissionais" || item.id === "empresa-servicos";
    const visibleChildren = compactModule ? [] :
      item.children?.filter((child) => (!child.adminOnly || canManage) && (!child.ownerOnly || isOwner)) ?? [];
    const hasChildren = visibleChildren.length > 0;
    const activeItem = item.id === activeNavItemId;
    const activeInside = hasChildren && visibleChildren.some((child) => itemIncludesNavId(child, activeNavItemId));
    const expanded = alwaysVisible || (expandedNodes[item.id] ?? (activeInside || activeItem && hasChildren));
    const isLocked = Boolean(item.proOnly && planKey !== "PRO");
    const Icon = MODULE_ICONS[item.route ?? ""] ?? (hasChildren ? FolderOpen : FileText);
    const labelContent = <>
      {depth === 0 ? <span className="erp-nav-icon"><Icon size={18} strokeWidth={1.9} /></span> : <span className="erp-nav-depth-mark" aria-hidden="true" />}
      <span className="erp-sidebar-label">{item.label}</span>
    </>;

    const toggleChildren = () => {if(!alwaysVisible)setExpandedNodes((current) => ({ ...current, [item.id]: !expanded }));};
    return <div className={["erp-nav-tree-item", depth ? "is-nested" : "", hasChildren ? "has-children" : "", expanded ? "is-expanded" : ""].join(" ")} key={item.id}>
      <div className="erp-nav-tree-row" style={{ ["--erp-depth" as string]: depth }}>
        {item.route ? (
          <Link
            href={routeFor(tenantCode, isLocked ? "plano" : item.route)}
            prefetch={true}
            onMouseEnter={() => router.prefetch(routeFor(tenantCode, isLocked ? "plano" : item.route!))}
            onFocus={() => router.prefetch(routeFor(tenantCode, isLocked ? "plano" : item.route!))}
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
        {hasChildren && item.route && !alwaysVisible && (
          <button type="button" className="erp-nav-tree-toggle"
            aria-label={expanded ? `Recolher ${item.label}` : `Expandir ${item.label}`}
            aria-controls={`erp-nav-children-${item.id}`}
            aria-expanded={expanded}
            onClick={toggleChildren}><ChevronDown size={16} aria-hidden="true" /></button>
        )}
        {hasChildren && !item.route && !alwaysVisible && (
          <ChevronDown className="erp-nav-tree-inline-chevron" size={15} aria-hidden="true" />
        )}
      </div>
      {hasChildren && expanded && (
        <div className="erp-nav-tree-children" id={`erp-nav-children-${item.id}`}>
          {visibleChildren.map((child) => renderNavItem(child, depth + 1, alwaysVisible))}
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

        <div className="gromma-sidebar-business">
          <span className="gromma-sidebar-monogram" aria-hidden="true">{business.slice(0,1).toUpperCase()}</span>
          <span className="gromma-sidebar-business-copy">
            <strong title={business}>{business}</strong>
            <small>{city}/{state} · {units} {units === 1 ? "filial" : "filiais"}</small>
          </span>
        </div>
        <div className="gromma-sidebar-quicklinks">
          {isOwner && <Link href={routeFor(tenantCode,"notificacoes")} onClick={()=>setMobileOpen(false)} title="Notificações da empresa"><BellRing size={16}/><span className="erp-sidebar-label">Avisos {notificationCount>0?`(${notificationCount})`:""}</span></Link>}
          <a href={supportHref} title="Suporte"><MessageCircle size={16}/><span className="erp-sidebar-label">Suporte</span></a>
          <button type="button" onClick={goBack} title="Voltar"><ChevronLeft size={16}/><span className="erp-sidebar-label">Voltar</span></button>
        </div>

        <nav className="erp-nav" aria-label="Módulos do ERP">
          {NAV_GROUPS.map((group) => {
            // A single permanent link below Financeiro, not a new expandable
            // menu section. Respect the existing PRO permission in renderNavItem.
            if (group.id === "totem") return <div className="erp-nav-standalone" key={group.id}>
              {group.items.map(item => renderNavItem(item))}
            </div>;
            const alwaysVisible = group.id === "operacional" || group.id === "gestao";
            const expanded = !collapsed && (alwaysVisible || (expandedGroups[group.id] ?? group.id === activeGroup));
            const SectorIcon = SECTOR_ICONS[group.id] ?? LayoutDashboard;
            return <div className={["erp-nav-group", "erp-nav-sector", expanded ? "is-expanded" : "", activeGroup === group.id ? "has-active-module" : ""].join(" ")} key={group.id} data-sector={group.id}>
              <button
                type="button"
                className="erp-nav-sector-heading"
                aria-controls={`erp-sector-${group.id}`}
                aria-expanded={expanded}
                onClick={() => {
                  if (collapsed) setCollapsed(false);
                  if (!alwaysVisible)setExpandedGroups((previous) => ({ ...previous, [group.id]: !expanded }));
                }}
                title={group.label}
              >
                <SectorIcon size={17} strokeWidth={1.8} aria-hidden="true" />
                <span className="erp-nav-sector-copy">
                  <strong>{group.label}</strong>
                  <small>{group.description}</small>
                </span>
                {!alwaysVisible && <ChevronDown className="erp-nav-sector-chevron" size={16} aria-hidden="true" />}
              </button>
              {expanded && <div className="erp-nav-sector-items" id={`erp-sector-${group.id}`}>
                {group.items.map((item) => renderNavItem(item, 0, alwaysVisible))}
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
