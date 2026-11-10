"use client";

import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { archiveProfessional } from "@/app/erp/[tenant]/professional-actions";

function ArchiveSubmit({name}:{name:string}){
  const {pending}=useFormStatus();
  return <button type="submit" className="btn secondary erp-professional-delete" disabled={pending}
    aria-label={"Excluir "+name} title="Excluir profissional (preservando histórico)">
    <Trash2 size={14} aria-hidden="true"/><span>{pending?"Excluindo...":"Excluir"}</span>
  </button>;
}

export function ArchiveProfessionalButton({
  tenantCode,userId,name,
}:{tenantCode:string;userId:string;name:string}){
  function confirmArchive(event:React.FormEvent<HTMLFormElement>){
    const message="Excluir "+name+" da equipe ativa?\n\nO acesso será desativado e a pessoa sairá da lista. Agendamentos, comissões, pagamentos e históricos serão preservados. Não será permitido se houver atendimentos futuros pendentes.\n\nDeseja continuar?";
    if(!window.confirm(message))event.preventDefault();
  }
  return <form action={archiveProfessional} onSubmit={confirmArchive} className="erp-professional-delete-form">
    <input type="hidden" name="tenantCode" value={tenantCode}/>
    <input type="hidden" name="userId" value={userId}/>
    <ArchiveSubmit name={name}/>
  </form>;
}
