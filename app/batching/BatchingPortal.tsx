"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Layers,
  Clock,
  Settings,
  Droplet,
  Cloud,
  CloudOff,
  RefreshCw,
  ArrowLeft,
  Sun,
  Moon,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  ArrowLeftRight,
} from "lucide-react";
import {
  initDB,
  seedInitialData,
  getCurrentBatchingDay,
  getCurrentMoisture,
  getTodaysLoads,
  getLoads,
  getMixDesigns,
  getTrucks,
  getObservationOptions,
  getAdjustmentOptions,
  getUnsyncedLoads,
  syncBatchingDataToCloud,
  syncRecipesFromCloud,
  DEFAULT_MIX_DESIGNS,
  DEFAULT_TRUCKS,
  DEFAULT_OBSERVATIONS,
  DEFAULT_ADJUSTMENTS,
  BatchingDay,
  MoistureReading,
  MixDesign,
  Truck as TruckType,
  ObservationOption,
  AdjustmentOption,
  LoadRecord,
} from "@/lib/db-batching";

import HomeScreen from "@/components/batching/HomeScreen";
import NewLoadForm from "@/components/batching/NewLoadForm";
import ObservationReview from "@/components/batching/ObservationReview";
import TodaysLoads from "@/components/batching/TodaysLoads";
import MixConversionCalculator from "@/components/batching/MixConversionCalculator";
import ClockInGate from "@/components/batching/ClockInGate";
import MoistureModal from "@/components/batching/MoistureModal";
import BatchingDayModal from "@/components/batching/BatchingDayModal";
import LoadDetailModal from "@/components/batching/LoadDetailModal";

export default function BatchingPortal() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"home" | "new-load" | "todays-loads" | "review" | "convert">("home");
  const [conversionSourceLoad, setConversionSourceLoad] = useState<LoadRecord | null>(null);

  // State
  const [batchingDay, setBatchingDay] = useState<BatchingDay | null>(null);
  const [currentSandMoisture, setCurrentSandMoisture] = useState<MoistureReading>({
    id: "init_sand",
    percentage: 3.0,
    date: new Date().toISOString().split("T")[0],
    time: "07:00 AM",
    timestamp: Date.now(),
    batcherId: "batcher_01",
    batcherName: "Lead Batcher",
    material: "Sand",
    isCurrent: true,
  });
  const [currentStoneMoisture, setCurrentStoneMoisture] = useState<MoistureReading>({
    id: "init_stone",
    percentage: 1.0,
    date: new Date().toISOString().split("T")[0],
    time: "07:00 AM",
    timestamp: Date.now(),
    batcherId: "batcher_01",
    batcherName: "Lead Batcher",
    material: "Stone",
    isCurrent: true,
  });
  const [moistureModalMaterial, setMoistureModalMaterial] = useState<"Sand" | "Stone">("Sand");
  const [todaysLoads, setTodaysLoads] = useState<LoadRecord[]>([]);
  const [allLoads, setAllLoads] = useState<LoadRecord[]>([]);
  const [mixDesigns, setMixDesigns] = useState<MixDesign[]>(DEFAULT_MIX_DESIGNS);
  const [trucks, setTrucks] = useState<TruckType[]>(DEFAULT_TRUCKS);
  const [observationOptions, setObservationOptions] = useState<ObservationOption[]>(DEFAULT_OBSERVATIONS);
  const [adjustmentOptions, setAdjustmentOptions] = useState<AdjustmentOption[]>(DEFAULT_ADJUSTMENTS);
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);
  const [lastRecipeSyncTime, setLastRecipeSyncTime] = useState<string | null>(null);

  // Sync & Network
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Modals & Sub-actions
  const [isMoistureModalOpen, setIsMoistureModalOpen] = useState<boolean>(false);
  const [isDayModalOpen, setIsDayModalOpen] = useState<boolean>(false);
  const [selectedLoadForDetail, setSelectedLoadForDetail] = useState<LoadRecord | null>(null);
  const [repeatLoadData, setRepeatLoadData] = useState<Partial<LoadRecord> | null>(null);

  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  const isSyncingRef = React.useRef<boolean>(false);

  // Load all local data from IndexedDB
  const refreshLocalData = useCallback(async () => {
    try {
      await seedInitialData();

      const [
        day,
        sandMoist,
        stoneMoist,
        tLoads,
        aLoads,
        mixes,
        fleet,
        obs,
        adjs,
        unsynced,
      ] = await Promise.all([
        getCurrentBatchingDay(),
        getCurrentMoisture("Sand"),
        getCurrentMoisture("Stone"),
        getTodaysLoads(),
        getLoads(),
        getMixDesigns(false),
        getTrucks(false),
        getObservationOptions(true),
        getAdjustmentOptions(true),
        getUnsyncedLoads(),
      ]);

      if (day) setBatchingDay(day);
      if (sandMoist) setCurrentSandMoisture(sandMoist);
      if (stoneMoist) setCurrentStoneMoisture(stoneMoist);
      setTodaysLoads(tLoads);
      setAllLoads(aLoads);
      setMixDesigns(mixes);
      setTrucks(fleet);
      setObservationOptions(obs);
      setAdjustmentOptions(adjs);
      setUnsyncedCount(unsynced.length);

      // Background sync recipes from Cooking Station Google Sheet
      syncRecipesFromCloud(true)
        .then((latestMixes) => {
          if (latestMixes && latestMixes.length > 0) {
            setMixDesigns(latestMixes);
            setLastRecipeSyncTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
          }
        })
        .catch(() => {});
    } catch (err) {
      console.error("Failed to load local batching data:", err);
    }
  }, []);

  const refreshRef = React.useRef(refreshLocalData);
  refreshRef.current = refreshLocalData;

  // Sync to cloud handler (loads + live recipes)
  const handleTriggerSync = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const [result, latestMixes] = await Promise.all([
        syncBatchingDataToCloud(),
        syncRecipesFromCloud(true),
      ]);

      if (latestMixes && latestMixes.length > 0) {
        setMixDesigns(latestMixes);
        setLastRecipeSyncTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }

      if (result.success) {
        if (result.syncedCount > 0) {
          setSyncFeedback(`Synced ${result.syncedCount} load${result.syncedCount > 1 ? "s" : ""} & pulled latest recipes from Google Sheet`);
        } else {
          setSyncFeedback(`Pulled latest recipes from Cooking Station Google Sheet`);
        }
      } else if (result.error && result.error !== "Offline") {
        setSyncFeedback(`Sync notice: ${result.error}`);
      }
    } catch (err: any) {
      console.warn("Sync handler error:", err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      await refreshRef.current();
      setTimeout(() => setSyncFeedback(null), 3500);
    }
  }, []);

  const syncRef = React.useRef(handleTriggerSync);
  syncRef.current = handleTriggerSync;

  // Initial mount, online listeners, visibility/focus sync (runs ONCE on mount)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production" && window.location.hostname !== "localhost") {
        navigator.serviceWorker
          .register("/sw.js")
          .catch((err) => console.warn("[SW] Registration failed:", err));
      } else {
        // In local development, unregister any active SW to prevent HMR / Fast Refresh reload loops
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
    }

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      syncRef.current();
    };
    const handleOffline = () => setIsOnline(false);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        refreshRef.current();
        syncRef.current();
      }
    };

    const handleWindowFocus = () => {
      if (navigator.onLine) {
        refreshRef.current();
        syncRef.current();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    // Initial load once on mount
    refreshRef.current().then(() => {
      if (navigator.onLine) {
        syncRef.current();
      }
    });

    // Background sync heartbeat every 25s
    const syncInterval = setInterval(() => {
      if (navigator.onLine && !isSyncingRef.current) {
        syncRef.current();
      }
    }, 25000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      clearInterval(syncInterval);
    };
  }, []);

  // Toggle theme class on body
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (isDarkMode) {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }
    }
  }, [isDarkMode]);

  // Actions
  const handleStartNewLoad = () => {
    if (!batchingDay || batchingDay.status !== "open") {
      setIsDayModalOpen(true);
      return;
    }
    setRepeatLoadData(null);
    setActiveTab("new-load");
  };

  const handleRepeatLastLoad = () => {
    if (!batchingDay || batchingDay.status !== "open") {
      setIsDayModalOpen(true);
      return;
    }
    if (todaysLoads.length > 0) {
      const last = todaysLoads[0];
      setRepeatLoadData({
        mixDesignId: last.mixDesignId,
        quantity: last.quantity,
        truckId: last.truckId,
        batchNumber: last.batchNumber,
      });
      setActiveTab("new-load");
    }
  };

  const handleRepeatSpecificLoad = (load: LoadRecord) => {
    if (!batchingDay || batchingDay.status !== "open") {
      setIsDayModalOpen(true);
      return;
    }
    setRepeatLoadData({
      mixDesignId: load.mixDesignId,
      quantity: load.quantity,
      truckId: load.truckId,
      batchNumber: load.batchNumber,
    });
    setActiveTab("new-load");
  };

  const handleOpenConversion = (load?: LoadRecord) => {
    setConversionSourceLoad(load || null);
    setActiveTab("convert");
  };

  const handleEditLoadFromDetail = (load: LoadRecord) => {
    setSelectedLoadForDetail(null);
    setRepeatLoadData(load);
    setActiveTab("new-load");
  };

  const handleLoadSaved = async (newLoad: LoadRecord) => {
    await refreshLocalData();
    setActiveTab("home");
    // Trigger background sync
    if (navigator.onLine) {
      handleTriggerSync();
    }
  };

  const handleMoistureUpdated = (reading: MoistureReading) => {
    if (reading.material.toLowerCase() === "stone") {
      setCurrentStoneMoisture(reading);
    } else {
      setCurrentSandMoisture(reading);
    }
    refreshLocalData();
  };

  const handleDayUpdated = (day: BatchingDay) => {
    setBatchingDay(day);
    refreshLocalData();
    // Prompt sand moisture verification for the first start of a new day
    if (day.status === "open") {
      setMoistureModalMaterial("Sand");
      setIsMoistureModalOpen(true);
    }
  };

  const handleLoadUpdated = (updated: LoadRecord) => {
    setSelectedLoadForDetail(updated);
    refreshLocalData();
    if (navigator.onLine) {
      handleTriggerSync();
    }
  };

  const totalYards = todaysLoads
    .filter((l) => !l.isVoid)
    .reduce((sum, l) => sum + (l.quantity || 0), 0);

  // Strictly start blank on a new day (no fallback to previous days' loads)
  const lastBatchedLoad = useMemo(() => {
    if (todaysLoads.length === 0) return null;
    const validLoads = todaysLoads.filter((l) => !l.isVoid);
    return validLoads.length > 0 ? validLoads[0] : null;
  }, [todaysLoads]);

  const handleOpenMoistureModal = (mat: "Sand" | "Stone" = "Sand") => {
    setMoistureModalMaterial(mat);
    setIsMoistureModalOpen(true);
  };

  const isShiftActive = Boolean(batchingDay && batchingDay.status === "open");

  return (
    <div className="app-container">
      {/* Top App Header with Connection Badge and Day Status */}
      <header className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              minWidth: "36px",
              borderRadius: "10px",
              backgroundColor: "#e05300",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 4px 12px rgba(224, 83, 0, 0.35)",
            }}
          >
            <Truck size={20} />
          </div>
          <div className="header-title-container" style={{ minWidth: 0, overflow: "hidden" }}>
            <h1 className="header-title" style={{ margin: 0, fontSize: "clamp(0.95rem, 3.8vw, 1.25rem)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Concrete Kings <span style={{ color: "#f59e0b" }}>Batching</span>
            </h1>
            <span className="header-subtitle" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Plant Batching Diary
            </span>
          </div>
        </div>

        {/* Status Indicators & Fast Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {/* Active Shift Indicator */}
          {batchingDay && (
            <button
              type="button"
              onClick={() => setIsDayModalOpen(true)}
              className="badge"
              style={{
                backgroundColor: batchingDay.status === "open" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                color: batchingDay.status === "open" ? "#10b981" : "#f59e0b",
                border: "none",
                cursor: "pointer",
                padding: "5px 8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.72rem",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: batchingDay.status === "open" ? "#10b981" : "#f59e0b",
                }}
              />
              <span style={{ fontWeight: "800" }}>{batchingDay.status === "open" ? "Active" : "Closed"}</span>
            </button>
          )}

          {/* Sync status indicator */}
          <button
            type="button"
            className={`badge ${unsyncedCount > 0 ? "unsynced" : "synced"}`}
            onClick={handleTriggerSync}
            disabled={isSyncing}
            style={{
              cursor: isSyncing ? "default" : "pointer",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "5px 8px",
              fontSize: "0.72rem",
            }}
            title={unsyncedCount > 0 ? `${unsyncedCount} loads queued for cloud sync` : "All local loads synced"}
          >
            {isSyncing ? (
              <>
                <RefreshCw size={11} className="spin" />
                <span>Sync</span>
              </>
            ) : unsyncedCount > 0 ? (
              <>
                <CloudOff size={11} />
                <span>{unsyncedCount}</span>
              </>
            ) : (
              <>
                <Cloud size={11} />
                <span>Synced</span>
              </>
            )}
          </button>

          {/* Theme Toggle (Dark/Light mode) */}
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label="Toggle dark mode"
            style={{ width: "32px", height: "32px" }}
          >
            {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* Cloud Sync Feedback Banner */}
      {syncFeedback && (
        <div
          style={{
            backgroundColor: syncFeedback.includes("Failed") ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
            color: syncFeedback.includes("Failed") ? "#ef4444" : "#10b981",
            padding: "8px 16px",
            fontSize: "0.85rem",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--glass-border)",
          }}
        >
          <span>{syncFeedback}</span>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="screen-wrapper">
        {activeTab === "home" && (
          <HomeScreen
            batchingDay={batchingDay}
            currentMoisture={currentSandMoisture}
            loadsCountToday={todaysLoads.filter((l) => !l.isVoid).length}
            totalYardsToday={totalYards}
            lastLoad={lastBatchedLoad}
            todaysLoads={todaysLoads}
            onSelectLoad={(load) => setSelectedLoadForDetail(load)}
            unsyncedCount={unsyncedCount}
            isSyncing={isSyncing}
            onNewLoad={handleStartNewLoad}
            onRepeatLastLoad={handleRepeatLastLoad}
            onOpenConversion={handleOpenConversion}
            onOpenMoistureModal={() => handleOpenMoistureModal("Sand")}
            onViewTodaysLoads={() => setActiveTab("todays-loads")}
            onTriggerSync={handleTriggerSync}
            onOpenBatchingDayModal={() => setIsDayModalOpen(true)}
            onDayUpdated={handleDayUpdated}
            lastRecipeSyncTime={lastRecipeSyncTime}
            recipesCount={mixDesigns.length}
          />
        )}

        {activeTab === "new-load" && (
          !isShiftActive ? (
            <ClockInGate onClockedIn={handleDayUpdated} />
          ) : (
            <NewLoadForm
              batchingDay={batchingDay!}
              currentSandMoisture={currentSandMoisture}
              currentStoneMoisture={currentStoneMoisture}
              mixDesigns={mixDesigns.filter((m) => m.active)}
              trucks={trucks.filter((t) => t.active)}
              observationOptions={observationOptions}
              adjustmentOptions={adjustmentOptions}
              onOpenMoistureModal={handleOpenMoistureModal}
              onLoadSaved={handleLoadSaved}
              onCancel={() => setActiveTab("home")}
              initialValues={repeatLoadData}
              todaysLoads={todaysLoads}
            />
          )
        )}

        {activeTab === "convert" && (
          <MixConversionCalculator
            mixDesigns={mixDesigns.filter((m) => m.active)}
            todaysLoads={todaysLoads}
            currentSandMoisture={currentSandMoisture}
            currentStoneMoisture={currentStoneMoisture}
            initialSourceLoad={conversionSourceLoad}
            onNavigateToDashboard={() => setActiveTab("home")}
          />
        )}

        {activeTab === "review" && (
          !isShiftActive ? (
            <ClockInGate onClockedIn={handleDayUpdated} />
          ) : (
            <ObservationReview
              todaysLoads={todaysLoads}
              observationOptions={observationOptions}
              adjustmentOptions={adjustmentOptions}
              onLoadUpdated={handleLoadUpdated}
              batcherName={batchingDay?.batcherName || "Lead Batcher"}
              batcherId={batchingDay?.batcherId || "batcher_01"}
              onNavigateToDashboard={() => setActiveTab("home")}
            />
          )
        )}

        {activeTab === "todays-loads" && (
          <TodaysLoads
            loads={todaysLoads}
            onSelectLoad={(load) => setSelectedLoadForDetail(load)}
            onRepeatLoad={handleRepeatSpecificLoad}
            onConvertLoad={handleOpenConversion}
            onRefresh={refreshLocalData}
          />
        )}
      </main>

      {/* Persistent Bottom Tab Navigation for Tablet */}
      <nav className="tab-navbar">
        <button
          type="button"
          className={`tab-button ${activeTab === "home" ? "active" : ""}`}
          onClick={() => setActiveTab("home")}
        >
          <div className="tab-icon-wrapper">
            <Layers size={20} />
          </div>
          <span>Batching</span>
        </button>

        <button
          type="button"
          className={`tab-button ${activeTab === "review" ? "active" : ""}`}
          onClick={() => setActiveTab("review")}
        >
          <div className="tab-icon-wrapper">
            <ClipboardCheck size={20} />
          </div>
          <span>Review</span>
          {todaysLoads.filter((l) => !l.isVoid && l.isReviewed !== true).length > 0 && (
            <span className="tab-badge" style={{ backgroundColor: "#f59e0b" }}>
              {todaysLoads.filter((l) => !l.isVoid && l.isReviewed !== true).length}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`tab-button ${activeTab === "todays-loads" ? "active" : ""}`}
          onClick={() => setActiveTab("todays-loads")}
        >
          <div className="tab-icon-wrapper">
            <Clock size={20} />
          </div>
          <span>Today&apos;s Loads</span>
        </button>
      </nav>

      {/* Dedicated Modals */}
      <MoistureModal
        isOpen={isMoistureModalOpen}
        onClose={() => setIsMoistureModalOpen(false)}
        material={moistureModalMaterial}
        currentMoisture={moistureModalMaterial === "Stone" ? currentStoneMoisture : currentSandMoisture}
        onMoistureUpdated={handleMoistureUpdated}
        batcherName={batchingDay?.batcherName || "Lead Batcher"}
        batcherId={batchingDay?.batcherId || "batcher_01"}
      />

      <BatchingDayModal
        isOpen={isDayModalOpen}
        onClose={() => setIsDayModalOpen(false)}
        currentDay={batchingDay}
        onDayUpdated={handleDayUpdated}
      />

      <LoadDetailModal
        isOpen={!!selectedLoadForDetail}
        load={selectedLoadForDetail}
        onClose={() => setSelectedLoadForDetail(null)}
        onLoadUpdated={handleLoadUpdated}
        onEditLoad={handleEditLoadFromDetail}
        batcherName={batchingDay?.batcherName || "Lead Batcher"}
        batcherId={batchingDay?.batcherId || "batcher_01"}
      />
    </div>
  );
}
