// Simcenter STAR-CCM+ macro: presentation_grid.java
// Written by Simcenter STAR-CCM+ 20.04.007
package presentation_grid;

import java.util.*;

import star.common.*;
import star.base.neo.*;
import star.coremodule.ui.plotsetup.*;
import star.coremodule.ui.plotsetup.dscfg.*;
import star.vis.*;

public class presentation_grid extends StarMacro {

  public void execute() {
    execute0();
  }

  private void execute0() {

    Simulation simulation_0 = 
      getActiveSimulation();

    Units units_0 = 
      simulation_0.getUnitsManager().getPreferredUnits(Dimensions.Builder().length(1).build());

    Scene scene_0 = 
      simulation_0.getSceneManager().getScene("Geometry");

    scene_0.setTransparencyOverrideMode(SceneTransparencyOverride.MAKE_SCENE_TRANSPARENT);

    scene_0.getCreatorGroup().setQuery(null);

    Region region_0 = 
      simulation_0.getRegionManager().getRegion("Porous Fluid");

    Region region_1 = 
      simulation_0.getRegionManager().getRegion("Static Fluid");

    scene_0.getCreatorGroup().setObjects(region_0, region_1);

    CurrentView currentView_0 = 
      scene_0.getCurrentView();

    currentView_0.setInput(new DoubleVector(new double[] {-0.3499764398867648, -0.4579649567406976, 0.549095899069107}), new DoubleVector(new double[] {-54.54142478969193, -7.867343421896421, 15.699123891320612}), new DoubleVector(new double[] {0.26693710791704717, 0.017826953977257868, 0.9635490543448135}), 1.0335217566321118, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-0.8509903718873328, -1.3659672973198154, 1.1171306300933872}), new DoubleVector(new double[] {-54.32769774880617, -8.67762210802578, 16.067342118520525}), new DoubleVector(new double[] {0.26693710791704717, 0.017826953977257868, 0.9635490543448135}), 1.8306093719523513, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-0.3480991373040898, -0.8282761291742815, 1.0751207809713306}), new DoubleVector(new double[] {-38.31935334762523, -40.83108696482823, 4.37241477235741}), new DoubleVector(new double[] {0.1378772353296711, -0.049337113260722605, 0.9892197517402119}), 1.8306093719523513, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-0.3480991373040898, -0.8282761291742815, 1.0751207809713306}), new DoubleVector(new double[] {-38.31935334762523, -40.83108696482823, 4.37241477235741}), new DoubleVector(new double[] {0.1378772353296711, -0.049337113260722605, 0.9892197517402119}), 1.8306093719523513, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-0.3480991373040898, -0.8282761291742815, 1.0751207809713306}), new DoubleVector(new double[] {-0.3480991373040898, -56.081449510651446, 1.0751207809713306}), new DoubleVector(new double[] {0.0, 0.0, 1.0}), 1.8306093719523513, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-0.7952451544319441, -2.106695216134134, 1.1772698449190448}), new DoubleVector(new double[] {-34.52093552275247, -45.22305933034753, 8.881794922078956}), new DoubleVector(new double[] {0.0477714069085881, 0.1393744652941085, 0.9890867763275216}), 1.8306093719523513, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-0.7952451544319441, -2.106695216134134, 1.1772698449190448}), new DoubleVector(new double[] {-34.52093552275247, -45.22305933034753, 8.881794922078956}), new DoubleVector(new double[] {0.0477714069085881, 0.1393744652941085, 0.9890867763275216}), 1.8306093719523513, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-0.7952451544319441, -2.106695216134134, 1.1772698449190448}), new DoubleVector(new double[] {-0.7952451544319441, -57.38601098536055, 1.1772698449190448}), new DoubleVector(new double[] {0.0, 0.0, 1.0}), 1.8306093719523513, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-2.8685939767371105, -2.8714868701052425, 1.3356229348541233}), new DoubleVector(new double[] {-59.21548210043413, -8.836742947309865, 5.639145693118881}), new DoubleVector(new double[] {0.06796148879574608, 0.07573296226535679, 0.9948094061010836}), 1.8306093719523513, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-2.8685939767371105, -2.8714868701052425, 1.3356229348541233}), new DoubleVector(new double[] {-59.693556708110364, -2.8714868701052425, 1.3356229348541233}), new DoubleVector(new double[] {0.0, 0.0, 1.0}), 1.8306093719523513, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-1.857387713991443, -4.217128336714795, 1.8889934663086736}), new DoubleVector(new double[] {-59.693556708110364, -4.217128336714795, 1.8889934663086736}), new DoubleVector(new double[] {0.0, 0.0, 1.0}), 3.241578239392473, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-1.8573876979392736, -2.570257553023441, 1.6058211143617447}), new DoubleVector(new double[] {-59.693556708110364, -2.570257553023441, 1.6058211143617447}), new DoubleVector(new double[] {0.0, 0.0, 1.0}), 3.241578239392473, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-1.6289159672483322, -1.3582735841125928, 0.8744661639689041}), new DoubleVector(new double[] {-59.693556708110364, -1.3582735841125928, 0.8744661639689041}), new DoubleVector(new double[] {0.0, 0.0, 1.0}), 1.396072235605801, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-1.6169804525896865, -1.462096427381208, 0.9299881172470199}), new DoubleVector(new double[] {-59.693556708110364, -1.462096427381208, 0.9299881172470199}), new DoubleVector(new double[] {0.0, 0.0, 1.0}), 1.5356533764188067, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-1.5014758426891035, -2.347469376202225, 0.9000281916048825}), new DoubleVector(new double[] {-59.693556708110364, -2.347469376202225, 0.9000281916048825}), new DoubleVector(new double[] {0.0, 0.0, 1.0}), 2.7200570213228605, 1, 30.0);

    scene_0.getCreatorGroup().setQuery(null);

    scene_0.getCreatorGroup().setObjects(region_0, region_1);

    PartDisplayer partDisplayer_7 = 
      scene_0.getDisplayerManager().createPartDisplayer("Probe Surface", -1, 1);

    scene_0.setTransparencyOverrideMode(SceneTransparencyOverride.MAKE_SCENE_TRANSPARENT);

    PlaneProbePart planeProbePart_7 = 
      simulation_0.getPartManager().createPlaneProbePart(new ArrayList<>(Collections.<NamedObject>emptyList()), new DoubleVector(new double[] {0.0, 0.0, 0.0}), new DoubleVector(new double[] {1.0, 0.0, 0.0}), new DoubleVector(new double[] {0.0, 1.0, 0.0}), 20, 20, null);

    LabCoordinateSystem labCoordinateSystem_0 = 
      simulation_0.getCoordinateSystemManager().getLabCoordinateSystem();

    planeProbePart_7.setCoordinateSystem(labCoordinateSystem_0);

    planeProbePart_7.getOriginCoordinate().setUnits0(units_0);

    planeProbePart_7.getOriginCoordinate().setUnits1(units_0);

    planeProbePart_7.getOriginCoordinate().setUnits2(units_0);

    planeProbePart_7.getOriginCoordinate().setDefinition("");

    planeProbePart_7.getOriginCoordinate().setValue(new DoubleVector(new double[] {-0.8999999999999998, -0.7309083527168999, 1.532737126745908}));

    planeProbePart_7.getOriginCoordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {-0.8999999999999998, -0.7309083527168999, 1.532737126745908}));

    planeProbePart_7.getPoint1Coordinate().setUnits0(units_0);

    planeProbePart_7.getPoint1Coordinate().setUnits1(units_0);

    planeProbePart_7.getPoint1Coordinate().setUnits2(units_0);

    planeProbePart_7.getPoint1Coordinate().setDefinition("");

    planeProbePart_7.getPoint1Coordinate().setValue(new DoubleVector(new double[] {-0.9000000000000006, -0.7309083527168999, -1.532737126745908}));

    planeProbePart_7.getPoint1Coordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {-0.9000000000000006, -0.7309083527168999, -1.532737126745908}));

    planeProbePart_7.getPoint2Coordinate().setUnits0(units_0);

    planeProbePart_7.getPoint2Coordinate().setUnits1(units_0);

    planeProbePart_7.getPoint2Coordinate().setUnits2(units_0);

    planeProbePart_7.getPoint2Coordinate().setDefinition("");

    planeProbePart_7.getPoint2Coordinate().setValue(new DoubleVector(new double[] {-0.8999999999999998, 0.7309083527168999, 1.532737126745908}));

    planeProbePart_7.getPoint2Coordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {-0.8999999999999998, 0.7309083527168999, 1.532737126745908}));

    planeProbePart_7.getNormalCoordinate().setUnits0(units_0);

    planeProbePart_7.getNormalCoordinate().setUnits1(units_0);

    planeProbePart_7.getNormalCoordinate().setUnits2(units_0);

    planeProbePart_7.getNormalCoordinate().setDefinition("");

    planeProbePart_7.getNormalCoordinate().setValue(new DoubleVector(new double[] {1.0, 0.0, 0.0}));

    planeProbePart_7.getNormalCoordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {1.0, 0.0, 0.0}));

    planeProbePart_7.setXResolution(40);

    planeProbePart_7.setYResolution(40);

    planeProbePart_7.getInputParts().setQuery(null);

    planeProbePart_7.getInputParts().setObjects(region_0, region_1);

    partDisplayer_7.getVisibleParts().addParts(planeProbePart_7);

    partDisplayer_7.getHiddenParts().addParts();

    scene_0.setTransparencyOverrideMode(SceneTransparencyOverride.USE_DISPLAYER_PROPERTY);

    currentView_0.setInput(new DoubleVector(new double[] {-1.7781865717730772, -2.346527047937133, 0.9298025153739169}), new DoubleVector(new double[] {-58.636886817928726, -1.9547266572270696, 13.3093438259816}), new DoubleVector(new double[] {0.2127358396652579, -7.24462570930598E-4, 0.9771094809057612}), 2.7200570213228605, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-1.7730370569839529, -2.346535934447312, 0.9288038147342241}), new DoubleVector(new double[] {-58.80508312539709, -2.1511957853596964, 12.43593389447917}), new DoubleVector(new double[] {0.19777825187575981, -6.473540937107828E-4, 0.9802465730711188}), 2.7200570213228605, 1, 30.0);

    scene_0.setTransparencyOverrideMode(SceneTransparencyOverride.MAKE_SCENE_TRANSPARENT);

    scene_0.getCreatorGroup().setQuery(null);

    scene_0.getCreatorGroup().setObjects(region_0, region_1);

    planeProbePart_7.setBatched(true);

    planeProbePart_7.setCoordinateSystem(labCoordinateSystem_0);

    planeProbePart_7.getOriginCoordinate().setUnits0(units_0);

    planeProbePart_7.getOriginCoordinate().setUnits1(units_0);

    planeProbePart_7.getOriginCoordinate().setUnits2(units_0);

    planeProbePart_7.getOriginCoordinate().setDefinition("");

    planeProbePart_7.getOriginCoordinate().setValue(new DoubleVector(new double[] {-0.8999999999999998, -0.9309083527169, 1.532737126745908}));

    planeProbePart_7.getOriginCoordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {-0.8999999999999998, -0.9309083527169, 1.532737126745908}));

    planeProbePart_7.getPoint1Coordinate().setUnits0(units_0);

    planeProbePart_7.getPoint1Coordinate().setUnits1(units_0);

    planeProbePart_7.getPoint1Coordinate().setUnits2(units_0);

    planeProbePart_7.getPoint1Coordinate().setDefinition("");

    planeProbePart_7.getPoint1Coordinate().setValue(new DoubleVector(new double[] {-0.9000000000000006, -0.9309083527169, -1.532737126745908}));

    planeProbePart_7.getPoint1Coordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {-0.9000000000000006, -0.9309083527169, -1.532737126745908}));

    planeProbePart_7.getPoint2Coordinate().setUnits0(units_0);

    planeProbePart_7.getPoint2Coordinate().setUnits1(units_0);

    planeProbePart_7.getPoint2Coordinate().setUnits2(units_0);

    planeProbePart_7.getPoint2Coordinate().setDefinition("");

    planeProbePart_7.getPoint2Coordinate().setValue(new DoubleVector(new double[] {-0.8999999999999998, 0.5309083527168998, 1.532737126745908}));

    planeProbePart_7.getPoint2Coordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {-0.8999999999999998, 0.5309083527168998, 1.532737126745908}));

    planeProbePart_7.getNormalCoordinate().setUnits0(units_0);

    planeProbePart_7.getNormalCoordinate().setUnits1(units_0);

    planeProbePart_7.getNormalCoordinate().setUnits2(units_0);

    planeProbePart_7.getNormalCoordinate().setDefinition("");

    planeProbePart_7.getNormalCoordinate().setValue(new DoubleVector(new double[] {1.0, 0.0, -2.535190489211801E-16}));

    planeProbePart_7.getNormalCoordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {1.0, 0.0, -2.535190489211801E-16}));

    planeProbePart_7.setXResolution(40);

    planeProbePart_7.setYResolution(40);

    planeProbePart_7.getInputParts().setQuery(null);

    planeProbePart_7.getInputParts().setObjects(region_0, region_1);

    planeProbePart_7.setBatched(false);

    partDisplayer_7.getVisibleParts().addParts();

    partDisplayer_7.getHiddenParts().addParts();

    scene_0.setTransparencyOverrideMode(SceneTransparencyOverride.USE_DISPLAYER_PROPERTY);

    currentView_0.setInput(new DoubleVector(new double[] {-4.630010589285557, -2.332873444776543, 1.4959888928570764}), new DoubleVector(new double[] {-59.669261952133, -0.4537801352696271, 8.565387405757992}), new DoubleVector(new double[] {0.127419106323835, 6.80256419022208E-4, 0.9918487327182972}), 2.7200570213228605, 1, 30.0);

    scene_0.setTransparencyOverrideMode(SceneTransparencyOverride.MAKE_SCENE_TRANSPARENT);

    scene_0.getCreatorGroup().setQuery(null);

    scene_0.getCreatorGroup().setObjects(region_0, region_1);

    planeProbePart_7.setBatched(true);

    planeProbePart_7.setCoordinateSystem(labCoordinateSystem_0);

    planeProbePart_7.getOriginCoordinate().setUnits0(units_0);

    planeProbePart_7.getOriginCoordinate().setUnits1(units_0);

    planeProbePart_7.getOriginCoordinate().setUnits2(units_0);

    planeProbePart_7.getOriginCoordinate().setDefinition("");

    planeProbePart_7.getOriginCoordinate().setValue(new DoubleVector(new double[] {-0.8999999999999998, -0.8309083527168999, 1.532737126745908}));

    planeProbePart_7.getOriginCoordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {-0.8999999999999998, -0.8309083527168999, 1.532737126745908}));

    planeProbePart_7.getPoint1Coordinate().setUnits0(units_0);

    planeProbePart_7.getPoint1Coordinate().setUnits1(units_0);

    planeProbePart_7.getPoint1Coordinate().setUnits2(units_0);

    planeProbePart_7.getPoint1Coordinate().setDefinition("");

    planeProbePart_7.getPoint1Coordinate().setValue(new DoubleVector(new double[] {-0.9000000000000006, -0.8309083527168999, -1.532737126745908}));

    planeProbePart_7.getPoint1Coordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {-0.9000000000000006, -0.8309083527168999, -1.532737126745908}));

    planeProbePart_7.getPoint2Coordinate().setUnits0(units_0);

    planeProbePart_7.getPoint2Coordinate().setUnits1(units_0);

    planeProbePart_7.getPoint2Coordinate().setUnits2(units_0);

    planeProbePart_7.getPoint2Coordinate().setDefinition("");

    planeProbePart_7.getPoint2Coordinate().setValue(new DoubleVector(new double[] {-0.8999999999999998, 0.6309083527168999, 1.532737126745908}));

    planeProbePart_7.getPoint2Coordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {-0.8999999999999998, 0.6309083527168999, 1.532737126745908}));

    planeProbePart_7.getNormalCoordinate().setUnits0(units_0);

    planeProbePart_7.getNormalCoordinate().setUnits1(units_0);

    planeProbePart_7.getNormalCoordinate().setUnits2(units_0);

    planeProbePart_7.getNormalCoordinate().setDefinition("");

    planeProbePart_7.getNormalCoordinate().setValue(new DoubleVector(new double[] {1.0, 0.0, 0.0}));

    planeProbePart_7.getNormalCoordinate().setCoordinate(units_0, units_0, units_0, new DoubleVector(new double[] {1.0, 0.0, 0.0}));

    planeProbePart_7.setXResolution(40);

    planeProbePart_7.setYResolution(40);

    planeProbePart_7.getInputParts().setQuery(null);

    planeProbePart_7.getInputParts().setObjects(region_0, region_1);

    planeProbePart_7.setBatched(false);

    partDisplayer_7.getVisibleParts().addParts();

    partDisplayer_7.getHiddenParts().addParts();

    scene_0.setTransparencyOverrideMode(SceneTransparencyOverride.USE_DISPLAYER_PROPERTY);

    currentView_0.setInput(new DoubleVector(new double[] {-3.64583168931741, -2.3576651716246615, 1.3273033104785315}), new DoubleVector(new double[] {-57.16216459975167, -2.5620691899263623, 17.950278068131464}), new DoubleVector(new double[] {0.2966407495916638, -0.0019451734910706404, 0.9549871632550092}), 2.7200570213228605, 1, 30.0);

    currentView_0.setInput(new DoubleVector(new double[] {-0.4779991933650206, -2.312874304776899, 0.38234554031535994}), new DoubleVector(new double[] {-57.89779554302203, -16.067806085527728, 2.0625183277175085}), new DoubleVector(new double[] {0.03731437515494411, -0.033772634514528145, 0.9987327202834786}), 2.7200570213228605, 1, 30.0);

    FvRepresentation fvRepresentation_0 = 
      ((FvRepresentation) simulation_0.getRepresentationManager().getObject("Volume Mesh"));

    Cartesian2DPlot cartesian2DPlot_4 = 
      simulation_0.getPlotManager().createCartesian2DPlot("XY Plot", Arrays.<XyPlotTypeEnum>asList(XyPlotTypeEnum.BASIC), new XyDataSeriesConfig(SimDataSourceType.PARTS, new ArrayList<>(Arrays.<ClientServerObject>asList(planeProbePart_7)), fvRepresentation_0, new PlotAxisInput(VariableType.DIRECTION, new PlotAxisInput.DirectionInput(new DoubleVector(new double[] {1.0, 0.0, 0.0}), units_0)), new PlotAxisInput(VariableType.SCALAR)));

    cartesian2DPlot_4.openInteractive();

    PartGroupDataSet partGroupDataSet_5 = 
      ((PartGroupDataSet) cartesian2DPlot_4.getDataSetManager().getDataSet("Presentation Grid"));

    PartAxisType partAxisType_6 = 
      ((PartAxisType) partGroupDataSet_5.getAxisTypeManager().getAxisType("Left Axis Data"));

    FieldFunctionUnits fieldFunctionUnits_3 = 
      partAxisType_6.getScalarFunction();

    PrimitiveFieldFunction primitiveFieldFunction_0 = 
      ((PrimitiveFieldFunction) simulation_0.getFieldFunctionManager().getFunction("Velocity"));

    VectorMagnitudeFieldFunction vectorMagnitudeFieldFunction_0 = 
      ((VectorMagnitudeFieldFunction) primitiveFieldFunction_0.getMagnitudeFunction());

    fieldFunctionUnits_3.setFieldFunction(vectorMagnitudeFieldFunction_0);

    PartAxisType partAxisType_7 = 
      ((PartAxisType) partGroupDataSet_5.getAxisTypeManager().getAxisType("Bottom Axis Data"));

    partAxisType_7.getDirectionVector().setComponentsAndUnits(0.0, 1.0, 0.0, units_0);

    Cartesian2DAxisManager cartesian2DAxisManager_4 = 
      ((Cartesian2DAxisManager) cartesian2DPlot_4.getAxisManager());

    cartesian2DAxisManager_4.setAxesBounds(new Vector(Arrays.<AxisManager.AxisBounds>asList(new AxisManager.AxisBounds("Left Axis", 4.904909235769826, false, 20.16181627637887, false), new AxisManager.AxisBounds("Bottom Axis", -0.8309083527168999, false, -0.026909164728309953, false))));

    partAxisType_7.getDirectionVector().setComponentsAndUnits(0.0, 0.0, 1.0, units_0);

    cartesian2DAxisManager_4.setAxesBounds(new Vector(Arrays.<AxisManager.AxisBounds>asList(new AxisManager.AxisBounds("Bottom Axis", 0.0, false, 1.532737126745908, false))));
  }
}
