"use client";

import Link from "next/link";
import { Bell, CheckCheck, ClipboardAlert, PackageMinus, ShoppingCart, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { InventoryNotice } from "@/lib/inventory-notifications";

type Props = { tenantCode: string; notices: InventoryNotice[] };
const icons = { compra: ShoppingCart, estoque: PackageMinus, divergencia: ClipboardAlert };
const labels = { compra: "Compras", estoque: "Estoque baixo", divergencia: "Divergências" };

export function InventoryNotificationBell({ tenantCode, notices }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const unread = notices.filter(notice => !notice.read).length;
  const visible = [...notices.filter(n => !n.read), ...notices.filter(n => n.read)].slice(0, 4);
  const base = "/erp/" + encodeURIComponent(tenantCode);

  useEffect(() => {
    if (!open) return;
    const clickAway = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", clickAway);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", clickAway);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Atualiza contadores durante uso prolongado sem exigir nova navegação.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [router]);

  return <div className="erp-notify" ref={root}>
    <button type="button" className={"erp-notify-button" + (open ? " is-open" : "")}
      aria-label={unread > 0 ? `Notificações, ${unread} não lidas` : "Notificações"}
      aria-expanded={open} aria-controls="erp-notify-panel"
      onClick={() => setOpen(value => !value)}>
      <Bell size={19} strokeWidth={1.85} aria-hidden="true"/>
      {unread > 0 && <span className="erp-notify-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <div id="erp-notify-panel" className="erp-notify-panel" role="region" aria-label="Notificações recentes">
      <div className="erp-notify-header">
        <div><strong>Notificações</strong><small>{unread > 0 ? `${unread} não lida(s)` : "Tudo em dia"}</small></div>
        <button type="button" className="erp-notify-close" aria-label="Fechar notificações" onClick={() => setOpen(false)}><X size={17}/></button>
      </div>
      <div className="erp-notify-list">
        {visible.map(item => {
          const Icon = icons[item.kind];
          return <Link href={item.href} onClick={() => setOpen(false)} className={"erp-notify-item" + (!item.read ? " is-unread" : "")} key={item.id}>
            <span className="erp-notify-item-icon"><Icon size={17}/></span>
            <span className="erp-notify-item-text"><strong>{item.title}</strong>
              <small>{item.description}</small><em>{labels[item.kind]} · {item.unitName}</em></span>
            {!item.read && <span className="erp-notify-unread-dot" aria-label="Não lida"/>}
          </Link>;
        })}
        {!visible.length && <div className="erp-notify-empty"><CheckCheck size={24}/><span>Nenhuma notificação por enquanto.</span></div>}
      </div>
      <Link href={base + "/notificacoes"} onClick={() => setOpen(false)} className="erp-notify-footer">
        Ver todas as notificações <span aria-hidden="true">→</span>
      </Link>
    </div>}
  </div>;
}
