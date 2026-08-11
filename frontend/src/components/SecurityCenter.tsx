import React from "react";
import { ShieldCheck, Lock, ShieldAlert, Key, Clock, Settings, Shield } from "lucide-react";

interface AuditLog {
  timestamp: string;
  action: string;
  status: string;
  details: string;
}

interface SecurityCenterProps {
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
}

export default function SecurityCenter({ securityData }: SecurityCenterProps) {
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

  const checklist = [
    { key: "encryption", label: "Wallet Encryption", desc: "Private keys are encrypted at rest with AES-256-GCM using derived keys", val: status.wallet_encryption, ok: true },
    { key: "pin", label: "PIN Hashing", desc: "Secure passwords and transactions PINs hashed with Bcrypt/Argon2", val: status.pin_hashing, ok: true },
    { key: "rate", label: "API Rate Limiting", desc: "Global and route-based client connection limits prevent brute force", val: status.rate_limiting, ok: true },
    { key: "replay", label: "Replay & Nonce Checks", desc: "x402 payment nonces are stored and checked to avoid duplicate spends", val: status.replay_protection, ok: true },
    { key: "network", label: "Network Configuration", desc: "Current Horizon gateway bound only to SDF Test Network keys", val: status.stellar_testnet, ok: true }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
      {/* Interactive security checklist (1 col) */}
      <div className="glass-panel p-8 rounded-2xl border-slate-800 space-y-6 lg:col-span-1 h-fit">
        <div>
          <h2 className="text-lg font-bold">Security Guardrails</h2>
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

      {/* Audit Trail list (2 cols) */}
      <div className="lg:col-span-2 glass-panel p-8 rounded-2xl border-slate-800 flex flex-col space-y-6">
        <div>
          <h2 className="text-lg font-bold flex items-center space-x-2">
            <Lock className="h-5 w-5 text-indigo-400" />
            <span>Chronological Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-400">Verifiable logging of all authentication, wallet modifications, and agent executions.</p>
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
  );
}
