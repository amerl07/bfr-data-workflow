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
    folder_is_full_car: bool, sim_is_isolated: bool
) -> Optional[bool]:
    """Reconcile the two independent isolated-vs-fullcar signals.

    Open question (post_zip_file_format_spec.md §0/§7), NOT resolved here:
    the Drive batch-folder convention encodes isolated-vs-fullcar via
    absence of the FC component code, while the Sabalcore .sim filename
    encodes it via an independent ISO_ prefix on the descriptor (now
    reliably available as SimFileMetadata.is_isolated, per the parsing
    above). These are two signals at two different naming layers and are
    not guaranteed to agree.

    Undecided: should the parser
      (a) treat the Drive folder name as authoritative and ignore ISO_,
      (b) treat ISO_ as authoritative, or
      (c) cross-check both and flag/reject on disagreement?

    This function exists so that decision has one place to land later,
    rather than being silently baked into folder_name_parser or
    sim_filename_parser individually.

    TODO: implement once (a)/(b)/(c) above is decided.
    """
    raise NotImplementedError(
        "isolated-vs-fullcar cross-check policy not yet decided"
    )
