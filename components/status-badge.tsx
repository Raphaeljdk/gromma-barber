const labels: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Liberada",
  BLOCKED: "Bloqueada",
  REJECTED: "Rejeitada",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status.toLowerCase()}`}>{labels[status] ?? status}</span>;
}
