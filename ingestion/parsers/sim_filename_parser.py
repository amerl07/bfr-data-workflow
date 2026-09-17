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
from typing import Optional, Tuple


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


def normalize_sweep_type(raw_sweep_type: str) -> str:
    """Case-insensitive canonicalization for the two sweep types confirmed
    to have two live spellings (CORNER/CORNERING, STRAIGHT/STRAIGHTLINE --
    see _SWEEP_TYPE_ALIASES and the module docstring). Any other value
    (VEL, YAW, RH, AOA, COMBO, or an undefined code) is returned exactly as
    written -- not case-folded, not aliased.

    Public (not module-private) since ingestion/parsers/folder_name_parser.py
    reuses it -- batch/sweep folder names share this same sweep-type token.
    """
    return _SWEEP_TYPE_ALIASES.get(raw_sweep_type.upper(), raw_sweep_type)


# A batch/sweep-folder DESCRIPTION token (e.g. "MeshBase30mm") is this
# batch's declared swept-variable name (e.g. "MeshBase", from
# folder_name_parser.py) immediately followed by this particular sim's
# numeric value and an optional unit -- no separator, matching how the
# filename convention packs every field into plain alnum tokens.
_SWEPT_VALUE_SUFFIX_PATTERN = re.compile(r"^(?P<value>\d+(?:\.\d+)?)(?P<unit>[A-Za-z]*)$")


def extract_swept_value(description: str, swept_variable: str) -> Optional[Tuple[float, str]]:
    """Splits a sim's own DESCRIPTION token into (value, unit) given the
    enclosing batch folder's declared swept_variable name, e.g.
    `extract_swept_value("MeshBase30mm", "MeshBase")` -> `(30.0, "mm")`.

    Returns None -- not a raise -- when `description` doesn't start with
    `swept_variable` followed by a bare number(+unit), same "parse whatever
    matches, don't invent/reject" spirit as sweep-type/component codes
    above: a sim dropped in a batch folder whose description doesn't
    actually encode a value along that folder's variable (typo, or just an
    unrelated one-off file) shouldn't block ingestion, it just doesn't get
    a swept_value.
    """
    if not description.startswith(swept_variable):
        return None
    match = _SWEPT_VALUE_SUFFIX_PATTERN.match(description[len(swept_variable) :])
    if not match:
        return None
    return float(match.group("value")), match.group("unit")


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
        _raise_not_post_zip(filename)
    job_name = filename[len("post_") : -len(".zip")]
    return _parse_job_name(filename, job_name)


def _raise_not_post_zip(filename: str) -> None:
    """Raises for parse_post_zip_filename's not-a-`post_<job_name>.zip`
    case, with a more specific message when `filename` looks like the
    *batch/sweep folder itself* (see folder_name_parser.py) rather than an
    individual job -- confirmed 2026-09-16 as an easy mistake: a batch
    folder is `{INITIALS}_{COMPONENT}_{SWEPTVARIABLE}_{SWEEPTYPE}_{YYYYMMDD}`
    with NO `post_` prefix (unlike a job's post.zip, which always has one),
    so uploading it as e.g. `post_YL_FC_MeshBase_Straight_20260913` (a
    folder, no `.zip`, extra `post_` tacked on) makes BatchFolderDetector.gs
    treat it as an individual already-unzipped post job instead of the
    batch folder it's meant to be, and lands here.

    Detected via the DESCRIPTION token having no digits -- a real per-value
    job description always ends in the swept value (e.g. "MeshBase30mm"),
    while a batch folder's SWEPTVARIABLE token never does (e.g. "MeshBase")
    -- same "value present" signal sim_filename_parser.extract_swept_value
    itself splits on. Not foolproof (a genuinely digit-free one-off
    description would also trip this), but the generic fallback message
    below still applies to a filename that doesn't match the job-name shape
    at all.
    """
    if filename.startswith("post_") and not filename.endswith(".zip"):
        candidate = filename[len("post_") :]
        match = _JOB_NAME_PATTERN.match(candidate)
        if match and not any(ch.isdigit() for ch in match.group("description")):
            example = (
                f"post_{match.group('initials')}_{match.group('component')}_"
                f"{match.group('description')}30mm_{match.group('sweep_type')}_"
                f"{match.group('date')}.zip"
            )
            raise ValueError(
                f"{filename!r} looks like a batch/sweep folder "
                f"({{INITIALS}}_{{COMPONENT}}_{{SWEPTVARIABLE}}_{{SWEEPTYPE}}_{{YYYYMMDD}}, "
                f"i.e. {candidate!r}) that got an extra 'post_' prefix and was uploaded as "
                "a job folder instead. Batch folders are NOT prefixed with 'post_' -- only "
                f"individual post_<job_name>.zip files are. Rename this folder to {candidate!r} "
                f"and put separate post_<job_name>.zip files (one per swept value, e.g. {example!r}) "
                "inside it, rather than uploading the batch folder itself as a post job."
            )
    raise ValueError(f"expected a post_<job_name>.zip filename, got: {filename!r}")


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
        sweep_type=normalize_sweep_type(match.group("sweep_type")),
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
    (SimFileMetadata.is_full_car). `folder_is_full_car` is None whenever
    there's no batch folder (a post.zip dropped loose -- still the common
    case), in which case this just returns the filename's signal. When a
    sim *is* inside a batch/sweep folder (see folder_name_parser.py, no
    longer a stub as of the batch-sweep-folder support), the folder's own
    COMPONENT token is cross-checked here too, surfacing a `CONFLICT: ...`
    on disagreement rather than silently picking one.

    @param folder_is_full_car: True/False if a Drive batch folder's
        component code is available to check against, None if there's no
        batch folder (a post.zip dropped loose).
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
