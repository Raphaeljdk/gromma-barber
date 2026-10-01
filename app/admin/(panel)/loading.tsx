export default function LoadingAdmin() {
  return (
    <section className="admin-loading-state">
      <div className="loading-shimmer loading-title" />
      <div className="loading-grid">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="loading-shimmer loading-card" key={index} />
        ))}
      </div>
      <div className="loading-shimmer loading-table" />
    </section>
  );
}
