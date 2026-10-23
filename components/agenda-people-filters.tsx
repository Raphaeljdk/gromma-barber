"use client";

import { useState } from "react";
import type { AgendaProfessional, AgendaUnit } from "@/lib/agenda-types";

type Props = {
  units: AgendaUnit[];
  professionals: AgendaProfessional[];
  selectedUnitIds: string[];
  selectedProfessionalIds: string[];
  onApply: (unitIds: string[], professionalIds: string[]) => void;
};

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
 * Edit selections locally; navigation happens only when clicking Apply.
 * This avoids dropped clicks and stale router pushes on slow mobile networks.
 */
export function AgendaPeopleFilters({
  units, professionals, selectedUnitIds, selectedProfessionalIds, onApply,
}: Props) {
  const allUnits = units.map(unit => unit.id);
  const allProfessionals = availableProfessionals(allUnits, professionals);
  const [draftUnitIds, setDraftUnitIds] = useState<string[]>(selectedUnitIds);
  const [draftProfessionalIds, setDraftProfessionalIds] = useState<string[]>(selectedProfessionalIds);
  const permittedProfessionals = availableProfessionals(draftUnitIds, professionals);
  const effectiveProfessionals = permittedProfessionals.filter(id => draftProfessionalIds.includes(id));
  const allUnitsChecked = allUnits.length > 0 && draftUnitIds.length === allUnits.length;
  const allProfessionalsChecked = permittedProfessionals.length > 0 && effectiveProfessionals.length === permittedProfessionals.length;
  const invalid = draftUnitIds.length === 0 || effectiveProfessionals.length === 0;
  const dirty = draftUnitIds.join(",") !== selectedUnitIds.join(",") ||
    effectiveProfessionals.join(",") !== selectedProfessionalIds.join(",");

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
        permittedProfessionals.filter(item => prev.includes(item) || item === id)
    );
  }

  function toggleAllProfessionals() {
    setDraftProfessionalIds(allProfessionalsChecked ? [] : permittedProfessionals);
  }

  return <div className="agenda-multifilter-panel" aria-label="Filtros da agenda">
    <div className="agenda-multifilter-lists">
      <fieldset className="agenda-multifilter-list">
        <legend>Unidades <small>({draftUnitIds.length}/{allUnits.length})</small></legend>
        <div className="agenda-multifilter-options">
          <label className="agenda-multifilter-row is-all">
            <input type="checkbox" checked={allUnitsChecked} onChange={toggleAllUnits}/>
            <span>Todas as unidades</span>
          </label>
          {units.map(unit => <label className="agenda-multifilter-row" key={unit.id}>
            <input type="checkbox" checked={draftUnitIds.includes(unit.id)}
              onChange={() => toggleUnit(unit.id)}/>
            <span>{unit.name}</span>
          </label>)}
        </div>
      </fieldset>
      <fieldset className="agenda-multifilter-list">
        <legend>Profissionais <small>({effectiveProfessionals.length}/{permittedProfessionals.length})</small></legend>
        <div className="agenda-multifilter-options">
          <label className="agenda-multifilter-row is-all">
            <input type="checkbox" checked={allProfessionalsChecked} onChange={toggleAllProfessionals}/>
            <span>Todos os profissionais</span>
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
        </div>
      </fieldset>
    </div>
    <div className="agenda-multifilter-footer">
      <p className="agenda-multifilter-status" role={invalid ? "alert" : "status"}>
        {invalid ? "Marque pelo menos uma unidade e um profissional." :
          dirty ? "Seleção alterada. Clique em Aplicar filtros para atualizar a agenda." :
          "Filtrando os profissionais e unidades selecionados."}
      </p>
      <div className="agenda-multifilter-actions">
        <button type="button" className="btn secondary" onClick={() => {
          setDraftUnitIds(allUnits);
          setDraftProfessionalIds(allProfessionals);
          onApply(allUnits, allProfessionals);
        }}>Limpar filtros</button>
        <button type="button" className="btn primary" disabled={invalid || !dirty}
          onClick={() => onApply(draftUnitIds, effectiveProfessionals)}>Aplicar filtros</button>
      </div>
    </div>
  </div>;
}
