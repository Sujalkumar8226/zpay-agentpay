import React from "react";
import { Clock, Shield, ShieldAlert } from "lucide-react";

interface AuditLog {
  timestamp: string;
  action: string;
  status: string;
  details: string;
}

interface AuditLogsProps {
  audit_logs: AuditLog[];
}

export default function AuditLogs({ audit_logs = [] }: AuditLogsProps) {
  return (
    <div className="space-y-8 text-left">
      <div>
        <h1 className="text-xl font-bold flex items-center space-x-2 text-indigo-400">
          <Clock className="h-5 w-5" />
          <span>Security Audit Trails</span>
        </h1>
        <p className="text-xs text-slate-400">Chronological logging of all policy executions, manual overrides, and agent wallet setups.</p>
      </div>

      <div className="glass-panel p-8 rounded-2xl border-slate-800 flex flex-col space-y-6">
        <div className="overflow-y-auto space-y-3 max-h-[580px] pr-2">
          {audit_logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-32 space-y-2">
              <Shield className="h-10 w-10 text-slate-700" />
              <span className="text-xs italic">No security logs recorded yet.</span>
            </div>
          ) : (
            audit_logs.map((log, idx) => {
              const isFailure = log.status === "FAILURE" || log.status === "BLOCKED";
              return (
                <div key={idx} className="flex justify-between items-start py-3.5 border-b border-slate-900 last:border-0 hover:bg-slate-950/20 px-2.5 rounded-lg transition duration-200">
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-2.5 rounded-xl mt-0.5 border ${
                      isFailure 
                        ? "bg-rose-600/10 border-rose-500/20 text-rose-400" 
                        : "bg-slate-900 border-slate-850 text-slate-300"
                    }`}>
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">{log.action.replace(/_/g, " ")}</div>
                      <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">{log.details}</p>
                    </div>
                  </div>
                  <div className="text-right pl-4">
                    <span className={`text-[8px] font-black uppercase px-2.5 py-0.5 rounded border 
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
