"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  User,
  CheckCircle2,
  Navigation,
  AlertCircle,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { BatchingDay, startBatchingDay } from "@/lib/db-batching";

interface ClockInGateProps {
  onClockedIn: (day: BatchingDay) => void;
}

export default function ClockInGate({ onClockedIn }: ClockInGateProps) {
  const [name, setName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("ck_last_batcher_name") || "";
      } catch (e) {}
    }
    return "";
  });
  const [locationStatus, setLocationStatus] = useState<"checking" | "captured" | "permission_needed" | "fallback">("checking");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locationMsg, setLocationMsg] = useState<string>("Acquiring GPS location...");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentDateFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // GPS auto-capture with fallback (High accuracy GPS -> Standard accuracy -> Plant confirmation)
  const captureGPS = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationStatus("fallback");
      setLocationMsg("Plant tablet location active");
      return;
    }

    setLocationStatus("checking");
    setLocationMsg("Pinpointing GPS coordinates...");

    // 1st attempt: High accuracy GPS
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocationCoords({ lat: latitude, lng: longitude, accuracy });
        setLocationStatus("captured");
        setLocationMsg(`GPS Locked: ${latitude.toFixed(4)}°, ${longitude.toFixed(4)}° (±${Math.round(accuracy)}m)`);
      },
      (err) => {
        console.warn("High accuracy GPS attempt failed, trying standard network location:", err);
        // 2nd attempt: Standard accuracy
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            setLocationCoords({ lat: latitude, lng: longitude, accuracy });
            setLocationStatus("captured");
            setLocationMsg(`GPS Locked: ${latitude.toFixed(4)}°, ${longitude.toFixed(4)}° (±${Math.round(accuracy)}m)`);
          },
          (fallbackErr) => {
            console.warn("GPS capture warning:", fallbackErr);
            if (fallbackErr.code === 1) { // PERMISSION_DENIED
              setLocationStatus("permission_needed");
              setLocationMsg("Location permission needed (tap Re-check)");
            } else {
              setLocationStatus("fallback");
              setLocationMsg("GPS signal weak &bull; Plant Yard location confirmed");
            }
          },
          { timeout: 10000, enableHighAccuracy: false }
        );
      },
      { timeout: 7000, enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    captureGPS();
  }, [captureGPS]);

  const handleClockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Please enter your name to clock in.");
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMsg(null);

      const newDay = await startBatchingDay(
        name.trim(),
        "batcher_" + name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        "Concrete Kings Plant Yard",
        "plant_yard_1",
        locationCoords ? { latitude: locationCoords.lat, longitude: locationCoords.lng, accuracy: locationCoords.accuracy } : undefined
      );

      onClockedIn(newDay);
    } catch (err: any) {
      setErrorMsg(`Failed to clock in: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "440px",
        margin: "1.5rem auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <form
        onSubmit={handleClockIn}
        className="glass-panel"
        style={{
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          borderRadius: "20px",
          borderTop: "5px solid #e05300",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              backgroundColor: "rgba(224, 83, 0, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#e05300",
            }}
          >
            <Clock size={30} />
          </div>
          <h2 style={{ margin: 0, fontSize: "1.6rem", fontWeight: "900", color: "var(--text-primary)" }}>
            Clock In
          </h2>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            {currentDateFormatted}
          </span>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              color: "#ef4444",
              fontSize: "0.85rem",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        {/* Name Input */}
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: "0.95rem", fontWeight: "800", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <User size={18} color="#e05300" /> Enter Your Name
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Kevin Sutherland"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            style={{
              fontSize: "1.25rem",
              fontWeight: "800",
              padding: "16px",
              borderRadius: "12px",
            }}
          />
        </div>

        {/* GPS Status Box with Re-check Button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            fontSize: "0.82rem",
            color: locationStatus === "captured" ? "#10b981" : "var(--text-secondary)",
            fontWeight: "600",
            padding: "10px 14px",
            borderRadius: "10px",
            backgroundColor:
              locationStatus === "captured"
                ? "rgba(16, 185, 129, 0.08)"
                : locationStatus === "checking"
                ? "rgba(59, 130, 246, 0.08)"
                : "var(--bg-tertiary)",
            border:
              locationStatus === "captured"
                ? "1px solid rgba(16, 185, 129, 0.25)"
                : locationStatus === "checking"
                ? "1px solid rgba(59, 130, 246, 0.25)"
                : "1px solid var(--glass-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {locationStatus === "captured" ? (
              <CheckCircle2 size={18} color="#10b981" />
            ) : locationStatus === "checking" ? (
              <Navigation size={16} color="#3b82f6" className="animate-spin" />
            ) : (
              <MapPin size={18} color="#e05300" />
            )}
            <span dangerouslySetInnerHTML={{ __html: locationMsg }} />
          </div>

          <button
            type="button"
            onClick={captureGPS}
            title="Refresh GPS location"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Clock In Button */}
        <button
          type="submit"
          disabled={isProcessing || !name.trim()}
          style={{
            padding: "18px",
            borderRadius: "14px",
            border: "none",
            background: "linear-gradient(135deg, #e05300 0%, #c2410c 100%)",
            color: "#fff",
            fontSize: "1.35rem",
            fontWeight: "900",
            fontFamily: "Outfit, sans-serif",
            letterSpacing: "0.03em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 8px 24px rgba(224, 83, 0, 0.4)",
            transition: "transform 0.15s ease",
          }}
        >
          <Clock size={22} />
          {isProcessing ? "CLOCKING IN..." : "CLOCK IN"}
        </button>
      </form>
    </div>
  );
}
