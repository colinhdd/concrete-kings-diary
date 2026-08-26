"use client";

import React, { useMemo } from "react";
import {
  PlusCircle,
  Droplet,
  Copy,
  Clock,
  Calendar,
  Layers,
  ShieldCheck,
  Lock,
  Activity,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Wrench,
} from "lucide-react";
import { BatchingDay, MoistureReading, LoadRecord } from "@/lib/db-batching";
import ClockInGate from "./ClockInGate";

interface HomeScreenProps {
  batchingDay: BatchingDay | null;
  currentMoisture: MoistureReading;
  loadsCountToday: number;
  totalYardsToday: number;
  lastLoad: LoadRecord | null;
  todaysLoads?: LoadRecord[];
  onSelectLoad?: (load: LoadRecord) => void;
  unsyncedCount: number;
  isSyncing: boolean;
  onNewLoad: () => void;
  onRepeatLastLoad: () => void;
  onOpenMoistureModal: () => void;
  onViewTodaysLoads: () => void;
  onTriggerSync: () => void;
  onOpenBatchingDayModal: () => void;
  onDayUpdated?: (day: BatchingDay) => void;
}

export default function HomeScreen({
  batchingDay,
  currentMoisture,
  loadsCountToday,
  totalYardsToday,
  lastLoad,
  todaysLoads,
  onSelectLoad,
  unsyncedCount,
  isSyncing,
  onNewLoad,
  onRepeatLastLoad,
  onOpenMoistureModal,
  onViewTodaysLoads,
  onTriggerSync,
  onOpenBatchingDayModal,
  onDayUpdated,
}: HomeScreenProps) {
  const currentDateFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const isClockedIn = batchingDay && batchingDay.status === "open";

  const loadsList = useMemo(() => {
    if (todaysLoads && todaysLoads.length > 0) {
      return todaysLoads.filter((l) => !l.isVoid);
    }
    if (lastLoad && !lastLoad.isVoid) {
      return [lastLoad];
    }
    return [];
  }, [todaysLoads, lastLoad]);

  const conditionSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    loadsList.forEach((load) => {
      const obs = Array.isArray(load.concreteObservations) && load.concreteObservations.length > 0
        ? load.concreteObservations
        : ["Perfect"];
      obs.forEach((o) => {
        counts[o] = (counts[o] || 0) + 1;
      });
    });
    return Object.entries(counts).map(([label, count]) => {
      const isPerfect = label.toLowerCase() === "perfect" || label.toLowerCase() === "normal";
      return {
        label,
        count,
        isWarning: !isPerfect,
        isIssue: label.toLowerCase().includes("issue") || label.toLowerCase().includes("fail") || label.toLowerCase().includes("wet") || label.toLowerCase().includes("hot"),
      };
    });
  }, [loadsList]);

  const waterTrimCount = useMemo(() => {
    return loadsList.filter((l) => l.waterAdjustment !== 0).length;
  }, [loadsList]);

  const netWaterTrim = useMemo(() => {
    return loadsList.reduce((acc, l) => acc + (l.waterAdjustment || 0), 0);
  }, [loadsList]);

  const issueLoads = useMemo(() => {
    return loadsList.filter((load) => {
      const obs = Array.isArray(load.concreteObservations) && load.concreteObservations.length > 0
        ? load.concreteObservations
        : ["Perfect"];
      const hasConditionIssues = obs.some((o) => o.toLowerCase() !== "perfect" && o.toLowerCase() !== "normal");
      const hasWaterAdjustment = load.waterAdjustment !== 0;
      const hasBatchAdjustments = Array.isArray(load.batchAdjustments) && load.batchAdjustments.length > 0;
      const hasNotes = Boolean(load.batcherNotes && load.batcherNotes.trim());

      return hasConditionIssues || hasWaterAdjustment || hasBatchAdjustments || hasNotes;
    });
  }, [loadsList]);

  const issuesCount = useMemo(() => {
    return conditionSummary.filter((c) => c.isWarning).reduce((sum, c) => sum + c.count, 0);
  }, [conditionSummary]);

  // If not clocked in, show Clock-In Gatekeeper as the first screen before work starts
  if (!isClockedIn) {
    return <ClockInGate onClockedIn={onDayUpdated || (() => {})} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Shift Clock-In Status Banner */}
      <div
        className="glass-panel"
        style={{
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          backgroundColor: isClockedIn ? "rgba(16, 185, 129, 0.06)" : "rgba(245, 158, 11, 0.08)",
          borderLeft: isClockedIn ? "4px solid #10b981" : "4px solid #f59e0b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              backgroundColor: isClockedIn ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isClockedIn ? "#10b981" : "#f59e0b",
            }}
          >
            {isClockedIn ? <ShieldCheck size={24} /> : <Lock size={22} />}
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Calendar size={13} /> {currentDateFormatted}
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)" }}>
              {isClockedIn ? (
                <>
                  {batchingDay?.batcherName}{" "}
                  <span style={{ fontSize: "0.85rem", color: "#10b981", fontWeight: "700" }}>
                    &bull; Shift Active
                  </span>
                </>
              ) : (
                <span style={{ color: "#f59e0b" }}>Not Clocked In Today</span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenBatchingDayModal}
          className="btn-secondary"
          style={{
            fontSize: "0.85rem",
            padding: "8px 16px",
            fontWeight: "700",
            backgroundColor: isClockedIn ? "rgba(255,255,255,0.06)" : "#e05300",
            color: isClockedIn ? "var(--text-primary)" : "#fff",
            border: isClockedIn ? "1px solid var(--glass-border)" : "none",
          }}
        >
          {isClockedIn ? "Shift Details / Clock Out" : "Clock In Daily Shift"}
        </button>
      </div>

      {/* ================= PRIMARY ACTION: NEW LOAD ================= */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
        <button
          type="button"
          onClick={onNewLoad}
          style={{
            padding: "18px 16px",
            borderRadius: "16px",
            border: "none",
            background: "linear-gradient(135deg, #e05300 0%, #c2410c 100%)",
            color: "#fff",
            fontSize: "1.45rem",
            fontWeight: "900",
            fontFamily: "Outfit, sans-serif",
            letterSpacing: "0.02em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            boxShadow: "0 8px 28px rgba(224, 83, 0, 0.4)",
            transition: "transform 0.15s ease",
            minHeight: "56px",
          }}
        >
          <PlusCircle size={28} /> NEW LOAD
        </button>
      </div>

      {/* ================= TODAY'S ISSUE LOG ================= */}
      <div className="glass-panel" style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={20} color={issueLoads.length > 0 ? "#f59e0b" : "#10b981"} />
            <h3 style={{ fontSize: "1.05rem", fontWeight: "800", color: "var(--text-primary)", margin: 0 }}>
              Today&apos;s Issue Log
            </h3>
            {loadsList.length > 0 && (
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: "800",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  backgroundColor: issueLoads.length > 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                  color: issueLoads.length > 0 ? "#f59e0b" : "#10b981",
                  border: `1px solid ${issueLoads.length > 0 ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                }}
              >
                {issueLoads.length > 0 ? `${issueLoads.length} ${issueLoads.length === 1 ? "Issue / Report" : "Issues / Reports"}` : "0 Issues"}
              </span>
            )}
          </div>
        </div>

        {/* Feed of Issue / Condition / Water Change Reports */}
        {issueLoads.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {issueLoads.map((load) => {
              const obs = Array.isArray(load.concreteObservations) && load.concreteObservations.length > 0
                ? load.concreteObservations
                : ["Perfect"];
              const conditionIssues = obs.filter((o) => o.toLowerCase() !== "perfect" && o.toLowerCase() !== "normal");
              const hasNotes = Boolean(load.batcherNotes && load.batcherNotes.trim());
              const hasAdjs = Array.isArray(load.batchAdjustments) && load.batchAdjustments.length > 0;
              const hasWaterTrim = load.waterAdjustment !== 0;

              return (
                <div
                  key={load.id}
                  onClick={() => onSelectLoad && onSelectLoad(load)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "12px",
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1.5px solid rgba(245, 158, 11, 0.35)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    cursor: onSelectLoad ? "pointer" : "default",
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* Top: Issue & Water Ratio Badges (Focal Point) */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                    {conditionIssues.map((issue) => (
                      <span
                        key={issue}
                        style={{
                          padding: "4px 9px",
                          borderRadius: "7px",
                          fontSize: "0.78rem",
                          fontWeight: "800",
                          backgroundColor: "rgba(245, 158, 11, 0.18)",
                          color: "#f59e0b",
                          border: "1px solid rgba(245, 158, 11, 0.4)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <AlertTriangle size={13} /> {issue}
                      </span>
                    ))}

                    {hasWaterTrim && (
                      <span
                        style={{
                          padding: "4px 9px",
                          borderRadius: "7px",
                          fontSize: "0.78rem",
                          fontWeight: "800",
                          backgroundColor: load.waterAdjustment > 0 ? "rgba(245, 158, 11, 0.18)" : "rgba(59, 130, 246, 0.18)",
                          color: load.waterAdjustment > 0 ? "#f59e0b" : "#3b82f6",
                          border: `1px solid ${load.waterAdjustment > 0 ? "rgba(245, 158, 11, 0.35)" : "rgba(59, 130, 246, 0.35)"}`,
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Droplet size={13} /> Water Ratio Trim: {load.waterAdjustment > 0 ? `+${load.waterAdjustment}` : load.waterAdjustment} L
                      </span>
                    )}

                    {hasAdjs && load.batchAdjustments.map((adj, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: "4px 9px",
                          borderRadius: "7px",
                          fontSize: "0.78rem",
                          fontWeight: "800",
                          backgroundColor: "rgba(139, 92, 246, 0.15)",
                          color: "#8b5cf6",
                          border: "1px solid rgba(139, 92, 246, 0.35)",
                        }}
                      >
                        ⚙️ {adj.label || adj.optionId} {adj.value ? `(${adj.value}${adj.unit || ""})` : ""}
                      </span>
                    ))}

                    {Boolean(load.actionTaken || (load.actionsTaken && load.actionsTaken.length > 0)) && (
                      <span
                        style={{
                          padding: "4px 9px",
                          borderRadius: "7px",
                          fontSize: "0.78rem",
                          fontWeight: "800",
                          backgroundColor: "rgba(16, 185, 129, 0.18)",
                          color: "#10b981",
                          border: "1px solid rgba(16, 185, 129, 0.35)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Wrench size={12} /> Action: {load.actionTaken || load.actionsTaken?.join(", ")}
                      </span>
                    )}
                  </div>

                  {/* Footer: Timestamp & Click to View Associated Truck */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "6px",
                      paddingTop: "6px",
                      borderTop: "1px solid var(--glass-border)",
                    }}
                  >
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: "600" }}>
                      {load.time}
                    </span>
                    <span style={{ fontSize: "0.74rem", color: "#e05300", fontWeight: "700", display: "flex", alignItems: "center", gap: "2px" }}>
                      View Associated Truck →
                    </span>
                  </div>

                  {/* Batcher Remarks if any */}
                  {hasNotes && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontStyle: "italic", backgroundColor: "rgba(255, 255, 255, 0.03)", padding: "6px 10px", borderRadius: "6px" }}>
                      📝 &ldquo;{load.batcherNotes}&rdquo;
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : loadsList.length > 0 ? (
          <div
            style={{
              padding: "20px 16px",
              borderRadius: "12px",
              backgroundColor: "rgba(16, 185, 129, 0.06)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#10b981", fontWeight: "800", fontSize: "0.95rem" }}>
              <CheckCircle2 size={18} /> No Issues Logged Today
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", maxWidth: "420px" }}>
              All {loadsList.length} loads ({totalYardsToday} yd³) batched today are in standard condition with 0 reported issues.
            </div>
            <button
              type="button"
              onClick={onViewTodaysLoads}
              className="btn-secondary"
              style={{ marginTop: "6px", padding: "6px 14px", fontSize: "0.78rem", fontWeight: "700" }}
            >
              View All Trucks in Today&apos;s Loads
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: "0.9rem",
            }}
          >
            No loads batched yet for today. Tap <strong>NEW LOAD</strong> to record the first mixer truck.
          </div>
        )}
      </div>
    </div>
  );
}
