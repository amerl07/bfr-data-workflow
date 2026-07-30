import type { SimRow } from "./types";

/** Related-simulations score: +1 for each of component / sweep_type /
 * swept_variable / owner_initials shared with `current` (blank fields never
 * match). Ties broken by input order (stable sort). */
export function findRelatedSimulations(current: SimRow, all: SimRow[], limit = 6): SimRow[] {
  return all
    .filter((r) => r.job_name !== current.job_name)
    .map((row) => {
      let score = 0;
      if (current.component && row.component === current.component) score += 1;
      if (current.sweep_type && row.sweep_type === current.sweep_type) score += 1;
      if (current.swept_variable && row.swept_variable === current.swept_variable) score += 1;
      if (current.owner_initials && row.owner_initials === current.owner_initials) score += 1;
      return { row, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.row);
}
