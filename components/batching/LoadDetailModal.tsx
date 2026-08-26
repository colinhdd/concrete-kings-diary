"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Clock,
  Truck,
  Layers,
  Droplets,
  Eye,
  Sliders,
  FileText,
  ShieldCheck,
  Edit3,
  Ban,
  Check,
  AlertCircle,
  History,
  Wrench,
} from "lucide-react";
import {
  LoadRecord,
  AuditRecord,
  getAuditTrailForLoad,
  updateLoad,
  voidLoad,
} from "@/lib/db-batching";

interface LoadDetailModalProps {
  load: LoadRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onLoadUpdated: (updated: LoadRecord) => void;
  batcherName?: string;
  batcherId?: string;
}

export default function LoadDetailModal({
  load,
  isOpen,
  onClose,
  onLoadUpdated,
  batcherName = "Lead Batcher",
  batcherId = "batcher_01",
}: LoadDetailModalProps) {
  const [auditHistory, setAuditHistory] = useState<AuditRecord[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [editReason, setEditReason] = useState("");

  // Edit form fields
  const [editActualWater, setEditActualWater] = useState<string>("");
  const [editObservations, setEditObservations] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (load && isOpen) {
      getAuditTrailForLoad(load.id).then(setAuditHistory);
      setEditActualWater(String(load.actualBatchWater));
      setEditObservations(
        Array.isArray(load.concreteObservations)
          ? load.concreteObservations.join(", ")
          : String(load.concreteObservations || "")
      );
      setEditNotes(load.batcherNotes || "");
      setIsEditing(false);
      setIsVoiding(false);
      setVoidReason("");
      setEditReason("");
    }
  }, [load, isOpen]);

  if (!isOpen || !load) return null;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editReason.trim()) {
      alert("Please provide a reason for correcting this load record for the audit log.");
      return;
    }

    const newActualWater = parseFloat(editActualWater);
    if (isNaN(newActualWater) || newActualWater <= 0) {
      alert("Please enter a valid actual water quantity.");
      return;
    }

    try {
      setIsSaving(true);
      const parsedObs = editObservations
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const updated = await updateLoad(
        load.id,
        {
          actualBatchWater: newActualWater,
          concreteObservations: parsedObs,
          batcherNotes: editNotes,
        },
        batcherName,
        batcherId,
        editReason
      );

      if (updated) {
        onLoadUpdated(updated);
        const newAudits = await getAuditTrailForLoad(load.id);
        setAuditHistory(newAudits);
        setIsEditing(false);
      }
    } catch (err: any) {
      alert(`Failed to update load: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidReason.trim()) {
      alert("Please provide a void reason.");
      return;
    }

    try {
      setIsSaving(true);
      const success = await voidLoad(load.id, batcherName, batcherId, voidReason);
      if (success) {
        const updated = { ...load, isVoid: true, voidReason };
        onLoadUpdated(updated);
        const newAudits = await getAuditTrailForLoad(load.id);
        setAuditHistory(newAudits);
        setIsVoiding(false);
      }
    } catch (err: any) {
      alert(`Failed to void load: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const snapshot = load.snapshot || {};
  const sandMoistureDec = (load.sandMoisturePercent || 0) / 100;
  const baseSandDryTruck = Math.round((snapshot.sandDesign || 0) * load.quantity);
  const targetWeighedSand = sandMoistureDec > 0 && sandMoistureDec < 1
    ? Math.round(baseSandDryTruck / (1 - sandMoistureDec))
    : baseSandDryTruck;
  const actualSandTotal = load.actualSand !== undefined && load.actualSand > 0
    ? load.actualSand
    : targetWeighedSand;
  const replacementSandKg = Math.max(0, actualSandTotal - baseSandDryTruck);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "600px", maxHeight: "92vh" }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: load.isVoid ? "rgba(239, 68, 68, 0.15)" : "rgba(224, 83, 0, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: load.isVoid ? "#ef4444" : "#e05300",
              }}
            >
              <Truck size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)" }}>
                  {load.truckCode} &bull; {load.mixCode}
                </h3>
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
                {load.isVoid ? (
                  <span className="badge failed">VOIDED</span>
                ) : (
                  <span
                    className={`badge ${
                      load.syncStatus === "Synced"
                        ? "synced"
                        : load.syncStatus === "Saved Offline"
                        ? "pending"
                        : "failed"
                    }`}
                  >
                    {load.syncStatus}
                  </span>
                )}
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                {load.date} at {load.time} &bull; {load.quantity} yd³
              </span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: "1.25rem" }}>
          {/* Void notice if voided */}
          {load.isVoid && (
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#ef4444",
                fontSize: "0.85rem",
              }}
            >
              <strong>Record Cancelled / Voided:</strong> {load.voidReason || "No reason given"}
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
              gap: "8px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                padding: "8px",
                borderRadius: "10px",
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Sand Moist
              </span>
              <div style={{ fontSize: "1.15rem", fontWeight: "800", color: "#3b82f6" }}>
                {load.sandMoisturePercent}%
              </div>
            </div>
            <div
              style={{
                padding: "8px",
                borderRadius: "10px",
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Stone Moist
              </span>
              <div style={{ fontSize: "1.15rem", fontWeight: "800", color: "#10b981" }}>
                {load.stoneMoisturePercent !== undefined ? `${load.stoneMoisturePercent}%` : "1.0%"}
              </div>
            </div>

            <div
              style={{
                padding: "8px",
                borderRadius: "10px",
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Replacement Sand
              </span>
              <div style={{ fontSize: "1.15rem", fontWeight: "800", color: "#e05300" }}>
                +{replacementSandKg.toLocaleString()} <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>kg</span>
              </div>
            </div>

            <div
              style={{
                padding: "8px",
                borderRadius: "10px",
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Water Adj.
              </span>
              <div
                style={{
                  fontSize: "1.15rem",
                  fontWeight: "800",
                  color: load.waterAdjustment > 0 ? "#f59e0b" : load.waterAdjustment < 0 ? "#3b82f6" : "#10b981",
                }}
              >
                {load.waterAdjustment > 0 ? `+${load.waterAdjustment}` : load.waterAdjustment} L
              </div>
            </div>
          </div>

          {/* EDIT FORM (if editing) */}
          {isEditing ? (
            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#e05300" }}>
                Correct Batch Record
              </div>
              <div className="form-group">
                <label>Actual Water Added (L)</label>
                <input
                  type="number"
                  className="form-input"
                  required
                  value={editActualWater}
                  onChange={(e) => setEditActualWater(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Concrete Observations (comma separated)</label>
                <input
                  type="text"
                  className="form-input"
                  value={editObservations}
                  onChange={(e) => setEditObservations(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Batcher Notes</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label style={{ color: "#ef4444" }}>Audit Correction Reason *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Corrected actual water typo from flowmeter reading"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  <Check size={16} /> {isSaving ? "Saving..." : "Save Corrections"}
                </button>
              </div>
            </form>
          ) : isVoiding ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#ef4444" }}>
                Void Load Record
              </div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Voiding marks this record as cancelled in the database and audit trail while preserving historical records.
              </p>
              <div className="form-group">
                <label>Reason for Voiding *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Duplicate entry / Truck cancelled at plant"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsVoiding(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleConfirmVoid}
                  disabled={isSaving}
                  style={{ background: "#ef4444" }}
                >
                  <Ban size={16} /> {isSaving ? "Voiding..." : "Confirm Void"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ================= 1. ACTUAL BATCHED IN TRUCK ================= */}
              <div
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(0,0,0,0.25)",
                  border: "1px solid var(--glass-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                  <div
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: "800",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <ShieldCheck size={15} color="#10b981" /> Actual Amounts Put In Truck ({load.quantity} yd³)
                  </div>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Batcher: <strong style={{ color: "var(--text-primary)" }}>{load.batcherName}</strong>
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Row 1: Cement & Aggregates */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))",
                      gap: "10px 8px",
                      fontSize: "0.8rem",
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>Cement</span>
                      <strong style={{ fontSize: "0.95rem", color: "#3b82f6" }}>
                        {(load.actualCement !== undefined && load.actualCement > 0
                          ? load.actualCement
                          : Math.round((snapshot.cementDesign || 0) * load.quantity)
                        ).toLocaleString()} kg
                      </strong>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                        {snapshot.cementDesign ? `Rate: ${snapshot.cementDesign} kg/yd³` : ""}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>
                        Sand ({load.sandMoisturePercent}% Moist)
                      </span>
                      <strong style={{ fontSize: "0.95rem", color: "#e05300" }}>
                        {(load.actualSand !== undefined && load.actualSand > 0
                          ? load.actualSand
                          : Math.round((snapshot.sandDesign || 0) * load.quantity)
                        ).toLocaleString()} kg
                      </strong>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                        {snapshot.sandDesign ? `Rate: ${snapshot.sandDesign} kg/yd³` : ""}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>
                        ¾ Stone ({load.stoneMoisturePercent !== undefined ? load.stoneMoisturePercent : 1.0}% Moist)
                      </span>
                      <strong style={{ fontSize: "0.95rem", color: "#10b981" }}>
                        {(load.actualThreeQuarterStone !== undefined && load.actualThreeQuarterStone > 0
                          ? load.actualThreeQuarterStone
                          : Math.round((snapshot.threeQuarterStoneDesign || 0) * load.quantity)
                        ).toLocaleString()} kg
                      </strong>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                        {snapshot.threeQuarterStoneDesign ? `Rate: ${snapshot.threeQuarterStoneDesign} kg/yd³` : ""}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>
                        ⅜ Stone ({load.stoneMoisturePercent !== undefined ? load.stoneMoisturePercent : 1.0}% Moist)
                      </span>
                      <strong style={{ fontSize: "0.95rem", color: (load.actualThreeEighthStone && load.actualThreeEighthStone > 0) || (snapshot.threeEighthStoneDesign && snapshot.threeEighthStoneDesign > 0) ? "#10b981" : "var(--text-muted)" }}>
                        {load.actualThreeEighthStone !== undefined && load.actualThreeEighthStone > 0
                          ? `${load.actualThreeEighthStone.toLocaleString()} kg`
                          : snapshot.threeEighthStoneDesign && snapshot.threeEighthStoneDesign > 0
                          ? `${Math.round(snapshot.threeEighthStoneDesign * load.quantity).toLocaleString()} kg`
                          : "—"}
                      </strong>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                        {snapshot.threeEighthStoneDesign ? `Rate: ${snapshot.threeEighthStoneDesign} kg/yd³` : "None"}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Water & Admixtures */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))",
                      gap: "10px 8px",
                      fontSize: "0.8rem",
                      borderTop: "1px solid var(--glass-border)",
                      paddingTop: "8px",
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>Water in Truck</span>
                      <strong style={{ fontSize: "0.95rem", color: "#3b82f6" }}>
                        {load.actualBatchWater.toLocaleString()} L
                      </strong>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                        {snapshot.waterDesign ? `Des: ${snapshot.waterDesign} L/yd³` : ""}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>Plasticizer</span>
                      <strong style={{ fontSize: "0.95rem", color: "#8b5cf6" }}>
                        {(load.actualPlasticizer !== undefined && load.actualPlasticizer > 0
                          ? load.actualPlasticizer
                          : Math.round((snapshot.plasticizerDesign || 0) * load.quantity)
                        ).toLocaleString()} fl oz
                      </strong>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                        {snapshot.plasticizerDesign ? `Rate: ${snapshot.plasticizerDesign} fl oz/yd³` : ""}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>Retarder</span>
                      <strong style={{ fontSize: "0.95rem", color: "#f59e0b" }}>
                        {(load.actualRetarder !== undefined && load.actualRetarder > 0
                          ? load.actualRetarder
                          : Math.round((snapshot.retarderDesign || 0) * load.quantity)
                        ).toLocaleString()} fl oz
                      </strong>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                        {snapshot.retarderDesign ? `Rate: ${snapshot.retarderDesign} fl oz/yd³` : "0 fl oz/yd³"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ================= 2. CONCRETE OBSERVATIONS & FIELD REMARKS (VISUALLY SEPARATE BELOW) ================= */}
              <div
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1.5px solid var(--glass-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: "800",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Eye size={15} color="#3b82f6" /> Visual Observations &amp; Quality Notes
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {Array.isArray(load.concreteObservations) && load.concreteObservations.length > 0 ? (
                    load.concreteObservations.map((obs, idx) => {
                      const isNormal = obs.toLowerCase() === "perfect" || obs.toLowerCase() === "normal";
                      const isPending = obs === "Pending Review";
                      return (
                        <span
                          key={idx}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "0.85rem",
                            fontWeight: "800",
                            backgroundColor: isPending
                              ? "rgba(245, 158, 11, 0.15)"
                              : isNormal
                              ? "rgba(16, 185, 129, 0.15)"
                              : "rgba(224, 83, 0, 0.15)",
                            color: isPending ? "#f59e0b" : isNormal ? "#10b981" : "#e05300",
                            border: isPending
                              ? "1px solid rgba(245, 158, 11, 0.3)"
                              : isNormal
                              ? "1px solid rgba(16, 185, 129, 0.3)"
                              : "1px solid rgba(224, 83, 0, 0.3)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {isPending ? "🟡" : isNormal ? "✓" : "⚠"} {obs}
                        </span>
                      );
                    })
                  ) : (
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                      No observations recorded.
                    </span>
                  )}
                </div>

                {Boolean(load.actionTaken || (load.actionsTaken && load.actionsTaken.length > 0)) && (
                  <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "8px", fontSize: "0.85rem" }}>
                    <span style={{ color: "#10b981", fontWeight: "800", display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
                      <Wrench size={13} /> Action Taken / Resolution (&ldquo;What Was Done&rdquo;)
                    </span>
                    <div style={{ color: "var(--text-primary)", fontWeight: "600", backgroundColor: "rgba(16, 185, 129, 0.08)", padding: "6px 10px", borderRadius: "6px" }}>
                      {load.actionTaken || load.actionsTaken?.join(", ")}
                    </div>
                  </div>
                )}

                {load.batchAdjustments && load.batchAdjustments.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "8px", fontSize: "0.82rem" }}>
                    <span style={{ color: "var(--text-secondary)", fontWeight: "700", display: "block", marginBottom: "2px" }}>
                      Plant Adjustments
                    </span>
                    <div style={{ color: "var(--text-primary)" }}>
                      {load.batchAdjustments
                        .map((a) => (a.value ? `${a.label} (${a.value}${a.unit || ""})` : a.label))
                        .join("; ")}
                    </div>
                  </div>
                )}

                {load.batcherNotes && (
                  <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "8px" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: "700", display: "block", marginBottom: "3px" }}>
                      Batcher Notes
                    </span>
                    <div className="detail-notes">{load.batcherNotes}</div>
                  </div>
                )}
              </div>

              {/* ================= AUDIT TRAIL (Section 26) ================= */}
              <div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: "700",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <History size={14} /> Audit Trail ({auditHistory.length})
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    maxHeight: "120px",
                    overflowY: "auto",
                  }}
                >
                  {auditHistory.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "6px",
                        backgroundColor: "var(--bg-tertiary)",
                        fontSize: "0.75rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong>{a.userName}</strong>: {a.changesSummary}
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", whiteSpace: "nowrap" }}>
                        {new Date(a.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              {!load.isVoid && (
                <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsEditing(true)}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <Edit3 size={16} /> Edit / Correct
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsVoiding(true)}
                    style={{
                      flex: 1,
                      color: "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <Ban size={16} /> Void Load
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
