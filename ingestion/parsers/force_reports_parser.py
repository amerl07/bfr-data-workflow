"""Parses force_reports.txt, the primary numeric artifact in a post.zip.

Format confirmed against one real sample (docs/force_reports.txt, run
"NC_B27_UT_Cornering_No_Fillets_20260724"):

    # <arbitrary header comment lines, '#'-prefixed>
    <Label>          <value>          <unit-or-blank>
    ...

Header comments carry real semantic content, not just free text -- the
sample has:
    # BFR report export   run: <run_name>
    # raw report values (half-car, undoubled) per BFR_CFD_Standards
    # DF sign convention: downforce reads negative

Confirmed findings from that one sample -- treat as confirmed for this
format, not guessed, but this is still a single sample:

- There is NO CL/CD (dimensionless coefficient) in this file -- only raw
  forces in Newtons ("Total DF", "Total Drag", "Body DF", "RW Drag", "FW
  DF", "RW DF", "UT DF", "Total Aero DF", "Wheel DF", "Whisker DF") plus a
  couple of non-force values ("CoP", "CoP meters", "Cell count"). Computing
  a true CL/CD coefficient needs a reference velocity, reference area, and
  air density (F = 0.5 * rho * V^2 * A * C) -- none of which appear here.
  The header's "per BFR_CFD_Standards" reference implies those constants
  exist somewhere as a team convention, just not in this file. NOT resolved
  here -- see CONTRIBUTING.md open questions. parse_force_report only
  returns the raw values; nothing here computes CL/CD.
- "CoP" (e.g. 53.437586, unitless) and "CoP meters" (e.g. 0.841642, m) are
  two different representations of center of pressure in the same file.
  Which maps to the results.csv `CoP` column -- or whether both should be
  kept -- isn't fully settled; ForceReportData.CoP currently takes the
  unitless "CoP" value as the more literal name match, but flag this if
  that's wrong.
- swept_variable / swept_range are NOT present anywhere in this file. This
  answers the previously-open question from Proposal Outline §6 / spec §5,
  at least for a single-run export like this one -- ForceReportData always
  returns them as None. If sweep data needs to be captured, it'll have to
  come from elsewhere (e.g. the sweep tool's own trials log, per Proposal
  Outline §4.3), not from force_reports.txt.
- Values are explicitly "half-car, undoubled" per the header comment.
  Whether to double them for a full-car representation, or store as-is
  with that noted, is NOT decided here -- parse_force_report returns
  whatever the file says, unmodified, plus the header note itself
  (header_notes) so the caveat travels with the data rather than getting
  lost.
"""

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ForceReportData:
    run_name: Optional[str] = None
    raw_values: Dict[str, float] = field(default_factory=dict)
    units: Dict[str, str] = field(default_factory=dict)
    # Header comment lines that aren't the "run: ..." one, verbatim (e.g.
    # the half-car/undoubled note and the sign-convention note) -- kept so
    # important caveats travel with the data instead of being silently lost.
    header_notes: List[str] = field(default_factory=list)

    # Target schema fields (spec §7) -- deliberately left unset by this
    # parser per the findings above. CL/CD would need a separate
    # compute-coefficients step once reference constants are known;
    # swept_variable/swept_range are confirmed absent from this file format.
    CL: Optional[float] = None
    CD: Optional[float] = None
    CoP: Optional[float] = None
    swept_variable: Optional[str] = None
    swept_range: Optional[str] = None


_HEADER_RUN_PATTERN = re.compile(r"run:\s*(?P<run_name>\S+)")
# Label: letters/digits/spaces, non-greedy so it stops at the first run of
# 2+ whitespace (the column gap) rather than consuming into it -- labels
# observed so far only ever have single internal spaces ("Body DF", "Total
# Aero DF"), so this correctly keeps multi-word labels intact.
_VALUE_LINE_PATTERN = re.compile(
    r"^(?P<label>[A-Za-z][A-Za-z0-9 ]*?)\s{2,}(?P<value>-?\d+\.\d+)\s*(?P<unit>[A-Za-z]*)\s*$"
)


def parse_force_report(raw_text: str) -> ForceReportData:
    """Parses the raw label/value/unit rows and header comments.

    Does NOT populate CL/CD/CoP/swept_variable/swept_range in the
    results.csv sense (beyond the literal "CoP" label) -- see this
    module's docstring for why those remain open questions rather than
    something to guess at here.
    """
    run_name = None
    header_notes: List[str] = []
    raw_values: Dict[str, float] = {}
    units: Dict[str, str] = {}

    for line in raw_text.splitlines():
        line = line.rstrip()
        if not line.strip():
            continue

        if line.lstrip().startswith("#"):
            comment = line.lstrip("#").strip()
            run_match = _HEADER_RUN_PATTERN.search(comment)
            if run_match:
                run_name = run_match.group("run_name")
            else:
                header_notes.append(comment)
            continue

        value_match = _VALUE_LINE_PATTERN.match(line)
        if not value_match:
            # Doesn't match the label/value/unit shape -- this format is
            # only confirmed against one sample and could easily vary, so
            # don't silently drop an unrecognized line.
            header_notes.append(f"UNPARSED: {line}")
            continue

        label = value_match.group("label").strip()
        raw_values[label] = float(value_match.group("value"))
        units[label] = value_match.group("unit") or ""

    return ForceReportData(
        run_name=run_name,
        raw_values=raw_values,
        units=units,
        header_notes=header_notes,
        CoP=raw_values.get("CoP"),
    )
