"use client";

import {
  BadgeDollarSign,
  BellRing,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  MessageCircle,
  PackageSearch,
  ReceiptText,
  ScrollText,
  Search,
  Settings2,
  Star,
  Store,
  Tags,
  Users,
  UserRoundCog,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ERP_NAVIGATION, type ErpNavigationNode } from "@/lib/erp-navigation";

type Props = {
  tenantCode: string;
  planKey: "ESSENTIAL" | "PRO";
  supportHref: string;
  isOwner: boolean;
  canManage: boolean;
};

const MODULES = [
  { id: "dashboard", label: "Dashboard", group: "Operacional", icon: LayoutDashboard },
  { id: "agenda", label: "Agenda", group: "Operacional", icon: CalendarDays },
  { id: "agenda-feriados", label: "Cadastro de Feriados", group: "Operacional", icon: CalendarDays },
  { id: "clientes", label: "Clientes", group: "Operacional", icon: Users },
  { id: "clientes-bloqueados", label: "Clientes Bloqueados", group: "Operacional", icon: Users },
  { id: "clientes-ranking", label: "Ranking", group: "Operacional", icon: Users },
  { id: "clientes-historico-compras", label: "Histórico de compras", group: "Operacional", icon: Users },
  { id: "caixa", label: "Caixa", group: "Operacional", icon: ClipboardList },
  { id: "caixa-historico", label: "Histórico de caixas", group: "Operacional", icon: ClipboardList },
  { id: "comandas", label: "Comandas", group: "Operacional", icon: ReceiptText },
  { id: "estoque", label: "Estoque", group: "Operacional", icon: PackageSearch },
  { id: "estoque-balanco", label: "Balanço de estoque", group: "Operacional", icon: PackageSearch },
  { id: "estoque-compras", label: "Solicitação de compra", group: "Operacional", icon: PackageSearch, adminOnly: true },
  { id: "totem", label: "Totem / Check-in", group: "Operacional", icon: Store, proOnly: true },
  { id: "assinaturas-trocas", label: "Troca de assinatura", group: "Gestão", icon: BadgeDollarSign },
  { id: "assinaturas-cancelados", label: "Cancelados por período", group: "Gestão", icon: BadgeDollarSign },
  { id: "assinaturas-transacoes", label: "Históricos de transações", group: "Gestão", icon: BadgeDollarSign },
  { id: "assinaturas-vendas", label: "Vendas novas por período", group: "Gestão", icon: BadgeDollarSign },
  { id: "assinaturas-origem", label: "Vendas por origem", group: "Gestão", icon: BadgeDollarSign },
  { id: "assinantes", label: "Quantidade de assinantes", group: "Gestão", icon: BadgeDollarSign },
  { id: "assinaturas", label: "Clube / Assinaturas", group: "Assinaturas", icon: BadgeDollarSign },
  { id: "gerencial", label: "Gerencial", group: "Gestão", icon: LayoutDashboard },
  { id: "auditoria-estoque", label: "Auditoria de estoque", group: "Gestão", icon: ScrollText, adminOnly: true },
  { id: "auditoria-agendamentos", label: "Auditoria de agendamentos", group: "Gestão", icon: ScrollText, adminOnly: true },
  { id: "auditoria-fechamento-caixa", label: "Fechamento de caixa", group: "Gestão", icon: WalletCards, adminOnly: true },
  { id: "auditoria-produtividade", label: "Produtividade", group: "Gestão", icon: CalendarDays, adminOnly: true },
  { id: "notificacoes", label: "Notificações", group: "Gestão", icon: BellRing, ownerOnly: true },
  { id: "relatorios", label: "Relatórios", group: "Gestão", icon: FileText },
  { id: "comissoes", label: "Comissões", group: "Gestão", icon: ScrollText },
  { id: "alertas", label: "Alertas", group: "Gestão", icon: BellRing },
  { id: "promocoes", label: "Promoções / Cupons", group: "Marketing e Promoções", icon: Tags },
  { id: "mensagens", label: "Mensagens", group: "Marketing e Promoções", icon: MessageCircle },
  { id: "avaliacoes", label: "Avaliações", group: "Marketing e Promoções", icon: Star },
  { id: "unidades", label: "Unidades / Filiais", group: "Empresa", icon: Building2 },
  { id: "equipe", label: "Profissionais", group: "Empresa", icon: UserRoundCog },
  { id: "servicos", label: "Serviços", group: "Empresa", icon: Store },
  { id: "documentos", label: "Documentos", group: "Empresa", icon: FileText },
  { id: "treinamentos", label: "Tutoriais / Cursos", group: "Empresa", icon: BookOpenCheck },
  { id: "configuracoes", label: "Configurações", group: "Empresa", icon: Settings2 },
  { id: "plano", label: "Meu plano", group: "Empresa", icon: BadgeDollarSign },
  { id: "financeiro", label: "Financeiro", group: "Financeiro", icon: WalletCards },
] as const;

type SearchModule = {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  proOnly?: boolean;
  adminOnly?: boolean;
  ownerOnly?: boolean;
  pending?: boolean;
};

function plannedSearchNodes(nodes: readonly ErpNavigationNode[], group: string): SearchModule[] {
  return nodes.flatMap((node) => [
    ...(!node.route && !node.children?.length && !node.adminOnly
      ? [{ id: node.id, label: node.label, group, icon: FileText, pending: true }]
      : []),
    ...plannedSearchNodes(node.children ?? [], group),
  ]);
}

const SEARCH_MODULES: SearchModule[] = [
  ...MODULES,
  ...ERP_NAVIGATION.flatMap((sector) => plannedSearchNodes(sector.items, sector.label)),
];

function routeFor(tenantCode: string, id: string) {
  const base = `/erp/${encodeURIComponent(tenantCode)}`;
  if (id === "dashboard") return base;
  return `${base}/${id}`;
}

export function ErpCommandPalette({ tenantCode, planKey, supportHref, isOwner, canManage }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setQuery("");
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const accessible = SEARCH_MODULES.filter((item) =>
      (!("ownerOnly" in item) || !item.ownerOnly || isOwner) &&
      (!("adminOnly" in item) || !item.adminOnly || canManage)
    );
    if (!normalized) return accessible.filter(item => MODULES.some(module => module.id === item.id));
    return accessible.filter((item) =>
      `${item.label} ${item.group}`.toLowerCase().includes(normalized),
    );
  }, [query, isOwner, canManage]);

  function openModule(id: string, proOnly?: boolean) {
    setOpen(false);
    if (proOnly && planKey !== "PRO") {
      router.push(routeFor(tenantCode, "plano"));
      return;
    }
    router.push(routeFor(tenantCode, id));
  }

  return (
    <>
      <button className="erp-command-trigger" type="button" onClick={() => setOpen(true)}>
        <Search size={16} />
        <span>Buscar módulo</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div className="erp-command-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className="erp-command-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Buscar módulo do ERP"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="erp-command-input-row">
              <Search size={19} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar agenda, caixa, clientes, relatórios..."
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar busca">
                <X size={18} />
              </button>
            </div>

            <div className="erp-command-results">
              {filtered.map((item) => {
                const Icon = item.icon;
                const locked = Boolean("proOnly" in item && item.proOnly && planKey !== "PRO");
                const pending = "pending" in item && Boolean(item.pending);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={pending}
                    title={pending ? "Funcionalidade prevista para implementação" : undefined}
                    onClick={() => {
                      if (!pending) openModule(item.id, "proOnly" in item ? item.proOnly : false);
                    }}
                  >
                    <span className="erp-command-result-icon"><Icon size={18} /></span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{pending ? `${item.group} · Previsto` : locked ? "Disponível no plano Pro" : item.group}</small>
                    </span>
                  </button>
                );
              })}

              <a href={supportHref}>
                <span className="erp-command-result-icon"><MessageCircle size={18} /></span>
                <span><strong>Suporte GROMMA</strong><small>Contato com a equipe</small></span>
              </a>

              {!filtered.length && <div className="erp-command-empty">Nenhum módulo encontrado.</div>}
            </div>

            <footer className="erp-command-footer">
              <span>ENTER para abrir</span>
              <span>ESC para fechar</span>
              <span>Páginas isoladas por tenant</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
