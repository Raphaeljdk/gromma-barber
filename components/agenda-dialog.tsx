"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { X } from "lucide-react";

export function AgendaDialog({
  title,
  subtitle,
  variant,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  variant?: "booking" | "checkout";
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`agenda-dialog${variant ? ` agenda-dialog-${variant}` : ""}`}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="agenda-dialog-content">
        <header className="agenda-dialog-head">
          <div>
            <h3 id={titleId}>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="agenda-icon-button"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function AgendaSubmit({
  children,
  secondary = false,
  disabled = false,
  name,
  value,
}: {
  children: ReactNode;
  secondary?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`btn${secondary ? " secondary" : ""}`}
      disabled={pending || disabled}
      type="submit"
      name={name}
      value={value}
    >
      {pending ? "Salvando…" : children}
    </button>
  );
}
