import Link from "next/link";
import { PublicHeader } from "@/components/public-header";

const accesses = [
  {
    title: "Cliente",
    eyebrow: "ERP da barbearia",
    description: "Acesse clientes, agenda, comandas, equipe, estoque, financeiro e os módulos contratados.",
    href: "/cliente/login",
    action: "Entrar como cliente",
    featured: true,
  },
  {
    title: "Sócio",
    eyebrow: "Gestão da plataforma",
    description: "Acesso completo para revisar o produto, ambientes, cadastros e administração do GROMMA.",
    href: "/socio/login",
    action: "Entrar como sócio",
    featured: false,
  },
  {
    title: "Administrador",
    eyebrow: "Administração GROMMA",
    description: "Painel restrito para gestão dos cadastros, tenants, planos e liberações da plataforma.",
    href: "/admin/login",
    action: "Entrar como administrador",
    featured: false,
  },
];

export default function LoginHubPage() {
  return (
    <main className="container page-space">
      <PublicHeader />

      <section className="login-hub-hero">
        <div className="eyebrow">Acesso ao sistema</div>
        <h1>Como você quer entrar?</h1>
        <p>
          Escolha seu perfil para acessar o ambiente correto do GROMMA BARBER.
        </p>
      </section>

      <section className="login-choice-grid">
        {accesses.map((access) => (
          <article
            className={`card login-choice-card ${access.featured ? "featured" : ""}`}
            key={access.title}
          >
            <div>
              <div className="eyebrow">{access.eyebrow}</div>
              <h2>{access.title}</h2>
              <p>{access.description}</p>
            </div>
            <Link
              className={`btn full ${access.featured ? "" : "secondary"}`}
              href={access.href}
            >
              {access.action}
            </Link>
          </article>
        ))}
      </section>

      <section className="login-help card">
        <div>
          <strong>Ainda não é cliente?</strong>
          <span>Cadastre sua barbearia para análise e liberação da plataforma.</span>
        </div>
        <Link className="btn secondary" href="/cadastro">Cadastrar barbearia</Link>
      </section>
    </main>
  );
}
