// Simcenter STAR-CCM+ macro: export_xyplot.java
// Written by Simcenter STAR-CCM+ 20.04.007
package macro;

import java.util.*;

import star.common.*;
import star.base.neo.*;

public class export_xyplot_sample extends StarMacro {

  public void execute() {
    execute0();
  }

  private void execute0() {

    Simulation simulation_0 = 
      getActiveSimulation();

    Cartesian2DPlot cartesian2DPlot_4 = 
      ((Cartesian2DPlot) simulation_0.getPlotManager().getPlot("XY Plot"));

    cartesian2DPlot_4.export(resolvePath("C:\\Users\\liuyu\\Desktop\\FSAE\\B27\\meshBaseSize\\Results\\xy_plot_sample.csv"), ",");
  }
}
