import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type QueryValue = string | string[] | undefined;

type Props = {
  basePath: string;
  searchParams: Record<string, QueryValue>;
  param: string;
  page: number;
  total: number;
  pageSize?: number;
  hash?: string;
  label?: string;
};

function firstValue(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function SectionPagination({
  basePath,
  searchParams,
  param,
  page,
  total,
  pageSize = 10,
  hash,
  label = "registros",
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(total, safePage * pageSize);

  function href(nextPage: number) {
    const params = new URLSearchParams();

    Object.entries(searchParams).forEach(([key, value]) => {
      if (key === param || key === "ok" || key === "erro") return;
      const resolved = firstValue(value);
      if (resolved) params.set(key, resolved);
    });

    if (nextPage > 1) params.set(param, String(nextPage));

    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
  }

  const candidates = [1, safePage - 1, safePage, safePage + 1, totalPages]
    .filter((value) => value >= 1 && value <= totalPages);
  const pages = Array.from(new Set(candidates)).sort((a, b) => a - b);

  return (
    <nav className="section-pagination" aria-label={`Paginação de ${label}`}>
      <span className="section-pagination-summary">
        {start}-{end} de {total} {label}
      </span>

      {totalPages > 1 && (
        <div className="section-pagination-controls">
          {safePage > 1 ? (
            <Link href={href(safePage - 1)} aria-label="Página anterior">
              <ChevronLeft size={15} />
              <span>Anterior</span>
            </Link>
          ) : (
            <span className="disabled">
              <ChevronLeft size={15} />
              <span>Anterior</span>
            </span>
          )}

          <div className="section-pagination-pages">
            {pages.map((item, index) => {
              const previous = pages[index - 1];
              return (
                <span className="section-pagination-page-slot" key={item}>
                  {previous && item - previous > 1 && <i>…</i>}
                  <Link
                    href={href(item)}
                    className={item === safePage ? "active" : ""}
                    aria-current={item === safePage ? "page" : undefined}
                  >
                    {item}
                  </Link>
                </span>
              );
            })}
          </div>

          {safePage < totalPages ? (
            <Link href={href(safePage + 1)} aria-label="Próxima página">
              <span>Próxima</span>
              <ChevronRight size={15} />
            </Link>
          ) : (
            <span className="disabled">
              <span>Próxima</span>
              <ChevronRight size={15} />
            </span>
          )}
        </div>
      )}
    </nav>
  );
}
