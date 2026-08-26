import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Database, Plus, Trash2, Calendar, Edit3, Save, AlertTriangle, CheckCircle, ArrowDown, ArrowUp } from 'lucide-react';
import { saveTankRefill, getTankRefills, deleteTankRefill, getEntries } from '@/lib/db-fuel';

function LocalTankTab({ refreshTrigger, onUpdate }) {
  const [refills, setRefills] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [date, setDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [volume, setVolume] = useState('');
  const [notes, setNotes] = useState('');
  const [formFeedback, setFormFeedback] = useState(null); // { type: 'success' | 'error', text: '' }

  // Admin Reset States
  const [showResetModal, setShowResetModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [resetVolume, setResetVolume] = useState('');
  const [modalFeedback, setModalFeedback] = useState(null);

  const handleAdminResetSubmit = async (e) => {
    e.preventDefault();
    setModalFeedback(null);

    if (adminPassword !== '123ConcreteAdmin') {
      setModalFeedback({ type: 'error', text: 'Incorrect Admin Password.' });
      return;
    }

    const volNum = parseFloat(resetVolume);
    if (isNaN(volNum) || volNum < 0) {
      setModalFeedback({ type: 'error', text: 'Please enter a valid volume.' });
      return;
    }

    // Prepare a special reset refill entry
    const refillId = `refill-reset-${Date.now()}`;
    const resetEntry = {
      id: refillId,
      date: new Date().toISOString().split('T')[0],
      volume: volNum,
      notes: `ADMIN RESET`,
      timestamp: Date.now(),
    };

    try {
      await saveTankRefill(resetEntry);
      setModalFeedback({ type: 'success', text: 'Tank level reset successfully!' });
      
      setAdminPassword('');
      setResetVolume('');
      
      if (onUpdate) onUpdate();
      
      setTimeout(() => {
        setShowResetModal(false);
        setModalFeedback(null);
      }, 1500);
    } catch (err) {
      console.error(err);
      setModalFeedback({ type: 'error', text: 'Failed to write reset log to database.' });
    }
  };

  // Load all required data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const allRefills = await getTankRefills();
      const allEntries = await getEntries();
      setRefills(allRefills);
      setEntries(allEntries);
    } catch (err) {
      console.error('Error loading tank data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  // Calculations
  const stats = useMemo(() => {
    const latestReset = refills.find((r) => r.notes && r.notes.startsWith("ADMIN RESET"));
    
    let remaining = 0;
    let totalRefills = 0;
    let totalDispensed = 0;
    
    if (latestReset) {
      const resetTime = latestReset.timestamp;
      const resetVolumeVal = parseFloat(latestReset.volume || 0);
      
      const refilledAfter = refills
        .filter((r) => r.timestamp > resetTime && r.id !== latestReset.id)
        .reduce((sum, r) => sum + parseFloat(r.volume || 0), 0);
        
      const dispensedAfter = entries
        .filter((e) => e.timestamp > resetTime && (!e.fuelSource || e.fuelSource === 'Local Tank'))
        .reduce((sum, e) => sum + parseFloat(e.volume || 0), 0);
        
      remaining = resetVolumeVal + refilledAfter - dispensedAfter;
      totalRefills = resetVolumeVal + refilledAfter;
      totalDispensed = dispensedAfter;
    } else {
      totalRefills = refills.reduce((sum, r) => sum + parseFloat(r.volume || 0), 0);
      totalDispensed = entries.reduce((sum, e) => {
        if (!e.fuelSource || e.fuelSource === 'Local Tank') {
          return sum + parseFloat(e.volume || 0);
        }
        return sum;
      }, 0);
      remaining = totalRefills - totalDispensed;
    }

    return {
      totalRefills: Math.round(totalRefills * 100) / 100,
      totalDispensed: Math.round(totalDispensed * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
    };
  }, [refills, entries]);

  // Nominal visual capacity setup
  const NOMINAL_CAPACITY = 10000; // 10,000 Litres
  const fillPercentage = useMemo(() => {
    if (stats.remaining <= 0) return 0;
    return Math.min(Math.round((stats.remaining / NOMINAL_CAPACITY) * 100), 100);
  }, [stats.remaining]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormFeedback(null);

    if (!volume || parseFloat(volume) <= 0) {
      setFormFeedback({ type: 'error', text: 'Please enter a valid volume greater than 0.' });
      return;
    }

    const refillId = `refill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newRefill = {
      id: refillId,
      date,
      volume: parseFloat(volume),
      notes: notes.trim(),
      timestamp: Date.now(),
    };

    try {
      await saveTankRefill(newRefill);
      setFormFeedback({
        type: 'success',
        text: `Logged refill of ${parseFloat(volume).toLocaleString()} L successfully!`,
      });
      setVolume('');
      setNotes('');
      
      // Trigger parent stats refresh
      if (onUpdate) onUpdate();

      setTimeout(() => {
        setFormFeedback(null);
      }, 3500);
    } catch (err) {
      console.error(err);
      setFormFeedback({ type: 'error', text: 'Failed to write refill log to database.' });
    }
  };

  const handleDelete = async (id, vol) => {
    if (window.confirm(`Are you sure you want to delete this refill of ${vol.toLocaleString()} L?`)) {
      try {
        await deleteTankRefill(id);
        if (onUpdate) onUpdate(); // Refresh counts
      } catch (err) {
        alert('Failed to delete refill entry');
      }
    }
  };

  if (loading && refills.length === 0 && entries.length === 0) {
    return <div className="empty-state">Loading local tank records...</div>;
  }

  const isLow = stats.remaining < 1000;

  return (
    <div className="form-section">
      {/* Visual Cylinder Gauge & Status Card */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', position: 'relative', overflow: 'hidden' }}>
        
        {/* Decorative subtle grid background inside glass */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />

        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
          <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Database size={20} style={{ color: 'var(--accent-primary)' }} />
            Local Fuel Storage Status
          </h2>
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="btn-secondary"
            style={{ 
              fontSize: '11px', 
              padding: '6px 12px', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              border: '1px solid var(--failed-border)',
              color: 'var(--failed)',
              cursor: 'pointer',
              background: 'rgba(239, 68, 68, 0.08)'
            }}
          >
            Admin Reset
          </button>
        </div>

        {/* Level Indicator container */}
        <div style={{ display: 'flex', width: '100%', gap: '24px', alignItems: 'center', justifyContent: 'center', margin: '10px 0', zIndex: 1 }}>
          
          {/* Animated 3D Liquid Tank Cylinder */}
          <div className="tank-cylinder">
            <div className="tank-cap"></div>
            <div className="tank-body">
              <div 
                className={`tank-liquid ${isLow ? 'low' : ''}`} 
                style={{ height: `${fillPercentage}%` }}
              >
                {/* Wave micro-animation overlay */}
                <div className="wave-overlay"></div>
              </div>
              <div className="tank-glass-sheen"></div>
              {/* Scale marks */}
              <div className="tank-scale" style={{ bottom: '75%' }}>7.5k</div>
              <div className="tank-scale" style={{ bottom: '50%' }}>5k</div>
              <div className="tank-scale" style={{ bottom: '25%' }}>2.5k</div>
            </div>
            <div className="tank-level-badge">{fillPercentage}% Filled</div>
          </div>

          {/* Stats Details Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Remaining Fuel Level
              </span>
              <div style={{ fontSize: '28px', fontFamily: 'Outfit', fontWeight: 800, color: isLow ? 'var(--failed)' : 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                {stats.remaining.toLocaleString()}
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>Litre</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Filled</span>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '2px' }}>
                  <ArrowUp size={12} /> {stats.totalRefills.toLocaleString()} L
                </div>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Dispensed</span>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '2px' }}>
                  <ArrowDown size={12} /> {stats.totalDispensed.toLocaleString()} L
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alarm Warning Card */}
        {isLow && (
          <div className="pulse-alert-card">
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>Low Fuel Warning!</strong>
              <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>
                Level has fallen below 1000L ({stats.remaining.toLocaleString()}L remaining). Please arrange a tanker refill.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Refill Log Form */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} style={{ color: 'var(--success)' }} />
          Record Tanker Refill Event
        </h2>

        <form onSubmit={handleSubmit} className="form-section">
          
          <div className="form-group">
            <label htmlFor="refill-date">Refill Date</label>
            <input 
              type="date" 
              id="refill-date" 
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="refill-volume">Volume Input (Litres)</label>
            <input 
              type="number" 
              id="refill-volume" 
              step="0.01" 
              className="form-input"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="e.g. 5000"
              min="0.1"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="refill-notes">Delivery & Supplier Notes</label>
            <textarea
              id="refill-notes"
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Supplier Name, invoice ID, fuel delivery notes..."
              rows="2"
            />
          </div>

          {formFeedback && (
            <div 
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

          <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.2)' }}>
            <Save size={18} />
            Log Tanker Refill
          </button>
        </form>
      </div>

      {/* Refills Log History */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Refill Log History</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{refills.length} logs</span>
        </h2>

        {refills.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px' }}>
            <Database size={24} />
            <p style={{ fontSize: '12px' }}>No tank refills logged yet. To set an initial level, log a refill.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxEntries: 10, overflowY: 'auto', maxHeight: '300px' }}>
            {refills.map((refill) => (
              <div 
                key={refill.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--glass-border)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: refill.notes && refill.notes.startsWith("ADMIN RESET") ? 'var(--failed)' : 'var(--success)' }}>
                    {refill.notes && refill.notes.startsWith("ADMIN RESET") ? `Reset to: ${refill.volume.toLocaleString()} L` : `+${refill.volume.toLocaleString()} L`}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} /> {refill.date}
                  </div>
                  {refill.notes && !refill.notes.startsWith("ADMIN RESET") && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                      "{refill.notes}"
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => handleDelete(refill.id, refill.volume)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--failed)',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '50%',
                    transition: 'var(--transition-smooth)'
                  }}
                  className="btn-delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Reset Modal */}
      {showResetModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '400px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'relative',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle style={{ color: 'var(--failed)' }} size={20} />
              Admin Tank Level Reset
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
              Please enter the admin password and the target fuel volume to reset the local storage tank.
            </p>

            <form onSubmit={handleAdminResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label htmlFor="admin-pass">Admin Password</label>
                <input 
                  type="password" 
                  id="admin-pass" 
                  className="form-input"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reset-vol">Reset Target Volume (Litres)</label>
                <input 
                  type="number" 
                  id="reset-vol" 
                  step="0.01"
                  className="form-input"
                  value={resetVolume}
                  onChange={(e) => setResetVolume(e.target.value)}
                  placeholder="e.g. 10000"
                  min="0"
                  required
                />
              </div>

              {modalFeedback && (
                <div style={{ 
                  padding: '10px', 
                  borderRadius: '6px', 
                  fontSize: '12px',
                  backgroundColor: modalFeedback.type === 'success' ? 'var(--success-bg)' : 'var(--failed-bg)',
                  color: modalFeedback.type === 'success' ? 'var(--success)' : 'var(--failed)',
                  border: `1px solid ${modalFeedback.type === 'success' ? 'var(--success-border)' : 'var(--failed-border)'}`
                }}>
                  {modalFeedback.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer' }}
                  onClick={() => {
                    setShowResetModal(false);
                    setAdminPassword('');
                    setResetVolume('');
                    setModalFeedback(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ 
                    flex: 1, 
                    padding: '10px', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', 
                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.2)' 
                  }}
                >
                  Confirm Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Local encapsulating styling */}
      <style>{`
        .tank-cylinder {
          position: relative;
          width: 80px;
          height: 120px;
          background: rgba(15, 23, 42, 0.05);
          border: 2px solid var(--text-secondary);
          border-radius: 12px 12px 14px 14px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          overflow: hidden;
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05);
        }
        
        body.dark-mode .tank-cylinder {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--glass-border);
        }
        
        .tank-cap {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 4px;
          background: var(--text-secondary);
          border-radius: 2px 2px 0 0;
        }

        .tank-body {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .tank-liquid {
          width: 100%;
          background: linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%);
          transition: height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
        }

        .tank-liquid.low {
          background: linear-gradient(180deg, #ef4444 0%, #b91c1c 100%);
        }

        .wave-overlay {
          position: absolute;
          top: -4px;
          left: 0;
          right: 0;
          height: 8px;
          background-image: radial-gradient(circle at 50% 100%, transparent 4px, currentColor 4px);
          background-size: 16px 8px;
          color: #3b82f6;
          animation: wave 1.2s linear infinite;
        }

        .tank-liquid.low .wave-overlay {
          color: #ef4444;
        }

        @keyframes wave {
          0% { background-position-x: 0px; }
          100% { background-position-x: 16px; }
        }

        .tank-glass-sheen {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 80%, rgba(255,255,255,0.1) 100%);
          pointer-events: none;
        }

        .tank-scale {
          position: absolute;
          left: 6px;
          font-size: 8px;
          font-weight: 700;
          color: var(--text-muted);
          opacity: 0.7;
          border-bottom: 1px solid var(--text-muted);
          width: 16px;
          padding-bottom: 1px;
        }

        .tank-level-badge {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(15, 23, 42, 0.8);
          color: #fff;
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 10px;
          white-space: nowrap;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          pointer-events: none;
          z-index: 2;
        }

        .pulse-alert-card {
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          background-color: var(--failed-bg);
          border: 1px solid var(--failed-border);
          color: var(--failed);
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 10px;
          line-height: 1.35;
          animation: alertPulse 2s infinite ease-in-out;
        }

        @keyframes alertPulse {
          0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
          100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
        }

        .btn-delete:hover {
          background-color: rgba(220, 38, 38, 0.1);
        }
      `}</style>
    </div>
  );
}

export default LocalTankTab;
