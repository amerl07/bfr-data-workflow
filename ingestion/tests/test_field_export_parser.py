"""Tests for ingestion/parsers/field_export_parser.py on synthetic exports.

Run from the repo root:  python -m unittest discover -s ingestion/tests -t .
"""

import json
import math
import random
import unittest

from ingestion.parsers import field_export_parser as fep

Y_HALF, Z_HALF = 0.7, 1.5


def grid_json(stations, resolution=(5, 4), fields=("Velocity: Magnitude", "Pressure Coefficient")):
    return json.dumps(
        {
            "version": 1,
            "run": "YL_FC_Test_Straightline_20261101",
            "normal_axis": "x",
            "units": "m",
            "origin_yz": [-Y_HALF, Z_HALF],
            "point1_yz": [-Y_HALF, -Z_HALF],
            "point2_yz": [Y_HALF, Z_HALF],
            "resolution": list(resolution),
            "regions": ["Porous Fluid", "Static Fluid"],
            "fields": list(fields),
            "stations": [{"x": x, "file": f"grid_X{x:.2f}.csv"} for x in stations],
        }
    )


def grid_points(nu, nv):
    """(iu, iv, y, z) for every point: u runs origin->point1 (z from +Z_HALF
    down to -Z_HALF at y = -Y_HALF), v runs origin->point2 (y up to +Y_HALF)."""
    for iu in range(nu):
        for iv in range(nv):
            y = -Y_HALF + 2 * Y_HALF * iv / (nv - 1)
            z = Z_HALF - 2 * Z_HALF * iu / (nu - 1)
            yield iu, iv, y, z


def value(x, iu, iv):
    return round(x * 100 + iu * 10 + iv, 3)


def station_csv(x, nu, nv, header=None, skip=(), shuffle=False, duplicate=()):
    header = header or '"Velocity: Magnitude (m/s)","Pressure Coefficient","X (m)","Y (m)","Z (m)"'
    rows = []
    for iu, iv, y, z in grid_points(nu, nv):
        if (iu, iv) in skip:
            continue
        line = f"{value(x, iu, iv)},{-value(x, iu, iv)},{x},{y!r},{z!r}"
        rows.append(line)
        if (iu, iv) in duplicate:
            rows.append(line)
    if shuffle:
        random.Random(0).shuffle(rows)
    return "\n".join([header] + rows) + "\n"


def folder(stations, nu, nv, resolution=(5, 4), **csv_kwargs):
    files = {"fields/grid.json": grid_json(stations, resolution)}
    for x in stations:
        files[f"fields/grid_X{x:.2f}.csv"] = station_csv(x, nu, nv, **csv_kwargs)
    return files


class SplitUnitAndSlug(unittest.TestCase):
    def test_split_unit(self):
        self.assertEqual(fep.split_unit("Velocity: Magnitude (m/s)"), ("Velocity: Magnitude", "m/s"))
        self.assertEqual(fep.split_unit(" Pressure Coefficient "), ("Pressure Coefficient", ""))

    def test_slug(self):
        self.assertEqual(fep.slug("Velocity: Magnitude"), "velocity_magnitude")
        self.assertEqual(fep.slug("PressureCoefficient"), "pressure_coefficient")
        self.assertEqual(fep.slug("Pressure Coefficient"), "pressure_coefficient")


class ParseStationCsv(unittest.TestCase):
    def test_coordinate_header_variants(self):
        text = "Position[X] (m),Position[Y] (m),Position[Z] (m),Cp\n0.1,0.2,0.3,-1.5\n"
        samples = fep.parse_station_csv(text)
        self.assertEqual((samples.x, samples.y, samples.z), ([0.1], [0.2], [0.3]))
        self.assertEqual([v.key for v in samples.variables], ["cp"])
        self.assertEqual(samples.values["cp"], [-1.5])

    def test_missing_coordinate_column(self):
        with self.assertRaisesRegex(ValueError, "no Z column"):
            fep.parse_station_csv("X (m),Y (m),Cp\n0,0,1\n")

    def test_blank_value_is_nan_and_bom_is_ignored(self):
        samples = fep.parse_station_csv("﻿X,Y,Z,Cp\n0,0,0,\n")
        self.assertTrue(math.isnan(samples.values["cp"][0]))


class BuildFieldSet(unittest.TestCase):
    def check_values(self, field_set, nu, nv, skip=()):
        for s, x in enumerate(field_set.stations):
            vmag = field_set.data["velocity_magnitude"][s]
            cp = field_set.data["pressure_coefficient"][s]
            for iu, iv, _, _ in grid_points(nu, nv):
                cell = iu * nv + iv
                if (iu, iv) in skip:
                    self.assertTrue(math.isnan(vmag[cell]))
                else:
                    self.assertAlmostEqual(vmag[cell], value(x, iu, iv))
                    self.assertAlmostEqual(cp[cell], -value(x, iu, iv))

    def test_resolution_as_points(self):
        fs = fep.parse_fields_folder(folder([0.0, 0.05], 5, 5, resolution=(5, 5)))
        self.assertEqual(fs.counts, (5, 5))
        self.check_values(fs, 5, 5)

    def test_resolution_as_cells(self):
        fs = fep.parse_fields_folder(folder([0.0], 6, 6, resolution=(5, 5)))
        self.assertEqual(fs.counts, (6, 6))
        self.check_values(fs, 6, 6)

    def test_unequal_resolution_either_way_round(self):
        fs = fep.parse_fields_folder(folder([0.0], 4, 5, resolution=(5, 4)))
        self.assertEqual(fs.counts, (4, 5))
        self.check_values(fs, 4, 5)

    def test_gaps_become_nan_and_order_does_not_matter(self):
        skip = {(1, 1), (2, 3), (0, 0)}
        fs = fep.parse_fields_folder(folder([0.0], 5, 5, resolution=(5, 5), skip=skip, shuffle=True))
        self.check_values(fs, 5, 5, skip=skip)

    def test_duplicates_are_averaged_and_counted(self):
        fs = fep.parse_fields_folder(folder([0.0], 5, 5, resolution=(5, 5), duplicate={(2, 2)}))
        self.assertEqual(fs.duplicate_points, 1)
        self.check_values(fs, 5, 5)

    def test_missing_station_is_reported(self):
        files = folder([0.0, 0.05], 5, 5, resolution=(5, 5))
        del files["fields/grid_X0.05.csv"]
        fs = fep.parse_fields_folder(files)
        self.assertEqual(fs.stations, [0.0])
        self.assertEqual(fs.missing_stations, [0.05])

    def test_x_mismatch_raises(self):
        files = folder([0.0], 5, 5, resolution=(5, 5))
        files["fields/grid_X0.00.csv"] = station_csv(0.1, 5, 5)
        with self.assertRaisesRegex(ValueError, "not on station"):
            fep.parse_fields_folder(files)

    def test_off_grid_points_raise(self):
        files = folder([0.0], 7, 7, resolution=(5, 5))
        with self.assertRaisesRegex(ValueError, "don't sit on"):
            fep.parse_fields_folder(files)

    def test_mismatched_columns_raise(self):
        files = folder([0.0, 0.05], 5, 5, resolution=(5, 5))
        files["fields/grid_X0.05.csv"] = station_csv(
            0.05, 5, 5, header='"Velocity: Magnitude (m/s)","Total Pressure","X (m)","Y (m)","Z (m)"'
        )
        with self.assertRaisesRegex(ValueError, "no column for"):
            fep.parse_fields_folder(files)

    def test_part_name_prefix_differs_per_station(self):
        files = folder([0.0, 0.05], 5, 5, resolution=(5, 5))
        for x in (0.0, 0.05):
            p = f"BFR field grid X{x:.2f}: "
            files[f"fields/grid_X{x:.2f}.csv"] = station_csv(
                x, 5, 5,
                header=f'"{p}Velocity: Magnitude (m/s)","{p}Pressure Coefficient","{p}X (m)","{p}Y (m)","{p}Z (m)"',
            )
        fs = fep.parse_fields_folder(files)
        self.assertEqual([v.key for v in fs.variables], ["velocity_magnitude", "pressure_coefficient"])
        self.check_values(fs, 5, 5)

    def test_unlisted_columns_are_ignored(self):
        files = folder([0.0], 5, 5, resolution=(5, 5))
        text = station_csv(0.0, 5, 5)
        lines = text.splitlines()
        lines = [lines[0] + ',"Turbulent Kinetic Energy (J/kg)"'] + [l + ",1.0" for l in lines[1:]]
        files["fields/grid_X0.00.csv"] = "\n".join(lines) + "\n"
        fs = fep.parse_fields_folder(files)
        self.assertEqual([v.key for v in fs.variables], ["velocity_magnitude", "pressure_coefficient"])

    def test_no_grid_json_means_no_fields(self):
        self.assertIsNone(fep.parse_fields_folder({"force_reports.txt": ""}))

    def test_no_csvs_raise(self):
        with self.assertRaisesRegex(ValueError, "no field CSVs"):
            fep.parse_fields_folder({"fields/grid.json": grid_json([0.0])})


class RealGridJson(unittest.TestCase):
    """grid.json files written by export_scenes.java in STAR 2506 (2026-11-02)."""

    def test_real_files_parse(self):
        from pathlib import Path

        docs = Path(__file__).resolve().parents[2] / "docs" / "presentation_grid"
        paths = sorted(docs.glob("grid*.json"))
        if not paths:
            self.skipTest("no real grid.json in docs/presentation_grid")
        for path in paths:
            grid = fep.parse_grid_json(path.read_text())
            self.assertEqual(len(grid.stations), 59)
            self.assertEqual((grid.stations[0].x, grid.stations[-1].x), (-0.9, 2.0))
            self.assertEqual(grid.stations[0].file, "grid_X-0.90.csv")
            self.assertEqual(grid.resolution, (40, 40))
            self.assertEqual(grid.fields, ["Velocity: Magnitude", "Pressure Coefficient"])

    def test_real_station_csv(self):
        """grid_X0.10.csv from DY_RW_v9finalBiplane_Straight_20260914_1200:
        resolution 40 turned out to mean 40 cells (41 x 41 points), and
        only the y <= 0, z >= 0 quarter is fluid (half car, above ground)."""
        from pathlib import Path

        docs = Path(__file__).resolve().parents[2] / "docs" / "presentation_grid"
        if not (docs / "grid_X0.10.csv").exists():
            self.skipTest("no real grid_X0.10.csv in docs/presentation_grid")
        fs = fep.parse_fields_folder(
            {
                "fields/grid.json": (docs / "grid.json").read_text(),
                "fields/grid_X0.10.csv": (docs / "grid_X0.10.csv").read_text(),
            }
        )
        self.assertEqual(fs.counts, (41, 41))
        self.assertEqual(fs.stations, [0.1])
        self.assertEqual(len(fs.missing_stations), 58)
        self.assertEqual(fs.duplicate_points, 0)
        self.assertEqual(
            [(v.key, v.unit) for v in fs.variables],
            [("velocity_magnitude", "m/s"), ("pressure_coefficient", "")],
        )
        vmag = fs.data["velocity_magnitude"][0]
        filled = [i for i, v in enumerate(vmag) if not math.isnan(v)]
        self.assertEqual(len(filled), 372)
        # u runs z from +1.53 down (index 20 = z 0), v runs y from -0.717 up (20 = y 0).
        self.assertEqual(max(i // 41 for i in filled), 20)
        self.assertEqual(max(i % 41 for i in filled), 20)
        self.assertAlmostEqual(vmag[0], 15.009857165750041, places=4)


class ToJson(unittest.TestCase):
    def test_round_trip(self):
        skip = {(1, 2)}
        fs = fep.parse_fields_folder(folder([0.0, 0.05], 5, 5, resolution=(5, 5), skip=skip))
        out = json.loads(fep.to_json(fs, "YL_FC_Test_Straightline_20261101"))
        self.assertEqual(out["counts"], [5, 5])
        self.assertEqual(out["stations"], [0.0, 0.05])
        self.assertEqual([v["key"] for v in out["variables"]], ["velocity_magnitude", "pressure_coefficient"])
        self.assertEqual(out["variables"][0]["unit"], "m/s")
        decoded = fep.decode(out["data"]["velocity_magnitude"][1])
        self.assertEqual(len(decoded), 25)
        self.assertAlmostEqual(decoded[0], value(0.05, 0, 0), places=4)
        self.assertTrue(math.isnan(decoded[1 * 5 + 2]))


if __name__ == "__main__":
    unittest.main()
