import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "CK_Fuel_PWA_DB";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

export function initDB() {
  if (typeof window === "undefined") {
    return null;
  }
  
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("entries")) {
          const store = db.createObjectStore("entries", { keyPath: "id" });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
        
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains("tankRefills")) {
          const store = db.createObjectStore("tankRefills", { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

const isClient = typeof window !== "undefined";

// === ENTRIES LOGIC ===

export async function saveEntry(entry: any) {
  if (!isClient) return null;
  const db = await initDB();
  if (!db) return null;
  
  const item = {
    ...entry,
    timestamp: entry.timestamp || Date.now(),
    status: entry.status || "pending",
    errorMessage: entry.errorMessage || "",
  };
  await db.put("entries", item);
  return item;
}

export async function getEntries() {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];
  
  const tx = db.transaction("entries", "readonly");
  const store = tx.objectStore("entries");
  const entries = await store.getAll();
  return entries.sort((a: any, b: any) => b.timestamp - a.timestamp);
}

export async function getPendingEntries() {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];
  
  const index = db.transaction("entries").objectStore("entries").index("status");
  return index.getAll("pending");
}

export async function getFailedEntries() {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];
  
  const index = db.transaction("entries").objectStore("entries").index("status");
  return index.getAll("failed");
}

export async function updateEntryStatus(id: string, status: string, errorMessage = "") {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  
  const tx = db.transaction("entries", "readwrite");
  const store = tx.objectStore("entries");
  const entry = await store.get(id);
  if (entry) {
    entry.status = status;
    entry.errorMessage = errorMessage;
    await store.put(entry);
  }
  await tx.done;
}

export async function deleteEntry(id: string) {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  await db.delete("entries", id);
}

export async function clearAllSyncedEntries() {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  
  const tx = db.transaction("entries", "readwrite");
  const store = tx.objectStore("entries");
  const entries = await store.getAll();
  for (const entry of entries) {
    if (entry.status === "synced") {
      await store.delete(entry.id);
    }
  }
  await tx.done;
}

// === SETTINGS LOGIC ===

const DEFAULT_SETTINGS = {
  attendantName: "",
  scriptUrl: "",
  vehicleCsvUrl: "",
  maxVolumeMixer: "300",
  maxVolumeCompany: "80",
};

export async function getSetting(key: string) {
  if (!isClient) return DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] || "";
  const db = await initDB();
  if (!db) return DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] || "";
  
  const item = await db.get("settings", key);
  return item ? item.value : DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] || "";
}

export async function saveSetting(key: string, value: string) {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  await db.put("settings", { key, value });
}

export async function getAllSettings() {
  if (!isClient) return DEFAULT_SETTINGS;
  const db = await initDB();
  if (!db) return DEFAULT_SETTINGS;
  
  const allSettings = await db.getAll("settings");
  const settingsMap = { ...DEFAULT_SETTINGS };
  for (const item of allSettings) {
    settingsMap[item.key as keyof typeof DEFAULT_SETTINGS] = item.value;
  }
  return settingsMap;
}

export async function saveAllSettings(settingsObj: any) {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  
  const tx = db.transaction("settings", "readwrite");
  const store = tx.objectStore("settings");
  for (const [key, value] of Object.entries(settingsObj)) {
    await store.put({ key, value });
  }
  await tx.done;
}

export async function resetSyncedToPending() {
  if (!isClient) return 0;
  const db = await initDB();
  if (!db) return 0;
  
  const tx = db.transaction("entries", "readwrite");
  const store = tx.objectStore("entries");
  const entries = await store.getAll();
  let count = 0;
  for (const entry of entries) {
    if (entry.status === "synced" || entry.status === "failed") {
      entry.status = "pending";
      entry.errorMessage = "";
      await store.put(entry);
      count++;
    }
  }
  await tx.done;
  return count;
}

// === TANK REFILLS LOGIC ===

export async function saveTankRefill(refill: any) {
  if (!isClient) return null;
  const db = await initDB();
  if (!db) return null;
  
  const item = {
    ...refill,
    timestamp: refill.timestamp || Date.now(),
    status: refill.status || "pending",
  };
  await db.put("tankRefills", item);
  return item;
}

export async function getTankRefills() {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];
  
  const tx = db.transaction("tankRefills", "readonly");
  const store = tx.objectStore("tankRefills");
  const refills = await store.getAll();
  return refills.sort((a: any, b: any) => b.timestamp - a.timestamp);
}

export async function getPendingTankRefills() {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];
  
  const refills = await db.getAll("tankRefills");
  return refills.filter((r: any) => r.status === "pending");
}

export async function updateTankRefillStatus(id: string, status: string) {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  
  const tx = db.transaction("tankRefills", "readwrite");
  const store = tx.objectStore("tankRefills");
  const refill = await store.get(id);
  if (refill) {
    refill.status = status;
    await store.put(refill);
  }
  await tx.done;
}

export async function deleteTankRefill(id: string) {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  await db.delete("tankRefills", id);
}

export async function pullRemoteData() {
  if (!isClient) return false;
  if (!navigator.onLine) return false;
  const db = await initDB();
  if (!db) return false;

  try {
    // 1. Pull fuel logs from Google Sheets via backend API
    const logsRes = await fetch("/api/fuel-log");
    if (logsRes.ok) {
      const logsData = await logsRes.json();
      if (logsData.success && Array.isArray(logsData.logs)) {
        const tx = db.transaction("entries", "readwrite");
        const store = tx.objectStore("entries");
        for (const log of logsData.logs) {
          const local = await store.get(log.id);
          if (!local || local.status !== "pending") {
            await store.put({
              ...log,
              status: "synced"
            });
          }
        }
        await tx.done;
      }
    }

    // 2. Pull refills/resets from Google Sheets via backend API
    const refillsRes = await fetch("/api/tank-refill");
    if (refillsRes.ok) {
      const refillsData = await refillsRes.json();
      if (refillsData.success && Array.isArray(refillsData.refills)) {
        const tx = db.transaction("tankRefills", "readwrite");
        const store = tx.objectStore("tankRefills");
        for (const refill of refillsData.refills) {
          const local = await store.get(refill.id);
          if (!local || local.status !== "pending") {
            await store.put({
              ...refill,
              status: "synced"
            });
          }
        }
        await tx.done;
      }
    }
    return true;
  } catch (err) {
    console.error("Failed to pull remote data:", err);
    return false;
  }
}

export async function calculateRemainingFuel() {
  if (!isClient) return 0;
  const refills = await getTankRefills();
  const entries = await getEntries();
  
  // Find the latest reset refill, if any.
  // getTankRefills() returns refills sorted descending by timestamp.
  const latestReset = refills.find((r: any) => r.notes && r.notes.startsWith("ADMIN RESET"));
  
  if (latestReset) {
    const resetTime = latestReset.timestamp;
    const resetVolume = parseFloat(latestReset.volume || 0);
    
    const refilledAfter = refills
      .filter((r: any) => r.timestamp > resetTime && r.id !== latestReset.id)
      .reduce((sum: number, r: any) => sum + parseFloat(r.volume || 0), 0);
      
    const dispensedAfter = entries
      .filter((e: any) => e.timestamp > resetTime && (!e.fuelSource || e.fuelSource === "Local Tank"))
      .reduce((sum: number, e: any) => sum + parseFloat(e.volume || 0), 0);
      
    return resetVolume + refilledAfter - dispensedAfter;
  } else {
    const totalRefilled = refills.reduce((sum: number, r: any) => sum + parseFloat(r.volume || 0), 0);
    const totalDispensed = entries.reduce((sum: number, e: any) => {
      if (!e.fuelSource || e.fuelSource === "Local Tank") {
        return sum + parseFloat(e.volume || 0);
      }
      return sum;
    }, 0);
    
    return totalRefilled - totalDispensed;
  }
}
