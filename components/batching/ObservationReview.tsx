"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ClipboardCheck,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Mic,
  Save,
  Archive,
  Clock,
  Check,
  FastForward,
  Gauge,
  Minus,
  Plus,
  ArrowLeft,
  ChevronRight,
  Wrench,
  Sparkles,
  Ticket,
} from "lucide-react";
import {
  LoadRecord,
  ObservationOption,
  AdjustmentOption,
  updateLoad,
} from "@/lib/db-batching";

export function getSlumpMonicker(slump: number): {
  monicker: "Stiff" | "Normal" | "Soft" | "Very Soft";
  description: string;
  badgeColor: string;
  bgColor: string;
  tag: string;
} {
  if (slump < 4.0) {
    return {
      monicker: "Stiff",
      description: "Low Slump • Stiff / Dry Consistency",
      badgeColor: "#3b82f6",
      bgColor: "rgba(59, 130, 246, 0.18)",
      tag: `Stiff (${slump}")`,
    };
  } else if (slump <= 6.0) {
    return {
      monicker: "Normal",
      description: "Target Slump • Normal Workability",
      badgeColor: "#10b981",
      bgColor: "rgba(16, 185, 129, 0.18)",
      tag: `Normal (${slump}")`,
    };
  } else if (slump <= 7.5) {
    return {
      monicker: "Soft",
      description: "High Slump • Soft / Wet Consistency",
      badgeColor: "#f59e0b",
      bgColor: "rgba(245, 158, 11, 0.18)",
      tag: `Soft (${slump}")`,
    };
  } else {
    return {
      monicker: "Very Soft",
      description: "Excessive Slump • Segregation Risk",
      badgeColor: "#ef4444",
      bgColor: "rgba(239, 68, 68, 0.18)",
      tag: `Very Soft (${slump}")`,
    };
  }
}

const ACTION_OPTIONS = [
  "Added Water",
  "Added Plasticizer",
  "Added Retarder",
  "Added Sand",
  "Added Cement",
  "Run Out / Discharged",
  "Mixed Extra 5 Mins",
  "Dispatched As-Is",
  "Rejected / Dumped",
];

interface ObservationReviewProps {
  todaysLoads: LoadRecord[];
  observationOptions: ObservationOption[];
  adjustmentOptions: AdjustmentOption[];
  onLoadUpdated: (load: LoadRecord) => void;
  batcherName: string;
  batcherId: string;
  onNavigateToDashboard?: () => void;
}

export default function ObservationReview({
  todaysLoads,
  observationOptions,
  adjustmentOptions,
  onLoadUpdated,
  batcherName,
  batcherId,
}: ObservationReviewProps) {
  const activeLoads = useMemo(() => {
    return todaysLoads.filter((l) => !l.isVoid);
  }, [todaysLoads]);

  // Separate loads into "Yet to be reviewed" (Pending) and "Reviewed / Archived"
  const pendingLoads = useMemo(() => {
    return activeLoads.filter((l) => {
      if (l.isReviewed === true) return false;
      if (l.isReviewed === false) return true;
      const obs = l.concreteObservations || [];
      return obs.length === 0 || obs.includes("Pending Review");
    });
  }, [activeLoads]);

  const archivedLoads = useMemo(() => {
    return activeLoads.filter((l) => !pendingLoads.some((p) => p.id === l.id));
  }, [activeLoads, pendingLoads]);

  // Active view: 'pending' or 'archived'
  const [viewMode, setViewMode] = useState<"pending" | "archived">("pending");

  // Actively selected load for review (null = showing the full-width list)
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);

  const selectedLoad = useMemo(() => {
    if (!selectedLoadId) return null;
    return activeLoads.find((l) => l.id === selectedLoadId) || null;
  }, [activeLoads, selectedLoadId]);

  // Slump & Monicker State (Default 5.0 inches)
  const [assumedSlump, setAssumedSlump] = useState<number>(5.0);
  const derivedSlumpMonicker = useMemo(() => getSlumpMonicker(assumedSlump), [assumedSlump]);

  // Observation Form State
  const [ticketNumber, setTicketNumber] = useState<string>("");
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [selectedObs, setSelectedObs] = useState<string[]>([]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [actionDetails, setActionDetails] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isListeningSpeech, setIsListeningSpeech] = useState<boolean>(false);

  // Sync form state when selected load changes
  useEffect(() => {
    if (selectedLoad) {
      setTicketNumber(selectedLoad.ticketNumber || "");
      setTicketError(null);

      if (selectedLoad.observedSlumpInches !== undefined) {
        setAssumedSlump(selectedLoad.observedSlumpInches);
      } else {
        setAssumedSlump(5.0);
      }

      const obs = Array.isArray(selectedLoad.concreteObservations)
        ? selectedLoad.concreteObservations.filter(
            (o) =>
              o !== "Pending Review" &&
              !o.startsWith("Stiff (") &&
              !o.startsWith("Normal (") &&
              !o.startsWith("Soft (") &&
              !o.startsWith("Very Soft (")
          )
        : [];
      setSelectedObs(obs);

      const actions = Array.isArray(selectedLoad.actionsTaken) ? selectedLoad.actionsTaken : [];
      setSelectedActions(actions);
      setActionDetails(selectedLoad.actionTaken || "");
      setNotes(selectedLoad.batcherNotes || "");
      setSaveSuccess(null);
    }
  }, [selectedLoad]);

  const handleToggleObservation = (label: string) => {
    setSelectedObs((prev) => {
      if (prev.includes(label)) {
        return prev.filter((o) => o !== label);
      } else {
        return [...prev, label];
      }
    });
  };

  const handleToggleAction = (action: string) => {
    setSelectedActions((prev) => {
      if (prev.includes(action)) {
        return prev.filter((a) => a !== action);
      } else {
        return [...prev, action];
      }
    });
  };

  const handleVoiceDictation = (target: "notes" | "action") => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListeningSpeech(true);
      recognition.onend = () => setIsListeningSpeech(false);
      recognition.onerror = () => setIsListeningSpeech(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (target === "action") {
          setActionDetails((prev) => (prev ? `${prev} ${transcript}` : transcript));
        } else {
          setNotes((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.start();
    } catch {
      setIsListeningSpeech(false);
    }
  };

  const handleSaveObservation = async (overrideSlump?: number, overrideObs?: string[], overrideActions?: string[]) => {
    if (!selectedLoad) return;

    // Validate mandatory 6-digit ticket number
    const cleanTicket = ticketNumber.replace(/\D/g, "").slice(0, 6);
    if (cleanTicket.length !== 6) {
      setTicketError("A 6-digit delivery ticket number is required to review this load (e.g. 102458).");
      alert("Please enter a valid 6-digit delivery ticket number before saving this review.");
      return;
    }

    setIsSaving(true);
    try {
      const finalSlump = overrideSlump !== undefined ? overrideSlump : assumedSlump;
      const monickerInfo = getSlumpMonicker(finalSlump);
      const rawObs = overrideObs !== undefined ? overrideObs : selectedObs;
      const rawActions = overrideActions !== undefined ? overrideActions : selectedActions;

      const finalObservations = [monickerInfo.tag, ...rawObs.filter((o) => o !== "Normal" && o !== "Perfect")];
      const finalActionSummary = actionDetails.trim()
        ? rawActions.length > 0
          ? `${rawActions.join(", ")} • ${actionDetails.trim()}`
          : actionDetails.trim()
        : rawActions.join(", ");

      const updated = await updateLoad(
        selectedLoad.id,
        {
          ticketNumber: cleanTicket,
          observedSlumpInches: finalSlump,
          concreteObservations: finalObservations,
          actionsTaken: rawActions,
          actionTaken: finalActionSummary,
          batcherNotes: notes.trim(),
          isReviewed: true,
          reviewedAt: Date.now(),
          reviewedBy: batcherName,
        },
        batcherName,
        batcherId,
        `Reviewed Ticket #${cleanTicket} • Recorded slump ${finalSlump}" (${monickerInfo.monicker}) & action: ${finalActionSummary || "None"}`
      );

      if (updated) {
        onLoadUpdated(updated);
        setSaveSuccess(`✓ Truck ${selectedLoad.truckCode} reviewed and archived!`);
        setTimeout(() => {
          setSaveSuccess(null);
          setSelectedLoadId(null); // Return to full-width queue
        }, 800);
      }
    } catch (err: any) {
      alert(`Failed to save observation: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickDidNotReview = async () => {
    if (!selectedLoad) return;
    setIsSaving(true);
    try {
      const updated = await updateLoad(
        selectedLoad.id,
        {
          concreteObservations: ["Did Not Review"],
          batcherNotes: notes.trim(),
          actionTaken: "",
          actionsTaken: [],
          isReviewed: true,
          reviewedAt: Date.now(),
          reviewedBy: batcherName,
        },
        batcherName,
        batcherId,
        "Marked truck as: Did Not Review"
      );

      if (updated) {
        onLoadUpdated(updated);
        setSaveSuccess(`Truck ${selectedLoad.truckCode} marked as Did Not Review.`);
        setTimeout(() => {
          setSaveSuccess(null);
          setSelectedLoadId(null);
        }, 800);
      }
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Visual observation options available for selection
  const visualIssueOptions = useMemo(() => {
    return observationOptions.filter((obs) => {
      const l = obs.label.toLowerCase();
      return (
        obs.active &&
        l !== "normal" &&
        l !== "perfect"
      );
    });
  }, [observationOptions]);

  const SLUMP_PRESETS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  if (activeLoads.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: "36px 20px", textAlign: "center" }}>
        <ClipboardCheck size={48} color="#e05300" style={{ margin: "0 auto 12px" }} />
        <h3 style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--text-primary)", margin: "0 0 6px" }}>
          No Batched Trucks Available for Review
        </h3>
        <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", maxWidth: "420px", margin: "0 auto" }}>
          Batch a new mixer truck first. Once a truck is logged, it will appear here in the queue for visual concrete observation and quality review.
        </p>
      </div>
    );
  }

  // ================= SCENARIO A: TRUCK IS ACTIVELY BEING REVIEWED (FULL-WIDTH FORM) =================
  if (selectedLoad) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "720px", margin: "0 auto", width: "100%" }}>
        {/* Top Back Navigation & Truck Summary Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedLoadId(null)}
            className="btn-secondary"
            style={{
              padding: "10px 16px",
              fontSize: "0.9rem",
              fontWeight: "800",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <ArrowLeft size={16} /> Back to Trucks Queue
          </button>

          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: "800",
              padding: "4px 10px",
              borderRadius: "8px",
              backgroundColor: "rgba(224, 83, 0, 0.15)",
              color: "#e05300",
            }}
          >
            Reviewing Truck
          </span>
        </div>

        {/* Full-Width Review Card */}
        <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Active Truck Header Banner */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "12px",
              backgroundColor: "var(--bg-tertiary)",
              border: "1.5px solid var(--glass-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.3rem", fontWeight: "900", color: "var(--text-primary)", fontFamily: "Outfit, monospace" }}>
                  🚚 {selectedLoad.truckCode}
                </span>
                <span style={{ fontSize: "1.05rem", fontWeight: "800", color: "#e05300" }}>
                  {selectedLoad.mixCode}
                </span>
                <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  ({selectedLoad.quantity} yd³)
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "3px" }}>
                Batch #{selectedLoad.batchNumber} &bull; Batched at {selectedLoad.time}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", textTransform: "uppercase", display: "block" }}>
                Batch Water
              </span>
              <span style={{ fontSize: "1.15rem", fontWeight: "800", color: "#3b82f6" }}>
                {selectedLoad.actualBatchWater} L
              </span>
            </div>
          </div>

          {/* Quick "Did Not Review" Action at Top */}
          <button
            type="button"
            onClick={handleQuickDidNotReview}
            disabled={isSaving}
            className="btn-secondary"
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: "0.88rem",
              fontWeight: "800",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              color: "var(--text-secondary)",
              backgroundColor: "var(--bg-tertiary)",
              border: "1.5px dashed var(--glass-border)",
              borderRadius: "12px",
              cursor: isSaving ? "not-allowed" : "pointer",
            }}
          >
            Did Not Review
          </button>

          {/* ================= MANDATORY 6-DIGIT DELIVERY TICKET NUMBER ================= */}
          <div
            style={{
              padding: "16px",
              borderRadius: "14px",
              backgroundColor: "var(--bg-secondary)",
              border: ticketError ? "2px solid #ef4444" : "1.5px solid var(--glass-border)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "0.92rem", fontWeight: "800", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Ticket size={18} color="#e05300" /> Delivery Ticket # <span style={{ color: "#ef4444", fontSize: "0.82rem" }}>* (6 Digits Required)</span>
              </label>
              <span style={{ fontSize: "0.8rem", fontWeight: "800", color: ticketNumber.length === 6 ? "#10b981" : "#f59e0b" }}>
                {ticketNumber.length === 6 ? "✓ Complete" : `${ticketNumber.length}/6 Digits`}
              </span>
            </div>

            <div style={{ position: "relative" }}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="form-input"
                value={ticketNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setTicketNumber(val);
                  if (val.length === 6) {
                    setTicketError(null);
                  }
                }}
                placeholder="e.g. 102458"
                style={{
                  fontSize: "1.4rem",
                  fontWeight: "900",
                  letterSpacing: "4px",
                  textAlign: "center",
                  padding: "12px",
                  fontFamily: "Outfit, monospace",
                  border: ticketError ? "1.5px solid #ef4444" : "1.5px solid #e05300",
                  borderRadius: "10px",
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  width: "100%",
                }}
              />
            </div>

            {ticketError ? (
              <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#ef4444", display: "flex", alignItems: "center", gap: "5px" }}>
                <AlertTriangle size={14} /> {ticketError}
              </div>
            ) : (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Input the 6-digit physical delivery ticket number printed for this batch.
              </div>
            )}
          </div>

          {/* ================= 1. ASSUMED SLUMP & DERIVED CONSISTENCY (SOFT / STIFF) ================= */}
          <div
            style={{
              padding: "16px",
              borderRadius: "14px",
              backgroundColor: "var(--bg-secondary)",
              border: `1.5px solid ${derivedSlumpMonicker.badgeColor}50`,
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Gauge size={18} color={derivedSlumpMonicker.badgeColor} />
                <span style={{ fontSize: "0.95rem", fontWeight: "800", color: "var(--text-primary)" }}>
                  Assumed / Observed Slump
                </span>
              </div>

              {/* Derived Monicker Badge */}
              <div
                style={{
                  padding: "6px 14px",
                  borderRadius: "10px",
                  backgroundColor: derivedSlumpMonicker.bgColor,
                  color: derivedSlumpMonicker.badgeColor,
                  fontSize: "0.9rem",
                  fontWeight: "900",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  border: `1px solid ${derivedSlumpMonicker.badgeColor}40`,
                }}
              >
                <span>{derivedSlumpMonicker.monicker.toUpperCase()}: {assumedSlump.toFixed(1)}&quot;</span>
              </div>
            </div>

            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {derivedSlumpMonicker.description}
            </div>

            {/* Quick Slump Chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
              {SLUMP_PRESETS.map((preset) => {
                const isSelected = Math.abs(assumedSlump - preset) < 0.1;
                const info = getSlumpMonicker(preset);
                return (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => setAssumedSlump(preset)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "10px",
                      border: isSelected ? `2px solid ${info.badgeColor}` : "1px solid var(--glass-border)",
                      backgroundColor: isSelected ? info.bgColor : "var(--bg-tertiary)",
                      color: isSelected ? info.badgeColor : "var(--text-primary)",
                      fontWeight: "800",
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {preset}&quot;
                  </button>
                );
              })}

            </div>
          </div>

          {/* ================= 2. SPECIFIC VISUAL ANOMALIES & CONDITIONS ================= */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: "0.88rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "8px", display: "block" }}>
              Visual Concrete Observations (Tap to toggle)
            </label>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {visualIssueOptions.map((obs) => {
                const isSelected = selectedObs.includes(obs.label);

                return (
                  <button
                    type="button"
                    key={obs.id}
                    onClick={() => handleToggleObservation(obs.label)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "10px",
                      border: isSelected
                        ? "2px solid #e05300"
                        : "1px solid var(--glass-border)",
                      backgroundColor: isSelected
                        ? "rgba(224, 83, 0, 0.2)"
                        : "var(--bg-tertiary)",
                      color: isSelected
                        ? "#e05300"
                        : "var(--text-primary)",
                      fontWeight: "800",
                      fontSize: "0.88rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {isSelected && "✓ "} {obs.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ================= 3. PLANT REMARKS & DISCHARGE NOTES (DIRECTLY BELOW OPTIONS) ================= */}
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-primary)" }}>
                Batcher Remarks &amp; Additional Notes (Optional)
              </label>
              <button
                type="button"
                onClick={() => handleVoiceDictation("notes")}
                className="btn-secondary"
                style={{
                  padding: "4px 10px",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  backgroundColor: isListeningSpeech ? "rgba(239, 68, 68, 0.2)" : "var(--bg-tertiary)",
                  color: isListeningSpeech ? "#ef4444" : "var(--text-secondary)",
                }}
              >
                <Mic size={14} className={isListeningSpeech ? "animate-pulse" : ""} />
                {isListeningSpeech ? "Listening..." : "Voice Mic"}
              </button>
            </div>

            <textarea
              className="form-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Slump checked at chute, driver instructed to mix 5 mins..."
              style={{ fontSize: "0.95rem" }}
            />
          </div>

          {/* ================= 4. WHAT WAS DONE (ACTION TAKEN / RESOLUTION) ================= */}
          <div
            style={{
              padding: "16px",
              borderRadius: "14px",
              backgroundColor: "rgba(16, 185, 129, 0.06)",
              border: "1.5px solid rgba(16, 185, 129, 0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Wrench size={16} color="#10b981" />
                <span style={{ fontSize: "0.88rem", fontWeight: "800", color: "var(--text-primary)" }}>
                  Action Taken / Resolution (&ldquo;What Was Done&rdquo;)
                </span>
              </div>
              <span style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: "700" }}>
                {selectedActions.length > 0 ? `${selectedActions.length} selected` : "Optional"}
              </span>
            </div>

            {/* Quick Action Chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {ACTION_OPTIONS.map((action) => {
                const isSelected = selectedActions.includes(action);
                return (
                  <button
                    type="button"
                    key={action}
                    onClick={() => handleToggleAction(action)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "8px",
                      border: isSelected ? "2px solid #10b981" : "1px solid var(--glass-border)",
                      backgroundColor: isSelected ? "rgba(16, 185, 129, 0.22)" : "var(--bg-tertiary)",
                      color: isSelected ? "#10b981" : "var(--text-primary)",
                      fontWeight: "800",
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {isSelected && "✓ "} {action}
                  </button>
                );
              })}
            </div>

            {/* Action Details Input */}
            <div style={{ marginTop: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: "600" }}>
                  Resolution Details &amp; Amounts (e.g. Discharged 0.5 yd³, added 20 oz chem...)
                </label>
                <button
                  type="button"
                  onClick={() => handleVoiceDictation("action")}
                  className="btn-secondary"
                  style={{
                    padding: "3px 8px",
                    fontSize: "0.72rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    backgroundColor: isListeningSpeech ? "rgba(239, 68, 68, 0.2)" : "var(--bg-tertiary)",
                    color: isListeningSpeech ? "#ef4444" : "var(--text-secondary)",
                  }}
                >
                  <Mic size={12} className={isListeningSpeech ? "animate-pulse" : ""} />
                  Voice
                </button>
              </div>
              <input
                type="text"
                className="form-input"
                value={actionDetails}
                onChange={(e) => setActionDetails(e.target.value)}
                placeholder="e.g. Added 20L water, ran out 0.5 yd³ into pit, adjusted water for next load"
                style={{ fontSize: "0.88rem", padding: "10px 12px" }}
              />
            </div>
          </div>

          {/* Success feedback */}
          {saveSuccess && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "10px",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                color: "#10b981",
                fontSize: "0.9rem",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <CheckCircle2 size={18} /> {saveSuccess}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "6px" }}>
            <button
              type="button"
              onClick={() => handleSaveObservation()}
              disabled={isSaving}
              style={{
                width: "100%",
                padding: "16px 20px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff",
                fontSize: "1.1rem",
                fontWeight: "900",
                fontFamily: "Outfit, sans-serif",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 6px 20px rgba(16, 185, 129, 0.35)",
              }}
            >
              <Save size={20} /> {isSaving ? "Saving..." : `SAVE & ARCHIVE REVIEW (${derivedSlumpMonicker.monicker.toUpperCase()})`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= SCENARIO B: LIST VIEW (FULL-WIDTH QUEUE OF TRUCKS) =================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "840px", margin: "0 auto", width: "100%" }}>
      {/* Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          borderLeft: "4px solid #10b981",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ClipboardCheck size={22} color="#10b981" />
            <h2 style={{ fontSize: "1.25rem", fontWeight: "900", color: "var(--text-primary)", margin: 0 }}>
              Concrete Quality &amp; Truck Review
            </h2>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Select a truck to record visual condition, slump, and resolutions (&ldquo;What was done&rdquo;).
          </p>
        </div>

        {/* View Toggle Tabs */}
        <div style={{ display: "flex", gap: "6px", backgroundColor: "var(--bg-tertiary)", padding: "4px", borderRadius: "10px" }}>
          <button
            type="button"
            onClick={() => setViewMode("pending")}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: viewMode === "pending" ? "#e05300" : "transparent",
              color: viewMode === "pending" ? "#fff" : "var(--text-secondary)",
              fontSize: "0.82rem",
              fontWeight: "800",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>Yet to Review</span>
            <span
              style={{
                fontSize: "0.72rem",
                padding: "1px 6px",
                borderRadius: "10px",
                backgroundColor: viewMode === "pending" ? "rgba(255,255,255,0.25)" : "rgba(245, 158, 11, 0.2)",
                color: viewMode === "pending" ? "#fff" : "#f59e0b",
                fontWeight: "900",
              }}
            >
              {pendingLoads.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("archived")}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: viewMode === "archived" ? "#10b981" : "transparent",
              color: viewMode === "archived" ? "#fff" : "var(--text-secondary)",
              fontSize: "0.82rem",
              fontWeight: "800",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <Archive size={14} />
            <span>Archived</span>
            <span
              style={{
                fontSize: "0.72rem",
                padding: "1px 6px",
                borderRadius: "10px",
                backgroundColor: viewMode === "archived" ? "rgba(255,255,255,0.25)" : "rgba(16, 185, 129, 0.2)",
                color: viewMode === "archived" ? "#fff" : "#10b981",
                fontWeight: "900",
              }}
            >
              {archivedLoads.length}
            </span>
          </button>
        </div>
      </div>

      {/* Full-Width Queue List */}
      <div className="glass-panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "var(--text-secondary)", textTransform: "uppercase" }}>
            {viewMode === "pending" ? "Trucks Awaiting Quality Review" : "Archived / Reviewed Trucks"}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: "600" }}>
            {viewMode === "pending" ? `${pendingLoads.length} pending` : `${archivedLoads.length} archived`}
          </span>
        </div>

        {viewMode === "pending" && pendingLoads.length === 0 ? (
          <div
            style={{
              padding: "44px 20px",
              textAlign: "center",
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: "14px",
              border: "1px dashed var(--glass-border)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#10b981",
                marginBottom: "4px",
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: "900", color: "var(--text-primary)" }}>
              All Trucks Reviewed!
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "420px", margin: "0 0 10px" }}>
              No pending trucks awaiting quality review.
            </p>
            {archivedLoads.length > 0 && (
              <button
                type="button"
                onClick={() => setViewMode("archived")}
                className="btn-secondary"
                style={{ padding: "8px 18px", fontSize: "0.85rem", fontWeight: "800" }}
              >
                View Archived Reviews ({archivedLoads.length})
              </button>
            )}
          </div>
        ) : viewMode === "archived" && archivedLoads.length === 0 ? (
          <div
            style={{
              padding: "44px 20px",
              textAlign: "center",
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: "14px",
              border: "1px dashed var(--glass-border)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Archive size={40} color="var(--text-muted)" style={{ marginBottom: "4px" }} />
            <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)" }}>
              No Archived Reviews Yet
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
              Complete a review on a pending truck to archive it here.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {(viewMode === "pending" ? pendingLoads : archivedLoads).map((load) => {
              const obs = Array.isArray(load.concreteObservations) && load.concreteObservations.length > 0
                ? load.concreteObservations
                : ["Pending Review"];
              const isDidNotReview = obs.includes("Did Not Review") || obs.includes("Unreviewed / No Review Done");
              const hasIssues = obs.some(
                (o) =>
                  o.toLowerCase() !== "perfect" &&
                  o.toLowerCase() !== "normal" &&
                  !o.startsWith("Normal (") &&
                  o !== "Pending Review" &&
                  o !== "Did Not Review" &&
                  o !== "Unreviewed / No Review Done"
              );
              const isPending = load.isReviewed !== true && (obs.includes("Pending Review") || obs.length === 0);
              const hasAction = Boolean(load.actionTaken || (load.actionsTaken && load.actionsTaken.length > 0));

              return (
                <div
                  key={load.id}
                  onClick={() => setSelectedLoadId(load.id)}
                  style={{
                    padding: "16px 18px",
                    borderRadius: "14px",
                    backgroundColor: "var(--bg-tertiary)",
                    border: hasIssues
                      ? "1.5px solid rgba(245, 158, 11, 0.4)"
                      : "1px solid var(--glass-border)",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "14px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Truck size={18} color="#e05300" />
                        <span style={{ fontSize: "1.15rem", fontWeight: "900", color: "var(--text-primary)", fontFamily: "Outfit, monospace" }}>
                          {load.truckCode}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.95rem", fontWeight: "800", color: "#e05300" }}>
                        {load.mixCode}
                      </span>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        ({load.quantity} yd³)
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                        {load.time}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {load.batchNumber && (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "Outfit, monospace" }}>
                            #{load.batchNumber}
                          </span>
                        )}
                        {load.ticketNumber && (
                          <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: "800", padding: "1px 6px", borderRadius: "4px", backgroundColor: "rgba(16, 185, 129, 0.12)", fontFamily: "Outfit, monospace" }}>
                            🎟️ #{load.ticketNumber}
                          </span>
                        )}
                        <span style={{ fontSize: "0.75rem", color: "#3b82f6", fontWeight: "700" }}>
                          💧 {load.actualBatchWater} L
                        </span>
                      </div>

                      {/* Status & Action Badges */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        {hasAction && (
                          <span style={{ fontSize: "0.7rem", fontWeight: "800", padding: "2px 7px", borderRadius: "6px", backgroundColor: "rgba(16, 185, 129, 0.18)", color: "#10b981", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                            <Wrench size={11} /> {load.actionsTaken && load.actionsTaken.length > 0 ? load.actionsTaken[0] : "Action Taken"}
                          </span>
                        )}

                        {isPending ? (
                          <span style={{ fontSize: "0.72rem", fontWeight: "800", padding: "3px 8px", borderRadius: "6px", backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                            🟡 Awaiting Review
                          </span>
                        ) : isDidNotReview ? (
                          <span style={{ fontSize: "0.72rem", fontWeight: "800", padding: "3px 8px", borderRadius: "6px", backgroundColor: "rgba(107, 114, 128, 0.2)", color: "var(--text-muted)" }}>
                            ⚪ Did Not Review
                          </span>
                        ) : hasIssues ? (
                          <span style={{ fontSize: "0.72rem", fontWeight: "800", padding: "3px 8px", borderRadius: "6px", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                            ⚠ Issues Logged ({obs.length})
                          </span>
                        ) : load.observedSlumpInches !== undefined ? (
                          <span style={{ fontSize: "0.72rem", fontWeight: "800", padding: "3px 8px", borderRadius: "6px", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                            ✓ Slump: {load.observedSlumpInches}&quot;
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.72rem", fontWeight: "800", padding: "3px 8px", borderRadius: "6px", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                            ✓ Reviewed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "10px",
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--glass-border)",
                      color: "#e05300",
                      fontSize: "0.82rem",
                      fontWeight: "800",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>{viewMode === "pending" ? "Review" : "Edit"}</span>
                    <ChevronRight size={15} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
