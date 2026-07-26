"""Parses Sabalcore .sim and post.zip file names.

Convention (Sabalcore Usage Guide; post_zip_file_format_spec.md §0):

    <INITIALS>_<descriptor>_<YYYYMMDD>.sim

Isolated-part runs prefix the descriptor with ISO_, e.g.
DY_ISO_RWv3_20260709.sim.

post.zip names wrap the .sim base: post_<job_name>.zip, i.e.
post_<INITIALS>_<descriptor>_<YYYYMMDD>.zip (or with ISO_ in the
descriptor).
"""

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


def parse_sim_filename(filename: str) -> SimFileMetadata:
    """Parse a `<INITIALS>_<descriptor>_<YYYYMMDD>.sim` filename.

    TODO:
    - Regex for INITIALS/descriptor/date, splitting on underscores.
    - Detect and strip a leading ISO_ prefix on the descriptor to set
      is_isolated, keeping the remainder as the "clean" descriptor -- or
      keep ISO_ in `descriptor` verbatim and only set the flag; decide which
      before implementing since downstream consumers will depend on it.
    - job_name should reconstruct the original base name.
    """
    raise NotImplementedError("sim filename parsing not yet implemented")


def parse_post_zip_filename(filename: str) -> SimFileMetadata:
    """Parse a `post_<job_name>.zip` filename.

    Current scope (see CONTRIBUTING.md): post.zip is the only artifact type
    this pipeline ingests from Drive -- there is no other file-type pattern
    to fall back to yet.

    TODO: strip the `post_` prefix and `.zip` suffix, then delegate to
    parse_sim_filename() on the remainder. Decide how to handle a filename
    that doesn't match the expected `post_` / `.zip` wrapper -- given the
    current scope this represents an anomaly (e.g. a naming mistake) rather
    than a legitimately different, unsupported file type, so this should
    likely raise/log loudly rather than route anywhere.
    """
    raise NotImplementedError("post.zip filename parsing not yet implemented")


def reconcile_isolated_vs_fullcar(
    folder_is_full_car: bool, sim_is_isolated: bool
) -> Optional[bool]:
    """Reconcile the two independent isolated-vs-fullcar signals.

    Open question (post_zip_file_format_spec.md §0/§7), NOT resolved here:
    the Drive batch-folder convention encodes isolated-vs-fullcar via
    absence of the FC component code, while the Sabalcore .sim filename
    encodes it via an independent ISO_ prefix on the descriptor. These are
    two signals at two different naming layers and are not guaranteed to
    agree.

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
