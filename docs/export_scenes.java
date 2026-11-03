// export_scenes.java
// BFR pure-export macro. Runs as the third token in:  -batch mesh,run,export_scenes.java
// Executes in the SAME batch process against the solved, in-memory sim.
// Does ONLY: (1) every scene -> PNG, (2) all report values -> force_reports.txt,
// (3) field-grid sweep -> fields/grid_X<x>.csv, always LAST, STRAIGHTLINE sims only.
// No mesh, no solve, no save. Output lands in ~/bfr/post_<run>/ via resolvePath().

import java.io.*;
import java.util.*;
import star.common.*;
import star.base.neo.*;
import star.base.report.*;
import star.vis.*;          // Scene, SceneManager, PlaneProbePart (presentation grid)

public class export_scenes extends StarMacro {

    // ---- export config (edit here) ----
    static final int     WIDTH     = 2560;   // px; bump to 3840 for design-binder figures
    static final int     HEIGHT    = 1440;   // px
    static final int     MAG       = 1;      // hardcopy scale factor

    // Scene-name separator -> subfolder. A scene named "Cp/FrontWing" exports to
    // post_<run>/Cp/FrontWing.png. Change to "__" if STAR-CCM+ rejects "/" in a
    // scene name in your build. A name with no separator exports flat (old behavior).
    static final String  GROUP_SEP = "/";

    // ---- field-grid sweep config (edit here) ----
    // Sweeps an X-normal presentation grid along the car and exports X, Y, Z +
    // field values at every grid point, one CSV per station, into post_<run>/fields/.
    static final double  X_START = -0.9;    // m, first station
    static final double  X_END   =  2.0;    // m, last station (inclusive)
    static final double  X_STEP  =  0.05;   // m -> 59 stations

    // Grid extent in y and z, from the recording. Origin is (x, -Y_HALF, Z_HALF),
    // Point 1 is (x, -Y_HALF, -Z_HALF), Point 2 is (x, Y_HALF, Z_HALF).
    static final double  Y_HALF  =  0.7168407005248709;   // m
    static final double  Z_HALF  =  1.5299247443675994;   // m
    static final int     RES_X   =  40;     // grid resolution, as recorded
    static final int     RES_Y   =  40;

    static final String[] REGIONS = {"Porous Fluid", "Static Fluid"};
    static final String[] VECTORS = {"Velocity"};   // exported as magnitude
    static final String[] SCALARS = {"PressureCoefficient"};

    public void execute() {
        Simulation sim = getActiveSimulation();

        // Strip any autosave suffix (@NNNNN) so the folder is always canonical
        // post_<run>/ — matches what the PBS `zip post_<run>/` step expects, and
        // fixes the post_<run>@00600/ split seen when post-processing a checkpoint.
        String runId  = sim.getPresentationName().replaceAll("@\\d+$", "");
        String outDir = resolvePath("post_" + runId);   // -> ~/bfr/post_<run>
        new File(outDir).mkdirs();

        // 1) every scene -> PNG, mirroring GROUP_SEP in the name as subfolders
        for (Scene scene : sim.getSceneManager().getScenes()) {
            String name = scene.getPresentationName().trim();

            // split into path segments, sanitize EACH segment independently
            // (per-segment sanitize preserves the CpT_sweep trailing-space fix)
            String[] segs = name.split(java.util.regex.Pattern.quote(GROUP_SEP));
            StringBuilder rel = new StringBuilder();
            for (int i = 0; i < segs.length; i++) {
                String safe = segs[i].trim().replaceAll("[^a-zA-Z0-9._-]", "_");
                if (safe.isEmpty()) safe = "_";
                if (i > 0) rel.append(File.separator);
                rel.append(safe);
            }

            File pngFile = new File(outDir + File.separator + rel.toString() + ".png");
            File parent  = pngFile.getParentFile();
            if (parent != null) parent.mkdirs();

            scene.printAndWait(pngFile.getAbsolutePath(), MAG, WIDTH, HEIGHT);
            sim.println("[BFR] scene -> " + pngFile.getAbsolutePath());
        }

        // 2) all reports -> force_reports.txt  (RAW, half-car / undoubled per BFR_CFD_Standards)
        String txt = outDir + File.separator + "force_reports.txt";
        try (PrintWriter w = new PrintWriter(new FileWriter(txt))) {
            w.println("# BFR report export   run: " + runId);
            w.println("# raw report values (half-car, undoubled) per BFR_CFD_Standards");
            w.println("# DF sign convention: downforce reads negative");
            w.println();
            for (Report r : sim.getReportManager().getObjects()) {
                double val;
                try { val = r.getReportMonitorValue(); }   // skip anything with no scalar
                catch (Exception e) { continue; }
                String unit = "";
                try { unit = r.getUnits().getPresentationName(); } catch (Exception e) {}
                w.printf("%-44s %18.6f  %s%n", r.getPresentationName(), val, unit);
            }
        } catch (IOException e) {
            sim.println("[BFR] report export FAILED: " + e.getMessage());
        }

        // 3) field-grid sweep, LAST: it adds parts and a table to the sim, so it
        // must not run before the scenes are printed, and a failure here must
        // not cost the PNGs or force_reports.txt already on disk.
        // STRAIGHTLINE sims only; every other sweep type skips it.
        if (isStraightLine(runId)) {
            try {
                exportFields(sim, runId, outDir + File.separator + "fields");
            } catch (Exception e) {
                sim.println("[BFR] field export FAILED: " + e.getMessage());
            }
        } else {
            sim.println("[BFR] field export skipped: '" + runId + "' is not a STRAIGHTLINE sim");
        }

        sim.println("[BFR] export complete -> " + outDir);
    }

    // The per-station grid setup is copied call for call from the 20.04.007
    // recording presentationGrid_del.java, which is known to work: a fresh grid is
    // created at each station with Origin, Point 1, Point 2 and Normal all set
    // explicitly, then deleted before the next one. Keep that sequence as is.
    //   - the grid's "Origin" is a CORNER: the plane spans origin -> Point 1 and
    //     origin -> Point 2 (here y = -0.717..0.717 m, z = -1.530..1.530 m)
    //   - grid points outside the fluid are left out of the export (no NaN rows)
    // fields/grid.json is written first and describes the whole sweep, so the
    // consumer (ingestion/parsers/field_export_parser.py) has nothing hard-coded.
    private void exportFields(Simulation simulation_0, String runId, String outDir) throws IOException {
        new File(outDir).mkdirs();

        Units units_0 =
            simulation_0.getUnitsManager().getPreferredUnits(Dimensions.Builder().length(1).build());

        LabCoordinateSystem labCoordinateSystem_0 =
            simulation_0.getCoordinateSystemManager().getLabCoordinateSystem();

        Region region_0 = simulation_0.getRegionManager().getRegion(REGIONS[0]);
        Region region_1 = simulation_0.getRegionManager().getRegion(REGIONS[1]);

        // One table, re-pointed at each station's grid.
        XyzInternalTable table = simulation_0.getTableManager().createTable(XyzInternalTable.class);
        table.setPresentationName("field grid table");
        table.setExtractVertexData(true);   // values at the grid points themselves
        List<String> fieldNames = new ArrayList<>();
        table.setFieldFunctions(fieldFunctions(simulation_0, fieldNames));

        int n = (int) Math.round((X_END - X_START) / X_STEP) + 1;
        writeGridJson(outDir + File.separator + "grid.json", runId, n, fieldNames);

        for (int i = 0; i < n; i++) {
            double x = stationX(i);
            String tag = stationTag(x);

            // ---- recorded grid setup (presentationGrid_del.java), x substituted ----
            PlaneProbePart planeProbePart =
                simulation_0.getPartManager().createPlaneProbePart(new ArrayList<>(Collections.<NamedObject>emptyList()), new DoubleVector(new double[] {0.0, 0.0, 0.0}), new DoubleVector(new double[] {1.0, 0.0, 0.0}), new DoubleVector(new double[] {0.0, 1.0, 0.0}), 20, 20, null);

            planeProbePart.setCoordinateSystem(labCoordinateSystem_0);

            planeProbePart.getOriginCoordinate().setUnits0(units_0);
            planeProbePart.getOriginCoordinate().setUnits1(units_0);
            planeProbePart.getOriginCoordinate().setUnits2(units_0);
            planeProbePart.getOriginCoordinate().setDefinition("");
            planeProbePart.getOriginCoordinate().setValue(new DoubleVector(new double[] {x, -Y_HALF, Z_HALF}));
            planeProbePart.getOriginCoordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {x, -Y_HALF, Z_HALF}));

            planeProbePart.getPoint1Coordinate().setUnits0(units_0);
            planeProbePart.getPoint1Coordinate().setUnits1(units_0);
            planeProbePart.getPoint1Coordinate().setUnits2(units_0);
            planeProbePart.getPoint1Coordinate().setDefinition("");
            planeProbePart.getPoint1Coordinate().setValue(new DoubleVector(new double[] {x, -Y_HALF, -Z_HALF}));
            planeProbePart.getPoint1Coordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {x, -Y_HALF, -Z_HALF}));

            planeProbePart.getPoint2Coordinate().setUnits0(units_0);
            planeProbePart.getPoint2Coordinate().setUnits1(units_0);
            planeProbePart.getPoint2Coordinate().setUnits2(units_0);
            planeProbePart.getPoint2Coordinate().setDefinition("");
            planeProbePart.getPoint2Coordinate().setValue(new DoubleVector(new double[] {x, Y_HALF, Z_HALF}));
            planeProbePart.getPoint2Coordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {x, Y_HALF, Z_HALF}));

            planeProbePart.getNormalCoordinate().setUnits0(units_0);
            planeProbePart.getNormalCoordinate().setUnits1(units_0);
            planeProbePart.getNormalCoordinate().setUnits2(units_0);
            planeProbePart.getNormalCoordinate().setDefinition("");
            planeProbePart.getNormalCoordinate().setValue(new DoubleVector(new double[] {1.0, 0.0, 0.0}));
            planeProbePart.getNormalCoordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {1.0, 0.0, 0.0}));

            planeProbePart.setXResolution(RES_X);
            planeProbePart.setYResolution(RES_Y);

            planeProbePart.getInputParts().setQuery(null);
            planeProbePart.getInputParts().setObjects(region_0, region_1);
            // ---- end recorded setup ----

            planeProbePart.setPresentationName("BFR field grid X" + tag);

            // Same tag format as the slice scenes (Velocity_X-0.10) so the web
            // app can pair a station's CSV with its image.
            String csv = outDir + File.separator + stationFile(tag);
            table.getParts().setQuery(null);
            table.getParts().setObjects(planeProbePart);
            table.extract();
            table.export(csv, ",");
            simulation_0.println("[BFR] field grid x=" + tag + " -> " + csv);

            // Detach from the table, then delete as the recording does.
            table.getParts().setObjects();
            simulation_0.deleteObjects(new ArrayList<>(Arrays.<ClientServerObject>asList(planeProbePart)));
        }

        simulation_0.println("[BFR] field export complete -> " + outDir);
    }

    // Job name is {INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}_{YYYYMMDD}
    // (CONTRIBUTING.md), each field a single token. SWEEPTYPE is counted from
    // the FRONT (4th token): names can carry a trailing time suffix, e.g.
    // DY_FC_Mesh30mm_Straight_20261003_0700. Same rule as sim_filename_parser.py's
    // _SWEEP_TYPE_ALIASES: STRAIGHTLINE or the pre-2026-08-01 STRAIGHT, any case.
    private static boolean isStraightLine(String runId) {
        String[] tok = runId.split("_");
        if (tok.length < 4) return false;
        String sweep = tok[3].toUpperCase(Locale.ROOT);
        return sweep.equals("STRAIGHTLINE") || sweep.equals("STRAIGHT");
    }

    // Rounded so float drift can't print -0.00 or 0.0999999.
    private static double stationX(int i) {
        return Math.round((X_START + i * X_STEP) * 1000) / 1000.0 + 0.0;
    }

    private static String stationTag(double x) {
        return String.format(Locale.ROOT, "%.2f", x);
    }

    private static String stationFile(String tag) {
        return "grid_X" + tag + ".csv";
    }

    // Plane coordinates are (y, z) pairs; x is each station's own. "resolution"
    // is passed straight through from setX/YResolution -- whether STAR puts
    // that many points or that many cells per side is left to the parser.
    private void writeGridJson(String path, String runId, int n, List<String> fieldNames)
            throws IOException {
        StringBuilder st = new StringBuilder();
        for (int i = 0; i < n; i++) {
            double x = stationX(i);
            if (i > 0) st.append(",\n");
            st.append("    {\"x\": ").append(x)
              .append(", \"file\": ").append(jsonString(stationFile(stationTag(x)))).append("}");
        }
        try (PrintWriter w = new PrintWriter(new FileWriter(path))) {
            w.println("{");
            w.println("  \"version\": 1,");
            w.println("  \"run\": " + jsonString(runId) + ",");
            w.println("  \"normal_axis\": \"x\",");
            w.println("  \"units\": \"m\",");
            w.println("  \"origin_yz\": [" + (-Y_HALF) + ", " + Z_HALF + "],");
            w.println("  \"point1_yz\": [" + (-Y_HALF) + ", " + (-Z_HALF) + "],");
            w.println("  \"point2_yz\": [" + Y_HALF + ", " + Z_HALF + "],");
            w.println("  \"resolution\": [" + RES_X + ", " + RES_Y + "],");
            w.println("  \"regions\": " + jsonArray(Arrays.asList(REGIONS)) + ",");
            w.println("  \"fields\": " + jsonArray(fieldNames) + ",");
            w.println("  \"stations\": [");
            w.println(st);
            w.println("  ]");
            w.println("}");
        }
    }

    private static String jsonString(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static String jsonArray(List<String> items) {
        StringBuilder b = new StringBuilder("[");
        for (int i = 0; i < items.size(); i++) {
            if (i > 0) b.append(", ");
            b.append(jsonString(items.get(i)));
        }
        return b.append("]").toString();
    }

    // Field functions named in VECTORS/SCALARS; a name this sim doesn't have
    // is skipped with a warning instead of aborting the sweep. The exported
    // functions' presentation names (the CSV column names) go into names.
    private NeoObjectVector fieldFunctions(Simulation sim, List<String> names) {
        List<Object> ffs = new ArrayList<>();
        for (String name : VECTORS) {
            FieldFunction ff = lookup(sim, name);
            if (ff == null) continue;
            FieldFunction mag = ((PrimitiveFieldFunction) ff).getMagnitudeFunction();
            ffs.add(mag);
            names.add(mag.getPresentationName());
        }
        for (String name : SCALARS) {
            FieldFunction ff = lookup(sim, name);
            if (ff == null) continue;
            ffs.add(ff);
            names.add(ff.getPresentationName());
        }
        return new NeoObjectVector(ffs.toArray());
    }

    private FieldFunction lookup(Simulation sim, String name) {
        FieldFunction ff = null;
        try { ff = sim.getFieldFunctionManager().getFunction(name); } catch (Exception e) {}
        if (ff == null) sim.println("[BFR] no field function '" + name + "', skipped");
        return ff;
    }
}
