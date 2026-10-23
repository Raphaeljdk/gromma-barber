"use client";

import { useEffect, useRef, useState } from "react";
import { toggleAgendaUnit } from "@/lib/agenda-unit-selection";
import { ChevronDown, Store, Users, X } from "lucide-react";
import type { AgendaProfessional, AgendaUnit } from "@/lib/agenda-types";

type Props = {
  units: AgendaUnit[];
  professionals: AgendaProfessional[];
  selectedUnitIds: string[];
  selectedProfessionalIds: string[];
  onChange: (unitIds: string[], professionalIds: string[]) => void;
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
 * Controlled filters: selecting a checkbox updates the agenda immediately.
 * Only the popover's open/closed state is local, so multiple taps remain stable.
 */
export function AgendaPeopleFilters({
  units, professionals, selectedUnitIds, selectedProfessionalIds, onChange,
}: Props) {
  const allUnits = units.map(unit => unit.id);
  const allProfessionals = availableProfessionals(allUnits, professionals);
  const [openFilter, setOpenFilter] = useState<DropdownName | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const permittedProfessionals = availableProfessionals(selectedUnitIds, professionals);
  const effectiveProfessionals = permittedProfessionals.filter(id => selectedProfessionalIds.includes(id));
  const allUnitsChecked = selectedUnitIds.length === allUnits.length;
  const allProfessionalsChecked = effectiveProfessionals.length === permittedProfessionals.length;

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
    const next = toggleAgendaUnit(selectedUnitIds, unitId, allUnits);
    const previousAllowed = availableProfessionals(selectedUnitIds, professionals);
    const nextAllowed = availableProfessionals(next, professionals);
    const wasAll = previousAllowed.every(id => selectedProfessionalIds.includes(id));
    const retained = nextAllowed.filter(id => selectedProfessionalIds.includes(id));
    onChange(next, wasAll || !retained.length ? nextAllowed : retained);
  }

  function toggleAllUnits() {
    if (allUnitsChecked) return;
    onChange(allUnits, availableProfessionals(allUnits, professionals));
  }

  function toggleProfessional(id: string) {
    onChange(selectedUnitIds, toggleAgendaUnit(effectiveProfessionals, id, permittedProfessionals));
  }

  function toggleAllProfessionals() {
    if (!allProfessionalsChecked) onChange(selectedUnitIds, permittedProfessionals);
  }

  function resetFilters() {
    onChange(allUnits, availableProfessionals(allUnits, professionals));
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
        {!allUnitsChecked && <span className="agenda-multifilter-count">{selectedUnitIds.length}</span>}
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
      <button type="button" className="agenda-multifilter-clear" onClick={resetFilters}
        disabled={allUnitsChecked && allProfessionalsChecked}>
        <X size={14} aria-hidden="true"/> Limpar
      </button>
    </div>

    <span className="agenda-sr-only" role="status" aria-live="polite">
      Agenda filtrada: {selectedUnitIds.length} unidade(s) e {effectiveProfessionals.length} profissional(is).
    </span>

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
            <span>Todas as unidades</span><small>{selectedUnitIds.length}/{allUnits.length}</small>
          </label>
          {units.map(unit => <label className="agenda-multifilter-row" key={unit.id}>
            <input type="checkbox" checked={selectedUnitIds.includes(unit.id)}
              onChange={() => toggleUnit(unit.id)}/>
            <span>{unit.name}</span>
          </label>)}
        </> : <>
          <label className="agenda-multifilter-row is-all">
            <input type="checkbox" checked={allProfessionalsChecked} onChange={toggleAllProfessionals}/>
            <span>Todos os profissionais</span><small>{effectiveProfessionals.length}/{permittedProfessionals.length}</small>
          </label>
          {professionals.filter(person => !person.unitId || selectedUnitIds.includes(person.unitId))
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

    </div>}
  </div>;
}
