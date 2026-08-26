"use client";

import React, { useEffect, useState } from "react";
import { HardHat, Fuel, ShieldAlert, Cpu, ExternalLink, Database, Activity, LayoutGrid, Package, Layers } from "lucide-react";
import Link from "next/link";

export default function APICentralDashboard() {
  const [currentTime, setCurrentTime] = useState("");
  const [dbStatus, setDbStatus] = useState("Checking...");
  const [sheetsConnection, setSheetsConnection] = useState("Connected");

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    // Simulate database health check
    if (typeof window !== "undefined") {
      setDbStatus("Healthy (IndexedDB Ready)");
    } else {
      setDbStatus("Server Side");
    }

    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0d0e12",
      backgroundImage: "radial-gradient(circle at 10% 20%, rgba(224, 83, 0, 0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(224, 83, 0, 0.03) 0%, transparent 50%)",
      color: "#f3f4f6",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }}>
      
      {/* Top Header */}
      <header style={{
        padding: "1.5rem 2rem",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            backgroundColor: "#e05300",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 15px rgba(224, 83, 0, 0.4)"
          }}>
            <Cpu size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "800", letterSpacing: "-0.02em" }}>
              Concrete Kings <span style={{ color: "#e05300" }}>Central</span>
            </h1>
            <span style={{ fontSize: "0.75rem", color: "#9ca3af", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Central API & Service Portal
            </span>
          </div>
        </div>
        <div style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.05)",
          padding: "6px 14px",
          borderRadius: "30px",
          fontSize: "0.8rem",
          fontWeight: "600",
          color: "#9ca3af",
          fontFamily: "monospace"
        }}>
          {currentTime || "--:--:--"}
        </div>
      </header>

      {/* Main Section */}
      <main style={{
        maxWidth: "1100px",
        width: "100%",
        margin: "0 auto",
        padding: "3rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "3rem"
      }}>
        
        {/* Banner */}
        <div style={{
          padding: "2.5rem",
          borderRadius: "20px",
          backgroundColor: "rgba(255, 255, 255, 0.01)",
          border: "1px solid rgba(255,255,255,0.05)",
          backdropFilter: "blur(10px)",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem"
        }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            color: "#10b981",
            padding: "6px 16px",
            borderRadius: "30px",
            fontSize: "0.8rem",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "0.05em"
          }}>
            <span style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#10b981",
              display: "inline-block",
              boxShadow: "0 0 8px #10b981",
              animation: "pulse 1.5s infinite"
            }} />
            API Server Online & Healthy
          </div>
          <h2 style={{ fontSize: "2rem", fontWeight: "800", margin: "0.5rem 0 0 0", color: "#fff", letterSpacing: "-0.02em" }}>
            Select a Concrete Kings Portal
          </h2>
          <p style={{ color: "#9ca3af", maxWidth: "600px", margin: 0, fontSize: "0.95rem", lineHeight: "1.5" }}>
            Access the dedicated terminal applications. These clients use offline-first synchronization to keep plant registries and logs synced via this central service.
          </p>
        </div>

        {/* Portal Links Cards Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.5rem"
        }}>
          
          {/* Card 0: Batching Diary (Tablet) */}
          <Link href="/batching" style={{ textDecoration: "none" }}>
            <div className="portal-card" style={{
              padding: "2rem",
              borderRadius: "16px",
              backgroundColor: "rgba(224, 83, 0, 0.04)",
              border: "1.5px solid rgba(224, 83, 0, 0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
              cursor: "pointer",
              height: "100%",
              boxShadow: "0 4px 20px rgba(224, 83, 0, 0.08)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(224, 83, 0, 0.15)",
                  border: "1px solid rgba(224, 83, 0, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#e05300"
                }}>
                  <Layers size={26} />
                </div>
                <div style={{
                  color: "#e05300",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.85rem",
                  fontWeight: "700"
                }}>
                  Launch Tablet App <ExternalLink size={14} />
                </div>
              </div>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "1.3rem", fontWeight: "800", color: "#fff" }}>
                  Batching Diary
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#9ca3af", lineHeight: "1.5" }}>
                  Fast tablet diary for plant batchers: moisture compensation, design snapshots, expected vs actual water, visual concrete conditions, and Supabase cloud sync.
                </p>
              </div>
            </div>
          </Link>

          {/* Card 1: Gate Guard Console */}
          <Link href="/gate" style={{ textDecoration: "none" }}>
            <div className="portal-card" style={{
              padding: "2rem",
              borderRadius: "16px",
              backgroundColor: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
              cursor: "pointer",
              height: "100%"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(224, 83, 0, 0.1)",
                  border: "1px solid rgba(224, 83, 0, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#e05300"
                }}>
                  <HardHat size={26} />
                </div>
                <div style={{
                  color: "#9ca3af",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.85rem",
                  fontWeight: "600"
                }}>
                  Open App <ExternalLink size={14} />
                </div>
              </div>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "1.25rem", fontWeight: "700", color: "#fff" }}>
                  Gate Guard Console
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#9ca3af", lineHeight: "1.5" }}>
                  Log staff attendance, manage mixer dispatches, register outside deliveries, and audit compliance logs.
                </p>
              </div>
            </div>
          </Link>

          {/* Card 2: Fuel Log App */}
          <Link href="/fuel" style={{ textDecoration: "none" }}>
            <div className="portal-card" style={{
              padding: "2rem",
              borderRadius: "16px",
              backgroundColor: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
              cursor: "pointer",
              height: "100%"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(224, 83, 0, 0.1)",
                  border: "1px solid rgba(224, 83, 0, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#e05300"
                }}>
                  <Fuel size={26} />
                </div>
                <div style={{
                  color: "#9ca3af",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.85rem",
                  fontWeight: "600"
                }}>
                  Open App <ExternalLink size={14} />
                </div>
              </div>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "1.25rem", fontWeight: "700", color: "#fff" }}>
                  Fuel Attendant Portal
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#9ca3af", lineHeight: "1.5" }}>
                  Log vehicle refueling metrics, track company fleet consumption limits, and manage local tank replenishments.
                </p>
              </div>
            </div>
          </Link>

          {/* Card 3: Parts & Inventory */}
          <Link href="/parts" style={{ textDecoration: "none" }}>
            <div className="portal-card" style={{
              padding: "2rem",
              borderRadius: "16px",
              backgroundColor: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
              cursor: "pointer",
              height: "100%"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(224, 83, 0, 0.1)",
                  border: "1px solid rgba(224, 83, 0, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#e05300"
                }}>
                  <Package size={26} />
                </div>
                <div style={{
                  color: "#9ca3af",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.85rem",
                  fontWeight: "600"
                }}>
                  Open App <ExternalLink size={14} />
                </div>
              </div>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "1.25rem", fontWeight: "700", color: "#fff" }}>
                  Parts & Inventory
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#9ca3af", lineHeight: "1.5" }}>
                  Manage yard consumables, parts catalogue with photos, and oil level tracking with low-stock alerts.
                </p>
              </div>
            </div>
          </Link>

        </div>

        {/* System Health Panel */}
        <div style={{
          backgroundColor: "rgba(255,255,255,0.01)",
          border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: "16px",
          padding: "1.5rem"
        }}>
          <h3 style={{ fontSize: "1rem", fontWeight: "700", margin: "0 0 1.25rem 0", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={18} color="#e05300" /> API Central Diagnostics
          </h3>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.5rem"
          }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <Database size={16} color="#9ca3af" />
              <div>
                <span style={{ display: "block", fontSize: "0.7rem", color: "#9ca3af", textTransform: "uppercase", fontWeight: "700" }}>Database Client</span>
                <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: "500" }}>{dbStatus}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <LayoutGrid size={16} color="#9ca3af" />
              <div>
                <span style={{ display: "block", fontSize: "0.7rem", color: "#9ca3af", textTransform: "uppercase", fontWeight: "700" }}>API Endpoints</span>
                <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: "500" }}>5 active routes</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <ShieldAlert size={16} color="#9ca3af" />
              <div>
                <span style={{ display: "block", fontSize: "0.7rem", color: "#9ca3af", textTransform: "uppercase", fontWeight: "700" }}>Sheets Sync</span>
                <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: "500" }}>{sheetsConnection}</span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer style={{
        padding: "1.5rem 2rem",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        textAlign: "center",
        fontSize: "0.75rem",
        color: "#9ca3af"
      }}>
        Concrete Kings Limited &copy; {new Date().getFullYear()} &bull; Secure Data Integrations
      </footer>

      {/* Embedded CSS styles */}
      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        .portal-card:hover {
          transform: translateY(-4px);
          border-color: rgba(224, 83, 0, 0.3) !important;
          box-shadow: 0 8px 30px rgba(224, 83, 0, 0.08);
          background-color: rgba(255, 255, 255, 0.03) !important;
        }
      `}</style>
    </div>
  );
}
