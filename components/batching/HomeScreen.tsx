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
      const rawObs = Array.isArray(load.concreteObservations)
        ? load.concreteObservations
        : load.concreteObservations
        ? [String(load.concreteObservations)]
        : [];

      // Filter out non-issue / normal states
      const actualIssues = rawObs.filter((o) => {
        const lower = o.trim().toLowerCase();
        return (
          lower !== "perfect" &&
          lower !== "normal" &&
          !lower.startsWith("normal (") &&
          lower !== "standard" &&
          lower !== "did not review" &&
          lower !== "ok" &&
          lower !== "good"
        );
      });

      const hasFlaggedIssues = actualIssues.length > 0;
      const hasActionTaken = Boolean(
        (load.actionsTaken && load.actionsTaken.length > 0) ||
        (load.actionTaken && load.actionTaken.trim() && load.actionTaken.toLowerCase() !== "none")
      );
      const hasReviewNotes = Boolean(load.batcherNotes && load.batcherNotes.trim());

      return hasFlaggedIssues || hasActionTaken || hasReviewNotes;
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
              const rawObs = Array.isArray(load.concreteObservations)
                ? load.concreteObservations
                : load.concreteObservations
                ? [String(load.concreteObservations)]
                : [];

              const actualIssues = rawObs.filter((o) => {
                const lower = o.trim().toLowerCase();
                return (
                  lower !== "perfect" &&
                  lower !== "normal" &&
                  !lower.startsWith("normal (") &&
                  lower !== "standard" &&
                  lower !== "did not review" &&
                  lower !== "ok" &&
                  lower !== "good"
                );
              });

              const isDidNotReview = rawObs.some((o) => o.trim().toLowerCase() === "did not review");
              const hasNotes = Boolean(load.batcherNotes && load.batcherNotes.trim());
              const actionsList = (load.actionsTaken && load.actionsTaken.length > 0)
                ? load.actionsTaken
                : load.actionTaken && load.actionTaken.trim() && load.actionTaken.toLowerCase() !== "none"
                ? [load.actionTaken]
                : [];

              return (
                <div
                  key={load.id}
                  onClick={() => onSelectLoad && onSelectLoad(load)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "14px",
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1.5px solid rgba(245, 158, 11, 0.4)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    cursor: onSelectLoad ? "pointer" : "default",
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* Card Header: Truck Identifier, Mix, Batch Number & Timestamp */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "1.05rem", fontWeight: "900", color: "var(--text-primary)" }}>
                        🚛 Truck {load.truckCode}
                      </span>
                      {load.batchNumber && (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(59, 130, 246, 0.15)",
                            color: "#3b82f6",
                            fontWeight: "800",
                            fontFamily: "Outfit, monospace",
                          }}
                        >
                          #{load.batchNumber}
                        </span>
                      )}
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "700" }}>
                        &bull; {load.mixCode} ({load.quantity} yd³)
                      </span>
                    </div>

                    <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: "600" }}>
                      {load.time}
                    </span>
                  </div>

                  {/* Review Flags & Actions Chips */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    {isDidNotReview && (
                      <span
                        style={{
                          padding: "5px 10px",
                          borderRadius: "8px",
                          fontSize: "0.82rem",
                          fontWeight: "800",
                          backgroundColor: "rgba(245, 158, 11, 0.18)",
                          color: "#f59e0b",
                          border: "1px solid rgba(245, 158, 11, 0.4)",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <AlertTriangle size={14} /> Did Not Review
                      </span>
                    )}

                    {actualIssues.map((issue) => (
                      <span
                        key={issue}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "8px",
                          fontSize: "0.82rem",
                          fontWeight: "800",
                          backgroundColor: "rgba(245, 158, 11, 0.18)",
                          color: "#f59e0b",
                          border: "1px solid rgba(245, 158, 11, 0.4)",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <AlertTriangle size={14} /> {issue}
                      </span>
                    ))}

                    {actionsList.map((action, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "8px",
                          fontSize: "0.82rem",
                          fontWeight: "800",
                          backgroundColor: "rgba(16, 185, 129, 0.18)",
                          color: "#10b981",
                          border: "1px solid rgba(16, 185, 129, 0.35)",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <Wrench size={13} /> {action.startsWith("Action:") ? action : `Action: ${action}`}
                      </span>
                    ))}
                  </div>

                  {/* Reviewer Remarks & Notes */}
                  {hasNotes && (
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-primary)",
                        backgroundColor: "rgba(255, 255, 255, 0.04)",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        borderLeft: "3px solid #e05300",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "0.95rem", flexShrink: 0 }}>💬</span>
                      <span style={{ fontStyle: "italic" }}>&ldquo;{load.batcherNotes}&rdquo;</span>
                    </div>
                  )}

                  {/* Footer Link */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      paddingTop: "6px",
                      borderTop: "1px solid var(--glass-border)",
                    }}
                  >
                    <span style={{ fontSize: "0.78rem", color: "#e05300", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}>
                      View Associated Truck →
                    </span>
                  </div>
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
