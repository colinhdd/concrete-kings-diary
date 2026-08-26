import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "CK_Gate_PWA_DB";
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
  guardName: "",
  appsScriptUrl: "",
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

export async function pullRemoteData() {
  if (!isClient) return false;
  if (!navigator.onLine) return false;
  const db = await initDB();
  if (!db) return false;

  try {
    const res = await fetch("/api/gate-log");
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const tx = db.transaction("entries", "readwrite");
        const store = tx.objectStore("entries");
        
        const categories = ["staff", "pump", "mixer", "delivery", "visitor"];
        for (const cat of categories) {
          const items = json.data[cat];
          if (Array.isArray(items)) {
            for (const item of items) {
              const local = await store.get(item.id);
              if (!local || local.status !== "pending") {
                await store.put({
                  ...item,
                  category: cat,
                  status: "synced"
                });
              }
            }
          }
        }
        await tx.done;
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error("Failed to pull remote gate data:", err);
    return false;
  }
}
