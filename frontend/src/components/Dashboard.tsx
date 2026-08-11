import React from "react";
import { DollarSign, Cpu, ArrowUpRight, ArrowDownLeft, Zap, ShieldCheck, XCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardProps {
  analyticsData: {
    wallet_balance_xlm: number;
    agent_total_spent_xlm: number;
    successful_payments: number;
    blocked_payments: number;
    pending_payments?: number;
    prevented_spending_xlm?: number;
    average_risk_score?: number;
    gas_sponsored_xlm: number;
    spending_chart: Array<{ day: string; amount: number }>;
    recent_transactions: Array<{
      tx_hash: string;
      amount: number;
      sender: string;
      receiver: string;
      memo: string;
      created_at: string;
    }>;
  };
}

export default function Dashboard({ analyticsData }: DashboardProps) {
  const {
    wallet_balance_xlm = 0.0,
    agent_total_spent_xlm = 0.0,
    successful_payments = 0,
    blocked_payments = 0,
    pending_payments = 0,
    prevented_spending_xlm = 0.0,
    average_risk_score = 0.0,
    gas_sponsored_xlm = 0.0,
    spending_chart = [],
    recent_transactions = []
  } = analyticsData;

  const totalSpentUSD = agent_total_spent_xlm.toFixed(2);
  const preventedSpentUSD = prevented_spending_xlm.toFixed(2);
  const walletBalUSD = (wallet_balance_xlm * 0.12).toFixed(2);

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex justify-between items-center border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-xl font-bold text-indigo-400">Sentinel Control Dashboard</h1>
          <p className="text-xs text-slate-400">Real-time payment filtering, spend policies evaluation, and security status.</p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-2xl border-slate-800 relative">
          <div className="absolute top-4 right-4 text-indigo-400 bg-indigo-500/10 p-2 rounded-xl">
            <DollarSign className="h-5 w-5" />
          </div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Custodial Balance</div>
          <div className="text-2xl font-bold mt-2">
            {wallet_balance_xlm.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} XLM
          </div>
          <div className="text-xs text-indigo-400 mt-1">~${walletBalUSD} USD (Stellar)</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border-slate-800 relative">
          <div className="absolute top-4 right-4 text-cyan-400 bg-cyan-500/10 p-2 rounded-xl">
            <Cpu className="h-5 w-5" />
          </div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent Sandbox Spending</div>
          <div className="text-2xl font-bold mt-2">
            {agent_total_spent_xlm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
          </div>
          <div className="text-xs text-cyan-400 mt-1">Simulated payments settled</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border-slate-800 relative">
          <div className="absolute top-4 right-4 text-emerald-400 bg-emerald-500/10 p-2 rounded-xl">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prevented Spending</div>
          <div className="text-2xl font-bold mt-2">
            {prevented_spending_xlm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
          </div>
          <div className="text-xs text-emerald-400 mt-1">{blocked_payments} policy violations blocked</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border-slate-800 relative">
          <div className="absolute top-4 right-4 text-amber-400 bg-amber-500/10 p-2 rounded-xl">
            <Zap className="h-5 w-5" />
          </div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Risk Score</div>
          <div className="text-2xl font-bold mt-2">
            {average_risk_score.toFixed(1)}/100
          </div>
          <div className="text-xs text-amber-400 mt-1">Sentinel firewall metrics</div>
        </div>
      </div>

      {/* Main Charts & History Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Column */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border-slate-800 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold">Spending Activity</h2>
              <p className="text-xs text-slate-400">Agent payments settled over the current billing cycle.</p>
            </div>
            <span className="text-xs bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-slate-400">USDC / XLM</span>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spending_chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="day" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#111827", borderColor: "#1E293B", color: "#F8FAFC", borderRadius: "8px" }} 
                  labelStyle={{ fontWeight: "bold" }}
                />
                <Area type="monotone" dataKey="amount" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSpent)" name="Spent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transaction History Column */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800 flex flex-col space-y-6">
          <div>
            <h2 className="text-lg font-bold">Recent Micropayments</h2>
            <p className="text-xs text-slate-400">Real-time ledger audit trail.</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 max-h-[280px] pr-2">
            {recent_transactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-10 space-y-2">
                <ShieldCheck className="h-8 w-8 text-slate-600" />
                <span className="text-xs">No micropayments recorded yet</span>
              </div>
            ) : (
              recent_transactions.map((tx, idx) => (
                <div key={idx} className="flex justify-between items-center py-2.5 border-b border-slate-900 last:border-0">
                  <div className="flex items-center space-x-3">
                    <div className="bg-indigo-600/10 text-indigo-400 p-2 rounded-xl">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{tx.memo || "API Micropayment"}</div>
                      <div className="text-[10px] text-slate-400">Tx: {tx.tx_hash}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-400">-{tx.amount} XLM</div>
                    <div className="text-[10px] text-slate-500">{tx.created_at}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
