"use client";

import React, { useState, useMemo } from "react";
import {
  Layers,
  Truck as TruckIcon,
  Eye,
  Sliders,
  Database,
  BarChart2,
  FileSpreadsheet,
  Download,
  Plus,
  Edit2,
  Check,
  X,
  Code,
  Copy,
  RefreshCw,
} from "lucide-react";
import {
  MixDesign,
  Truck,
  ObservationOption,
  AdjustmentOption,
  LoadRecord,
  saveMixDesign,
  saveTruck,
  saveObservationOption,
  saveAdjustmentOption,
  generateUUID,
} from "@/lib/db-batching";
import { SUPABASE_SQL_SCHEMA } from "@/lib/supabase-batching";

interface AdminSettingsProps {
  mixDesigns: MixDesign[];
  trucks: Truck[];
  observationOptions: ObservationOption[];
  adjustmentOptions: AdjustmentOption[];
  loads: LoadRecord[];
  onRefreshData: () => void;
  onTriggerSync: () => void;
}

export default function AdminSettings({
  mixDesigns,
  trucks,
  observationOptions,
  adjustmentOptions,
  loads,
  onRefreshData,
  onTriggerSync,
}: AdminSettingsProps) {
  const [activeTab, setActiveTab] = useState<"mixes" | "trucks" | "options" | "sync" | "analytics">("mixes");

  // Mix modal state
  const [isEditingMix, setIsEditingMix] = useState(false);
  const [editingMix, setEditingMix] = useState<Partial<MixDesign>>({});

  // Truck modal state
  const [isEditingTruck, setIsEditingTruck] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Partial<Truck>>({});

  // Copy feedback
  const [copiedSql, setCopiedSql] = useState(false);
  const [isFetchingCookbook, setIsFetchingCookbook] = useState(false);
  const [cookbookStatus, setCookbookStatus] = useState<{ message: string; isError?: boolean; serviceEmail?: string } | null>(null);

  // === ANALYTICS CALCULATIONS ===
  const analytics = useMemo(() => {
    const activeLoads = loads.filter((l) => !l.isVoid);
    const mixCounts: { [code: string]: { count: number; totalWaterAdj: number; yards: number } } = {};
    const conditionCounts: { [cond: string]: number } = {};

    for (const load of activeLoads) {
      // Mix stats
      if (!mixCounts[load.mixCode]) {
        mixCounts[load.mixCode] = { count: 0, totalWaterAdj: 0, yards: 0 };
      }
      mixCounts[load.mixCode].count += 1;
      mixCounts[load.mixCode].totalWaterAdj += load.waterAdjustment || 0;
      mixCounts[load.mixCode].yards += Number(load.quantity || 0);

      // Conditions stats
      if (Array.isArray(load.concreteObservations)) {
        for (const obs of load.concreteObservations) {
          conditionCounts[obs] = (conditionCounts[obs] || 0) + 1;
        }
      }
    }

    return {
      totalLoads: activeLoads.length,
      totalVolume: activeLoads.reduce((sum, l) => sum + Number(l.quantity || 0), 0),
      mixCounts,
      conditionCounts,
    };
  }, [loads]);

  // Handle Save Mix
  const handleSaveMix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMix.code?.trim()) return;

    const toSave: MixDesign = {
      id: editingMix.id || `mix_${editingMix.code.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      code: editingMix.code.toUpperCase().trim(),
      description: editingMix.description || "",
      strength: editingMix.strength || "3000 PSI",
      placementType: editingMix.placementType || "Pump",
      cement: Number(editingMix.cement) || 300,
      sand: Number(editingMix.sand) || 800,
      threeQuarterStone: Number(editingMix.threeQuarterStone) || 700,
      threeEighthStone: Number(editingMix.threeEighthStone) || 280,
      designWater: Number(editingMix.designWater) || 140,
      plasticizer: Number(editingMix.plasticizer) || 350,
      retarder: Number(editingMix.retarder) || 0,
      otherAdmixture: editingMix.otherAdmixture || "",
      version: (editingMix.version || 0) + 1,
      active: editingMix.active ?? true,
      createdAt: editingMix.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    await saveMixDesign(toSave);
    setIsEditingMix(false);
    onRefreshData();
  };

  // Sync recipes directly from Google Sheets cook-book
  const handleSyncFromCookBook = async () => {
    setIsFetchingCookbook(true);
    setCookbookStatus(null);

    try {
      const res = await fetch("/api/batching/recipes");
      const data = await res.json();

      if (!res.ok) {
        if (data.isPermissionError) {
          setCookbookStatus({
            isError: true,
            message: "Google Sheets permission required. Please share the spreadsheet with the service account below:",
            serviceEmail: data.serviceAccountEmail,
          });
        } else {
          setCookbookStatus({
            isError: true,
            message: data.error || "Failed to fetch recipes.",
          });
        }
        return;
      }

      if (data.recipes && data.recipes.length > 0) {
        for (const r of data.recipes) {
          await saveMixDesign(r);
        }
        setCookbookStatus({
          isError: false,
          message: `Successfully imported ${data.recipes.length} mix designs from ${data.tabTitle || "Cook Book"}.`,
        });
        onRefreshData();
      } else {
        setCookbookStatus({
          isError: false,
          message: "Connected to Cook Book sheet, but no recipe rows found.",
        });
      }
    } catch (err: any) {
      setCookbookStatus({
        isError: true,
        message: err.message || "Network error syncing recipes",
      });
    } finally {
      setIsFetchingCookbook(false);
    }
  };

  // Handle Save Truck
  const handleSaveTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTruck.code?.trim()) return;

    const toSave: Truck = {
      id: editingTruck.id || `truck_${editingTruck.code.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      code: editingTruck.code.toUpperCase().trim(),
      driver: editingTruck.driver || "",
      capacityYards: Number(editingTruck.capacityYards) || 10,
      active: editingTruck.active ?? true,
    };

    await saveTruck(toSave);
    setIsEditingTruck(false);
    onRefreshData();
  };

  // Export CSV download
  const handleDownloadCsv = () => {
    if (loads.length === 0) {
      alert("No loads to export.");
      return;
    }

    const headers = [
      "Load ID",
      "Date",
      "Time",
      "Batcher",
      "Truck",
      "Mix Code",
      "Quantity (yd³)",
      "Sand Moisture %",
      "Design Water (L)",
      "Expected Water (L)",
      "Actual Water (L)",
      "Water Adj (L)",
      "Observations",
      "Adjustments",
      "Notes",
      "Sync Status",
    ];

    const rows = loads.map((l) => [
      `"${l.id}"`,
      `"${l.date}"`,
      `"${l.time}"`,
      `"${l.batcherName}"`,
      `"${l.truckCode}"`,
      `"${l.mixCode}"`,
      l.quantity,
      l.sandMoisturePercent,
      l.designWater,
      l.expectedBatchWater,
      l.actualBatchWater,
      l.waterAdjustment,
      `"${Array.isArray(l.concreteObservations) ? l.concreteObservations.join("; ") : ""}"`,
      `"${Array.isArray(l.batchAdjustments) ? l.batchAdjustments.map((a) => a.label).join("; ") : ""}"`,
      `"${(l.batcherNotes || "").replace(/"/g, '""')}"`,
      `"${l.syncStatus}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CK_Batching_Diary_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copySqlSchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Navigation Sub-Tabs */}
      <div
        className="segmented-control"
        style={{
          display: "flex",
          maxWidth: "100%",
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          className={`segment-item ${activeTab === "mixes" ? "active" : ""}`}
          onClick={() => setActiveTab("mixes")}
        >
          Mix Designs ({mixDesigns.length})
        </button>
        <button
          type="button"
          className={`segment-item ${activeTab === "trucks" ? "active" : ""}`}
          onClick={() => setActiveTab("trucks")}
        >
          Trucks ({trucks.length})
        </button>
        <button
          type="button"
          className={`segment-item ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          Analytics & Trends
        </button>
        <button
          type="button"
          className={`segment-item ${activeTab === "sync" ? "active" : ""}`}
          onClick={() => setActiveTab("sync")}
        >
          Supabase & Sheets
        </button>
      </div>

      {/* ================= TAB 1: MIX DESIGNS ================= */}
      {activeTab === "mixes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>
              Central Mix Designs
            </h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleSyncFromCookBook}
                disabled={isFetchingCookbook}
                style={{ padding: "8px 14px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <RefreshCw size={14} className={isFetchingCookbook ? "animate-spin" : ""} />
                {isFetchingCookbook ? "Syncing..." : "Sync from Google Sheet"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setEditingMix({
                    code: "",
                    description: "",
                    strength: "3000 PSI",
                    placementType: "Pump",
                    cement: 300,
                    sand: 800,
                    threeQuarterStone: 700,
                    threeEighthStone: 280,
                    designWater: 140,
                    plasticizer: 350,
                    retarder: 0,
                    active: true,
                  });
                  setIsEditingMix(true);
                }}
                style={{ padding: "8px 16px", fontSize: "0.85rem", width: "auto" }}
              >
                <Plus size={16} /> Add Mix Design
              </button>
            </div>
          </div>

          {/* Cook-Book status or permission prompt */}
          {cookbookStatus && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "12px",
                backgroundColor: cookbookStatus.isError ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                border: `1px solid ${cookbookStatus.isError ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                fontSize: "0.85rem",
                color: "var(--text-primary)",
                lineHeight: "1.5",
              }}
            >
              <div style={{ fontWeight: "700", color: cookbookStatus.isError ? "#ef4444" : "#10b981", marginBottom: "4px" }}>
                {cookbookStatus.isError ? "Google Sheet Sync Notice" : "Recipes Synced Successfully"}
              </div>
              <div>{cookbookStatus.message}</div>
              {cookbookStatus.serviceEmail && (
                <div style={{ marginTop: "8px", padding: "8px 12px", borderRadius: "8px", backgroundColor: "rgba(0,0,0,0.3)", fontFamily: "monospace", fontSize: "0.8rem", color: "#60a5fa" }}>
                  {cookbookStatus.serviceEmail}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
            {mixDesigns.map((mix) => (
              <div
                key={mix.id}
                className="glass-panel"
                style={{
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "1.25rem", fontWeight: "900", color: "#e05300" }}>{mix.code}</span>
                    <span className={`badge ${mix.active ? "synced" : "failed"}`}>
                      {mix.active ? "Active" : "Inactive"} (v{mix.version})
                    </span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                    {mix.description}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    {mix.strength} &bull; {mix.placementType}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "6px",
                    fontSize: "0.75rem",
                    padding: "8px",
                    borderRadius: "8px",
                    backgroundColor: "var(--bg-tertiary)",
                  }}
                >
                  <div>Design Water: <strong>{mix.designWater} L/yd</strong></div>
                  <div>Cement: <strong>{mix.cement} kg</strong></div>
                  <div>Sand: <strong>{mix.sand} kg</strong></div>
                  <div>¾ Stone: <strong>{mix.threeQuarterStone} kg</strong></div>
                </div>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingMix(mix);
                    setIsEditingMix(true);
                  }}
                  style={{ fontSize: "0.8rem", padding: "6px" }}
                >
                  <Edit2 size={13} /> Edit Mix Parameters
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 2: TRUCKS ================= */}
      {activeTab === "trucks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>
              Active Mixer Fleet
            </h3>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditingTruck({ code: "CT", driver: "", capacityYards: 10, active: true });
                setIsEditingTruck(true);
              }}
              style={{ padding: "8px 16px", fontSize: "0.85rem", width: "auto" }}
            >
              <Plus size={16} /> Add Mixer Truck
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
            {trucks.map((truck) => (
              <div
                key={truck.id}
                className="glass-panel"
                style={{
                  padding: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "900", color: "var(--text-primary)" }}>
                    {truck.code}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {truck.driver || "Unassigned"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Capacity: {truck.capacityYards} yd³
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingTruck(truck);
                    setIsEditingTruck(true);
                  }}
                  style={{ padding: "8px" }}
                >
                  <Edit2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 3: ANALYTICS & TRENDS ================= */}
      {activeTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>
              Batching Analysis & Quality Trends
            </h3>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDownloadCsv}
              style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
            >
              <Download size={15} /> Export CSV
            </button>
          </div>

          {/* Loads by Mix Table */}
          <div className="glass-panel" style={{ padding: "1.25rem" }}>
            <h4 style={{ fontSize: "0.95rem", marginBottom: "10px", color: "var(--text-primary)" }}>
              Loads & Average Water Adjustment by Mix
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {Object.keys(analytics.mixCounts).length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No loads batched yet.</div>
              ) : (
                Object.entries(analytics.mixCounts).map(([mixCode, data]) => {
                  const avgAdj = Math.round(data.totalWaterAdj / data.count);
                  return (
                    <div
                      key={mixCode}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        backgroundColor: "var(--bg-tertiary)",
                      }}
                    >
                      <div>
                        <strong style={{ color: "#e05300", fontSize: "1rem" }}>{mixCode}</strong>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          {data.count} loads ({data.yards.toFixed(1)} yd³)
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontSize: "0.95rem",
                            fontWeight: "800",
                            color: avgAdj > 0 ? "#f59e0b" : avgAdj < 0 ? "#3b82f6" : "#10b981",
                          }}
                        >
                          Avg Water Adj: {avgAdj > 0 ? `+${avgAdj}` : avgAdj} L
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Condition Distribution */}
          <div className="glass-panel" style={{ padding: "1.25rem" }}>
            <h4 style={{ fontSize: "0.95rem", marginBottom: "10px", color: "var(--text-primary)" }}>
              Observable Concrete Conditions
            </h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {Object.entries(analytics.conditionCounts).map(([cond, count]) => (
                <div
                  key={cond}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--glass-border)",
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>{cond}</span>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(224, 83, 0, 0.2)",
                      color: "#e05300",
                      fontWeight: "800",
                      fontSize: "0.75rem",
                    }}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: SUPABASE & SHEETS ================= */}
      {activeTab === "sync" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontSize: "1.1rem", margin: "0 0 8px 0", color: "var(--text-primary)" }}>
              Authoritative Data Pipeline Status
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
              Following strict specification: Tablet commits to IndexedDB first &bull; Background syncs to Supabase Cloud &bull; Supabase automatically forwards analytical flat records into Google Sheets.
            </p>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={onTriggerSync}
                style={{ width: "auto", padding: "10px 18px", fontSize: "0.9rem" }}
              >
                <RefreshCw size={16} /> Run Full Cloud Synchronization
              </button>
            </div>
          </div>

          {/* Supabase Schema Helper */}
          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h4 style={{ margin: 0, fontSize: "1rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Code size={18} color="#10b981" /> Supabase Database Schema (PostgreSQL DDL)
              </h4>
              <button
                type="button"
                className="btn-secondary"
                onClick={copySqlSchema}
                style={{ fontSize: "0.8rem", padding: "6px 12px", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <Copy size={14} /> {copiedSql ? "Copied SQL!" : "Copy SQL"}
              </button>
            </div>
            <pre
              style={{
                backgroundColor: "rgba(0,0,0,0.4)",
                padding: "14px",
                borderRadius: "10px",
                fontSize: "0.75rem",
                color: "#9ca3af",
                overflowX: "auto",
                maxHeight: "220px",
                lineHeight: "1.4",
              }}
            >
              {SUPABASE_SQL_SCHEMA}
            </pre>
          </div>
        </div>
      )}

      {/* Edit Mix Modal */}
      {isEditingMix && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "540px" }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{editingMix.id ? "Edit Mix Design" : "Add Mix Design"}</h3>
              <button className="modal-close" onClick={() => setIsEditingMix(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveMix} className="modal-body">
              <div className="form-group">
                <label>Mix Code (e.g. P-3000, W-3500)</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={editingMix.code || ""}
                  onChange={(e) => setEditingMix({ ...editingMix, code: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingMix.description || ""}
                  onChange={(e) => setEditingMix({ ...editingMix, description: e.target.value })}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="form-group">
                  <label>Strength</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingMix.strength || "3000 PSI"}
                    onChange={(e) => setEditingMix({ ...editingMix, strength: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Placement Type</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingMix.placementType || "Pump"}
                    onChange={(e) => setEditingMix({ ...editingMix, placementType: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div className="form-group">
                  <label>Design Water (L/yd³)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editingMix.designWater || 140}
                    onChange={(e) => setEditingMix({ ...editingMix, designWater: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Cement (kg/yd³)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editingMix.cement || 300}
                    onChange={(e) => setEditingMix({ ...editingMix, cement: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Sand (kg/yd³)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editingMix.sand || 800}
                    onChange={(e) => setEditingMix({ ...editingMix, sand: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="form-group">
                  <label>¾ Stone (kg/yd³)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editingMix.threeQuarterStone || 700}
                    onChange={(e) => setEditingMix({ ...editingMix, threeQuarterStone: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>⅜ Stone (kg/yd³)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editingMix.threeEighthStone || 280}
                    onChange={(e) => setEditingMix({ ...editingMix, threeEighthStone: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsEditingMix(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Mix Design
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Truck Modal */}
      {isEditingTruck && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "440px" }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{editingTruck.id ? "Edit Truck" : "Add Mixer Truck"}</h3>
              <button className="modal-close" onClick={() => setIsEditingTruck(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveTruck} className="modal-body">
              <div className="form-group">
                <label>Truck Code (e.g. CT3628)</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={editingTruck.code || ""}
                  onChange={(e) => setEditingTruck({ ...editingTruck, code: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Assigned Driver Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingTruck.driver || ""}
                  onChange={(e) => setEditingTruck({ ...editingTruck, driver: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Drum Capacity (Cubic Yards)</label>
                <input
                  type="number"
                  step="0.5"
                  className="form-input"
                  value={editingTruck.capacityYards || 10}
                  onChange={(e) => setEditingTruck({ ...editingTruck, capacityYards: parseFloat(e.target.value) })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsEditingTruck(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Truck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
