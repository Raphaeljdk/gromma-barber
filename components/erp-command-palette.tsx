"use client";

import {
  BadgeDollarSign,
  BellRing,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageCircle,
  PackageSearch,
  ReceiptText,
  Search,
  Settings2,
  Store,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  tenantCode: string;
  planKey: "ESSENTIAL" | "PRO";
  supportHref: string;
};

const MODULES = [
  { id: "dashboard", label: "Dashboard", group: "Visão geral", icon: LayoutDashboard },
  { id: "agenda", label: "Agenda", group: "Operação", icon: CalendarDays },
  { id: "clientes", label: "Clientes", group: "Cadastros", icon: Users },
  { id: "servicos", label: "Serviços", group: "Cadastros", icon: Store },
  { id: "comandas", label: "Comandas", group: "Operação", icon: ReceiptText },
  { id: "assinaturas", label: "Clube e assinaturas", group: "Comercial", icon: BadgeDollarSign },
  { id: "mensagens", label: "Mensagens", group: "Relacionamento", icon: MessageCircle },
  { id: "financeiro", label: "Financeiro", group: "Financeiro", icon: WalletCards },
  { id: "caixa", label: "Caixa", group: "Financeiro", icon: ClipboardList },
  { id: "estoque", label: "Estoque", group: "Operação", icon: PackageSearch },
  { id: "unidades", label: "Unidades", group: "Gestão", icon: Building2 },
  { id: "relatorios", label: "Relatórios", group: "Gestão", icon: FileText },
  { id: "alertas", label: "Alertas", group: "Gestão", icon: BellRing },
  { id: "configuracoes", label: "Configurações", group: "Sistema", icon: Settings2 },
] as const;

export function ErpCommandPalette({ tenantCode, planKey, supportHref }: Props) {
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
    if (!normalized) return MODULES;
    return MODULES.filter((item) =>
      `${item.label} ${item.group}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  function goTo(id: string) {
    setOpen(false);
    if (id === "totem") {
      router.push(`/erp/${encodeURIComponent(tenantCode)}/totem`);
      return;
    }

    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${id}`);
    }
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
                return (
                  <button key={item.id} type="button" onClick={() => goTo(item.id)}>
                    <span className="erp-command-result-icon"><Icon size={18} /></span>
                    <span><strong>{item.label}</strong><small>{item.group}</small></span>
                  </button>
                );
              })}

              {planKey === "PRO" && (
                <button type="button" onClick={() => router.push(`/erp/${encodeURIComponent(tenantCode)}/totem`)}>
                  <span className="erp-command-result-icon"><Store size={18} /></span>
                  <span><strong>Totem / Check-in</strong><small>Experiência Pro</small></span>
                </button>
              )}

              <a href={supportHref}>
                <span className="erp-command-result-icon"><MessageCircle size={18} /></span>
                <span><strong>Suporte GROMMA</strong><small>Contato com a equipe</small></span>
              </a>

              {!filtered.length && <div className="erp-command-empty">Nenhum módulo encontrado.</div>}
            </div>

            <footer className="erp-command-footer">
              <span>ENTER para abrir</span>
              <span>ESC para fechar</span>
              <span>Ambiente isolado por tenant</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
