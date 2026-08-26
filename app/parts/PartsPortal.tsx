"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import imageCompression from "browser-image-compression";
import {
  Package, Droplets, History, Plus, RefreshCw, Wifi, WifiOff,
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Search,
  Camera, X, Wrench, Settings, Trash2, ShieldCheck
} from "lucide-react";
import {
  getAllParts, savePart, updatePart, deletePart,
  getAllStockEvents, saveStockEvent, getPendingStockEvents, updateStockEventStatus,
  deleteStockEvent, getSetting, saveSetting, pullRemoteData
} from "@/lib/db-parts";

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { code: "AR", label: "Air System" },
  { code: "BR", label: "Brakes" },
  { code: "BD", label: "Chassis & Body" },
  { code: "CP", label: "Concrete Pump System" },
  { code: "PM", label: "Consumables / Service" },
  { code: "CL", label: "Cooling System" },
  { code: "DM", label: "Drum & Mixing System" },
  { code: "EL", label: "Electrical System" },
  { code: "EN", label: "Engine" },
  { code: "HO", label: "Hose" },
  { code: "HY", label: "Hydraulic System" },
  { code: "LT", label: "Lights" },
  { code: "MS", label: "Miscellaneous" },
  { code: "NB", label: "Nuts & Bolts" },
  { code: "SL", label: "Seals & Gaskets" },
  { code: "ST", label: "Steering" },
  { code: "SU", label: "Suspension" },
  { code: "TL", label: "Tools" },
  { code: "TX", label: "Transmission & Driveline" },
  { code: "TY", label: "Tire and Wheels" },
];

const UNITS = ["each", "set", "metre", "gal", "litre", "kg", "box", "drum"];

const OIL_TYPES = [
  "Engine Oil",
  "Transmission Oil",
  "Differential Gear Oil",
  "Hydraulic Oil",
  "Coolant",
  "Grease",
];

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateItemNumber(category: string, partName: string, unit: string, existingParts: any[]): string {
  const isOil = unit === "gal" || OIL_TYPES.some((t) => partName.toLowerCase().startsWith(t.toLowerCase()));
  const prefix = isOil ? "OL-" : `${category}-`;
  
  const numbers = (existingParts || [])
    .filter((p) => {
      const pIsOil = p.unit === "gal" || OIL_TYPES.some((t) => p.name.toLowerCase().startsWith(t.toLowerCase()));
      if (isOil) {
        return pIsOil && p.id && p.id.startsWith("OL-");
      } else {
        return !pIsOil && p.category === category && p.id && p.id.startsWith(prefix);
      }
    })
    .map((p) => {
      const numStr = p.id.slice(prefix.length);
      const num = parseInt(numStr, 10);
      return isNaN(num) ? 0 : num;
    });

  const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

function getCategoryLabel(code: string) {
  return CATEGORIES.find((c) => c.code === code)?.label || code;
}

// ── Category badge colours ───────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  TY: "#6366f1", SU: "#8b5cf6", BR: "#ef4444", ST: "#f59e0b",
  EN: "#e05300", CL: "#06b6d4", TX: "#10b981", HY: "#3b82f6",
  EL: "#f59e0b", AR: "#64748b", CP: "#e05300", DM: "#a855f7",
  BD: "#6b7280", PM: "#22c55e", HO: "#14b8a6", TL: "#f97316",
  SL: "#a855f7", NB: "#6b7280", LT: "#eab308", MS: "#94a3b8",
};

// ── Offline auto-categorisation ───────────────────────────────────────────────
// Pure keyword lookup — no network, no AI, works 100% offline.
// Rules are ordered from most specific → least specific so compound names
// (e.g. "brake hose") hit the right bucket.
const CATEGORY_RULES: Array<{ keywords: string[]; code: string }> = [
  // Concrete Pump System — check before generic "pump"
  { keywords: ["boom", "outrigger", "s-valve", "s valve", "wear plate", "spectacle", "glasses plate", "putzmeister", "schwing", "pump pipe", "pump hose", "pump clamp", "pump coupling", "reducer elbow", "agitator gear", "slewing ring", "hopper", "rock valve", "concrete pump"], code: "CP" },
  // Drum & Mixing System
  { keywords: ["drum", "mixer", "mixing blade", "mixing fin", "charge chute", "discharge chute", "water tank drum", "counter gear", "drum seal", "drum motor", "drum drive"], code: "DM" },
  // Tire and Wheels
  { keywords: ["tyre", "tire", "wheel", "rim", "inner tube", "valve stem", "bead", "lug nut", "wheel bolt", "wheel stud"], code: "TY" },
  // Brakes — before "shoe" and "drum" to win compound names
  { keywords: ["brake pad", "brake shoe", "brake disc", "brake drum", "brake rotor", "brake lining", "caliper", "brake caliper", "wheel cylinder", "brake master", "brake booster", "brake fluid", "abs sensor", "brake chamber", "slack adjuster", "brake"], code: "BR" },
  // Air System
  { keywords: ["air compressor", "air dryer", "glad hand", "gladhand", "air line", "air tank", "air reservoir", "air filter compressor", "brake air", "air system", "air valve", "purge valve"], code: "AR" },
  // Steering
  { keywords: ["steering", "rack and pinion", "steering rack", "steering column", "steering pump", "power steering", "drag link", "tie rod", "king pin", "kingpin", "pitman arm", "idler arm", "steering gear"], code: "ST" },
  // Suspension
  { keywords: ["leaf spring", "coil spring", "shock absorber", "shock mount", "strut", "air spring", "suspension", "bushing", "bush", "sway bar", "stabilizer link", "control arm", "ball joint", "u-bolt", "shackle", "rubber mount"], code: "SU" },
  // Cooling System — before generic "pump" and "hose"
  { keywords: ["radiator", "thermostat", "coolant", "antifreeze", "water pump", "cooling fan", "fan belt", "radiator hose", "overflow tank", "intercooler", "cooling"], code: "CL" },
  // Transmission & Driveline — before "oil"
  { keywords: ["transmission", "gearbox", "clutch", "clutch plate", "clutch disc", "pressure plate", "release bearing", "pilot bearing", "driveshaft", "propshaft", "differential", "axle", "cv joint", "universal joint", "u joint", "transfer case", "gear oil", "trans oil", "gearbox oil"], code: "TX" },
  // Hydraulic System
  { keywords: ["hydraulic cylinder", "hydraulic pump", "hydraulic valve", "hydraulic hose", "hydraulic seal", "hydraulic fluid", "hydraulic oil", "hydraulic filter", "hydraulic accumulator", "hydraulic"], code: "HY" },
  // Seals & Gaskets
  { keywords: ["gasket", "seal kit", "o-ring", "drum seal", "shaft seal", "oil seal", "head gasket", "valve guide seal", "seal set"], code: "SL" },
  // Lights
  { keywords: ["light", "bulb", "lamp", "headlight", "tail light", "marker light", "led light", "beacon", "strobe", "lens", "reflector"], code: "LT" },
  // Nuts & Bolts
  { keywords: ["nut", "bolt", "washer", "screw", "stud", "fastener", "rivet", "thread", "pin", "cotter pin", "clip", "fitting", "coupling"], code: "NB" },
  // Electrical System
  { keywords: ["battery", "alternator", "starter motor", "fuse", "maxi fuse", "relay", "switch", "sensor", "ecu", "module", "wiring", "harness", "wire", "horn", "ignition", "ignition coil", "spark plug", "glow plug", "electrical", "solenoid", "motor", "actuator"], code: "EL" },
  // Engine — after electrical (starter/alternator) and cooling (water pump)
  { keywords: ["engine", "piston", "piston ring", "cylinder liner", "valve stem", "valve guide", "crankshaft", "camshaft", "con rod", "connecting rod", "timing belt", "timing chain", "fuel injector", "injection pump", "turbocharger", "turbo", "manifold", "exhaust manifold", "intake manifold", "oil filter", "air filter", "fuel filter", "engine mount", "oil pump", "engine oil", "motor oil"], code: "EN" },
  // Hose — generic hose after specific system hoses
  { keywords: ["hose", "pipe fitting", "hose clamp", "ferrule", "hose coupling", "hose assembly", "rubber hose", "flex hose", "flexible hose"], code: "HO" },
  // Chassis & Body
  { keywords: ["chassis", "frame", "body", "cab", "door", "mirror", "glass", "windshield", "windscreen", "seat", "bumper", "step", "mudguard", "fender", "panel", "hook", "fifth wheel", "king plate", "floor"], code: "BD" },
  // Tools
  { keywords: ["wrench", "spanner", "screwdriver", "drill", "grinder", "hammer", "socket", "ratchet", "pliers", "torque wrench", "jack", "jack stand", "tool", "gauge", "puller", "press"], code: "TL" },
  // Consumables / Service — general oils, filters, fluids last
  { keywords: ["oil", "grease", "lubricant", "fluid", "cleaner", "degreaser", "paint", "rag", "filter", "consumable", "service kit", "maintenance kit"], code: "PM" },
];

/**
 * Suggests a category code from a part name using offline keyword matching.
 * Returns null if no confident match is found (default stays "PM").
 */
function autoCategory(name: string): string | null {
  if (!name || name.trim().length < 2) return null;
  const lower = name.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.code;
    }
  }
  return null;
}


// ── Main Component ────────────────────────────────────────────────────────────

export default function PartsPortal() {
  const [activeTab, setActiveTab] = useState<"catalogue" | "oils" | "history">("catalogue");
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [attendantName, setAttendantName] = useState("");

  // Catalogue state
  const [parts, setParts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [selectedPart, setSelectedPart] = useState<any | null>(null);
  const [showAddPart, setShowAddPart] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [editingPart, setEditingPart] = useState<any | null>(null);
  const [showEditPart, setShowEditPart] = useState(false);

  // Oils — derived from parts, no separate store
  const [showAddOil, setShowAddOil] = useState(false);

  // History state
  const [stockEvents, setStockEvents] = useState<any[]>([]);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);

  // Settings
  const [showSettings, setShowSettings] = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    // 1. Initial quick load from local IndexedDB
    const [allParts, allEvents, name] = await Promise.all([
      getAllParts(),
      getAllStockEvents(),
      getSetting("attendantName"),
    ]);
    setParts(allParts);
    setStockEvents(allEvents);
    setAttendantName(name);

    const pending = await getPendingStockEvents();
    setPendingCount(pending.length);

    // 2. If online, fetch canonical catalogue from Google Sheets and merge
    if (navigator.onLine) {
      try {
        const res = await fetch("/api/parts-catalogue");
        const data = await res.json();
        if (data.success && Array.isArray(data.parts)) {
          const freshLocalParts = await getAllParts();
          const existingMap = new Map(freshLocalParts.map((p: any) => [p.id, p]));
          const sheetPartIds = new Set(data.parts.map((p: any) => p.id));
          let dbChanged = false;

          // Process parts from sheet
          for (const sheetPart of data.parts) {
            const localPart = existingMap.get(sheetPart.id);
            
            // Calculate adjusted stock level using local pending usage/restock logs
            const partPendingEvents = pending.filter((e: any) => e.partId === sheetPart.id);
            const pendingDelta = partPendingEvents.reduce((sum: number, e: any) => sum + e.delta, 0);
            const reconciledStock = Math.max(0, sheetPart.currentStock + pendingDelta);

            const updatedPart = {
              ...localPart,
              ...sheetPart,
              currentStock: reconciledStock,
              synced: true, // Mark as synced
            };

            if (localPart) {
              // Retain local compressed image data url if sheet doesn't have a photo URL
              updatedPart.photoDataUrl = localPart.photoDataUrl || sheetPart.photoDataUrl;
            }

            // Write to local database if new or values differ
            if (!localPart) {
              await savePart(updatedPart);
              dbChanged = true;
            } else {
              const diff =
                localPart.name !== updatedPart.name ||
                localPart.category !== updatedPart.category ||
                localPart.unit !== updatedPart.unit ||
                localPart.currentStock !== updatedPart.currentStock ||
                localPart.lowStockThreshold !== updatedPart.lowStockThreshold ||
                localPart.driveUrl !== updatedPart.driveUrl ||
                localPart.driveFileId !== updatedPart.driveFileId ||
                localPart.notes !== updatedPart.notes ||
                localPart.location !== updatedPart.location ||
                localPart.synced !== true;

              if (diff) {
                await savePart(updatedPart);
                dbChanged = true;
              }
            }
          }

          // Handle deletions: remove local parts that were previously marked synced but no longer on the sheet
          for (const localPart of freshLocalParts) {
            if (localPart.synced === true && !sheetPartIds.has(localPart.id)) {
              await deletePart(localPart.id);
              dbChanged = true;
            }
          }

          if (dbChanged) {
            const mergedParts = await getAllParts();
            setParts(mergedParts);
          }
        }
      } catch (err) {
        console.warn("Failed to sync parts catalogue from Google Sheets:", err);
      }
    }
  }, []);

  // ── Sync ────────────────────────────────────────────────────────────────────
  const triggerSync = useCallback(async () => {
    if (syncing || !navigator.onLine) return;
    setSyncing(true);
    try {
      // 1. Pull remote stock events first
      await pullRemoteData();

      // 2. Sync unsynced parts first
      const localParts = await getAllParts();
      const unsyncedParts = localParts.filter((p) => p.synced === false);
      for (const part of unsyncedParts) {
        const res = await fetch("/api/parts-catalogue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ part }),
        });
        const data = await res.json();
        if (data.success) {
          await updatePart(part.id, { synced: true });
        }
      }

      // 3. Sync pending stock events
      const pendingEvents = await getPendingStockEvents();
      if (pendingEvents.length > 0) {
        const res = await fetch("/api/parts-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: pendingEvents }),
        });
        const data = await res.json();
        if (data.success) {
          for (const id of [...data.synced, ...data.skipped]) {
            await updateStockEventStatus(id, "synced");
          }
        }
      }
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      console.error("Parts sync error:", err);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  // Load data on mount or when refreshTrigger is incremented
  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  // ── Network listeners & SW registration ─────────────────────────────────────
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production" && window.location.hostname !== "localhost") {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .catch((err) => console.warn("[SW] Registration failed:", err));
      } else {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
    }
    setIsOnline(navigator.onLine);
    const handleOnline = () => { setIsOnline(true); triggerSync(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    triggerSync();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [triggerSync]);

  const refresh = () => setRefreshTrigger((p) => p + 1);

  const handleDeleteEvent = async (event: any) => {
    if (event.status === "synced" && !navigator.onLine) {
      alert("You must be online to delete already synced history entries.");
      return;
    }

    if (!confirm(`Are you sure you want to delete this transaction for "${event.partName}"?`)) {
      return;
    }

    if (event.status === "synced" && navigator.onLine) {
      try {
        const res = await fetch(`/api/parts-log?id=${encodeURIComponent(event.id)}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
      } catch (err) {
        alert("Failed to delete from Google Sheet: " + (err as Error).message);
        return;
      }
    }

    const part = parts.find((p: any) => p.id === event.partId);
    if (part) {
      const newStock = Math.max(0, (part.currentStock || 0) - event.delta);
      await updatePart(event.partId, { currentStock: newStock });
    }

    await deleteStockEvent(event.id);
    refresh();
    triggerSync();
  };

  const handleEditPart = (p: any) => {
    setEditingPart(p);
    setShowEditPart(true);
  };

  const handleDeletePart = async (p: any) => {
    if (confirm(`Delete "${p.name}"? This cannot be undone.`)) {
      await deletePart(p.id);
      if (navigator.onLine) {
        try {
          await fetch(`/api/parts-catalogue?id=${encodeURIComponent(p.id)}`, {
            method: "DELETE",
          });
        } catch (err) {
          console.warn("Failed to sync part deletion to sheet:", err);
        }
      }
      refresh();
    }
  };


  // ── Filtered parts ───────────────────────────────────────────────────────────
  const filteredParts = parts.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = filterCategory === "ALL" || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-title-container">
          <h1 className="header-title">Concrete Kings <span>Parts</span></h1>
          <div className="header-subtitle">Parts & Inventory Portal</div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-secondary"
            style={{ padding: "8px 12px", borderRadius: "10px" }}
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={() => { refresh(); triggerSync(); }}
            className="btn-secondary"
            style={{ padding: "8px 12px", borderRadius: "10px" }}
            disabled={syncing}
            title="Sync"
          >
            <RefreshCw size={16} className={syncing ? "spin-anim" : ""} />
          </button>
        </div>
      </header>

      {/* Sync banner */}
      {!isOnline ? (
        <div className="sync-banner offline-pending">
          <WifiOff size={14} />
          <span>Offline — {pendingCount} event{pendingCount !== 1 ? "s" : ""} queued</span>
        </div>
      ) : pendingCount > 0 ? (
        <div className="sync-banner offline-pending">
          <RefreshCw size={14} className="spin-anim" />
          <span>Syncing {pendingCount} pending event{pendingCount !== 1 ? "s" : ""}…</span>
        </div>
      ) : (
        <div className="sync-banner online-synced">
          <Wifi size={14} />
          <span>Connected — Sync active</span>
        </div>
      )}

      {/* Main content */}
      <main className="screen-wrapper">
        {activeTab === "catalogue" && (
          <CatalogueTab
            parts={filteredParts}
            allParts={parts}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            onSelectPart={(p: any) => { setSelectedPart(p); setShowUsageModal(true); }}
            onEditPart={handleEditPart}
            onDeletePart={handleDeletePart}
            onAddPart={() => setShowAddPart(true)}
            attendantName={attendantName}
            onRefresh={refresh}
          />
        )}
        {activeTab === "oils" && (
          <OilsTab
            parts={parts}
            attendantName={attendantName}
            onAddOil={() => setShowAddOil(true)}
            onSelectOil={(p: any) => { setSelectedPart(p); setShowUsageModal(true); }}
            onEditOil={handleEditPart}
            onDeleteOil={handleDeletePart}
            onRefresh={refresh}
          />
        )}
        {activeTab === "history" && (
          <HistoryTab
            events={stockEvents}
            onEditEvent={(ev: any) => { setEditingEvent(ev); setShowEditEvent(true); }}
            onDeleteEvent={handleDeleteEvent}
          />
        )}
      </main>

      {/* Bottom nav */}
      <nav className="tab-navbar">
        <button onClick={() => setActiveTab("catalogue")} className={`tab-button ${activeTab === "catalogue" ? "active" : ""}`}>
          <div className="tab-icon-wrapper"><Package size={22} /></div>
          <span>Catalogue</span>
        </button>
        <button onClick={() => setActiveTab("oils")} className={`tab-button ${activeTab === "oils" ? "active" : ""}`}>
          <div className="tab-icon-wrapper"><Droplets size={22} /></div>
          <span>Oils</span>
        </button>
        <button onClick={() => setActiveTab("history")} className={`tab-button ${activeTab === "history" ? "active" : ""}`}>
          <div className="tab-icon-wrapper" style={{ position: "relative" }}>
            <History size={22} />
            {pendingCount > 0 && (
              <div className="tab-badge">{pendingCount}</div>
            )}
          </div>
          <span>History</span>
        </button>
      </nav>

      {/* Modals */}
      {showUsageModal && selectedPart && (
        <UsageModal
          part={selectedPart}
          attendantName={attendantName}
          onClose={() => { setShowUsageModal(false); setSelectedPart(null); }}
          onSaved={refresh}
        />
      )}
      {showAddPart && (
        <AddPartModal
          existingParts={parts}
          onClose={() => setShowAddPart(false)}
          onSaved={refresh}
        />
      )}
      {showEditPart && editingPart && (
        <EditPartModal
          part={editingPart}
          onClose={() => { setShowEditPart(false); setEditingPart(null); }}
          onSaved={refresh}
        />
      )}
      {showAddOil && (
        <AddOilModal
          existingParts={parts}
          onClose={() => setShowAddOil(false)}
          onSaved={refresh}
        />
      )}
      {showSettings && (
        <SettingsModal
          attendantName={attendantName}
          onSave={async (name: string) => {
            await saveSetting("attendantName", name);
            setAttendantName(name);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showEditEvent && editingEvent && (
        <EditHistoryModal
          event={editingEvent}
          parts={parts}
          onClose={() => { setShowEditEvent(false); setEditingEvent(null); }}
          onSaved={() => { refresh(); triggerSync(); }}
        />
      )}

      {showEventDetails && selectedEvent && (
        <HistoryDetailsModal
          event={selectedEvent}
          onClose={() => { setShowEventDetails(false); setSelectedEvent(null); }}
          onEdit={() => { setEditingEvent(selectedEvent); setShowEditEvent(true); }}
          onDelete={() => handleDeleteEvent(selectedEvent)}
        />
      )}

      <footer style={{ padding: "1.25rem 2rem", marginTop: "2rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
        <ShieldCheck size={16} style={{ color: "var(--success)" }} />
        <span>CK Parts Portal &bull; Secure &copy; {new Date().getFullYear()}</span>
      </footer>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-anim { animation: spin 1.5s linear infinite; }
        .part-card { transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s; cursor: pointer; }
        .part-card:hover { transform: translateY(-3px); border-color: rgba(224,83,0,0.4) !important; box-shadow: 0 6px 24px rgba(224,83,0,0.1); }
        .part-card:active { transform: scale(0.97); }
        .oil-card { transition: border-color 0.15s; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: flex-end; justify-content: center; padding: 1rem; }
        @media (min-width: 600px) { .modal-backdrop { align-items: center; } }
        .modal-sheet { background: var(--bg-secondary, #16181f); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px 20px 16px 16px; width: 100%; max-width: 520px; max-height: 92vh; overflow-y: auto; padding: 1.5rem; }
        @media (min-width: 600px) { .modal-sheet { border-radius: 20px; } }
        .form-label { display: block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 6px; }
        .form-input { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 14px; color: var(--text-primary, #f3f4f6); font-size: 0.95rem; outline: none; box-sizing: border-box; }
        .form-input:focus { border-color: rgba(224,83,0,0.5); }
        .photo-preview { width: 100%; aspect-ratio: 4/3; border-radius: 12px; object-fit: cover; margin-top: 8px; }
        .photo-upload-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px; border-radius: 12px; border: 2px dashed rgba(224,83,0,0.3); background: rgba(224,83,0,0.05); color: #e05300; font-weight: 700; cursor: pointer; font-size: 0.9rem; }
        .photo-upload-btn:hover { border-color: rgba(224,83,0,0.6); background: rgba(224,83,0,0.1); }
        .qty-row { display: flex; align-items: center; gap: 12px; }
        .qty-btn { width: 40px; height: 40px; border-radius: 10px; background: rgba(224,83,0,0.12); border: 1px solid rgba(224,83,0,0.25); color: #e05300; font-size: 1.3rem; font-weight: 700; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .qty-btn:hover { background: rgba(224,83,0,0.2); }
        .qty-display { flex: 1; text-align: center; font-size: 1.6rem; font-weight: 800; }
        .progress-bar-wrap { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden; }
        .progress-bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s; }
        .fab { position: fixed; bottom: calc(80px + env(safe-area-inset-bottom, 0px) + 1rem); right: 1.25rem; width: 56px; height: 56px; border-radius: 50%; background: #e05300; border: none; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(224,83,0,0.45); cursor: pointer; z-index: 100; transition: transform 0.15s, box-shadow 0.15s; }
        .fab:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(224,83,0,0.55); }
        .fab:active { transform: scale(0.95); }
        .category-chip { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.04em; }
        .low-stock-badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; }
        .event-row { display: flex; gap: 10px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .status-chip { font-size: 0.65rem; font-weight: 700; padding: 2px 7px; border-radius: 5px; text-transform: uppercase; letter-spacing: 0.04em; }
        .status-pending { background: rgba(245,158,11,0.15); color: #fbbf24; }
        .status-synced { background: rgba(16,185,129,0.15); color: #34d399; }
        .status-failed { background: rgba(239,68,68,0.15); color: #f87171; }
        .search-row { display: flex; gap: 8px; margin-bottom: 16px; }
        .cat-filter-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 16px; scrollbar-width: none; }
        .cat-filter-scroll::-webkit-scrollbar { display: none; }
        .cat-chip { flex-shrink: 0; padding: 5px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
        .cat-chip.active { background: rgba(224,83,0,0.15); border-color: rgba(224,83,0,0.4); color: #e05300; }
        .parts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
        @media (min-width: 480px) { .parts-grid { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); } }
        .card-menu-btn { position: absolute; top: 6px; right: 6px; width: 28px; height: 28px; border-radius: 8px; background: rgba(0,0,0,0.5); border: none; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: opacity 0.15s; z-index: 2; }
        .part-card:hover .card-menu-btn { opacity: 1; }
        .card-menu-btn:focus { opacity: 1; }
        .card-dropdown { position: absolute; top: 38px; right: 6px; background: #1e2029; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; overflow: hidden; z-index: 10; min-width: 130px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
        .card-dropdown button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; background: none; border: none; color: #f3f4f6; font-size: 0.85rem; font-weight: 600; cursor: pointer; text-align: left; }
        .card-dropdown button:hover { background: rgba(255,255,255,0.06); }
        .card-dropdown button.danger { color: #f87171; }
      `}</style>
    </div>
  );
}

// ── Catalogue Tab ─────────────────────────────────────────────────────────────

function CatalogueTab({ parts, allParts, searchQuery, setSearchQuery, filterCategory, setFilterCategory, onSelectPart, onEditPart, onDeletePart, onAddPart, attendantName, onRefresh }: any) {
  return (
    <div>
      {/* Search */}
      <div className="search-row">
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="form-input"
            style={{ paddingLeft: "36px" }}
            placeholder="Search parts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="cat-filter-scroll">
        <button className={`cat-chip ${filterCategory === "ALL" ? "active" : ""}`} onClick={() => setFilterCategory("ALL")}>All</button>
        {CATEGORIES.map((c) => (
          <button
            key={c.code}
            className={`cat-chip ${filterCategory === c.code ? "active" : ""}`}
            onClick={() => setFilterCategory(c.code)}
          >
            {c.code} — {c.label}
          </button>
        ))}
      </div>

      {/* Parts grid */}
      {parts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
          <Package size={40} style={{ opacity: 0.3, marginBottom: "12px" }} />
          <p style={{ margin: 0 }}>{allParts.length === 0 ? "No parts yet. Tap ＋ to add the first one." : "No parts match your search."}</p>
        </div>
      ) : (
        <div className="parts-grid">
          {parts.map((part: any) => (
            <PartCard
              key={part.id}
              part={part}
              onClick={() => onSelectPart(part)}
              onEdit={() => onEditPart(part)}
              onDelete={() => onDeletePart(part)}
            />
          ))}
        </div>
      )}

      {/* FAB */}
      <button className="fab" onClick={onAddPart} title="Add new part">
        <Plus size={26} />
      </button>
    </div>
  );
}

function PartCard({ part, onClick, onEdit, onDelete }: { part: any; onClick: () => void; onEdit: () => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isLow = part.currentStock <= part.lowStockThreshold;
  const catColor = CATEGORY_COLORS[part.category] || "#94a3b8";

  return (
    <div
      className="part-card"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${isLow ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "14px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Photo / placeholder — clicking opens usage modal */}
      <div
        onClick={onClick}
        style={{ width: "100%", aspectRatio: "4/3", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer" }}
      >
        {part.photoDataUrl ? (
          <img src={part.photoDataUrl} alt={part.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", color: "rgba(255,255,255,0.15)" }}>
            <div style={{ fontSize: "1.5rem", fontWeight: "900", color: catColor, opacity: 0.7 }}>{part.category}</div>
            <Wrench size={20} />
          </div>
        )}
      </div>

      {/* 3-dot menu button */}
      <button
        className="card-menu-btn"
        onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
        title="Options"
      >
        ⋮
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <>
          {/* Invisible overlay to close menu */}
          <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setMenuOpen(false)} />
          <div className="card-dropdown">
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}>
              <Settings size={14} /> Edit
            </button>
            <button className="danger" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}

      {/* Info */}
      <div style={{ padding: "10px 10px 12px", cursor: "pointer" }} onClick={onClick}>
        <div style={{ marginBottom: "6px" }}>
          <span className="category-chip" style={{ background: `${catColor}20`, color: catColor }}>
            {part.category}
          </span>
          {isLow && (
            <span className="low-stock-badge" style={{ marginLeft: "4px" }}>
              <AlertTriangle size={10} /> Low
            </span>
          )}
        </div>
        <div style={{ fontWeight: "700", fontSize: "0.88rem", color: "var(--text-primary, #f3f4f6)", marginBottom: "4px", lineHeight: "1.3" }}>
          {part.name}
        </div>
        <div style={{ fontSize: "0.8rem", color: isLow ? "#f87171" : "var(--text-muted)", fontWeight: "600" }}>
          {part.currentStock} {part.unit}
        </div>
      </div>
    </div>
  );
}

// ── Oils Tab ──────────────────────────────────────────────────────────────────

// ── Oils Tab — monitors oil parts (unit=gal, name/category contains "oil") ──

function isOilPart(p: any): boolean {
  const unit = (p.unit || "").toLowerCase();
  const name = (p.name || "").toLowerCase();
  // Oil parts are those with unit gal, or whose name starts with a known oil type
  if (unit === "gal") return true;
  return OIL_TYPES.some((t) => name.startsWith(t.toLowerCase()));
}

function OilsTab({ parts, onAddOil, onSelectOil, onEditOil, onDeleteOil, onRefresh }: any) {
  const oils = (parts || []).filter(isOilPart);

  return (
    <div>
      {oils.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
          <Droplets size={40} style={{ opacity: 0.3, marginBottom: "12px" }} />
          <p style={{ margin: 0 }}>No oils yet. Tap ＋ to add your first oil.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {oils.map((oil: any) => (
            <OilCard
              key={oil.id}
              oil={oil}
              onClick={() => onSelectOil(oil)}
              onEdit={() => onEditOil(oil)}
              onDelete={() => onDeleteOil(oil)}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
      <button className="fab" onClick={onAddOil} title="Add oil">
        <Plus size={26} />
      </button>
    </div>
  );
}

function OilCard({ oil, onClick, onEdit, onDelete, onRefresh }: any) {
  const [menuOpen, setMenuOpen] = useState(false);
  const current = oil.currentStock ?? 0;
  const low = oil.lowStockThreshold ?? 5;
  const max = oil.maxQty ?? (low ? low * 10 : 50);
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const isLow = current <= low;
  const fillColor = pct > 50 ? "#10b981" : pct > 25 ? "#f59e0b" : "#ef4444";

  return (
    <div
      className="oil-card"
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${isLow ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "14px",
        padding: "16px",
        cursor: "pointer",
        transition: "border-color 0.15s, transform 0.15s",
        position: "relative"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "700", fontSize: "1rem", color: "var(--text-primary, #f3f4f6)" }}>{oil.name}</div>
          <div style={{ fontSize: "0.8rem", color: isLow ? "#f87171" : "var(--text-muted)", marginTop: "2px", fontWeight: "600" }}>
            {current} gal on hand
            {isLow && <span className="low-stock-badge" style={{ marginLeft: "8px" }}><AlertTriangle size={10} /> Low</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            title="Options"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "none",
              color: "var(--text-primary, #f3f4f6)",
              borderRadius: "6px",
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "1rem"
            }}
          >
            ⋮
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
          <div className="card-dropdown" style={{ right: "12px", top: "42px", transform: "none" }}>
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}>
              <Settings size={14} /> Edit
            </button>
            <button className="danger" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}

      {/* Progress bar */}
      <div className="progress-bar-wrap">
        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: fillColor }} />
      </div>

      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "6px", textAlign: "right" }}>
        Tap to log usage
      </div>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryRow({ ev, onClick }: { ev: any; onClick: () => void }) {
  const isNeg = ev.delta < 0;

  return (
    <div className="event-row" onClick={onClick} style={{ cursor: "pointer" }}>
      <div style={{
        width: "34px", height: "34px", borderRadius: "10px", flexShrink: 0,
        background: isNeg ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: isNeg ? "#f87171" : "#34d399",
      }}>
        {isNeg ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: "700", fontSize: "0.9rem", color: "var(--text-primary, #f3f4f6)", marginBottom: "2px" }}>
          {ev.partName}
          <span style={{ marginLeft: "8px", fontWeight: "900", color: isNeg ? "#f87171" : "#34d399" }}>
            {isNeg ? "" : "+"}{ev.delta}
          </span>
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {ev.attendant} {ev.vehicle ? `· ${ev.vehicle}` : ""} &bull; {new Date(ev.timestamp).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
        </div>
        {ev.notes && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px", fontStyle: "italic" }}>{ev.notes}</div>}
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span className={`status-chip status-${ev.status || "pending"}`}>{ev.status || "pending"}</span>
      </div>
    </div>
  );
}

function HistoryTab({ events, onSelectEvent }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {events.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
          <History size={40} style={{ opacity: 0.3, marginBottom: "12px" }} />
          <p style={{ margin: 0 }}>No events logged yet.</p>
        </div>
      ) : (
        events.map((ev: any) => (
          <HistoryRow
            key={ev.id}
            ev={ev}
            onClick={() => onSelectEvent(ev)}
          />
        ))
      )}
    </div>
  );
}

function HistoryDetailsModal({ event, onClose, onEdit, onDelete }: any) {
  const isNeg = event.delta < 0;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "800" }}>Transaction Details</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
          <div>
            <label className="form-label" style={{ marginBottom: "4px" }}>Part Name</label>
            <div style={{ fontWeight: "700", fontSize: "1.05rem", color: "var(--text-primary)" }}>{event.partName}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label className="form-label" style={{ marginBottom: "4px" }}>Type</label>
              <span className="category-chip" style={{
                background: isNeg ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)",
                color: isNeg ? "#f87171" : "#34d399",
                fontWeight: "700",
                display: "inline-block"
              }}>
                {isNeg ? "Usage" : "Restock"}
              </span>
            </div>
            <div>
              <label className="form-label" style={{ marginBottom: "4px" }}>Quantity</label>
              <div style={{ fontWeight: "700", color: isNeg ? "#f87171" : "#34d399" }}>
                {isNeg ? "" : "+"}{event.delta}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label className="form-label" style={{ marginBottom: "4px" }}>Attendant</label>
              <div style={{ fontWeight: "600" }}>{event.attendant}</div>
            </div>
            {event.vehicle && (
              <div>
                <label className="form-label" style={{ marginBottom: "4px" }}>Vehicle</label>
                <div style={{ fontWeight: "600" }}>{event.vehicle}</div>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label className="form-label" style={{ marginBottom: "4px" }}>Date & Time</label>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                {new Date(event.timestamp).toLocaleString()}
              </div>
            </div>
            <div>
              <label className="form-label" style={{ marginBottom: "4px" }}>Status</label>
              <span className={`status-chip status-${event.status || "pending"}`}>{event.status || "pending"}</span>
            </div>
          </div>

          {event.notes && (
            <div>
              <label className="form-label" style={{ marginBottom: "4px" }}>Notes</label>
              <div style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontStyle: "italic", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                {event.notes}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => { onEdit(); onClose(); }}
            className="btn-primary"
            style={{ flex: 1, padding: "12px", borderRadius: "10px", fontWeight: "700", background: "rgba(224, 83, 0, 0.15)", border: "1.5px solid var(--accent-primary)", color: "var(--accent-primary)", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <Settings size={16} /> Edit
            </div>
          </button>
          <button
            onClick={() => { onDelete(); onClose(); }}
            style={{ flex: 1, padding: "12px", borderRadius: "10px", fontWeight: "700", background: "rgba(239, 68, 68, 0.15)", border: "1.5px solid #ef4444", color: "#f87171", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <Trash2 size={16} /> Delete
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Offline Fleet list ────────────────────────────────────────────────────────
const OFFLINE_FLEET = [
  { plate: "CT3628", vehicleId: "CM-01" },
  { plate: "CT3629", vehicleId: "CM-02" },
  { plate: "CT3630", vehicleId: "CM-03" },
  { plate: "CT3624", vehicleId: "CM-04" },
  { plate: "CT3637", vehicleId: "CM-05" },
  { plate: "CT3638", vehicleId: "CM-06" },
  { plate: "CT3636", vehicleId: "CM-07" },
  { plate: "CT3623", vehicleId: "CM-08" },
  { plate: "CT3625", vehicleId: "CM-09" },
  { plate: "CT6723", vehicleId: "CM-10" },
  { plate: "CU2574", vehicleId: "CM-12" },
  { plate: "CU2575", vehicleId: "CM-13" },
  { plate: "CU7288", vehicleId: "CM-14" },
  { plate: "CU8893", vehicleId: "CM-15" },
  { plate: "CU8894", vehicleId: "CM-16" },
  { plate: "CM1436", vehicleId: "CL-01" },
  { plate: "CS5617", vehicleId: "CL-02" },
  { plate: "CN6018", vehicleId: "CL-03" },
  { plate: "CS9962", vehicleId: "CL-04" },
  { plate: "CT8928", vehicleId: "CP-05" },
  { plate: "9138 LF", vehicleId: "CP-06" },
  { plate: "2737 LD", vehicleId: "CV-01" },
  { plate: "2738 LD", vehicleId: "CV-02" },
  { plate: "CT2896", vehicleId: "CV-03" },
  { plate: "CT2897", vehicleId: "CV-04" },
  { plate: "4804LP", vehicleId: "CV-05" },
  { plate: "CU8892", vehicleId: "CV-06" },
  { plate: "CU8895", vehicleId: "CV-07" },
  { plate: "Big Tractor", vehicleId: "CA-01" },
  { plate: "Small Tractor", vehicleId: "CA-02" },
  { plate: "Generator", vehicleId: "EQ-03" },
  { plate: "Water pump", vehicleId: "EQ-04" },
];

// ── Usage Modal ───────────────────────────────────────────────────────────────

function UsageModal({ part, attendantName, onClose, onSaved }: any) {
  const [qty, setQty] = useState(1);
  const [txType, setTxType] = useState<"usage" | "restock">("usage");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [localAttendant, setLocalAttendant] = useState(attendantName);
  const [vehicle, setVehicle] = useState("");
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    async function fetchVehicles() {
      try {
        const res = await fetch("/api/vehicle-info");
        if (!res.ok) throw new Error("API failed");
        const data = await res.json();
        if (data.success && data.vehicles) {
          const list = [...data.vehicles];
          // Ensure Generator is present
          if (!list.some(v => String(v.plate).toLowerCase().includes("generator"))) {
            list.push({ plate: "Generator", vehicleId: "EQ-03" });
          }
          setVehicles(list);
          return;
        }
      } catch (e) {
        console.warn("Failed to fetch vehicles, using offline fallback", e);
      }
      setVehicles(OFFLINE_FLEET);
    }
    fetchVehicles();
  }, []);

  const handleSave = async () => {
    if (qty <= 0) return;
    setSaving(true);
    const delta = txType === "usage" ? -qty : qty;
    await saveStockEvent({
      id: generateId(),
      partId: part.id,
      partName: part.name,
      delta,
      eventType: txType,
      attendant: localAttendant || "Unknown",
      vehicle: txType === "usage" ? vehicle : "",
      notes,
      timestamp: Date.now(),
      status: "pending",
    });
    await updatePart(part.id, { currentStock: Math.max(0, (part.currentStock || 0) + delta) });
    setSaving(false);
    onSaved();
    onClose();
  };

  const stockAfter = txType === "usage"
    ? Math.max(0, (part.currentStock || 0) - qty)
    : (part.currentStock || 0) + qty;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "800" }}>Log Transaction — {part.name}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {/* Transaction Type Segmented Control */}
        <div style={{ display: "flex", gap: "8px", background: "rgba(255,255,255,0.04)", padding: "4px", borderRadius: "10px", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => setTxType("usage")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: txType === "usage" ? "rgba(239, 68, 68, 0.2)" : "transparent",
              color: txType === "usage" ? "#f87171" : "var(--text-muted)",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            Usage (Use Part)
          </button>
          <button
            type="button"
            onClick={() => setTxType("restock")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: txType === "restock" ? "rgba(16, 185, 129, 0.2)" : "transparent",
              color: txType === "restock" ? "#34d399" : "var(--text-muted)",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            Restock (Add Stock)
          </button>
        </div>

        {part.photoDataUrl && (
          <img src={part.photoDataUrl} alt={part.name} className="photo-preview" style={{ marginBottom: "16px" }} />
        )}

        <div style={{ marginBottom: "16px" }}>
          <label className="form-label">{txType === "usage" ? "Quantity Used" : "Quantity Restocked"}</label>
          <div className="qty-row">
            <button className="qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <div className="qty-display">{qty} <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{part.unit}</span></div>
            <button className="qty-btn" onClick={() => setQty(qty + 1)}>+</button>
          </div>
          <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "6px" }}>
            Stock after: {stockAfter} {part.unit}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label className="form-label">Attendant</label>
          <input className="form-input" value={localAttendant} onChange={(e) => setLocalAttendant(e.target.value)} placeholder="Your name" />
        </div>

        {txType === "usage" && (
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Vehicle</label>
            <select
              className="form-select"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            >
              <option value="">-- Select Vehicle (Optional) --</option>
              {vehicles.map((v) => (
                <option key={v.plate || v.vehicleId} value={v.plate}>
                  {v.plate} {v.vehicleId ? `— ${v.vehicleId}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginBottom: "20px" }}>
          <label className="form-label">Notes (optional)</label>
          <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason, extra details, etc." />
        </div>

        <button
          className="btn-primary"
          style={{ width: "100%", padding: "14px", borderRadius: "12px", fontWeight: "800", fontSize: "1rem" }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : txType === "usage" ? "Confirm Usage" : "Confirm Restock"}
        </button>
      </div>
    </div>
  );
}

// ── Add Part Modal ────────────────────────────────────────────────────────────

function AddPartModal({ existingParts, onClose, onSaved }: any) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("PM");
  const [unit, setUnit] = useState("each");
  const [stock, setStock] = useState(0);
  const [threshold, setThreshold] = useState(2);
  const [notes, setNotes] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true });
      setPhotoFile(compressed);
      const reader = new FileReader();
      reader.onload = () => setPhotoDataUrl(reader.result as string);
      reader.readAsDataURL(compressed);
    } catch (err) {
      console.error("Image compression failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const partId = generateItemNumber(category, name, unit, existingParts);
    let driveUrl = "";
    let driveFileId = "";

    // Attempt Drive upload
    if (photoFile) {
      try {
        const fd = new FormData();
        fd.append("file", photoFile);
        fd.append("partId", partId);
        fd.append("partName", name);
        const res = await fetch("/api/upload-photo", { method: "POST", body: fd });
        const data = await res.json();
        if (data.success) {
          driveUrl = data.url;
          driveFileId = data.fileId;
        }
      } catch (err) {
        console.warn("Drive upload failed, using local only:", err);
      }
    }

    const part = {
      id: partId,
      name: name.trim(),
      category,
      unit,
      currentStock: Number(stock),
      lowStockThreshold: Number(threshold),
      photoDataUrl: photoDataUrl || undefined,
      driveUrl,
      driveFileId,
      notes: notes.trim(),
      createdAt: Date.now(),
      synced: false,
    };

    await savePart(part);

    // Sync new part to Sheets if online
    if (navigator.onLine) {
      try {
        const res = await fetch("/api/parts-catalogue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ part }),
        });
        const data = await res.json();
        if (data.success) {
          await updatePart(partId, { synced: true });
        }
      } catch (err) {
        console.warn("Catalogue sync failed:", err);
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "800" }}>Add New Part</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {/* Photo */}
        <div style={{ marginBottom: "16px" }}>
          <label className="form-label">Photo (optional)</label>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePhotoSelect} />
          {photoDataUrl ? (
            <div style={{ position: "relative" }}>
              <img src={photoDataUrl} alt="Preview" className="photo-preview" />
              <button
                onClick={() => { setPhotoDataUrl(null); setPhotoFile(null); }}
                style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
              ><X size={14} /></button>
            </div>
          ) : (
            <button className="photo-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Camera size={18} />{uploading ? "Compressing…" : "Take / Choose Photo"}
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Part Name *</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => {
                const val = e.target.value;
                setName(val);
                const suggested = autoCategory(val);
                if (suggested) setCategory(suggested);
              }}
              placeholder="e.g. Oil Filter, Maxi Fuse 40A"
            />
          </div>
          <div>
            <label className="form-label">Category <span style={{ fontWeight: 400, fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "none" }}>(auto-detected)</span></label>
            <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Unit</label>
            <select className="form-input" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Stock Qty</label>
            <input className="form-input" type="number" min="0" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
          </div>
          <div>
            <label className="form-label">Low Alert ≤</label>
            <input className="form-input" type="number" min="0" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Notes (optional)</label>
            <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Part number, supplier, etc." />
          </div>
        </div>

        <button
          className="btn-primary"
          style={{ width: "100%", padding: "14px", borderRadius: "12px", fontWeight: "800", fontSize: "1rem" }}
          onClick={handleSave}
          disabled={saving || !name.trim()}
        >
          {saving ? "Saving…" : "Save Part"}
        </button>
      </div>
    </div>
  );
}

// ── Add Oil Modal ─────────────────────────────────────────────────────────────

function AddOilModal({ existingParts, onClose, onSaved }: any) {
  const [oilType, setOilType] = useState(OIL_TYPES[0]);
  const [grade, setGrade] = useState("");
  const [currentQty, setCurrentQty] = useState<number>(0);
  const [lowThreshold, setLowThreshold] = useState<number>(5);
  const [saving, setSaving] = useState(false);

  const fullName = grade.trim() ? `${oilType} ${grade.trim()}` : oilType;

  const handleSave = async () => {
    setSaving(true);
    const partId = generateItemNumber("PM", fullName, "gal", existingParts);
    const part = {
      id: partId,
      name: fullName,
      category: "PM",
      unit: "gal",
      currentStock: Number(currentQty),
      lowStockThreshold: Number(lowThreshold),
      notes: "",
      createdAt: Date.now(),
      synced: false,
    };

    await savePart(part);

    // Sync new oil to Sheets if online
    if (navigator.onLine) {
      try {
        const res = await fetch("/api/parts-catalogue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ part }),
        });
        const data = await res.json();
        if (data.success) {
          await updatePart(partId, { synced: true });
        }
      } catch (err) {
        console.warn("Oil catalogue sync failed:", err);
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "800" }}>Add Oil</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
          {/* Oil type */}
          <div>
            <label className="form-label">Oil Type *</label>
            <select className="form-input" value={oilType} onChange={(e) => setOilType(e.target.value)}>
              {OIL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Grade / spec */}
          <div>
            <label className="form-label">Grade / Spec <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
            <input
              className="form-input"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder={
                oilType === "Engine Oil" ? "e.g. 15W-40" :
                oilType === "Transmission Oil" ? "e.g. ATF Dexron VI" :
                oilType === "Differential Gear Oil" ? "e.g. 80W-90" :
                oilType === "Hydraulic Oil" ? "e.g. ISO 46" :
                oilType === "Coolant" ? "e.g. OAT Green" :
                oilType === "Grease" ? "e.g. NLGI 2 Lithium" : "Specify grade or brand"
              }
            />
          </div>

          {/* Preview */}
          <div style={{ background: "rgba(224,83,0,0.08)", border: "1px solid rgba(224,83,0,0.2)", borderRadius: "10px", padding: "10px 14px" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "2px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>Will be saved as</div>
            <div style={{ fontWeight: "700", color: "#e05300", fontSize: "0.95rem" }}>{fullName} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>· gal</span></div>
          </div>

          {/* Qty row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="form-label">Current Qty (gal)</label>
              <input className="form-input" type="number" min="0" step="0.5" value={currentQty} onChange={(e) => setCurrentQty(Number(e.target.value))} />
            </div>
            <div>
              <label className="form-label">Low Alert ≤ (gal)</label>
              <input className="form-input" type="number" min="0" step="0.5" value={lowThreshold} onChange={(e) => setLowThreshold(Number(e.target.value))} />
            </div>
          </div>
        </div>

        <button
          className="btn-primary"
          style={{ width: "100%", padding: "14px", borderRadius: "12px", fontWeight: "800", fontSize: "1rem" }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Oil"}
        </button>
      </div>
    </div>
  );
}


// ── Settings Modal ────────────────────────────────────────────────────────────

function SettingsModal({ attendantName, onSave, onClose }: any) {
  const [name, setName] = useState(attendantName);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "800" }}>Settings</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label className="form-label">Your Name</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Attendant name" />
        </div>
        <button
          className="btn-primary"
          style={{ width: "100%", padding: "14px", borderRadius: "12px", fontWeight: "800" }}
          onClick={() => onSave(name)}
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}

// ── Edit Part Modal ───────────────────────────────────────────────────────────

function EditPartModal({ part, onClose, onSaved }: any) {
  const [name, setName] = useState(part.name || "");
  const [category, setCategory] = useState(part.category || "PM");
  const [unit, setUnit] = useState(part.unit || "each");
  const [stock, setStock] = useState(part.currentStock ?? 0);
  const [threshold, setThreshold] = useState(part.lowStockThreshold ?? 2);
  const [notes, setNotes] = useState(part.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const updates = {
      name: name.trim(),
      category,
      unit,
      currentStock: Number(stock),
      lowStockThreshold: Number(threshold),
      notes: notes.trim(),
    };
    await updatePart(part.id, updates);

    if (navigator.onLine) {
      try {
        await fetch("/api/parts-catalogue", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: part.id, updates }),
        });
      } catch (err) {
        console.warn("Failed to sync part edit to sheet:", err);
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "800" }}>Edit Part</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {part.photoDataUrl && (
          <img src={part.photoDataUrl} alt={part.name} className="photo-preview" style={{ marginBottom: "16px" }} />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Part Name *</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => {
                const val = e.target.value;
                setName(val);
                const suggested = autoCategory(val);
                if (suggested) setCategory(suggested);
              }}
              placeholder="Part name"
            />
          </div>
          <div>
            <label className="form-label">Category <span style={{ fontWeight: 400, fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "none" }}>(auto-detected)</span></label>
            <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Unit</label>
            <select className="form-input" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Stock Qty</label>
            <input className="form-input" type="number" min="0" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
          </div>
          <div>
            <label className="form-label">Low Alert ≤</label>
            <input className="form-input" type="number" min="0" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Notes (optional)</label>
            <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Part number, supplier, etc." />
          </div>
        </div>

        <button
          className="btn-primary"
          style={{ width: "100%", padding: "14px", borderRadius: "12px", fontWeight: "800", fontSize: "1rem" }}
          onClick={handleSave}
          disabled={saving || !name.trim()}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function EditHistoryModal({ event, parts, onClose, onSaved }: any) {
  const part = parts.find((p: any) => p.id === event.partId) || { name: event.partName, unit: "each", currentStock: 0 };
  const [qty, setQty] = useState(Math.abs(event.delta));
  const [txType, setTxType] = useState<"usage" | "restock">(event.eventType || (event.delta < 0 ? "usage" : "restock"));
  const [notes, setNotes] = useState(event.notes || "");
  const [attendant, setAttendant] = useState(event.attendant || "");
  const [vehicle, setVehicle] = useState(event.vehicle || "");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchVehicles() {
      try {
        const res = await fetch("/api/vehicle-info");
        if (!res.ok) throw new Error("API failed");
        const data = await res.json();
        if (data.success && data.vehicles) {
          const list = [...data.vehicles];
          // Ensure Generator is present
          if (!list.some(v => String(v.plate).toLowerCase().includes("generator"))) {
            list.push({ plate: "Generator", vehicleId: "EQ-03" });
          }
          setVehicles(list);
          return;
        }
      } catch (e) {
        console.warn("Failed to fetch vehicles, using offline fallback", e);
      }
      setVehicles(OFFLINE_FLEET);
    }
    fetchVehicles();
  }, []);

  const handleSave = async () => {
    if (qty <= 0) return;
    setSaving(true);

    const newDelta = txType === "usage" ? -qty : qty;
    const oldDelta = event.delta;

    // Check if synced and offline
    if (event.status === "synced" && !navigator.onLine) {
      alert("You must be online to edit already synced history entries.");
      setSaving(false);
      return;
    }

    const updatedEvent = {
      ...event,
      delta: newDelta,
      eventType: txType,
      attendant,
      vehicle: txType === "usage" ? vehicle : "",
      notes,
    };

    // If already synced, update Google Sheet immediately
    if (event.status === "synced" && navigator.onLine) {
      try {
        const res = await fetch("/api/parts-log", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: event.id, updates: updatedEvent }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
      } catch (err) {
        alert("Failed to update Google Sheet: " + (err as Error).message);
        setSaving(false);
        return;
      }
    }

    // Save event locally
    await saveStockEvent(updatedEvent);

    // Revert old delta and apply new delta to part stock
    const diff = newDelta - oldDelta;
    await updatePart(event.partId, { currentStock: Math.max(0, (part.currentStock || 0) + diff) });

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "800" }}>Edit Transaction — {event.partName}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {/* Transaction Type Segmented Control */}
        <div style={{ display: "flex", gap: "8px", background: "rgba(255,255,255,0.04)", padding: "4px", borderRadius: "10px", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => setTxType("usage")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: txType === "usage" ? "rgba(239, 68, 68, 0.2)" : "transparent",
              color: txType === "usage" ? "#f87171" : "var(--text-muted)",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            Usage (Use Part)
          </button>
          <button
            type="button"
            onClick={() => setTxType("restock")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: txType === "restock" ? "rgba(16, 185, 129, 0.2)" : "transparent",
              color: txType === "restock" ? "#34d399" : "var(--text-muted)",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            Restock (Add Stock)
          </button>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label className="form-label">Quantity</label>
          <div className="qty-row">
            <button className="qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <div className="qty-display">{qty} <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{part.unit}</span></div>
            <button className="qty-btn" onClick={() => setQty(qty + 1)}>+</button>
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label className="form-label">Attendant</label>
          <input className="form-input" value={attendant} onChange={(e) => setAttendant(e.target.value)} placeholder="Name" />
        </div>

        {txType === "usage" && (
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Vehicle</label>
            <select
              className="form-select"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            >
              <option value="">-- Select Vehicle (Optional) --</option>
              {vehicles.map((v) => (
                <option key={v.plate || v.vehicleId} value={v.plate}>
                  {v.plate} {v.vehicleId ? `— ${v.vehicleId}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginBottom: "20px" }}>
          <label className="form-label">Notes (optional)</label>
          <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
        </div>

        <button
          className="btn-primary"
          style={{ width: "100%", padding: "14px", borderRadius: "12px", fontWeight: "800", fontSize: "1rem" }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
