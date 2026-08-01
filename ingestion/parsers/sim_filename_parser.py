"""Parses Sabalcore .sim and post.zip file names.

Convention (docs/Aero Subsystem Data Workflow — Proposal Outline.md §5,
updated 2026-07-29 -- this is now the single naming layer this parser reads;
the separate Drive batch-folder convention and ISO_ prefix scheme are
superseded by it):

    {INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}_{YYYYMMDD}.sim

e.g. NC_UT_NoFillets_Cornering_20260724, YL_WSK_VariableAoA_Straightline_20260529
-- five plain (no-underscore) tokens. Component codes: RW, FW, UT, WSK, BW,
FC (Proposal Outline §5); sweep type codes: CORNERING, STRAIGHTLINE, VEL,
YAW, RH, AOA, COMBO -- neither is validated here (parse whatever's actually
there, per the "ignore undefined, don't invent" approach used for force
labels too). Absence of FC as the component implies an isolated-component
run (Proposal Outline §5's rule) -- there's no separate ISO_ prefix anymore.

Sweep type is case-insensitively normalized, and the pre-2026-08-01
abbreviations CORNER/STRAIGHT (the Team Usage Guide's sweep-type codes
before that date -- see its git history) are treated as equal to
CORNERING/STRAIGHTLINE respectively, so old and new filenames land in the
same `sweep_type` bucket in data/results.csv instead of the web app
splitting them into separate filter groups. See _SWEEP_TYPE_ALIASES. Every
other sweep type code is left exactly as written in the filename -- no
case-folding, no alias -- per the "don't invent" approach above; this
normalization only applies to the two codes now confirmed to have two
live spellings.

post.zip names wrap the .sim base: post_<job_name>.zip, i.e.
post_{INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}_{YYYYMMDD}.zip.
"""

import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class SimFileMetadata:
    raw_name: str
    owner_initials: str
    component: str
    description: str
    sweep_type: str
    date: str
    is_full_car: bool
    job_name: str


# Five plain tokens (letters/digits, no underscores) plus an 8-digit date --
# a fixed-shape split, not a greedy "everything in between" match, since the
# convention now names each field individually instead of leaving a variable
# free-form descriptor.
_JOB_NAME_PATTERN = re.compile(
    r"^(?P<initials>[A-Za-z]+)_(?P<component>[A-Za-z0-9]+)_(?P<description>[A-Za-z0-9]+)"
    r"_(?P<sweep_type>[A-Za-z0-9]+)_(?P<date>\d{8})$"
)

_FULL_CAR_COMPONENT = "FC"

# Case-insensitive: keys are matched against sweep_type.upper(). Values are
# the canonical form now documented in the Team Usage Guide (2026-08-01
# update) -- CORNER/STRAIGHT are the pre-update abbreviations, kept as
# accepted aliases rather than breaking old filenames.
_SWEEP_TYPE_ALIASES = {
    "CORNER": "CORNERING",
    "CORNERING": "CORNERING",
    "STRAIGHT": "STRAIGHTLINE",
    "STRAIGHTLINE": "STRAIGHTLINE",
}


def _normalize_sweep_type(raw_sweep_type: str) -> str:
    """Case-insensitive canonicalization for the two sweep types confirmed
    to have two live spellings (CORNER/CORNERING, STRAIGHT/STRAIGHTLINE --
    see _SWEEP_TYPE_ALIASES and the module docstring). Any other value
    (VEL, YAW, RH, AOA, COMBO, or an undefined code) is returned exactly as
    written -- not case-folded, not aliased.
    """
    return _SWEEP_TYPE_ALIASES.get(raw_sweep_type.upper(), raw_sweep_type)


def parse_sim_filename(filename: str) -> SimFileMetadata:
    """Parse a `{INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}_{YYYYMMDD}.sim` filename."""
    if not filename.endswith(".sim"):
        raise ValueError(f"expected a .sim filename, got: {filename!r}")
    job_name = filename[: -len(".sim")]
    return _parse_job_name(filename, job_name)


def parse_post_zip_filename(filename: str) -> SimFileMetadata:
    """Parse a `post_<job_name>.zip` filename.

    Current scope (see CONTRIBUTING.md): post.zip (or an already-unzipped
    post_<job_name> folder, whose name has already had post_ stripped in
    the same way before reaching here) is the only artifact type this
    pipeline ingests -- there is no other file-type pattern to fall back
    to. A filename that doesn't match the post_/.zip wrapper is treated as
    an anomaly and raises, rather than being routed anywhere.
    """
    if not (filename.startswith("post_") and filename.endswith(".zip")):
        raise ValueError(f"expected a post_<job_name>.zip filename, got: {filename!r}")
    job_name = filename[len("post_") : -len(".zip")]
    return _parse_job_name(filename, job_name)


def _parse_job_name(raw_name: str, job_name: str) -> SimFileMetadata:
    match = _JOB_NAME_PATTERN.match(job_name)
    if not match:
        raise ValueError(
            "job name does not match "
            f"{{INITIALS}}_{{COMPONENT}}_{{DESCRIPTION}}_{{SWEEPTYPE}}_{{YYYYMMDD}}: {job_name!r}"
        )

    return SimFileMetadata(
        raw_name=raw_name,
        owner_initials=match.group("initials"),
        component=match.group("component"),
        description=match.group("description"),
        sweep_type=_normalize_sweep_type(match.group("sweep_type")),
        date=match.group("date"),
        is_full_car=match.group("component") == _FULL_CAR_COMPONENT,
        job_name=job_name,
    )


def reconcile_isolated_vs_fullcar(
    folder_is_full_car: Optional[bool], sim_is_full_car: bool
) -> str:
    """Reconcile the Drive-folder and filename isolated-vs-fullcar signals
    into one of "full_car", "isolated", or a "CONFLICT: ..." string.

    Background: originally two independent naming layers -- a Drive
    batch-folder convention and a separate Sabalcore-filename ISO_ prefix --
    that could disagree. The filename convention (see this module's
    docstring) now encodes it directly via the COMPONENT token
    (SimFileMetadata.is_full_car), and the Drive batch-folder layer is out
    of current scope (folder_name_parser is still a stub, batch folders
    aren't used) -- so `folder_is_full_car` is normally None and this just
    returns the filename's signal. Kept as a two-signal reconciliation
    (rather than simplified to filename-only) so a real batch-folder signal,
    if that ever comes back into scope, still gets cross-checked and
    disagreements surfaced rather than silently overridden.

    @param folder_is_full_car: True/False if a Drive batch folder's
        component code is available to check against, None if there's no
        batch folder (the common case right now).
    @param sim_is_full_car: SimFileMetadata.is_full_car from the post.zip
        filename.
    """
    if folder_is_full_car is None:
        return "full_car" if sim_is_full_car else "isolated"

    if folder_is_full_car == sim_is_full_car:
        return "full_car" if folder_is_full_car else "isolated"

    folder_label = "full_car" if folder_is_full_car else "isolated"
    sim_label = "full_car" if sim_is_full_car else "isolated"
    return f"CONFLICT: folder says {folder_label}, filename says {sim_label}"
