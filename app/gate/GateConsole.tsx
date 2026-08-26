"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Truck,
  FileText,
  UserCheck,
  History,
  Wifi,
  WifiOff,
  RefreshCw,
  Sun,
  Moon,
  Settings as SettingsIcon,
  Clock,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Copy,
  Calendar,
  X,
  Search,
  ArrowRight,
  ClipboardList,
  LogIn,
  LogOut
} from "lucide-react";
import {
  saveEntry,
  getEntries,
  getPendingEntries,
  updateEntryStatus,
  deleteEntry,
  clearAllSyncedEntries,
  getAllSettings,
  saveAllSettings,
  resetSyncedToPending,
  pullRemoteData
} from "@/lib/db-gate";

// Static Offline Fleet Fallback
const OFFLINE_FLEET = [
  { plate: "CT3628", vehicleId: "CM-01", type: "mixer", status: "Active" },
  { plate: "CT3629", vehicleId: "CM-02", type: "mixer", status: "Active" },
  { plate: "CT3630", vehicleId: "CM-03", type: "mixer", status: "Active" },
  { plate: "CT3624", vehicleId: "CM-04", type: "mixer", status: "Active" },
  { plate: "CT3637", vehicleId: "CM-05", type: "mixer", status: "Active" },
  { plate: "CT3638", vehicleId: "CM-06", type: "mixer", status: "Active" },
  { plate: "CT3636", vehicleId: "CM-07", type: "mixer", status: "Active" },
  { plate: "CT3623", vehicleId: "CM-08", type: "mixer", status: "Active" },
  { plate: "CT3625", vehicleId: "CM-09", type: "mixer", status: "Active" },
  { plate: "CT6723", vehicleId: "CM-10", type: "mixer", status: "Active" },
  { plate: "CU2573", vehicleId: "CM-11", type: "mixer", status: "Active" },
  { plate: "CU2574", vehicleId: "CM-12", type: "mixer", status: "Active" },
  { plate: "CU2575", vehicleId: "CM-13", type: "mixer", status: "Active" },
  { plate: "CU7288", vehicleId: "CM-14", type: "mixer", status: "Active" },
  { plate: "CU8893", vehicleId: "CM-15", type: "mixer", status: "Active" },
  { plate: "CU8894", vehicleId: "CM-16", type: "mixer", status: "Active" },
  { plate: "CM1436", vehicleId: "CL-01", type: "pump", status: "Active" },
  { plate: "CS5617", vehicleId: "CL-02", type: "pump", status: "Active" },
  { plate: "CN6018", vehicleId: "CL-03", type: "pump", status: "Active" },
  { plate: "CS9962", vehicleId: "CL-04", type: "pump", status: "Active" },
  { plate: "CT8928", vehicleId: "CP-05", type: "pump", status: "Active" },
  { plate: "9138 LF", vehicleId: "CP-06", type: "pump", status: "Active" },
];

// Static Offline Drivers Fallback
const OFFLINE_DRIVERS = [
  { name: "Damian Redden", type: "company" },
  { name: "Wilton Roberts", type: "mixer" },
  { name: "Conrad Francis", type: "mixer" },
  { name: "Odealie Wright", type: "mixer" },
  { name: "Matthew Baker", type: "mixer/pump" },
  { name: "Tommy Morgan", type: "mixer" },
  { name: "Joseph Brown", type: "mixer" },
  { name: "Wayne Lafayette", type: "mixer" },
  { name: "Keneil Webber", type: "mixer" },
  { name: "William Gordon", type: "mixer" },
  { name: "Barrington McNeil", type: "mixer" },
  { name: "Oneil Henderson", type: "company" },
  { name: "Horace Bernard", type: "pump" },
  { name: "Trueman Dawkins", type: "pump" },
  { name: "Michael Palmer", type: "pump" },
  { name: "Recardo Bailey", type: "mixer" },
  { name: "Jerome Hilton", type: "company" },
];

// Static Offline Staff Fallback (Sample from List tab)
const OFFLINE_STAFF = [
  { name: "Casimar Wright", dept: "Plant" },
  { name: "Obrien Dixon", dept: "Plant" },
  { name: "Omar Robinson", dept: "Plant" },
  { name: "Probin Marsh", dept: "Garage" },
  { name: "Fitzroy Anderson", dept: "Garage" },
  { name: "Noel Steer", dept: "Garage" },
  { name: "Mark Murray", dept: "Garage" },
  { name: "Sheldon Henry", dept: "Garage" },
  { name: "Derrick Grant", dept: "Garage" },
  { name: "Errol Clarke", dept: "Garage" },
  { name: "Rushawn Robinson", dept: "Plant" },
  { name: "Annette Fraser", dept: "Plant" },
  { name: "Stephaney Lewis", dept: "Garage" },
  { name: "Damar Cobourne", dept: "Plant" },
  { name: "Tracey Cox", dept: "Garage" },
  { name: "Marjo Newman", dept: "Garage" },
  { name: "Junior Wright", dept: "Garage" },
  { name: "Patrick Clarke", dept: "Garage" },
];

// Helper to parse CSV text
function parseCSV(text: string) {
  const lines: string[][] = [];
  let row: string[] = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push("");
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}

export default function GateGuardConsole() {
  const [activeTab, setActiveTab] = useState<"staff" | "pump" | "mixer" | "delivery" | "visitor">("staff");
  const [activeNav, setActiveNav] = useState<"active" | "history">("active");
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [theme, setTheme] = useState("light");
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Compliance Roster state
  const [fleetList, setFleetList] = useState<any[]>(OFFLINE_FLEET);
  const [driversList, setDriversList] = useState<any[]>(OFFLINE_DRIVERS);
  const [staffList, setStaffList] = useState<any[]>(OFFLINE_STAFF);
  const [rosterSyncStatus, setRosterSyncStatus] = useState("Roster initialized (local copy)");
  const [registrySource, setRegistrySource] = useState<"offline" | "online" | "api">("offline");

  // Timer refresh ticker
  const [currentTime, setCurrentTime] = useState(new Date());

  // Historical synced logs from server
  const [remoteHistory, setRemoteHistory] = useState<any>({
    staff: [],
    pump: [],
    mixer: [],
    delivery: [],
    visitor: []
  });

  // Local active + completed logs from IndexedDB
  const [localHistory, setLocalHistory] = useState<any[]>([]);

  // Ticker for timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format dynamic timer (hh:mm:ss)
  const getElapsedTime = (startTimestamp: number) => {
    const elapsedMs = currentTime.getTime() - startTimestamp;
    if (elapsedMs < 0) return "00:00:00";
    const totalSecs = Math.floor(elapsedMs / 1000);
    const hours = String(Math.floor(totalSecs / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSecs % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  // Load configuration and data stats
  const loadStatsAndLocalHistory = useCallback(async () => {
    // 1. Settings
    const activeSettings = await getAllSettings();
    setSettings(activeSettings);

    // 2. Local entries from IndexedDB
    const entries = await getEntries();
    setLocalHistory(entries);

    // 3. Count pending syncs
    const pending = await getPendingEntries();
    setPendingCount(pending.length);
  }, []);

  // Sync logs queue to Next.js API
  const triggerLogsSync = useCallback(async () => {
    if (syncing) return;
    if (!navigator.onLine) return;

    setSyncing(true);
    try {
      // 1. Pull remote logs first
      await pullRemoteData();

      // 2. Sync pending logs to backend
      const pendingLogs = await getPendingEntries();
      if (pendingLogs.length > 0) {
        const response = await fetch("/api/gate-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logs: pendingLogs }),
        });
        const data = await response.json();
        if (data.success) {
          // Mark all successfully synced items
          for (const id of data.synced) {
            await updateEntryStatus(id, "synced");
          }
          // Duplicate items skipped by sheet should also be synced locally
          for (const id of data.skipped) {
            await updateEntryStatus(id, "synced");
          }
        } else {
          throw new Error(data.error || "Log sync failed");
        }
      }
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      console.error("Sync error:", err);
      // Mark as failed in DB
      const pendingLogs = await getPendingEntries();
      for (const log of pendingLogs) {
        await updateEntryStatus(log.id, "failed", err.message || "Network sync error");
      }
      setRefreshTrigger((prev) => prev + 1);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  // Fetch compliance details directly (CSV) or fall back to NextJS API proxy
  const syncComplianceRoster = useCallback(async () => {
    if (!navigator.onLine) {
      // Offline: read cached localStorage
      const cachedFleet = localStorage.getItem("ck_fleet_list");
      const cachedDrivers = localStorage.getItem("ck_drivers_list");
      const cachedStaff = localStorage.getItem("ck_staff_list");
      const lastSyncTime = localStorage.getItem("ck_last_roster_sync");

      if (cachedFleet) setFleetList(JSON.parse(cachedFleet));
      if (cachedDrivers) setDriversList(JSON.parse(cachedDrivers));
      if (cachedStaff) setStaffList(JSON.parse(cachedStaff));
      if (lastSyncTime) {
        setRosterSyncStatus(`Roster loaded from cache (Last: ${lastSyncTime})`);
      }
      setRegistrySource("offline");
      return;
    }

    try {
      const spreadsheetId = "1gYP8MZwGtJ24SMhuuhelVsyTUQntS9pcvZCVq6g_Z1Q";
      const vehicleUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/pub?gid=0&output=csv`;
      const driverUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/pub?gid=502821608&output=csv`;

      let fetchedVehicles: any[] = [];
      let fetchedDrivers: any[] = [];
      let source: "online" | "api" | "offline" = "online";
      let syncSuccess = false;

      // 1. Try fetching CSV feeds directly
      try {
        const [vRes, dRes] = await Promise.all([
          fetch(vehicleUrl).then((r) => {
            if (!r.ok || r.headers.get("content-type")?.includes("text/html")) throw new Error("Private CSV");
            return r.text();
          }),
          fetch(driverUrl).then((r) => {
            if (!r.ok || r.headers.get("content-type")?.includes("text/html")) throw new Error("Private CSV");
            return r.text();
          })
        ]);

        // Parse vehicles CSV
        const vehicleRows = parseCSV(vRes);
        if (vehicleRows.length > 1) {
          const headers = vehicleRows[0].map((h: string) => h.trim().toLowerCase());
          const plateIdx = headers.indexOf("plate #");
          const idIdx = headers.indexOf("vehicle id");
          const typeIdx = headers.indexOf("type of vehicle");
          const bodyIdx = headers.indexOf("body type");
          const statusIdx = headers.indexOf("status");

          for (let i = 1; i < vehicleRows.length; i++) {
            const row = vehicleRows[i];
            if (!row || row.length === 0) continue;
            const plate = (row[plateIdx !== -1 ? plateIdx : 0] || "").trim();
            if (!plate || plate.toLowerCase() === "plate #") continue;

            // Omit target units
            const cleanPlate = plate.toUpperCase().replace(/\s+/g, "");
            if (["4804LP", "6050JZ", "0261JB"].includes(cleanPlate)) continue;

            const vehicleId = (row[idIdx !== -1 ? idIdx : 1] || "").trim();
            const cleanId = vehicleId.toUpperCase().replace(/\s+/g, "");
            if (["CV-05", "EV-01", "EV-03"].includes(cleanId)) continue;

            const typeOfVehicle = typeIdx !== -1 ? String(row[typeIdx] || "").trim().toLowerCase() : "";
            const bodyType = bodyIdx !== -1 ? String(row[bodyIdx] || "").trim().toLowerCase() : "";
            const combined = `${typeOfVehicle} ${bodyType}`;

            let type = "company";
            if (combined.includes("mixer") || combined.includes("mix")) {
              type = "mixer";
            } else if (combined.includes("pump")) {
              type = "pump";
            }

            const status = statusIdx !== -1 ? (row[statusIdx] || "Active").trim() : "Active";

            fetchedVehicles.push({
              plate,
              vehicleId,
              type,
              status
            });
          }
        }

        // Parse drivers CSV
        const driverRows = parseCSV(dRes);
        if (driverRows.length > 1) {
          const headers = driverRows[0].map((h: string) => h.trim().toLowerCase());
          const nameIdx = headers.indexOf("name");
          const typeIdx = headers.indexOf("vehicle type");

          for (let i = 1; i < driverRows.length; i++) {
            const row = driverRows[i];
            if (!row || row.length === 0) continue;
            const name = (row[nameIdx !== -1 ? nameIdx : 0] || "").trim();
            if (!name || name.toLowerCase() === "name") continue;

            const rawType = typeIdx !== -1 ? String(row[typeIdx] || "").trim().toLowerCase() : "company";
            let type = "company";
            if (rawType.includes("mixer") && rawType.includes("pump")) {
              type = "mixer/pump";
            } else if (rawType.includes("mixer")) {
              type = "mixer";
            } else if (rawType.includes("pump")) {
              type = "pump";
            }

            fetchedDrivers.push({ name, type });
          }
        }

        syncSuccess = fetchedVehicles.length > 0 && fetchedDrivers.length > 0;
      } catch (csvErr) {
        console.warn("CSV fetch blocked, falling back to NextJS service account API...", csvErr);
        // 2. Failover to Next.js API route (service account auth proxy)
        try {
          const apiRes = await fetch("/api/vehicle-info");
          const apiData = await apiRes.json();
          if (apiData.success) {
            fetchedVehicles = apiData.vehicles || [];
            fetchedDrivers = apiData.drivers || [];
            source = "api";
            syncSuccess = fetchedVehicles.length > 0 && fetchedDrivers.length > 0;
          } else {
            console.warn("Roster API returned failure:", apiData.error);
          }
        } catch (apiErr) {
          console.warn("Failover Roster API fetch failed:", apiErr);
        }
      }

      // 3. Fetch plant staff list from gate-log List tab using sheets API
      let fetchedStaff: any[] = [];
      try {
        const staffRes = await fetch("/api/sheets/gate-log?tab_name=List!A1:E100");
        const staffData = await staffRes.json();
        if (staffData.success && staffData.data) {
          const rows = staffData.data;
          if (rows.length > 1) {
            const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
            const nameIdx = headers.indexOf("full name");
            const statusIdx = headers.indexOf("status");
            const deptIdx = headers.indexOf("department");

            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              if (!r || r.length === 0) continue;
              const name = (r[nameIdx !== -1 ? nameIdx : 1] || "").trim();
              const status = statusIdx !== -1 ? (r[statusIdx] || "Active").trim() : "Active";
              const dept = deptIdx !== -1 ? (r[deptIdx] || "").trim() : "";

              if (name && status.toLowerCase() === "active") {
                fetchedStaff.push({ name, dept });
              }
            }
          }
        }
      } catch (staffErr) {
        console.warn("Could not fetch gate log staff list, utilizing offline staff list:", staffErr);
        fetchedStaff = OFFLINE_STAFF;
      }

      // Update state and cache if we successfully retrieved new rosters
      if (syncSuccess) {
        if (fetchedVehicles.length > 0) setFleetList(fetchedVehicles);
        if (fetchedDrivers.length > 0) setDriversList(fetchedDrivers);
        if (fetchedStaff.length > 0) setStaffList(fetchedStaff);

        const syncTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        localStorage.setItem("ck_fleet_list", JSON.stringify(fetchedVehicles));
        localStorage.setItem("ck_drivers_list", JSON.stringify(fetchedDrivers));
        localStorage.setItem("ck_staff_list", JSON.stringify(fetchedStaff.length > 0 ? fetchedStaff : staffList));
        localStorage.setItem("ck_last_roster_sync", syncTime);

        setRosterSyncStatus(`Roster synced with Sheets (Last: ${syncTime})`);
        setRegistrySource(source);
      } else {
        console.warn("Roster sync could not retrieve vehicles/drivers. Using cached data.");
        setRosterSyncStatus("Sync failed. Using cached rosters.");
        setRegistrySource("offline");
      }
    } catch (err: any) {
      console.warn("Gracefully handled roster compliance sync error:", err);
      setRosterSyncStatus("Sync failed. Using cached rosters.");
      setRegistrySource("offline");
    }
  }, [fleetList, driversList, staffList]);

  // Fetch historical entries from sheet
  const fetchRemoteHistory = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch("/api/gate-log");
      const json = await res.json();
      if (json.success && json.data) {
        setRemoteHistory(json.data);
      }
    } catch (err) {
      console.warn("Could not fetch remote sheet history:", err);
    }
  }, []);

  // Initialize and listeners
  useEffect(() => {
    // Register service worker for offline-first caching
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

    const handleOnline = () => {
      setIsOnline(true);
      triggerLogsSync();
      syncComplianceRoster();
      fetchRemoteHistory();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Theme setup
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    if (savedTheme === "dark") {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }

    // Load initial stats & sync
    loadStatsAndLocalHistory();
    syncComplianceRoster();
    fetchRemoteHistory();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadStatsAndLocalHistory, syncComplianceRoster, fetchRemoteHistory, triggerLogsSync]);

  // Sync triggers when offline status switches to true
  useEffect(() => {
    if (isOnline) {
      triggerLogsSync();
    }
  }, [isOnline, triggerLogsSync]);

  // Manual update refresh
  const handleRefresh = async () => {
    setRefreshTrigger((p) => p + 1);
    await loadStatsAndLocalHistory();
    if (navigator.onLine) {
      await triggerLogsSync();
      await syncComplianceRoster();
      await fetchRemoteHistory();
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    if (nextTheme === "dark") {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  };

  // Compile unified roster names for staff autocomplete lookups
  const unifiedRosterNames = useMemo(() => {
    const names = new Set<string>();
    // Add drivers
    driversList.forEach((d) => {
      if (d && d.name) names.add(d.name.trim());
    });
    // Add staff
    staffList.forEach((s) => {
      if (s && s.name) names.add(s.name.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [driversList, staffList]);

  // Filter compliance drivers for Pump only (type contains 'pump')
  const pumpDriversRoster = useMemo(() => {
    return driversList
      .filter((d) => d && d.name && (d.type.toLowerCase().includes("pump") || d.type.toLowerCase().includes("mixer/pump")))
      .map((d) => d.name.trim())
      .sort((a, b) => a.localeCompare(b));
  }, [driversList]);

  // Filter compliance drivers for Mixer only (type contains 'mixer')
  const mixerDriversRoster = useMemo(() => {
    return driversList
      .filter((d) => d && d.name && (d.type.toLowerCase().includes("mixer") || d.type.toLowerCase().includes("mixer/pump")))
      .map((d) => d.name.trim())
      .sort((a, b) => a.localeCompare(b));
  }, [driversList]);

  // Filter local history by tab/category
  const filteredLocalHistory = useMemo(() => {
    return localHistory.filter((h) => h.category === activeTab);
  }, [localHistory, activeTab]);

  // Filter remote history by tab/category
  const filteredRemoteHistory = useMemo(() => {
    return remoteHistory[activeTab] || [];
  }, [remoteHistory, activeTab]);

  // Active Dispatches (in progress) for the selected category
  const activeDispatches = useMemo(() => {
    return filteredLocalHistory.filter((item) => item.status === "active");
  }, [filteredLocalHistory]);

  // Total active dispatches/check-ins count for bottom nav badge
  const totalActiveDispatchesCount = useMemo(() => {
    return localHistory.filter((item) => item.status === "active").length;
  }, [localHistory]);

  // Completed logs ready to copy or synced
  const completedLogs = useMemo(() => {
    const localCompleted = filteredLocalHistory.filter((item) => item.status !== "active");
    // Merge local completed and remote, deduplicating by Unique ID
    const mergedMap = new Map();
    filteredRemoteHistory.forEach((r: any) => {
      if (r.id) mergedMap.set(r.id, r);
    });
    localCompleted.forEach((l: any) => {
      if (l.id) mergedMap.set(l.id, l);
    });
    return Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredLocalHistory, filteredRemoteHistory]);

  // Format and copy history to clipboard as TSV
  const handleCopyTSV = () => {
    if (completedLogs.length === 0) return;

    let headers: string[] = [];
    let rows: string[][] = [];

    if (activeTab === "staff") {
      headers = ["Date", "Employee Name", "Time In", "Time Out", "Hours Worked", "OT Hours", "Unique ID"];
      rows = completedLogs.map((log: any) => [
        log.date || "",
        log.employeeName || "",
        log.timeIn || "",
        log.timeOut || "",
        String(log.hoursWorked || ""),
        String(log.otHours || ""),
        log.id || ""
      ]);
    } else if (activeTab === "pump") {
      headers = ["Date", "Driver Name", "Pump Truck ID / Plate", "Departure (Out)", "Return (In)", "Unique ID"];
      rows = completedLogs.map((log: any) => [
        log.date || "",
        log.driverName || "",
        log.truckId || "",
        log.departureTime || "",
        log.returnTime || "",
        log.id || ""
      ]);
    } else if (activeTab === "mixer") {
      headers = ["Date", "Driver Name", "Mixer Truck ID / Plate", "Delivery Ticket #", "Departure (Out)", "Return (In)", "Unique ID"];
      rows = completedLogs.map((log: any) => [
        log.date || "",
        log.driverName || "",
        log.truckId || "",
        log.deliveryTicket || "",
        log.departureTime || "",
        log.returnTime || "",
        log.id || ""
      ]);
    } else if (activeTab === "delivery") {
      headers = ["Date", "Driver Name", "Outside Truck Plate", "Material Type", "Ticket #", "Time In", "Time Out", "Unique ID"];
      rows = completedLogs.map((log: any) => [
        log.date || "",
        log.driverName || "",
        log.plate || "",
        log.materialType || "",
        log.ticketNum || "",
        log.timeIn || "",
        log.timeOut || "",
        log.id || ""
      ]);
    } else if (activeTab === "visitor") {
      headers = ["Date", "Visitor Name", "Purpose of Visit", "Time In", "Time Out", "Unique ID"];
      rows = completedLogs.map((log: any) => [
        log.date || "",
        log.visitorName || "",
        log.purpose || "",
        log.timeIn || "",
        log.timeOut || "",
        log.id || ""
      ]);
    }

    const tsvContent = [
      headers.join("\t"),
      ...rows.map((r: string[]) => r.join("\t"))
    ].join("\n");

    navigator.clipboard.writeText(tsvContent).then(() => {
      alert(`Copied ${completedLogs.length} rows of ${activeTab.toUpperCase()} history to clipboard as TSV!`);
    }).catch((err) => {
      console.error("Could not copy TSV: ", err);
    });
  };

  // Perform single row retry sync
  const handleSingleRetry = async (log: any) => {
    if (!isOnline) {
      alert("Offline mode. Cannot retry sync.");
      return;
    }
    try {
      const response = await fetch("/api/gate-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs: [log] }),
      });
      const data = await response.json();
      if (data.success) {
        await updateEntryStatus(log.id, "synced");
        alert("Synced successfully!");
      } else {
        throw new Error(data.error || "Single row sync failed");
      }
      handleRefresh();
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    }
  };

  return (
    <div className="app-container">
      {/* Premium Obsidian/Light Header */}
      <header className="app-header">
        <div className="header-title-container">
          <h1 className="header-title">
            Concrete Kings <span>Gate</span>
          </h1>
          <div className="header-subtitle">Gate Operations & Security Console</div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Settings Trigger */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="btn-secondary"
            style={{ padding: "8px 12px", borderRadius: "10px" }}
            title="Open Configurations"
          >
            <SettingsIcon size={16} />
          </button>
          
          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="btn-secondary"
            style={{ padding: "8px 12px", borderRadius: "10px" }}
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          
          {/* Sync / Refresh */}
          <button
            onClick={handleRefresh}
            className="btn-secondary"
            style={{ padding: "8px 12px", borderRadius: "10px" }}
            disabled={syncing}
            title="Sync logs & refresh rosters"
          >
            <RefreshCw size={16} className={syncing ? "spin-anim" : ""} />
          </button>
        </div>
      </header>

      {/* Sync / Roster Connection Indicator */}
      {!isOnline ? (
        <div className="sync-banner offline-pending">
          <WifiOff size={14} />
          <span>Offline mode — {pendingCount} logs queued locally</span>
        </div>
      ) : pendingCount > 0 ? (
        <div className="sync-banner offline-pending">
          <RefreshCw size={14} className="spin-anim" />
          <span>Syncing {pendingCount} logs to master spreadsheet...</span>
        </div>
      ) : (
        <div className="sync-banner online-synced">
          <Wifi size={14} />
          <span>Connected — {rosterSyncStatus}</span>
        </div>
      )}

      {/* Scrollable swipe-friendly category tabs */}
      <div className="category-tabs-scroll">
        {[
          { id: "staff", label: "Staff Attendance", icon: <UserCheck size={16} /> },
          { id: "pump", label: "Pump Vehicles", icon: <Truck size={16} /> },
          { id: "mixer", label: "Mixer Vehicles", icon: <Truck size={16} /> },
          { id: "delivery", label: "Outside Deliveries", icon: <ClipboardList size={16} /> },
          { id: "visitor", label: "Outside Visitors", icon: <Users size={16} /> }
        ].map((tab: any) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setActiveNav("active");
            }}
            className={`category-tab-btn ${activeTab === tab.id ? "active" : ""}`}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {tab.icon}
              <span>{tab.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Main Screen Wrapper */}
      <main className="screen-wrapper">
        
        {/* VIEW 1: ACTIVE VIEW (Form + Active Checklist below it) */}
        {activeNav === "active" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Form Section */}
            <div>
              {activeTab === "staff" && (
                <StaffAttendanceForm
                  onEntrySaved={handleRefresh}
                  roster={unifiedRosterNames}
                />
              )}
              {activeTab === "pump" && (
                <PumpDispatchForm
                  onEntrySaved={handleRefresh}
                  roster={pumpDriversRoster}
                  fleetList={fleetList}
                />
              )}
              {activeTab === "mixer" && (
                <MixerDispatchForm
                  onEntrySaved={handleRefresh}
                  roster={mixerDriversRoster}
                  fleetList={fleetList}
                />
              )}
              {activeTab === "delivery" && (
                <OutsideDeliveryForm onEntrySaved={handleRefresh} />
              )}
              {activeTab === "visitor" && (
                <OutsideVisitorForm onEntrySaved={handleRefresh} />
              )}
            </div>

            {/* Active Checklist Section */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 className="queue-section-title" style={{ color: "var(--failed)" }}>
                <Clock size={16} />
                <span>
                  {activeTab === "staff"
                    ? `Clocked In Staff (${activeDispatches.length})`
                    : activeTab === "visitor"
                    ? `Active Visitors in Yard (${activeDispatches.length})`
                    : activeTab === "delivery"
                    ? `Active Deliveries in Yard (${activeDispatches.length})`
                    : `Active in Yard / Dispatched (${activeDispatches.length})`}
                </span>
              </h3>
              
              {activeDispatches.length === 0 ? (
                <div className="glass-panel empty-state" style={{ padding: "30px 20px" }}>
                  <Check size={32} style={{ color: "var(--success)" }} />
                  <p>No active/dispatched logs found in this category.</p>
                </div>
              ) : (
                <div className="active-dispatches-grid">
                  {activeDispatches.map((dispatch: any) => (
                    <ActiveDispatchCard
                      key={dispatch.id}
                      dispatch={dispatch}
                      getElapsedTime={getElapsedTime}
                      onReturnLogged={handleRefresh}
                      category={activeTab}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: LEDGER HISTORY VIEW */}
        {activeNav === "history" && (
          <section>
            <div className="history-header">
              <h3 className="queue-section-title">
                <History size={16} style={{ color: "var(--accent-primary)" }} />
                <span>Today's Completed History ({completedLogs.length})</span>
              </h3>
              {completedLogs.length > 0 && (
                <button onClick={handleCopyTSV} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "8px" }}>
                  <Copy size={14} />
                  <span>Copy TSV for Excel</span>
                </button>
              )}
            </div>

            {completedLogs.length === 0 ? (
              <div className="glass-panel empty-state">
                <Users size={32} />
                <p>No completed entries logged today for this category.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {completedLogs.map((log: any) => (
                  <HistoryRow key={log.id} log={log} onRetrySync={handleSingleRetry} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Persistent Glassmorphic Nav Bar */}
      <nav className="tab-navbar">
        <button
          onClick={() => setActiveNav("active")}
          className={`tab-button ${activeNav === "active" ? "active" : ""}`}
        >
          <div className="tab-icon-wrapper">
            <Clock size={22} />
          </div>
          <span>Active</span>
          {activeDispatches.length > 0 && <div className="tab-badge">{activeDispatches.length}</div>}
        </button>

        <button
          onClick={() => setActiveNav("history")}
          className={`tab-button ${activeNav === "history" ? "active" : ""}`}
        >
          <div className="tab-icon-wrapper">
            <History size={22} />
          </div>
          <span>History</span>
          {pendingCount > 0 && <div className="tab-badge">{pendingCount}</div>}
        </button>
      </nav>

      {/* Settings Modal Drawer */}
      {showSettingsModal && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettingsModal(false)}
          onSaved={handleRefresh}
        />
      )}

      {/* Global CSS overrides */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-anim {
          animation: spin 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
}

// ========================================================
// 1. AUTOCOMPLETE ROSTER COMPONENT
// ========================================================
interface AutocompleteProps {
  label: string;
  id: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  required?: boolean;
}

function AutocompleteInput({
  label,
  id,
  placeholder,
  value,
  onChange,
  suggestions,
  required = false
}: AutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setQuery(text);
    onChange(text);

    if (text.trim().length > 0) {
      const filteredList = suggestions.filter((name) =>
        name.toLowerCase().includes(text.toLowerCase())
      );
      setFiltered(filteredList);
      setShowDropdown(true);
    } else {
      setFiltered([]);
      setShowDropdown(false);
    }
  };

  const handleSelect = (name: string) => {
    setQuery(name);
    onChange(name);
    setShowDropdown(false);
  };

  return (
    <div className="form-group autocomplete-container">
      <label htmlFor={id}>{label}</label>
      <div className="input-addon-container">
        <input
          type="text"
          id={id}
          className="form-input"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (query.trim().length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            // Slight delay to allow clicking suggestions before hiding
            setTimeout(() => setShowDropdown(false), 200);
          }}
          required={required}
          autoComplete="off"
        />
        <Search size={16} className="text-muted" style={{ position: "absolute", right: "16px" }} />
      </div>
      {showDropdown && filtered.length > 0 && (
        <div className="autocomplete-dropdown">
          {filtered.map((item: string) => (
            <div
              key={item}
              className="autocomplete-item"
              onMouseDown={() => handleSelect(item)}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========================================================
// 2. ACTIVE DISPATCH CARD COMPONENT
// ========================================================
function ActiveDispatchCard({ dispatch, getElapsedTime, onReturnLogged, category }: any) {
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [returnTime, setReturnTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [ticketNum, setTicketNum] = useState(dispatch.deliveryTicket || "");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!returnTime) {
      setErrorMsg(
        category === "staff"
          ? "Please provide sign-out time."
          : category === "pump" || category === "mixer"
          ? "Please provide check-in return time."
          : "Please provide departure time."
      );
      return;
    }

    try {
      const updatedItem = { ...dispatch };
      updatedItem.status = "pending"; // Ready to sync

      if (category === "staff") {
        updatedItem.timeOut = returnTime;
        // Hours worked calculation
        const inMin = parseTimeToMinutes(dispatch.timeIn);
        const outMin = parseTimeToMinutes(returnTime);
        let diffMin = outMin - inMin;
        if (diffMin < 0) diffMin += 24 * 60; // Wraps midnight

        const totalHours = Math.round((diffMin / 60) * 100) / 100;
        updatedItem.hoursWorked = Math.min(10.0, totalHours);
        updatedItem.otHours = Math.max(0.0, totalHours - 10.0);
      } else if (category === "pump") {
        updatedItem.returnTime = returnTime;
      } else if (category === "mixer") {
        updatedItem.returnTime = returnTime;
        updatedItem.deliveryTicket = ticketNum;
      } else if (category === "delivery") {
        updatedItem.timeOut = returnTime;
      } else if (category === "visitor") {
        updatedItem.timeOut = returnTime;
      }

      updatedItem.notes = notes.trim();
      updatedItem.timestamp = Date.now(); // update time to sync

      await saveEntry(updatedItem);
      setShowCheckInModal(false);
      if (onReturnLogged) onReturnLogged();
    } catch (err: any) {
      setErrorMsg(category === "staff" ? "Failed to write sign-out log." : "Failed to write check-in log.");
    }
  };

  const openCheckoutModal = () => {
    const now = new Date();
    setReturnTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    setShowCheckInModal(true);
  };

  return (
    <div className="active-dispatch-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="dispatch-details">
          <div className="dispatch-plate" style={{ fontSize: "15px" }}>
            {category === "staff" ? dispatch.employeeName : category === "visitor" ? dispatch.visitorName : dispatch.truckId || dispatch.plate}
          </div>
          <div className="dispatch-driver" style={{ fontSize: "12px" }}>
            {category === "staff"
              ? `In: ${dispatch.timeIn}`
              : category === "visitor"
              ? `In: ${dispatch.timeIn} | ${dispatch.purpose}`
              : category === "delivery"
              ? `In: ${dispatch.timeIn} | ${dispatch.driverName} (${dispatch.materialType})`
              : `${dispatch.driverName} | Out: ${dispatch.departureTime || dispatch.timeIn}`}
          </div>
          {category === "mixer" && dispatch.deliveryTicket && (
            <div className="dispatch-driver" style={{ fontWeight: 600, fontSize: "12px" }}>Ticket #: {dispatch.deliveryTicket}</div>
          )}
        </div>
      </div>
      <button onClick={openCheckoutModal} className="btn-primary" style={{ padding: "8px", fontSize: "13px", borderRadius: "8px" }}>
        <Check size={14} />
        <span>
          {category === "staff"
            ? "Sign Out"
            : category === "pump" || category === "mixer"
            ? "Log Return"
            : "Log Departure"}
        </span>
      </button>

      {showCheckInModal && (
        <div className="modal-overlay">
          <form onSubmit={handleCheckInSubmit} className="glass-panel modal-content" style={{ padding: 0 }}>
            <div className="modal-header">
              <h3>
                {category === "staff"
                  ? "Sign Out Staff Member"
                  : category === "pump" || category === "mixer"
                  ? "Log Vehicle Return"
                  : "Log Departure"}
              </h3>
              <button type="button" onClick={() => setShowCheckInModal(false)} className="modal-close">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ gap: "12px" }}>
              {errorMsg && (
                <div className="detail-error">{errorMsg}</div>
              )}
              <div className="form-group">
                <label>
                  {category === "staff"
                    ? "Sign-out Time (24h)"
                    : category === "pump" || category === "mixer"
                    ? "Arrival / Return Time (24h)"
                    : "Departure Time (24h)"}
                </label>
                <input
                  type="time"
                  className="form-input"
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  required
                />
              </div>
              {category === "mixer" && (
                <div className="form-group">
                  <label>Delivery Ticket # (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={ticketNum}
                    onChange={(e) => setTicketNum(e.target.value)}
                  />
                </div>
              )}
              <div className="form-group">
                <label>Shift Notes / Comments</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter comments..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="modal-actions" style={{ marginTop: "12px" }}>
                <button type="button" onClick={() => setShowCheckInModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">
                  {category === "staff"
                    ? "Confirm Sign Out"
                    : category === "pump" || category === "mixer"
                    ? "Confirm Return"
                    : "Confirm Departure"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Helper to parse HH:MM into minutes of day
function parseTimeToMinutes(timeStr: string) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ========================================================
// 3. STAFF ATTENDANCE FORM (CLOCK-IN ONLY)
// ========================================================
function StaffAttendanceForm({ onEntrySaved, roster }: any) {
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [selectedStaff, setSelectedStaff] = useState("");
  const [timeIn, setTimeIn] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    // Validate autocomplete exact roster match
    const cleanStaff = selectedStaff.trim();
    if (!cleanStaff) {
      setFeedback({ type: "error", text: "Please select an employee name." });
      return;
    }

    const exists = roster.some((r: string) => r.toLowerCase() === cleanStaff.toLowerCase());
    if (!exists) {
      setFeedback({
        type: "error",
        text: `"${cleanStaff}" is not in the active staff roster. Enforces exact database matching.`
      });
      return;
    }

    const uniqueId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    let log: any = {
      id: uniqueId,
      date,
      employeeName: cleanStaff,
      category: "staff",
      status: "active",
      timeIn,
      timeOut: "",
      hoursWorked: "",
      otHours: "",
      notes: notes.trim(),
      startTimestamp: Date.now(),
      timestamp: Date.now()
    };

    try {
      await saveEntry(log);
      setFeedback({
        type: "success",
        text: `Clocked In ${cleanStaff}!`
      });
      setSelectedStaff("");
      setNotes("");
      const now = new Date();
      setTimeIn(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
      if (onEntrySaved) onEntrySaved();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", text: "IndexedDB error: Failed to save." });
    }
  };

  return (
    <div className="glass-panel" style={{ padding: "20px" }}>
      <h2 style={{ fontSize: "18px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <UserCheck size={20} style={{ color: "var(--accent-primary)" }} />
        <span>Staff Attendance Clock-In</span>
      </h2>

      {feedback && (
        <div className={`sync-banner ${feedback.type === "success" ? "online-synced" : "offline-pending"}`} style={{ marginBottom: "14px", borderRadius: "8px" }}>
          {feedback.type === "success" ? <Check size={14} /> : <AlertCircle size={14} />}
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-section">
        {/* Search Autocomplete */}
        <AutocompleteInput
          label="Select Staff Member"
          id="staff-autocomplete"
          placeholder="Type name (e.g. Probin)..."
          value={selectedStaff}
          onChange={setSelectedStaff}
          suggestions={roster}
          required
        />

        <div className="form-group">
          <label>Shift Date</label>
          <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div className="form-group">
          <label>Clock-In Time</label>
          <input type="time" className="form-input" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} required />
        </div>

        <div className="form-group form-group-full">
          <label>Notes / Comments</label>
          <input type="text" className="form-input" placeholder="Optional comments..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <button type="submit" className="btn-primary form-group-full">
          <Plus size={18} />
          <span>Clock In Staff</span>
        </button>
      </form>
    </div>
  );
}

// ========================================================
// 4. PUMP DISPATCH FORM (CLOCK-IN ONLY)
// ========================================================
function PumpDispatchForm({ onEntrySaved, roster, fleetList }: any) {
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [selectedDriver, setSelectedDriver] = useState("");
  const [selectedPlate, setSelectedPlate] = useState("");
  const [depTime, setDepTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [feedback, setFeedback] = useState<any>(null);

  // Filter fleet to only active pump plates (CL/CP plates)
  const pumpPlates = useMemo(() => {
    return fleetList
      .filter((v: any) => {
        const matchesType = v.type === "pump";
        const plateStr = (v.plate || "").toUpperCase();
        const matchesPlate = plateStr.includes("CL") || plateStr.includes("CP");
        const isActive = (v.status || "Active").trim().toUpperCase() === "ACTIVE";
        return (matchesType || matchesPlate) && isActive;
      })
      .map((v: any) => `${v.vehicleId || ""} (${v.plate})`.trim());
  }, [fleetList]);

  // Set default plate on load
  useEffect(() => {
    if (pumpPlates.length > 0 && !selectedPlate) {
      setSelectedPlate(pumpPlates[0]);
    }
  }, [pumpPlates, selectedPlate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    // Validate autocomplete exact roster match
    const cleanDriver = selectedDriver.trim();
    if (!cleanDriver) {
      setFeedback({ type: "error", text: "Please select a driver." });
      return;
    }

    const exists = roster.some((r: string) => r.toLowerCase() === cleanDriver.toLowerCase());
    if (!exists) {
      setFeedback({
        type: "error",
        text: `"${cleanDriver}" is not in the active Pump driver roster. Enforces exact database matching.`
      });
      return;
    }

    const uniqueId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowTime = new Date();
    const currentHHMM = depTime || `${String(nowTime.getHours()).padStart(2, "0")}:${String(nowTime.getMinutes()).padStart(2, "0")}`;

    const log = {
      id: uniqueId,
      date,
      driverName: cleanDriver,
      truckId: selectedPlate,
      departureTime: currentHHMM,
      returnTime: "",
      category: "pump",
      status: "active",
      startTimestamp: Date.now(),
      timestamp: Date.now()
    };

    try {
      await saveEntry(log);
      setFeedback({ type: "success", text: `Dispatched ${selectedPlate}!` });
      setSelectedDriver("");
      const now = new Date();
      setDepTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
      if (onEntrySaved) onEntrySaved();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", text: "IndexedDB error: Failed to save." });
    }
  };

  return (
    <div className="glass-panel" style={{ padding: "20px" }}>
      <h2 style={{ fontSize: "18px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Truck size={20} style={{ color: "var(--accent-primary)" }} />
        <span>Log Pump Dispatch (Departure)</span>
      </h2>

      {feedback && (
        <div className={`sync-banner ${feedback.type === "success" ? "online-synced" : "offline-pending"}`} style={{ marginBottom: "14px", borderRadius: "8px" }}>
          {feedback.type === "success" ? <Check size={14} /> : <AlertCircle size={14} />}
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-section">
        <div className="form-group">
          <label htmlFor="pump-driver">Select Pump Driver</label>
          <select
            id="pump-driver"
            className="form-select"
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            required
          >
            <option value="">-- Select Driver --</option>
            {roster.map((name: string) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="pump-plate">Select Pump Truck ID / Plate</label>
          <select
            id="pump-plate"
            className="form-select"
            value={selectedPlate}
            onChange={(e) => setSelectedPlate(e.target.value)}
            required
          >
            {pumpPlates.length === 0 ? (
              <option value="">No active pump trucks found</option>
            ) : (
              pumpPlates.map((plate: string) => (
                <option key={plate} value={plate}>{plate}</option>
              ))
            )}
          </select>
        </div>

        <div className="form-group">
          <label>Shift Date</label>
          <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div className="form-group">
          <label>Departure Time</label>
          <input type="time" className="form-input" value={depTime} onChange={(e) => setDepTime(e.target.value)} required />
        </div>

        <button type="submit" className="btn-primary form-group-full">
          <Plus size={18} />
          <span>Log Departure (Out)</span>
        </button>
      </form>
    </div>
  );
}

// ========================================================
// 5. MIXER DISPATCH FORM (CLOCK-IN ONLY)
// ========================================================
function MixerDispatchForm({ onEntrySaved, roster, fleetList }: any) {
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [selectedDriver, setSelectedDriver] = useState("");
  const [selectedPlate, setSelectedPlate] = useState("");
  const [ticketNum, setTicketNum] = useState("");
  const [depTime, setDepTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [feedback, setFeedback] = useState<any>(null);

  // Filter fleet to only active mixer plates (CM plates)
  const mixerPlates = useMemo(() => {
    return fleetList
      .filter((v: any) => {
        const matchesType = v.type === "mixer";
        const plateStr = (v.plate || "").toUpperCase();
        const matchesPlate = plateStr.includes("CM");
        const isActive = (v.status || "Active").trim().toUpperCase() === "ACTIVE";
        return (matchesType || matchesPlate) && isActive;
      })
      .map((v: any) => `${v.vehicleId || ""} (${v.plate})`.trim());
  }, [fleetList]);

  // Set default plate on load
  useEffect(() => {
    if (mixerPlates.length > 0 && !selectedPlate) {
      setSelectedPlate(mixerPlates[0]);
    }
  }, [mixerPlates, selectedPlate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    // Validate autocomplete exact roster match
    const cleanDriver = selectedDriver.trim();
    if (!cleanDriver) {
      setFeedback({ type: "error", text: "Please select a driver." });
      return;
    }

    const exists = roster.some((r: string) => r.toLowerCase() === cleanDriver.toLowerCase());
    if (!exists) {
      setFeedback({
        type: "error",
        text: `"${cleanDriver}" is not in the active Mixer driver roster. Enforces exact database matching.`
      });
      return;
    }

    const uniqueId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowTime = new Date();
    const currentHHMM = depTime || `${String(nowTime.getHours()).padStart(2, "0")}:${String(nowTime.getMinutes()).padStart(2, "0")}`;

    const log = {
      id: uniqueId,
      date,
      driverName: cleanDriver,
      truckId: selectedPlate,
      deliveryTicket: ticketNum.trim(),
      departureTime: currentHHMM,
      returnTime: "",
      category: "mixer",
      status: "active",
      startTimestamp: Date.now(),
      timestamp: Date.now()
    };

    try {
      await saveEntry(log);
      setFeedback({ type: "success", text: `Dispatched Mixer ${selectedPlate}!` });
      setSelectedDriver("");
      setTicketNum("");
      const now = new Date();
      setDepTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
      if (onEntrySaved) onEntrySaved();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", text: "IndexedDB error: Failed to save." });
    }
  };

  return (
    <div className="glass-panel" style={{ padding: "20px" }}>
      <h2 style={{ fontSize: "18px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Truck size={20} style={{ color: "var(--accent-primary)" }} />
        <span>Log Mixer Dispatch (Departure)</span>
      </h2>

      {feedback && (
        <div className={`sync-banner ${feedback.type === "success" ? "online-synced" : "offline-pending"}`} style={{ marginBottom: "14px", borderRadius: "8px" }}>
          {feedback.type === "success" ? <Check size={14} /> : <AlertCircle size={14} />}
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-section">
        <div className="form-group">
          <label htmlFor="mixer-driver">Select Mixer Driver</label>
          <select
            id="mixer-driver"
            className="form-select"
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            required
          >
            <option value="">-- Select Driver --</option>
            {roster.map((name: string) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="mixer-plate">Select Mixer Truck ID / Plate</label>
          <select
            id="mixer-plate"
            className="form-select"
            value={selectedPlate}
            onChange={(e) => setSelectedPlate(e.target.value)}
            required
          >
            {mixerPlates.length === 0 ? (
              <option value="">No active mixer trucks found</option>
            ) : (
              mixerPlates.map((plate: string) => (
                <option key={plate} value={plate}>{plate}</option>
              ))
            )}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="mixer-ticket">Delivery Ticket # (Optional)</label>
          <input
            type="text"
            id="mixer-ticket"
            className="form-input"
            placeholder="e.g. 15725"
            value={ticketNum}
            onChange={(e) => setTicketNum(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Shift Date</label>
          <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div className="form-group">
          <label>Departure Time</label>
          <input type="time" className="form-input" value={depTime} onChange={(e) => setDepTime(e.target.value)} required />
        </div>

        <button type="submit" className="btn-primary form-group-full">
          <Plus size={18} />
          <span>Log Departure (Out)</span>
        </button>
      </form>
    </div>
  );
}

// ========================================================
// 6. OUTSIDE DELIVERY FORM (CLOCK-IN ONLY)
// ========================================================
function OutsideDeliveryForm({ onEntrySaved }: any) {
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [driverName, setDriverName] = useState("");
  const [plate, setPlate] = useState("");
  const [materialType, setMaterialType] = useState("Sand");
  const [ticketNum, setTicketNum] = useState("");
  const [timeIn, setTimeIn] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [feedback, setFeedback] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanDriver = driverName.trim();
    const cleanPlate = plate.trim();

    if (!cleanDriver || !cleanPlate) {
      setFeedback({ type: "error", text: "Please provide both Driver Name and Truck Plate." });
      return;
    }

    const uniqueId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowTime = new Date();
    const currentHHMM = timeIn || `${String(nowTime.getHours()).padStart(2, "0")}:${String(nowTime.getMinutes()).padStart(2, "0")}`;

    const log = {
      id: uniqueId,
      date,
      driverName: cleanDriver,
      plate: cleanPlate.toUpperCase(),
      materialType,
      ticketNum: ticketNum.trim(),
      timeIn: currentHHMM,
      timeOut: "",
      category: "delivery",
      status: "active",
      startTimestamp: Date.now(),
      timestamp: Date.now()
    };

    try {
      await saveEntry(log);
      setFeedback({ type: "success", text: `Outside truck ${cleanPlate} checked in!` });
      setDriverName("");
      setPlate("");
      setTicketNum("");
      const now = new Date();
      setTimeIn(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
      if (onEntrySaved) onEntrySaved();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", text: "IndexedDB error: Failed to save." });
    }
  };

  return (
    <div className="glass-panel" style={{ padding: "20px" }}>
      <h2 style={{ fontSize: "18px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <ClipboardList size={20} style={{ color: "var(--accent-primary)" }} />
        <span>Log Outside Delivery Arrival</span>
      </h2>

      {feedback && (
        <div className={`sync-banner ${feedback.type === "success" ? "online-synced" : "offline-pending"}`} style={{ marginBottom: "14px", borderRadius: "8px" }}>
          {feedback.type === "success" ? <Check size={14} /> : <AlertCircle size={14} />}
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-section">
        <div className="form-group">
          <label htmlFor="del-driver">Driver Name</label>
          <input
            type="text"
            id="del-driver"
            className="form-input"
            placeholder="e.g. John Doe"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="del-plate">Outside Truck Plate</label>
          <input
            type="text"
            id="del-plate"
            className="form-input"
            placeholder="e.g. 1234 AB"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="del-material">Material Type</label>
          <select
            id="del-material"
            className="form-select"
            value={materialType}
            onChange={(e) => setMaterialType(e.target.value)}
          >
            {["Sand", "Gravel", "Cement", "Admixture", "Fuel", "Other"].map((mat: string) => (
              <option key={mat} value={mat}>{mat}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="del-ticket">Ticket / Invoice #</label>
          <input
            type="text"
            id="del-ticket"
            className="form-input"
            placeholder="e.g. TK-9912"
            value={ticketNum}
            onChange={(e) => setTicketNum(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Shift Date</label>
          <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div className="form-group">
          <label>Arrival Time</label>
          <input type="time" className="form-input" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} required />
        </div>

        <button type="submit" className="btn-primary form-group-full">
          <Plus size={18} />
          <span>Log Arrival (Check In)</span>
        </button>
      </form>
    </div>
  );
}

// ========================================================
// 7. OUTSIDE VISITOR FORM (CLOCK-IN ONLY)
// ========================================================
function OutsideVisitorForm({ onEntrySaved }: any) {
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [visitorName, setVisitorName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [timeIn, setTimeIn] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [feedback, setFeedback] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanVisitor = visitorName.trim();
    const cleanPurpose = purpose.trim();

    if (!cleanVisitor || !cleanPurpose) {
      setFeedback({ type: "error", text: "Please provide Visitor Name and Purpose of Visit." });
      return;
    }

    const uniqueId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowTime = new Date();
    const currentHHMM = timeIn || `${String(nowTime.getHours()).padStart(2, "0")}:${String(nowTime.getMinutes()).padStart(2, "0")}`;

    const log = {
      id: uniqueId,
      date,
      visitorName: cleanVisitor,
      purpose: cleanPurpose,
      timeIn: currentHHMM,
      timeOut: "",
      category: "visitor",
      status: "active",
      startTimestamp: Date.now(),
      timestamp: Date.now()
    };

    try {
      await saveEntry(log);
      setFeedback({ type: "success", text: `Visitor ${cleanVisitor} checked in!` });
      setVisitorName("");
      setPurpose("");
      const now = new Date();
      setTimeIn(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
      if (onEntrySaved) onEntrySaved();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", text: "IndexedDB error: Failed to save." });
    }
  };

  return (
    <div className="glass-panel" style={{ padding: "20px" }}>
      <h2 style={{ fontSize: "18px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Users size={20} style={{ color: "var(--accent-primary)" }} />
        <span>Log Outside Visitor Arrival</span>
      </h2>

      {feedback && (
        <div className={`sync-banner ${feedback.type === "success" ? "online-synced" : "offline-pending"}`} style={{ marginBottom: "14px", borderRadius: "8px" }}>
          {feedback.type === "success" ? <Check size={14} /> : <AlertCircle size={14} />}
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-section">
        <div className="form-group">
          <label htmlFor="vis-name">Visitor Full Name</label>
          <input
            type="text"
            id="vis-name"
            className="form-input"
            placeholder="e.g. Alice Smith"
            value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="vis-purpose">Purpose of Visit</label>
          <input
            type="text"
            id="vis-purpose"
            className="form-input"
            placeholder="e.g. Audit, Maintenance, Delivery, Interview"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Shift Date</label>
          <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div className="form-group">
          <label>Arrival Time</label>
          <input type="time" className="form-input" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} required />
        </div>

        <button type="submit" className="btn-primary form-group-full">
          <Plus size={18} />
          <span>Log Visitor Entry</span>
        </button>
      </form>
    </div>
  );
}

// ========================================================
// 8. LEDGER HISTORY ROW
// ========================================================
function HistoryRow({ log, onRetrySync }: any) {
  const [showDetailModal, setShowDetailModal] = useState(false);

  const getTitle = () => {
    if (log.category === "staff") return log.employeeName;
    if (log.category === "visitor") return log.visitorName;
    return log.truckId || log.plate;
  };

  const getSubtitle = () => {
    if (log.category === "staff") {
      return `In: ${log.timeIn} | Out: ${log.timeOut}`;
    }
    if (log.category === "visitor") {
      return `In: ${log.timeIn} | Out: ${log.timeOut} | Purpose: ${log.purpose}`;
    }
    if (log.category === "delivery") {
      return `In: ${log.timeIn} | Out: ${log.timeOut} | ${log.driverName} (${log.materialType})`;
    }
    if (log.category === "pump") {
      return `Driver: ${log.driverName} | Out: ${log.departureTime} | In: ${log.returnTime}`;
    }
    if (log.category === "mixer") {
      return `Driver: ${log.driverName} | Ticket: ${log.deliveryTicket || "N/A"} | Out: ${log.departureTime} | In: ${log.returnTime}`;
    }
    return "";
  };

  return (
    <>
      <div onClick={() => setShowDetailModal(true)} className="glass-panel log-item animate-fade" style={{ background: "var(--bg-secondary)" }}>
        <div className="log-item-left">
          <div className="log-item-title">{getTitle()}</div>
          <div className="log-item-subtitle">{getSubtitle()}</div>
        </div>
        <div className="log-item-right">
          <span className={`badge ${log.status}`}>
            {log.status === "synced" ? "synced" : log.status === "failed" ? "failed" : "pending"}
          </span>
          <div className="log-item-subtitle">{log.date}</div>
        </div>
      </div>

      {showDetailModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ padding: 0 }}>
            <div className="modal-header">
              <h3>Log Details</h3>
              <button onClick={() => setShowDetailModal(false)} className="modal-close">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">Log ID</span>
                <span className="detail-value" style={{ fontFamily: "monospace", fontSize: "12px" }}>{log.id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Category</span>
                <span className="detail-value" style={{ textTransform: "capitalize" }}>{log.category}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Sync Status</span>
                <span className={`badge ${log.status}`} style={{ margin: 0 }}>{log.status}</span>
              </div>

              {log.errorMessage && (
                <div className="detail-error">
                  <strong>Sync Error:</strong> {log.errorMessage}
                </div>
              )}

              {/* Category-specific specs */}
              {log.category === "staff" && (
                <>
                  <div className="detail-row">
                    <span className="detail-label">Employee</span>
                    <span className="detail-value">{log.employeeName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Time In</span>
                    <span className="detail-value">{log.timeIn}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Time Out</span>
                    <span className="detail-value">{log.timeOut}</span>
                  </div>
                </>
              )}

              {log.category === "pump" && (
                <>
                  <div className="detail-row">
                    <span className="detail-label">Driver</span>
                    <span className="detail-value">{log.driverName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Pump Truck</span>
                    <span className="detail-value">{log.truckId}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Departure (Out)</span>
                    <span className="detail-value">{log.departureTime}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Return (In)</span>
                    <span className="detail-value">{log.returnTime}</span>
                  </div>
                </>
              )}

              {log.category === "mixer" && (
                <>
                  <div className="detail-row">
                    <span className="detail-label">Driver</span>
                    <span className="detail-value">{log.driverName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Mixer Truck</span>
                    <span className="detail-value">{log.truckId}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Delivery Ticket #</span>
                    <span className="detail-value">{log.deliveryTicket || "N/A"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Departure (Out)</span>
                    <span className="detail-value">{log.departureTime}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Return (In)</span>
                    <span className="detail-value">{log.returnTime}</span>
                  </div>
                </>
              )}

              {log.category === "delivery" && (
                <>
                  <div className="detail-row">
                    <span className="detail-label">Driver</span>
                    <span className="detail-value">{log.driverName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Truck Plate</span>
                    <span className="detail-value">{log.plate}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Material Type</span>
                    <span className="detail-value">{log.materialType}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Ticket / Invoice #</span>
                    <span className="detail-value">{log.ticketNum || "N/A"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Time In</span>
                    <span className="detail-value">{log.timeIn}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Time Out</span>
                    <span className="detail-value">{log.timeOut}</span>
                  </div>
                </>
              )}

              {log.category === "visitor" && (
                <>
                  <div className="detail-row">
                    <span className="detail-label">Visitor</span>
                    <span className="detail-value">{log.visitorName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Purpose</span>
                    <span className="detail-value">{log.purpose}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Time In</span>
                    <span className="detail-value">{log.timeIn}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Time Out</span>
                    <span className="detail-value">{log.timeOut}</span>
                  </div>
                </>
              )}

              {log.notes && (
                <div className="detail-notes">
                  <strong>Notes:</strong> {log.notes}
                </div>
              )}

              <div className="modal-actions">
                <button onClick={() => setShowDetailModal(false)} className="btn-secondary">Close</button>
                {log.status === "failed" && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      onRetrySync(log);
                    }}
                    className="btn-primary"
                  >
                    Retry Sync
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ========================================================
// 9. CONFIGURATION SETTINGS MODAL
// ========================================================
function SettingsModal({ settings, onClose, onSaved }: any) {
  const [guardName, setGuardName] = useState(settings.guardName || "");
  const [appsScriptUrl, setAppsScriptUrl] = useState(settings.appsScriptUrl || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await saveAllSettings({
        guardName: guardName.trim(),
        appsScriptUrl: appsScriptUrl.trim()
      });
      onSaved();
      onClose();
    } catch (err) {
      alert("Failed to save settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetQueue = async () => {
    if (confirm("Are you sure you want to reset all synced/failed entries back to pending? This will trigger a resync of all local records.")) {
      const count = await resetSyncedToPending();
      alert(`Queued ${count} entries back to pending!`);
      onSaved();
    }
  };

  const handleClearHistory = async () => {
    if (confirm("Are you sure you want to clear all synced logs from this device? Pending/Active logs will be preserved.")) {
      await clearAllSyncedEntries();
      alert("Synced history cleared from device storage.");
      onSaved();
    }
  };

  return (
    <div className="modal-overlay">
      <form onSubmit={handleSave} className="glass-panel modal-content" style={{ padding: 0 }}>
        <div className="modal-header">
          <h3>Gate Guard Configuration</h3>
          <button type="button" onClick={onClose} className="modal-close">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ gap: "14px" }}>
          <div className="form-group">
            <label htmlFor="set-guard">Guard Name</label>
            <input
              type="text"
              id="set-guard"
              className="form-input"
              placeholder="e.g. Officer Smith"
              value={guardName}
              onChange={(e) => setGuardName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="set-script">Apps Script Web App URL (Optional failover)</label>
            <input
              type="url"
              id="set-script"
              className="form-input"
              placeholder="https://script.google.com/macros/s/..."
              value={appsScriptUrl}
              onChange={(e) => setAppsScriptUrl(e.target.value)}
            />
          </div>

          <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Diagnostics</label>
            <button type="button" onClick={handleResetQueue} className="btn-secondary" style={{ padding: "8px", fontSize: "13px", color: "var(--pending)" }}>
              Reset Synced Logs to Pending
            </button>
            <button type="button" onClick={handleClearHistory} className="btn-secondary" style={{ padding: "8px", fontSize: "13px", color: "var(--failed)" }}>
              Clear Synced Device Cache
            </button>
          </div>

          <div className="modal-actions" style={{ marginTop: "14px" }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>Close</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving..." : "Save Config"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
