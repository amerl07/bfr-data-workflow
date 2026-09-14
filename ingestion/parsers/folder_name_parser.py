"""Parses Drive batch/sweep-folder names.

Convention, decided 2026-09-13 (see CONTRIBUTING.md §1b): deliberately
reuses the exact same five-token shape as sim_filename_parser.py's job-name
convention, applied one level up, with the DESCRIPTION token naming the
*variable being swept* rather than a value along it:

    {INITIALS}_{COMPONENT}_{SWEPTVARIABLE}_{SWEEPTYPE}_{YYYYMMDD}

e.g. `YL_FC_MeshBase_Straight_20260913`, enclosing sims individually named
`YL_FC_MeshBase30mm_Straight_20260913`, `YL_FC_MeshBase35mm_Straight_20260913`,
... -- one folder per swept variable, one file per value along it (the
numeric value + optional unit suffix on each file's own DESCRIPTION token,
parsed out by sim_filename_parser.extract_swept_value). Reusing the file
convention's shape rather than inventing a second one means no new naming
scheme to learn and no second parser implementation -- this module's regex
is intentionally identical to sim_filename_parser's.

Only reached when a post job is actually dropped inside a named batch
folder (BatchFolderDetector.gs case 1/2) -- a post.zip dropped loose still
has no `batch_folder_name` at all and never calls this.
"""

import re
from dataclasses import dataclass

from ingestion.parsers.sim_filename_parser import normalize_sweep_type

# Same five-plain-token-plus-date shape as sim_filename_parser._JOB_NAME_PATTERN
# -- see this module's docstring for why it's intentionally not shared code,
# just the same shape: the two conventions are allowed to diverge later
# without one parser silently breaking the other.
_FOLDER_NAME_PATTERN = re.compile(
    r"^(?P<initials>[A-Za-z]+)_(?P<component>[A-Za-z0-9]+)_(?P<swept_variable>[A-Za-z0-9]+)"
    r"_(?P<sweep_type>[A-Za-z0-9]+)_(?P<date>\d{8})$"
)

_FULL_CAR_COMPONENT = "FC"


@dataclass
class BatchFolderMetadata:
    raw_name: str
    owner_initials: str
    component: str
    # The variable this batch sweeps (e.g. "MeshBase") -- not a value, see
    # module docstring. Becomes data/results.csv's swept_variable column.
    swept_variable: str
    sweep_type: str
    date: str
    is_full_car: bool


def parse_batch_folder_name(folder_name: str) -> BatchFolderMetadata:
    """Parse a Drive batch/sweep-folder name (see module docstring).

    Raises ValueError -- a real error, not NotImplementedError -- on a
    folder name that doesn't match the convention, since this is no longer
    a stub: a queue row whose batch folder fails to parse is marked
    `error: ...`, not `blocked: ...` (see queue_consumer/main.py::process_row).
    """
    match = _FOLDER_NAME_PATTERN.match(folder_name)
    if not match:
        raise ValueError(
            "batch folder name does not match "
            f"{{INITIALS}}_{{COMPONENT}}_{{SWEPTVARIABLE}}_{{SWEEPTYPE}}_{{YYYYMMDD}}: {folder_name!r}"
        )

    return BatchFolderMetadata(
        raw_name=folder_name,
        owner_initials=match.group("initials"),
        component=match.group("component"),
        swept_variable=match.group("swept_variable"),
        sweep_type=normalize_sweep_type(match.group("sweep_type")),
        date=match.group("date"),
        is_full_car=match.group("component") == _FULL_CAR_COMPONENT,
    )
