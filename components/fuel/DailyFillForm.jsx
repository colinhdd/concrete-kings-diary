import React, { useState, useEffect, useMemo } from 'react';
import { Fuel, Calendar, Compass, Edit3, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import { saveEntry, getEntries, calculateRemainingFuel } from '@/lib/db-fuel';


// Hardcoded offline fleet fallback list based on system requirements
const OFFLINE_FLEET = [
  // Mixers (ULSD, Max Capacity ~350L, standard validation limit 300L)
  { plate: 'CT3628', vehicleId: 'CM-01', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CT3629', vehicleId: 'CM-02', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CT3630', vehicleId: 'CM-03', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CT3624', vehicleId: 'CM-04', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CT3637', vehicleId: 'CM-05', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CT3638', vehicleId: 'CM-06', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CT3636', vehicleId: 'CM-07', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CT3623', vehicleId: 'CM-08', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CT3625', vehicleId: 'CM-09', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CT6723', vehicleId: 'CM-10', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CU2573', vehicleId: 'CM-11', type: 'mixer', fuelType: 'ULSD', status: 'TRUCK DOWN' }, // Excluded from active
  { plate: 'CU2574', vehicleId: 'CM-12', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CU2575', vehicleId: 'CM-13', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CU7288', vehicleId: 'CM-14', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CU8893', vehicleId: 'CM-15', type: 'mixer', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CU8894', vehicleId: 'CM-16', type: 'mixer', fuelType: 'ULSD', status: 'Active' },

  // Pump Trucks (ULSD, Max Capacity ~400L, standard validation limit 350L)
  { plate: 'CM1436', vehicleId: 'CL-01', type: 'pump', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CS5617', vehicleId: 'CL-02', type: 'pump', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CN6018', vehicleId: 'CL-03', type: 'pump', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CS9962', vehicleId: 'CL-04', type: 'pump', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CT8928', vehicleId: 'CP-05', type: 'pump', fuelType: 'ULSD', status: 'Active' },
  { plate: '9138 LF', vehicleId: 'CP-06', type: 'pump', fuelType: 'ULSD', status: 'Active' },

  // Company Vehicles (Support, Mixed fuels, standard validation limit 80L - excluding CV-08-10)
  { plate: '2737 LD', vehicleId: 'CV-01', type: 'company', fuelType: 'Regular 90 Gas', status: 'Active' },
  { plate: '2738 LD', vehicleId: 'CV-02', type: 'company', fuelType: 'Regular 90 Gas', status: 'Active' },
  { plate: 'CT2896', vehicleId: 'CV-03', type: 'company', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CT2897', vehicleId: 'CV-04', type: 'company', fuelType: 'ULSD', status: 'Active' },
  { plate: '4804LP', vehicleId: 'CV-05', type: 'company', fuelType: 'ULSD', status: 'Active' },
  { plate: 'CU8892', vehicleId: 'CV-06', type: 'company', fuelType: 'Regular 90 Gas', status: 'Active' },
  { plate: 'CU8895', vehicleId: 'CV-07', type: 'company', fuelType: 'Regular 90 Gas', status: 'Active' },

  // Equipment (ULSD / Regular 90 Gas)
  { plate: 'Big Tractor', vehicleId: 'CA-01', type: 'equipment', fuelType: 'ULSD', status: 'Active' },
  { plate: 'Small Tractor', vehicleId: 'CA-02', type: 'equipment', fuelType: 'ULSD', status: 'Active' },
  { plate: 'Generator', vehicleId: 'EQ-03', type: 'equipment', fuelType: 'ULSD', status: 'Active' },
  { plate: 'Water pump', vehicleId: 'EQ-04', type: 'equipment', fuelType: 'Regular 90 Gas', status: 'Active' },
];

const OFFLINE_DRIVERS = [
  'Barrington McNeil',
  'Conrad Francis',
  'Damian Redden',
  'Horace Bernard',
  'Jerome Hilton',
  'Joseph Brown',
  'Keneil Webber',
  'Matthew Baker',
  'Michael Palmer',
  'Odealie Wright',
  'Oneil Henderson',
  'Recardo Bailey',
  'Tommy Morgan',
  'Trueman Dawkins',
  'Wayne Lafayette',
  'William Gordon',
  'Wilton Roberts'
];



// Robust CSV parser to handle quotes and commas within fields (e.g. "Lastname, Firstname")
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  const cleanLine = line.trimEnd();
  
  for (let i = 0; i < cleanLine.length; i++) {
    const char = cleanLine[i];
    if (char === '"') {
      if (inQuotes && cleanLine[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function DailyFillForm({ onEntrySaved, settings, refreshTrigger }) {
  // Form states
  const [date, setDate] = useState(() => {
    const today = new Date();
    // Local date string in format YYYY-MM-DD
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  
  const [selectedCategory, setSelectedCategory] = useState('mixer');
  const [selectedPlate, setSelectedPlate] = useState('');
  const [fuelType, setFuelType] = useState('ULSD');
  const [fuelSource, setFuelSource] = useState('Local Tank');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [driversList, setDriversList] = useState(OFFLINE_DRIVERS);
  const [volume, setVolume] = useState('');
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');
  const [remainingTankFuel, setRemainingTankFuel] = useState(null);
  const [driversFetchStatus, setDriversFetchStatus] = useState('Not loaded yet');
  
  // Fleet list state (handles online fetch and fallbacks)
  const [fleetList, setFleetList] = useState(OFFLINE_FLEET);
  const [fetchingFleet, setFetchingFleet] = useState(false);
  const [fleetSource, setFleetSource] = useState('offline'); // offline | online
  
  // Entry validation and double fill alerts
  const [existingFills, setExistingFills] = useState([]);
  const [formFeedback, setFormFeedback] = useState(null); // { type: 'success' | 'error', text: '' }

  // Load remaining fuel in local storage tank
  useEffect(() => {
    async function loadRemaining() {
      try {
        const val = await calculateRemainingFuel();
        setRemainingTankFuel(val);
      } catch (err) {
        console.error('Failed to get remaining tank level:', err);
      }
    }
    loadRemaining();
  }, [refreshTrigger, existingFills]);

  // Load local past logs to check for same-day double fills
  const checkDoubleFill = useMemo(() => {
    if (!selectedPlate) return false;
    return existingFills.some(
      (entry) => entry.plate === selectedPlate && entry.date === date
    );
  }, [selectedPlate, date, existingFills]);

  // Load existing entries and fetch fleet CSV if configured
  useEffect(() => {
    async function loadLogs() {
      const logs = await getEntries();
      setExistingFills(logs);
    }
    loadLogs();

    async function fetchOnlineFleet() {
      setFetchingFleet(true);
      setDriversFetchStatus('Connecting to sheet registry...');
      try {
        const response = await fetch("/api/vehicle-info", { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status} fetching vehicle data`);
        const apiData = await response.json();
        if (!apiData.success) throw new Error(apiData.error || "Roster API returned failure");

        // Parse vehicles
        const parsedVehicles = (apiData.vehicles || []).map(v => ({
          plate: v.plate,
          vehicleId: v.vehicleId,
          type: v.type,
          fuelType: v.fuelType,
          status: v.status,
          driver: ""
        }));

        if (parsedVehicles.length === 0) throw new Error('No vehicles found in sheet');

        setFleetList(parsedVehicles);
        setFleetSource('online');

        // Parse drivers
        const onlineDrivers = (apiData.drivers || []).map(d => d.name).filter(Boolean);
        const allDrivers = new Set([...onlineDrivers]);
        setDriversList(Array.from(allDrivers).sort());
        setDriversFetchStatus(`✓ ${parsedVehicles.length} vehicles · ${allDrivers.size} drivers loaded`);

      } catch (err) {
        console.warn('[CK Fleet] Fleet fetch failed, using offline data:', err);
        setFleetList(OFFLINE_FLEET);
        setFleetSource('offline');
        setDriversList(OFFLINE_DRIVERS);
        setDriversFetchStatus(`Offline mode active. ${err.message}`);
      } finally {
        setFetchingFleet(false);
      }
    }

    fetchOnlineFleet();
  }, [settings.vehicleCsvUrl]);

  // Filter fleet based on selected Category and Active status
  const activeCategoryFleet = useMemo(() => {
    return fleetList.filter(
      (v) => v.type === selectedCategory && v.status.trim().toUpperCase() === 'ACTIVE'
    );
  }, [fleetList, selectedCategory]);

  // Reset selected plate when category changes
  useEffect(() => {
    if (activeCategoryFleet.length > 0) {
      setSelectedPlate(activeCategoryFleet[0].plate);
    } else {
      setSelectedPlate('');
    }
  }, [selectedCategory, activeCategoryFleet]);

  // Auto-populate fuel type and driver when selected vehicle changes
  useEffect(() => {
    const matched = activeCategoryFleet.find((v) => v.plate === selectedPlate);
    if (matched) {
      setFuelType(matched.fuelType);
      if (matched.driver) {
        setSelectedDriver(matched.driver);
      } else {
        setSelectedDriver('');
      }
    } else {
      setSelectedDriver('');
    }
  }, [selectedPlate, activeCategoryFleet]);

  // Handle dynamic volume validations
  const maxThreshold = useMemo(() => {
    const customMixer = parseFloat(settings.maxVolumeMixer) || 300;
    const customCompany = parseFloat(settings.maxVolumeCompany) || 80;
    
    if (selectedCategory === 'mixer') return customMixer;
    if (selectedCategory === 'pump') return 350; // default pump truck max
    if (selectedCategory === 'company') return customCompany;
    return 100; // equipment default
  }, [selectedCategory, settings]);

  const volumeWarning = useMemo(() => {
    if (!volume) return false;
    return parseFloat(volume) > maxThreshold;
  }, [volume, maxThreshold]);

  const selectedVehicleDetails = useMemo(() => {
    return activeCategoryFleet.find((v) => v.plate === selectedPlate) || {};
  }, [selectedPlate, activeCategoryFleet]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormFeedback(null);

    // Form logic validation
    if (!selectedPlate) {
      setFormFeedback({ type: 'error', text: 'Please select a valid vehicle licence plate.' });
      return;
    }

    if (!volume || parseFloat(volume) <= 0) {
      setFormFeedback({ type: 'error', text: 'Please enter a valid volume greater than 0.' });
      return;
    }

    // Generate unique UUID sync identifier
    const syncId = `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const selectedVehicle = activeCategoryFleet.find((v) => v.plate === selectedPlate);

    const newLog = {
      id: syncId,
      date: date,
      plate: selectedPlate,
      vehicleType: selectedCategory === 'mixer' ? 'Mixer' : selectedCategory === 'pump' ? 'Pump Truck' : selectedCategory === 'company' ? 'Company Vehicle' : 'Equipment',
      volume: parseFloat(volume),
      fuelType: fuelType,
      fuelSource: fuelSource,
      driver: selectedDriver,
      odometer: selectedCategory === 'equipment' ? '' : (odometer ? odometer.toString() : ''),
      notes: notes.trim(),
      status: 'pending',
      timestamp: Date.now()
    };

    try {
      await saveEntry(newLog);
      
      // Visual feedback success
      setFormFeedback({ 
        type: 'success', 
        text: `Log added for ${selectedPlate}! Saved to offline queue.` 
      });

      // Clear standard entry fields, keep Date & Category
      setVolume('');
      setOdometer('');
      setNotes('');

      // Refresh parent sync trigger
      if (onEntrySaved) onEntrySaved();

      // Clear success badge alert after 3.5s
      setTimeout(() => {
        setFormFeedback(null);
      }, 3500);

    } catch (err) {
      console.error(err);
      setFormFeedback({ type: 'error', text: 'Database error: failed to write to IndexedDB.' });
    }
  };

  return (
    <div className="form-section">
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Fuel size={20} style={{ color: 'var(--accent-primary)' }} />
            Log Morning Fuel Fill
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px' }}>
            <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
            <input 
              type="date" 
              id="date-picker" 
              className="form-input"
              style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '8px', width: 'auto', border: '1px solid var(--input-border)' }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Dynamic Fleet Indicator Info Badge */}
        {settings.vehicleCsvUrl && (
          <div 
            style={{ 
              fontSize: '11px', 
              color: fleetSource === 'online' ? 'var(--success)' : 'var(--pending)', 
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '3px', backgroundColor: fleetSource === 'online' ? 'var(--success)' : 'var(--pending)' }}></span>
            {fleetSource === 'online' 
              ? 'Synced with online vehicle registry' 
              : 'Failed to parse online sheet. Working on local offline vehicle list.'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-section">
          
          {/* Vehicle Fleet Division Segmented Control */}
          <div className="form-group form-group-full">
            <label>Vehicle Fleet Division</label>
            <div className="segmented-control">
              <button 
                type="button"
                className={`segment-item ${selectedCategory === 'mixer' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('mixer')}
              >
                Mixers
              </button>
              <button 
                type="button"
                className={`segment-item ${selectedCategory === 'pump' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('pump')}
              >
                Pumps
              </button>
              <button 
                type="button"
                className={`segment-item ${selectedCategory === 'company' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('company')}
              >
                Vehicles
              </button>
              <button 
                type="button"
                className={`segment-item ${selectedCategory === 'equipment' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('equipment')}
              >
                Equip.
              </button>
            </div>
          </div>

          {/* Plate Selector Dropdown */}
          <div className="form-group">
            <label htmlFor="plate-select">Select License Plate</label>
            <select
              id="plate-select"
              className="form-select"
              value={selectedPlate}
              onChange={(e) => setSelectedPlate(e.target.value)}
              required
            >
              {activeCategoryFleet.length === 0 ? (
                <option value="">No active vehicles in this division</option>
              ) : (
                activeCategoryFleet.map((v) => (
                  <option key={v.plate} value={v.plate}>
                    {v.plate} — {v.vehicleId}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Driver Selector Dropdown */}
          <div className="form-group">
            <label htmlFor="driver-select">Select Driver</label>
            <select
              id="driver-select"
              className="form-select"
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              required
            >
              <option value="">-- Select Driver --</option>
              {driversList.map((driver) => (
                <option key={driver} value={driver}>
                  {driver}
                </option>
              ))}
            </select>
            {settings.vehicleCsvUrl && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Sync: {driversFetchStatus}
              </span>
            )}
          </div>

          {/* Double Fill caution banner */}
          {checkDoubleFill && (
            <div 
              className="alert-banner full-width"
              style={{ 
                padding: '10px 14px', 
                borderRadius: '8px', 
                backgroundColor: 'rgba(245, 158, 11, 0.12)', 
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: 'var(--pending)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                lineHeight: '1.3'
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span><strong>Caution:</strong> Same-day fill log already saved locally for {selectedPlate}. Verify this isn't a double-log error.</span>
            </div>
          )}

          {/* Fuel source select dropdown */}
          <div className="form-group">
            <label htmlFor="fuel-source">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between', width: '100%' }}>
                <span>Dispensation Fuel Source</span>
                {fuelSource === 'Local Tank' && remainingTankFuel !== null && (
                  <span className={`badge ${remainingTankFuel < 1000 ? 'failed' : 'synced'}`} style={{ fontSize: '10px', textTransform: 'none', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', fontWeight: 'bold' }}>
                    {remainingTankFuel.toLocaleString()} L left
                  </span>
                )}
              </span>
            </label>
            <select
              id="fuel-source"
              className="form-select"
              value={fuelSource}
              onChange={(e) => setFuelSource(e.target.value)}
              required
            >
              <option value="Local Tank">Local Storage Tank</option>
              <option value="Direct Tanker">Direct Tanker (Direct to Vehicle)</option>
              <option value="Gas Station">External Gas Station</option>
            </select>
          </div>

          {/* Fuel type auto-populated select dropdown */}
          <div className="form-group">
            <label htmlFor="fuel-type">Engine Fuel Type</label>
            <select 
              id="fuel-type" 
              className="form-select" 
              value={fuelType} 
              onChange={(e) => setFuelType(e.target.value)}
              required
            >
              {selectedVehicleDetails.fuelType === 'ULSD' || selectedVehicleDetails.fuelType === 'Regular Diesel' || selectedCategory === 'mixer' || selectedCategory === 'pump' || (selectedVehicleDetails.plate && ['CT2896', 'CT2897', 'CV2350', 'Big Tractor', 'Small Tractor', 'Generator'].includes(selectedVehicleDetails.plate)) ? (
                <>
                  <option value="ULSD">ULSD (Ultra-Low Sulfur Diesel)</option>
                  <option value="Regular Diesel">Regular Diesel</option>
                </>
              ) : (
                <option value="Regular 90 Gas">Regular 90 Gas</option>
              )}
            </select>
          </div>

          {/* Local Tank Alert Banner */}
          {fuelSource === 'Local Tank' && remainingTankFuel !== null && remainingTankFuel < 1000 && (
            <div 
              className="alert-banner full-width"
              style={{ 
                padding: '10px 14px', 
                borderRadius: '8px', 
                backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--failed)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                lineHeight: '1.3'
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span><strong>Alert:</strong> Storage tank fuel is below 1000 Litres! Please log a tank refill soon.</span>
            </div>
          )}

          {/* Volume input */}
          <div className="form-group">
            <label htmlFor="volume">Volume (Litres)</label>
            <input 
              type="number" 
              id="volume" 
              step="0.01" 
              className="form-input"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="e.g. 154.5"
              min="0.1"
              required
            />
            {volumeWarning && (
              <div 
                style={{ 
                  color: 'var(--failed)', 
                  fontSize: '11px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  marginTop: '4px',
                  fontWeight: '600'
                }}
              >
                <AlertTriangle size={12} />
                <span>Exceeds standard attendant threshold limit ({maxThreshold}L). Check decimal point placement!</span>
              </div>
            )}
            {volume && fuelSource === 'Local Tank' && remainingTankFuel !== null && parseFloat(volume) > remainingTankFuel && (
              <div 
                style={{ 
                  color: 'var(--failed)', 
                  fontSize: '11px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  marginTop: '4px',
                  fontWeight: '600'
                }}
              >
                <AlertTriangle size={12} />
                <span>Caution: volume exceeds remaining tank capacity ({remainingTankFuel.toLocaleString()} L)!</span>
              </div>
            )}
          </div>

          {/* Odometer input */}
          {selectedCategory !== 'equipment' && (
            <div className="form-group">
              <label htmlFor="odometer">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Compass size={14} /> Current Odometer Reading (km)
                </span>
              </label>
              <input 
                type="number" 
                id="odometer" 
                className="form-input"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="e.g. 138402 (leave blank if broken)"
                min="0"
              />
            </div>
          )}

          {/* Optional notes */}
          <div className="form-group form-group-full">
            <label htmlFor="notes">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Edit3 size={14} /> Attendant Notes
              </span>
            </label>
            <textarea
              id="notes"
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional: driver changes, pump discrepancies, structural issues..."
              rows="2"
            />
          </div>

          {/* Submission feedback */}
          {formFeedback && (
            <div 
              className="alert-banner full-width"
              style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: formFeedback.type === 'success' ? 'var(--success-bg)' : 'var(--failed-bg)',
                color: formFeedback.type === 'success' ? 'var(--success)' : 'var(--failed)',
                border: `1px solid ${formFeedback.type === 'success' ? 'var(--success-border)' : 'var(--failed-border)'}`
              }}
            >
              {formFeedback.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span>{formFeedback.text}</span>
            </div>
          )}

          {/* Save Button */}
          <button type="submit" className="btn-primary">
            <Save size={18} />
            Save & Queue Fill Entry
          </button>

        </form>
      </div>
    </div>
  );
}

export default DailyFillForm;
