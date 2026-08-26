import { NextRequest, NextResponse } from "next/server";
import { getCachedRegistry, getCachedSheetValues, getSheetValues, appendSheetRow } from "@/lib/sheets";

// Resolve gate-log spreadsheet ID
async function getGateLogSpreadsheetId() {
  const registry = await getCachedRegistry();
  const entry = registry.find((e) => e.sheet_key === "gate-log");
  if (!entry) {
    throw new Error("gate-log sheet key not found in registry");
  }
  return entry.spreadsheet_id;
}

export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = await getGateLogSpreadsheetId();
    
    // Fetch last rows from all 5 sheets in parallel
    const [staffRes, pumpRes, mixerRes, deliveryRes, visitorRes] = await Promise.all([
      getCachedSheetValues(spreadsheetId, "'Staff Attendance'!A2:G1000", 30),
      getCachedSheetValues(spreadsheetId, "'Pump Vehicles'!A2:F1000", 30),
      getCachedSheetValues(spreadsheetId, "'Mixer Vehicles'!A2:G1000", 30),
      getCachedSheetValues(spreadsheetId, "'Outside Deliveries'!A2:H1000", 30),
      getCachedSheetValues(spreadsheetId, "'Outside Visitors'!A2:F1000", 30),
    ]);

    const staffRows = staffRes.data;
    const pumpRows = pumpRes.data;
    const mixerRows = mixerRes.data;
    const deliveryRows = deliveryRes.data;
    const visitorRows = visitorRes.data;

    const staff = staffRows.map((row) => ({
      date: row[0] || "",
      employeeName: row[1] || "",
      timeIn: row[2] || "",
      timeOut: row[3] || "",
      hoursWorked: row[4] || "",
      otHours: row[5] || "",
      id: row[6] || "",
      category: "staff",
      status: "synced",
    })).reverse();

    const pump = pumpRows.map((row) => ({
      date: row[0] || "",
      driverName: row[1] || "",
      truckId: row[2] || "",
      departureTime: row[3] || "",
      returnTime: row[4] || "",
      id: row[5] || "",
      category: "pump",
      status: "synced",
    })).reverse();

    const mixer = mixerRows.map((row) => ({
      date: row[0] || "",
      driverName: row[1] || "",
      truckId: row[2] || "",
      deliveryTicket: row[3] || "",
      departureTime: row[4] || "",
      returnTime: row[5] || "",
      id: row[6] || "",
      category: "mixer",
      status: "synced",
    })).reverse();

    const delivery = deliveryRows.map((row) => ({
      date: row[0] || "",
      driverName: row[1] || "",
      plate: row[2] || "",
      materialType: row[3] || "",
      ticketNum: row[4] || "",
      timeIn: row[5] || "",
      timeOut: row[6] || "",
      id: row[7] || "",
      category: "delivery",
      status: "synced",
    })).reverse();

    const visitor = visitorRows.map((row) => ({
      date: row[0] || "",
      visitorName: row[1] || "",
      purpose: row[2] || "",
      timeIn: row[3] || "",
      timeOut: row[4] || "",
      id: row[5] || "",
      category: "visitor",
      status: "synced",
    })).reverse();

    return NextResponse.json({
      success: true,
      data: {
        staff,
        pump,
        mixer,
        delivery,
        visitor,
      },
    });
  } catch (error) {
    console.error("GET /api/gate-log failed:", error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch logs: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const spreadsheetId = await getGateLogSpreadsheetId();
    const body = await request.json();
    const { logs } = body;

    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { success: false, error: "logs array is required" },
        { status: 400 }
      );
    }

    // 1. Fetch existing log IDs to prevent duplicate syncs
    const [existingStaff, existingPump, existingMixer, existingDelivery, existingVisitor] = await Promise.all([
      getSheetValues(spreadsheetId, "'Staff Attendance'!G2:G2000"),
      getSheetValues(spreadsheetId, "'Pump Vehicles'!F2:F2000"),
      getSheetValues(spreadsheetId, "'Mixer Vehicles'!G2:G2000"),
      getSheetValues(spreadsheetId, "'Outside Deliveries'!H2:H2000"),
      getSheetValues(spreadsheetId, "'Outside Visitors'!F2:F2000"),
    ]);

    const existingSyncIds = new Set([
      ...existingStaff.map((row) => String(row[0] || "").trim()),
      ...existingPump.map((row) => String(row[0] || "").trim()),
      ...existingMixer.map((row) => String(row[0] || "").trim()),
      ...existingDelivery.map((row) => String(row[0] || "").trim()),
      ...existingVisitor.map((row) => String(row[0] || "").trim()),
    ].filter(Boolean));

    const syncedIds: string[] = [];
    const skippedIds: string[] = [];

    // 2. Append new entries
    for (const log of logs) {
      const logId = String(log.id || "").trim();
      
      // Skip if already in Google Sheet
      if (logId && existingSyncIds.has(logId)) {
        skippedIds.push(logId);
        continue;
      }

      const category = log.category;

      if (category === "staff") {
        const rowValues = [
          log.date || "",
          log.employeeName || "",
          log.timeIn || "",
          log.timeOut || "",
          String(log.hoursWorked || ""),
          String(log.otHours || ""),
          logId,
        ];
        await appendSheetRow(spreadsheetId, "'Staff Attendance'!A:G", rowValues);
      } else if (category === "pump") {
        const rowValues = [
          log.date || "",
          log.driverName || "",
          log.truckId || "",
          log.departureTime || "",
          log.returnTime || "",
          logId,
        ];
        await appendSheetRow(spreadsheetId, "'Pump Vehicles'!A:F", rowValues);
      } else if (category === "mixer") {
        const rowValues = [
          log.date || "",
          log.driverName || "",
          log.truckId || "",
          log.deliveryTicket || "",
          log.departureTime || "",
          log.returnTime || "",
          logId,
        ];
        await appendSheetRow(spreadsheetId, "'Mixer Vehicles'!A:G", rowValues);
      } else if (category === "delivery") {
        const rowValues = [
          log.date || "",
          log.driverName || "",
          log.plate || "",
          log.materialType || "",
          log.ticketNum || "",
          log.timeIn || "",
          log.timeOut || "",
          logId,
        ];
        await appendSheetRow(spreadsheetId, "'Outside Deliveries'!A:H", rowValues);
      } else if (category === "visitor") {
        const rowValues = [
          log.date || "",
          log.visitorName || "",
          log.purpose || "",
          log.timeIn || "",
          log.timeOut || "",
          logId,
        ];
        await appendSheetRow(spreadsheetId, "'Outside Visitors'!A:F", rowValues);
      } else {
        console.warn("Unknown log category skipped:", category);
        skippedIds.push(logId);
        continue;
      }

      syncedIds.push(logId);
    }

    return NextResponse.json({
      success: true,
      synced: syncedIds,
      skipped: skippedIds,
    });
  } catch (error) {
    console.error("POST /api/gate-log failed:", error);
    return NextResponse.json(
      { success: false, error: `Failed to sync logs: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
