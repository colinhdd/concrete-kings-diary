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

  // Copy Ticket to Clipboard
  const [copied, setCopied] = useState(false);
  const handleCopyTicket = () => {
    if (!conversionResult || !sourceMix || !targetMix) return;
    const d = conversionResult.dosing;
    const text = `🔄 CONCRETE CONVERSION DOSING TICKET
From: ${sourceVolume} yd³ of ${sourceMix.code}
To Target: ${targetVolume} yd³ of ${targetMix.code}
Volume Added: +${conversionResult.addedVolume} yd³
---------------------------------
MATERIALS TO ADD TO MIXER:
• Cement: ${d.cementKg} kg
• Sand (Weighed @ ${sandMoisturePct}%): ${d.wetSandToWeighKg} kg (Dry: ${d.drySandKg} kg)
• 3/4" Stone (Weighed @ ${stoneMoisturePct}%): ${d.wetS34ToWeighKg} kg (Dry: ${d.dryS34Kg} kg)${
      d.dryS38Kg > 0 ? `\n• 3/8" Stone: ${d.wetS38ToWeighKg} kg` : ""
    }
• Water to Mixer: ${d.waterToMixerL} L
• Plasticizer: ${d.plasticizerFlOz} fl oz (${d.plasticizerMl.toLocaleString()} mL)
• Retarder: ${d.retarderFlOz} fl oz (${d.retarderMl.toLocaleString()} mL)
---------------------------------
RESULTING CONCRETE ANALYSIS:
• W/C Ratio: ${conversionResult.analysis.resulting.wcRatio} (${conversionResult.analysis.resulting.wcStatus})
• Cement Rate: ${conversionResult.analysis.resulting.effectiveCementPerYard} kg/yd³ (Target: ${targetMix.cement} kg/yd³)
• Predicted 28d Strength: ${conversionResult.analysis.resulting.predictedStrength28dPSI} PSI
• Sand:Stone Ratio: ${conversionResult.analysis.resulting.aggregateRatioFormatted}
Generated by Concrete Kings Jamaica`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "80px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "rgba(59, 130, 246, 0.15)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#3b82f6",
              }}
            >
              <ArrowLeftRight size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: "800", margin: 0, letterSpacing: "-0.02em" }}>
                Mix &amp; Volume Conversion Calculator
              </h1>
              <p style={{ margin: "2px 0 0", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                Calculate exact materials to add to a drum to upgrade, downgrade, or expand a load
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {onNavigateToDashboard && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onNavigateToDashboard}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "0.85rem",
                fontWeight: "700",
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
            >
              <ArrowLeft size={16} /> Back to Batching
            </button>
          )}
          <button
            type="button"
            className={`btn-secondary ${sourceMode === "from-load" ? "active" : ""}`}
            onClick={() => setSourceMode("from-load")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: sourceMode === "from-load" ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.05)",
              borderColor: sourceMode === "from-load" ? "#3b82f6" : "rgba(255,255,255,0.1)",
              color: sourceMode === "from-load" ? "#60a5fa" : "var(--text-primary)",
              padding: "8px 14px",
              fontSize: "0.85rem",
            }}
          >
            <Truck size={16} /> Pick from Today&apos;s Trucks
          </button>
          <button
            type="button"
            className={`btn-secondary ${sourceMode === "manual" ? "active" : ""}`}
            onClick={() => {
              setSourceMode("manual");
              setSelectedLoadId("");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: sourceMode === "manual" ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.05)",
              borderColor: sourceMode === "manual" ? "#3b82f6" : "rgba(255,255,255,0.1)",
              color: sourceMode === "manual" ? "#60a5fa" : "var(--text-primary)",
              padding: "8px 14px",
              fontSize: "0.85rem",
            }}
          >
            <Layers size={16} /> Custom Manual Entry
          </button>
        </div>
      </div>

      {/* Mode 1: Quick Pick from Today's Loads */}
      {sourceMode === "from-load" && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "20px",
          }}
        >
          <div style={{ fontSize: "0.85rem", fontWeight: "700", marginBottom: "12px", color: "var(--text-secondary)" }}>
            SELECT BATCHED TRUCK TO CONVERT:
          </div>
          {todaysLoads.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
              No loads batched today yet. Switch to &quot;Custom Manual Entry&quot; above to enter any mix and volume.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
              {todaysLoads
                .filter((l) => !l.isVoid)
                .map((load) => {
                  const isSelected = selectedLoadId === load.id;
                  return (
                    <button
                      key={load.id}
                      type="button"
                      onClick={() => handleSelectSourceLoad(load)}
                      style={{
                        textAlign: "left",
                        background: isSelected ? "rgba(59, 130, 246, 0.15)" : "rgba(255,255,255,0.02)",
                        border: isSelected ? "2px solid #3b82f6" : "1px solid var(--border)",
                        borderRadius: "10px",
                        padding: "12px 14px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "800", color: isSelected ? "#60a5fa" : "var(--text-primary)" }}>
                          🚛 {load.truckCode}
                        </span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            background: "rgba(255,255,255,0.08)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {load.time}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.88rem", fontWeight: "700", marginTop: "4px" }}>
                        {load.mixCode} &bull; {load.quantity} yd³
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        Batch #{load.batchNumber} {load.jobCode ? `• Job ${load.jobCode}` : ""}
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Main Form Configuration Cards: Source -> Target */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: "16px",
          alignItems: "stretch",
          marginBottom: "24px",
        }}
        className="conversion-config-grid"
      >
        {/* Source Load Card */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "14px",
            padding: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: "800",
                color: "#ef4444",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              1. CURRENT LOAD IN TRUCK
            </span>
            {activeSourceLoad && (
              <span style={{ fontSize: "0.75rem", color: "#60a5fa", fontWeight: "700" }}>
                Linked to #{activeSourceLoad.batchNumber}
              </span>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
              Source Mix Design
            </label>
            <select
              value={sourceMixId}
              onChange={(e) => setSourceMixId(e.target.value)}
              className="input-field"
              style={{ width: "100%", padding: "10px", fontSize: "0.95rem", fontWeight: "700" }}
            >
              {effectiveMixes.map((mix) => (
                <option key={mix.id} value={mix.id}>
                  {mix.code} - {mix.strength || mix.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
              Current Volume in Drum (yd³)
            </label>
            <input
              type="number"
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
              style={{ width: "100%", padding: "10px", fontSize: "1.1rem", fontWeight: "800" }}
            />
          </div>

          {sourceMix && (
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed var(--border)",
                borderRadius: "8px",
                padding: "10px 12px",
                fontSize: "0.78rem",
                color: "var(--text-muted)",
              }}
            >
              Base: {sourceMix.cement} kg cement &bull; {sourceMix.sand} kg sand &bull; {sourceMix.threeQuarterStone} kg stone &bull; {sourceMix.designWater} L water / yd³
            </div>
          )}
        </div>

        {/* Center Conversion Indicator Arrow */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "10px 4px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "rgba(59, 130, 246, 0.15)",
              border: "2px solid #3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#60a5fa",
            }}
          >
            <ArrowRight size={24} />
          </div>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "700" }}>CONVERT</span>
        </div>

        {/* Target Load Card */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "14px",
            padding: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: "800",
                color: "#22c55e",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              2. TARGET WANTED CONCRETE
            </span>
            <span style={{ fontSize: "0.75rem", color: "#22c55e", fontWeight: "700" }}>
              Final Target
            </span>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
              Target Mix Design
            </label>
            <select
              value={targetMixId}
              onChange={(e) => setTargetMixId(e.target.value)}
              className="input-field"
              style={{ width: "100%", padding: "10px", fontSize: "0.95rem", fontWeight: "700" }}
            >
              {effectiveMixes.map((mix) => (
                <option key={mix.id} value={mix.id}>
                  {mix.code} - {mix.strength || mix.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
              Final Total Volume Wanted (yd³)
            </label>
            <input
              type="number"
              step="0.5"
              min={sourceVolume}
              max="12"
              value={targetVolume}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || sourceVolume;
                setTargetVolume(Math.max(sourceVolume, val));
              }}
              className="input-field"
              style={{ width: "100%", padding: "10px", fontSize: "1.1rem", fontWeight: "800" }}
            />
          </div>

          {targetMix && (
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed var(--border)",
                borderRadius: "8px",
                padding: "10px 12px",
                fontSize: "0.78rem",
                color: "var(--text-muted)",
              }}
            >
              Base: {targetMix.cement} kg cement &bull; {targetMix.sand} kg sand &bull; {targetMix.threeQuarterStone} kg stone &bull; {targetMix.designWater} L water / yd³
            </div>
          )}
        </div>
      </div>

      {/* Stockpile Moisture Strip */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "10px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem" }}>
          <Droplets size={16} color="#3b82f6" />
          <span style={{ fontWeight: "700" }}>Active Stockpile Moisture Compensation:</span>
          <span style={{ color: "var(--text-secondary)" }}>
            Sand: <strong>{sandMoisturePct}%</strong> &bull; Stone: <strong>{stoneMoisturePct}%</strong>
          </span>
        </div>
        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Added aggregates and mixer water are auto-compensated for stockpile surface moisture.
        </span>
      </div>

      {conversionResult && (
        <>
          {/* Main Dosing Card ("WHAT TO ADD TO MIXER") */}
          <div
            style={{
              background: "var(--surface)",
              border: "2px solid #3b82f6",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 8px 32px rgba(59, 130, 246, 0.12)",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "20px",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "16px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Sparkles size={20} color="#3b82f6" />
                  <h2 style={{ fontSize: "1.3rem", fontWeight: "800", margin: 0 }}>
                    MATERIALS TO ADD TO MIXER
                  </h2>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Add these quantities to the drum to convert {sourceVolume} yd³ ({sourceMix?.code}) into {targetVolume} yd³ ({targetMix?.code})
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyTicket}
                className="btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  fontSize: "0.88rem",
                  fontWeight: "700",
                }}
              >
                {copied ? <Check size={16} color="#22c55e" /> : <Copy size={16} />}
                {copied ? "Copied Ticket!" : "Copy Dosing Sheet"}
              </button>
            </div>

            {/* Dosing Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              {/* 1. Cement */}
              <div
                style={{
                  background: "rgba(59, 130, 246, 0.08)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#60a5fa", textTransform: "uppercase" }}>
                  🏗️ Cement
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: "900", color: "var(--text-primary)", marginTop: "4px" }}>
                  {conversionResult.dosing.cementKg.toLocaleString()} <span style={{ fontSize: "1rem", fontWeight: "600" }}>kg</span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "6px" }}>
                  In drum: {conversionResult.materials.cement.existing} kg &bull; Target: {conversionResult.materials.cement.targetRequired} kg
                </div>
              </div>

              {/* 2. Sand (Scale Weighed) */}
              <div
                style={{
                  background: "rgba(249, 115, 22, 0.08)",
                  border: "1px solid rgba(249, 115, 22, 0.25)",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#fb923c", textTransform: "uppercase" }}>
                  🏖️ Sand (Weighed @ {sandMoisturePct}%)
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: "900", color: "var(--text-primary)", marginTop: "4px" }}>
                  {conversionResult.dosing.wetSandToWeighKg.toLocaleString()} <span style={{ fontSize: "1rem", fontWeight: "600" }}>kg</span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "6px" }}>
                  Dry sand: {conversionResult.dosing.drySandKg} kg (+{conversionResult.dosing.waterInAddedSandL}L water)
                </div>
              </div>

              {/* 3. 3/4" Stone */}
              <div
                style={{
                  background: "rgba(34, 197, 94, 0.08)",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#4ade80", textTransform: "uppercase" }}>
                  🪨 3/4&quot; Stone (Weighed @ {stoneMoisturePct}%)
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: "900", color: "var(--text-primary)", marginTop: "4px" }}>
                  {conversionResult.dosing.wetS34ToWeighKg.toLocaleString()} <span style={{ fontSize: "1rem", fontWeight: "600" }}>kg</span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "6px" }}>
                  Dry stone: {conversionResult.dosing.dryS34Kg} kg (+{conversionResult.dosing.waterInAddedStoneL}L water)
                </div>
              </div>

              {/* 4. 3/8" Stone (if used) */}
              {conversionResult.dosing.dryS38Kg > 0 && (
                <div
                  style={{
                    background: "rgba(34, 197, 94, 0.08)",
                    border: "1px solid rgba(34, 197, 94, 0.25)",
                    borderRadius: "12px",
                    padding: "16px",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#4ade80", textTransform: "uppercase" }}>
                    🪨 3/8&quot; Stone (Weighed)
                  </div>
                  <div style={{ fontSize: "1.9rem", fontWeight: "900", color: "var(--text-primary)", marginTop: "4px" }}>
                    {conversionResult.dosing.wetS38ToWeighKg.toLocaleString()} <span style={{ fontSize: "1rem", fontWeight: "600" }}>kg</span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "6px" }}>
                    Dry 3/8&quot;: {conversionResult.dosing.dryS38Kg} kg
                  </div>
                </div>
              )}

              {/* 5. Water To Mixer */}
              <div
                style={{
                  background: "rgba(59, 130, 246, 0.12)",
                  border: "2px solid #3b82f6",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#60a5fa", textTransform: "uppercase" }}>
                  💧 Added Water (To Mixer)
                </div>
                <div style={{ fontSize: "2.1rem", fontWeight: "900", color: "#60a5fa", marginTop: "4px" }}>
                  {conversionResult.dosing.waterToMixerL} <span style={{ fontSize: "1.1rem", fontWeight: "700" }}>L</span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "6px" }}>
                  Total net needed: {conversionResult.dosing.totalWaterNeededL}L &bull; In added aggs: -{conversionResult.dosing.waterInAddedAggregatesL}L
                </div>
              </div>

              {/* 6. Plasticizer */}
              <div
                style={{
                  background: "rgba(168, 85, 247, 0.08)",
                  border: "1px solid rgba(168, 85, 247, 0.25)",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#c084fc", textTransform: "uppercase" }}>
                  🧪 Plasticizer
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: "900", color: "var(--text-primary)", marginTop: "4px" }}>
                  {conversionResult.dosing.plasticizerFlOz} <span style={{ fontSize: "1rem", fontWeight: "600" }}>fl oz</span>
                </div>
                <div style={{ fontSize: "0.82rem", color: "#c084fc", fontWeight: "700", marginTop: "2px" }}>
                  {conversionResult.dosing.plasticizerMl.toLocaleString()} mL
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "6px" }}>
                  In drum: {conversionResult.materials.plasticizer.existing} oz &bull; Target: {conversionResult.materials.plasticizer.targetRequired} oz
                </div>
              </div>

              {/* 7. Retarder */}
              <div
                style={{
                  background: "rgba(234, 179, 8, 0.08)",
                  border: "1px solid rgba(234, 179, 8, 0.25)",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#fde047", textTransform: "uppercase" }}>
                  ⏳ Retarder
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: "900", color: "var(--text-primary)", marginTop: "4px" }}>
                  {conversionResult.dosing.retarderFlOz} <span style={{ fontSize: "1rem", fontWeight: "600" }}>fl oz</span>
                </div>
                <div style={{ fontSize: "0.82rem", color: "#fde047", fontWeight: "700", marginTop: "2px" }}>
                  {conversionResult.dosing.retarderMl.toLocaleString()} mL
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "6px" }}>
                  In drum: {conversionResult.materials.retarder.existing} oz &bull; Target: {conversionResult.materials.retarder.targetRequired} oz
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
