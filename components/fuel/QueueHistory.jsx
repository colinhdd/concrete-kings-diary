import React, { useState, useEffect } from 'react';
import { History, Clock, CheckCircle, AlertCircle, RefreshCw, Trash2, Calendar, FileText, ChevronRight, X } from 'lucide-react';
import { getEntries, deleteEntry, updateEntryStatus } from '@/lib/db-fuel';

function QueueHistory({ refreshTrigger, onRetrySync }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null); // Detail modal

  // Local helper to format Date
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const dbLogs = await getEntries();
      setLogs(dbLogs);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [refreshTrigger]);

  const handleRowClick = (entry) => {
    setSelectedEntry(entry);
  };

  const handleCloseModal = () => {
    setSelectedEntry(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this log from your device memory?')) {
      try {
        await deleteEntry(id);
        setSelectedEntry(null);
        loadLogs();
        if (onRetrySync) onRetrySync(); // Refresh counts in parent
      } catch (err) {
        alert('Failed to delete entry');
      }
    }
  };

  const handleSingleRetry = async (entry) => {
    try {
      await updateEntryStatus(entry.id, 'pending', '');
      setSelectedEntry(null);
      loadLogs();
      if (onRetrySync) onRetrySync(); // Triggers sync engine in App.jsx
    } catch (err) {
      alert('Failed to update sync state');
    }
  };

  // Group logs into Today and Past 7 days
  const groupedLogs = React.useMemo(() => {
    const todayString = getTodayDateString();
    const todayList = [];
    const pastList = [];
    
    logs.forEach((log) => {
      if (log.date === todayString) {
        todayList.push(log);
      } else {
        pastList.push(log);
      }
    });

    return { today: todayList, past: pastList };
  }, [logs]);

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading && logs.length === 0) {
    return <div className="empty-state">Loading history logs...</div>;
  }

  return (
    <div className="queue-container">
      {/* Today's Queue Section */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <div className="queue-section-title">
          <span>Today's Log Queue</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {groupedLogs.today.length} {groupedLogs.today.length === 1 ? 'fill' : 'fills'}
          </span>
        </div>

        {groupedLogs.today.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 10px' }}>
            <Clock size={28} />
            <p style={{ fontSize: '13px' }}>No fuel entries logged today yet.</p>
          </div>
        ) : (
          groupedLogs.today.map((log) => (
            <div 
              key={log.id} 
              className="glass-panel log-item" 
              onClick={() => handleRowClick(log)}
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
            >
              <div className="log-item-left">
                <div className="log-item-title">
                  {log.plate}
                  <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    ({log.vehicleType})
                  </span>
                </div>
                <div className="log-item-subtitle">
                  <span>{formatTimestamp(log.timestamp)}</span>
                  <span className="log-item-dot"></span>
                  {log.odometer ? <span>{parseInt(log.odometer).toLocaleString()} km</span> : <span>No Odo</span>}
                </div>
              </div>

              <div className="log-item-right">
                <div className="log-item-volume">{log.volume} L</div>
                <span className={`badge ${log.status}`}>
                  {log.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Historical Logs Section */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <div className="queue-section-title">
          <span>Past 7 Days History</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {groupedLogs.past.length} rows
          </span>
        </div>

        {groupedLogs.past.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 10px' }}>
            <History size={28} />
            <p style={{ fontSize: '13px' }}>No historical logs available on this device.</p>
          </div>
        ) : (
          groupedLogs.past.slice(0, 20).map((log) => (
            <div 
              key={log.id} 
              className="glass-panel log-item" 
              onClick={() => handleRowClick(log)}
              style={{ background: 'var(--bg-tertiary)', padding: '10px 14px', border: '1px solid var(--glass-border)' }}
            >
              <div className="log-item-left">
                <div className="log-item-title" style={{ fontSize: '14px' }}>
                  {log.plate}
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {log.date}
                  </span>
                </div>
                <div className="log-item-subtitle" style={{ fontSize: '11px' }}>
                  {log.odometer ? <span>{parseInt(log.odometer).toLocaleString()} km</span> : <span>No Odo</span>}
                </div>
              </div>

              <div className="log-item-right">
                <div className="log-item-volume" style={{ fontSize: '14px' }}>{log.volume} L</div>
                <span className={`badge ${log.status}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                  {log.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Glassmorphic Detail modal drawer */}
      {selectedEntry && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div 
            className="glass-panel modal-content" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} style={{ color: 'var(--accent-primary)' }} />
                Fuel Entry Detail
              </h3>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={18} />
              </button>
            </div>
            
            <div className="modal-body">
              {/* Core metrics */}
              <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ textAlign: 'center', flex: 1, borderRight: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Volume</div>
                  <div style={{ fontSize: '20px', fontFamily: 'Outfit', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '4px' }}>{selectedEntry.volume} L</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Odometer</div>
                  <div style={{ fontSize: '20px', fontFamily: 'Outfit', fontWeight: 800, marginTop: '4px' }}>
                    {selectedEntry.odometer ? parseInt(selectedEntry.odometer).toLocaleString() : '—'}
                  </div>
                </div>
              </div>

              {/* Text Specs */}
              <div className="detail-row">
                <span className="detail-label">Licence Plate</span>
                <span className="detail-value">{selectedEntry.plate}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Vehicle Division</span>
                <span className="detail-value">{selectedEntry.vehicleType}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Fuel Type</span>
                <span className="detail-value">{selectedEntry.fuelType}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Morning Date</span>
                <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> {selectedEntry.date}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Logging Time</span>
                <span className="detail-value">{new Date(selectedEntry.timestamp).toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Sync Status</span>
                <span className={`badge ${selectedEntry.status}`}>{selectedEntry.status}</span>
              </div>
              <div className="detail-row" style={{ borderBottom: 'none' }}>
                <span className="detail-label">Sync ID (UUID)</span>
                <span className="detail-value" style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-secondary)' }}>{selectedEntry.id}</span>
              </div>

              {/* Notes */}
              {selectedEntry.notes && (
                <div className="detail-notes">
                  <strong>Attendant Note:</strong> "{selectedEntry.notes}"
                </div>
              )}

              {/* Error messages if failed */}
              {selectedEntry.status === 'failed' && selectedEntry.errorMessage && (
                <div className="detail-error">
                  <strong>Sync Failure Error Payload:</strong>
                  <div style={{ marginTop: '4px', fontStyle: 'italic', fontFamily: 'monospace' }}>"{selectedEntry.errorMessage}"</div>
                </div>
              )}

              {/* Action buttons */}
              <div className="modal-actions">
                {selectedEntry.status !== 'synced' && (
                  <button 
                    onClick={() => handleSingleRetry(selectedEntry)} 
                    className="btn-primary"
                  >
                    <RefreshCw size={14} /> Retry Sync
                  </button>
                )}
                <button 
                  onClick={() => handleDelete(selectedEntry.id)} 
                  className="btn-secondary" 
                  style={{ borderColor: 'rgba(244,63,94,0.3)', color: 'var(--failed)' }}
                >
                  <Trash2 size={14} /> Delete Log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QueueHistory;
