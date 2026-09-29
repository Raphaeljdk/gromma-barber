export default function AdminLoading() {
  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Controle central</div>
          <h2>Carregando painel...</h2>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="card loading-block" />
        <div className="card loading-block" />
      </div>
    </section>
  );
}
