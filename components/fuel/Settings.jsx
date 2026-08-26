import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle, Database, Server, User, List } from 'lucide-react';
import { getAllSettings, saveAllSettings, clearAllSyncedEntries } from '@/lib/db-fuel';

function Settings({ onSettingsSaved }) {
  const [formSettings, setFormSettings] = useState({
    attendantName: '',
    scriptUrl: '',
    vehicleCsvUrl: '',
    maxVolumeMixer: '300',
    maxVolumeCompany: '80',
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }
  const [testState, setTestState] = useState({ testing: false, status: null, text: '' }); // test connection status

  useEffect(() => {
    async function load() {
      const active = await getAllSettings();
      setFormSettings(active);
      setLoading(false);
    }
    load();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await saveAllSettings(formSettings);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      if (onSettingsSaved) onSettingsSaved();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to save settings to IndexedDB.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!formSettings.scriptUrl || formSettings.scriptUrl.trim() === '') {
      setTestState({ testing: false, status: 'error', text: 'Please enter a valid Web App URL.' });
      return;
    }

    setTestState({ testing: true, status: null, text: 'Pinging Apps Script Web App...' });
    
    // Check if it's the mock url
    if (formSettings.scriptUrl.includes('mock-url') || formSettings.scriptUrl.trim() === '') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setTestState({ 
        testing: false, 
        status: 'success', 
        text: 'Simulation Connection OK ✅ (Simulated sheet sync active)' 
      });
      return;
    }

    try {
      // Build ping URL (doGet?action=ping)
      const pingUrl = `${formSettings.scriptUrl}${formSettings.scriptUrl.includes('?') ? '&' : '?'}action=ping`;
      
      const response = await fetch(pingUrl, {
        method: 'GET',
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data && data.status === 'ok') {
        setTestState({ 
          testing: false, 
          status: 'success', 
          text: `Connected! Latency OK. Server Message: "${data.message || 'pong'}"` 
        });
      } else {
        throw new Error(data.message || 'Invalid status response received from ping endpoint.');
      }
    } catch (err) {
      console.error('Ping test failed:', err);
      // Since Apps Script GET sometimes redirects or experiences CORS in browsers:
      // Let's provide a friendly fallback explanation if it's CORS but likely reachable
      setTestState({ 
        testing: false, 
        status: 'warning', 
        text: `Network unreachable or CORS policy blocked direct API read. Check that the script is deployed as "Execute as: Me" and "Access: Anyone".` 
      });
    }
  };

  const handleClearSynced = async () => {
    if (window.confirm('Clear all synced logs from local storage? Synced rows are permanently saved on Google Sheets.')) {
      try {
        await clearAllSyncedEntries();
        setMessage({ type: 'success', text: 'Synced entries purged from local memory.' });
        if (onSettingsSaved) onSettingsSaved();
      } catch (err) {
        console.error(err);
        setMessage({ type: 'error', text: 'Error clearing local logs.' });
      }
    }
  };

  if (loading) {
    return <div className="empty-state">Loading configurations...</div>;
  }

  return (
    <div className="form-section">
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={18} style={{ color: 'var(--accent-primary)' }} />
          System Settings
        </h2>
        
        <form onSubmit={handleSave} className="form-section">
          {/* Attendant Name */}
          <div className="form-group">
            <label htmlFor="attendantName">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} /> Attendant Name
              </span>
            </label>
            <input
              type="text"
              id="attendantName"
              name="attendantName"
              className="form-input"
              value={formSettings.attendantName}
              onChange={handleChange}
              placeholder="e.g. Colin Fuller-Bennett"
            />
          </div>

          {/* Apps Script Endpoint */}
          <div className="form-group">
            <label htmlFor="scriptUrl">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Server size={14} /> Apps Script Web App URL
              </span>
            </label>
            <input
              type="url"
              id="scriptUrl"
              name="scriptUrl"
              className="form-input"
              value={formSettings.scriptUrl}
              onChange={handleChange}
              placeholder="https://script.google.com/macros/s/.../exec"
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testState.testing}
                className="btn-secondary"
                style={{ flex: 1, padding: '8px', fontSize: '12px' }}
              >
                {testState.testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                type="button"
                onClick={() => setFormSettings(prev => ({ ...prev, scriptUrl: 'mock-url' }))}
                className="btn-secondary"
                style={{ padding: '8px 12px', fontSize: '12px' }}
              >
                Use Simulation
              </button>
            </div>
            {testState.text && (
              <div 
                style={{ 
                  marginTop: '8px', 
                  fontSize: '12px', 
                  padding: '8px', 
                  borderRadius: '6px',
                  backgroundColor: testState.status === 'success' ? 'var(--success-bg)' : testState.status === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'var(--failed-bg)',
                  color: testState.status === 'success' ? 'var(--success)' : testState.status === 'warning' ? 'var(--pending)' : 'var(--failed)',
                  border: `1px solid ${testState.status === 'success' ? 'var(--success-border)' : testState.status === 'warning' ? 'var(--pending-border)' : 'var(--failed-border)'}`
                }}
              >
                {testState.text}
              </div>
            )}
          </div>

          {/* Compliance Sheet published CSV URL */}
          <div className="form-group">
            <label htmlFor="vehicleCsvUrl">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <List size={14} /> Compliance Vehicle List CSV URL
              </span>
            </label>
            <input
              type="url"
              id="vehicleCsvUrl"
              name="vehicleCsvUrl"
              className="form-input"
              value={formSettings.vehicleCsvUrl}
              onChange={handleChange}
              placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv&gid=..."
            />
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>
              If left blank, the app runs on the built-in <strong>Concrete Kings Offline Fleet Registry</strong> (16 mixers, 6 pump trucks, 10 support vehicles).
            </div>
          </div>

          {/* Verification Thresholds */}
          <h3 style={{ fontSize: '14px', marginTop: '8px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px' }}>
            Attendant Safety Ratios
          </h3>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="maxVolumeMixer">Mixers Max (L)</label>
              <input
                type="number"
                id="maxVolumeMixer"
                name="maxVolumeMixer"
                className="form-input"
                value={formSettings.maxVolumeMixer}
                onChange={handleChange}
                min="1"
              />
            </div>
            
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="maxVolumeCompany">Cars Max (L)</label>
              <input
                type="number"
                id="maxVolumeCompany"
                name="maxVolumeCompany"
                className="form-input"
                value={formSettings.maxVolumeCompany}
                onChange={handleChange}
                min="1"
              />
            </div>
          </div>

          {/* Status Message Display */}
          {message && (
            <div 
              style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                fontSize: '13px',
                backgroundColor: message.type === 'success' ? 'var(--success-bg)' : 'var(--failed-bg)',
                color: message.type === 'success' ? 'var(--success)' : 'var(--failed)',
                border: `1px solid ${message.type === 'success' ? 'var(--success-border)' : 'var(--failed-border)'}`
              }}
            >
              {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={saving} className="btn-primary">
            <Save size={18} />
            {saving ? 'Saving Settings...' : 'Save Configurations'}
          </button>
        </form>
      </div>

      {/* Database Cleanup Section */}
      <div className="glass-panel" style={{ padding: '20px', marginTop: '10px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <Database size={18} style={{ color: 'var(--text-secondary)' }} />
          Local Database Storage
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
          This browser maintains local cache files inside IndexedDB. Successfully synchronized logs remain saved permanently on Google Sheets, but can be cleaned up locally to maintain peak phone browser speeds.
        </p>
        <button onClick={handleClearSynced} className="btn-secondary" style={{ width: '100%', borderColor: 'rgba(244, 63, 94, 0.3)', color: 'var(--failed)' }}>
          Purge Synced Fills From Device
        </button>
      </div>
    </div>
  );
}

export default Settings;
