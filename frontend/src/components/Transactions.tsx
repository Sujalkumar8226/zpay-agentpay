import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config";
import { CreditCard, CheckCircle, XCircle, Clock, Search, RefreshCw } from "lucide-react";

interface TransactionItem {
  id: number;
  agent_name: string;
  merchant: string;
  amount: number;
  asset: string;
  decision: "APPROVED" | "BLOCKED" | "PENDING_APPROVAL";
  status: string;
  tx_hash: string;
  risk_score: number;
  timestamp: string;
  reason: string;
}

interface TransactionsProps {
  token: string;
}

export default function Transactions({ token }: TransactionsProps) {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "APPROVED" | "BLOCKED" | "PENDING_APPROVAL">("ALL");
  const [search, setSearch] = useState("");

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(res.data);
    } catch (e: any) {
      console.error("Error loading transactions", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [token]);

  // Apply filters
  const filtered = transactions.filter((tx) => {
    const matchesFilter = filter === "ALL" || tx.decision === filter;
    const matchesSearch = 
      tx.agent_name.toLowerCase().includes(search.toLowerCase()) ||
      tx.merchant.toLowerCase().includes(search.toLowerCase()) ||
      tx.reason.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 text-left">
      <div className="flex justify-between items-center border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center space-x-2 text-indigo-400">
            <CreditCard className="h-5 w-5" />
            <span>Sentinel Transaction History</span>
          </h1>
          <p className="text-xs text-slate-400">Complete historical record of payment decisions, risk grades, and sandbox settlements.</p>
        </div>

        <button 
          onClick={fetchTransactions}
          disabled={loading}
          className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg cursor-pointer transition disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filter tools */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        {/* Tab Filters */}
        <div className="flex bg-slate-900/60 p-1 border border-slate-900 rounded-xl space-x-1 w-full md:w-auto text-xs">
          {["ALL", "APPROVED", "BLOCKED", "PENDING_APPROVAL"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg font-semibold transition cursor-pointer flex-1 md:flex-initial ${
                filter === f ? "bg-indigo-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by Agent, Merchant, or Reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-880 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 text-white placeholder-slate-700"
          />
        </div>
      </div>

      {/* Transactions Table/Cards */}
      <div className="glass-panel rounded-2xl border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-4">Timestamp</th>
                <th className="p-4">AI Agent</th>
                <th className="p-4">Merchant / API</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Risk Grade</th>
                <th className="p-4">Decision</th>
                <th className="p-4">Firewall Reason / Tx Hash</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                    {loading ? "Loading transactions..." : "No transactions found matching your criteria."}
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const isBlocked = tx.decision === "BLOCKED";
                  const isPending = tx.decision === "PENDING_APPROVAL";
                  return (
                    <tr key={tx.id} className="border-b border-slate-900 hover:bg-slate-950/20 transition last:border-0">
                      <td className="p-4 text-slate-400 font-mono">{tx.timestamp}</td>
                      <td className="p-4 font-bold text-slate-200">{tx.agent_name}</td>
                      <td className="p-4 font-semibold text-indigo-300">{tx.merchant}</td>
                      <td className="p-4 font-black text-slate-200">-{tx.amount.toFixed(2)} {tx.asset}</td>
                      <td className="p-4">
                        <span className={`font-mono font-bold ${
                          tx.risk_score >= 80 ? "text-rose-500" : (tx.risk_score >= 50 ? "text-amber-400" : "text-emerald-400")
                        }`}>
                          {tx.risk_score}/100
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded border inline-flex items-center space-x-1
                          ${isBlocked ? "bg-rose-500/10 text-rose-400 border-rose-500/25" : ""}
                          ${isPending ? "bg-amber-500/10 text-amber-400 border-amber-500/25 animate-pulse" : ""}
                          ${tx.decision === "APPROVED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" : ""}
                        `}>
                          {isBlocked ? <XCircle className="h-3 w-3 inline" /> : null}
                          {isPending ? <Clock className="h-3 w-3 inline" /> : null}
                          {tx.decision === "APPROVED" ? <CheckCircle className="h-3 w-3 inline" /> : null}
                          <span className="ml-1">{tx.decision.replace("_", " ")}</span>
                        </span>
                      </td>
                      <td className="p-4 max-w-xs leading-normal">
                        {isBlocked ? (
                          <span className="text-slate-400 text-[11px] block italic">{tx.reason}</span>
                        ) : (
                          <div>
                            <span className="text-[10px] text-slate-400 block break-all font-mono bg-slate-950/60 p-1.5 rounded border border-slate-900">
                              {tx.tx_hash}
                            </span>
                            {isPending && <span className="text-[10px] text-amber-500 mt-1 block italic">{tx.reason}</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
