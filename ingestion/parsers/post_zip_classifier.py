"""Classifies the files found inside a post.zip (or an equivalent
already-unzipped post_<job_name> folder -- this module only ever sees a
flat list of filenames, so it doesn't care which).

Categories per post_zip_file_format_spec.md §1-6, based on one observed
76-file batch (docs/PostDotZip_FileNames.txt). Batches may vary -- different
slice locations, missing/extra views, or file types not seen in that one
batch are expected. Confirmed true against a second real batch: WSS_ turned
out to also have a per-face overview shape (WSS_Top.png etc.) not present
in the original sample, alongside the quadrant shape -- so treat category 2
as variable-count too, not just 1-3. Categories 4-5 (setup scenes, force
report) are still the only ones expected to be fixed-count/always-present
(see spec's "Notes for parser design"). Verified against the original
76-file sample batch (zero unclassified) and a second real ~76-file batch
(zero unclassified once the WSS overview shape was added).
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class PostZipClassification:
    velocity_slices: List[dict] = field(default_factory=list)
    wall_shear_stress: List[dict] = field(default_factory=list)
    pressure_coefficient: List[dict] = field(default_factory=list)
    setup_scenes: List[str] = field(default_factory=list)
    force_report: Optional[str] = None
    # Category 6 catch-all. Each entry carries enough to build a paper
    # trail (per spec §6): at minimum the filename and the batch folder it
    # came from, not just the bare filename.
    unclassified: List[dict] = field(default_factory=list)


def classify_post_zip_contents(
    file_names: List[str], batch_folder_name: str
) -> PostZipClassification:
    """Sorts file_names into the categories above. Anything matching none
    of the known patterns goes into `unclassified`, tagged with
    `batch_folder_name` -- never silently dropped (spec §6).
    """
    result = PostZipClassification()

    for file_name in file_names:
        if is_force_report(file_name):
            result.force_report = file_name
            continue

        if is_setup_scene(file_name):
            result.setup_scenes.append(file_name)
            continue

        wss_entry = classify_wall_shear_stress(file_name)
        if wss_entry is not None:
            result.wall_shear_stress.append(wss_entry)
            continue

        cp_entry = classify_pressure_coefficient(file_name)
        if cp_entry is not None:
            result.pressure_coefficient.append(cp_entry)
            continue

        slice_entry = classify_velocity_slice(file_name)
        if slice_entry is not None:
            result.velocity_slices.append(slice_entry)
            continue

        result.unclassified.append(
            {"file_name": file_name, "batch_folder_name": batch_folder_name}
        )

    return result


_VELOCITY_SLICE_PATTERN = re.compile(
    r"^(?P<axis>[xy])(?P<underscores>_{1,2})(?P<raw_value>-?\d+(?:\.\d+)?)\.png$"
)


def classify_velocity_slice(file_name: str) -> Optional[dict]:
    """Classify an `x_`/`y_` velocity-slice scene, if `file_name` matches.

    Observed patterns (spec §1):
    - `y_-<value>.png` -- single underscore + explicit minus, negative Y.
    - `y__<value>.png` -- double underscore, zero/positive Y.
    - `x_0.0.png` -- single underscore, the zero X slice specifically.
    - `x__<value>.png` -- double underscore, used for all other X slices
      seen in the one sample batch (which happen to all be negative there).

    OPEN QUESTION, deliberately not resolved here: whether the
    double-underscore convention means "negative" (matches the X data) or
    "zero/positive" (matches the Y data) -- the one sample batch contains a
    contradiction between the X and Y cases. Confirm against the STAR-CCM+
    export macro directly before hardcoding a sign-parsing rule -- so this
    returns `double_underscore` and the raw (unsigned-unless-explicit)
    value string as separate fields rather than computing a single signed
    numeric value that would bake in an unconfirmed assumption.
    """
    match = _VELOCITY_SLICE_PATTERN.match(file_name)
    if not match:
        return None
    return {
        "file_name": file_name,
        "axis": match.group("axis"),
        "double_underscore": len(match.group("underscores")) == 2,
        "raw_value": match.group("raw_value"),
    }


_WSS_QUADRANT_PATTERN = re.compile(
    r"^WSS_(?P<surface>Top|Bottom)_(?P<position>Front|Back)_(?P<side>Right|Left)\.png$"
)
_WSS_OVERVIEW_PATTERN = re.compile(r"^WSS_(?P<surface>Top|Bottom|Right|Left|Front)\.png$")


def classify_wall_shear_stress(file_name: str) -> Optional[dict]:
    """Classify a `WSS_`-prefixed wall-shear-stress scene.

    Two shapes, mirroring the CP_ category's overview/quadrant split (§3):
    - `WSS_{Surface}_{FrontBack}_{LeftRight}.png` -- per-quadrant
      (Top/Bottom only), Surface in {Top, Bottom}, Position in
      {Front, Back}, Side in {Right, Left} -- 8 combinations, per the
      original spec §2 / sample batch.
    - `WSS_{Surface}.png` -- per-face overview, Surface in {Top, Bottom,
      Right, Left, Front}. NOT in the original spec or 76-file sample --
      confirmed against a later real upload (5 files: WSS_Top, WSS_Bottom,
      WSS_Right, WSS_Left, WSS_Front). Batches vary, per the spec's own
      framing -- this category isn't fixed-count after all.
    """
    quadrant_match = _WSS_QUADRANT_PATTERN.match(file_name)
    if quadrant_match:
        return {
            "file_name": file_name,
            "kind": "quadrant",
            "surface": quadrant_match.group("surface"),
            "position": quadrant_match.group("position"),
            "side": quadrant_match.group("side"),
        }

    overview_match = _WSS_OVERVIEW_PATTERN.match(file_name)
    if overview_match:
        return {"file_name": file_name, "kind": "overview", "surface": overview_match.group("surface")}

    return None


_CP_QUADRANT_PATTERN = re.compile(
    r"^CP_(?P<face>Top|Bottom)_(?P<position>Front|Back)_(?P<side>Right|Left)\.png$"
)
_CP_OVERVIEW_PATTERN = re.compile(
    r"^CP_(?P<face>Top|Bottom|Right|Left|Front)(?P<copy>_copy)?\.png$"
)
_CP_SWEEP_PATTERN = re.compile(r"^CpT_Sweep\.png$")


def classify_pressure_coefficient(file_name: str) -> Optional[dict]:
    """Classify a `CP_`-prefixed (or `CpT_Sweep.png`) pressure-coefficient
    scene.

    Patterns (spec §3):
    - `CP_{Top|Bottom}_{Front|Back}_{Right|Left}.png` -- per-face quadrant
      (Top/Bottom only). Checked first since it's the more specific shape.
    - `CP_{Top|Bottom|Right|Left|Front}.png`, optionally `_copy` -- per-face
      overview.
    - `CpT_Sweep.png` -- doesn't fit the per-face pattern at all.

    OPEN QUESTIONS, deliberately not resolved here (returned as explicit
    fields instead of being papered over):
    - What actually distinguishes a `_copy` file from its non-copy
      counterpart (different camera angle, color scale, export artifact?)
      -- flagged in the spec for whoever owns the export macro to clarify.
      `is_copy` is set, but no claim is made about what it means beyond
      "the filename says so".
    - `CpT_Sweep.png` is possibly a summary/sweep plot rather than a
      directional scene. Spec tentatively groups it here by the shared `Cp`
      prefix but flags it as distinct in kind -- returned with
      `kind: "sweep"` (no face/position/side) so callers can tell it apart
      rather than assuming it's a directional scene like the others.
    """
    quadrant_match = _CP_QUADRANT_PATTERN.match(file_name)
    if quadrant_match:
        return {
            "file_name": file_name,
            "kind": "quadrant",
            "face": quadrant_match.group("face"),
            "position": quadrant_match.group("position"),
            "side": quadrant_match.group("side"),
            "is_copy": False,
        }

    overview_match = _CP_OVERVIEW_PATTERN.match(file_name)
    if overview_match:
        return {
            "file_name": file_name,
            "kind": "overview",
            "face": overview_match.group("face"),
            "is_copy": overview_match.group("copy") is not None,
        }

    if _CP_SWEEP_PATTERN.match(file_name):
        return {"file_name": file_name, "kind": "sweep"}

    return None


_SETUP_SCENE_NAMES = frozenset({"Vector_Scene_1.png", "Mesh.png", "Geometry.png"})


def is_setup_scene(file_name: str) -> bool:
    """True for the fixed reference scenes (spec §4): Vector_Scene_1.png,
    Mesh.png, Geometry.png. Not expected to vary in count batch-to-batch.
    """
    return file_name in _SETUP_SCENE_NAMES


def is_force_report(file_name: str) -> bool:
    """True for `force_reports.txt` (spec §5)."""
    return file_name == "force_reports.txt"
