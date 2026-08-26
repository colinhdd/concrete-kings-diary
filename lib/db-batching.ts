import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "CK_Batching_Diary_DB";
const DB_VERSION = 1;

export interface MixDesign {
  id: string;
  code: string;
  description: string;
  strength: string; // e.g. "3000 PSI", "3500 PSI", "4000 PSI"
  placementType: string; // e.g. "Pump", "Tremie", "Direct Chute", "Flatwork"
  cement: number; // kg/yd³ or lbs/yd³
  sand: number; // kg/yd³ or lbs/yd³
  threeQuarterStone: number; // ¾ Stone (kg/yd³)
  threeEighthStone: number; // ⅜ Stone (kg/yd³)
  designWater: number; // L/yd³ (or gal/yd³)
  plasticizer: number; // oz or mL per yd³
  retarder: number; // oz or mL per yd³
  otherAdmixture?: string;
  version: number;
  active: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Truck {
  id: string;
  code: string; // e.g. "CT3628"
  driver?: string;
  capacityYards: number; // e.g. 10 or 11
  active: boolean;
  plate?: string;
  notes?: string;
}

export interface MoistureReading {
  id: string;
  percentage: number; // e.g. 5.5
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM
  timestamp: number;
  batcherId: string;
  batcherName: string;
  material: string; // default "Sand"
  notes?: string;
  isCurrent: boolean;
}

export interface BatchingDay {
  id: string;
  date: string; // YYYY-MM-DD
  batcherId: string;
  batcherName: string;
  plantId: string;
  plantName: string;
  startTime: string;
  endTime?: string;
  status: "open" | "closed";
  totalLoads: number;
  totalVolume: number;
  createdAt: number;
  closedAt?: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  locationVerified?: boolean;
}

export interface ObservationOption {
  id: string;
  label: string;
  isNormal: boolean;
  category?: string;
  sortOrder: number;
  active: boolean;
}

export interface AdjustmentOption {
  id: string;
  label: string;
  category: "water" | "sand" | "stone" | "cement" | "plasticizer" | "retarder" | "moisture" | "blend" | "other" | "none";
  defaultUnit: string; // "L", "kg", "mL", "%", etc.
  sortOrder: number;
  active: boolean;
}

export interface SelectedAdjustment {
  optionId: string;
  label: string;
  value?: number | string;
  unit?: string;
}

export interface LoadSnapshot {
  mixCode: string;
  mixDescription: string;
  mixVersion: number;
  strength: string;
  placementType: string;
  cementDesign: number;
  sandDesign: number;
  threeQuarterStoneDesign: number;
  threeEighthStoneDesign: number;
  waterDesign: number;
  plasticizerDesign: number;
  retarderDesign: number;
  otherAdmixtureDesign?: string;
}

export interface AuditRecord {
  id: string;
  loadId: string;
  action: "created" | "updated" | "voided";
  userId: string;
  userName: string;
  timestamp: number;
  changesSummary?: string;
  previousValues?: Partial<LoadRecord>;
  newValues?: Partial<LoadRecord>;
}

export interface LoadRecord {
  id: string; // UUID generated locally
  batchNumber?: string; // YEAR-MM-DD-JJ-LL (e.g. 2026-08-21-01-01)
  batchingDayId: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "06:41 AM"
  timestamp: number;
  batcherId: string;
  batcherName: string;
  plantId: string;
  plantName: string;
  truckId: string;
  truckCode: string;
  mixDesignId: string;
  mixCode: string;
  mixDesignVersion: number;
  quantity: number; // yards (e.g. 10.0)
  sandMoisturePercent: number; // active moisture at batch time (e.g. 3.0)
  sandAbsorptionPercent: number; // e.g. 0.5%
  stoneMoisturePercent?: number; // active stone moisture (e.g. 1.0)
  stoneAbsorptionPercent?: number; // e.g. 0.5%
  designWater: number; // total design water for this quantity
  expectedBatchWater: number; // calculated moisture-adjusted water
  actualBatchWater: number; // entered by batcher (L)
  waterAdjustment: number; // actualBatchWater - expectedBatchWater (+/-)
  actualCement?: number; // actual batched cement (kg)
  actualSand?: number; // actual batched sand (kg)
  actualThreeQuarterStone?: number; // actual batched 3/4 stone (kg)
  actualThreeEighthStone?: number; // actual batched 3/8 stone (kg)
  actualPlasticizer?: number; // actual batched plasticizer (fl oz)
  actualRetarder?: number; // actual batched retarder (fl oz)
  concreteObservations: string[]; // array of observation labels
  observedSlumpInches?: number; // Assumed or observed slump (e.g. 4.5 in)
  batchAdjustments: SelectedAdjustment[];
  batcherNotes: string;
  actionTaken?: string; // What was done (e.g. "Fixed at plant, some was run out")
  actionsTaken?: string[]; // Array of resolution action tags
  isReviewed?: boolean;
  reviewedAt?: number;
  reviewedBy?: string;
  snapshot: LoadSnapshot; // immutable recipe snapshot
  createdAt: number;
  updatedAt: number;
  createdOffline: boolean;
  syncStatus: "Saved Offline" | "Syncing" | "Synced" | "Sync Error";
  errorMessage?: string;
  supabaseSyncedAt?: number;
  googleSheetExportedAt?: number;
  isVoid?: boolean;
  voidReason?: string;
  createdBy: string;
  lastEditedBy?: string;
  lastEditedAt?: number;
}

export interface DiarySettings {
  activeBatcherName: string;
  activeBatcherId: string;
  activePlantName: string;
  activePlantId: string;
  sandAbsorptionPercent: number; // default 0.5%
  waterLimitMinL: number; // e.g. 50
  waterLimitMaxL: number; // e.g. 2500
  qtyLimitMaxYd: number; // e.g. 14
  moistureLimitMaxPercent: number; // e.g. 12
  supabaseUrl: string;
  supabaseAnonKey: string;
  googleSheetId: string;
  autoSyncIntervalSec: number; // default 30
}

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

export function initDB() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("loads")) {
          const loadStore = db.createObjectStore("loads", { keyPath: "id" });
          loadStore.createIndex("timestamp", "timestamp", { unique: false });
          loadStore.createIndex("syncStatus", "syncStatus", { unique: false });
          loadStore.createIndex("batchingDayId", "batchingDayId", { unique: false });
          loadStore.createIndex("date", "date", { unique: false });
          loadStore.createIndex("truckCode", "truckCode", { unique: false });
          loadStore.createIndex("mixCode", "mixCode", { unique: false });
        }

        if (!db.objectStoreNames.contains("batching_days")) {
          const dayStore = db.createObjectStore("batching_days", { keyPath: "id" });
          dayStore.createIndex("date", "date", { unique: false });
          dayStore.createIndex("status", "status", { unique: false });
        }

        if (!db.objectStoreNames.contains("moisture_readings")) {
          const moistStore = db.createObjectStore("moisture_readings", { keyPath: "id" });
          moistStore.createIndex("timestamp", "timestamp", { unique: false });
          moistStore.createIndex("isCurrent", "isCurrent", { unique: false });
        }

        if (!db.objectStoreNames.contains("mix_designs")) {
          const mixStore = db.createObjectStore("mix_designs", { keyPath: "id" });
          mixStore.createIndex("code", "code", { unique: true });
          mixStore.createIndex("active", "active", { unique: false });
        }

        if (!db.objectStoreNames.contains("trucks")) {
          const truckStore = db.createObjectStore("trucks", { keyPath: "id" });
          truckStore.createIndex("code", "code", { unique: true });
          truckStore.createIndex("active", "active", { unique: false });
        }

        if (!db.objectStoreNames.contains("observation_options")) {
          db.createObjectStore("observation_options", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("adjustment_options")) {
          db.createObjectStore("adjustment_options", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains("audit_trail")) {
          const auditStore = db.createObjectStore("audit_trail", { keyPath: "id" });
          auditStore.createIndex("loadId", "loadId", { unique: false });
          auditStore.createIndex("timestamp", "timestamp", { unique: false });
        }

        if (!db.objectStoreNames.contains("sync_logs")) {
          const syncLogStore = db.createObjectStore("sync_logs", { keyPath: "id" });
          syncLogStore.createIndex("timestamp", "timestamp", { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

const isClient = typeof window !== "undefined";

// Generate clean random UUID
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// === DEFAULT SEED DATA ===

export const DEFAULT_MIX_DESIGNS: MixDesign[] = [
  // --- CHUTE MIXES ---
  {
    id: "mix_c3000",
    code: "C-3000",
    description: "CHUTE 3000 PSI",
    strength: "3000 PSI",
    placementType: "Direct Chute",
    cement: 235,
    sand: 805,
    threeQuarterStone: 705,
    threeEighthStone: 0,
    designWater: 113,
    plasticizer: 470,
    retarder: 353,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_c3500",
    code: "C-3500",
    description: "CHUTE 3500 PSI",
    strength: "3500 PSI",
    placementType: "Direct Chute",
    cement: 240,
    sand: 805,
    threeQuarterStone: 705,
    threeEighthStone: 0,
    designWater: 113,
    plasticizer: 480,
    retarder: 360,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_c3750",
    code: "C-3750",
    description: "CHUTE 3750 PSI",
    strength: "3750 PSI",
    placementType: "Direct Chute",
    cement: 255,
    sand: 805,
    threeQuarterStone: 705,
    threeEighthStone: 0,
    designWater: 113,
    plasticizer: 510,
    retarder: 383,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_c4000",
    code: "C-4000",
    description: "CHUTE 4000 PSI",
    strength: "4000 PSI",
    placementType: "Direct Chute",
    cement: 285,
    sand: 805,
    threeQuarterStone: 705,
    threeEighthStone: 0,
    designWater: 113,
    plasticizer: 570,
    retarder: 428,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_c4500",
    code: "C-4500",
    description: "CHUTE 4500 PSI",
    strength: "4500 PSI",
    placementType: "Direct Chute",
    cement: 290,
    sand: 805,
    threeQuarterStone: 705,
    threeEighthStone: 0,
    designWater: 113,
    plasticizer: 580,
    retarder: 435,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_c3750_mx5050",
    code: "C-3750-MX-50-50",
    description: "CHUTE 3750 MIX (50/50 Stone Blend)",
    strength: "3750 PSI",
    placementType: "Direct Chute",
    cement: 260,
    sand: 805,
    threeQuarterStone: 355,
    threeEighthStone: 350,
    designWater: 113,
    plasticizer: 520,
    retarder: 390,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // --- PUMP MIXES ---
  {
    id: "mix_p3000",
    code: "P-3000",
    description: "PUMP 3000 PSI",
    strength: "3000 PSI",
    placementType: "Pump",
    cement: 240,
    sand: 875,
    threeQuarterStone: 625,
    threeEighthStone: 0,
    designWater: 121,
    plasticizer: 480,
    retarder: 360,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_p3500",
    code: "P-3500",
    description: "PUMP 3500 PSI",
    strength: "3500 PSI",
    placementType: "Pump",
    cement: 245,
    sand: 835,
    threeQuarterStone: 655,
    threeEighthStone: 0,
    designWater: 121,
    plasticizer: 490,
    retarder: 368,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_p3750",
    code: "P-3750",
    description: "PUMP 3750 PSI",
    strength: "3750 PSI",
    placementType: "Pump",
    cement: 260,
    sand: 815,
    threeQuarterStone: 670,
    threeEighthStone: 0,
    designWater: 121,
    plasticizer: 520,
    retarder: 390,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_p4000",
    code: "P-4000",
    description: "PUMP 4000 PSI",
    strength: "4000 PSI",
    placementType: "Pump",
    cement: 290,
    sand: 795,
    threeQuarterStone: 685,
    threeEighthStone: 0,
    designWater: 124,
    plasticizer: 580,
    retarder: 435,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_p4500",
    code: "P-4500",
    description: "PUMP 4500 PSI",
    strength: "4500 PSI",
    placementType: "Pump",
    cement: 295,
    sand: 750,
    threeQuarterStone: 725,
    threeEighthStone: 0,
    designWater: 124,
    plasticizer: 811,
    retarder: 443,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_p5000",
    code: "P-5000",
    description: "PUMP 5000 PSI (Commercial Heavy Duty)",
    strength: "5000 PSI",
    placementType: "Pump",
    cement: 325,
    sand: 700,
    threeQuarterStone: 750,
    threeEighthStone: 0,
    designWater: 128,
    plasticizer: 975,
    retarder: 650,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // --- BLENDED PUMP MIXES ---
  {
    id: "mix_p3000_mx5050",
    code: "P-3000-MX-50-50",
    description: "PUMP 3000 MIX (50/50 Stone Blend)",
    strength: "3000 PSI",
    placementType: "Pump",
    cement: 240,
    sand: 875,
    threeQuarterStone: 315,
    threeEighthStone: 310,
    designWater: 121,
    plasticizer: 480,
    retarder: 360,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_p3500_mx5050",
    code: "P-3500-MX-50-50",
    description: "PUMP 3500 MIX (50/50 Stone Blend)",
    strength: "3500 PSI",
    placementType: "Pump",
    cement: 245,
    sand: 835,
    threeQuarterStone: 320,
    threeEighthStone: 335,
    designWater: 121,
    plasticizer: 490,
    retarder: 368,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_p3750_mx5050",
    code: "P-3750-MX-50-50",
    description: "PUMP 3750 MIX (50/50 Stone Blend)",
    strength: "3750 PSI",
    placementType: "Pump",
    cement: 260,
    sand: 798,
    threeQuarterStone: 300,
    threeEighthStone: 300,
    designWater: 121,
    plasticizer: 520,
    retarder: 390,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_p4000_mx5050",
    code: "P-4000-MX-50-50",
    description: "PUMP 4000 MIX (50/50 Stone Blend)",
    strength: "4000 PSI",
    placementType: "Pump",
    cement: 290,
    sand: 815,
    threeQuarterStone: 335,
    threeEighthStone: 335,
    designWater: 124,
    plasticizer: 725,
    retarder: 435,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // --- SPECIALTY & WALL MIXES ---
  {
    id: "mix_s3000",
    code: "S-3000",
    description: "SLAB 3000 PSI (Steel Finish)",
    strength: "3000 PSI",
    placementType: "Flatwork",
    cement: 240,
    sand: 875,
    threeQuarterStone: 500,
    threeEighthStone: 125,
    designWater: 121,
    plasticizer: 480,
    retarder: 360,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_w30000",
    code: "W-30000",
    description: "WALL MIX 3000 PSI",
    strength: "3000 PSI",
    placementType: "Pump",
    cement: 245,
    sand: 875,
    threeQuarterStone: 0,
    threeEighthStone: 650,
    designWater: 124,
    plasticizer: 613,
    retarder: 368,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_w30000_mx7525",
    code: "W-30000-MX-75-25",
    description: "WALL MIX 3000 (75/25 Blend)",
    strength: "3000 PSI",
    placementType: "Pump",
    cement: 245,
    sand: 875,
    threeQuarterStone: 170,
    threeEighthStone: 480,
    designWater: 124,
    plasticizer: 613,
    retarder: 368,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // --- CLIENT CUSTOM MIXES ---
  {
    id: "mix_p3000_icc",
    code: "P-3000-ICC",
    description: "ICC 3000 PSI Pump",
    strength: "3000 PSI",
    placementType: "Pump",
    cement: 236,
    sand: 864,
    threeQuarterStone: 723,
    threeEighthStone: 0,
    designWater: 121,
    plasticizer: 500,
    retarder: 475,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_p5000_icc",
    code: "P-5000-ICC",
    description: "ICC 5000 PSI High Strength",
    strength: "5000 PSI",
    placementType: "Pump",
    cement: 304,
    sand: 723,
    threeQuarterStone: 785,
    threeEighthStone: 0,
    designWater: 129,
    plasticizer: 650,
    retarder: 590,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_w3000_icc",
    code: "W-3000-ICC",
    description: "ICC WALL MIX 3000 PSI",
    strength: "3000 PSI",
    placementType: "Pump",
    cement: 236,
    sand: 835,
    threeQuarterStone: 0,
    threeEighthStone: 739,
    designWater: 121,
    plasticizer: 500,
    retarder: 475,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mix_p3000_campbell",
    code: "P-3000-CAMPBELL",
    description: "CAMPBELL 3000 PSI Pump",
    strength: "3000 PSI",
    placementType: "Pump",
    cement: 236,
    sand: 830,
    threeQuarterStone: 740,
    threeEighthStone: 0,
    designWater: 121,
    plasticizer: 1170,
    retarder: 0,
    version: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const DEFAULT_TRUCKS: Truck[] = [
  { id: "truck_cm01", code: "CT3628", driver: "Wilton Roberts", capacityYards: 10, active: true },
  { id: "truck_cm02", code: "CT3630", driver: "Conrad Francis", capacityYards: 10, active: true },
  { id: "truck_cm04", code: "CT3624", driver: "Keneil Webber", capacityYards: 10, active: true },
  { id: "truck_cm05", code: "CT3637", driver: "Wayne Lafayette", capacityYards: 10, active: true },
  { id: "truck_cm11", code: "CU2573", driver: "Odealie Wright", capacityYards: 10, active: true },
  { id: "truck_cm12", code: "CU2574", driver: "Joseph Brown", capacityYards: 10, active: true },
  { id: "truck_cm13", code: "CU2575", driver: "Barrington McNeil", capacityYards: 10, active: true },
  { id: "truck_cm15", code: "CU7288", driver: "Barrington McNeil", capacityYards: 10, active: true },
  { id: "truck_cm16", code: "CU8894", driver: "Recardo Bailey", capacityYards: 10, active: true },
  { id: "truck_ct6723", code: "CT6723", driver: "Matthew Baker", capacityYards: 10, active: true },
];

export const DEFAULT_OBSERVATIONS: ObservationOption[] = [
  { id: "obs_normal", label: "Perfect", isNormal: true, sortOrder: 1, active: true },
  { id: "obs_too_dry", label: "Too Dry", isNormal: false, sortOrder: 2, active: true },
  { id: "obs_too_wet", label: "Too Wet", isNormal: false, sortOrder: 3, active: true },
  { id: "obs_too_bony", label: "Too Bony / Too Much Stone", isNormal: false, sortOrder: 4, active: true },
  { id: "obs_too_sandy", label: "Too Sandy / Too Much Sand", isNormal: false, sortOrder: 5, active: true },
  { id: "obs_low_paste", label: "Low Paste / Appears Low in Cement", isNormal: false, sortOrder: 6, active: true },
  { id: "obs_harsh", label: "Harsh", isNormal: false, sortOrder: 7, active: true },
  { id: "obs_stiff", label: "Stiff", isNormal: false, sortOrder: 8, active: true },
  { id: "obs_creamy", label: "Creamy / Paste Rich", isNormal: false, sortOrder: 9, active: true },
  { id: "obs_poor_cohesion", label: "Poor Cohesion", isNormal: false, sortOrder: 10, active: true },
  { id: "obs_segregating", label: "Segregating", isNormal: false, sortOrder: 11, active: true },
  { id: "obs_spilling", label: "Concrete Spilling From Truck", isNormal: false, sortOrder: 12, active: true },
  { id: "obs_other", label: "Other", isNormal: false, sortOrder: 13, active: true },
];

export const DEFAULT_ADJUSTMENTS: AdjustmentOption[] = [
  { id: "adj_none", label: "No Additional Adjustment", category: "none", defaultUnit: "", sortOrder: 1, active: true },
  { id: "adj_water_inc", label: "Water Increased", category: "water", defaultUnit: "L", sortOrder: 2, active: true },
  { id: "adj_water_red", label: "Water Reduced", category: "water", defaultUnit: "L", sortOrder: 3, active: true },
  { id: "adj_sand_inc", label: "Sand Increased", category: "sand", defaultUnit: "kg", sortOrder: 4, active: true },
  { id: "adj_sand_red", label: "Sand Reduced", category: "sand", defaultUnit: "kg", sortOrder: 5, active: true },
  { id: "adj_stone_inc", label: "Stone Increased", category: "stone", defaultUnit: "kg", sortOrder: 6, active: true },
  { id: "adj_stone_red", label: "Stone Reduced", category: "stone", defaultUnit: "kg", sortOrder: 7, active: true },
  { id: "adj_cement_inc", label: "Cement Increased", category: "cement", defaultUnit: "kg", sortOrder: 8, active: true },
  { id: "adj_cement_red", label: "Cement Reduced", category: "cement", defaultUnit: "kg", sortOrder: 9, active: true },
  { id: "adj_plast_inc", label: "Plasticizer Increased", category: "plasticizer", defaultUnit: "fl oz", sortOrder: 10, active: true },
  { id: "adj_plast_red", label: "Plasticizer Reduced", category: "plasticizer", defaultUnit: "fl oz", sortOrder: 11, active: true },
  { id: "adj_retard_inc", label: "Retarder Increased", category: "retarder", defaultUnit: "fl oz", sortOrder: 12, active: true },
  { id: "adj_retard_red", label: "Retarder Reduced", category: "retarder", defaultUnit: "fl oz", sortOrder: 13, active: true },
  { id: "adj_moist_chg", label: "Moisture Setting Changed", category: "moisture", defaultUnit: "%", sortOrder: 14, active: true },
  { id: "adj_blend_chg", label: "Aggregate Blend Changed", category: "blend", defaultUnit: "%", sortOrder: 15, active: true },
  { id: "adj_other", label: "Other", category: "other", defaultUnit: "", sortOrder: 16, active: true },
];

export const DEFAULT_SETTINGS: DiarySettings = {
  activeBatcherName: "Lead Batcher",
  activeBatcherId: "batcher_01",
  activePlantName: "Concrete Kings Main Plant",
  activePlantId: "plant_yard_1",
  sandAbsorptionPercent: 0.5,
  waterLimitMinL: 40,
  waterLimitMaxL: 2500,
  qtyLimitMaxYd: 14,
  moistureLimitMaxPercent: 12,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  googleSheetId: process.env.REGISTRY_SPREADSHEET_ID || "",
  autoSyncIntervalSec: 30,
};

// Seed database on first launch
export async function seedInitialData() {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;

  // Seed Mix Designs
  const mixCount = await db.count("mix_designs");
  if (mixCount === 0) {
    const tx = db.transaction("mix_designs", "readwrite");
    for (const mix of DEFAULT_MIX_DESIGNS) {
      await tx.store.put(mix);
    }
    await tx.done;
  }

  // Seed Trucks
  const truckCount = await db.count("trucks");
  if (truckCount === 0) {
    const tx = db.transaction("trucks", "readwrite");
    for (const truck of DEFAULT_TRUCKS) {
      await tx.store.put(truck);
    }
    await tx.done;
  }

  // Seed Observations
  const obsCount = await db.count("observation_options");
  if (obsCount === 0) {
    const tx = db.transaction("observation_options", "readwrite");
    for (const obs of DEFAULT_OBSERVATIONS) {
      await tx.store.put(obs);
    }
    await tx.done;
  }

  // Seed Adjustments
  const adjCount = await db.count("adjustment_options");
  if (adjCount === 0) {
    const tx = db.transaction("adjustment_options", "readwrite");
    for (const adj of DEFAULT_ADJUSTMENTS) {
      await tx.store.put(adj);
    }
    await tx.done;
  }

  // Seed Initial Moisture if none
  const moistCount = await db.count("moisture_readings");
  if (moistCount === 0) {
    const now = new Date();
    // Seed Sand Moisture (3.0% default)
    await db.put("moisture_readings", {
      id: generateUUID(),
      percentage: 3.0,
      date: now.toISOString().split("T")[0],
      time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      timestamp: now.getTime(),
      batcherId: "batcher_01",
      batcherName: "Lead Batcher",
      material: "Sand",
      notes: "Plant baseline sand moisture test",
      isCurrent: true,
    });

    // Seed Stone Moisture (1.0% default)
    await db.put("moisture_readings", {
      id: generateUUID(),
      percentage: 1.0,
      date: now.toISOString().split("T")[0],
      time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      timestamp: now.getTime() + 1,
      batcherId: "batcher_01",
      batcherName: "Lead Batcher",
      material: "Stone",
      notes: "Plant baseline stone moisture test",
      isCurrent: true,
    });
  }

  // Seed settings
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await db.get("settings", key);
    if (!existing) {
      await db.put("settings", { key, value });
    }
  }
}

// === WATER CALCULATION UTILITY ===

/**
 * Formula:
 * Free Sand Moisture % = max(0, sandMoisturePercent - sandAbsorptionPercent)
 * Free Stone Moisture % = max(0, stoneMoisturePercent - stoneAbsorptionPercent)
 * Moisture Free Water Contribution (L) = (Total Sand * Free Sand Moisture %) + (Total Stone * Free Stone Moisture %)
 * Note: 1 kg water = 1 Liter water
 * Expected Batch Water (L) = (designWaterPerYard * quantity) - Moisture Free Water Contribution
 * Calculates target expected water based on mix design, quantity, and aggregate surface moisture
 * Uses multiples of 50, rounded down (e.g. 727 -> 700 L)
 */
export function calculateExpectedWater(
  mixDesign: MixDesign | LoadSnapshot,
  quantity: number,
  sandMoisturePercent = 3.0,
  sandAbsorptionPercent = 0.5,
  stoneMoisturePercent = 1.0,
  stoneAbsorptionPercent = 0.5
): {
  designWaterTotal: number;
  freeMoistureContributionL: number;
  expectedBatchWaterL: number;
  waterInSandL: number;
  waterInStoneL: number;
} {
  const waterDesign = "designWater" in mixDesign ? mixDesign.designWater : mixDesign.waterDesign;
  const sandDesign = "sand" in mixDesign ? mixDesign.sand : mixDesign.sandDesign;
  const stoneDesign = "threeQuarterStone" in mixDesign ? (mixDesign.threeQuarterStone + (mixDesign.threeEighthStone || 0)) : (mixDesign.threeQuarterStoneDesign + (mixDesign.threeEighthStoneDesign || 0));

  const designWaterTotal = Math.round(waterDesign * quantity);
  const freeSandMoisture = Math.max(0, sandMoisturePercent - sandAbsorptionPercent);
  const freeStoneMoisture = Math.max(0, stoneMoisturePercent - stoneAbsorptionPercent);

  const totalSandKg = sandDesign * quantity;
  const totalStoneKg = stoneDesign * quantity;

  const waterInSandL = Math.round(totalSandKg * (freeSandMoisture / 100));
  const waterInStoneL = Math.round(totalStoneKg * (freeStoneMoisture / 100));
  const freeMoistureContributionL = waterInSandL + waterInStoneL;

  // Multiples of 50 rounded down (e.g. 727 -> 700)
  const rawExpected = Math.max(0, designWaterTotal - freeMoistureContributionL);
  const expectedBatchWaterL = Math.floor(rawExpected / 50) * 50;
  return {
    designWaterTotal,
    freeMoistureContributionL,
    expectedBatchWaterL,
    waterInSandL,
    waterInStoneL,
  };
}

/**
 * Format Batch # according to YEAR-MM-DD-JJ
 * Auto-prefixes up to the day (YEAR-MM-DD-), requiring manual Job # (JJ)
 * e.g. 2026-08-21-01
 */
export function generateBatchNumber(
  dateStr?: string,
  jobCode: string | number = ""
): string {
  const now = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const jj = String(jobCode || "").trim().toUpperCase();
  return jj ? `${year}-${month}-${day}-${jj}` : `${year}-${month}-${day}-`;
}

// === MOISTURE OPERATIONS ===

export async function getCurrentMoisture(material = "Sand"): Promise<MoistureReading> {
  const defaultPct = material.toLowerCase() === "stone" ? 1.0 : 3.0;

  if (!isClient) {
    return {
      id: "mock",
      percentage: defaultPct,
      date: new Date().toISOString().split("T")[0],
      time: "07:00 AM",
      timestamp: Date.now(),
      batcherId: "batcher_01",
      batcherName: "Lead Batcher",
      material,
      isCurrent: true,
    };
  }
  const db = await initDB();
  if (!db) {
    return {
      id: "mock",
      percentage: defaultPct,
      date: new Date().toISOString().split("T")[0],
      time: "07:00 AM",
      timestamp: Date.now(),
      batcherId: "batcher_01",
      batcherName: "Lead Batcher",
      material,
      isCurrent: true,
    };
  }

  const allReadings = await db.getAll("moisture_readings");
  const matching = allReadings.filter((r) => r.material.toLowerCase() === material.toLowerCase());
  const current = matching.find((r) => r.isCurrent);
  if (current) return current;

  if (matching.length > 0) {
    matching.sort((a, b) => b.timestamp - a.timestamp);
    return matching[0];
  }

  // Fallback
  return {
    id: generateUUID(),
    percentage: defaultPct,
    date: new Date().toISOString().split("T")[0],
    time: "07:00 AM",
    timestamp: Date.now(),
    batcherId: "batcher_01",
    batcherName: "Lead Batcher",
    material,
    isCurrent: true,
  };
}

export async function saveMoistureReading(
  percentage: number,
  batcherName = "Lead Batcher",
  batcherId = "batcher_01",
  material = "Sand",
  notes = ""
): Promise<MoistureReading> {
  if (!isClient) throw new Error("Window undefined");
  const db = await initDB();
  if (!db) throw new Error("DB not ready");

  const tx = db.transaction("moisture_readings", "readwrite");
  const store = tx.objectStore("moisture_readings");

  // Mark all past readings of this material as not current
  const all = await store.getAll();
  for (const item of all) {
    if (item.material.toLowerCase() === material.toLowerCase() && item.isCurrent) {
      item.isCurrent = false;
      await store.put(item);
    }
  }

  const now = new Date();
  const reading: MoistureReading = {
    id: generateUUID(),
    percentage,
    date: now.toISOString().split("T")[0],
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    timestamp: now.getTime(),
    batcherId,
    batcherName,
    material,
    notes,
    isCurrent: true,
  };

  await store.put(reading);
  await tx.done;
  return reading;
}

export async function getMoistureHistory(): Promise<MoistureReading[]> {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];
  const all = await db.getAll("moisture_readings");
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

// === BATCHING DAY OPERATIONS ===

export async function getCurrentBatchingDay(): Promise<BatchingDay | null> {
  if (!isClient) return null;
  const db = await initDB();
  if (!db) return null;

  const todayStr = new Date().toISOString().split("T")[0];
  const allDays = await db.getAll("batching_days");
  // Find open day, or today's day
  const openDay = allDays.find((d) => d.status === "open");
  if (openDay) return openDay;

  const todayDay = allDays.find((d) => d.date === todayStr);
  return todayDay || null;
}

export async function startBatchingDay(
  batcherName = "Lead Batcher",
  batcherId = "batcher_01",
  plantName = "Concrete Kings Main Plant",
  plantId = "plant_yard_1",
  locationCoords?: { latitude?: number; longitude?: number; accuracy?: number }
): Promise<BatchingDay> {
  if (!isClient) throw new Error("Window undefined");
  const db = await initDB();
  if (!db) throw new Error("DB not ready");

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const newDay: BatchingDay = {
    id: `day_${todayStr}_${generateUUID().slice(0, 8)}`,
    date: todayStr,
    batcherId,
    batcherName,
    plantId,
    plantName,
    startTime: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    status: "open",
    totalLoads: 0,
    totalVolume: 0,
    createdAt: now.getTime(),
    latitude: locationCoords?.latitude,
    longitude: locationCoords?.longitude,
    accuracy: locationCoords?.accuracy,
    locationVerified: Boolean(locationCoords?.latitude && locationCoords?.longitude),
  };

  await db.put("batching_days", newDay);
  return newDay;
}

export async function closeBatchingDay(dayId: string): Promise<BatchingDay | null> {
  if (!isClient) return null;
  const db = await initDB();
  if (!db) return null;

  const day = await db.get("batching_days", dayId);
  if (!day) return null;

  const now = new Date();
  day.status = "closed";
  day.endTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  day.closedAt = now.getTime();

  await db.put("batching_days", day);
  return day;
}

// === LOAD OPERATIONS ===

export async function saveLoad(loadInput: {
  batchingDayId: string;
  batcherId: string;
  batcherName: string;
  plantId: string;
  plantName: string;
  truckId: string;
  truckCode: string;
  mixDesign: MixDesign;
  quantity: number;
  sandMoisturePercent: number;
  sandAbsorptionPercent?: number;
  stoneMoisturePercent?: number;
  stoneAbsorptionPercent?: number;
  actualBatchWater: number;
  actualCement?: number;
  actualSand?: number;
  actualThreeQuarterStone?: number;
  actualThreeEighthStone?: number;
  actualPlasticizer?: number;
  actualRetarder?: number;
  concreteObservations: string[];
  batchAdjustments: SelectedAdjustment[];
  batcherNotes?: string;
  batchNumber?: string;
  jobCode?: string;
  loadIndex?: number;
}): Promise<LoadRecord> {
  if (!isClient) throw new Error("Window undefined");
  const db = await initDB();
  if (!db) throw new Error("DB not ready");

  const now = new Date();
  const sandAbsorption = loadInput.sandAbsorptionPercent ?? 0.5;
  const stoneAbsorption = loadInput.stoneAbsorptionPercent ?? 0.5;

  const { designWaterTotal, expectedBatchWaterL } = calculateExpectedWater(
    loadInput.mixDesign,
    loadInput.quantity,
    loadInput.sandMoisturePercent,
    sandAbsorption,
    loadInput.stoneMoisturePercent ?? 1.0,
    stoneAbsorption
  );

  const waterAdjustment = Math.round(loadInput.actualBatchWater - expectedBatchWaterL);

  const snapshot: LoadSnapshot = {
    mixCode: loadInput.mixDesign.code,
    mixDescription: loadInput.mixDesign.description,
    mixVersion: loadInput.mixDesign.version,
    strength: loadInput.mixDesign.strength,
    placementType: loadInput.mixDesign.placementType,
    cementDesign: loadInput.mixDesign.cement,
    sandDesign: loadInput.mixDesign.sand,
    threeQuarterStoneDesign: loadInput.mixDesign.threeQuarterStone,
    threeEighthStoneDesign: loadInput.mixDesign.threeEighthStone,
    waterDesign: loadInput.mixDesign.designWater,
    plasticizerDesign: loadInput.mixDesign.plasticizer,
    retarderDesign: loadInput.mixDesign.retarder,
    otherAdmixtureDesign: loadInput.mixDesign.otherAdmixture,
  };

  const loadId = generateUUID();

  const tx = db.transaction(["loads", "batching_days", "audit_trail"], "readwrite");
  const dayStore = tx.objectStore("batching_days");
  const day = await dayStore.get(loadInput.batchingDayId);

  const currentCount = day ? (day.totalLoads || 0) + 1 : 1;
  const todayStr = now.toISOString().split("T")[0];
  const finalBatchNumber =
    loadInput.batchNumber ||
    generateBatchNumber(todayStr, loadInput.jobCode || "");

  const load: LoadRecord = {
    id: loadId,
    batchNumber: finalBatchNumber,
    batchingDayId: loadInput.batchingDayId,
    date: todayStr,
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    timestamp: now.getTime(),
    batcherId: loadInput.batcherId,
    batcherName: loadInput.batcherName,
    plantId: loadInput.plantId,
    plantName: loadInput.plantName,
    truckId: loadInput.truckId,
    truckCode: loadInput.truckCode,
    mixDesignId: loadInput.mixDesign.id,
    mixCode: loadInput.mixDesign.code,
    mixDesignVersion: loadInput.mixDesign.version,
    quantity: Number(loadInput.quantity),
    sandMoisturePercent: Number(loadInput.sandMoisturePercent),
    sandAbsorptionPercent: sandAbsorption,
    stoneMoisturePercent: loadInput.stoneMoisturePercent !== undefined ? Number(loadInput.stoneMoisturePercent) : 1.0,
    stoneAbsorptionPercent: stoneAbsorption,
    designWater: designWaterTotal,
    expectedBatchWater: expectedBatchWaterL,
    actualBatchWater: Number(loadInput.actualBatchWater),
    waterAdjustment,
    actualCement: loadInput.actualCement !== undefined ? Number(loadInput.actualCement) : Math.round(loadInput.mixDesign.cement * loadInput.quantity),
    actualSand: loadInput.actualSand !== undefined ? Number(loadInput.actualSand) : undefined,
    actualThreeQuarterStone: loadInput.actualThreeQuarterStone !== undefined ? Number(loadInput.actualThreeQuarterStone) : Math.round(loadInput.mixDesign.threeQuarterStone * loadInput.quantity),
    actualThreeEighthStone: loadInput.actualThreeEighthStone !== undefined ? Number(loadInput.actualThreeEighthStone) : Math.round((loadInput.mixDesign.threeEighthStone || 0) * loadInput.quantity),
    actualPlasticizer: loadInput.actualPlasticizer !== undefined ? Number(loadInput.actualPlasticizer) : Math.round((loadInput.mixDesign.plasticizer || 0) * loadInput.quantity),
    actualRetarder: loadInput.actualRetarder !== undefined ? Number(loadInput.actualRetarder) : Math.round((loadInput.mixDesign.retarder || 0) * loadInput.quantity),
    concreteObservations: loadInput.concreteObservations,
    batchAdjustments: loadInput.batchAdjustments,
    batcherNotes: loadInput.batcherNotes || "",
    isReviewed: false,
    snapshot,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
    createdOffline: !navigator.onLine,
    syncStatus: "Saved Offline",
    createdBy: loadInput.batcherName,
  };

  await tx.objectStore("loads").put(load);

  // Update batching day counters
  if (day) {
    day.totalLoads = (day.totalLoads || 0) + 1;
    day.totalVolume = Number(((day.totalVolume || 0) + loadInput.quantity).toFixed(2));
    await dayStore.put(day);
  }

  // Add initial audit record
  const auditStore = tx.objectStore("audit_trail");
  const audit: AuditRecord = {
    id: generateUUID(),
    loadId,
    action: "created",
    userId: loadInput.batcherId,
    userName: loadInput.batcherName,
    timestamp: now.getTime(),
    changesSummary: `Initial load created: ${load.truckCode} - ${load.mixCode} (${load.quantity} yd³)`,
    newValues: load,
  };
  await auditStore.put(audit);

  await tx.done;

  return load;
}

export async function getLoads(): Promise<LoadRecord[]> {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];

  const loads = await db.getAll("loads");
  return loads.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getTodaysLoads(batchingDayId?: string): Promise<LoadRecord[]> {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];

  const todayStr = new Date().toISOString().split("T")[0];
  const allLoads = await db.getAll("loads");

  return allLoads
    .filter((l) => (batchingDayId ? l.batchingDayId === batchingDayId : l.date === todayStr))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function getLastLoad(): Promise<LoadRecord | null> {
  const loads = await getLoads();
  return loads.length > 0 ? loads[0] : null;
}

export async function getLoadById(id: string): Promise<LoadRecord | null> {
  if (!isClient) return null;
  const db = await initDB();
  if (!db) return null;
  return (await db.get("loads", id)) || null;
}

export async function updateLoad(
  id: string,
  updates: Partial<LoadRecord>,
  editorName = "Batcher",
  editorId = "batcher_01",
  reason = ""
): Promise<LoadRecord | null> {
  if (!isClient) return null;
  const db = await initDB();
  if (!db) return null;

  const tx = db.transaction(["loads", "audit_trail"], "readwrite");
  const loadStore = tx.objectStore("loads");
  const auditStore = tx.objectStore("audit_trail");

  const existing = await loadStore.get(id);
  if (!existing) {
    await tx.done;
    return null;
  }

  const previousSnapshot = { ...existing };
  const now = Date.now();

  const updated: LoadRecord = {
    ...existing,
    ...updates,
    updatedAt: now,
    lastEditedBy: editorName,
    lastEditedAt: now,
    syncStatus: "Saved Offline", // Needs re-sync after edit
  };

  // Re-calculate water adjustment if actual water or expected water changed
  if (updates.actualBatchWater !== undefined || updates.expectedBatchWater !== undefined) {
    const act = updates.actualBatchWater ?? updated.actualBatchWater;
    const exp = updates.expectedBatchWater ?? updated.expectedBatchWater;
    updated.waterAdjustment = Math.round(act - exp);
  }

  await loadStore.put(updated);

  const audit: AuditRecord = {
    id: generateUUID(),
    loadId: id,
    action: "updated",
    userId: editorId,
    userName: editorName,
    timestamp: now,
    changesSummary: reason || "Record updated",
    previousValues: previousSnapshot,
    newValues: updated,
  };
  await auditStore.put(audit);

  await tx.done;
  return updated;
}

export async function voidLoad(
  id: string,
  user = "Batcher",
  userId = "batcher_01",
  reason = "Voided by operator"
): Promise<boolean> {
  if (!isClient) return false;
  const db = await initDB();
  if (!db) return false;

  const tx = db.transaction(["loads", "audit_trail"], "readwrite");
  const loadStore = tx.objectStore("loads");
  const auditStore = tx.objectStore("audit_trail");

  const existing = await loadStore.get(id);
  if (!existing) {
    await tx.done;
    return false;
  }

  existing.isVoid = true;
  existing.voidReason = reason;
  existing.updatedAt = Date.now();
  existing.lastEditedBy = user;
  existing.lastEditedAt = Date.now();
  existing.syncStatus = "Saved Offline";

  await loadStore.put(existing);

  const audit: AuditRecord = {
    id: generateUUID(),
    loadId: id,
    action: "voided",
    userId,
    userName: user,
    timestamp: Date.now(),
    changesSummary: `Voided: ${reason}`,
    previousValues: { isVoid: false },
    newValues: { isVoid: true, voidReason: reason },
  };
  await auditStore.put(audit);

  await tx.done;
  return true;
}

export async function getAuditTrailForLoad(loadId: string): Promise<AuditRecord[]> {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];
  const all = await db.getAll("audit_trail");
  return all.filter((a) => a.loadId === loadId).sort((a, b) => b.timestamp - a.timestamp);
}

// === MIX DESIGNS & TRUCKS OPERATIONS ===

export async function getMixDesigns(activeOnly = true): Promise<MixDesign[]> {
  if (!isClient) return DEFAULT_MIX_DESIGNS;
  const db = await initDB();
  if (!db) return DEFAULT_MIX_DESIGNS;

  const all = await db.getAll("mix_designs");
  if (all.length === 0) return DEFAULT_MIX_DESIGNS;

  return activeOnly ? all.filter((m) => m.active) : all;
}

export async function saveMixDesign(mix: MixDesign): Promise<MixDesign> {
  if (!isClient) return mix;
  const db = await initDB();
  if (!db) return mix;

  const item = {
    ...mix,
    id: mix.id || `mix_${mix.code.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
    updatedAt: Date.now(),
    createdAt: mix.createdAt || Date.now(),
  };
  await db.put("mix_designs", item);
  return item;
}

export async function getTrucks(activeOnly = true): Promise<Truck[]> {
  if (!isClient) return DEFAULT_TRUCKS;
  const db = await initDB();
  if (!db) return DEFAULT_TRUCKS;

  const all = await db.getAll("trucks");
  if (all.length === 0) return DEFAULT_TRUCKS;

  return activeOnly ? all.filter((t) => t.active) : all;
}

export async function saveTruck(truck: Truck): Promise<Truck> {
  if (!isClient) return truck;
  const db = await initDB();
  if (!db) return truck;

  const item = {
    ...truck,
    id: truck.id || `truck_${truck.code.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
  };
  await db.put("trucks", item);
  return item;
}

export async function getObservationOptions(activeOnly = true): Promise<ObservationOption[]> {
  if (!isClient) return DEFAULT_OBSERVATIONS;
  const db = await initDB();
  if (!db) return DEFAULT_OBSERVATIONS;

  const all = await db.getAll("observation_options");
  if (all.length === 0) return DEFAULT_OBSERVATIONS;

  const sorted = all.sort((a, b) => a.sortOrder - b.sortOrder);
  return activeOnly ? sorted.filter((o) => o.active) : sorted;
}

export async function saveObservationOption(opt: ObservationOption): Promise<ObservationOption> {
  if (!isClient) return opt;
  const db = await initDB();
  if (!db) return opt;
  await db.put("observation_options", opt);
  return opt;
}

export async function getAdjustmentOptions(activeOnly = true): Promise<AdjustmentOption[]> {
  if (!isClient) return DEFAULT_ADJUSTMENTS;
  const db = await initDB();
  if (!db) return DEFAULT_ADJUSTMENTS;

  const all = await db.getAll("adjustment_options");
  if (all.length === 0) return DEFAULT_ADJUSTMENTS;

  const sorted = all.sort((a, b) => a.sortOrder - b.sortOrder);
  return activeOnly ? sorted.filter((a) => a.active) : sorted;
}

export async function saveAdjustmentOption(opt: AdjustmentOption): Promise<AdjustmentOption> {
  if (!isClient) return opt;
  const db = await initDB();
  if (!db) return opt;
  await db.put("adjustment_options", opt);
  return opt;
}

// === SETTINGS OPERATIONS ===

export async function getDiarySettings(): Promise<DiarySettings> {
  if (!isClient) return DEFAULT_SETTINGS;
  const db = await initDB();
  if (!db) return DEFAULT_SETTINGS;

  const all = await db.getAll("settings");
  const result: any = { ...DEFAULT_SETTINGS };
  for (const item of all) {
    result[item.key] = item.value;
  }
  return result as DiarySettings;
}

export async function saveDiarySetting(key: string, value: any): Promise<void> {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;
  await db.put("settings", { key, value });
}

export async function saveAllDiarySettings(settings: Partial<DiarySettings>): Promise<void> {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;

  const tx = db.transaction("settings", "readwrite");
  for (const [key, value] of Object.entries(settings)) {
    await tx.store.put({ key, value });
  }
  await tx.done;
}

// === SYNC OPERATIONS ===

export async function getUnsyncedLoads(): Promise<LoadRecord[]> {
  if (!isClient) return [];
  const db = await initDB();
  if (!db) return [];

  const all = await db.getAll("loads");
  return all.filter((l) => l.syncStatus === "Saved Offline" || l.syncStatus === "Sync Error");
}

export async function updateLoadSyncStatus(
  id: string,
  status: "Saved Offline" | "Syncing" | "Synced" | "Sync Error",
  errorMessage = ""
) {
  if (!isClient) return;
  const db = await initDB();
  if (!db) return;

  const load = await db.get("loads", id);
  if (load) {
    load.syncStatus = status;
    load.errorMessage = errorMessage;
    if (status === "Synced") {
      load.supabaseSyncedAt = Date.now();
    }
    await db.put("loads", load);
  }
}

export async function syncBatchingDataToCloud(): Promise<{
  success: boolean;
  syncedCount: number;
  failedCount: number;
  error?: string;
}> {
  if (!isClient || !navigator.onLine) {
    return { success: false, syncedCount: 0, failedCount: 0, error: "Offline" };
  }

  const unsynced = await getUnsyncedLoads();
  if (unsynced.length === 0) {
    return { success: true, syncedCount: 0, failedCount: 0 };
  }

  const db = await initDB();
  if (!db) return { success: false, syncedCount: 0, failedCount: 0, error: "DB not initialized" };

  // Set all to Syncing
  for (const item of unsynced) {
    await updateLoadSyncStatus(item.id, "Syncing");
  }

  try {
    const res = await fetch("/api/batching/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loads: unsynced }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error || `Server returned ${res.status}`;
      for (const item of unsynced) {
        await updateLoadSyncStatus(item.id, "Sync Error", msg);
      }
      return { success: false, syncedCount: 0, failedCount: unsynced.length, error: msg };
    }

    const result = await res.json();
    const syncedIds: string[] = result.synced || [];
    const failedIds: string[] = result.failed || [];

    for (const id of syncedIds) {
      await updateLoadSyncStatus(id, "Synced");
    }

    for (const id of failedIds) {
      await updateLoadSyncStatus(id, "Sync Error", "Server could not process load");
    }

    return {
      success: true,
      syncedCount: syncedIds.length,
      failedCount: failedIds.length,
    };
  } catch (err: any) {
    console.error("Batching sync error:", err);
    for (const item of unsynced) {
      await updateLoadSyncStatus(item.id, "Sync Error", err.message || "Network error");
    }
    return {
      success: false,
      syncedCount: 0,
      failedCount: unsynced.length,
      error: err.message || "Network error",
    };
  }
}
