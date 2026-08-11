import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config";
import { ShieldCheck, Lock, ShieldAlert, Clock, Shield, RefreshCw } from "lucide-react";

interface AuditLog {
  timestamp: string;
  action: string;
  status: string;
  details: string;
}

interface SecurityCenterProps {
  token: string;
  securityData: {
    status: {
      wallet_encryption: string;
      pin_hashing: string;
      rate_limiting: string;
      replay_protection: string;
      stellar_testnet: string;
    };
    audit_logs: AuditLog[];
  };
  refreshData: () => void;
}

export default function SecurityCenter({ token, securityData, refreshData }: SecurityCenterProps) {
  const {
    status = {
      wallet_encryption: "AES-256-GCM (Enforced)",
      pin_hashing: "Bcrypt active",
      rate_limiting: "Enabled (100 req/min)",
      replay_protection: "Nonce verification active",
      stellar_testnet: "Active"
    },
    audit_logs = []
  } = securityData;

  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [loading, setLoading] = useState(false);

  // Poll kill switch state
  const checkKillSwitch = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/security/kill-switch`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setKillSwitchActive(res.data.kill_switch_active);
    } catch (e) {
      console.error("Error fetching kill switch state", e);
    }
  };

  useEffect(() => {
    checkKillSwitch();
    const interval = setInterval(checkKillSwitch, 4000);
    return () => clearInterval(interval);
  }, [token]);

  const toggleKillSwitch = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/security/kill-switch/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setKillSwitchActive(res.data.kill_switch_active);
      refreshData();
    } catch (e: any) {
      alert("Error toggling emergency kill switch: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const checklist = [
    { key: "encryption", label: "Wallet Encryption", desc: "Private keys are encrypted at rest with AES-256-GCM using derived keys", val: status.wallet_encryption, ok: true },
    { key: "pin", label: "PIN Hashing", desc: "Secure passwords and transactions PINs hashed with Bcrypt/Argon2", val: status.pin_hashing, ok: true },
    { key: "rate", label: "API Rate Limiting", desc: "Global and route-based client connection limits prevent brute force", val: status.rate_limiting, ok: true },
    { key: "replay", label: "Replay & Nonce Checks", desc: "x402 payment nonces are stored and checked to avoid duplicate spends", val: status.replay_protection, ok: true },
    { key: "network", label: "Network Configuration", desc: "Current Horizon gateway bound only to SDF Test Network keys", val: status.stellar_testnet, ok: true }
  ];

  return (
    <div className="space-y-8 text-left">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold flex items-center space-x-2 text-indigo-400">
          <Shield className="h-5 w-5" />
          <span>Firewall & Security Center</span>
        </h1>
        <p className="text-xs text-slate-400">Manage security settings, audit logs, and the global payment controls.</p>
      </div>

      {/* EMERGENCY KILL SWITCH PANEL */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition duration-500 relative overflow-hidden
        ${killSwitchActive 
          ? "bg-rose-500/10 border-rose-500/30 glow-rose text-rose-200" 
          : "bg-slate-900/60 border-slate-800 text-slate-200"
        }
      `}>
        <div className="space-y-2 text-left relative z-10">
          <div className="flex items-center space-x-2">
            <ShieldAlert className={`h-5.5 w-5.5 ${killSwitchActive ? "text-rose-500 animate-bounce" : "text-slate-400"}`} />
            <h3 className="font-extrabold text-sm uppercase tracking-wider">
              {killSwitchActive ? "Global Spend Kill Switch ENABLED" : "Global Spend Kill Switch"}
            </h3>
          </div>
          <p className="text-xs text-slate-400 max-w-xl leading-normal">
            When enabled, ZPay Sentinel blocks every outbound agent payment request immediately. Enforce this during anomalous traffic or server-side exploits.
          </p>
        </div>

        <button
          onClick={toggleKillSwitch}
          disabled={loading}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md flex items-center space-x-2 cursor-pointer disabled:opacity-50 z-10
            ${killSwitchActive 
              ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20" 
              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            }
          `}
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <span>{killSwitchActive ? "Turn OFF Kill Switch" : "ACTIVATE KILL SWITCH"}</span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Security Checklist */}
        <div className="glass-panel p-8 rounded-2xl border-slate-800 space-y-6 lg:col-span-1 h-fit">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Cryptographical Guards</h2>
            <p className="text-xs text-slate-400">Review the status of cryptographical controls active on the platform.</p>
          </div>

          <div className="space-y-4">
            {checklist.map((item) => (
              <div key={item.key} className="flex items-start space-x-3.5 p-3 rounded-xl hover:bg-slate-900/40 border border-transparent hover:border-slate-900 transition duration-300">
                <div className="bg-emerald-600/10 text-emerald-400 p-2 rounded-xl mt-0.5 border border-emerald-500/10">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-200">{item.label}</div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{item.desc}</p>
                  <span className="inline-block text-[9px] font-mono text-indigo-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-900 mt-1">
                    {item.val}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Trail list */}
        <div className="lg:col-span-2 glass-panel p-8 rounded-2xl border-slate-800 flex flex-col space-y-6">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-2">
              <Lock className="h-4.5 w-4.5 text-indigo-400" />
              <span>Chronological Security Audits</span>
            </h2>
            <p className="text-xs text-slate-400">Verifiable logging of all authentication, wallet modifications, and agent policies.</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-[460px] pr-2">
            {audit_logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-20 space-y-2">
                <Shield className="h-10 w-10 text-slate-700" />
                <span className="text-xs italic">No security logs recorded yet.</span>
              </div>
            ) : (
              audit_logs.map((log, idx) => {
                const isFailure = log.status === "FAILURE" || log.status === "BLOCKED";
                return (
                  <div key={idx} className="flex justify-between items-start py-3 border-b border-slate-900 last:border-0 hover:bg-slate-950/20 px-2 rounded-lg transition duration-200">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-xl mt-0.5 border ${
                        isFailure 
                          ? "bg-rose-600/10 border-rose-500/20 text-rose-400" 
                          : "bg-slate-900 border-slate-850 text-slate-300"
                      }`}>
                        <Clock className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">{log.action.replace(/_/g, " ")}</div>
                        <p className="text-xs text-slate-400 mt-1 max-w-[420px]">{log.details}</p>
                      </div>
                    </div>
                    <div className="text-right pl-4">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border 
                        ${isFailure ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}
                      `}>
                        {log.status}
                      </span>
                      <div className="text-[9px] text-slate-500 mt-2 font-mono">{log.timestamp}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
