/**
 * Filter only the units this tenant has already loaded and authorized.
 * An absent or stale selection means all currently active units.
 */
export function parseAgendaUnits(
  raw: string,
  available: readonly string[],
  legacySingle = "",
): string[] {
  const ids = [...new Set(available.filter(Boolean))];
  if (!ids.length) return [];
  const requested = raw.trim()
    ? raw.split(",").map(value => value.trim()).filter(Boolean).slice(0, 100)
    : legacySingle ? [legacySingle] : ids;
  const allowed = new Set(requested);
  const filtered = ids.filter(id => allowed.has(id));
  return filtered.length ? filtered : ids;
}

/** All selected is encoded as an empty filter to keep existing agenda links intact. */
export function serializeAgendaUnits(
  selected: readonly string[],
  available: readonly string[],
): string {
  const ids = [...new Set(available.filter(Boolean))];
  const allowed = new Set(selected);
  const filtered = ids.filter(id => allowed.has(id));
  return filtered.length === ids.length || filtered.length === 0 ? "" : filtered.join(",");
}

/** Avoid an empty agenda if the last unit is unticked: switch back to all. */
export function toggleAgendaUnit(
  current: readonly string[],
  unitId: string,
  available: readonly string[],
): string[] {
  const ids = [...new Set(available.filter(Boolean))];
  if (!ids.includes(unitId)) return ids.filter(id => current.includes(id));
  const result = current.includes(unitId)
    ? ids.filter(id => current.includes(id) && id !== unitId)
    : ids.filter(id => current.includes(id) || id === unitId);
  return result.length ? result : ids;
}
