export interface RawForceEntry {
  label: string;
  value: number;
  unit: string;
}

// Matches the leading numeric value, capturing whatever's left (the unit,
// if any) as the remainder -- values and units are concatenated with no
// separator in raw_force_values (see
// ingestion/queue_consumer/main.py::format_raw_force_values, `f"{label}=
// {value}{unit}"`), e.g. "0.27051kg/s" or "53.437586" (no unit).
const VALUE_PATTERN = /^(-?\d+(?:\.\d+)?)(.*)$/;

/** Normalized (lowercase, underscores/whitespace collapsed to single
 * spaces) form of a label, matching
 * ingestion/parsers/force_reports_parser.py::normalize_label so lookups
 * don't care whether the source file spelled a label "Radiator_MFR" or
 * "Radiator MFR". */
export function normalizeLabel(label: string): string {
  return label
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Parses the ";"-joined "label=valueunit" string in a row's
 * raw_force_values (see ingestion/queue_consumer/main.py::
 * format_raw_force_values) into entries keyed by normalizeLabel(label), so
 * fields with no dedicated SimRow column -- e.g. the cooling/pressure
 * labels (Radiator MFR, Inlet MFA, Outlet MFA, Pressure Drop) -- can still
 * be looked up and displayed. */
export function parseRawForceValues(raw: string): Map<string, RawForceEntry> {
  const entries = new Map<string, RawForceEntry>();
  if (!raw) return entries;

  for (const part of raw.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const label = part.slice(0, eqIndex).trim();
    const rest = part.slice(eqIndex + 1).trim();
    if (!label || !rest) continue;

    const match = VALUE_PATTERN.exec(rest);
    if (!match) continue;
    const value = Number(match[1]);
    if (!Number.isFinite(value)) continue;

    entries.set(normalizeLabel(label), { label, value, unit: match[2].trim() });
  }
  return entries;
}
