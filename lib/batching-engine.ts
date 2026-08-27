/**
 * Concrete Kings Jamaica - Advanced Batching Physics & Formulation Engine
 *
 * Implements precision volumetric yield, moisture-compensated mix stoichiometry,
 * water/cement ratio quality checks, W/C-adjusted COA strength prediction curves,
 * and estimated setting time dynamics.
 */

export interface MasterRecipe {
  id?: string;
  code: string;
  description?: string;
  strength?: string; // e.g. "3000 PSI", "21 MPa", "30 MPa"
  placementType?: string; // "Pump", "Chute", "Tremie", etc.
  cement: number; // kg/CYD (or kg/m³)
  sand: number; // kg/CYD
  threeQuarterStone: number; // kg/CYD (3/4" stone / s34)
  threeEighthStone?: number; // kg/CYD (3/8" stone / s38)
  designWater: number; // L/CYD
  plasticizer?: number; // fl oz/CYD
  retarder?: number; // fl oz/CYD
  airTargetPct?: number; // % (default ~1.5 - 2.0%)
}

export interface MaterialAdjustments {
  // Per-yard material adjustments (entered into plant batch computer)
  cementPerYard?: number; // +/- kg/yd³
  sandPerYard?: number; // +/- kg/yd³
  threeQuarterStonePerYard?: number; // +/- kg/yd³
  threeEighthStonePerYard?: number; // +/- kg/yd³
  plasticizerPerYard?: number; // +/- fl oz/yd³
  retarderPerYard?: number; // +/- fl oz/yd³
  waterPerYard?: number; // +/- L/yd³ (Design Water Rate adjustment)

  // Per full truck adjustments (water & moisture-adjusted batch sand)
  waterTruck?: number; // +/- L for full truck
  sandTruck?: number; // +/- kg for full truck

  // Legacy fallback fields
  cement?: number;
  sand?: number;
  threeQuarterStone?: number;
  threeEighthStone?: number;
  water?: number;
  plasticizer?: number;
  retarder?: number;
}

export interface PantrySpecificGravities {
  cementSG?: number; // default 3.15 (CEMEX Local/Imported HE)
  sandSG?: number; // default 2.65 (SAND-01 Burnish washed sand)
  s34SG?: number; // default 2.95 (STONE-34 Burnish crushed 3/4" aggregate)
  s38SG?: number; // default 2.98 (STONE-38 Burnish small 3/8" aggregate)
  waterSG?: number; // default 1.00 (Mixing water)
  plasticizerSG?: number; // default 1.10 (DYNAplas PC 5-21)
  retarderSG?: number; // default 1.16 (DYNAplas R-350BD)
  airTargetPct?: number; // default 1.0% (Entrapped air)
}

export interface CementCOAProfile {
  code: string;
  name: string;
  base3dMPa: number;
  base7dMPa: number;
  base28dMPa: number;
  wcTypical: number;
}

export const DEFAULT_CEMENT_COAS: Record<string, CementCOAProfile> = {
  carib_type1: {
    code: "carib_type1",
    name: "Carib Cement Type I/II (Rockfort)",
    base3dMPa: 24.5,
    base7dMPa: 33.0,
    base28dMPa: 44.5,
    wcTypical: 0.50,
  },
  carib_plus: {
    code: "carib_plus",
    name: "Carib Cement Plus (High Early)",
    base3dMPa: 27.0,
    base7dMPa: 36.5,
    base28dMPa: 48.0,
    wcTypical: 0.48,
  },
  generic: {
    code: "generic",
    name: "Standard Portland Cement",
    base3dMPa: 22.0,
    base7dMPa: 31.0,
    base28dMPa: 42.0,
    wcTypical: 0.50,
  },
};

export const DEFAULT_PANTRY_SG: Required<PantrySpecificGravities> = {
  cementSG: 3.15,
  sandSG: 2.65,
  s34SG: 2.95,
  s38SG: 2.98,
  waterSG: 1.00,
  plasticizerSG: 1.10,
  retarderSG: 1.16,
  airTargetPct: 1.0,
};

export interface BatchCalculationInput {
  master: MasterRecipe;
  volume: number; // CYD (Cubic Yards)
  moisturePct?: number; // Sand surface moisture % (default 3.0)
  stoneMoisturePct?: number; // Stone surface moisture % (default 1.0)
  adj?: MaterialAdjustments;
  cementCode?: string;
  pantry?: PantrySpecificGravities;
}

export interface BatchCalculationOutput {
  // Batch weights
  cementTotal: number; // kg
  sandTotal: number; // kg (including moisture replacement compensation)
  s34Total: number; // kg (including stone moisture replacement compensation)
  s38Total: number; // kg
  plTotal: number; // fl oz (plasticizer)
  retTotal: number; // fl oz (retarder)

  // Water & Moisture Breakdown
  addedWater: number; // L (rounded down to multiple of 50 per plant standard)
  targetAddedWaterExact: number; // L (exact unrounded target)
  finalWater: number; // L (addedWater + waterInSand + waterInStone)
  waterInSand: number; // L
  waterInStone: number; // L
  waterInAggregates: number; // L (waterInSand + waterInStone)
  replacementSand: number; // kg extra dry sand to compensate
  replacementStone: number; // kg extra dry stone to compensate
  baseSandDry: number; // kg dry sand baseline
  baseStoneDry: number; // kg dry stone baseline

  // Water / Cement Quality Metrics
  wcRatio: number;
  wcTarget: number;
  wcStatus: "Optimal" | "Acceptable" | "High";

  // Estimated Setting Time
  settingH: number;
  settingM: number;
  settingTimeFormatted: string;

  // Strength Predictions (PSI based on design and W/C curve)
  strength: {
    s3d: number; // 3-day PSI
    s7d: number; // 7-day PSI
    s28d: number; // 28-day PSI
    strengthAdj: number; // adjustment factor from W/C
  };

  // Aggregate Ratio (Sand vs Coarse Aggregate ratio)
  aggregateRatio: {
    sandPct: number;
    stonePct: number;
    ratioFormatted: string; // e.g. "60:40"
  };

  // Paste Volume Fraction
  paste: {
    pastePct: number;
    pasteStatus: "Lean" | "Normal" | "Rich";
  };

  // Volumetric Yield (CYD)
  yieldCYD: number;
  yieldStatus: "On Target" | "Under-yielding" | "Over-yielding";
}

/**
 * Executes full batch formulation calculations:
 * - Material batch totals with moisture-adjusted sand & water compensation
 * - Water/Cement ratio status & quality compliance
 * - Cement COA exponential strength prediction curves (3d, 7d, 28d)
 * - Retarder & temperature-dependent set times
 * - Specific-gravity volumetric paste fraction & actual batch yield
 */
export function calculateBatchFormulation(
  input: BatchCalculationInput
): BatchCalculationOutput {
  const { master, volume, moisturePct = 3.0, stoneMoisturePct = 1.0, adj = {}, cementCode = "carib_type1", pantry = {} } = input;

  const sg = { ...DEFAULT_PANTRY_SG, ...pantry };
  const cementProfile = DEFAULT_CEMENT_COAS[cementCode] || DEFAULT_CEMENT_COAS.carib_type1;

  // 1. Material batch totals with per-yard adjustments (entered into plant computer)
  const cementRateAdj = adj.cementPerYard !== undefined ? adj.cementPerYard : (adj.cement && volume > 0 ? adj.cement / volume : 0);
  const s34RateAdj = adj.threeQuarterStonePerYard !== undefined ? adj.threeQuarterStonePerYard : (adj.threeQuarterStone && volume > 0 ? adj.threeQuarterStone / volume : 0);
  const s38RateAdj = adj.threeEighthStonePerYard !== undefined ? adj.threeEighthStonePerYard : (adj.threeEighthStone && volume > 0 ? adj.threeEighthStone / volume : 0);
  const sandRateAdj = adj.sandPerYard !== undefined ? adj.sandPerYard : 0;
  const plRateAdj = adj.plasticizerPerYard !== undefined ? adj.plasticizerPerYard : (adj.plasticizer && volume > 0 ? adj.plasticizer / volume : 0);
  const retRateAdj = adj.retarderPerYard !== undefined ? adj.retarderPerYard : (adj.retarder && volume > 0 ? adj.retarder / volume : 0);

  // Admixture rates converted from mL to fl oz (1 fl oz = 29.5735 mL)
  const basePlRateFlOz = (master.plasticizer || 0) >= 50 ? (master.plasticizer || 0) / 29.5735296 : (master.plasticizer || 0);
  const baseRetRateFlOz = (master.retarder || 0) >= 50 ? (master.retarder || 0) / 29.5735296 : (master.retarder || 0);

  const effCementRate = Math.max(0, master.cement + cementRateAdj);
  const effS34Rate = Math.max(0, master.threeQuarterStone + s34RateAdj);
  const effS38Rate = Math.max(0, (master.threeEighthStone || 0) + s38RateAdj);
  const effSandRate = Math.max(0, master.sand + sandRateAdj);
  const effPlRate = Math.max(0, basePlRateFlOz + plRateAdj);
  const effRetRate = Math.max(0, baseRetRateFlOz + retRateAdj);

  const cementTotal = Math.max(0, Math.round(effCementRate * volume));
  const plTotal = Math.max(0, Math.round(effPlRate * volume));
  const retTotal = Math.max(0, Math.round(effRetRate * volume));

  // 2. Sand moisture compensation & replacement calculation (calculated per full truck)
  const mSand = Math.max(0, moisturePct) / 100;
  const baseSandDry = Math.round(effSandRate * volume);
  
  // Total sand to batch for full truck to deliver baseSandDry: S_wet = S_dry / (1 - m)
  const theoreticalWetSand = mSand < 1 ? baseSandDry / (1 - mSand) : baseSandDry;
  const sandTruckAdj = adj.sandTruck !== undefined ? adj.sandTruck : (adj.sand || 0);
  const sandTotal = Math.max(0, Math.round(theoreticalWetSand + sandTruckAdj));
  
  // Moisture delivered in the batched sand for full truck
  const waterInSand = Math.round(sandTotal * mSand);
  
  // Extra sand needed beyond dry sand to replace moisture mass for full truck
  const replacementSand = mSand < 1 ? Math.round(waterInSand / (1 - mSand)) : 0;

  // 3. Stone moisture compensation & replacement calculation (calculated per full truck)
  const mStone = Math.max(0, stoneMoisturePct) / 100;
  const baseS34Dry = Math.round(effS34Rate * volume);
  const baseS38Dry = Math.round(effS38Rate * volume);
  const baseStoneDry = baseS34Dry + baseS38Dry;

  const theoreticalWetS34 = mStone < 1 ? baseS34Dry / (1 - mStone) : baseS34Dry;
  const theoreticalWetS38 = mStone < 1 ? baseS38Dry / (1 - mStone) : baseS38Dry;
  const s34Total = Math.max(0, Math.round(theoreticalWetS34));
  const s38Total = Math.max(0, Math.round(theoreticalWetS38));

  const waterInStone = Math.round((s34Total + s38Total) * mStone);
  const replacementStone = mStone < 1 ? Math.round(waterInStone / (1 - mStone)) : 0;
  const waterInAggregates = waterInSand + waterInStone;

  // 4. Water calculations (calculated per full truck)
  const waterRateAdj = adj.waterPerYard !== undefined ? adj.waterPerYard : 0;
  const effDesignWaterRate = Math.max(0, master.designWater + waterRateAdj);
  const theoreticalFinalWater = Math.max(0, Math.round(effDesignWaterRate * volume));
  // Reduce water by the water in aggregates (sand + stone)
  const targetAddedWaterExact = Math.max(0, theoreticalFinalWater - waterInAggregates);
  
  // Plant operational rule: multiples of 50, rounded down
  const waterTruckAdj = adj.waterTruck !== undefined ? adj.waterTruck : (adj.water || 0);
  const targetAddedWater = Math.floor(targetAddedWaterExact / 50) * 50;
  const addedWater = Math.max(0, targetAddedWater + waterTruckAdj);
  const finalWater = addedWater + waterInAggregates;

  // 5. Water / Cement Ratio
  const wcRatio = cementTotal > 0 ? Math.round((finalWater / cementTotal) * 1000) / 1000 : 0;
  const wcTarget = effCementRate > 0 ? Math.round((effDesignWaterRate / effCementRate) * 1000) / 1000 : 0.50;
  
  let wcStatus: "Optimal" | "Acceptable" | "High" = "Optimal";
  if (wcRatio > wcTarget + 0.05) {
    wcStatus = "High";
  } else if (wcRatio > wcTarget) {
    wcStatus = "Acceptable";
  }

  // 6. Strength prediction curve (Abrams law / W/C power model) in PSI
  // Formula: strengthAdj = Math.pow(8, wcTypical - wcRatio)
  const wcTypical = cementProfile.wcTypical;
  const strengthAdj = Math.pow(8, wcTypical - wcRatio);

  // Derive target 28-day design PSI from mix or COA profile
  const parsedPSI = master.strength ? parseInt(master.strength.replace(/[^0-9]/g, ""), 10) : 0;
  const designPSI = parsedPSI && parsedPSI >= 1500 && parsedPSI <= 10000 ? parsedPSI : 3000;

  const s28d = Math.round((designPSI * strengthAdj) / 10) * 10;
  const s7d = Math.round((designPSI * 0.72 * strengthAdj) / 10) * 10;
  const s3d = Math.round((designPSI * 0.52 * strengthAdj) / 10) * 10;

  // 7. Estimated initial set time (reduced by 40% per plant specification)
  // Baseline before reduction: 210 mins (3.5 hrs) -> reduced by 40% to 126 mins (~2h 06m) at normal plant conditions (28°C)
  // Retarder extension: +15 mins per fl oz retarder/CYD
  // W/C extension: +15 mins per 0.05 excess W/C
  const retarderRatePerCYD = volume > 0 ? retTotal / volume : 0;
  const retarderDelayMins = retarderRatePerCYD * 15;
  const wcDelayMins = Math.max(0, (wcRatio - wcTarget) / 0.05) * 15;
  const rawSetMins = 210 + retarderDelayMins + wcDelayMins;
  // Apply 40% reduction (60% remaining time)
  const totalSetMins = Math.max(45, Math.round(rawSetMins * 0.60));

  const settingH = Math.floor(totalSetMins / 60);
  const settingM = totalSetMins % 60;
  const settingTimeFormatted = `${settingH}h ${settingM.toString().padStart(2, "0")}m`;

  // 8. Volumetric Yield & Paste Fraction using exact plant formula
  const cementVolM3 = cementTotal / (sg.cementSG * 1000);
  const waterVolM3 = finalWater / 1000;
  const sandDryVolM3 = baseSandDry / (sg.sandSG * 1000);
  const s34VolM3 = baseS34Dry / (sg.s34SG * 1000);
  const s38VolM3 = baseS38Dry / (sg.s38SG * 1000);
  const plVolM3 = (plTotal * 29.5735296) / 1000000;
  const retVolM3 = (retTotal * 29.5735296) / 1000000;

  const totalVolM3 =
    cementVolM3 +
    waterVolM3 +
    sandDryVolM3 +
    s34VolM3 +
    s38VolM3 +
    plVolM3 +
    retVolM3;

  // Exact Volumetric Batch Yield in CYD per plant formula
  const yieldCYD = Math.round(totalVolM3 * 1.30795 * 100) / 100;
  const yieldDiffRatio = volume > 0 ? (yieldCYD - volume) / volume : 0;

  // Paste Volume: Cement + Water + Admixtures
  const pasteVolM3 = cementVolM3 + waterVolM3 + plVolM3 + retVolM3;
  const pastePct = totalVolM3 > 0 ? Math.round((pasteVolM3 / totalVolM3) * 1000) / 10 : 28.0;
  let pasteStatus: "Lean" | "Normal" | "Rich" = "Normal";
  if (pastePct < 26.0) {
    pasteStatus = "Lean";
  } else if (pastePct > 34.0) {
    pasteStatus = "Rich";
  }

  let yieldStatus: "On Target" | "Under-yielding" | "Over-yielding" = "On Target";
  if (yieldDiffRatio < -0.02) {
    yieldStatus = "Under-yielding";
  } else if (yieldDiffRatio > 0.02) {
    yieldStatus = "Over-yielding";
  }

  // Aggregate Ratio (Sand % vs Stone %)
  const totalAggDry = baseSandDry + baseStoneDry;
  const sandPct = totalAggDry > 0 ? Math.round((baseSandDry / totalAggDry) * 100) : 55;
  const stonePct = 100 - sandPct;
  const aggregateRatioFormatted = `${sandPct}:${stonePct}`;

  return {
    cementTotal,
    sandTotal,
    s34Total,
    s38Total,
    plTotal,
    retTotal,
    addedWater,
    targetAddedWaterExact: Math.round(targetAddedWaterExact),
    finalWater,
    waterInSand,
    waterInStone,
    waterInAggregates,
    replacementSand,
    replacementStone,
    baseSandDry,
    baseStoneDry,
    aggregateRatio: {
      sandPct,
      stonePct,
      ratioFormatted: aggregateRatioFormatted,
    },
    wcRatio,
    wcTarget,
    wcStatus,
    settingH,
    settingM,
    settingTimeFormatted,
    strength: {
      s3d,
      s7d,
      s28d,
      strengthAdj: Math.round(strengthAdj * 100) / 100,
    },
    paste: {
      pastePct,
      pasteStatus,
    },
    yieldCYD,
    yieldStatus,
  };
}

export interface MixConversionInput {
  sourceMix: MasterRecipe;
  sourceVolume: number; // Volume currently in truck (CYD)
  targetMix: MasterRecipe;
  targetVolume: number; // Final target volume wanted in truck (CYD)
  sandMoisturePct?: number; // Stockpile sand moisture % (e.g. 2.0 or 3.0)
  stoneMoisturePct?: number; // Stockpile stone moisture % (e.g. 1.0)
  sourceAdjustments?: MaterialAdjustments;
  targetAdjustments?: MaterialAdjustments;
  pantry?: PantrySpecificGravities;
  cementCode?: string;
  sourceBatchedActuals?: {
    actualCement?: number;
    actualSandDry?: number;
    actualS34Dry?: number;
    actualS38Dry?: number;
    actualTotalWater?: number;
    actualPlasticizer?: number;
    actualRetarder?: number;
  };
}

export interface MaterialDelta {
  existing: number; // Amount currently in the drum
  targetRequired: number; // Total amount needed in final batch
  toAdd: number; // Non-negative amount to add into mixer: Math.max(0, target - existing)
  surplus: number; // If existing > target, excess in drum
  unit: string;
}

export interface MixConversionOutput {
  sourceVolume: number;
  targetVolume: number;
  addedVolume: number; // targetVolume - sourceVolume

  // What to dose into the mixer
  dosing: {
    cementKg: number;
    // Sand weighing (with moisture)
    drySandKg: number;
    wetSandToWeighKg: number;
    waterInAddedSandL: number;
    // Stone weighing
    dryS34Kg: number;
    wetS34ToWeighKg: number;
    dryS38Kg: number;
    wetS38ToWeighKg: number;
    waterInAddedStoneL: number;
    // Water dosing
    totalWaterNeededL: number;
    waterInAddedAggregatesL: number;
    targetWaterToMixerExactL: number;
    waterToMixerL: number; // Rounded down to 50 L
    // Admixtures
    plasticizerFlOz: number;
    retarderFlOz: number;
  };

  // Material-by-material breakdown
  materials: {
    cement: MaterialDelta;
    sandDry: MaterialDelta;
    stone34Dry: MaterialDelta;
    stone38Dry: MaterialDelta;
    totalWater: MaterialDelta;
    plasticizer: MaterialDelta;
    retarder: MaterialDelta;
  };

  // Resulting Converted Mix Physics vs Target Standard Mix
  analysis: {
    isExact1to1: boolean;
    hasSurplusCement: boolean;
    hasSurplusWater: boolean;
    notes: string[];

    // Target Standard Recipe metrics
    targetStandard: {
      cementPerYard: number;
      wcRatio: number;
      sandPct: number;
      stonePct: number;
      strengthPSI: number;
    };

    // Resulting Converted Concrete in Truck
    resulting: {
      totalCementKg: number;
      effectiveCementPerYard: number;
      totalWaterL: number;
      effectiveWaterPerYard: number;
      wcRatio: number;
      wcStatus: "Optimal" | "Acceptable" | "High";
      sandPct: number;
      stonePct: number;
      aggregateRatioFormatted: string;
      predictedStrength28dPSI: number;
      yieldCYD: number;
      yieldStatus: "On Target" | "Under-yielding" | "Over-yielding";
    };
  };
}

/**
 * Calculates exact material additions required to transform an existing drum load
 * (Source Mix & Volume) into a new target load (Target Mix & Total Volume).
 */
export function calculateMixConversion(input: MixConversionInput): MixConversionOutput {
  const {
    sourceMix,
    sourceVolume,
    targetMix,
    targetVolume,
    sandMoisturePct = 3.0,
    stoneMoisturePct = 1.0,
    sourceAdjustments = {},
    targetAdjustments = {},
    pantry = {},
    cementCode = "carib_type1",
    sourceBatchedActuals,
  } = input;

  const sg = { ...DEFAULT_PANTRY_SG, ...pantry };
  const cementProfile = DEFAULT_CEMENT_COAS[cementCode] || DEFAULT_CEMENT_COAS.carib_type1;
  const addedVolume = Math.max(0, targetVolume - sourceVolume);

  // 1. Effective Rates for Source & Target Mixes
  const srcCementRate = Math.max(0, sourceMix.cement + (sourceAdjustments.cementPerYard || 0));
  const srcSandRate = Math.max(0, sourceMix.sand + (sourceAdjustments.sandPerYard || 0));
  const srcS34Rate = Math.max(0, sourceMix.threeQuarterStone + (sourceAdjustments.threeQuarterStonePerYard || 0));
  const srcS38Rate = Math.max(0, (sourceMix.threeEighthStone || 0) + (sourceAdjustments.threeEighthStonePerYard || 0));
  const srcWaterRate = Math.max(0, sourceMix.designWater + (sourceAdjustments.waterPerYard || 0));
  const srcBasePl = (sourceMix.plasticizer || 0) >= 50 ? (sourceMix.plasticizer || 0) / 29.5735296 : (sourceMix.plasticizer || 0);
  const srcBaseRet = (sourceMix.retarder || 0) >= 50 ? (sourceMix.retarder || 0) / 29.5735296 : (sourceMix.retarder || 0);
  const srcPlRate = Math.max(0, srcBasePl + (sourceAdjustments.plasticizerPerYard || 0));
  const srcRetRate = Math.max(0, srcBaseRet + (sourceAdjustments.retarderPerYard || 0));

  const tgtCementRate = Math.max(0, targetMix.cement + (targetAdjustments.cementPerYard || 0));
  const tgtSandRate = Math.max(0, targetMix.sand + (targetAdjustments.sandPerYard || 0));
  const tgtS34Rate = Math.max(0, targetMix.threeQuarterStone + (targetAdjustments.threeQuarterStonePerYard || 0));
  const tgtS38Rate = Math.max(0, (targetMix.threeEighthStone || 0) + (targetAdjustments.threeEighthStonePerYard || 0));
  const tgtWaterRate = Math.max(0, targetMix.designWater + (targetAdjustments.waterPerYard || 0));
  const tgtBasePl = (targetMix.plasticizer || 0) >= 50 ? (targetMix.plasticizer || 0) / 29.5735296 : (targetMix.plasticizer || 0);
  const tgtBaseRet = (targetMix.retarder || 0) >= 50 ? (targetMix.retarder || 0) / 29.5735296 : (targetMix.retarder || 0);
  const tgtPlRate = Math.max(0, tgtBasePl + (targetAdjustments.plasticizerPerYard || 0));
  const tgtRetRate = Math.max(0, tgtBaseRet + (targetAdjustments.retarderPerYard || 0));

  // 2. Existing amounts in the drum (Source Load)
  const existingCement = sourceBatchedActuals?.actualCement ?? Math.round(srcCementRate * sourceVolume);
  const existingSandDry = sourceBatchedActuals?.actualSandDry ?? Math.round(srcSandRate * sourceVolume);
  const existingS34Dry = sourceBatchedActuals?.actualS34Dry ?? Math.round(srcS34Rate * sourceVolume);
  const existingS38Dry = sourceBatchedActuals?.actualS38Dry ?? Math.round(srcS38Rate * sourceVolume);
  const existingTotalWater = sourceBatchedActuals?.actualTotalWater ?? Math.round(srcWaterRate * sourceVolume);
  const existingPl = sourceBatchedActuals?.actualPlasticizer ?? Math.round(srcPlRate * sourceVolume);
  const existingRet = sourceBatchedActuals?.actualRetarder ?? Math.round(srcRetRate * sourceVolume);

  // 3. Target requirements for the entire target volume
  const targetRequiredCement = Math.round(tgtCementRate * targetVolume);
  const targetRequiredSandDry = Math.round(tgtSandRate * targetVolume);
  const targetRequiredS34Dry = Math.round(tgtS34Rate * targetVolume);
  const targetRequiredS38Dry = Math.round(tgtS38Rate * targetVolume);
  const targetRequiredTotalWater = Math.round(tgtWaterRate * targetVolume);
  const targetRequiredPl = Math.round(tgtPlRate * targetVolume);
  const targetRequiredRet = Math.round(tgtRetRate * targetVolume);

  // 4. Net Dry/Pure Materials to add (Non-negative)
  const cementToAdd = Math.max(0, targetRequiredCement - existingCement);
  const sandDryToAdd = Math.max(0, targetRequiredSandDry - existingSandDry);
  const s34DryToAdd = Math.max(0, targetRequiredS34Dry - existingS34Dry);
  const s38DryToAdd = Math.max(0, targetRequiredS38Dry - existingS38Dry);
  const plToAdd = Math.max(0, targetRequiredPl - existingPl);
  const retToAdd = Math.max(0, targetRequiredRet - existingRet);

  // 5. Aggregate moisture compensation & weighing
  const mSand = Math.max(0, sandMoisturePct) / 100;
  const wetSandToWeigh = mSand < 1 ? Math.round(sandDryToAdd / (1 - mSand)) : sandDryToAdd;
  const waterInAddedSand = Math.round(wetSandToWeigh * mSand);

  const mStone = Math.max(0, stoneMoisturePct) / 100;
  const wetS34ToWeigh = mStone < 1 ? Math.round(s34DryToAdd / (1 - mStone)) : s34DryToAdd;
  const wetS38ToWeigh = mStone < 1 ? Math.round(s38DryToAdd / (1 - mStone)) : s38DryToAdd;
  const waterInAddedStone = Math.round((wetS34ToWeigh + wetS38ToWeigh) * mStone);

  const waterInAddedAggregates = waterInAddedSand + waterInAddedStone;

  // 6. Water dosing
  const totalWaterNeeded = Math.max(0, targetRequiredTotalWater - existingTotalWater);
  const targetWaterToMixerExact = Math.max(0, totalWaterNeeded - waterInAddedAggregates);
  const waterToMixer = Math.floor(targetWaterToMixerExact / 50) * 50;

  // 7. Resulting Final Batched Masses in Drum
  const resultingCementTotal = existingCement + cementToAdd;
  const resultingSandDryTotal = existingSandDry + sandDryToAdd;
  const resultingS34DryTotal = existingS34Dry + s34DryToAdd;
  const resultingS38DryTotal = existingS38Dry + s38DryToAdd;
  const resultingWaterTotal = existingTotalWater + waterToMixer + waterInAddedAggregates;
  const resultingPlTotal = existingPl + plToAdd;
  const resultingRetTotal = existingRet + retToAdd;

  // 8. Resulting Physics, Yield & Quality Analysis
  const cementVolM3 = resultingCementTotal / (sg.cementSG * 1000);
  const waterVolM3 = resultingWaterTotal / 1000;
  const sandDryVolM3 = resultingSandDryTotal / (sg.sandSG * 1000);
  const s34VolM3 = resultingS34DryTotal / (sg.s34SG * 1000);
  const s38VolM3 = resultingS38DryTotal / (sg.s38SG * 1000);
  const plVolM3 = (resultingPlTotal * 29.5735296) / 1000000;
  const retVolM3 = (resultingRetTotal * 29.5735296) / 1000000;

  const totalVolM3 =
    cementVolM3 +
    waterVolM3 +
    sandDryVolM3 +
    s34VolM3 +
    s38VolM3 +
    plVolM3 +
    retVolM3;

  const yieldCYD = Math.round(totalVolM3 * 1.30795 * 100) / 100;
  const yieldDiffRatio = targetVolume > 0 ? (yieldCYD - targetVolume) / targetVolume : 0;

  let yieldStatus: "On Target" | "Under-yielding" | "Over-yielding" = "On Target";
  if (yieldDiffRatio < -0.02) yieldStatus = "Under-yielding";
  else if (yieldDiffRatio > 0.02) yieldStatus = "Over-yielding";

  const resultingWcRatio = resultingCementTotal > 0 ? Math.round((resultingWaterTotal / resultingCementTotal) * 1000) / 1000 : 0;
  const targetStandardWc = tgtCementRate > 0 ? Math.round((tgtWaterRate / tgtCementRate) * 1000) / 1000 : 0.50;

  let wcStatus: "Optimal" | "Acceptable" | "High" = "Optimal";
  if (resultingWcRatio > targetStandardWc + 0.05) wcStatus = "High";
  else if (resultingWcRatio > targetStandardWc) wcStatus = "Acceptable";

  // Strength Prediction (Abrams Law)
  const strengthAdj = Math.pow(8, cementProfile.wcTypical - resultingWcRatio);
  const parsedTargetPSI = targetMix.strength ? parseInt(targetMix.strength.replace(/[^0-9]/g, ""), 10) : 3000;
  const designPSI = parsedTargetPSI && parsedTargetPSI >= 1500 ? parsedTargetPSI : 3000;
  const predictedStrength28dPSI = Math.round((designPSI * strengthAdj) / 10) * 10;

  // Aggregate Ratio
  const totalAggDry = resultingSandDryTotal + (resultingS34DryTotal + resultingS38DryTotal);
  const sandPct = totalAggDry > 0 ? Math.round((resultingSandDryTotal / totalAggDry) * 100) : 55;
  const stonePct = 100 - sandPct;

  const targetTotalAgg = tgtSandRate + (tgtS34Rate + tgtS38Rate);
  const tgtSandPct = targetTotalAgg > 0 ? Math.round((tgtSandRate / targetTotalAgg) * 100) : 55;
  const tgtStonePct = 100 - tgtSandPct;

  // Discrepancy & Stoichiometry Analysis Notes
  const notes: string[] = [];
  const hasSurplusCement = existingCement > targetRequiredCement;
  const hasSurplusWater = existingTotalWater > targetRequiredTotalWater;

  if (hasSurplusCement) {
    const surplusKg = existingCement - targetRequiredCement;
    const effCementPerYd = Math.round(resultingCementTotal / targetVolume);
    notes.push(
      `⚡ Cement Surplus (+${surplusKg} kg): The drum contains more cement than standard ${targetMix.code}. Resulting cement content is ${effCementPerYd} kg/yd³ (target: ${tgtCementRate} kg/yd³), which delivers higher compressive strength.`
    );
  }

  if (hasSurplusWater) {
    const surplusL = existingTotalWater - targetRequiredTotalWater;
    notes.push(
      `💧 Water In Drum (+${surplusL} L): Source load had higher water than needed for target mix. No extra water added; W/C is ${resultingWcRatio}.`
    );
  }

  if (targetVolume === sourceVolume && sourceMix.id !== targetMix.id) {
    notes.push(
      `ℹ️ Same-Volume Mix Upgrade: Rebalancing ${sourceVolume} yd³ in place from ${sourceMix.code} to ${targetMix.code}.`
    );
  }

  const isExact1to1 = !hasSurplusCement && !hasSurplusWater && Math.abs(yieldDiffRatio) <= 0.015;

  return {
    sourceVolume,
    targetVolume,
    addedVolume,
    dosing: {
      cementKg: cementToAdd,
      drySandKg: sandDryToAdd,
      wetSandToWeighKg: wetSandToWeigh,
      waterInAddedSandL: waterInAddedSand,
      dryS34Kg: s34DryToAdd,
      wetS34ToWeighKg: wetS34ToWeigh,
      dryS38Kg: s38DryToAdd,
      wetS38ToWeighKg: wetS38ToWeigh,
      waterInAddedStoneL: waterInAddedStone,
      totalWaterNeededL: totalWaterNeeded,
      waterInAddedAggregatesL: waterInAddedAggregates,
      targetWaterToMixerExactL: targetWaterToMixerExact,
      waterToMixerL: waterToMixer,
      plasticizerFlOz: plToAdd,
      retarderFlOz: retToAdd,
    },
    materials: {
      cement: {
        existing: existingCement,
        targetRequired: targetRequiredCement,
        toAdd: cementToAdd,
        surplus: Math.max(0, existingCement - targetRequiredCement),
        unit: "kg",
      },
      sandDry: {
        existing: existingSandDry,
        targetRequired: targetRequiredSandDry,
        toAdd: sandDryToAdd,
        surplus: Math.max(0, existingSandDry - targetRequiredSandDry),
        unit: "kg dry",
      },
      stone34Dry: {
        existing: existingS34Dry,
        targetRequired: targetRequiredS34Dry,
        toAdd: s34DryToAdd,
        surplus: Math.max(0, existingS34Dry - targetRequiredS34Dry),
        unit: "kg dry",
      },
      stone38Dry: {
        existing: existingS38Dry,
        targetRequired: targetRequiredS38Dry,
        toAdd: s38DryToAdd,
        surplus: Math.max(0, existingS38Dry - targetRequiredS38Dry),
        unit: "kg dry",
      },
      totalWater: {
        existing: existingTotalWater,
        targetRequired: targetRequiredTotalWater,
        toAdd: waterToMixer + waterInAddedAggregates,
        surplus: Math.max(0, existingTotalWater - targetRequiredTotalWater),
        unit: "L",
      },
      plasticizer: {
        existing: existingPl,
        targetRequired: targetRequiredPl,
        toAdd: plToAdd,
        surplus: Math.max(0, existingPl - targetRequiredPl),
        unit: "fl oz",
      },
      retarder: {
        existing: existingRet,
        targetRequired: targetRequiredRet,
        toAdd: retToAdd,
        surplus: Math.max(0, existingRet - targetRequiredRet),
        unit: "fl oz",
      },
    },
    analysis: {
      isExact1to1,
      hasSurplusCement,
      hasSurplusWater,
      notes,
      targetStandard: {
        cementPerYard: tgtCementRate,
        wcRatio: targetStandardWc,
        sandPct: tgtSandPct,
        stonePct: tgtStonePct,
        strengthPSI: designPSI,
      },
      resulting: {
        totalCementKg: resultingCementTotal,
        effectiveCementPerYard: Math.round(resultingCementTotal / targetVolume),
        totalWaterL: resultingWaterTotal,
        effectiveWaterPerYard: Math.round(resultingWaterTotal / targetVolume),
        wcRatio: resultingWcRatio,
        wcStatus,
        sandPct,
        stonePct,
        aggregateRatioFormatted: `${sandPct}:${stonePct}`,
        predictedStrength28dPSI,
        yieldCYD,
        yieldStatus,
      },
    },
  };
}
