import React, { useState, useEffect } from "react";
import axios from "axios";
import { Settings, CheckCircle, XCircle, ShieldAlert, Cpu } from "lucide-react";

interface Agent {
  id: number;
  name: string;
  zpay_id: string;
  policy: {
    daily_limit: number;
    transaction_limit: number;
    approval_threshold: number;
    allowed_categories: string[];
    blocked_categories: string[];
  };
}

interface SpendPoliciesProps {
  token: string;
  agents: Agent[];
  refreshData: () => void;
}

export default function SpendPolicies({ token, agents, refreshData }: SpendPoliciesProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);

  // Policy input states
  const [dailyLimit, setDailyLimit] = useState(10.0);
  const [txLimit, setTxLimit] = useState(1.0);
  const [approvalThreshold, setApprovalThreshold] = useState(50.0);
  const [allowedMerchants, setAllowedMerchants] = useState<string[]>([]);
  const [blockedMerchants, setBlockedMerchants] = useState<string[]>([]);
  
  // Custom merchant input text
  const [newAllowed, setNewAllowed] = useState("");
  const [newBlocked, setNewBlocked] = useState("");

  useEffect(() => {
    if (agents.length > 0 && selectedAgentId === null) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  const activeAgent = agents.find((a) => a.id === selectedAgentId);

  useEffect(() => {
    if (activeAgent) {
      setDailyLimit(activeAgent.policy.daily_limit);
      setTxLimit(activeAgent.policy.transaction_limit);
      
      let threshold = activeAgent.policy.approval_threshold;
      if (threshold < 1.0) {
        threshold = threshold * 100.0;
      }
      setApprovalThreshold(threshold);
      setAllowedMerchants(activeAgent.policy.allowed_categories || []);
      setBlockedMerchants(activeAgent.policy.blocked_categories || []);
    }
  }, [activeAgent]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) return;

    try {
      // API call to update policy
      await axios.patch(
        `http://localhost:8000/api/agents/${selectedAgentId}/policy`,
        {
          daily_limit: dailyLimit,
          transaction_limit: txLimit,
          approval_threshold: approvalThreshold / 100.0, // Convert back to float for database compatibility
          allowed_categories: allowedMerchants,
          blocked_categories: blockedMerchants
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert("Spend policy committed successfully!");
      refreshData();
    } catch (e: any) {
      alert("Error updating policy: " + (e.response?.data?.detail || e.message));
    }
  };

  const addAllowedMerchant = () => {
    if (!newAllowed.trim()) return;
    const name = newAllowed.trim().toLowerCase();
    if (!allowedMerchants.includes(name)) {
      setAllowedMerchants([...allowedMerchants, name]);
      // Remove from blocked if present
      setBlockedMerchants(blockedMerchants.filter((m) => m !== name));
    }
    setNewAllowed("");
  };

  const addBlockedMerchant = () => {
    if (!newBlocked.trim()) return;
    const name = newBlocked.trim().toLowerCase();
    if (!blockedMerchants.includes(name)) {
      setBlockedMerchants([...blockedMerchants, name]);
      // Remove from allowed if present
      setAllowedMerchants(allowedMerchants.filter((m) => m !== name));
    }
    setNewBlocked("");
  };

  const removeAllowed = (name: string) => {
    setAllowedMerchants(allowedMerchants.filter((m) => m !== name));
  };

  const removeBlocked = (name: string) => {
    setBlockedMerchants(blockedMerchants.filter((m) => m !== name));
  };

  return (
    <div className="space-y-8 text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center space-x-2 text-indigo-400">
            <Settings className="h-5 w-5" />
            <span>Centralized Spend Policies</span>
          </h1>
          <p className="text-xs text-slate-400">Define transaction velocity limits, allowed merchants, and threshold rules.</p>
        </div>

        {agents.length > 0 && (
          <select
            value={selectedAgentId || ""}
            onChange={(e) => setSelectedAgentId(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-auto"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.zpay_id})
              </option>
            ))}
          </select>
        )}
      </div>

      {activeAgent ? (
        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main limits configuration card */}
          <div className="lg:col-span-2 glass-panel p-8 rounded-2xl border-slate-800 space-y-6 h-fit">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Spend Limits & Guardrails</h3>
              <p className="text-xs text-slate-400 mt-1">Configure transaction and budget limits for the agent wallet.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Max Per-Transaction (USDC)</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={txLimit}
                  onChange={(e) => setTxLimit(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Daily Spending Budget (USDC)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Risk Score Threshold (0-100)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={approvalThreshold}
                  onChange={(e) => setApprovalThreshold(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Requires manual auth if risk score is higher</span>
              </div>
            </div>

            {/* Merchant Allowlist configure */}
            <div className="space-y-4 pt-4 border-t border-slate-900">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Allowed Merchants List (Allowlist)</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Explicitly permitted service/merchant names (e.g. weather-api, research-api).</p>
              </div>

              <div className="flex gap-2 max-w-md">
                <input
                  type="text"
                  placeholder="e.g. weather-api"
                  value={newAllowed}
                  onChange={(e) => setNewAllowed(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-800"
                />
                <button
                  type="button"
                  onClick={addAllowedMerchant}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Add Permitted
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {allowedMerchants.length === 0 ? (
                  <span className="text-xs italic text-slate-600">No specific allowed merchants. All merchants evaluated by risk score only.</span>
                ) : (
                  allowedMerchants.map((merchant) => (
                    <span key={merchant} className="flex items-center space-x-1.5 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full">
                      <CheckCircle className="h-3 w-3" />
                      <span>{merchant}</span>
                      <button type="button" onClick={() => removeAllowed(merchant)} className="hover:text-white cursor-pointer ml-1 text-[10px]">×</button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Merchant Blocklist configure */}
            <div className="space-y-4 pt-4 border-t border-slate-900">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Blocked Merchants List (Blocklist)</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Explicitly prohibited service names (evaluates immediately to DENIED).</p>
              </div>

              <div className="flex gap-2 max-w-md">
                <input
                  type="text"
                  placeholder="e.g. gambling-api"
                  value={newBlocked}
                  onChange={(e) => setNewBlocked(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-800"
                />
                <button
                  type="button"
                  onClick={addBlockedMerchant}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Add Blocked
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {blockedMerchants.length === 0 ? (
                  <span className="text-xs italic text-slate-600">No specific merchants blocked.</span>
                ) : (
                  blockedMerchants.map((merchant) => (
                    <span key={merchant} className="flex items-center space-x-1.5 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-1 rounded-full">
                      <XCircle className="h-3 w-3" />
                      <span>{merchant}</span>
                      <button type="button" onClick={() => removeBlocked(merchant)} className="hover:text-white cursor-pointer ml-1 text-[10px]">×</button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Commit policy button */}
            <div className="pt-6 border-t border-slate-900">
              <button
                type="submit"
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition duration-300 cursor-pointer shadow-md shadow-indigo-500/10"
              >
                Commit Policy Guardrails
              </button>
            </div>

          </div>

          {/* Right hand side metadata */}
          <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-6 h-fit">
            <div>
              <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-widest">Active Policy Profile</span>
              <h3 className="text-base font-bold text-slate-100 mt-1 flex items-center space-x-2">
                <Cpu className="h-4.5 w-4.5 text-indigo-400" />
                <span>{activeAgent.name}</span>
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="border-b border-slate-900 pb-3">
                <span className="text-slate-500 block">Agent Address</span>
                <span className="font-mono text-slate-400 break-all text-[10px] block mt-1 bg-slate-950 p-2 rounded border border-slate-900">
                  {activeAgent.zpay_id}
                </span>
              </div>

              <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-2 flex items-start space-x-2 text-[11px] text-slate-400">
                <ShieldAlert className="h-4.5 w-4.5 text-indigo-400 mt-0.5 shrink-0" />
                <p className="leading-normal">
                  Commiting policy parameters changes them on the ZPay Sentinel firewall immediately. Every new autonomous x402 payment request will be verified against these active limits.
                </p>
              </div>
            </div>
          </div>

        </form>
      ) : (
        <div className="text-center py-20 text-slate-500 italic">Please build an AI Agent first to edit spending policies.</div>
      )}
    </div>
  );
}
