import Link from "next/link";
import { registerBarberShop } from "./actions";

export default async function CadastroPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const qs = await searchParams;
  return (
    <main className="container" style={{paddingBottom:60}}>
      <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">G</span> GROMMA BARBER</Link></header>
      <section style={{maxWidth:850,margin:"46px auto 0"}}>
        <div className="eyebrow">Cadastro de barbearia</div>
        <h1 style={{fontSize:"clamp(2.2rem,5vw,4rem)"}}>Solicite a liberação.</h1>
        <p>Após o envio, o cadastro ficará pendente até a análise do administrador da plataforma.</p>
        {qs.sucesso && <div className="notice" style={{marginBottom:18}}>Cadastro enviado. Agora ele aparece no painel administrativo como <strong>Pendente</strong>.</div>}
        {qs.erro === "dados" && <div className="notice" style={{marginBottom:18}}>Revise os campos obrigatórios e tente novamente.</div>}
        {qs.erro === "documento" && <div className="notice" style={{marginBottom:18}}>Este CPF/CNPJ já possui um cadastro.</div>}
        <form action={registerBarberShop} className="card grid" style={{gap:18}}>
          <div className="grid grid-2">
            <label><span className="label">Nome da barbearia *</span><input className="input" name="tradeName" required /></label>
            <label><span className="label">Razão social</span><input className="input" name="legalName" /></label>
            <label><span className="label">CPF/CNPJ *</span><input className="input" name="document" required /></label>
            <label><span className="label">Responsável *</span><input className="input" name="ownerName" required /></label>
            <label><span className="label">E-mail *</span><input className="input" type="email" name="email" required /></label>
            <label><span className="label">Telefone *</span><input className="input" name="phone" required /></label>
            <label><span className="label">WhatsApp</span><input className="input" name="whatsapp" /></label>
            <label><span className="label">Plano desejado *</span><select className="select" name="requestedPlan" defaultValue="ESSENTIAL"><option value="ESSENTIAL">Essencial</option><option value="PRO">Pro</option></select></label>
            <label><span className="label">Cidade *</span><input className="input" name="city" required /></label>
            <label><span className="label">UF *</span><input className="input" name="state" maxLength={2} required /></label>
          </div>
          <label><span className="label">Endereço</span><input className="input" name="address" /></label>
          <button className="btn" type="submit">Enviar cadastro para análise</button>
        </form>
      </section>
    </main>
  );
}
