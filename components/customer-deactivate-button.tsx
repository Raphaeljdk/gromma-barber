"use client";

import { Trash2 } from "lucide-react";

export function CustomerDeactivateButton({ customerName }: { customerName: string }) {
  return <button type="submit" className="erp-customer-delete" title={`Excluir cadastro de ${customerName}`} aria-label={`Excluir cadastro de ${customerName}`} onClick={(event) => {
    if (!window.confirm(`Excluir ${customerName} da lista de clientes? O histórico de visitas e comandas será preservado.`)) event.preventDefault();
  }}><Trash2 size={17} aria-hidden="true" /></button>;
}
