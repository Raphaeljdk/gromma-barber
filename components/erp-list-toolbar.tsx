import Link from "next/link";
import { Filter, Search, X } from "lucide-react";

type QueryValue = string | string[] | undefined;

type SelectOption = {
  value: string;
  label: string;
};

type SelectField = {
  param: string;
  value?: string;
  label: string;
  options: SelectOption[];
};

type Props = {
  basePath: string;
  searchParams: Record<string, QueryValue>;
  pageParam: string;
  hash: string;
  search?: {
    param: string;
    value?: string;
    placeholder: string;
  };
  selects?: SelectField[];
};

function firstValue(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function ErpListToolbar({
  basePath,
  searchParams,
  pageParam,
  hash,
  search,
  selects = [],
}: Props) {
  const owned = new Set([
    pageParam,
    "ok",
    "erro",
    search?.param ?? "",
    ...selects.map((field) => field.param),
  ]);

  const preserved = Object.entries(searchParams)
    .map(([key, value]) => [key, firstValue(value)] as const)
    .filter(([key, value]) => !owned.has(key) && Boolean(value));

  const hasFilters = Boolean(search?.value) || selects.some((field) => Boolean(field.value));

  const clearParams = new URLSearchParams();
  preserved.forEach(([key, value]) => {
    if (value) clearParams.set(key, value);
  });
  const clearQuery = clearParams.toString();
  const clearHref = `${basePath}${clearQuery ? `?${clearQuery}` : ""}#${hash}`;

  return (
    <form className="erp-list-toolbar" action={`${basePath}#${hash}`} method="get">
      {preserved.map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}

      {search && (
        <label className="erp-list-search">
          <Search size={15} />
          <span className="sr-only">Buscar</span>
          <input
            name={search.param}
            defaultValue={search.value}
            placeholder={search.placeholder}
            autoComplete="off"
          />
        </label>
      )}

      {selects.map((field) => (
        <label className="erp-list-select" key={field.param}>
          <span>{field.label}</span>
          <select name={field.param} defaultValue={field.value ?? ""}>
            <option value="">Todos</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      ))}

      <button className="btn secondary erp-filter-submit" type="submit">
        <Filter size={14} /> Filtrar
      </button>

      {hasFilters && (
        <Link className="erp-filter-clear" href={clearHref}>
          <X size={14} /> Limpar
        </Link>
      )}
    </form>
  );
}
