export default function LoadingERP() {
  return (
    <main className="enterprise-loading-shell">
      <aside className="enterprise-loading-sidebar">
        <div className="loading-shimmer loading-brand" />
        <div className="loading-shimmer loading-company" />
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="loading-shimmer loading-nav" key={index} />
        ))}
      </aside>
      <section className="enterprise-loading-main">
        <div className="loading-shimmer loading-topbar" />
        <div className="loading-shimmer loading-title" />
        <div className="loading-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="loading-shimmer loading-card" key={index} />
          ))}
        </div>
        <div className="loading-shimmer loading-table" />
      </section>
    </main>
  );
}
