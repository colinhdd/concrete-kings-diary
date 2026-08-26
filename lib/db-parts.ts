import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "CK_Parts_PWA_DB";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

export function initDB() {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Parts catalogue
        if (!db.objectStoreNames.contains("parts")) {
          const store = db.createObjectStore("parts", { keyPath: "id" });
          store.createIndex("category", "category", { unique: false });
          store.createIndex("name", "name", { unique: false });
        }

        // Usage & restock events
        if (!db.objectStoreNames.contains("stockEvents")) {
          const store = db.createObjectStore("stockEvents", { keyPath: "id" });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("partId", "partId", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }

        // Oil levels (running totals)
        if (!db.objectStoreNames.contains("oilLevels")) {
          db.createObjectStore("oilLevels", { keyPath: "id" });
        }

        // Settings
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

const isClient = typeof window !== "undefined";

// ── PARTS ────────────────────────────────────────────────────────────────────

export async function savePart(part: any) {
  if (!isClient) return null;
  const db = await initDB();
  if (!db) return null;
  const item = { ...part, createdAt: part.createdAt || Date.now() };
  await db.put("parts", item);
  return item;
}

export async function getAllParts(): Promise<any[]> {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];
  const parts = await db.getAll("parts");
  return parts.sort((a: any, b: any) => a.name.localeCompare(b.name));
}

export async function getPartById(id: string) {
  if (!isClient) return null;
  const db = await initDB();
  if (!db) return null;
  return db.get("parts", id);
}

export async function updatePart(id: string, updates: any) {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  const tx = db.transaction("parts", "readwrite");
  const store = tx.objectStore("parts");
  const existing = await store.get(id);
  if (existing) await store.put({ ...existing, ...updates });
  await tx.done;
}

export async function deletePart(id: string) {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  await db.delete("parts", id);
}

// ── STOCK EVENTS ─────────────────────────────────────────────────────────────

export async function saveStockEvent(event: any) {
  if (!isClient) return null;
  const db = await initDB();
  if (!db) return null;
  const item = {
    ...event,
    timestamp: event.timestamp || Date.now(),
    status: event.status || "pending",
  };
  await db.put("stockEvents", item);
  return item;
}

export async function getAllStockEvents(): Promise<any[]> {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];
  const events = await db.getAll("stockEvents");
  return events.sort((a: any, b: any) => b.timestamp - a.timestamp);
}

export async function getPendingStockEvents(): Promise<any[]> {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];
  const index = db.transaction("stockEvents").objectStore("stockEvents").index("status");
  return index.getAll("pending");
}

export async function updateStockEventStatus(id: string, status: string, errorMessage = "") {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  const tx = db.transaction("stockEvents", "readwrite");
  const store = tx.objectStore("stockEvents");
  const event = await store.get(id);
  if (event) {
    event.status = status;
    event.errorMessage = errorMessage;
    await store.put(event);
  }
  await tx.done;
}

export async function deleteStockEvent(id: string) {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  await db.delete("stockEvents", id);
}

// ── OIL LEVELS ───────────────────────────────────────────────────────────────

export async function saveOilLevel(oil: any) {
  if (!isClient) return null;
  const db = await initDB();
  if (!db) return null;
  const item = { ...oil, updatedAt: Date.now() };
  await db.put("oilLevels", item);
  return item;
}

export async function getAllOilLevels(): Promise<any[]> {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];
  return db.getAll("oilLevels");
}

export async function updateOilLevel(id: string, updates: any) {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  const tx = db.transaction("oilLevels", "readwrite");
  const store = tx.objectStore("oilLevels");
  const existing = await store.get(id);
  if (existing) {
    await store.put({ ...existing, ...updates, updatedAt: Date.now() });
  }
  await tx.done;
}

export async function deleteOilLevel(id: string) {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  await db.delete("oilLevels", id);
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string> {
  if (!isClient) return "";
  const db = await initDB();
  if (!db) return "";
  const item = await db.get("settings", key);
  return item ? item.value : "";
}

export async function saveSetting(key: string, value: string) {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  await db.put("settings", { key, value });
}

export async function pullRemoteData() {
  if (!isClient) return false;
  if (!navigator.onLine) return false;
  const db = await initDB();
  if (!db) return false;

  try {
    const res = await fetch("/api/parts-log");
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.events)) {
        const tx = db.transaction("stockEvents", "readwrite");
        const store = tx.objectStore("stockEvents");
        for (const ev of data.events) {
          const local = await store.get(ev.id);
          if (!local || local.status !== "pending") {
            await store.put({
              ...ev,
              status: "synced"
            });
          }
        }
        await tx.done;
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error("Failed to pull remote parts logs:", err);
    return false;
  }
}
