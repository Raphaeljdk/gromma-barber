"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Store, Users, X } from "lucide-react";
import type { AgendaProfessional, AgendaUnit } from "@/lib/agenda-types";

type Props = {
  units: AgendaUnit[];
  professionals: AgendaProfessional[];
  selectedUnitIds: string[];
  selectedProfessionalIds: string[];
  onApply: (unitIds: string[], professionalIds: string[]) => void;
};

type DropdownName = "units" | "professionals";

function availableProfessionals(
  units: readonly string[],
  professionals: readonly AgendaProfessional[],
): string[] {
  return [
    ...professionals.filter(person => !person.unitId || units.includes(person.unitId)).map(person => person.id),
    "unassigned",
  ];
}

/**
 * Compact dropdowns on the agenda toolbar, inspired by the reference.
 * Selections update locally, avoiding lost router pushes on mobile.
 * Navigating to a different agenda filter only happens when "Aplicar" is pressed.
 */
export function AgendaPeopleFilters({
  units, professionals, selectedUnitIds, selectedProfessionalIds, onApply,
}: Props) {
  const allUnits = units.map(unit => unit.id);
  const allProfessionals = availableProfessionals(allUnits, professionals);
  const [draftUnitIds, setDraftUnitIds] = useState<string[]>(selectedUnitIds);
  const [draftProfessionalIds, setDraftProfessionalIds] = useState<string[]>(selectedProfessionalIds);
  const [openFilter, setOpenFilter] = useState<DropdownName | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const permittedProfessionals = availableProfessionals(draftUnitIds, professionals);
  const effectiveProfessionals = permittedProfessionals.filter(id => draftProfessionalIds.includes(id));
  const allUnitsChecked = allUnits.length > 0 && draftUnitIds.length === allUnits.length;
  const allProfessionalsChecked = permittedProfessionals.length > 0 && effectiveProfessionals.length === permittedProfessionals.length;
  const invalid = draftUnitIds.length === 0 || effectiveProfessionals.length === 0;
  const dirty = draftUnitIds.join(",") !== selectedUnitIds.join(",") ||
    effectiveProfessionals.join(",") !== selectedProfessionalIds.join(",");

  useEffect(() => {
    if (!openFilter) return;
    function handleOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenFilter(null);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenFilter(null);
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openFilter]);

  function toggleUnit(unitId: string) {
    const next = draftUnitIds.includes(unitId)
      ? draftUnitIds.filter(id => id !== unitId)
      : allUnits.filter(id => draftUnitIds.includes(id) || id === unitId);
    const previousAllowed = availableProfessionals(draftUnitIds, professionals);
    const nextAllowed = availableProfessionals(next, professionals);
    const wasAll = previousAllowed.length > 0 &&
      previousAllowed.every(id => draftProfessionalIds.includes(id));
    const nextProfessionals = nextAllowed.filter(id => draftProfessionalIds.includes(id));
    setDraftUnitIds(next);
    setDraftProfessionalIds(
      wasAll || nextProfessionals.length === 0 ? nextAllowed : nextProfessionals,
    );
  }

  function toggleAllUnits() {
    const next = allUnitsChecked ? [] : allUnits;
    setDraftUnitIds(next);
    const nextAllowed = availableProfessionals(next, professionals);
    const prior = nextAllowed.filter(id => draftProfessionalIds.includes(id));
    setDraftProfessionalIds(prior.length ? prior : nextAllowed);
  }

  function toggleProfessional(id: string) {
    setDraftProfessionalIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) :
        permittedProfessionals.filter(item => prev.includes(item) || item === id),
    );
  }

  function toggleAllProfessionals() {
    setDraftProfessionalIds(allProfessionalsChecked ? [] : permittedProfessionals);
  }

  function resetFilters() {
    setDraftUnitIds(allUnits);
    setDraftProfessionalIds(allProfessionals);
    setOpenFilter(null);
    if (!allUnitsChecked || !allProfessionalsChecked || dirty) onApply(allUnits, allProfessionals);
  }

  function applyFilters() {
    if (invalid || !dirty) return;
    setOpenFilter(null);
    onApply(draftUnitIds, effectiveProfessionals);
  }

  const openUnits = openFilter === "units";
  const openProfessionals = openFilter === "professionals";

  return <div className="agenda-multifilter-panel" aria-label="Filtros da agenda" ref={rootRef}>
    <div className="agenda-multifilter-toolbar">
      <button
        className={"agenda-multifilter-trigger" + (openUnits ? " is-open" : "") + (!allUnitsChecked ? " is-filtered" : "")}
        type="button" aria-haspopup="true" aria-expanded={openUnits} aria-controls="agenda-filter-units"
        onClick={() => setOpenFilter(current => current === "units" ? null : "units")}
      >
        <Store size={15} aria-hidden="true"/>
        <span>Unidades</span>
        {!allUnitsChecked && <span className="agenda-multifilter-count">{draftUnitIds.length}</span>}
        <ChevronDown size={15} className="agenda-multifilter-chevron" aria-hidden="true"/>
      </button>
      <button
        className={"agenda-multifilter-trigger" + (openProfessionals ? " is-open" : "") + (!allProfessionalsChecked ? " is-filtered" : "")}
        type="button" aria-haspopup="true" aria-expanded={openProfessionals} aria-controls="agenda-filter-professionals"
        onClick={() => setOpenFilter(current => current === "professionals" ? null : "professionals")}
      >
        <Users size={15} aria-hidden="true"/>
        <span>Profissionais</span>
        {!allProfessionalsChecked && <span className="agenda-multifilter-count">{effectiveProfessionals.length}</span>}
        <ChevronDown size={15} className="agenda-multifilter-chevron" aria-hidden="true"/>
      </button>
      {dirty && <span className="agenda-multifilter-pending" role="status">Filtros não aplicados</span>}
      {dirty && !invalid && <button className="agenda-multifilter-apply-shortcut" type="button"
        onClick={applyFilters}>Aplicar</button>}
      <button type="button" className="agenda-multifilter-clear" onClick={resetFilters}
        disabled={!dirty && allUnitsChecked && allProfessionalsChecked}>
        <X size={14} aria-hidden="true"/> Limpar
      </button>
    </div>

    {openFilter && <div
      id={openUnits ? "agenda-filter-units" : "agenda-filter-professionals"}
      className={"agenda-multifilter-popover" + (openProfessionals ? " is-professionals" : "")}
      role="group" aria-label={openUnits ? "Selecionar unidades" : "Selecionar profissionais"}
    >
      <div className="agenda-multifilter-popover-head">
        <strong>{openUnits ? "Selecionar unidades" : "Selecionar profissionais"}</strong>
        <button type="button" className="agenda-multifilter-dismiss" onClick={() => setOpenFilter(null)}
          aria-label="Fechar lista"><X size={17}/></button>
      </div>
      <div className="agenda-multifilter-options">
        {openUnits ? <>
          <label className="agenda-multifilter-row is-all">
            <input type="checkbox" checked={allUnitsChecked} onChange={toggleAllUnits}/>
            <span>Todas as unidades</span><small>{draftUnitIds.length}/{allUnits.length}</small>
          </label>
          {units.map(unit => <label className="agenda-multifilter-row" key={unit.id}>
            <input type="checkbox" checked={draftUnitIds.includes(unit.id)}
              onChange={() => toggleUnit(unit.id)}/>
            <span>{unit.name}</span>
          </label>)}
        </> : <>
          <label className="agenda-multifilter-row is-all">
            <input type="checkbox" checked={allProfessionalsChecked} onChange={toggleAllProfessionals}/>
            <span>Todos os profissionais</span><small>{effectiveProfessionals.length}/{permittedProfessionals.length}</small>
          </label>
          {professionals.filter(person => !person.unitId || draftUnitIds.includes(person.unitId))
            .map(person => <label className="agenda-multifilter-row" key={person.id}>
              <input type="checkbox" checked={effectiveProfessionals.includes(person.id)}
                onChange={() => toggleProfessional(person.id)}/>
              <span>{person.name}</span>
              <small>{units.find(unit => unit.id === person.unitId)?.name || "Todas as unidades"}</small>
            </label>)}
          <label className="agenda-multifilter-row">
            <input type="checkbox" checked={effectiveProfessionals.includes("unassigned")}
              onChange={() => toggleProfessional("unassigned")}/>
            <span>Sem preferência</span>
          </label>
        </>}
      </div>
      <div className="agenda-multifilter-popover-footer">
        <p className="agenda-multifilter-status" role={invalid ? "alert" : "status"}>
          {invalid ? "Selecione pelo menos uma unidade e um profissional." :
            dirty ? "Confirme para atualizar a agenda." : "Seleção atual da agenda."}
        </p>
        <button type="button" className="btn" disabled={invalid || !dirty}
          onClick={applyFilters}>Aplicar filtros</button>
      </div>
    </div>}
  </div>;
}
