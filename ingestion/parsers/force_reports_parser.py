"""Parses force_reports.txt, the primary numeric artifact in a post.zip.

    # <arbitrary header comment lines, '#'-prefixed>
    <Label>          <value>          <unit-or-blank>
    ...

Header comments carry real semantic content, not just free text -- the
sample has:
    # BFR report export   run: <run_name>
    # raw report values (half-car, undoubled) per BFR_CFD_Standards
    # DF sign convention: downforce reads negative


- swept_variable / swept_range are NOT present anywhere in this file YET. This
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
    #
    # CoP/CoP_meters used to live here too, but as of 2026-08-27 they're
    # unified into the same generic label->column mechanism as every other
    # force value (FORCE_LABEL_COLUMNS in ingestion/queue_consumer/main.py,
    # keyed off raw_values via normalize_label) -- there was nothing
    # actually special about them needing their own dataclass fields.
    # "CoP" and "CoP meters" are still two distinct labels in the source
    # file (a percentage and an absolute distance respectively), so they
    # still end up as two distinct results.csv columns -- unifying the
    # *mechanism* doesn't merge the *fields*.
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
    populated (no CL/CD; swept_variable/swept_range always None for this
    format). CoP/CoP_meters aren't separate outputs here -- they're just
    two more entries in raw_values, resolved into their own results.csv
    columns the same generic way as every other force label (see
    ingestion/queue_consumer/main.py::FORCE_LABEL_COLUMNS).
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
    )
