"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, User, Building2, Lock, Play, MapPin, ShieldCheck, Clock, CheckCircle2, Navigation, AlertCircle } from "lucide-react";
import { BatchingDay, startBatchingDay, closeBatchingDay } from "@/lib/db-batching";

interface BatchingDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDay: BatchingDay | null;
  onDayUpdated: (day: BatchingDay) => void;
}

const KNOWN_BATCHERS = [
  "Kevin Sutherland",
  "Jerome Clarke",
  "Carlos Mendez",
  "Devon King",
  "Marcus Bryan",
  "Lead Batcher",
];

export default function BatchingDayModal({
  isOpen,
  onClose,
  currentDay,
  onDayUpdated,
}: BatchingDayModalProps) {
  const [batcherName, setBatcherName] = useState(currentDay?.batcherName || "Kevin Sutherland");
  const [plantName, setPlantName] = useState(currentDay?.plantName || "Concrete Kings Plant Yard");
  const [locationStatus, setLocationStatus] = useState<"idle" | "checking" | "verified" | "fallback">("idle");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locationMsg, setLocationMsg] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // GPS Pinpoint handler
  const handleAcquireLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("fallback");
      setLocationMsg("GPS unavailable on this device. Location marked as Plant Tablet.");
      return;
    }

    setLocationStatus("checking");
    setLocationMsg("Pinpointing GPS coordinates...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocationCoords({ lat: latitude, lng: longitude, accuracy });
        setLocationStatus("verified");
        setLocationMsg(
          `GPS Pinpointed: ${latitude.toFixed(4)}°, ${longitude.toFixed(4)}° (±${Math.round(accuracy)}m)`
        );
      },
      (err) => {
        console.warn("GPS error:", err);
        setLocationStatus("fallback");
        setLocationMsg("GPS signal weak. Manual confirmation enabled.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (!currentDay || currentDay.status !== "open") {
        handleAcquireLocation();
      }
    }
  }, [isOpen, currentDay, handleAcquireLocation]);

  if (!isOpen) return null;

  const isDayOpen = currentDay && currentDay.status === "open";
  const isLocationReady = locationStatus === "verified" || locationStatus === "fallback";

  const handleClockIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    try {
      setIsProcessing(true);
      const newDay = await startBatchingDay(
        batcherName.trim() || "Lead Batcher",
        "batcher_" + (batcherName.toLowerCase().replace(/[^a-z0-9]/g, "_")),
        plantName.trim() || "Concrete Kings Main Plant",
        "plant_yard_1"
      );
      onDayUpdated(newDay);
      onClose();
    } catch (err: any) {
      setErrorMsg(`Failed to clock in: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentDay) return;
    const confirm = window.confirm(
      `Clock out shift for ${currentDay.date}? Total loads batched today: ${currentDay.totalLoads || 0}.`
    );
    if (!confirm) return;

    try {
      setIsProcessing(true);
      const closed = await closeBatchingDay(currentDay.id);
      if (closed) {
        onDayUpdated(closed);
        onClose();
      }
    } catch (err: any) {
      alert(`Failed to clock out: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: "440px" }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                backgroundColor: "rgba(224, 83, 0, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#e05300",
              }}
            >
              <Clock size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)", fontWeight: "800" }}>
                {isDayOpen ? "Batcher Shift Active" : "Daily Shift Clock-In"}
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                {isDayOpen ? "Currently Clocked In" : "Pinpoint GPS location to start batching"}
              </span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {isDayOpen ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#10b981", fontWeight: "800" }}>
                  <ShieldCheck size={16} /> SHIFT CLOCKED IN
                </div>
                <div style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--text-primary)", marginTop: "4px" }}>
                  {currentDay.batcherName}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                  {currentDay.plantName} &bull; Started {currentDay.startTime}
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: "8px" }}>
                <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                  Return to Diary
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleClockOut}
                  disabled={isProcessing}
                  style={{ background: "#ef4444", flex: 1 }}
                >
                  <Lock size={16} /> {isProcessing ? "Closing..." : "Clock Out Shift"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Batcher Name Picker */}
              <div className="form-group">
                <label style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-primary)" }}>
                  Select Batcher
                </label>
                <select
                  className="form-input"
                  value={batcherName}
                  onChange={(e) => setBatcherName(e.target.value)}
                  style={{ fontSize: "1.05rem", fontWeight: "800", padding: "12px" }}
                >
                  {KNOWN_BATCHERS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* GPS Location Pinpoint Card */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor:
                    locationStatus === "verified"
                      ? "rgba(16, 185, 129, 0.12)"
                      : locationStatus === "checking"
                      ? "rgba(59, 130, 246, 0.12)"
                      : "var(--bg-tertiary)",
                  border:
                    locationStatus === "verified"
                      ? "1.5px solid #10b981"
                      : locationStatus === "checking"
                      ? "1.5px solid #3b82f6"
                      : "1px solid var(--glass-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin
                      size={20}
                      color={
                        locationStatus === "verified"
                          ? "#10b981"
                          : locationStatus === "checking"
                          ? "#3b82f6"
                          : "#e05300"
                      }
                    />
                    <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--text-primary)" }}>
                      GPS Location Pinpoint
                    </span>
                  </div>

                  {locationStatus === "verified" && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: "800",
                        color: "#10b981",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <CheckCircle2 size={14} /> Ready
                    </span>
                  )}
                </div>

                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                  {locationStatus === "checking"
                    ? "Acquiring GPS satellite fix..."
                    : locationMsg || "Locating device at Concrete Kings plant..."}
                </div>

                {locationStatus !== "verified" && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <button
                      type="button"
                      onClick={handleAcquireLocation}
                      disabled={locationStatus === "checking"}
                      className="btn-secondary"
                      style={{ flex: 1, fontSize: "0.8rem", padding: "8px 12px", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
                    >
                      <Navigation size={14} className={locationStatus === "checking" ? "animate-spin" : ""} />
                      {locationStatus === "checking" ? "Pinpointing..." : "Pinpoint GPS"}
                    </button>
                    {locationStatus !== "fallback" && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocationStatus("fallback");
                          setLocationMsg("Location confirmed on Plant Tablet.");
                        }}
                        className="btn-secondary"
                        style={{ fontSize: "0.8rem", padding: "8px 12px" }}
                      >
                        Confirm Tablet
                      </button>
                    )}
                  </div>
                )}
              </div>

              {errorMsg && (
                <div style={{ color: "#ef4444", fontSize: "0.85rem", textAlign: "center", fontWeight: "700" }}>
                  {errorMsg}
                </div>
              )}

              {/* Submit Clock In Button */}
              <div className="modal-actions" style={{ marginTop: "6px" }}>
                <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleClockIn()}
                  disabled={isProcessing || locationStatus === "checking"}
                  style={{
                    flex: 2,
                    padding: "14px",
                    fontSize: "1rem",
                    fontWeight: "800",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <Play size={18} /> {isProcessing ? "Clocking In..." : "CLOCK IN & START SHIFT"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
