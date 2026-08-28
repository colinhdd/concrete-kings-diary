"use client";

import React, { useState, useMemo } from "react";
import {
  MixDesign,
  LoadRecord,
  MoistureReading,
  DEFAULT_MIX_DESIGNS,
} from "@/lib/db-batching";
import {
  calculateMixConversion,
  MixConversionOutput,
} from "@/lib/batching-engine";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Truck,
  RotateCcw,
  Info,
  Scale,
  Droplets,
  Layers,
} from "lucide-react";

interface MixConversionCalculatorProps {
  mixDesigns: MixDesign[];
  todaysLoads: LoadRecord[];
  currentSandMoisture?: MoistureReading | null;
  currentStoneMoisture?: MoistureReading | null;
  initialSourceLoad?: LoadRecord | null;
  onNavigateToDashboard?: () => void;
}

export default function MixConversionCalculator({
  mixDesigns,
  todaysLoads,
  currentSandMoisture,
  currentStoneMoisture,
  initialSourceLoad = null,
  onNavigateToDashboard,
}: MixConversionCalculatorProps) {
  // Mode: "manual" or "from-load"
  const [sourceMode, setSourceMode] = useState<"manual" | "from-load">(
    initialSourceLoad ? "from-load" : "manual"
  );
  const [selectedLoadId, setSelectedLoadId] = useState<string>(
    initialSourceLoad?.id || ""
  );

  const effectiveMixes = useMemo(() => {
    if (Array.isArray(mixDesigns) && mixDesigns.length > 0) return mixDesigns;
    return DEFAULT_MIX_DESIGNS;
  }, [mixDesigns]);

  // Selected Source Mix & Volume
  const [sourceMixId, setSourceMixId] = useState<string>(() => {
    if (initialSourceLoad?.mixDesignId) return initialSourceLoad.mixDesignId;
    return effectiveMixes.length > 0 ? effectiveMixes[0].id : "";
  });
  const [sourceVolume, setSourceVolume] = useState<number>(() => {
    if (initialSourceLoad?.quantity) return Number(initialSourceLoad.quantity);
    return 4.0;
  });

  // Selected Target Mix & Volume
  const [targetMixId, setTargetMixId] = useState<string>(() => {
    if (effectiveMixes.length > 1) return effectiveMixes[1].id;
    return effectiveMixes.length > 0 ? effectiveMixes[0].id : "";
  });
  const [targetVolume, setTargetVolume] = useState<number>(10.0);

  // Stockpile moisture percentages
  const sandMoisturePct = currentSandMoisture
    ? currentSandMoisture.percentage
    : 3.0;
  const stoneMoisturePct = currentStoneMoisture
    ? currentStoneMoisture.percentage
    : 1.0;

  // Selected source load record from today's list
  const activeSourceLoad = useMemo(() => {
    if (sourceMode !== "from-load" || !selectedLoadId) return null;
    return todaysLoads.find((l) => l.id === selectedLoadId) || null;
  }, [sourceMode, selectedLoadId, todaysLoads]);

  // Sync state if source load picked
  const handleSelectSourceLoad = (load: LoadRecord) => {
    setSelectedLoadId(load.id);
    setSourceMixId(load.mixDesignId);
    setSourceVolume(Number(load.quantity));
    // Default target volume to max(10, sourceVolume)
    if (targetVolume < Number(load.quantity)) {
      setTargetVolume(Math.max(10, Math.ceil(Number(load.quantity))));
    }
  };

  // Resolved Source & Target Mix Objects
  const sourceMix = useMemo(() => {
    return effectiveMixes.find((m) => m.id === sourceMixId) || effectiveMixes[0] || null;
  }, [effectiveMixes, sourceMixId]);

  const targetMix = useMemo(() => {
    return effectiveMixes.find((m) => m.id === targetMixId) || effectiveMixes[1] || effectiveMixes[0] || null;
  }, [effectiveMixes, targetMixId]);

  // Conversion Engine Output
  const conversionResult: MixConversionOutput | null = useMemo(() => {
    if (!sourceMix || !targetMix || sourceVolume <= 0 || targetVolume <= 0) {
      return null;
    }

    // If source load selected, pass batched actuals if available
    const sourceBatchedActuals = activeSourceLoad
      ? {
          actualCement: activeSourceLoad.actualCement,
          actualSandDry: activeSourceLoad.actualSand
            ? Math.round(
                activeSourceLoad.actualSand *
                  (1 - (activeSourceLoad.sandMoisturePercent || sandMoisturePct) / 100)
              )
            : undefined,
          actualS34Dry: activeSourceLoad.actualThreeQuarterStone,
          actualS38Dry: activeSourceLoad.actualThreeEighthStone,
          actualTotalWater: activeSourceLoad.actualBatchWater
            ? activeSourceLoad.actualBatchWater +
              Math.round(
                (activeSourceLoad.actualSand || sourceMix.sand * sourceVolume) *
                  ((activeSourceLoad.sandMoisturePercent || sandMoisturePct) / 100)
              )
            : undefined,
        }
      : undefined;

    return calculateMixConversion({
      sourceMix,
      sourceVolume,
      targetMix,
      targetVolume: Math.max(sourceVolume, targetVolume),
      sandMoisturePct,
      stoneMoisturePct,
      sourceBatchedActuals,
    });
  }, [
    sourceMix,
    sourceVolume,
    targetMix,
    targetVolume,
    sandMoisturePct,
    stoneMoisturePct,
    activeSourceLoad,
  ]);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "40px", display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              background: "rgba(59, 130, 246, 0.15)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#3b82f6",
            }}
          >
            <ArrowLeftRight size={18} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.1rem", fontWeight: "800", margin: 0 }}>
              Mix Conversion Calculator
            </h1>
            <p style={{ margin: "1px 0 0", color: "var(--text-muted)", fontSize: "0.72rem" }}>
              Calculate exact materials to add to a drum to upgrade, downgrade, or expand a load
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          {onNavigateToDashboard && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onNavigateToDashboard}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 10px",
                fontSize: "0.78rem",
                fontWeight: "700",
                minHeight: "34px",
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
        </div>
      </div>

      {/* Main Form Configuration Cards: Source & Target (Horizontal 2-Column Grid) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          alignItems: "stretch",
          marginBottom: "14px",
        }}
      >
        {/* Source Load Card */}
        <div
          style={{
            background: "var(--surface)",
            border: "1.5px solid rgba(239, 68, 68, 0.35)",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: "800",
                color: "#ef4444",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              1. Current Load in Drum
            </span>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "700" }}>
              Source Mix Design
            </label>
            <select
              value={sourceMixId}
              onChange={(e) => setSourceMixId(e.target.value)}
              className="input-field"
              style={{ width: "100%", padding: "8px 10px", fontSize: "0.88rem", fontWeight: "800", minHeight: "38px" }}
            >
              {effectiveMixes.map((mix) => (
                <option key={mix.id} value={mix.id}>
                  {mix.code} - {mix.strength || mix.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "700" }}>
              Current Volume (yd³)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0.5"
              max="12"
              value={sourceVolume}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setSourceVolume(val);
                if (targetVolume < val) setTargetVolume(val);
              }}
              className="input-field"
              style={{ width: "100%", padding: "8px 10px", fontSize: "1.05rem", fontWeight: "900", color: "#ef4444", minHeight: "38px" }}
            />
          </div>

          {sourceMix && (
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed var(--border)",
                borderRadius: "6px",
                padding: "6px 8px",
                fontSize: "0.72rem",
                color: "var(--text-muted)",
              }}
            >
              Base: {sourceMix.cement}kg cem &bull; {sourceMix.sand}kg sand &bull; {sourceMix.threeQuarterStone}kg stone &bull; {sourceMix.designWater}L water/yd³
            </div>
          )}
        </div>

        {/* Target Load Card */}
        <div
          style={{
            background: "var(--surface)",
            border: "1.5px solid rgba(34, 197, 94, 0.35)",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: "800",
                color: "#22c55e",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              2. Target Wanted Concrete
            </span>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "700" }}>
              Target Mix Design
            </label>
            <select
              value={targetMixId}
              onChange={(e) => setTargetMixId(e.target.value)}
              className="input-field"
              style={{ width: "100%", padding: "8px 10px", fontSize: "0.88rem", fontWeight: "800", minHeight: "38px" }}
            >
              {effectiveMixes.map((mix) => (
                <option key={mix.id} value={mix.id}>
                  {mix.code} - {mix.strength || mix.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "700" }}>
              Total Volume Wanted (yd³)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min={sourceVolume}
              max="12"
              value={targetVolume}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || sourceVolume;
                setTargetVolume(Math.max(sourceVolume, val));
              }}
              className="input-field"
              style={{ width: "100%", padding: "8px 10px", fontSize: "1.05rem", fontWeight: "900", color: "#22c55e", minHeight: "38px" }}
            />
          </div>

          {targetMix && (
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed var(--border)",
                borderRadius: "6px",
                padding: "6px 8px",
                fontSize: "0.72rem",
                color: "var(--text-muted)",
              }}
            >
              Base: {targetMix.cement}kg cem &bull; {targetMix.sand}kg sand &bull; {targetMix.threeQuarterStone}kg stone &bull; {targetMix.designWater}L water/yd³
            </div>
          )}
        </div>
      </div>

      {conversionResult && (
        <>
          {/* Main Dosing Card ("WHAT TO ADD TO MIXER") */}
          <div
            style={{
              background: "var(--surface)",
              border: "1.5px solid #3b82f6",
              borderRadius: "14px",
              padding: "16px",
              boxShadow: "0 4px 20px rgba(59, 130, 246, 0.12)",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "12px",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "10px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Sparkles size={18} color="#3b82f6" />
                  <h2 style={{ fontSize: "1.1rem", fontWeight: "800", margin: 0 }}>
                    MATERIALS TO ADD TO MIXER
                  </h2>
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Add these quantities to the drum to convert {sourceVolume} yd³ ({sourceMix?.code}) into {targetVolume} yd³ ({targetMix?.code})
                </div>
              </div>
            </div>

            {/* Dosing Grid (Horizontal layout on mobile and desktop) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "8px",
              }}
            >
              {/* 1. Cement */}
              <div
                style={{
                  background: "rgba(59, 130, 246, 0.08)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#60a5fa", textTransform: "uppercase" }}>
                  🏗️ Cement
                </div>
                <div style={{ fontSize: "1.35rem", fontWeight: "900", color: "var(--text-primary)", marginTop: "2px" }}>
                  {conversionResult.dosing.cementKg.toLocaleString()} <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>kg</span>
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  In drum: {conversionResult.materials.cement.existing} kg
                </div>
              </div>

              {/* 2. Sand (Scale Weighed) */}
              <div
                style={{
                  background: "rgba(249, 115, 22, 0.08)",
                  border: "1px solid rgba(249, 115, 22, 0.25)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#fb923c", textTransform: "uppercase" }}>
                  🏖️ Sand
                </div>
                <div style={{ fontSize: "1.35rem", fontWeight: "900", color: "var(--text-primary)", marginTop: "2px" }}>
                  {conversionResult.dosing.wetSandToWeighKg.toLocaleString()} <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>kg</span>
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Dry sand: {conversionResult.dosing.drySandKg} kg
                </div>
              </div>

              {/* 3. 3/4" Stone */}
              <div
                style={{
                  background: "rgba(34, 197, 94, 0.08)",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#4ade80", textTransform: "uppercase" }}>
                  🪨 ¾&quot; Stone
                </div>
                <div style={{ fontSize: "1.35rem", fontWeight: "900", color: "var(--text-primary)", marginTop: "2px" }}>
                  {conversionResult.dosing.wetS34ToWeighKg.toLocaleString()} <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>kg</span>
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Dry stone: {conversionResult.dosing.dryS34Kg} kg
                </div>
              </div>

              {/* 4. 3/8" Stone (if used) */}
              {conversionResult.dosing.dryS38Kg > 0 && (
                <div
                  style={{
                    background: "rgba(34, 197, 94, 0.08)",
                    border: "1px solid rgba(34, 197, 94, 0.25)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#4ade80", textTransform: "uppercase" }}>
                    🪨 ⅜&quot; Stone
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: "900", color: "var(--text-primary)", marginTop: "2px" }}>
                    {conversionResult.dosing.wetS38ToWeighKg.toLocaleString()} <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>kg</span>
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    Dry ⅜&quot;: {conversionResult.dosing.dryS38Kg} kg
                  </div>
                </div>
              )}

              {/* 5. Water To Mixer */}
              <div
                style={{
                  background: "rgba(59, 130, 246, 0.12)",
                  border: "1.5px solid #3b82f6",
                  borderRadius: "10px",
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#60a5fa", textTransform: "uppercase" }}>
                  💧 Added Water
                </div>
                <div style={{ fontSize: "1.45rem", fontWeight: "900", color: "#60a5fa", marginTop: "2px" }}>
                  {conversionResult.dosing.waterToMixerL} <span style={{ fontSize: "0.95rem", fontWeight: "700" }}>L</span>
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Net water: {conversionResult.dosing.totalWaterNeededL}L
                </div>
              </div>

              {/* 6. Plasticizer */}
              <div
                style={{
                  background: "rgba(168, 85, 247, 0.08)",
                  border: "1px solid rgba(168, 85, 247, 0.25)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#c084fc", textTransform: "uppercase" }}>
                  🧪 Plasticizer
                </div>
                <div style={{ fontSize: "1.35rem", fontWeight: "900", color: "var(--text-primary)", marginTop: "2px" }}>
                  {conversionResult.dosing.plasticizerFlOz} <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>fl oz</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#c084fc", fontWeight: "700", marginTop: "2px" }}>
                  {conversionResult.dosing.plasticizerMl.toLocaleString()} mL
                </div>
              </div>

              {/* 7. Retarder */}
              <div
                style={{
                  background: "rgba(234, 179, 8, 0.08)",
                  border: "1px solid rgba(234, 179, 8, 0.25)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#fde047", textTransform: "uppercase" }}>
                  ⏳ Retarder
                </div>
                <div style={{ fontSize: "1.35rem", fontWeight: "900", color: "var(--text-primary)", marginTop: "2px" }}>
                  {conversionResult.dosing.retarderFlOz} <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>fl oz</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#fde047", fontWeight: "700", marginTop: "2px" }}>
                  {conversionResult.dosing.retarderMl.toLocaleString()} mL
                </div>
              </div>
            </div>
          </div>

          {/* Analysis & Non 1-to-1 Discrepancy Report */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "20px",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <Scale size={18} color="#f59e0b" />
              <h3 style={{ fontSize: "1.1rem", fontWeight: "800", margin: 0 }}>
                Quality &amp; Stoichiometry Impact Analysis
              </h3>
            </div>

            {/* Alert Notices */}
            {conversionResult.analysis.notes.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                {conversionResult.analysis.notes.map((note, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "rgba(245, 158, 11, 0.12)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      fontSize: "0.85rem",
                      color: "#fbbf24",
                      lineHeight: "1.4",
                    }}
                  >
                    {note}
                  </div>
                ))}
              </div>
            )}

            {/* Comparison Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-secondary)" }}>
                    <th style={{ padding: "10px 12px" }}>Parameter</th>
                    <th style={{ padding: "10px 12px" }}>Standard Target ({targetMix?.code})</th>
                    <th style={{ padding: "10px 12px" }}>Resulting Converted Mix</th>
                    <th style={{ padding: "10px 12px" }}>Status / Impact</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: "700" }}>Cement Content</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>
                      {conversionResult.analysis.targetStandard.cementPerYard} kg/yd³
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: "700" }}>
                      {conversionResult.analysis.resulting.effectiveCementPerYard} kg/yd³
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {conversionResult.analysis.hasSurplusCement ? (
                        <span style={{ color: "#22c55e", fontWeight: "700" }}>+ Richer Mix (Extra Strength)</span>
                      ) : (
                        <span style={{ color: "#3b82f6" }}>Exact Target Match</span>
                      )}
                    </td>
                  </tr>

                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: "700" }}>Water/Cement (W/C) Ratio</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>
                      {conversionResult.analysis.targetStandard.wcRatio}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: "700" }}>
                      {conversionResult.analysis.resulting.wcRatio}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          color:
                            conversionResult.analysis.resulting.wcStatus === "Optimal"
                              ? "#22c55e"
                              : conversionResult.analysis.resulting.wcStatus === "Acceptable"
                              ? "#3b82f6"
                              : "#ef4444",
                          fontWeight: "700",
                        }}
                      >
                        {conversionResult.analysis.resulting.wcStatus}
                      </span>
                    </td>
                  </tr>

                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: "700" }}>Aggregate Ratio (Sand:Stone)</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>
                      {conversionResult.analysis.targetStandard.sandPct}:{conversionResult.analysis.targetStandard.stonePct}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: "700" }}>
                      {conversionResult.analysis.resulting.aggregateRatioFormatted}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>
                      Balanced
                    </td>
                  </tr>

                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: "700" }}>Predicted 28d Strength</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>
                      {conversionResult.analysis.targetStandard.strengthPSI.toLocaleString()} PSI
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: "800", color: "#22c55e" }}>
                      {conversionResult.analysis.resulting.predictedStrength28dPSI.toLocaleString()} PSI
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {conversionResult.analysis.resulting.predictedStrength28dPSI >=
                      conversionResult.analysis.targetStandard.strengthPSI ? (
                        <span style={{ color: "#22c55e", fontWeight: "700" }}>✓ Exceeds Design Strength</span>
                      ) : (
                        <span style={{ color: "#ef4444" }}>Below Design Target</span>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "10px 12px", fontWeight: "700" }}>Volumetric Yield</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>
                      {targetVolume} yd³
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: "700" }}>
                      {conversionResult.analysis.resulting.yieldCYD} yd³
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ color: "#3b82f6", fontWeight: "700" }}>
                        {conversionResult.analysis.resulting.yieldStatus}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
