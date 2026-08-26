"use client";

import React, { useState, useEffect } from "react";
import { Droplets, X, Check } from "lucide-react";
import { MoistureReading, saveMoistureReading } from "@/lib/db-batching";

interface MoistureModalProps {
  isOpen: boolean;
  onClose: () => void;
  material?: "Sand" | "Stone";
  currentMoisture?: MoistureReading | null;
  currentPercentage?: number;
  onMoistureUpdated: (reading: MoistureReading) => void;
  batcherName?: string;
  batcherId?: string;
}

const SAND_MOISTURE_OPTIONS = [
  0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5,
  5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0,
];

const STONE_MOISTURE_OPTIONS = [
  0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0,
];

export default function MoistureModal({
  isOpen,
  onClose,
  material = "Sand",
  currentMoisture,
  currentPercentage,
  onMoistureUpdated,
  batcherName = "Lead Batcher",
  batcherId = "batcher_01",
}: MoistureModalProps) {
  const isStone = material.toLowerCase() === "stone";
  const defaultVal = isStone ? 1.0 : 3.0;

  const [selectedVal, setSelectedVal] = useState<number>(
    currentPercentage ?? currentMoisture?.percentage ?? defaultVal
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedVal(currentPercentage ?? currentMoisture?.percentage ?? defaultVal);
    }
  }, [isOpen, currentPercentage, currentMoisture, defaultVal]);

  if (!isOpen) return null;

  const accentColor = isStone ? "#10b981" : "#3b82f6";
  const options = isStone ? STONE_MOISTURE_OPTIONS : SAND_MOISTURE_OPTIONS;

  const handleSave = async (valToSave?: number) => {
    const val = typeof valToSave === "number" ? valToSave : selectedVal;

    try {
      setIsSaving(true);
      const saved = await saveMoistureReading(
        val,
        batcherName,
        batcherId,
        material,
        ""
      );
      onMoistureUpdated(saved);
      onClose();
    } catch (err: any) {
      alert(`Failed to save ${material} moisture reading: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "460px" }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                backgroundColor: isStone ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: accentColor,
              }}
            >
              <Droplets size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)" }}>
                {material} Moisture (%)
              </h3>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Select active {material.toLowerCase()} surface moisture for today
              </span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Prominent Active Display */}
          <div
            style={{
              padding: "14px",
              borderRadius: "14px",
              backgroundColor: isStone ? "rgba(16, 185, 129, 0.12)" : "rgba(59, 130, 246, 0.12)",
              border: `1.5px solid ${isStone ? "rgba(16, 185, 129, 0.35)" : "rgba(59, 130, 246, 0.35)"}`,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "800" }}>
              Selected {material} Moisture
            </span>
            <div style={{ fontSize: "3rem", fontWeight: "900", color: accentColor, fontFamily: "Outfit, sans-serif", lineHeight: 1 }}>
              {selectedVal.toFixed(1)}%
            </div>
          </div>

          {/* Moisture Options Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "8px",
            }}
          >
            {options.map((val) => {
              const isSelected = selectedVal === val;

              return (
                <button
                  type="button"
                  key={val}
                  onClick={() => setSelectedVal(val)}
                  style={{
                    padding: "12px 4px",
                    borderRadius: "10px",
                    border: isSelected
                      ? `2.5px solid ${accentColor}`
                      : "1px solid var(--glass-border)",
                    backgroundColor: isSelected
                      ? isStone ? "rgba(16, 185, 129, 0.25)" : "rgba(59, 130, 246, 0.25)"
                      : "var(--bg-tertiary)",
                    color: isSelected ? accentColor : "var(--text-primary)",
                    fontSize: "1.1rem",
                    fontWeight: "900",
                    fontFamily: "Outfit, sans-serif",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {val.toFixed(1)}%
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ flex: 1, padding: "14px", fontSize: "0.95rem", fontWeight: "700" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              style={{
                flex: 2,
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background: isStone
                  ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                  : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                color: "#fff",
                fontSize: "1.1rem",
                fontWeight: "900",
                fontFamily: "Outfit, sans-serif",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: isStone
                  ? "0 6px 20px rgba(16, 185, 129, 0.35)"
                  : "0 6px 20px rgba(37, 99, 235, 0.35)",
              }}
            >
              <Check size={18} />
              {isSaving ? "SETTING..." : `SET ${selectedVal.toFixed(1)}% ${material.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
