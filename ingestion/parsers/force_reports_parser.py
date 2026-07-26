"""Parses force_reports.txt, the primary numeric artifact in a post.zip.

The text format is NOT documented anywhere yet -- post_zip_file_format_spec.md
§5 explicitly defers this ("the text format itself is not yet documented here
and should get its own spec once a sample is available"). Do not guess at
delimiters, layout, or units. This module stays a stub until a real sample
file exists.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class ForceReportData:
    # Field shape is provisional, per the target schema in spec §7 -- not
    # confirmed against a real sample. Revisit once force_reports.txt is in
    # hand.
    CL: Optional[float] = None
    CD: Optional[float] = None
    CoP: Optional[float] = None
    # OPEN QUESTION (Proposal Outline §6, spec §5): unconfirmed whether
    # force_reports.txt includes the swept variable + range at all, or only
    # CL/CD/CoP at each point. Do not assume presence.
    swept_variable: Optional[str] = None
    swept_range: Optional[str] = None


def parse_force_report(raw_text: str) -> ForceReportData:
    """Parse the contents of a force_reports.txt file.

    TODO: everything. No sample of this file exists yet -- get one before
    writing any parsing logic here. In particular confirm:
    - Overall structure (single summary block vs. per-iteration table).
    - Whether swept_variable/swept_range are present at all (see the open
      question above) -- if absent, that data would need to come from
      elsewhere (e.g. re-derived from the sweep tooling itself, per
      Proposal Outline §4.3), which is out of scope for this function.
    - Units and sign conventions for CL/CD/CoP.
    """
    raise NotImplementedError(
        "force_reports.txt format is unconfirmed -- no sample file available yet"
    )
