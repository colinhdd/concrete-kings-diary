import { NextRequest, NextResponse } from "next/server";
import { getCachedRegistry, getCachedSheetValues } from "@/lib/sheets";

export async function GET(request: NextRequest) {
  try {
    // 1. Fetch registry to find vehicle-drive-info ID
    const registry = await getCachedRegistry();
    const entry = registry.find((e) => e.sheet_key === "vehicle-drive-info");
    
    if (!entry) {
      return NextResponse.json(
        { success: false, error: "vehicle-drive-info sheet key not found in registry" },
        { status: 404 }
      );
    }

    const spreadsheetId = entry.spreadsheet_id;

    // 2. Fetch vehicle details and drivers
    const [vehicleRes, driverRes] = await Promise.all([
      getCachedSheetValues(spreadsheetId, "'Vehicle Details'!A1:J100", 30),
      getCachedSheetValues(spreadsheetId, "'Drivers'!A1:G100", 30),
    ]);

    const vehicleRows = vehicleRes.data;
    const driverRows = driverRes.data;

    // Parse vehicles
    const vehicles: any[] = [];
    if (vehicleRows && vehicleRows.length > 1) {
      const headers = vehicleRows[0].map((h) => String(h).trim().toLowerCase());
      const plateIdx = headers.indexOf("plate #");
      const idIdx = headers.indexOf("vehicle id");
      const typeIdx = headers.indexOf("type of vehicle");
      const bodyIdx = headers.indexOf("body type");
      const fuelIdx = headers.indexOf("fuel type");

      for (let i = 1; i < vehicleRows.length; i++) {
        const row = vehicleRows[i];
        if (!row || row.length === 0) continue;

        const plate = String(row[plateIdx !== -1 ? plateIdx : 0] || "").trim();
        if (!plate || plate.toLowerCase() === "plate #") continue;

        // Omit CV-05 (4804LP), EV-01 (6050JZ), EV-03 (0261JB)
        const cleanPlate = plate.toUpperCase().replace(/\s+/g, "");
        if (["4804LP", "6050JZ", "0261JB"].includes(cleanPlate)) {
          continue;
        }

        const vehicleId = String(row[idIdx !== -1 ? idIdx : 1] || plate).trim();
        const cleanId = vehicleId.toUpperCase().replace(/\s+/g, "");
        if (["CV-05", "EV-01", "EV-03"].includes(cleanId)) {
          continue;
        }
        
        // Check both type of vehicle and body type to categorize division
        const typeOfVehicle = typeIdx !== -1 ? String(row[typeIdx] || "").trim().toLowerCase() : "";
        const bodyType = bodyIdx !== -1 ? String(row[bodyIdx] || "").trim().toLowerCase() : "";
        const combined = `${typeOfVehicle} ${bodyType}`;

        let type = "company";
        if (combined.includes("mixer") || combined.includes("mix")) {
          type = "mixer";
        } else if (combined.includes("pump")) {
          type = "pump";
        } else if (combined.includes("generator") || combined.includes("equipment") || vehicleId.startsWith("EQ")) {
          type = "equipment";
        }

        const rawFuel = String(row[fuelIdx !== -1 ? fuelIdx : 7] || "").toLowerCase();
        const fuelType = (rawFuel.includes("diesel") || rawFuel.includes("ulsd")) ? "ULSD" : "Regular 90 Gas";
        
        const status = "Active";

        vehicles.push({
          plate,
          vehicleId,
          type,
          fuelType,
          status,
        });
      }
    }

    // Ensure Generator and Water pump are always in the equipment list
    const hasGenerator = vehicles.some(v => v.plate.toLowerCase().includes("generator"));
    if (!hasGenerator) {
      vehicles.push({
        plate: "Generator",
        vehicleId: "EQ-03",
        type: "equipment",
        fuelType: "ULSD",
        status: "Active"
      });
    }

    const hasWaterPump = vehicles.some(v => v.plate.toLowerCase().includes("water pump"));
    if (!hasWaterPump) {
      vehicles.push({
        plate: "Water pump",
        vehicleId: "EQ-04",
        type: "equipment",
        fuelType: "Regular 90 Gas",
        status: "Active"
      });
    }

    // Parse drivers
    const drivers: any[] = [];
    if (driverRows && driverRows.length > 1) {
      const headers = driverRows[0].map((h) => String(h).trim().toLowerCase());
      const nameIdx = headers.indexOf("name");
      const typeIdx = headers.indexOf("vehicle type");

      for (let i = 1; i < driverRows.length; i++) {
        const row = driverRows[i];
        if (!row || row.length === 0) continue;
        const name = String(row[nameIdx !== -1 ? nameIdx : 0] || "").trim();
        if (!name || name.toLowerCase() === "name") continue;

        const rawDriverType = typeIdx !== -1 ? String(row[typeIdx] || "").trim().toLowerCase() : "company";
        let type = "company";
        if (rawDriverType.includes("mixer") && rawDriverType.includes("pump")) {
          type = "mixer/pump";
        } else if (rawDriverType.includes("mixer")) {
          type = "mixer";
        } else if (rawDriverType.includes("pump")) {
          type = "pump";
        }

        drivers.push({
          name,
          type,
        });
      }
    }

    return NextResponse.json({
      success: true,
      vehicles,
      drivers,
    });
  } catch (error) {
    console.error("Failed to fetch vehicle-info:", error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch vehicle info: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
