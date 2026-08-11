import React from "react";
import { Cpu, DollarSign, Shield, RefreshCw, Lock, Unlock, CheckCircle } from "lucide-react";

interface PaymentTraceProps {
  status: string; // CREATED, PAYMENT_REQUIRED, POLICY_CHECK, RISK_CHECK, APPROVAL_REQUIRED, AUTHORIZED, SUBMITTED, VERIFYING, VERIFIED, RESOURCE_UNLOCKED, COMPLETED, FAILED, DENIED
  serviceName: string;
  cost: number;
  asset: string;
}

export default function PaymentTrace({ status, serviceName, cost, asset }: PaymentTraceProps) {
  const steps = [
    { key: "DISCOVER", label: "Discovering", desc: "Discovering paid API service", icon: Cpu, activeStates: ["CREATED", "PAYMENT_REQUIRED", "POLICY_CHECK", "RISK_CHECK", "APPROVAL_REQUIRED", "AUTHORIZED", "SUBMITTED", "VERIFYING", "VERIFIED", "RESOURCE_UNLOCKED", "COMPLETED"] },
    { key: "402_CHALLENGE", label: "402 Challenge", desc: "HTTP 402 Payment Required received", icon: DollarSign, activeStates: ["PAYMENT_REQUIRED", "POLICY_CHECK", "RISK_CHECK", "APPROVAL_REQUIRED", "AUTHORIZED", "SUBMITTED", "VERIFYING", "VERIFIED", "RESOURCE_UNLOCKED", "COMPLETED"] },
    { key: "POLICY_VERIFY", label: "Policy Verify", desc: "Verifying limits & daily budgets", icon: Shield, activeStates: ["POLICY_CHECK", "RISK_CHECK", "APPROVAL_REQUIRED", "AUTHORIZED", "SUBMITTED", "VERIFYING", "VERIFIED", "RESOURCE_UNLOCKED", "COMPLETED"] },
    { key: "SIGN_PAY", label: "Sign & Submit", desc: "Authorizing Stellar transaction", icon: RefreshCw, activeStates: ["AUTHORIZED", "SUBMITTED", "VERIFYING", "VERIFIED", "RESOURCE_UNLOCKED", "COMPLETED"] },
    { key: "CONFIRM", label: "Ledger Confirm", desc: "Waiting for Stellar consensus", icon: Lock, activeStates: ["SUBMITTED", "VERIFYING", "VERIFIED", "RESOURCE_UNLOCKED", "COMPLETED"] },
    { key: "UNLOCK", label: "Resource Unlock", desc: "API response unlocked", icon: Unlock, activeStates: ["RESOURCE_UNLOCKED", "COMPLETED"] }
  ];

  // Helper to determine step status
  const getStepStatus = (stepActiveStates: string[]) => {
    if (status === "FAILED" || status === "REJECTED" || status === "DENIED") return "failed";
    
    // Check if the current state is in the active list
    const isCurrentActive = stepActiveStates[0] === status;
    const isPastActive = stepActiveStates.includes(status);
    
    if (isCurrentActive) return "processing";
    if (isPastActive) return "completed";
    return "pending";
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border-indigo-500/20 bg-slate-950/80 space-y-6 glow-indigo">
      <div className="flex justify-between items-center pb-3 border-b border-slate-900">
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Active Micropayment Gate</span>
          <h3 className="text-sm font-bold text-slate-200 mt-0.5">{serviceName}</h3>
        </div>
        <div className="text-right">
          <div className="text-sm font-extrabold text-indigo-400">-{cost.toFixed(3)} {asset}</div>
          <div className="text-[9px] text-emerald-400 font-semibold uppercase">Fee Sponsored ✓</div>
        </div>
      </div>

      {/* Grid of Steps */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 relative">
        {steps.map((step, idx) => {
          const stepStatus = getStepStatus(step.activeStates);
          const StepIcon = step.icon;

          return (
            <div key={step.key} className="flex flex-col items-center text-center space-y-2 relative group">
              {/* Connector line (desktop only) */}
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute top-5 left-[60%] right-[-40%] h-0.5 bg-slate-900 z-0" />
              )}

              {/* Icon Bubble */}
              <div 
                className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500 z-10 
                  ${stepStatus === "completed" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : ""}
                  ${stepStatus === "processing" ? "bg-indigo-600/30 border-indigo-500 text-indigo-400 glow-pulse shadow-[0_0_15px_rgba(99,102,241,0.5)]" : ""}
                  ${stepStatus === "pending" ? "bg-slate-900/60 border-slate-800 text-slate-600" : ""}
                  ${stepStatus === "failed" ? "bg-rose-500/20 border-rose-500/50 text-rose-400" : ""}
                `}
              >
                {stepStatus === "completed" && step.key === "UNLOCK" ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <StepIcon className="h-4 w-4" />
                )}
              </div>

              {/* Step Labels */}
              <div>
                <div className={`text-xs font-bold ${
                  stepStatus === "completed" ? "text-emerald-400" : 
                  stepStatus === "processing" ? "text-indigo-400 font-extrabold" : "text-slate-500"
                }`}>
                  {step.label}
                </div>
                <p className="text-[9px] text-slate-500 max-w-[90px] mx-auto hidden md:block">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* State Info */}
      <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-3 flex justify-between items-center text-xs">
        <span className="text-slate-400">Payment Status:</span>
        <span className={`font-bold uppercase tracking-wider px-2 py-0.5 rounded text-[10px] 
          ${status === "RESOURCE_UNLOCKED" || status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-400" : ""}
          ${status === "FAILED" || status === "REJECTED" || status === "DENIED" ? "bg-rose-500/10 text-rose-400" : ""}
          ${status !== "RESOURCE_UNLOCKED" && status !== "COMPLETED" && status !== "FAILED" && status !== "REJECTED" && status !== "DENIED" ? "bg-indigo-500/10 text-indigo-400 animate-pulse" : ""}
        `}>
          {status.replace("_", " ")}
        </span>
      </div>
    </div>
  );
}
