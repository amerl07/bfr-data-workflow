"""Parses Drive batch-folder names.

Convention (Proposal Outline §5), applied at the batch-folder level, not to
individual files inside:

    {COMPONENT}_{VERSION}_{SWEEPTYPE}_{YYYYMMDD}_{INITIALS}

Component codes: RW (rear wing), FW (front wing), UT (undertray),
DIF (diffuser), SP (side pod), FC (full car -- lists mounted component
versions hyphen-separated, e.g. FC_RWv3-UTv1-FWv2_...).

Sweep type codes: VEL, YAW, RH, AOA, COMBO.

Absence of FC implies an isolated-component run.
"""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class BatchFolderMetadata:
    raw_name: str
    component: str
    # TODO: shape not finalized. For an isolated run this is a single
    # component code + version. For an FC run it's a list of
    # (component, version) pairs parsed out of the hyphen-separated list
    # (e.g. "RWv3-UTv1-FWv2" -> [("RW", "v3"), ("UT", "v1"), ("FW", "v2")]).
    # Decide whether both cases share this field or need separate fields
    # before implementing.
    component_versions: List[str]
    sweep_type: str
    date: str
    owner_initials: str
    is_full_car: bool


def parse_batch_folder_name(folder_name: str) -> BatchFolderMetadata:
    """Parse a Drive batch-folder name into structured metadata.

    TODO:
    - Regex/split on `{COMPONENT}_{VERSION}_{SWEEPTYPE}_{YYYYMMDD}_{INITIALS}`.
    - Handle the FC case separately: FC_<comp>v<ver>-<comp>v<ver>-..._... has
      a hyphen-separated version list in the COMPONENT/VERSION slot instead
      of a single component+version.
    - Validate COMPONENT against the known code set (RW, FW, UT, DIF, SP, FC)
      and SWEEPTYPE against (VEL, YAW, RH, AOA, COMBO); decide how to handle
      an unrecognized code (reject vs. pass through with a warning) rather
      than defaulting silently.
    - is_full_car should be True iff the component code is exactly "FC" --
      but see sim_filename_parser.reconcile_isolated_vs_fullcar for the open
      question about cross-checking this against the Sabalcore-level ISO_
      prefix signal.
    """
    raise NotImplementedError("folder name parsing not yet implemented")
