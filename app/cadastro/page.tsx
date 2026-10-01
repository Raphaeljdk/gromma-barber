import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { registerBarberShop } from "./actions";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const qs = await searchParams;
  return (
    <main className="container page-space">
      <PublicHeader />

      <section className="intro-block compact commercial-contact-intro">
        <div className="eyebrow">Contato comercial</div>
        <h1>Fale com a nossa equipe.</h1>
        <p>Preencha seus dados para solicitar uma apresentação privada do GROMMA BARBER.</p>
      </section>

      {qs.sucesso && <div className="notice form-notice">Solicitação enviada. Nossa equipe recebeu seu contato.</div>}
      {qs.erro === "dados" && <div className="notice form-notice">Revise os campos obrigatórios e tente novamente.</div>}
      {qs.erro === "documento" && <div className="notice form-notice">Este CPF/CNPJ já possui um cadastro.</div>}
      {qs.erro === "banco" && (
        <div className="notice error-notice form-notice">
          Não foi possível conectar ao banco neste momento. Nenhum cadastro incompleto foi salvo. Tente novamente em instantes.
        </div>
      )}

      <form action={registerBarberShop} className="card grid signup-form">
        <div className="grid grid-2">
          <label><span className="label">Nome da barbearia *</span><input className="input" name="tradeName" required /></label>
          <label><span className="label">Razão social</span><input className="input" name="legalName" /></label>
          <label><span className="label">CPF/CNPJ *</span><input className="input" name="document" required /></label>
          <label><span className="label">Responsável *</span><input className="input" name="ownerName" required /></label>
          <label><span className="label">E-mail *</span><input className="input" type="email" name="email" required /></label>
          <label><span className="label">Telefone *</span><input className="input" name="phone" required /></label>
          <label><span className="label">WhatsApp</span><input className="input" name="whatsapp" /></label>
          <label><span className="label">Cidade *</span><input className="input" name="city" required /></label>
          <label><span className="label">UF *</span><input className="input" name="state" maxLength={2} required /></label>
        </div>

        <label><span className="label">Endereço</span><input className="input" name="address" /></label>

        <button className="btn" type="submit">Quero conhecer o GROMMA</button>
      </form>
    </main>
  );
}
