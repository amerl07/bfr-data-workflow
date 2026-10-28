// export_scenes.java
// BFR pure-export macro. Runs as the third token in:  -batch mesh,run,export_scenes.java
// Executes in the SAME batch process against the solved, in-memory sim.
// Does ONLY: (1) every scene -> PNG, (2) all report values -> force_reports.txt.
// No mesh, no solve, no save. Output lands in ~/bfr/post_<run>/ via resolvePath().

import java.io.*;
import star.common.*;
import star.base.report.*;
import star.vis.*;          // Scene, SceneManager

public class export_scenes extends StarMacro {

    // ---- export config (edit here) ----
    static final int     WIDTH     = 2560;   // px; bump to 3840 for design-binder figures
    static final int     HEIGHT    = 1440;   // px
    static final int     MAG       = 1;      // hardcopy scale factor

    // Scene-name separator -> subfolder. A scene named "Cp/FrontWing" exports to
    // post_<run>/Cp/FrontWing.png. Change to "__" if STAR-CCM+ rejects "/" in a
    // scene name in your build. A name with no separator exports flat (old behavior).
    static final String  GROUP_SEP = "/";

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

        sim.println("[BFR] export complete -> " + outDir);
    }
}
