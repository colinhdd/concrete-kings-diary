"use client";

import React, { useState, useMemo } from "react";
import {
  Clock,
  Truck,
  Droplets,
  Eye,
  Search,
  Filter,
  RefreshCw,
  Copy,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { LoadRecord } from "@/lib/db-batching";

interface TodaysLoadsProps {
  loads: LoadRecord[];
  onSelectLoad: (load: LoadRecord) => void;
  onRepeatLoad: (load: LoadRecord) => void;
  onRefresh: () => void;
}

export default function TodaysLoads({
  loads,
  onSelectLoad,
  onRepeatLoad,
  onRefresh,
}: TodaysLoadsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMix, setFilterMix] = useState("all");

  const uniqueMixes = useMemo(() => {
    const set = new Set(loads.map((l) => l.mixCode).filter(Boolean));
    return Array.from(set);
  }, [loads]);

  const filteredLoads = useMemo(() => {
    return loads.filter((load) => {
      const matchesSearch =
        !searchTerm.trim() ||
        load.truckCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        load.mixCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (Array.isArray(load.concreteObservations) &&
          load.concreteObservations.some((o) =>
            o.toLowerCase().includes(searchTerm.toLowerCase())
          ));

      const matchesMix = filterMix === "all" || load.mixCode === filterMix;

      return matchesSearch && matchesMix;
    });
  }, [loads, searchTerm, filterMix]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <Search
            size={16}
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search truck, mix, or condition..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: "36px", fontSize: "0.9rem" }}
          />
        </div>

        {uniqueMixes.length > 1 && (
          <select
            className="form-select"
            value={filterMix}
            onChange={(e) => setFilterMix(e.target.value)}
            style={{ width: "auto", minWidth: "130px", fontSize: "0.9rem" }}
          >
            <option value="all">All Mixes</option>
            {uniqueMixes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          className="btn-secondary"
          onClick={onRefresh}
          title="Refresh today's list"
          style={{ padding: "12px 14px" }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Chronological List of Loads */}
      {filteredLoads.length === 0 ? (
        <div className="glass-panel empty-state">
          <Truck size={40} />
          <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-primary)" }}>
            No Batched Loads Recorded Yet Today
          </div>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "400px" }}>
            Tap the &quot;New Load&quot; button to record your first truck batching record for today&apos;s shift.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filteredLoads.map((load) => {
            const obsText = Array.isArray(load.concreteObservations)
              ? load.concreteObservations.join(", ")
              : String(load.concreteObservations || "");

            return (
              <div
                key={load.id}
                onClick={() => onSelectLoad(load)}
                className="glass-panel"
                style={{
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  cursor: "pointer",
                  opacity: load.isVoid ? 0.6 : 1,
                  borderLeft: load.isVoid
                    ? "4px solid #ef4444"
                    : load.waterAdjustment > 100
                    ? "4px solid #f59e0b"
                    : "4px solid #1e3c72",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Header Row: Truck, Mix, Time, and Badges */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Truck size={16} color="#e05300" />
                      <span style={{ fontSize: "1.15rem", fontWeight: "900", color: "var(--text-primary)", fontFamily: "Outfit, monospace" }}>
                        {load.truckCode}
                      </span>
                    </div>
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
                    <span
                      style={{
                        fontSize: "0.85rem",
                        padding: "2px 7px",
                        borderRadius: "5px",
                        backgroundColor: "rgba(224, 83, 0, 0.12)",
                        color: "#e05300",
                        fontWeight: "800",
                      }}
                    >
                      {load.mixCode} ({load.quantity} yd³)
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      className={`badge ${
                        load.syncStatus === "Synced"
                          ? "synced"
                          : load.syncStatus === "Saved Offline"
                          ? "pending"
                          : "failed"
                      }`}
                      style={{ fontSize: "0.68rem" }}
                    >
                      {load.syncStatus}
                    </span>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </div>
                </div>

                {/* Middle Row: Water & Observation details */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "0.8rem" }}>
                    <span
                      style={{
                        fontWeight: "800",
                        color:
                          load.waterAdjustment > 0
                            ? "#f59e0b"
                            : load.waterAdjustment < 0
                            ? "#3b82f6"
                            : "#10b981",
                      }}
                    >
                      💧 Adj: {load.waterAdjustment > 0 ? `+${load.waterAdjustment}` : load.waterAdjustment} L
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                      (Act: {load.actualBatchWater} L)
                    </span>
                  </div>

                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Clock size={12} /> {load.time}
                  </span>
                </div>

                {/* Bottom Row: Observations */}
                <div style={{ paddingTop: "4px", borderTop: "1px solid var(--glass-border)" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {load.isVoid ? `[VOIDED: ${load.voidReason}]` : obsText || "Condition: Normal"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
