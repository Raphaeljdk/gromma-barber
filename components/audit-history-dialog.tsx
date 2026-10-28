"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  children: ReactNode;
  closeHref: string;
  subtitle: string;
};

export function AuditHistoryDialog({ children, closeHref, subtitle }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        router.replace(closeHref, { scroll: false });
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [closeHref, router]);

  if (!mounted) return null;
  return createPortal(
    <div
      className="mgmt-audit-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) router.replace(closeHref, { scroll: false });
      }}
    >
      <section
        className="card mgmt-audit-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mgmt-audit-history-title"
        aria-describedby="mgmt-audit-history-description"
      >
        <header className="mgmt-audit-modal-header">
          <div>
            <h3 id="mgmt-audit-history-title">Movimentações do agendamento</h3>
            <p id="mgmt-audit-history-description" className="muted small">{subtitle}</p>
          </div>
          <Link href={closeHref} scroll={false} className="mgmt-audit-modal-close" ref={closeRef} aria-label="Fechar histórico" title="Fechar histórico">
            <X size={20} aria-hidden="true" />
          </Link>
        </header>
        <div className="mgmt-audit-modal-body">{children}</div>
      </section>
    </div>,
    document.body
  );
}
