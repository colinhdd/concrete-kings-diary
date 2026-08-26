import { google } from "googleapis";

// Define cache interfaces and global storage to survive hot reloads in development
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const globalForSheets = globalThis as unknown as {
  registryCache?: CacheEntry<RegistryEntry[]>;
  dataCache?: Map<string, CacheEntry<any[][]>>;
};

const dataCache = globalForSheets.dataCache ?? new Map<string, CacheEntry<any[][]>>();
if (process.env.NODE_ENV !== "production") {
  globalForSheets.dataCache = dataCache;
}

const REGISTRY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes registry cache

// Invalidate cached values for a specific spreadsheet
export function invalidateSheetCache(spreadsheetId: string) {
  for (const key of dataCache.keys()) {
    if (key.startsWith(`${spreadsheetId}::`)) {
      dataCache.delete(key);
    }
  }
}

// Get authorization client
export function getGoogleAuth() {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY environment variable");
  }

  let credentials;
  try {
    credentials = JSON.parse(serviceAccountKey);
  } catch (error) {
    throw new Error(`Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON: ${(error as Error).message}`);
  }

  const clientEmail = credentials.client_email;
  const privateKey = credentials.private_key?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY: missing client_email or private_key");
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// Fetch values from a spreadsheet
export async function getSheetValues(spreadsheetId: string, range: string) {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values || [];
}

// Append a row to a spreadsheet
export async function appendSheetRow(spreadsheetId: string, range: string, values: any[]) {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values],
    },
  });

  // Invalidate cache on write
  invalidateSheetCache(spreadsheetId);

  return response.data;
}

// Ensure a tab exists in spreadsheet, create it if not
export async function ensureSheetTabExists(spreadsheetId: string, tabName: string, headers: string[] = []) {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  try {
    const doc = await sheets.spreadsheets.get({ spreadsheetId });
    const exists = doc.data.sheets?.some((s) => s.properties?.title?.toLowerCase() === tabName.toLowerCase());

    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: tabName,
                },
              },
            },
          ],
        },
      });
      invalidateSheetCache(spreadsheetId);
    }

    if (headers && headers.length > 0) {
      await writeHeadersIfEmpty(spreadsheetId, `'${tabName}'!A1:Z1`, headers);
    }
    return true;
  } catch (err: any) {
    console.warn(`ensureSheetTabExists note for ${tabName}:`, err.message);
    return false;
  }
}

// Check if a range/sheet is empty and write headers if it is
export async function writeHeadersIfEmpty(spreadsheetId: string, range: string, headers: string[]) {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const currentValues = await getSheetValues(spreadsheetId, range);
  if (currentValues.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [headers],
      },
    });
    // Invalidate cache on write
    invalidateSheetCache(spreadsheetId);
    return true;
  }
  return false;
}

export interface RegistryEntry {
  sheet_key: string;
  spreadsheet_id: string;
  access_mode: string;
  owning_app: string;
  description: string;
  active: boolean;
  last_verified: string;
}

// Fetch and parse the registry sheet
export async function getRegistry(): Promise<RegistryEntry[]> {
  const registrySpreadsheetId = process.env.REGISTRY_SPREADSHEET_ID;
  if (!registrySpreadsheetId) {
    throw new Error("Missing REGISTRY_SPREADSHEET_ID environment variable");
  }

  // Read the first tab. A:G covers all expected columns.
  const rows = await getSheetValues(registrySpreadsheetId, "A1:G100");
  if (rows.length === 0) {
    return [];
  }

  // Parse headers dynamically to match columns to indices
  const headers = rows[0].map((h) => String(h).trim().toLowerCase());
  
  const getIndex = (name: string) => headers.indexOf(name.toLowerCase());
  
  const sheetKeyIndex = getIndex("sheet_key");
  const spreadsheetIdIndex = getIndex("spreadsheet_id");
  const accessModeIndex = getIndex("access_mode");
  const owningAppIndex = getIndex("owning_app");
  const descriptionIndex = getIndex("description");
  const activeIndex = getIndex("active");
  const lastVerifiedIndex = getIndex("last_verified");

  // If we couldn't match basic headers, fall back to default order
  const useFallback = sheetKeyIndex === -1 || spreadsheetIdIndex === -1;

  const entries: RegistryEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const getValue = (idx: number, fallbackIdx: number) => {
      const targetIdx = useFallback ? fallbackIdx : idx;
      if (targetIdx === -1 || targetIdx >= row.length) return "";
      return String(row[targetIdx]).trim();
    };

    const sheet_key = getValue(sheetKeyIndex, 0);
    const spreadsheet_id = getValue(spreadsheetIdIndex, 1);
    
    // Skip empty rows or header duplicate
    if (!sheet_key || sheet_key === "sheet_key") continue;

    const access_mode = getValue(accessModeIndex, 2);
    const owning_app = getValue(owningAppIndex, 3);
    const description = getValue(descriptionIndex, 4);
    const activeStr = getValue(activeIndex, 5);
    const last_verified = getValue(lastVerifiedIndex, 6);

    // Parse active as boolean. Usually "TRUE", "true", "1", "yes", etc.
    const active = activeStr.toLowerCase() === "true" || activeStr === "1" || activeStr.toLowerCase() === "yes" || activeStr.toLowerCase() === "y";

    entries.push({
      sheet_key,
      spreadsheet_id,
      access_mode,
      owning_app,
      description,
      active,
      last_verified,
    });
  }

  return entries;
}

// Fetch and cache the registry sheet values
export async function getCachedRegistry(forceRefresh = false): Promise<RegistryEntry[]> {
  const now = Date.now();
  if (!forceRefresh && globalForSheets.registryCache) {
    const age = now - globalForSheets.registryCache.timestamp;
    if (age < REGISTRY_CACHE_TTL_MS) {
      return globalForSheets.registryCache.data;
    }
  }

  const data = await getRegistry();
  globalForSheets.registryCache = {
    data,
    timestamp: now,
  };
  return data;
}

// Fetch and cache spreadsheet values
export async function getCachedSheetValues(
  spreadsheetId: string,
  range: string,
  ttlSeconds = 10,
  forceRefresh = false
): Promise<{ data: any[][]; cached: boolean; ageSeconds: number }> {
  const cacheKey = `${spreadsheetId}::${range}`;
  const now = Date.now();

  if (!forceRefresh && ttlSeconds > 0) {
    const entry = dataCache.get(cacheKey);
    if (entry) {
      const ageMs = now - entry.timestamp;
      if (ageMs < ttlSeconds * 1000) {
        return {
          data: entry.data,
          cached: true,
          ageSeconds: Math.round(ageMs / 1000),
        };
      }
    }
  }

  const data = await getSheetValues(spreadsheetId, range);
  dataCache.set(cacheKey, {
    data,
    timestamp: now,
  });

  return {
    data,
    cached: false,
    ageSeconds: 0,
  };
}

// Update a specific cell range with values
export async function updateSheetRange(spreadsheetId: string, range: string, values: any[][]) {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values,
    },
  });

  // Invalidate cache on write
  invalidateSheetCache(spreadsheetId);

  return response.data;
}

// Delete a row completely at a specific 0-based index
export async function deleteSheetRow(spreadsheetId: string, sheetName: string, rowIndex: number) {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // Find sheetId for the sheetName tab
  const doc = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = doc.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (!sheet) throw new Error(`Sheet tab '${sheetName}' not found`);
  const sheetId = sheet.properties?.sheetId;

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  // Invalidate cache on write
  invalidateSheetCache(spreadsheetId);

  return response.data;
}

