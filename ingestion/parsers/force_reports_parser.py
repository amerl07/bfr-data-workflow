"""Parses force_reports.txt, the primary numeric artifact in a post.zip.

Format confirmed against two real samples: docs/force_reports.txt (run
"NC_B27_UT_Cornering_No_Fillets_20260724") and
docs/"force_reports copy.txt" (run
"DY_RW_newMainplaneGurney_straightline_20260731"):

    # <arbitrary header comment lines, '#'-prefixed>
    <Label>          <value>          <unit-or-blank>
    ...

Header comments carry real semantic content, not just free text -- the
sample has:
    # BFR report export   run: <run_name>
    # raw report values (half-car, undoubled) per BFR_CFD_Standards
    # DF sign convention: downforce reads negative

Confirmed findings from that one sample, plus decisions made on each
(2026-07-26) -- treat the findings as confirmed for this format, not
guessed, but this is still a single sample:

- There is NO CL/CD (dimensionless coefficient) in this file -- only raw
  forces in Newtons ("Total DF", "Total Drag", "Body DF", "RW Drag", "FW
  DF", "RW DF", "UT DF", "Total Aero DF", "Wheel DF", "Whisker DF") plus a
  couple of non-force values ("CoP", "CoP meters", "Cell count"). Computing
  a true CL/CD coefficient needs a reference velocity, reference area, and
  air density (F = 0.5 * rho * V^2 * A * C) -- none of which appear here,
  and getting those parameters out of the sims is hard for this team right
  now. DECIDED: store the raw force values instead of CL/CD for now (see
  data/results.csv's `raw_force_values` column and
  ingestion/queue_consumer/main.py::format_raw_force_values) -- nothing
  here computes a coefficient.
- "CoP" (e.g. 53.437586, unitless) and "CoP meters" (e.g. 0.841642, m) are
  two different representations of center of pressure in the same file --
  the unitless one is a percentage. DECIDED: keep both;
  ForceReportData.CoP is the percentage, CoP_meters is the absolute
  distance.
- swept_variable / swept_range are NOT present anywhere in this file. This
  answers the previously-open question from Proposal Outline §6 / spec §5,
  at least for a single-run export like this one -- ForceReportData always
  returns them as None. If sweep data needs to be captured, it'll have to
  come from elsewhere (e.g. the sweep tool's own trials log, per Proposal
  Outline §4.3), not from force_reports.txt.
- Values are explicitly "half-car, undoubled" per the header comment.
  DECIDED: leave them as-is for now (no doubling) -- parse_force_report
  returns whatever the file says, unmodified, plus the header note itself
  (header_notes) so the caveat travels with the data rather than getting
  lost.

New finding from the second sample (2026-08-01), which broke both the line
regex and every label lookup until fixed:
- That export spells every label with underscores instead of spaces
  ("Body_DF" vs "Body DF", "CoP_Meters" vs "CoP meters" -- note the
  differing capitalization too), and adds four labels never seen before
  ("Radiator_MFR", "Inlet_MFA", "Outlet_MFA", "Pressure_Drop" -- cooling/
  pressure figures, not forces). DECIDED: `_VALUE_LINE_PATTERN` now accepts
  underscores (and `/` in the unit, for "kg/s"), and every label lookup
  (CoP/CoP_meters here, FORCE_LABEL_COLUMNS in
  ingestion/queue_consumer/main.py) goes through `normalize_label` so both
  spellings resolve to the same field/column. `raw_values`/`raw_force_values`
  still key on the label exactly as written in the file -- only lookups are
  normalized, not storage. The four new labels have no dedicated column
  (per the 2026-07-29 "don't invent columns for undefined labels" decision
  above) -- they stay in raw_force_values only.
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

    # Target schema fields (spec §7), per the decisions in this module's
    # docstring. No CL/CD field -- see data/results.csv's
    # `raw_force_values` column instead. swept_variable/swept_range are
    # confirmed absent from this file format.
    CoP: Optional[float] = None  # percentage
    CoP_meters: Optional[float] = None
    swept_variable: Optional[str] = None
    swept_range: Optional[str] = None


_HEADER_RUN_PATTERN = re.compile(r"run:\s*(?P<run_name>\S+)")
# Label: letters/digits/spaces, non-greedy so it stops at the first run of
# 2+ whitespace (the column gap) rather than consuming into it -- labels
# observed so far only ever have single internal spaces ("Body DF", "Total
# Aero DF"), so this correctly keeps multi-word labels intact.
_VALUE_LINE_PATTERN = re.compile(
    r"^(?P<label>[A-Za-z][A-Za-z0-9_ ]*?)\s{2,}(?P<value>-?\d+\.\d+)\s*(?P<unit>[A-Za-z/]*)\s*$"
)


def normalize_label(label: str) -> str:
    """Case/underscore/whitespace-insensitive form of a force_reports.txt
    label, so the same field matches regardless of which confirmed label
    spelling a given export uses (e.g. "Body DF" vs "Body_DF", "CoP meters"
    vs "CoP_Meters") -- see the module docstring's 2026-08-01 finding."""
    return " ".join(label.replace("_", " ").split()).lower()


def parse_force_report(raw_text: str) -> ForceReportData:
    """Parses the raw label/value/unit rows and header comments. See this
    module's docstring for the decisions behind which fields are/aren't
    populated (no CL/CD; CoP and CoP_meters both kept; swept_variable/
    swept_range always None for this format).
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

    normalized_values = {normalize_label(label): value for label, value in raw_values.items()}

    return ForceReportData(
        run_name=run_name,
        raw_values=raw_values,
        units=units,
        header_notes=header_notes,
        CoP=normalized_values.get("cop"),
        CoP_meters=normalized_values.get("cop meters"),
    )
