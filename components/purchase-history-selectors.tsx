"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, PackageSearch, Tags, X } from "lucide-react";
import type { PurchaseCategory } from "@/lib/purchase-categories";

export type PurchaseCatalogChoice = {
  category: PurchaseCategory;
  name: string;
};

type Props = {
  choices: PurchaseCatalogChoice[];
  initialCategory: PurchaseCategory | "";
  initialItem: string;
};

const labels: Record<PurchaseCategory, string> = {
  SERVICE: "Serviços",
  PRODUCT: "Produtos",
  BEVERAGE: "Bebidas",
};

export function PurchaseHistorySelectors({ choices, initialCategory, initialItem }: Props) {
  const [category, setCategory] = useState<PurchaseCategory | "">(initialCategory);
  const [item, setItem] = useState(initialItem);
  const [opened, setOpened] = useState<"category" | "item" | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const items = choices.filter(choice => !category || choice.category === category);
  const uniqueItems = [...new Set(items.map(choice => choice.name))];
  const chosenItem = uniqueItems.includes(item) ? item : "";

  useEffect(() => {
    if (!opened) return;
    const closeOutside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpened(null);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpened(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [opened]);

  function chooseCategory(next: PurchaseCategory | "") {
    setCategory(next);
    setItem("");
    setOpened(null);
  }

  return <div className="erp-purchase-selectors" ref={ref}>
    <input type="hidden" name="categoria" value={category}/>
    <input type="hidden" name="item" value={chosenItem}/>

    <div className="erp-purchase-select" >
      <span className="erp-purchase-select-label">Categoria</span>
      <button type="button" className={"erp-purchase-select-trigger" + (opened === "category" ? " is-open" : "")}
        aria-label="Selecionar categoria" aria-expanded={opened === "category"}
        aria-controls="erp-purchase-categories-popup"
        onClick={() => setOpened(current => current === "category" ? null : "category")}>
        <Tags size={16} aria-hidden="true"/>
        <span>{category ? labels[category] : "Todas as categorias"}</span>
        <ChevronDown size={16} aria-hidden="true"/>
      </button>
      {opened === "category" && <div id="erp-purchase-categories-popup" className="erp-purchase-select-list"
        role="group" aria-label="Categorias disponíveis">
        {(["", "SERVICE", "PRODUCT", "BEVERAGE"] as const).map(option =>
          <button type="button" key={option || "all"}
            className={"erp-purchase-select-option" + (category === option ? " is-selected" : "")}
            aria-pressed={category === option}
            onClick={() => chooseCategory(option)}>
            {option ? labels[option] : "Todas as categorias"}
          </button>)}
      </div>}
    </div>

    <div className="erp-purchase-select">
      <span className="erp-purchase-select-label">{category === "SERVICE" ? "Serviço" : category === "BEVERAGE" ? "Bebida" : "Produto / Serviço"}</span>
      <button type="button" className={"erp-purchase-select-trigger" + (opened === "item" ? " is-open" : "")}
        aria-label="Selecionar produto ou serviço" aria-expanded={opened === "item"}
        aria-controls="erp-purchase-items-popup"
        onClick={() => setOpened(current => current === "item" ? null : "item")}>
        <PackageSearch size={16} aria-hidden="true"/>
        <span>{chosenItem || "Todos os itens cadastrados"}</span>
        <ChevronDown size={16} aria-hidden="true"/>
      </button>
      {opened === "item" && <div id="erp-purchase-items-popup" className="erp-purchase-select-list"
        role="group" aria-label="Itens da categoria selecionada">
        <button type="button" className={"erp-purchase-select-option" + (!chosenItem ? " is-selected" : "")}
          aria-pressed={!chosenItem}
          onClick={() => { setItem(""); setOpened(null); }}>
          Todos os itens
        </button>
        {uniqueItems.map(name => <button type="button" key={name}
          className={"erp-purchase-select-option" + (chosenItem === name ? " is-selected" : "")}
          aria-pressed={chosenItem === name}
          onClick={() => { setItem(name); setOpened(null); }}>
          {name}
        </button>)}
        {!uniqueItems.length && <span className="erp-purchase-select-empty">Nenhum item cadastrado nessa categoria.</span>}
      </div>}
    </div>
    {(category || chosenItem) && <button type="button" className="erp-purchase-select-reset"
      aria-label="Limpar categoria e item"
      onClick={() => { setCategory(""); setItem(""); setOpened(null); }}><X size={15} aria-hidden="true"/> Limpar seleção</button>}
  </div>;
}
