package presentation_grid;
// export_fields.java
// BFR field-sampling macro. Sweeps an X-normal presentation grid along the
// car and exports X, Y, Z + field values at every grid point, one CSV per
// station. Standalone for now; meant to fold into export_scenes.java later.
// Output lands in ~/bfr/post_<run>/fields/ via resolvePath(), next to the scenes.
//
// The per-station grid setup is copied call for call from the 20.04.007
// recording presentationGrid_del.java, which is known to work: a fresh grid is
// created at each station with Origin, Point 1, Point 2 and Normal all set
// explicitly, then deleted before the next one. Keep that sequence as is.
//   - the grid's "Origin" is a CORNER: the plane spans origin -> Point 1 and
//     origin -> Point 2 (here y = -0.717..0.717 m, z = -1.530..1.530 m)
//   - grid points outside the fluid are left out of the export (no NaN rows)

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
        Simulation simulation_0 = getActiveSimulation();

        String runId  = simulation_0.getPresentationName().replaceAll("@\\d+$", "");
        String outDir = resolvePath("post_" + runId) + File.separator + "fields";
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
        table.setFieldFunctions(fieldFunctions(simulation_0));

        int n = (int) Math.round((X_END - X_START) / X_STEP) + 1;
        for (int i = 0; i < n; i++) {
            // Rounded so float drift can't print -0.00 or 0.0999999.
            double x = Math.round((X_START + i * X_STEP) * 1000) / 1000.0 + 0.0;
            String tag = String.format(Locale.ROOT, "%.2f", x);

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
            String csv = outDir + File.separator + "grid_X" + tag + ".csv";
            table.getParts().setQuery(null);
            table.getParts().setObjects(planeProbePart);
            table.extract();
            table.export(csv, ",");
            simulation_0.println("field grid x=" + tag + " -> " + csv);

            // Detach from the table, then delete as the recording does.
            table.getParts().setObjects();
            simulation_0.deleteObjects(new ArrayList<>(Arrays.<ClientServerObject>asList(planeProbePart)));
        }

        simulation_0.println("field export complete -> " + outDir);
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
