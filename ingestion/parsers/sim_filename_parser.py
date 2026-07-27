"""Parses Sabalcore .sim and post.zip file names.

Convention (Sabalcore Usage Guide; post_zip_file_format_spec.md §0):

    <INITIALS>_<descriptor>_<YYYYMMDD>.sim

Isolated-part runs prefix the descriptor with ISO_, e.g.
DY_ISO_RWv3_20260709.sim. Confirmed against every example filename in the
docs (DY_B27_baseline_20260601, MT_RWsweep_v2_20260610, DY_ISO_RWv3_20260709)
plus one real upload (NC_B27_UT_Cornering_Outwash_20260726) -- the
descriptor itself may contain underscores, so parsing anchors on the first
underscore (initials, always letters) and the last 8-digit run (date),
treating everything in between as the descriptor.

post.zip names wrap the .sim base: post_<job_name>.zip, i.e.
post_<INITIALS>_<descriptor>_<YYYYMMDD>.zip (or with ISO_ in the
descriptor).
"""

import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class SimFileMetadata:
    raw_name: str
    owner_initials: str
    descriptor: str
    date: str
    is_isolated: bool
    job_name: str


# Anchors: initials are letters only (every example: DY, MT, YM, LC, NC),
# date is 8 digits. `.+` for descriptor is greedy, so it naturally backtracks
# to match the *last* `_<8 digits>` in the string as the date -- correct
# even when the descriptor itself contains underscores (e.g. "RWsweep_v2",
# "B27_UT_Cornering_Outwash").
_JOB_NAME_PATTERN = re.compile(r"^(?P<initials>[A-Za-z]+)_(?P<descriptor>.+)_(?P<date>\d{8})$")

_ISO_PREFIX = "ISO_"


def parse_sim_filename(filename: str) -> SimFileMetadata:
    """Parse a `<INITIALS>_<descriptor>_<YYYYMMDD>.sim` filename."""
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
            f"job name does not match <INITIALS>_<descriptor>_<YYYYMMDD>: {job_name!r}"
        )

    initials = match.group("initials")
    descriptor = match.group("descriptor")
    date = match.group("date")

    # Decision (was an open TODO): is_isolated is the authoritative signal;
    # descriptor is stored with ISO_ stripped so downstream consumers don't
    # need to re-check the prefix themselves. `job_name` keeps ISO_ (it's
    # the literal Sabalcore run-directory name, unmodified).
    is_isolated = descriptor.startswith(_ISO_PREFIX)
    if is_isolated:
        descriptor = descriptor[len(_ISO_PREFIX) :]

    return SimFileMetadata(
        raw_name=raw_name,
        owner_initials=initials,
        descriptor=descriptor,
        date=date,
        is_isolated=is_isolated,
        job_name=job_name,
    )


def reconcile_isolated_vs_fullcar(
    folder_is_full_car: Optional[bool], sim_is_isolated: bool
) -> str:
    """Reconcile the two independent isolated-vs-fullcar signals into one
    of "full_car", "isolated", or a "CONFLICT: ..." string.

    Background (post_zip_file_format_spec.md §0/§7): the Drive batch-folder
    convention encodes isolated-vs-fullcar via absence of the FC component
    code, while the Sabalcore .sim filename encodes it via an independent
    ISO_ prefix on the descriptor. These are two signals at two different
    naming layers and are not guaranteed to agree.

    Decision: option (c) from the earlier open question -- cross-check both
    when both are available, and surface a disagreement rather than
    silently picking one. `folder_is_full_car` is frequently None now that
    post.zip can be dropped with no batch folder at all (see CONTRIBUTING.md
    "Current scope") -- in that case the ISO_/sim signal, which is always
    available, is used alone since there's nothing to cross-check against.
    On disagreement, the conflict string itself becomes the CSV row's
    `isolated_vs_fullcar` value -- visible directly in data/results.csv to
    whoever reviews it, rather than hidden in a log only.

    @param folder_is_full_car: True if the Drive batch folder's component
        code is FC, False if a non-FC component code is present, None if
        there's no batch folder to read this from at all.
    @param sim_is_isolated: SimFileMetadata.is_isolated from the .sim /
        post.zip filename.
    """
    sim_says_full_car = not sim_is_isolated

    if folder_is_full_car is None:
        return "full_car" if sim_says_full_car else "isolated"

    if folder_is_full_car == sim_says_full_car:
        return "full_car" if folder_is_full_car else "isolated"

    folder_label = "full_car" if folder_is_full_car else "isolated"
    sim_label = "full_car" if sim_says_full_car else "isolated"
    return f"CONFLICT: folder says {folder_label}, sim ISO_ prefix says {sim_label}"
