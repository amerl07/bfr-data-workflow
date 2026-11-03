"""Parses a post.zip's fields/ folder -- the presentation-grid sweep written
by export_scenes.java (STRAIGHTLINE sims only) -- into one compact
<job>_fields.json the web app can diff between sims.

    fields/grid.json          the sweep definition (written by the macro first)
    fields/grid_X-0.90.csv    one XYZ-table export per station
    fields/grid_X-0.85.csv
    ...

grid.json carries the plane as three (y, z) corners -- origin, point1,
point2, exactly what the macro set on the PlaneProbePart -- plus the
requested resolution, the exported field names and the station list. Nothing
about the grid is hard-coded here, so changing the sweep in the macro can't
silently desync this parser.

Each CSV row is placed on its grid cell by projecting its (y, z) onto the
origin->point1 (u) and origin->point2 (v) edges. The macro leaves grid points
inside solids out of the export, so cells with no row are NaN: that keeps
cell k the same physical location in every sim, which is what an A - B
difference plot needs.

Open until a real export is checked (see the STAR-CCM+ Slice Comparison doc):
- STAR's exact CSV header. Columns are matched by pattern, not exact name:
  coordinates are any header that reduces to X/Y/Z (optionally wrapped as
  Position[X] etc.) once its "(unit)" suffix is dropped; every other column
  is a field value.
- Whether resolution N gives N points or N cells (N + 1 points) per side.
  Both are tried per axis, and the smallest count every point snaps to wins;
  if neither fits, parsing fails rather than guessing.
- Grid points on the boundary between the two exported regions may appear
  twice; duplicates on one cell are averaged and counted in
  FieldSet.duplicate_points.
"""

import base64
import csv
import io
import json
import math
import re
import struct
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

# A point snaps to a grid cell when it lies within this fraction of a cell
# spacing of that cell's center.
SNAP_TOLERANCE = 0.05
# Each CSV's X column must agree with its station's x to within this (m).
STATION_X_TOLERANCE = 1e-4

_UNIT_SUFFIX = re.compile(r"\s*\(([^)]*)\)\s*$")
# Matched at the END of a header, so a "<part name>: " prefix (STAR's XY-plot
# export writes "Presentation Grid: Direction [0,0,1] (m)") doesn't matter.
_COORD_HEADER = re.compile(
    r"(?:^|:\s*)(?:(?:position|coordinate|centroid)\s*[\[:]?\s*)?([xyz])\]?$", re.IGNORECASE
)


@dataclass
class Station:
    x: float
    file: str


@dataclass
class GridDefinition:
    run: str
    origin: Tuple[float, float]  # (y, z)
    point1: Tuple[float, float]
    point2: Tuple[float, float]
    resolution: Tuple[int, int]
    fields: List[str]
    stations: List[Station]
    units: str = "m"


@dataclass
class Variable:
    key: str  # stable slug, e.g. "velocity_magnitude"
    name: str  # header as STAR wrote it, unit stripped
    unit: str


@dataclass
class StationSamples:
    x: List[float]
    y: List[float]
    z: List[float]
    variables: List[Variable]
    values: Dict[str, List[float]]  # Variable.key -> one value per row


@dataclass
class FieldSet:
    grid: GridDefinition
    counts: Tuple[int, int]  # grid points along (u, v)
    variables: List[Variable]
    stations: List[float]  # x of every station that had a CSV
    # Variable.key -> one row-major (u, v) array per entry in stations,
    # NaN where STAR exported no point.
    data: Dict[str, List[List[float]]]
    missing_stations: List[float] = field(default_factory=list)
    duplicate_points: int = 0


def parse_grid_json(text: str) -> GridDefinition:
    raw = json.loads(text)
    if raw.get("version") != 1:
        raise ValueError(f"unsupported grid.json version: {raw.get('version')!r}")
    if raw.get("normal_axis") != "x":
        raise ValueError(f"only x-normal grids are supported, got {raw.get('normal_axis')!r}")
    return GridDefinition(
        run=raw.get("run", ""),
        origin=_pair(raw["origin_yz"]),
        point1=_pair(raw["point1_yz"]),
        point2=_pair(raw["point2_yz"]),
        resolution=(int(raw["resolution"][0]), int(raw["resolution"][1])),
        fields=list(raw.get("fields", [])),
        stations=[Station(float(s["x"]), s["file"]) for s in raw["stations"]],
        units=raw.get("units", "m"),
    )


def _pair(values: Sequence[float]) -> Tuple[float, float]:
    if len(values) != 2:
        raise ValueError(f"expected a (y, z) pair, got {values!r}")
    return float(values[0]), float(values[1])


def parse_station_csv(text: str, field_names: Sequence[str] = ()) -> StationSamples:
    """One station's XYZ-table export. Blank or non-numeric cells read as
    NaN; a row without all three coordinates is dropped.

    field_names are grid.json's "fields". When given, a value column is the
    field whose name its header ENDS with (unit stripped), so a per-station
    "<part name>: " prefix like "BFR field grid X0.35: Velocity: Magnitude"
    still lines up across stations; other non-coordinate columns are
    ignored. Without them, every non-coordinate column is a value."""
    rows = list(csv.reader(io.StringIO(text.lstrip("﻿"))))
    rows = [r for r in rows if any(c.strip() for c in r)]
    if not rows:
        raise ValueError("empty field CSV")

    coord_cols: Dict[str, int] = {}
    variables: List[Tuple[int, Variable]] = []
    for col, header in enumerate(rows[0]):
        name, unit = split_unit(header)
        match = _COORD_HEADER.search(name)
        if match:
            axis = match.group(1).lower()
            if axis in coord_cols:
                raise ValueError(f"two {axis.upper()} columns in field CSV header: {rows[0]!r}")
            coord_cols[axis] = col
        elif field_names:
            known = _known_field(name, field_names)
            if known:
                variables.append((col, Variable(slug(known), known, unit)))
        elif name:
            variables.append((col, Variable(slug(name), name, unit)))

    if field_names:
        found = {v.name for _, v in variables}
        absent = [f for f in field_names if f not in found]
        if absent:
            raise ValueError(f"field CSV has no column for {absent}: {rows[0]!r}")

    missing = [a.upper() for a in "xyz" if a not in coord_cols]
    if missing:
        raise ValueError(f"field CSV has no {'/'.join(missing)} column: {rows[0]!r}")
    keys = [v.key for _, v in variables]
    if len(set(keys)) != len(keys):
        raise ValueError(f"field CSV has duplicate variable columns: {rows[0]!r}")

    samples = StationSamples([], [], [], [v for _, v in variables], {k: [] for k in keys})
    for row in rows[1:]:
        coords = [_number(row, coord_cols[a]) for a in "xyz"]
        if any(math.isnan(c) for c in coords):
            continue
        samples.x.append(coords[0])
        samples.y.append(coords[1])
        samples.z.append(coords[2])
        for col, var in variables:
            samples.values[var.key].append(_number(row, col))
    return samples


def _known_field(name: str, field_names: Sequence[str]) -> Optional[str]:
    """The longest of field_names that name is, or ends with after a ': '."""
    for known in sorted(field_names, key=len, reverse=True):
        if name == known or name.endswith(": " + known):
            return known
    return None


def split_unit(header: str) -> Tuple[str, str]:
    """'Velocity: Magnitude (m/s)' -> ('Velocity: Magnitude', 'm/s')."""
    header = header.strip()
    match = _UNIT_SUFFIX.search(header)
    if not match:
        return header, ""
    return header[: match.start()].strip(), match.group(1).strip()


def slug(name: str) -> str:
    """'Velocity: Magnitude' -> 'velocity_magnitude',
    'PressureCoefficient' -> 'pressure_coefficient'."""
    name = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", name)
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def _number(row: List[str], col: int) -> float:
    try:
        return float(row[col])
    except (IndexError, ValueError):
        return math.nan


def build_field_set(grid: GridDefinition, csv_texts: Dict[str, str]) -> FieldSet:
    """csv_texts maps a station's file name (as listed in grid.json, no
    fields/ prefix) to its text. Stations with no CSV are skipped and listed
    in missing_stations; at least one must be present."""
    present: List[Tuple[Station, StationSamples]] = []
    missing: List[float] = []
    for station in grid.stations:
        text = csv_texts.get(station.file)
        if text is None:
            missing.append(station.x)
            continue
        samples = parse_station_csv(text, grid.fields)
        _check_station_x(station, samples)
        present.append((station, samples))
    if not present:
        raise ValueError("no field CSVs found for any station in grid.json")

    variables = present[0][1].variables
    for station, samples in present[1:]:
        if [v.key for v in samples.variables] != [v.key for v in variables]:
            raise ValueError(
                f"{station.file} has columns {[v.name for v in samples.variables]}, "
                f"expected {[v.name for v in variables]}"
            )

    # (u, v) fraction of every point, per station, for snapping.
    fractions = [[_uv_fraction(grid, y, z) for y, z in zip(s.y, s.z)] for _, s in present]
    flat = [f for per_station in fractions for f in per_station]
    nu = _point_count(grid, [f[0] for f in flat], "point1")
    nv = _point_count(grid, [f[1] for f in flat], "point2")

    data: Dict[str, List[List[float]]] = {v.key: [] for v in variables}
    duplicates = 0
    for (station, samples), uv in zip(present, fractions):
        sums = {v.key: [0.0] * (nu * nv) for v in variables}
        counts = [0] * (nu * nv)
        for row, (fu, fv) in enumerate(uv):
            cell = round(fu * (nu - 1)) * nv + round(fv * (nv - 1))
            counts[cell] += 1
            for v in variables:
                value = samples.values[v.key][row]
                sums[v.key][cell] += value
        duplicates += sum(c - 1 for c in counts if c > 1)
        for v in variables:
            data[v.key].append(
                [s / c if c else math.nan for s, c in zip(sums[v.key], counts)]
            )

    return FieldSet(
        grid=grid,
        counts=(nu, nv),
        variables=variables,
        stations=[station.x for station, _ in present],
        data=data,
        missing_stations=missing,
        duplicate_points=duplicates,
    )


def _check_station_x(station: Station, samples: StationSamples) -> None:
    for x in samples.x:
        if abs(x - station.x) > STATION_X_TOLERANCE:
            raise ValueError(
                f"{station.file}: row at x={x} is not on station x={station.x}"
            )


def _uv_fraction(grid: GridDefinition, y: float, z: float) -> Tuple[float, float]:
    """Position of (y, z) along origin->point1 and origin->point2, 0..1 on the grid."""
    dy, dz = y - grid.origin[0], z - grid.origin[1]
    out = []
    for corner in (grid.point1, grid.point2):
        ey, ez = corner[0] - grid.origin[0], corner[1] - grid.origin[1]
        out.append((dy * ey + dz * ez) / (ey * ey + ez * ez))
    return out[0], out[1]


def _point_count(grid: GridDefinition, fractions: List[float], edge: str) -> int:
    """Smallest candidate points-per-side every fraction snaps onto. Both
    resolutions are candidates for both edges, as N points or N cells, since
    which of STAR's X/Y resolution runs along which edge is unconfirmed."""
    candidates = sorted({n + extra for n in grid.resolution for extra in (0, 1) if n + extra >= 2})
    for count in candidates:
        cells = count - 1
        if all(
            -SNAP_TOLERANCE <= f * cells <= cells + SNAP_TOLERANCE
            and abs(f * cells - round(f * cells)) <= SNAP_TOLERANCE
            for f in fractions
        ):
            return count
    raise ValueError(
        f"grid points don't sit on a {grid.resolution} grid along origin->{edge} "
        f"(tried {candidates} points per side)"
    )


def to_json(field_set: FieldSet, job_name: str) -> str:
    """The processed file the web app fetches: grid + stations + one
    base64 little-endian float32 array per variable per station, row-major
    over (u, v), NaN where there's no data."""
    grid = field_set.grid
    nu, nv = field_set.counts
    return json.dumps(
        {
            "version": 1,
            "job_name": job_name,
            "normal_axis": "x",
            "units": grid.units,
            "origin_yz": list(grid.origin),
            "point1_yz": list(grid.point1),
            "point2_yz": list(grid.point2),
            "counts": [nu, nv],
            "layout": "row-major [u][v]; u runs origin->point1, v runs origin->point2",
            "encoding": "base64 float32 little-endian, NaN = no data",
            "stations": field_set.stations,
            "missing_stations": field_set.missing_stations,
            "variables": [
                {"key": v.key, "name": v.name, "unit": v.unit} for v in field_set.variables
            ],
            "data": {
                key: [_encode(values) for values in per_station]
                for key, per_station in field_set.data.items()
            },
        },
        separators=(",", ":"),
    )


def _encode(values: List[float]) -> str:
    return base64.b64encode(struct.pack(f"<{len(values)}f", *values)).decode("ascii")


def decode(encoded: str) -> List[float]:
    raw = base64.b64decode(encoded)
    return list(struct.unpack(f"<{len(raw) // 4}f", raw))


def parse_fields_folder(files: Dict[str, str]) -> Optional[FieldSet]:
    """files maps paths relative to the post job root ('fields/grid.json',
    'fields/grid_X0.35.csv', ...) to text. Returns None when the job has no
    fields/grid.json at all (non-STRAIGHTLINE sims, older exports)."""
    grid_text = files.get("fields/grid.json")
    if grid_text is None:
        return None
    grid = parse_grid_json(grid_text)
    csv_texts = {
        path[len("fields/"):]: text
        for path, text in files.items()
        if path.startswith("fields/") and path.endswith(".csv")
    }
    return build_field_set(grid, csv_texts)
