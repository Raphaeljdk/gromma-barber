import { notFound } from "next/navigation";
import { TenantERPView } from "../page";

const MODULES = new Set([
  "agenda",
  "agenda-feriados",
  "clientes-bloqueados",
  "clientes-ranking",
  "clientes-historico-compras",
  "clientes",
  "servicos",
  "comandas",
  "assinaturas",
  "mensagens",
  "promocoes",
  "financeiro",
  "caixa",
  "caixa-historico",
  "estoque",
  "estoque-balanco",
  "estoque-compras",
  "auditoria-estoque",
  "notificacoes",
  "comissoes",
  "equipe",
  "unidades",
  "relatorios",
  "gerencial",
  "auditoria",
  "documentos",
  "avaliacoes",
  "alertas",
  "treinamentos",
  "configuracoes",
  "plano",
]);

export default async function ErpModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; module: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, module } = await params;

  if (!MODULES.has(module)) notFound();

  return (
    <TenantERPView
      params={Promise.resolve({ tenant })}
      searchParams={searchParams}
      moduleId={module}
    />
  );
}
