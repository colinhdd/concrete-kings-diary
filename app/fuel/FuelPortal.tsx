"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Fuel, History, Database, Wifi, WifiOff, RefreshCw, Moon, Sun, ShieldCheck } from 'lucide-react';
import DailyFillForm from '@/components/fuel/DailyFillForm';
import QueueHistory from '@/components/fuel/QueueHistory';
import LocalTankTab from '@/components/fuel/LocalTankTab';
import { 
  getPendingEntries, 
  updateEntryStatus, 
  getEntries, 
  getAllSettings, 
  getTankRefills, 
  calculateRemainingFuel, 
  getPendingTankRefills, 
  updateTankRefillStatus, 
  pullRemoteData 
} from '@/lib/db-fuel';

function FuelPortal() {
  const [activeTab, setActiveTab] = useState('fill');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [remainingFuel, setRemainingFuel] = useState<number | null>(null);
  const [theme, setTheme] = useState('light');

  // Load stats
  const loadStats = useCallback(async () => {
    const activeSettings = await getAllSettings();
    setSettings(activeSettings);
    
    const pending = await getPendingEntries();
    setPendingCount(pending.length);

    const fuel = await calculateRemainingFuel();
    setRemainingFuel(fuel);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats, refreshTrigger]);

  // Sync logic to Next.js API backend
  const triggerSync = useCallback(async () => {
    if (syncing) return;
    if (!navigator.onLine) return;

    setSyncing(true);
    try {
      // 1. Pull remote refills & logs first to synchronize local DB with other devices
      await pullRemoteData();

      // 2. Sync pending fuel logs
      const pending = await getPendingEntries();
      if (pending.length > 0) {
        const response = await fetch("/api/fuel-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logs: pending }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} syncing fuel logs`);
        }

        const data = await response.json();
        if (data.success) {
          for (const id of data.synced) {
            await updateEntryStatus(id, "synced");
          }
          for (const id of data.skipped) {
            await updateEntryStatus(id, "synced");
          }
        } else {
          throw new Error(data.error || "Fills sync failed");
        }
      }

      // 3. Sync pending tank refills (server handles deduplication via Refill ID)
      const pendingRefills = await getPendingTankRefills();
      if (pendingRefills.length > 0) {
        const tankResponse = await fetch("/api/tank-refill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refills: pendingRefills }),
        });
        
        if (!tankResponse.ok) {
          throw new Error(`HTTP ${tankResponse.status} syncing tank refills`);
        }

        const tankData = await tankResponse.json();
        if (tankData.success) {
          for (const id of tankData.synced) {
            await updateTankRefillStatus(id, "synced");
          }
          for (const id of tankData.skipped) {
            await updateTankRefillStatus(id, "synced");
          }
        }
      }

      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  // Network listeners
  useEffect(() => {
    // Register service worker for offline-first caching
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production" && window.location.hostname !== "localhost") {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .catch((err) => console.warn("[SW] Registration failed:", err));
      } else {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
    }

    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Theme setup
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    // Initial sync
    triggerSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
    triggerSync();
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-title-container">
          <h1 className="header-title">
            Concrete Kings <span>Fuel</span>
          </h1>
          <div className="header-subtitle">
            Attendant Portal
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={toggleTheme} 
            className="btn-secondary" 
            style={{ padding: '8px 12px', borderRadius: '10px' }}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button 
            onClick={handleRefresh} 
            className="btn-secondary" 
            style={{ padding: '8px 12px', borderRadius: '10px' }}
            disabled={syncing}
          >
            <RefreshCw size={16} className={syncing ? 'spin-anim' : ''} />
          </button>
        </div>
      </header>

      {/* Sync Banner */}
      {!isOnline ? (
        <div className="sync-banner offline-pending">
          <WifiOff size={14} />
          <span>Offline mode — {pendingCount} dispatches queued locally</span>
        </div>
      ) : pendingCount > 0 ? (
        <div className="sync-banner offline-pending">
          <RefreshCw size={14} className="spin-anim" />
          <span>Syncing {pendingCount} pending logs to Google Sheets...</span>
        </div>
      ) : (
        <div className="sync-banner online-synced">
          <Wifi size={14} />
          <span>Connected — API Synchronization Active</span>
        </div>
      )}

      {/* Main Content */}
      <main className="screen-wrapper">
        {activeTab === 'fill' && (
          <DailyFillForm 
            onEntrySaved={handleRefresh} 
            settings={settings}
            refreshTrigger={refreshTrigger}
          />
        )}

        {activeTab === 'tank' && (
          <LocalTankTab 
            refreshTrigger={refreshTrigger}
            onUpdate={handleRefresh}
          />
        )}
        
        {activeTab === 'history' && (
          <QueueHistory 
            refreshTrigger={refreshTrigger} 
            onRetrySync={handleRefresh} 
          />
        )}
      </main>

      {/* Nav Bar */}
      <nav className="tab-navbar">
        <button 
          onClick={() => setActiveTab('fill')} 
          className={`tab-button ${activeTab === 'fill' ? 'active' : ''}`}
        >
          <div className="tab-icon-wrapper">
            <Fuel size={22} />
          </div>
          <span>Log Fill</span>
        </button>

        <button 
          onClick={() => setActiveTab('tank')} 
          className={`tab-button ${activeTab === 'tank' ? 'active' : ''}`}
        >
          <div className="tab-icon-wrapper">
            <Database size={22} />
          </div>
          <span>Local Tank</span>
          {remainingFuel !== null && remainingFuel < 1000 && <div className="tab-badge-alert" />}
        </button>

        <button 
          onClick={() => setActiveTab('history')} 
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
        >
          <div className="tab-icon-wrapper">
            <History size={22} />
          </div>
          <span>History</span>
          {pendingCount > 0 && <div className="tab-badge">{pendingCount}</div>}
        </button>
      </nav>

      {/* Footer */}
      <footer style={{
        padding: '1.25rem 2rem',
        marginTop: '2rem',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.8rem',
        color: 'var(--text-muted)'
      }}>
        <ShieldCheck size={16} style={{ color: 'var(--success)' }} />
        <span>Secure Gateway Link Active &bull; CK Fuel Portal &copy; {new Date().getFullYear()}</span>
      </footer>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-anim {
          animation: spin 1.5s linear infinite;
        }
        .tab-badge-alert {
          position: absolute;
          top: 6px;
          right: 32%;
          background: var(--failed);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 1.5px solid var(--bg-primary);
          box-shadow: 0 0 4px var(--failed);
          animation: badgePulse 1.5s infinite ease-in-out;
        }
        @keyframes badgePulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default FuelPortal;
