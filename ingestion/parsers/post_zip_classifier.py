"""Classifies the files found inside an unzipped post.zip.

Categories per post_zip_file_format_spec.md §1-6, based on one observed
76-file batch (docs/PostDotZip_FileNames.txt). Batches may vary -- different
slice locations, missing/extra views, or file types not seen in that one
batch are expected. Treat categories 1-3 as variable-count/variable-parameter
and categories 4-5 as fixed-count/always-present (see spec's "Notes for
parser design").
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class PostZipClassification:
    velocity_slices: List[dict] = field(default_factory=list)
    wall_shear_stress: List[dict] = field(default_factory=list)
    pressure_coefficient: List[dict] = field(default_factory=list)
    setup_scenes: List[str] = field(default_factory=list)
    force_report: Optional[str] = None
    # Category 6 catch-all. Each entry should carry enough to build a paper
    # trail (per spec §6): at minimum the filename and the batch folder it
    # came from, not just the bare filename.
    unclassified: List[dict] = field(default_factory=list)


def classify_post_zip_contents(
    file_names: List[str], batch_folder_name: str
) -> PostZipClassification:
    """Top-level dispatcher: sorts file_names into the categories above.

    TODO:
    - Run each file name through classify_velocity_slice,
      classify_wall_shear_stress, classify_pressure_coefficient,
      is_setup_scene, is_force_report in some defined precedence order.
    - Anything matching none of them goes into `unclassified`, tagged with
      `batch_folder_name` -- never silently dropped (spec §6).
    """
    raise NotImplementedError("post.zip classification not yet implemented")


def classify_velocity_slice(file_name: str) -> Optional[dict]:
    """Classify an `x_`/`y_` velocity-slice scene, if `file_name` matches.

    Observed patterns (spec §1):
    - `y_-<value>.png` -- single underscore + explicit minus, negative Y.
    - `y__<value>.png` -- double underscore, zero/positive Y.
    - `x_0.0.png` -- single underscore, the zero X slice specifically.
    - `x__<value>.png` -- double underscore, used for all other X slices
      seen in the one sample batch (which happen to all be negative there).

    OPEN QUESTION, do not resolve here: whether the double-underscore
    convention means "negative" (matches the X data) or "zero/positive"
    (matches the Y data) -- the one sample batch contains a contradiction
    between the X and Y cases. Confirm against the STAR-CCM+ export macro
    directly before hardcoding a sign-parsing rule.

    TODO: implement axis (x/y) and numeric-value extraction; leave the
    sign/zero interpretation as an explicit unresolved field (or omit it)
    until the open question above is confirmed.
    """
    raise NotImplementedError("velocity slice classification not yet implemented")


def classify_wall_shear_stress(file_name: str) -> Optional[dict]:
    """Classify a `WSS_{Surface}_{FrontBack}_{LeftRight}.png` scene.

    Surface in {Top, Bottom}, Position in {Front, Back}, Side in
    {Right, Left} -- 8 combinations, no ambiguity in the spec (§2).

    TODO: implement the straightforward split/match.
    """
    raise NotImplementedError("WSS classification not yet implemented")


def classify_pressure_coefficient(file_name: str) -> Optional[dict]:
    """Classify a `CP_`-prefixed pressure-coefficient scene.

    Patterns (spec §3):
    - `CP_{Top|Bottom|Right|Left|Front}.png` -- per-face overview.
    - `CP_{Top|Bottom}_{Front|Back}_{Right|Left}.png` -- per-face quadrant
      (Top/Bottom only).
    - `CP_*_copy.png` -- duplicates the per-face overview names.

    OPEN QUESTIONS, do not resolve here:
    - What distinguishes a `_copy` file from its non-copy counterpart
      (different camera angle, color scale, export artifact?) -- flagged in
      the spec for Dohyun/whoever owns the export macro to clarify.
    - `CpT_Sweep.png` doesn't fit the per-face pattern at all (no
      Top/Bottom/Front/Back/Left/Right qualifier) and is possibly a
      summary/sweep plot rather than a directional scene. Spec tentatively
      groups it here by the shared `Cp` prefix but flags it as distinct in
      kind -- confirm before treating it the same as directional CP scenes.

    TODO: implement per-face and quadrant matching; decide how `_copy` and
    `CpT_Sweep.png` are represented once the open questions above are
    answered, rather than guessing now.
    """
    raise NotImplementedError(
        "pressure coefficient classification not yet implemented"
    )


def is_setup_scene(file_name: str) -> bool:
    """True for the fixed reference scenes (spec §4): Vector_Scene_1.png,
    Mesh.png, Geometry.png. Not expected to vary in count batch-to-batch.

    TODO: implement.
    """
    raise NotImplementedError("setup scene check not yet implemented")


def is_force_report(file_name: str) -> bool:
    """True for `force_reports.txt` (spec §5).

    TODO: implement.
    """
    raise NotImplementedError("force report check not yet implemented")
