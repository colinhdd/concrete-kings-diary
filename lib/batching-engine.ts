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
  cementSG?: number; // default 3.15 (Carib Cement / ASTM C150 Type I)
  sandSG?: number; // default 2.62 (Natural siliceous / river sand)
  s34SG?: number; // default 2.65 (Crushed limestone 3/4")
  s38SG?: number; // default 2.65 (Crushed limestone 3/8")
  waterSG?: number; // default 1.00
  plasticizerSG?: number; // default 1.05
  retarderSG?: number; // default 1.15
  airTargetPct?: number; // default 1.0%
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
  sandSG: 2.62,
  s34SG: 2.65,
  s38SG: 2.65,
  waterSG: 1.00,
  plasticizerSG: 1.05,
  retarderSG: 1.15,
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

  // 8. Volumetric Yield & Paste Fraction using Pantry Specific Gravities
  // Absolute volume (m³): Mass (kg) / (SG * 1000 kg/m³)
  const cementVolM3 = cementTotal / (sg.cementSG * 1000);
  const waterVolM3 = finalWater / (sg.waterSG * 1000);
  const airVolM3 = (master.airTargetPct || sg.airTargetPct) / 100 * (volume * 0.764555); // estimated total volume
  
  const pasteVolM3 = cementVolM3 + waterVolM3 + airVolM3;

  const sandDryVolM3 = baseSandDry / (sg.sandSG * 1000);
  const s34VolM3 = baseS34Dry / (sg.s34SG * 1000);
  const s38VolM3 = baseS38Dry / (sg.s38SG * 1000);

  const totalVolM3 = pasteVolM3 + sandDryVolM3 + s34VolM3 + s38VolM3;
  
  // Paste volume fraction (%)
  const pastePct = totalVolM3 > 0 ? Math.round((pasteVolM3 / totalVolM3) * 1000) / 10 : 28.0;
  let pasteStatus: "Lean" | "Normal" | "Rich" = "Normal";
  if (pastePct < 26.0) {
    pasteStatus = "Lean";
  } else if (pastePct > 34.0) {
    pasteStatus = "Rich";
  }

  // Actual Batch Yield in CYD (1 m³ = 1.30795 CYD)
  const yieldCYD = Math.round(totalVolM3 * 1.30795 * 100) / 100;
  const yieldDiffRatio = volume > 0 ? (yieldCYD - volume) / volume : 0;
  
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
