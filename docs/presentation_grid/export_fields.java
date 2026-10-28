package presentation_grid;
// export_fields.java
// BFR field-sampling macro. Sweeps an X-normal presentation grid along the
// car and exports X, Y, Z + field values at every grid point, one CSV per
// station. Standalone for now; meant to fold into export_scenes.java later.
// Output lands in ~/bfr/post_<run>/fields/ via resolvePath(), next to the scenes.
//
// Built from the 2506 recordings in docs/presentation_grid/. What they showed:
//   - the grid's "Origin" is a CORNER, not the center: the plane spans
//     origin -> Point 1 and origin -> Point 2
//   - ground is z = 0 and the half-car is on the -y side; grid points outside
//     the fluid are left out of the export (no NaN rows)

import java.io.*;
import java.util.*;
import star.common.*;
import star.base.neo.*;
import star.vis.*;          // PlaneProbePart (presentation grid)

public class export_fields extends StarMacro {

    // ---- sweep config (edit here) ----
    static final double  X_START = -0.9;    // m, first station
    static final double  X_END   =  2.0;    // m, last station (inclusive)
    static final double  X_STEP  =  0.05;   // m -> 59 stations

    // Grid corner at every station; the grid grows toward -y (outboard) and
    // +z (up) from here, so it stays on the fluid side of the symmetry plane
    // and the ground.
    static final double  Y0      = -0.1;    // m
    static final double  Z0      =  0.0;    // m (ground)
    static final int     RES_Y   =  40;     // grid intervals along y -> 41 points
    static final int     RES_Z   =  40;     // grid intervals along z -> 41 points

    static final String[] REGIONS = {"Porous Fluid", "Static Fluid"};
    static final String[] VECTORS = {"Velocity"};   // exported as magnitude
    static final String[] SCALARS = {"PressureCoefficient"};

    public void execute() {
        Simulation sim = getActiveSimulation();

        String runId  = sim.getPresentationName().replaceAll("@\\d+$", "");
        String outDir = resolvePath("post_" + runId) + File.separator + "fields";
        new File(outDir).mkdirs();

        Units m = sim.getUnitsManager().getPreferredUnits(Dimensions.Builder().length(1).build());

        List<Region> regions = new ArrayList<>();
        for (String name : REGIONS) regions.add(sim.getRegionManager().getRegion(name));

        // One grid and one table, moved station to station, rather than 59 of each.
        PlaneProbePart grid = sim.getPartManager().createPlaneProbePart(
            new ArrayList<>(Collections.<NamedObject>emptyList()),
            new DoubleVector(new double[] {X_START, Y0, Z0}),
            new DoubleVector(new double[] {1.0, 0.0, 0.0}),
            new DoubleVector(new double[] {0.0, 1.0, 0.0}),
            RES_Y, RES_Z, null);
        grid.setPresentationName("BFR field grid");
        grid.setCoordinateSystem(sim.getCoordinateSystemManager().getLabCoordinateSystem());
        grid.getNormalCoordinate().setCoordinate(m, m, m, new DoubleVector(new double[] {1.0, 0.0, 0.0}));
        // Size set once at the first station; after this only Origin is moved
        // and STAR carries Point 1 / Point 2 along with it.
        grid.getOriginCoordinate().setCoordinate(m, m, m, new DoubleVector(new double[] {X_START, Y0, Z0}));
        grid.setXResolution(RES_Y);
        grid.setYResolution(RES_Z);
        grid.getInputParts().setQuery(null);
        grid.getInputParts().setObjects(regions.toArray(new Region[0]));

        XyzInternalTable table = sim.getTableManager().createTable(XyzInternalTable.class);
        table.setPresentationName("field grid table");
        table.setExtractVertexData(true);   // values at the grid points themselves
        table.getParts().setQuery(null);
        table.getParts().setObjects(grid);
        table.setFieldFunctions(fieldFunctions(sim));

        int n = (int) Math.round((X_END - X_START) / X_STEP) + 1;
        for (int i = 0; i < n; i++) {
            // Rounded so float drift can't print -0.00 or 0.0999999.
            double x = Math.round((X_START + i * X_STEP) * 1000) / 1000.0 + 0.0;
            String tag = String.format(Locale.ROOT, "%.2f", x);

            grid.getOriginCoordinate().setCoordinate(m, m, m, new DoubleVector(new double[] {x, Y0, Z0}));

            // Same tag format as the slice scenes (Velocity_X-0.10) so the web
            // app can pair a station's CSV with its image.
            String csv = outDir + File.separator + "grid_X" + tag + ".csv";
            table.extract();
            table.export(csv, ",");
            sim.println("field grid x=" + tag + " -> " + csv);
        }

        sim.println("field export complete -> " + outDir);
    }

    // Field functions named in VECTORS/SCALARS; a name this sim doesn't have
    // is skipped with a warning instead of aborting the sweep.
    private NeoObjectVector fieldFunctions(Simulation sim) {
        List<Object> ffs = new ArrayList<>();
        for (String name : VECTORS) {
            FieldFunction ff = lookup(sim, name);
            if (ff == null) continue;
            ffs.add(((PrimitiveFieldFunction) ff).getMagnitudeFunction());
        }
        for (String name : SCALARS) {
            FieldFunction ff = lookup(sim, name);
            if (ff != null) ffs.add(ff);
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
